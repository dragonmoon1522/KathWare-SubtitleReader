// Detector visual en Chrome real; la salida se captura antes de NVDA/TTS.
// PARA UBICARTE
// Creamos subtítulos de ejemplo y guardamos en spoken lo que el detector entrega.
// Así podemos comprobar si falta una frase sin tener que escuchar una voz.
// Esto verifica la detección, no lo que NVDA o el sintetizador pronuncian.
// Ejecutar con Playwright y Chrome disponibles: node --test tests/vix-captions.cjs
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
let browser;
before(async () => { browser = await chromium.launch({ channel: 'chrome', headless: true }); });
after(async () => { await browser?.close(); });
async function setup(t, lines = '<p>Primera frase</p>') {
  const p = await browser.newPage();
  t.after(() => p.close());
  await p.setContent(`<style>#video-player {width:600px} p {display:table}</style>
    <div id="kathware-overlay-root">Panel</div><div id="video-player"><div id="captions">${lines}</div></div>`);
  await p.evaluate(() => {
    window.spoken = [];
    window.ready = true;
    window.KWSR = {
      state: { effectiveFuente: 'visual' }, CFG: {},
      utils: { normalize: s => String(s || '').replace(/\s+/g, ' ').trim() },
      platforms: { getPlatform: () => 'vix', platformSelectors: () => ['#video-player div > p'], platformCapabilities: () => ({}) },
      voice: { shouldReadNow: () => ready, leerTextoAccesible: text => spoken.push(text) }
    };
  });
  await p.addScriptTag({ path: path.join(__dirname, '../Extension/content/core/kwsr.visual.js') });
  await p.evaluate(() => KWSR.visual.startVisual());
  return p;
}
test('retained empty/hidden lines do not discard the visible cue', async t => {
  const p = await setup(t, '<p>Primera frase</p><p> </p><p style="display:none">Oculta</p>');
  await p.evaluate(() => KWSR.visual.pollVisualTick());
  assert.deepEqual(await p.evaluate(() => spoken), ['Primera frase']);
});
test('mixed batches beginning with our UI still deliver subtitle mutations', async t => {
  const p = await setup(t);
  await p.evaluate(() => {
    document.querySelector('#kathware-overlay-root').textContent = 'Estado actualizado';
    document.querySelector('p').textContent = 'Segunda frase';
  });
  await p.waitForFunction(() => spoken.includes('Segunda frase'));
  assert.deepEqual(await p.evaluate(() => spoken), ['Segunda frase']);
});
test('CSS-only visibility changes trigger reading without reading hidden ancestors', async t => {
  const p = await setup(t);
  await p.evaluate(() => { document.querySelector('#captions').style.opacity = '0'; KWSR.visual.pollVisualTick(); });
  assert.deepEqual(await p.evaluate(() => spoken), []);
  await p.evaluate(() => { document.querySelector('#captions').style.opacity = '1'; });
  await p.waitForFunction(() => spoken.length === 1);
  assert.deepEqual(await p.evaluate(() => spoken), ['Primera frase']);
});
test('timer recovers cue present at activation or changed while reading was paused', async t => {
  const p = await setup(t);
  await p.evaluate(() => { KWSR.visual.pollVisualTick(); window.ready = false; document.querySelector('p').textContent = 'Al reanudar'; });
  await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await p.evaluate(() => { ready = true; KWSR.visual.pollVisualTick(); KWSR.visual.pollVisualTick(); });
  assert.deepEqual(await p.evaluate(() => spoken), ['Primera frase', 'Al reanudar']);
});
test('repeated cue after a gap reaches output, unchanged cue stays deduplicated', async t => {
  const p = await setup(t);
  await p.evaluate(() => {
    KWSR.visual.pollVisualTick();
    KWSR.visual.pollVisualTick();
    document.querySelector('p').textContent = '';
    KWSR.visual.pollVisualTick();
    document.querySelector('p').textContent = 'Primera frase';
    KWSR.visual.pollVisualTick();
  });
  assert.deepEqual(await p.evaluate(() => spoken), ['Primera frase', 'Primera frase']);
});
test('two visible lines stay grouped; controls and own UI are not captions', async t => {
  const p = await setup(t, '<p>Una frase</p><p>en dos líneas.</p>');
  await p.evaluate(() => KWSR.visual.pollVisualTick());
  assert.deepEqual(await p.evaluate(() => spoken), ['Una frase en dos líneas.']);
  await p.evaluate(() => {
    document.querySelector('#captions').innerHTML = '<button>Configuración</button><p>Audio</p>';
    KWSR.visual.pollVisualTick();
  });
  assert.equal(await p.evaluate(() => spoken.length), 1);
});
