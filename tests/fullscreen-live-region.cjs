// Comprueba estructura, eventos y salida del lector. No acredita el habla de NVDA.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/live-region.cjs');

test('normal reading uses a persistent polite region independently of the panel', () => {
  const f = fixture();
  f.KWSR.voice.leerTextoAccesible('Primera frase.');
  const region = f.KWSR.state.liveRegion;
  assert.equal(region.parentNode, f.document.documentElement);
  assert.equal(region.getAttribute('role'), 'status');
  assert.equal(region.getAttribute('aria-live'), 'polite');
  assert.equal(region.textContent, '');
  f.advance(10);
  assert.equal(region.textContent, 'Primera frase.');
});

test('fullscreen announcements live inside the fullscreen player', () => {
  const f = fixture(); f.fullscreen(f.player);
  f.KWSR.voice.leerTextoAccesible('Frase en pantalla completa.');
  f.advance(10);
  assert.equal(f.KWSR.state.liveRegion.parentNode, f.player);
  assert.equal(f.KWSR.state.liveRegion.textContent, 'Frase en pantalla completa.');
  assert.equal(f.document.activeElement, f.focus);
  assert.equal(f.focus.focusCalls, 0);
});

test('entering fullscreen prepares an empty region before the next caption arrives', () => {
  const f = fixture(); f.fullscreen(f.player);
  assert.ok(f.KWSR.state.liveRegion);
  assert.equal(f.KWSR.state.liveRegion.parentNode, f.player);
  assert.equal(f.KWSR.state.liveRegion.textContent, '');
});

test('the cached region follows entry, exit and a different fullscreen container', () => {
  const f = fixture(); f.KWSR.voice.pushToLiveRegion('Ya leído.'); f.advance(10);
  const region = f.KWSR.state.liveRegion;
  f.fullscreen(f.player);
  assert.equal(f.KWSR.state.liveRegion, region);
  assert.equal(region.parentNode, f.player);
  assert.equal(region.textContent, '');
  f.fullscreen(null);
  assert.equal(region.parentNode, f.document.documentElement);
  const next = f.body.appendChild(f.node('section'));
  f.fullscreen(next);
  assert.equal(region.parentNode, next);
  assert.equal(f.document.activeElement, f.focus);
});

test('removing the announcement node does not permanently disable future captions', () => {
  const f = fixture(); f.fullscreen(f.player);
  f.KWSR.voice.pushToLiveRegion('Primera.'); f.advance(10);
  const region = f.KWSR.state.liveRegion;
  region.remove();
  f.KWSR.voice.pushToLiveRegion('Segunda.'); f.advance(10);
  assert.equal(region.parentNode, f.player);
  assert.equal(region.textContent, 'Segunda.');
});

test('an open shadow tree receives the region in its actual fullscreen container', () => {
  const f = fixture();
  const host = f.body.appendChild(f.node('custom-player')), inner = f.node('section');
  host.shadowRoot = { fullscreenElement: inner };
  f.fullscreen(host);
  f.KWSR.voice.pushToLiveRegion('Dentro del reproductor.'); f.advance(10);
  assert.equal(f.KWSR.state.liveRegion.parentNode, inner);
});

test('native media fullscreen is identified without hiding a region in video fallback children', () => {
  const f = fixture(); f.fullscreen(f.video);
  f.KWSR.voice.pushToLiveRegion('Texto.'); f.advance(10);
  assert.equal(f.KWSR.state.liveRegion.parentNode, f.document.documentElement);
  const state = f.KWSR.voice.getLiveRegionState();
  assert.equal(state.scope, 'native-media-fullscreen');
  assert.equal(state.insideFullscreen, false);
});

test('a pending update resolves its new host if fullscreen changes before delivery', () => {
  const f = fixture(); f.KWSR.voice.pushToLiveRegion('Pendiente.');
  f.fullscreen(f.player); f.advance(10);
  const update = f.updates.find(x => x.text === 'Pendiente.');
  assert.equal(update.parent, f.player);
});

test('stopping cancels a scheduled announcement instead of speaking after shutdown', () => {
  const f = fixture(); f.KWSR.voice.pushToLiveRegion('No debe salir.');
  f.KWSR.voice.detenerLectura(); f.advance(100);
  assert.equal(f.KWSR.state.liveRegion.textContent, '');
});

test('a paused, disabled or changed output mode suppresses a stale pending announcement', () => {
  for (const stop of [
    f => { f.KWSR.state.extensionActiva = false; },
    f => { f.KWSR.state.modoNarradorGlobal = 'off'; },
    f => { f.KWSR.state.modoNarradorGlobal = 'sintetizador'; },
    f => { f.video.paused = true; }
  ]) {
    const f = fixture(); f.KWSR.voice.pushToLiveRegion('Pendiente.'); stop(f); f.advance(100);
    assert.equal(f.KWSR.state.liveRegion.textContent, '');
  }
});

test('fullscreen entry does not create an announcement region while the extension is inactive', () => {
  const f = fixture(); f.KWSR.state.extensionActiva = false; f.fullscreen(f.player);
  assert.equal(f.KWSR.state.liveRegion, null);
});

test('a fullscreen transition preserves subtitle deduplication and does not replay the previous line', () => {
  const f = fixture(); f.KWSR.voice.leerTextoAccesible('Misma frase.'); f.advance(10);
  f.fullscreen(f.player); f.KWSR.voice.leerTextoAccesible('Misma frase.'); f.advance(10);
  assert.equal(f.updates.filter(x => x.text === 'Misma frase.').length, 1);
  f.KWSR.voice.leerTextoAccesible('Otra frase.'); f.advance(10);
  assert.equal(f.KWSR.state.liveRegion.textContent, 'Otra frase.');
});

test('KathWare fullscreen uses an existing player container with the video and controls', () => {
  const f = fixture(); f.loadOverlay();
  const requested = [];
  f.player.requestFullscreen = () => { requested.push('player'); f.fullscreen(f.player); };
  f.video.requestFullscreen = () => requested.push('video');
  f.KWSR.keepAlive = { playerRoot: () => f.player };
  assert.equal(f.KWSR.overlay.handlePlayerHotkeys({ key: 'f', preventDefault() {} }), true);
  assert.deepEqual(requested, ['player']);
  assert.equal(f.video.parentNode, f.player);
  assert.equal(f.KWSR.state.liveRegion.parentNode, f.player);
  assert.equal(f.document.activeElement, f.focus);
});

test('no suitable player container keeps native fullscreen and its limitation notice', () => {
  for (const root of [null, 'body', 'unrelated']) {
    const f = fixture(); f.loadOverlay();
    let requested = false;
    const notices = [];
    f.video.requestFullscreen = () => { requested = true; };
    f.KWSR.keepAlive = { playerRoot: () => root === 'body' ? f.body : root === 'unrelated' ? f.node('div') : null };
    f.KWSR.toast = { notify: text => notices.push(text) };
    f.KWSR.overlay.handlePlayerHotkeys({ key: 'f', preventDefault() {} });
    assert.equal(requested, true);
    assert.ok(notices.some(text => text.includes('nativa')));
    assert.equal(f.video.parentNode, f.player);
  }
});

test('a rejected fullscreen request is reported without changing focus or video structure', async () => {
  const f = fixture(); f.loadOverlay();
  const notices = [];
  f.KWSR.toast = { notify: text => notices.push(text) };
  f.KWSR.keepAlive = { playerRoot: () => f.player };
  f.player.requestFullscreen = () => Promise.reject(new Error('NotAllowedError'));
  f.KWSR.overlay.handlePlayerHotkeys({ key: 'f', preventDefault() {} });
  await Promise.resolve();
  assert.ok(notices.some(text => text.includes('No se pudo')));
  assert.equal(f.document.activeElement, f.focus);
  assert.equal(f.video.parentNode, f.player);
});
