// Reproduce cambios de texto y el paso del tiempo sin conectarse a Flow.
// Capturamos lo enviado a la voz; escuchar NVDA requiere una prueba manual.
// Ejecutar: node tests/flow-incremental.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../Extension/content/adapters/kwsr.consoleRenderers.js'), 'utf8');

function fixture(platform = 'flow') {
  let now = 0, id = 0;
  const timers = new Map(), spoken = [], logs = [];
  class Element {
    constructor() { this.textContent = ''; this.tagName = 'DIV'; }
    get innerText() { return this.textContent; }
    closest() { return null; }
    getBoundingClientRect() { return { width: 200, height: 40 }; }
  }
  const el = new Element();
  const KWSR = {
    state: { extensionActiva: true, effectiveFuente: 'visual' }, CFG: { debug: true },
    visual: {}, platforms: { getPlatform: () => platform },
    voice: { shouldReadNow: () => true, leerTextoAccesible: text => spoken.push({ text, at: now }) },
    log: (...args) => logs.push(args)
  };
  const context = {
    window: { KWSR }, Element, Date: { now: () => now },
    document: { querySelectorAll: () => el.textContent ? [el] : [] },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
    setTimeout: (fn, delay) => { timers.set(++id, { at: now + delay, fn }); return id; },
    clearTimeout: key => timers.delete(key)
  };
  vm.runInNewContext(source, context);
  return {
    KWSR, spoken, logs,
    text(value) { el.textContent = value; KWSR.consoleRenderers.livePoll(); },
    advance(ms) {
      const end = now + ms;
      while (true) {
        const next = [...timers].sort((a,b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        timers.delete(next[0]); now = next[1].at; next[1].fn();
      }
      now = end;
    },
    texts() { return spoken.map(x => x.text); }
  };
}

test('letters complete the same pending word instead of losing its ending', () => {
  const f = fixture();
  for (const text of ['RE', 'RENUN', 'RENUNCIO A MI TR', 'RENUNCIO A MI TRABAJO']) {
    f.text(text); f.advance(60);
  }
  assert.deepEqual(f.texts(), []);
  f.advance(350);
  assert.deepEqual(f.texts(), ['RENUNCIO A MI TRABAJO']);
});
test('isolated word is delivered after 350 ms; repeated polls do not delay it', () => {
  const f = fixture(); f.text('Sí'); f.advance(200); f.text('Sí'); f.advance(149);
  assert.deepEqual(f.texts(), []);
  f.advance(1); assert.deepEqual(f.texts(), ['Sí']);
});
test('continuous updates have a time limit and retain the unfinished last word', () => {
  const f = fixture();
  for (const text of ['HOY', 'HOY VAMOS', 'HOY VAMOS A', 'HOY VAMOS A TRA']) {
    f.text(text); f.advance(250);
  }
  assert.deepEqual(f.texts(), ['HOY VAMOS A']);
  assert.equal(f.spoken[0].at, 850);
  f.text('HOY VAMOS A TRABAJAR'); f.advance(350);
  assert.deepEqual(f.texts(), ['HOY VAMOS A', 'TRABAJAR']);
});
test('the pause still sends the last word after a continuous flush', () => {
  const f = fixture();
  for (const text of ['UNA', 'UNA FRASE', 'UNA FRASE COMPLETA', 'UNA FRASE COMPLETA AHORA']) {
    f.text(text); f.advance(250);
  }
  f.advance(100);
  assert.deepEqual(f.texts(), ['UNA FRASE COMPLETA', 'AHORA']);
});
test('corrections replace pending words rather than concatenating old mistakes', () => {
  const f = fixture(); f.text('HOY LLUEBE'); f.advance(100); f.text('HOY LLUEVE'); f.advance(350);
  assert.deepEqual(f.texts(), ['HOY LLUEVE']);
});
test('rolling lines omit only an already delivered prefix', () => {
  const f = fixture(); f.text('HOY VAMOS A CASA'); f.advance(350);
  f.text('A CASA CON ANA'); f.advance(350);
  assert.deepEqual(f.texts(), ['HOY VAMOS A CASA', 'CON ANA']);
});
test('new cue and empty gap deliver pending text and release repeated cues', () => {
  const f = fixture(); f.text('Hola'); f.text('Adiós'); f.advance(350); f.text(''); f.text('Adiós'); f.advance(350);
  assert.deepEqual(f.texts(), ['Hola', 'Adiós', 'Adiós']);
});
test('stop or disable prevents a pending timer from delivering old text', () => {
  const f = fixture(); f.text('Pendiente'); f.KWSR.consoleRenderers.resetLiveState(); f.advance(1000);
  assert.deepEqual(f.texts(), []);
  f.text('Otro'); f.KWSR.state.extensionActiva = false; f.advance(1000);
  assert.deepEqual(f.texts(), []);
});
test('YouTube retains its existing 850 ms single-word pause', () => {
  const f = fixture('youtube'); f.text('Sí'); f.advance(849); assert.deepEqual(f.texts(), []);
  f.advance(1); assert.deepEqual(f.texts(), ['Sí']);
});
test('Flow debug records contain copyable JSON text', () => {
  const f = fixture(); f.text('Hola'); f.advance(350);
  assert.equal(f.logs.length, 2);
  for (const args of f.logs) {
    assert.equal(args.length, 1);
    assert.equal(JSON.parse(args[0].slice(args[0].indexOf('{'))).renderer, 'THEOplayer / Flow-like');
  }
});
test('rolling lines preserve pending text that leaves the screen', () => {
  const f = fixture(); f.text('HOY VAMOS A CASA'); f.advance(100);
  f.text('A CASA CON ANA'); f.advance(350);
  assert.deepEqual(f.texts(), ['HOY VAMOS A CASA', 'CON ANA']);
});
test('a single continuously growing word is not emitted in pieces', () => {
  const f = fixture();
  for (const text of ['T', 'TR', 'TRA', 'TRAB', 'TRABA', 'TRABAJ', 'TRABAJO']) {
    f.text(text); f.advance(200);
  }
  f.advance(350);
  assert.deepEqual(f.texts(), ['TRABAJO']);
});
test('switching source or pausing before delivery cancels the pending output', () => {
  const f = fixture(); f.text('Pendiente'); f.KWSR.state.effectiveFuente = 'track'; f.advance(1000);
  assert.deepEqual(f.texts(), []);
  f.KWSR.state.effectiveFuente = 'visual'; f.text('Otro');
  f.KWSR.voice.shouldReadNow = () => false; f.advance(1000);
  assert.deepEqual(f.texts(), []);
});
