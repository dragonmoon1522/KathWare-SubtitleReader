// Casos del registro del 07/11/2026. Los tiempos entre actualizaciones se
// simulan: el archivo recibido tiene pendingMs, no un reloj de cada mutación.
// Se comprueba qué texto recibe la voz, no cuándo lo pronuncia NVDA.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/live-captions.cjs');

test('Flow keeps TENGO QUE SOPORTAR LA CARGA YO SOLO together across short stalls', () => {
  const f = fixture();
  f.text('DESQUITARME CON MI FAMILIA.'); f.advance(350);
  assert.deepEqual(f.texts(), ['DESQUITARME CON MI FAMILIA.']);
  const base = 'DESQUITARME CON MI FAMILIA. ';
  for (const tail of ['T', 'TEN', 'TENGO', 'TENGO QU', 'TENGO QUE', 'TENGO QUE SO', 'TENGO QUE SOPO', 'TENGO QUE SOPORTAR', 'TENGO QUE SOPORTAR LA']) {
    f.text(base + tail); f.advance(40);
  }
  f.advance(400);
  for (const tail of ['CA', 'CARG', 'CARGA', 'CARGA YO']) {
    f.text(base + 'TENGO QUE SOPORTAR LA ' + tail); f.advance(40);
  }
  f.advance(400);
  f.text('TENGO QUE SOPORTAR LA CARGA YO S'); f.advance(40);
  f.text('TENGO QUE SOPORTAR LA CARGA YO SOL'); f.advance(40);
  assert.deepEqual(f.texts(), ['DESQUITARME CON MI FAMILIA.']);
  f.text('TENGO QUE SOPORTAR LA CARGA YO SOLO.'); f.advance(350);
  assert.deepEqual(f.texts(), ['DESQUITARME CON MI FAMILIA.', 'TENGO QUE SOPORTAR LA CARGA YO SOLO.']);
});

test('a complete sentence is delivered without borrowing ODIO from the next one', () => {
  const f = fixture();
  f.text('YA NO PUEDO SEGUIR CON ESTA FARSA. OD'); f.advance(40);
  f.text('YA NO PUEDO SEGUIR CON ESTA FARSA. ODIO M'); f.advance(1100);
  assert.deepEqual(f.texts(), ['YA NO PUEDO SEGUIR CON ESTA FARSA.']);
  f.text('YA NO PUEDO SEGUIR CON ESTA FARSA. ODIO MI'); f.advance(40);
  f.text('CON ESTA FARSA. ODIO MI VI'); f.advance(40);
  f.text('CON ESTA FARSA. ODIO MI VIDA.'); f.advance(350);
  assert.deepEqual(f.texts(), ['YA NO PUEDO SEGUIR CON ESTA FARSA.', 'ODIO MI VIDA.']);
});

test('a lone M is not treated as a finished word during a stalled incremental update', () => {
  const f = fixture();
  f.text('M'); f.advance(1800);
  assert.deepEqual(f.texts(), []);
  f.text('MI'); f.advance(100);
  f.text('MI FAMILIA.'); f.advance(350);
  assert.deepEqual(f.texts(), ['MI FAMILIA.']);
});

test('continuous new words do not hold a finished sentence behind the following sentence', () => {
  const f = fixture();
  f.text('PRIMERA FRASE.');
  for (let i = 1; i <= 10; i++) {
    f.advance(50);
    f.text('PRIMERA FRASE. ' + 'PALABRA '.repeat(i).trim());
  }
  assert.equal(f.spoken[0].text, 'PRIMERA FRASE.');
  assert.ok(f.spoken[0].at <= 250);
  assert.equal(f.texts().length, 1);
});

test('briefly adjacent exclamations are batched instead of competing for the voice', () => {
  const f = fixture();
  f.text('MAMÁ!'); f.advance(40);
  f.text('MAMÁ! PA'); f.advance(40);
  f.text('MAMÁ! PAPÁ!'); f.advance(350);
  assert.deepEqual(f.texts(), ['MAMÁ! PAPÁ!']);
});

test('a speaker change finishes its preceding phrase even without a period', () => {
  const f = fixture();
  f.text('HOLA AMOR'); f.advance(40);
  f.text('HOLA AMOR >'); f.advance(40);
  assert.deepEqual(f.texts(), []);
  f.text('HOLA AMOR >> CÓ'); f.advance(350);
  assert.deepEqual(f.texts(), ['HOLA AMOR']);
  f.text('HOLA AMOR >> CÓMO TE VA?'); f.advance(350);
  assert.deepEqual(f.texts(), ['HOLA AMOR', 'CÓMO TE VA?']);
});

test('a marker added without new words still completes the preceding phrase', () => {
  const f = fixture(); f.text('HOLA AMOR'); f.advance(100);
  f.text('HOLA AMOR >>'); f.advance(350);
  assert.deepEqual(f.texts(), ['HOLA AMOR']);
});

test('sentence delivery survives repeated polls and is canceled by a brief DOM gap until restored', () => {
  const f = fixture(); f.text('Una frase.'); f.advance(30);
  f.text(''); f.advance(16); f.text('Una frase.');
  for (let i = 0; i < 10; i++) { f.text('Una frase.'); f.advance(50); }
  assert.deepEqual(f.texts(), ['Una frase.']);
});

test('an unrelated new cue or a confirmed disappearance releases unpunctuated pending text', () => {
  const f = fixture(); f.text('Primera frase'); f.advance(100);
  f.text('Otra frase'); f.advance(100);
  assert.deepEqual(f.texts(), ['Primera frase']);
  f.text(''); f.advance(250);
  assert.deepEqual(f.texts(), ['Primera frase', 'Otra frase']);
});

test('a completed sentence timer cannot deliver after shutdown or a source switch', () => {
  for (const stop of [
    f => f.KWSR.consoleRenderers.resetLiveState(),
    f => { f.KWSR.state.extensionActiva = false; },
    f => { f.KWSR.state.effectiveFuente = 'track'; },
    f => { f.KWSR.voice.shouldReadNow = () => false; }
  ]) {
    const f = fixture(); f.text('Una frase.'); stop(f); f.advance(5000);
    assert.deepEqual(f.texts(), []);
  }
});

// Segundo registro: las pausas breves no separan «IR» de «AHORA» ni
// «HAY QUE SACAR LA» de «BASURA». No hay marcas manuales en ese archivo.
test('the second Flow trace keeps the complete chore sentences separate from their successors', () => {
  const f = fixture();
  const intro = 'HOMERO, QUÉ TIERNO ERES.';
  for (const suffix of ['PERO YO NO PUED', 'PERO YO NO PUEDO', 'PERO YO NO PUEDO IR']) {
    f.text(intro + ' ' + suffix); f.advance(50);
  }
  f.advance(400);
  assert.deepEqual(f.texts(), [intro]);
  for (const suffix of ['AH', 'AHOR', 'AHORA.']) {
    f.text('PERO YO NO PUEDO IR ' + suffix); f.advance(50);
  }
  f.advance(350);
  assert.deepEqual(f.texts(), [intro, 'PERO YO NO PUEDO IR AHORA.']);
  const previous = 'HAY MUCHOS PLATOS QUE LAVAR.';
  f.text(previous); f.advance(350);
  for (const suffix of ['HA', 'HAY', 'HAY Q', 'HAY QUE', 'HAY QUE SA', 'HAY QUE SACAR', 'HAY QUE SACAR LA']) {
    f.text(previous + ' ' + suffix); f.advance(50);
  }
  f.advance(400);
  for (const suffix of ['BASU', 'BASURA', 'BASURA. LA']) {
    f.text(previous + ' HAY QUE SACAR LA ' + suffix); f.advance(50);
  }
  f.advance(350);
  assert.deepEqual(f.texts(), [intro, 'PERO YO NO PUEDO IR AHORA.', previous, 'HAY QUE SACAR LA BASURA.']);
  for (const suffix of ['SALA', 'SALA ESTÁ', 'SALA ESTÁ HECHO', 'SALA ESTÁ HECHO UN ASCO.']) {
    f.text('QUE SACAR LA BASURA. LA ' + suffix); f.advance(50);
  }
  f.advance(350);
  assert.deepEqual(f.texts(), [intro, 'PERO YO NO PUEDO IR AHORA.', previous, 'HAY QUE SACAR LA BASURA.', 'LA SALA ESTÁ HECHO UN ASCO.']);
});

test('holding a single-letter tail does not lose a cue consisting of a letter', () => {
  const f = fixture(); f.text('A'); f.advance(1800);
  assert.deepEqual(f.texts(), []);
  f.text(''); f.advance(250);
  assert.deepEqual(f.texts(), ['A']);
});
