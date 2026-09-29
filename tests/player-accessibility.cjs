// Requiere playwright y Chrome instalado. Ejecutar: node --test tests/player-accessibility.cjs
// PARA UBICARTE
// Estas pruebas abren páginas de ejemplo en Chrome sin una ventana visible.
// Simulan Tab, Enter y Espacio y comprueban etiquetas, foco y panel.
// No abren una cuenta de ViX. La prueba real con NVDA se hace por separado.
// Esta carpeta no se carga como parte de la extensión.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
let browser;
before(async () => { browser = await chromium.launch({ channel: 'chrome', headless: true }); });
after(async () => { await browser?.close(); });

async function fixture(t, controls = '') {
  // fixture significa escenario de prueba: una página pequeña y controlada.
  // Cada prueba recibe una página nueva para no heredar el estado de otra.
  const page = await browser.newPage();
  t.after(() => page.close());
  await page.setContent(`<style>
    #video-player { width:640px; height:360px; position:relative; }
    video { width:640px; height:360px; }
    #controls { position:absolute; bottom:10px; }
    button,[data-testid$='-btn'],[role=button] { min-width:50px; min-height:30px; }
  </style><button id="before">Antes</button><div id="video-player"><video></video>
  <div id="controls">${controls}</div></div>`);
  await page.evaluate(() => {
    window.KWSR = {
      state: { extensionActiva: true, currentVideo: document.querySelector('video') },
      CFG: { debug: true, seekBig: 10 },
      platforms: { getPlatform: () => 'vix', platformCapabilities: () => ({ nonAccessibleFixes:true, keepAlive:true }) }
    };
    window.logs = [];
    console.log = (...args) => window.logs.push(args);
  });
  for (const file of ['ui/kwsr.overlay.js', 'adapters/kwsr.keepAlive.js', 'adapters/kwsr.nonAccessible.platforms.js', 'adapters/kwsr.vixPlayerA11y.js', 'adapters/kwsr.playerUIRules.js']) {
    await page.addScriptTag({ path: path.join(__dirname, '../Extension/content', file) });
  }
  await page.evaluate(() => {
    KWSR.vixPlayerA11y.scan();
    KWSR.overlay.ensureOverlay();
    KWSR.overlay.setPanelOpen(true);
    document.addEventListener('keydown', e => KWSR.overlay.handlePlayerHotkeys(e), true);
  });
  return page;
}

test('ViX labels converge instead of alternating between two adapters', async t => {
  const p = await fixture(t, '<button class="player-button" data-testid="play-btn"></button><button class="player-button" data-testid="volume-btn"></button><button class="player-button" data-testid="cast-btn"></button>');
  const result = await p.evaluate(() => {
    const initial = [...document.querySelectorAll('#controls button')].map(el => el.getAttribute('aria-label'));
    const logCount = logs.filter(x => x[0].includes('ViX')).length;
    for (let i = 0; i < 20; i++) {
      KWSR.nonAccessiblePlatforms.tick();
      if (KWSR.vixPlayerA11y.scan().labeled !== 0) throw Error('Labels did not converge');
    }
    return { initial, final: [...document.querySelectorAll('#controls button')].map(el => el.getAttribute('aria-label')), logCount, finalCount: logs.filter(x => x[0].includes('ViX')).length };
  });
  assert.deepEqual(result.initial, result.final);
  assert.deepEqual(result.initial, ['Reproducir', 'Volumen o silenciar', 'Transmitir']);
  assert.equal(result.logCount, result.finalCount);
});

test('real Tab navigation and one activation per Enter/Space on custom buttons', async t => {
  const p = await fixture(t, '<button id="play" tabindex="-1" data-testid="play-btn"></button><div id="mute" tabindex="-1" data-testid="volume-btn"></div>');
  await p.evaluate(() => { window.clicks = 0; document.querySelector('#mute').addEventListener('click', () => clicks++); });
  await p.locator('#before').focus();
  await p.keyboard.press('Tab');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'play');
  await p.keyboard.press('Tab');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'mute');
  await p.keyboard.press('Enter');
  await p.keyboard.press('Space');
  assert.equal(await p.evaluate(() => clicks), 2);
  assert.equal(await p.evaluate(() => KWSR.state.currentVideo.muted), false);
});

test('containers, captions, sliders, disabled and hidden controls are untouched', async t => {
  const p = await fixture(t, `<div id="wrapper" data-testid="player-controls"><button data-testid="play-btn"></button></div>
    <p id="caption" data-testid="subtitle">Texto original</p><div id="slider" role="slider" tabindex="-1"></div>
    <button id="disabled" disabled tabindex="-1"></button><div inert><button id="inert" tabindex="-1"></button></div>
    <div style="opacity:0"><button id="hidden" tabindex="-1"></button></div>`);
  for (const id of ['wrapper', 'caption']) assert.equal(await p.locator(`#${id}`).getAttribute('role'), null);
  assert.equal(await p.locator('#caption').textContent(), 'Texto original');
  for (const id of ['slider', 'disabled', 'inert', 'hidden']) assert.equal(await p.locator(`#${id}`).getAttribute('tabindex'), '-1');
});

test('site names are preserved; owned names follow changing icons', async t => {
  const p = await fixture(t, '<button id="play" data-testid="play-btn"></button><span id="name">Nombre propio</span><button id="named" aria-labelledby="name" data-testid="volume-btn"></button>');
  assert.equal(await p.locator('#named').getAttribute('aria-label'), null);
  await p.locator('#play').evaluate(el => el.setAttribute('data-testid', 'pause-btn'));
  await p.waitForFunction(() => document.querySelector('#play').getAttribute('aria-label') === 'Pausar');
  await p.locator('#play').evaluate(el => { el.setAttribute('aria-label', 'Nombre del sitio'); el.setAttribute('data-testid', 'play-btn'); });
  await p.evaluate(() => KWSR.vixPlayerA11y.scan());
  assert.equal(await p.locator('#play').getAttribute('aria-label'), 'Nombre del sitio');
});

test('fallback requires visible, enabled controls actually in the Tab order', async t => {
  const p = await fixture(t);
  // Cambiar a otro sitio para probar el detector sin la reparación de ViX.
  await p.evaluate(() => {
    KWSR.platforms.getPlatform = () => 'generic';
    document.querySelector('#controls').innerHTML = '<div role="button" aria-label="Play"></div><button tabindex="-1" aria-label="Volume"></button><button aria-label="Fullscreen"></button>';
  });
  assert.equal(await p.evaluate(() => KWSR.playerUIRules.nativePlayerAccessibility().accessible), false);
  await p.evaluate(() => document.querySelectorAll('#controls > *').forEach(el => el.tabIndex = 0));
  assert.equal(await p.evaluate(() => KWSR.playerUIRules.nativePlayerAccessibility().accessible), true);
  for (const [attr, value] of [['style','opacity:0'], ['aria-hidden','true'], ['inert',''], ['hidden','']]) {
    await p.locator('#controls').evaluate((el, pair) => el.setAttribute(...pair), [attr, value]);
    assert.equal(await p.evaluate(() => KWSR.playerUIRules.nativePlayerAccessibility().accessible), false, attr);
    await p.locator('#controls').evaluate((el, attr) => el.removeAttribute(attr), attr);
  }
  await p.locator('#controls button').first().evaluate(el => el.disabled = true);
  assert.equal(await p.evaluate(() => KWSR.playerUIRules.nativePlayerAccessibility().accessible), false);
});

test('hiding fallback retains panel, close button and focus; no self-triggered mutation loop', async t => {
  const p = await fixture(t);
  await p.locator('#kwsr-fallback-player-controls button').first().focus();
  await p.evaluate(() => {
    KWSR.state.currentVideo.controls = true;
    KWSR.playerUIRules.syncFallbackPlayer();
  });
  assert.equal(await p.locator('#kwsr-fallback-player-controls').isVisible(), false);
  assert.equal(await p.locator('#kathware-overlay-panel').isVisible(), true);
  assert.equal(await p.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Cerrar panel');
  assert.equal(await p.locator('#kathware-overlay-panel button[aria-label="Subtítulos"]').count(), 0);
  const mutations = await p.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    let count = 0;
    const observer = new MutationObserver(records => count += records.length);
    observer.observe(KWSR.state.overlayRoot, { attributes: true, subtree: true, childList: true });
    for (let i=0; i<10; i++) KWSR.playerUIRules.syncFallbackPlayer();
    await new Promise(resolve => setTimeout(resolve, 100));
    observer.disconnect();
    return count;
  });
  assert.equal(mutations, 0);
});

test('overlay survives container fullscreen and DOM removal', async t => {
  const p = await fixture(t);
  await p.locator('#before').evaluate(el => el.addEventListener('click', () => document.querySelector('#video-player').requestFullscreen()));
  await p.locator('#before').click();
  await p.waitForFunction(() => document.fullscreenElement?.contains(KWSR.state.overlayRoot));
  assert.equal(await p.locator('#kathware-overlay-panel').isVisible(), true);
  await p.evaluate(() => document.exitFullscreen());
  await p.waitForFunction(() => KWSR.state.overlayRoot.parentElement === document.documentElement);
  await p.evaluate(() => { KWSR.state.overlayRoot.remove(); KWSR.overlay.updateOverlayStatus(); });
  assert.equal(await p.locator('#kathware-overlay-panel').isVisible(), true);
});

test('ViX keepAlive emits one bubbling movement and Tab reveals hidden controls', async t => {
  const p = await fixture(t, '<button id="play" data-testid="play-btn" tabindex="-1"></button>');
  await p.evaluate(() => {
    const controls = document.querySelector('#controls');
    controls.style.display = 'none';
    window.moves = 0;
    document.addEventListener('mousemove', () => moves++);
    document.querySelector('#video-player').addEventListener('mousemove', () => { controls.style.display = 'block'; });
  });
  await p.locator('#before').focus();
  await p.keyboard.press('Tab');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'play');
  assert.equal(await p.evaluate(() => moves), 1);
});

test('replacement controls are repaired, while extension OFF leaves new controls alone', async t => {
  const p = await fixture(t, '<button id="play" data-testid="play-btn"></button>');
  await p.locator('#controls').evaluate(el => { el.innerHTML = '<div id="replacement" tabindex="-1" data-testid="pause-btn"></div>'; });
  await p.waitForFunction(() => document.querySelector('#replacement').tabIndex === 0);
  assert.equal(await p.locator('#replacement').getAttribute('aria-label'), 'Pausar');
  await p.locator('#replacement').evaluate(el => el.tabIndex = -1);
  await p.waitForFunction(() => document.querySelector('#replacement').tabIndex === 0);
  await p.evaluate(() => {
    KWSR.state.extensionActiva = false;
    document.querySelector('#controls').innerHTML = '<div id="off" tabindex="-1" data-testid="pause-btn"></div>';
    KWSR.vixPlayerA11y.scan();
  });
  await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await p.locator('#off').getAttribute('tabindex'), '-1');
  assert.equal(await p.locator('#off').getAttribute('aria-label'), null);
});
