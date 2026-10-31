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
    const data = JSON.parse(args[0].slice(args[0].indexOf('{')));
    assert.equal(data.renderer, 'THEOplayer / Flow-like');
    assert.equal(data.revision, 2);
  }
  assert.equal(f.KWSR.consoleRenderers.flowReaderRevision, 2);
});
test('rolling lines preserve pending text that leaves the screen', () => {
  const f = fixture(); f.text('HOY VAMOS A CASA'); f.advance(100);
  f.text('A CASA CON ANA'); f.advance(350);
  // Se puede entregar en una frase; desplazar la línea no fuerza una salida
  // anticipada que podría cortar una palabra todavía en formación.
  assert.equal(f.texts().join(' '), 'HOY VAMOS A CASA CON ANA');
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

// Secuencia enviada desde Flow real el 31/10/2026. Los intervalos son
// simulados: el registro recibido no incluye marcas de tiempo entre cambios.
const flowAdvertisement = [
  '>> TAFIROL DÚO ALIVIO POTENTE Y',
  '>> TAFIROL DÚO ALIVIO POTENTE Y E',
  '>> TAFIROL DÚO ALIVIO POTENTE Y EFECTIVO CO',
  '>> TAFIROL DÚO ALIVIO POTENTE Y EFECTIVO CONTRA E',
  '>> TAFIROL DÚO ALIVIO POTENTE Y EFECTIVO CONTRA EL DO',
  'EFECTIVO CONTRA EL DOLOR. >',
  'EFECTIVO CONTRA EL DOLOR. >> NO',
  'EFECTIVO CONTRA EL DOLOR. >> NO VOY',
  'EFECTIVO CONTRA EL DOLOR. >> NO VOY A',
  'EFECTIVO CONTRA EL DOLOR. >> NO VOY A CA',
  'EFECTIVO CONTRA EL DOLOR. >> NO VOY A CAER. NO'
];

test('Flow trace completes DO to DOLOR while the previous line leaves the screen', () => {
  const f = fixture();
  for (const text of flowAdvertisement.slice(0, 6)) {
    f.text(text); f.advance(60);
  }
  f.advance(350);
  assert.deepEqual(f.texts(), ['TAFIROL DÚO ALIVIO POTENTE Y EFECTIVO CONTRA EL DOLOR.']);
});

test('Flow trace keeps every word once across continuous delivery and line rolls', () => {
  const f = fixture();
  for (const text of flowAdvertisement) {
    f.text(text); f.advance(150);
  }
  f.advance(350);
  assert.equal(f.texts().join(' '), 'TAFIROL DÚO ALIVIO POTENTE Y EFECTIVO CONTRA EL DOLOR. NO VOY A CAER. NO');
  assert.equal(f.spoken[0].at, 850);
});

test('a roll completes pending words without repeating a previously delivered prefix', () => {
  const f = fixture();
  f.text('TAFIROL DÚO ALIVIO POTENTE Y'); f.advance(350);
  f.text('TAFIROL DÚO ALIVIO POTENTE Y EFECTIVO CONTRA EL DO'); f.advance(100);
  f.text('EFECTIVO CONTRA EL DOLOR.'); f.advance(350);
  assert.deepEqual(f.texts(), ['TAFIROL DÚO ALIVIO POTENTE Y', 'EFECTIVO CONTRA EL DOLOR.']);
});

test('a word completed after a delivery pause does not repeat the whole sentence', () => {
  const f = fixture();
  f.text('EL DO'); f.advance(350);
  f.text('EL DOLOR.'); f.advance(350);
  assert.deepEqual(f.texts(), ['EL DO', 'DOLOR.']);
});

test('Flow speaker markers alone never reach the voice', () => {
  const f = fixture();
  for (const text of ['>', '>>', '>> Hola >', '>> Hola >>']) {
    f.text(text); f.advance(350);
  }
  assert.deepEqual(f.texts(), ['Hola']);
});

test('words shared only in the middle of a new cue are not removed', () => {
  const f = fixture();
  f.text('HOY VAMOS A CASA'); f.advance(350);
  f.text('MAÑANA VAMOS A CASA CON ANA'); f.advance(350);
  assert.deepEqual(f.texts(), ['HOY VAMOS A CASA', 'MAÑANA VAMOS A CASA CON ANA']);
});

test('Flow trace rolls Y E to Y ES without repeating previously delivered words', () => {
  const f = fixture();
  f.text('DIFERENCIAS Y PELEAMOS, PERO NUNCA'); f.advance(350);
  f.text('DIFERENCIAS Y PELEAMOS, PERO NUNCA ANTES CON'); f.advance(350);
  for (const text of [
    'DIFERENCIAS Y PELEAMOS, PERO NUNCA ANTES CON CU',
    'DIFERENCIAS Y PELEAMOS, PERO NUNCA ANTES CON CUCH',
    'DIFERENCIAS Y PELEAMOS, PERO NUNCA ANTES CON CUCHIL',
    'DIFERENCIAS Y PELEAMOS, PERO NUNCA ANTES CON CUCHILLOS.',
    'DIFERENCIAS Y PELEAMOS, PERO NUNCA ANTES CON CUCHILLOS. Y',
    'DIFERENCIAS Y PELEAMOS, PERO NUNCA ANTES CON CUCHILLOS. Y E',
    'NUNCA ANTES CON CUCHILLOS. Y ES'
  ]) {
    f.text(text); f.advance(40);
  }
  f.advance(350);
  assert.deepEqual(f.texts(), ['DIFERENCIAS Y PELEAMOS, PERO NUNCA', 'ANTES CON', 'CUCHILLOS. Y ES']);
});

test('Flow trace ignores changing speaker markers and keeps corrected accents', () => {
  const f = fixture();
  f.text('POR ESTA CASA'); f.advance(350);
  for (const text of [
    'POR ESTA CASA.', 'POR ESTA CASA. >', 'POR ESTA CASA. >>',
    'POR ESTA CASA. >> MA', 'POR ESTA CASA. >> MAMA',
    'POR ESTA CASA. >> MAMÁ', 'POR ESTA CASA. >> MAMÁ!',
    'POR ESTA CASA. >> MAMÁ! PA', 'POR ESTA CASA. >> MAMÁ! PAPA',
    'POR ESTA CASA. >> MAMÁ! PAPÁ', 'POR ESTA CASA. >> MAMÁ! PAPÁ!'
  ]) {
    f.text(text); f.advance(40);
  }
  f.advance(350);
  assert.deepEqual(f.texts(), ['POR ESTA CASA', 'MAMÁ! PAPÁ!']);
});

test('a partial word without shared context does not join unrelated cues', () => {
  const f = fixture();
  f.text('YO TE'); f.advance(350);
  f.text('TENGO HAMBRE'); f.advance(350);
  assert.deepEqual(f.texts(), ['YO TE', 'TENGO HAMBRE']);
});

test('a roll with a repeated beginning preserves both occurrences of the phrase', () => {
  const f = fixture();
  f.text('HOY VAMOS A CASA HOY VAMOS A'); f.advance(100);
  f.text('HOY VAMOS A TRABAJAR'); f.advance(350);
  assert.equal(f.texts().join(' '), 'HOY VAMOS A CASA HOY VAMOS A TRABAJAR');
});
