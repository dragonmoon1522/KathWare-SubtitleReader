// Recuperación del sintetizador: probar eventos y tiempos, no simular habla real.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/tts.cjs');

function assertVoiceMode(f) {
  assert.equal(f.KWSR.state.modoNarradorGlobal, 'sintetizador');
  assert.ok(f.writes.every(value => !('modoNarrador' in value)));
  assert.equal(f.KWSR.state.liveRegion, null);
}

test('a phrase speaking for more than 4.5 or 5.5 seconds is not an engine failure', () => {
  const f = fixture(), u = f.say('Esta frase sigue en reproducción.');
  f.event(u, 'start'); f.advance(6500);
  assertVoiceMode(f);
  assert.equal(f.utterances.length, 1);
  assert.equal(f.synth.speaking, true);
});

test('a long phrase at a slow selected rate has time to complete', () => {
  const f = fixture({ settings: true });
  f.KWSR.ttsSettings.setRate(0.8, { announce: false });
  const u = f.say('Una frase extensa para leer con tranquilidad. '.repeat(15));
  f.event(u, 'start'); f.advance(30000);
  assertVoiceMode(f);
  assert.equal(f.synth.speaking, true);
  f.event(u, 'end'); f.advance(120000);
  assert.equal(f.utterances.length, 1);
  assert.equal(f.diagnosis().phase, 'idle');
});

test('a voice that starts after eight seconds retains its selected mode', () => {
  const f = fixture(), u = f.say('La voz está iniciando.');
  f.advance(8000); assertVoiceMode(f);
  assert.equal(f.utterances.length, 1);
  f.event(u, 'start'); f.event(u, 'end');
  f.advance(30000); assertVoiceMode(f);
});

test('a silent startup is retried once and then stops without switching to the reader', () => {
  const f = fixture(); f.say('Todavía no comenzó.');
  f.advance(10000);
  assert.equal(f.utterances.length, 1);
  f.advance(500);
  assert.equal(f.utterances.length, 2);
  f.advance(100000);
  assert.equal(f.utterances.length, 2);
  assert.equal(f.notices.length, 1);
  assertVoiceMode(f);
});

test('a transient startup error retries with the selected voice and rate', () => {
  const f = fixture({ settings: true });
  // Elegir una voz distinta de la que cargarVozES elegiría automáticamente.
  f.KWSR.ttsSettings.setVoice('default', { announce: false });
  f.KWSR.ttsSettings.setRate(1.25, { announce: false });
  const first = f.say('La misma voz después de recuperar.');
  f.event(first, 'error', { error: 'network' }); f.advance(500);
  const retry = f.utterances[1];
  assert.ok(retry); assert.equal(retry.text, first.text);
  assert.equal(retry.voice.voiceURI, 'default'); assert.equal(retry.rate, 1.25);
  f.event(retry, 'start'); f.event(retry, 'end');
  assertVoiceMode(f);
  assert.equal(f.KWSR.state.ttsVoiceURI, 'default');
});

test('a new subtitle supersedes the retry of an obsolete phrase', () => {
  const f = fixture(), first = f.say('Frase anterior.');
  f.event(first, 'error', { error: 'audio-busy' });
  f.say('Frase actual.'); f.advance(500);
  assert.deepEqual(f.utterances.map(u => u.text), ['Frase anterior.', 'Frase actual.']);
  assertVoiceMode(f);
});

test('synchronous cancellation of the previous phrase cannot fail the next one', () => {
  const f = fixture(), first = f.say('Primera frase.');
  f.event(first, 'start');
  const second = f.say('Segunda frase.'); f.event(second, 'start');
  f.advance(6000);
  assert.equal(f.synth.speaking, true);
  assert.equal(f.warnings.length, 0);
  assertVoiceMode(f);
});

test('late error and end events from an old phrase cannot cancel the current watchdog', () => {
  const f = fixture({ cancellation: 'async' }), first = f.say('Anterior.');
  f.say('Actual.');
  f.advance(50); f.event(first, 'end'); f.event(first, 'error', { error: 'synthesis-failed' });
  f.advance(10450);
  assert.equal(f.utterances.length, 3);
  assert.equal(f.utterances[2].text, 'Actual.');
  assertVoiceMode(f);
});

test('stopping cancels a pending retry and ignores late callbacks', () => {
  const f = fixture(), u = f.say('No reintentar después de detener.');
  f.event(u, 'error', { error: 'network' });
  f.KWSR.voice.detenerLectura();
  f.event(u, 'error', { error: 'synthesis-failed' }); f.advance(60000);
  assert.equal(f.utterances.length, 1);
  assert.equal(f.notices.length, 0);
  assertVoiceMode(f);
});

test('a retry cannot outlive its output mode, video, source or activation', () => {
  for (const change of [
    f => { f.KWSR.state.modoNarradorGlobal = 'lector'; },
    f => { f.KWSR.state.modoNarradorGlobal = 'off'; },
    f => { f.KWSR.state.extensionActiva = false; },
    f => { f.video.paused = true; },
    f => { f.KWSR.state.currentVideo = {}; },
    f => { f.video.currentSrc = 'blob:otro-video'; }
  ]) {
    const f = fixture(), u = f.say('Texto del contexto anterior.');
    f.event(u, 'error', { error: 'network' }); change(f); f.advance(60000);
    assert.equal(f.utterances.length, 1);
    assert.equal(f.KWSR.state.liveRegion, null);
  }
});

test('pause and seek invalidate a retry even if playback resumes before its timer', () => {
  for (const type of ['pause', 'seeking', 'emptied', 'ended']) {
    const f = fixture(), u = f.say('No volver después de cambiar la reproducción.');
    f.event(u, 'error', { error: 'network' });
    f.videoEvent(type); f.video.paused = false; f.advance(60000);
    assert.equal(f.utterances.length, 1);
    assertVoiceMode(f);
  }
});

test('non-retryable errors retain voice mode and allow the next subtitle to try again', () => {
  for (const error of ['not-allowed', 'voice-unavailable', 'language-unavailable', 'invalid-argument', 'text-too-long']) {
    const f = fixture(), u = f.say('Primer intento.');
    f.event(u, 'error', { error }); f.advance(1000);
    assert.equal(f.utterances.length, 1);
    assertVoiceMode(f);
    const next = f.say('Nueva frase después de corregir la voz.');
    assert.equal(f.utterances.length, 2);
    f.event(next, 'start'); f.event(next, 'end');
  }
});

test('an error after speaking has started does not replay a partly heard phrase', () => {
  const f = fixture(), u = f.say('Una parte ya se ha escuchado.');
  f.event(u, 'start'); f.event(u, 'error', { error: 'synthesis-failed' }); f.advance(500);
  assert.equal(f.utterances.length, 1);
  assertVoiceMode(f);
  f.say('Se puede leer la siguiente.');
  assert.equal(f.utterances.length, 2);
});

test('a missing synthesis API reports the problem without sending subtitles to NVDA', () => {
  const f = fixture(); delete f.context.speechSynthesis;
  f.say('Sin API de síntesis.'); f.advance(60000);
  assertVoiceMode(f);
  assert.equal(f.notices.length, 1);
  f.context.speechSynthesis = f.synth;
  f.say('La API volvió a estar disponible.');
  assert.equal(f.utterances.length, 1);
});

test('a thrown speak call gets one bounded retry', () => {
  const f = fixture();
  let calls = 0;
  f.synth.speak = () => { calls++; throw new Error('synthesis-failed'); };
  f.say('Fallo sin evento.'); f.advance(60000);
  assert.equal(calls, 2);
  assertVoiceMode(f);
});

test('a stalled phrase that already started is cleared without replay or mode change', () => {
  const f = fixture(), u = f.say('Se inició y después se trabó.');
  f.event(u, 'start'); f.advance(120000);
  assert.equal(f.utterances.length, 1);
  assert.equal(f.synth.speaking, false);
  assertVoiceMode(f);
  f.say('La siguiente puede continuar.');
  assert.equal(f.utterances.length, 2);
});

test('word-boundary progress extends the time allowed to a healthy slow voice', () => {
  const f = fixture(), u = f.say('Esta es una frase que avanza muy lentamente.');
  f.event(u, 'start'); f.advance(12000);
  f.event(u, 'boundary', { charIndex: 10 }); f.advance(12000);
  assert.equal(f.synth.speaking, true);
  assertVoiceMode(f);
});

test('completion leaves no watchdog that can fail a later idle period', () => {
  const f = fixture(), u = f.say('Frase completada.');
  f.event(u, 'start'); f.event(u, 'end');
  f.advance(60000); f.KWSR.voice.shouldReadNow();
  assert.equal(f.notices.length, 0);
  assert.equal(f.diagnosis().phase, 'idle');
  assertVoiceMode(f);
});

test('a paused synthesis engine is resumed before speaking', () => {
  const f = fixture(); f.synth.paused = true;
  f.say('Reanudar el motor.');
  assert.equal(f.synth.paused, false);
  assert.equal(f.synth.resumes, 1);
  assertVoiceMode(f);
});

test('fullscreen changes do not replace the selected voice mode or its recovery', () => {
  const f = fixture({ settings: true });
  f.KWSR.ttsSettings.setVoice('elena', { announce: false });
  const u = f.say('Voz en pantalla completa.');
  f.fullscreen(f.player);
  f.event(u, 'error', { error: 'network' }); f.advance(500);
  assert.equal(f.utterances.length, 2);
  assert.equal(f.utterances[1].voice.voiceURI, 'elena');
  assertVoiceMode(f);
});

test('a retired startup cannot deliver late start, end or error events into its retry', () => {
  const f = fixture(), first = f.say('El intento original quedó obsoleto.');
  f.advance(10500);
  const retry = f.utterances[1];
  f.event(first, 'start'); f.event(first, 'end');
  f.event(first, 'error', { error: 'synthesis-failed' });
  f.event(retry, 'start'); f.advance(6000);
  assert.equal(f.diagnosis().phase, 'speaking');
  assert.equal(f.diagnosis().attempt, 2);
  assertVoiceMode(f);
});

test('failure notices are limited while new subtitles remain eligible to try', () => {
  const f = fixture();
  for (let i = 0; i < 5; i++) {
    const u = f.say(`Frase número ${i}.`);
    f.event(u, 'error', { error: 'not-allowed' });
    f.advance(1000);
  }
  assert.equal(f.utterances.length, 5);
  assert.equal(f.notices.length, 1);
  assertVoiceMode(f);
});

test('a retry picks up a deliberate voice and speed change made while waiting', () => {
  const f = fixture({ settings: true });
  f.KWSR.ttsSettings.setVoice('default', { announce: false });
  const u = f.say('Una corrección de ajustes durante la espera.');
  f.event(u, 'error', { error: 'network' });
  f.KWSR.ttsSettings.setVoice('elena', { announce: false });
  f.KWSR.ttsSettings.setRate(2, { announce: false });
  f.advance(500);
  assert.equal(f.utterances[1].voice.voiceURI, 'elena');
  assert.equal(f.utterances[1].rate, 2);
  assertVoiceMode(f);
});

test('the old 4.5-second setting cannot truncate a healthy phrase', () => {
  const f = fixture(); f.KWSR.CFG.ttsWatchdogMs = 4500;
  const u = f.say('Lectura con una configuración previa.');
  f.event(u, 'start'); f.advance(6000);
  assert.equal(f.synth.speaking, true);
  assertVoiceMode(f);
});
