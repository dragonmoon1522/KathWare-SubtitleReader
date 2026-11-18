const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/selector-dom.cjs');

test('Crunchyroll receives every existing bank and compatibility selector without duplicates', () => {
  const f = fixture(), api = f.KWSR.platforms;
  const all = api.selectorCandidates('crunchyroll').map(c => c.selector);
  for (const source of ['netflix', 'disney', 'max', 'youtube', 'flow', 'vix', 'generic']) {
    for (const selector of api.platformSelectors(source)) assert.ok(all.includes(selector), selector);
  }
  assert.equal(new Set(all).size, all.length);
});

test('each existing DOM profile can be reused on an unverified site', () => {
  const build = {
    netflix: f => f.node('span', {}, 'Subtítulo de ejemplo.', f.node('div', { class: 'player-timedtext-text-container' })),
    disney: f => f.node('span', { class: 'hive-subtitle-renderer-line' }, 'Subtítulo de ejemplo.'),
    max: f => f.node('span', { 'data-testid': 'cueBoxRowTextCue' }, 'Subtítulo de ejemplo.'),
    youtube: f => f.node('span', { class: 'ytp-caption-segment' }, 'Subtítulo de ejemplo.'),
    flow: f => f.node('span', {}, 'Subtítulo de ejemplo.', f.node('div', { class: 'theoplayer-texttracks' })),
    vix: f => { const line = f.node('p', {}, 'Subtítulo de ejemplo.', f.node('div')); line.style.display = 'table'; return line; },
    videojs: f => f.node('div', { class: 'vjs-text-track-cue' }, 'Subtítulo de ejemplo.', f.node('div', { class: 'vjs-text-track-display' })),
    playkit: f => f.node('span', { class: 'playkit-subtitle' }, 'Subtítulo de ejemplo.'),
    plyr: f => f.node('span', { class: 'plyr__caption' }, 'Subtítulo de ejemplo.', f.node('div', { class: 'plyr__captions' }))
  };
  for (const [name, make] of Object.entries(build)) {
    const f = fixture(); make(f); f.start();
    assert.deepEqual(f.spoken, ['Subtítulo de ejemplo.'], name);
    assert.equal(f.KWSR.state.visualSelectorChoice.fallback, true, name);
  }
});

test('a verified site keeps its own working bank before foreign matches', () => {
  const f = fixture('www.disneyplus.com');
  f.node('span', { class: 'hive-subtitle-renderer-line' }, 'Subtítulo propio.');
  f.node('span', { class: 'playkit-subtitle' }, 'Otro candidato.');
  f.start();
  f.KWSR.state.visualDirty = true; f.KWSR.visual.pollVisualTick(true);
  assert.deepEqual(f.spoken, ['Subtítulo propio.']);
  assert.equal(f.KWSR.state.visualSelectorChoice.source, 'disney');
  assert.equal(f.KWSR.state.visualSelectorChoice.fallback, false);
});

test('an unavailable native bank also permits another compatible profile', () => {
  const f = fixture('www.disneyplus.com');
  f.node('span', { class: 'playkit-subtitle' }, 'Subtítulo alternativo.'); f.start();
  assert.deepEqual(f.spoken, ['Subtítulo alternativo.']);
  assert.equal(f.KWSR.state.visualSelectorChoice.fallback, true);
});

test('menu items, own UI, hidden ancestors and captions outside the current video are rejected', () => {
  for (const contaminate of [
    (f, n) => { const button = f.node('button'); button.appendChild(n); },
    (f, n) => { const menu = f.node('div', { role: 'menu' }); menu.appendChild(n); },
    (f, n) => { const menu = f.node('div', { class: 'caption-settings' }); menu.appendChild(n); },
    (f, n) => { const own = f.node('div', { id: 'kathware-overlay-root' }); own.appendChild(n); },
    (f, n) => { const hidden = f.node('div'); hidden.style.display = 'none'; hidden.appendChild(n); },
    (f, n) => { n.box.left = 900; },
    (f, n) => { n.hidden = true; }
  ]) {
    const f = fixture(), n = f.node('span', { class: 'hive-subtitle-renderer-line' }, 'No es un subtítulo usable.');
    contaminate(f, n); f.start();
    assert.deepEqual(f.spoken, []);
    assert.equal(f.KWSR.visual.getSelectorSearchState().status, 'waiting');
  }
});

test('a coincidental cc class does not turn account text into subtitles', () => {
  const f = fixture();
  f.node('span', {}, 'Mi cuenta', f.node('div', { class: 'account' }));
  f.start(); assert.deepEqual(f.spoken, []);
});

test('visually displayed captions remain readable when their source is aria-hidden', () => {
  const f = fixture(); f.node('span', { class: 'playkit-subtitle', 'aria-hidden': 'true' }, 'Texto visual.');
  f.start(); assert.deepEqual(f.spoken, ['Texto visual.']);
});

test('structural ViX fallback does not accept arbitrary paragraphs in a player', () => {
  const f = fixture(); f.node('p', {}, 'Descripción del video.', f.node('div'));
  f.start(); assert.deepEqual(f.spoken, []);
});

test('reselecting recovers a replaced caption profile and keeps unchanged text deduplicated', () => {
  const f = fixture(), old = f.node('span', { class: 'playkit-subtitle' }, 'Primera frase.');
  f.start(); f.KWSR.visual.pollVisualTick();
  assert.deepEqual(f.spoken, ['Primera frase.']);
  old.remove(); f.node('span', { class: 'hive-subtitle-renderer-line' }, 'Segunda frase.');
  f.advance(1100); f.KWSR.visual.visualReselectTick(); f.KWSR.visual.pollVisualTick();
  assert.deepEqual(f.spoken, ['Primera frase.', 'Segunda frase.']);
});

test('a full failed search is a waiting state and can recover when captions appear later', () => {
  const f = fixture(); f.start();
  const initial = f.KWSR.visual.getSelectorSearchState();
  assert.equal(initial.status, 'waiting'); assert.equal(initial.attempted, initial.total);
  const line = f.node('span', { class: 'playkit-subtitle' }, 'Apareció después.');
  f.advance(1100); f.mutate(line); f.advance(16);
  assert.deepEqual(f.spoken, ['Apareció después.']);
  assert.equal(f.KWSR.visual.getSelectorSearchState().status, 'matched');
});

test('native tracks, OFF and absent videos are not reported as incompatible', () => {
  const f = fixture(); f.start();
  f.KWSR.state.effectiveFuente = 'track';
  assert.equal(f.KWSR.visual.getSelectorSearchState().status, 'track');
  f.KWSR.state.extensionActiva = false;
  assert.equal(f.KWSR.visual.getSelectorSearchState().status, 'inactive');
  f.KWSR.state.extensionActiva = true; f.KWSR.state.currentVideo = null;
  assert.equal(f.KWSR.visual.getSelectorSearchState().status, 'no-video');
});

test('the already-existing open Shadow DOM fallback is reported as a successful match', () => {
  const f = fixture(); f.start();
  f.KWSR.openShadowCaptions = { getCandidate: () => ({ text: 'Subtítulo en componente.' }) };
  assert.equal(f.KWSR.visual.getSelectorSearchState().status, 'matched');
  assert.equal(f.KWSR.visual.getSelectorSearchState().selected.source, 'open-shadow');
});

test('native ViX grouping retains two lines and can deliver an identical cue after a gap', () => {
  const f = fixture('www.vix.com'), wrap = f.node('div');
  const first = f.node('p', {}, 'Una frase', wrap), second = f.node('p', {}, 'en dos líneas.', wrap);
  first.style.display = second.style.display = 'table';
  f.start(); f.KWSR.visual.pollVisualTick();
  assert.deepEqual(f.spoken, ['Una frase en dos líneas.']);
  first.textContent = second.textContent = ''; f.KWSR.visual.pollVisualTick();
  first.textContent = 'Una frase'; second.textContent = 'en dos líneas.';
  f.KWSR.visual.pollVisualTick();
  assert.deepEqual(f.spoken, ['Una frase en dos líneas.', 'Una frase en dos líneas.']);
});

test('a generic fallback recovers a cue made visible by CSS without a text mutation', () => {
  const f = fixture(), n = f.node('span', { class: 'playkit-subtitle' }, 'Ahora visible.');
  n.style.display = 'none'; f.start();
  assert.deepEqual(f.spoken, []);
  n.style.display = 'block'; f.advance(1100); f.KWSR.visual.pollVisualTick();
  assert.deepEqual(f.spoken, ['Ahora visible.']);
});

test('searches are bounded between polls and reset when the current video changes', () => {
  const f = fixture(); f.start();
  const count = f.logs.filter(log => log[0] === 'SELECTOR search').length;
  for (let i = 0; i < 10; i++) f.KWSR.visual.pollVisualTick();
  assert.equal(f.logs.filter(log => log[0] === 'SELECTOR search').length, count);
  f.KWSR.state.currentVideo = { ...f.video, currentSrc: 'blob:nuevo' };
  f.KWSR.visual.pollVisualTick();
  assert.equal(f.logs.filter(log => log[0] === 'SELECTOR search').length, count + 1);
});

test('periodic compatibility checks do not repeat an unchanged Disney cue', () => {
  for (const native of [true, false]) {
    const f = fixture('www.disneyplus.com');
    f.node('span', { class: native ? 'hive-subtitle-renderer-line' : 'playkit-subtitle' }, 'Una frase que sigue visible.');
    f.start();
    f.KWSR.state.visualDirty = true; f.KWSR.visual.pollVisualTick(true);
    for (let i = 0; i < 5; i++) { f.advance(650); f.KWSR.visual.pollVisualTick(); }
    assert.deepEqual(f.spoken, ['Una frase que sigue visible.']);
  }
});
