const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/tts.cjs');

test('automatic voice follows the browser default even when Spanish voices are listed first', () => {
  const f = fixture({ settings: true });
  f.voices.push({ voiceURI: 'english', name: 'English default', lang: 'en-US', default: true });
  const u = f.say('The user chooses the language.');
  assert.equal(u.voice.voiceURI, 'english');
  assert.equal(u.lang, 'en-US');
  assert.equal(f.KWSR.ttsSettings.getSelectedVoice().voiceURI, 'english');
});

test('an explicit voice overrides the browser default without language filtering', () => {
  const f = fixture({ settings: true });
  f.voices[0].default = true;
  f.voices.push({ voiceURI: 'french', name: 'Français', lang: 'fr-FR' });
  f.KWSR.ttsSettings.setVoice('french', { announce: false });
  const u = f.say('Une voix choisie.');
  assert.equal(u.voice.voiceURI, 'french'); assert.equal(u.lang, 'fr-FR');
});

test('returning to automatic clears the explicit preference and follows the current default', () => {
  const f = fixture({ settings: true });
  f.voices.push({ voiceURI: 'english', name: 'English default', lang: 'en-GB', default: true });
  f.KWSR.ttsSettings.setVoice('elena', { announce: false });
  f.KWSR.ttsSettings.setVoice('', { announce: false });
  assert.equal(f.say('Browser default.').voice.voiceURI, 'english');
  assert.equal(f.KWSR.state.ttsVoiceURI, '');
});

test('without a browser default, the engine chooses instead of forcing Spanish', () => {
  const f = fixture({ settings: true }), u = f.say('Let the engine decide.');
  assert.equal(u.voice, undefined); assert.equal(u.lang, undefined);
});

test('voice-list updates preserve an explicit selection', () => {
  const f = fixture({ settings: true });
  f.voices[0].default = true;
  f.KWSR.ttsSettings.setVoice('elena', { announce: false });
  f.KWSR.voice.cargarVoz(); f.synth.onvoiceschanged();
  assert.equal(f.KWSR.state.voiceES.voiceURI, 'elena');
});

test('a saved unavailable voice is retained without replacing it with a Spanish voice or reader mode', () => {
  const f = fixture({ settings: true });
  f.KWSR.state.ttsVoiceURI = 'missing'; f.KWSR.state.ttsVoiceName = 'Unavailable';
  f.say('Do not replace the selection.');
  assert.equal(f.utterances.length, 0);
  assert.equal(f.KWSR.state.ttsVoiceURI, 'missing');
  assert.equal(f.KWSR.state.modoNarradorGlobal, 'sintetizador');
  assert.equal(f.KWSR.voice.getTTSState().lastError, 'voice-unavailable');
});
