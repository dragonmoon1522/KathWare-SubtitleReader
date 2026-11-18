// Escenarios DOM en Chrome real. No abren Crunchyroll ni acreditan su servicio.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
let browser;
before(async () => { browser = await chromium.launch({ channel: 'chrome', headless: true }); });
after(async () => { await browser?.close(); });
async function setup(t, content = '') {
  const p = await browser.newPage(); t.after(() => p.close());
  await p.setContent(`<style>#video-player{position:relative;width:640px;height:360px}video{width:640px;height:360px}.caption{position:absolute;top:280px;left:100px}</style>
    <div id="video-player"><video></video>${content}</div>`);
  await p.evaluate(() => {
    window.spoken = [];
    const video = document.querySelector('video');
    Object.defineProperty(video, 'paused', { value: false, configurable: true });
    window.KWSR = { state: { extensionActiva: true, currentVideo: video, effectiveFuente: 'visual', modoNarradorGlobal: 'lector' },
      CFG: {}, voice: { shouldReadNow: () => true, leerTextoAccesible: text => spoken.push(text) } };
  });
  await p.addScriptTag({ path: path.join(__dirname, '../Extension/content/core/kwsr.platforms.js') });
  await p.evaluate(() => { KWSR.platforms.getPlatform = () => 'crunchyroll'; });
  for (const file of ['core/kwsr.visual.js', 'adapters/kwsr.consoleRenderers.js']) {
    await p.addScriptTag({ path: path.join(__dirname, '../Extension/content', file) });
  }
  return p;
}
test('unknown-site search reuses Hive selectors and reports the chosen profile', async t => {
  const p = await setup(t, '<span class="caption hive-subtitle-renderer-line">Frase de ejemplo.</span>');
  await p.evaluate(() => { KWSR.visual.startVisual(); KWSR.visual.pollVisualTick(); });
  assert.deepEqual(await p.evaluate(() => spoken), ['Frase de ejemplo.']);
  assert.equal(await p.evaluate(() => KWSR.state.visualSelectorChoice.source), 'disney');
  assert.equal(await p.evaluate(() => KWSR.visual.getSelectorSearchState().status), 'matched');
});
test('menu matches are rejected, while a later compatible caption recovers automatically', async t => {
  const p = await setup(t, '<button class="caption"><span class="playkit-subtitle">Subtítulos</span></button>');
  await p.evaluate(() => { KWSR.visual.startVisual(); KWSR.visual.pollVisualTick(); });
  assert.deepEqual(await p.evaluate(() => spoken), []);
  await p.waitForTimeout(1100);
  await p.evaluate(() => {
    const line = document.createElement('span'); line.className = 'caption hive-subtitle-renderer-line';
    line.textContent = 'Subtítulo disponible.'; document.querySelector('#video-player').appendChild(line);
  });
  await p.waitForFunction(() => spoken.includes('Subtítulo disponible.'));
});
