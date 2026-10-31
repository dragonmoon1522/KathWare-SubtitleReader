// Reproduce subtítulos de YouTube con un reloj controlado. Comprueba la entrega
// a la capa de voz; el resultado auditivo de NVDA/TTS requiere una prueba real.
// Ejecutar: node --test tests/youtube-incremental.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/live-captions.cjs');
const setup = () => fixture('youtube');
const words = text => text.toLowerCase().replace(/[.,;:!?¿¡…]/g, '').replace(/\s+/g, ' ').trim();

test('continuous YouTube words are delivered after 850 ms without waiting for silence', () => {
  const f = setup();
  for (const text of ['Cuando', 'Cuando rasguees', 'Cuando rasguees hacia', 'Cuando rasguees hacia abajo']) {
    f.text(text); f.advance(250);
  }
  assert.deepEqual(f.texts(), ['Cuando rasguees hacia']);
  assert.equal(f.spoken[0].at, 850);
  f.advance(600);
  assert.deepEqual(f.texts(), ['Cuando rasguees hacia', 'abajo']);
});

test('a period added to an existing word releases the completed sentence', () => {
  const f = setup();
  f.text('Cuando rasguees hacia arriba'); f.advance(100);
  f.text('Cuando rasguees hacia arriba.');
  assert.deepEqual(f.texts(), ['Cuando rasguees hacia arriba.']);
});

test('sentence boundaries inside an update release the prefix and keep the next words', () => {
  const f = setup();
  f.text('Abajo, arriba'); f.advance(100);
  f.text('Abajo, arriba. Déjame mostrarte');
  assert.deepEqual(f.texts(), ['Abajo, arriba.']);
  f.advance(850);
  assert.deepEqual(f.texts(), ['Abajo, arriba.', 'Déjame mostrarte']);
});

test('commas stay attached to pending words in the strumming trace', () => {
  const f = setup();
  for (const text of ['Abajo', 'Abajo, arriba', 'Abajo, arriba, abajo', 'Abajo, arriba, abajo, arriba']) {
    f.text(text); f.advance(100);
  }
  f.advance(850);
  assert.equal(f.texts().join(' '), 'Abajo, arriba, abajo, arriba');
  f.text('Abajo, arriba, abajo, arriba . Nota'); f.advance(100);
  f.text('. Nota, arriba'); f.advance(100);
  f.text('. Nota, arriba, abajo'); f.advance(100);
  f.text('. Nota, arriba, abajo, arriba'); f.advance(850);
  assert.equal(f.texts().join(' '), 'Abajo, arriba, abajo, arriba Nota, arriba, abajo, arriba');
});

test('separate visible YouTube segments preserve intentional repeated words', () => {
  const f = setup();
  f.segments(['arriba,', 'abajo,', 'arriba,', 'abajo.']); f.advance(850);
  assert.equal(f.texts().join(' '), 'arriba, abajo, arriba, abajo.');
});

test('pending word corrections replace the old spelling', () => {
  const f = setup();
  f.text('Cuando rasg'); f.advance(100);
  f.text('Cuando rasguees'); f.advance(100);
  f.text('Cuando rasguees hacia abjo'); f.advance(100);
  f.text('Cuando rasguees hacia abajo.'); f.advance(850);
  assert.deepEqual(f.texts(), ['Cuando rasguees hacia abajo.']);
});

test('a rolling line keeps pending words that left the screen', () => {
  const f = setup();
  f.text('Cuando rasguees hacia abajo en ese'); f.advance(100);
  f.text('abajo en ese acorde de La menor, vas a rasguear'); f.advance(100);
  f.text('rasguear más fuerte que cuando rasgueaste hacia arriba.'); f.advance(850);
  assert.equal(words(f.texts().join(' ')), 'cuando rasguees hacia abajo en ese acorde de la menor vas a rasguear más fuerte que cuando rasgueaste hacia arriba');
});

test('a new sentence sharing words only in its middle is delivered in full', () => {
  const f = setup();
  f.text('hacia abajo'); f.advance(850);
  f.text('ahora hacia abajo otra vez.'); f.advance(850);
  assert.deepEqual(f.texts(), ['hacia abajo', 'ahora hacia abajo otra vez.']);
});

test('a paused or disabled reader does not deliver previously queued YouTube text', () => {
  for (const suspend of [
    f => { f.KWSR.state.extensionActiva = false; },
    f => { f.KWSR.state.effectiveFuente = 'track'; },
    f => { f.KWSR.voice.shouldReadNow = () => false; }
  ]) {
    const f = setup(); f.text('Pendiente'); suspend(f); f.advance(1000);
    assert.deepEqual(f.texts(), []);
  }
});

test('YouTube debug is copyable JSON and identifies the reader revision', () => {
  const f = setup(); f.text('Hola'); f.advance(850);
  assert.equal(f.KWSR.consoleRenderers.youtubeReaderRevision, 1);
  assert.equal(f.logs.length, 2);
  for (const args of f.logs) {
    assert.equal(args.length, 1);
    const data = JSON.parse(args[0].slice(args[0].indexOf('{')));
    assert.equal(data.renderer, 'YouTube captions');
    assert.equal(data.revision, 1);
  }
});

test('briefly replaced caption nodes preserve pending and delivered YouTube words', () => {
  const f = setup();
  f.text('Déjame mostrarte.'); f.advance(100);
  f.text('Déjame mostrarte. Abajo, arriba'); f.advance(100);
  f.text(''); f.advance(16);
  f.text('Déjame mostrarte. Abajo, arriba, abajo, arriba.'); f.advance(850);
  assert.equal(f.texts().join(' '), 'Déjame mostrarte. Abajo, arriba, abajo, arriba.');
});

test('a confirmed YouTube caption gap permits the same word again', () => {
  const f = setup();
  f.text('Sí'); f.advance(850);
  f.text(''); f.advance(250);
  f.text('Sí'); f.advance(850);
  assert.deepEqual(f.texts(), ['Sí', 'Sí']);
});

test('resetting YouTube cancels delivery and empty-gap timers', () => {
  const f = setup();
  f.text('Pendiente'); f.advance(100);
  f.text(''); f.KWSR.consoleRenderers.resetLiveState(); f.advance(1500);
  assert.deepEqual(f.texts(), []);
});

// Secuencia recibida de un tutorial de guitarra. El registro no incluye
// tiempos entre actualizaciones: los intervalos de este ensayo son simulados.
test('the complete guitar trace keeps its words once across rolling lines', () => {
  const f = setup();
  const samples = [
    'de nuevo. Entonces fue cuerda sola, arriba , abajo',
    'nuevo. Entonces fue cuerda sola, arriba , abajo, arriba',
    'nuevo. Entonces fue cuerda sola, arriba , abajo, arriba. Cuando',
    'nuevo. Entonces fue cuerda sola, arriba , abajo, arriba. Cuando rasguees',
    'nuevo. Entonces fue cuerda sola, arriba , abajo, arriba. Cuando rasguees hacia',
    'nuevo. Entonces fue cuerda sola, arriba , abajo, arriba. Cuando rasguees hacia abajo',
    'nuevo. Entonces fue cuerda sola, arriba , abajo, arriba. Cuando rasguees hacia abajo en',
    ', abajo, arriba. Cuando rasguees hacia abajo en ese',
    ', abajo, arriba. Cuando rasguees hacia abajo en ese acorde',
    'abajo en ese acorde de', 'abajo en ese acorde de La',
    'abajo en ese acorde de La menor', 'abajo en ese acorde de La menor, vas',
    'abajo en ese acorde de La menor, vas a',
    'abajo en ese acorde de La menor, vas a rasguear',
    'abajo en ese acorde de La menor, vas a rasguear más',
    'abajo en ese acorde de La menor, vas a rasguear más fuerte',
    'rasguear más fuerte que', 'rasguear más fuerte que cuando',
    'rasguear más fuerte que cuando rasgueaste',
    'rasguear más fuerte que cuando rasgueaste hacia', 'rasgueaste hacia arriba',
    'rasgueaste hacia arriba. Déjame', 'rasgueaste hacia arriba. Déjame mostrarte',
    'mostrarte. Abajo', 'mostrarte. Abajo, arriba', 'mostrarte. Abajo, arriba, abajo',
    'mostrarte. Abajo, arriba, abajo, arriba', 'mostrarte. Abajo, arriba, abajo, arriba . Nota',
    '. Nota, arriba', '. Nota, arriba, abajo', '. Nota, arriba, abajo, arriba'
  ];
  for (const sample of samples) { f.text(sample); f.advance(100); }
  f.advance(850);
  assert.equal(words(f.texts().join(' ')), 'de nuevo entonces fue cuerda sola arriba abajo arriba cuando rasguees hacia abajo en ese acorde de la menor vas a rasguear más fuerte que cuando rasgueaste hacia arriba déjame mostrarte abajo arriba abajo arriba nota arriba abajo arriba');
});
