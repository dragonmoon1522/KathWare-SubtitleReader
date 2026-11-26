const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/tts.cjs');

test('voice volume defaults to 100 percent without changing voice or rate', () => {
  const f = fixture({ settings: true }), u = f.say('Volumen predeterminado.');
  assert.equal(u.volume, 1);
  assert.equal(u.rate, 1.75);
  assert.equal(f.KWSR.ttsSettings.getState().volume, 1);
});

test('the chosen volume is persisted and applied to the next subtitle only', () => {
  const f = fixture({ settings: true });
  f.video.volume = .6;
  f.KWSR.ttsSettings.setVoice('elena', { announce: false });
  f.KWSR.ttsSettings.setRate(2, { announce: false });
  f.KWSR.ttsSettings.setVolume(.35, { announce: false });
  const u = f.say('Voz, velocidad y volumen elegidos.');
  assert.equal(u.volume, .35); assert.equal(u.rate, 2);
  assert.equal(u.voice.voiceURI, 'elena'); assert.equal(f.video.volume, .6);
  assert.ok(f.writes.some(v => v.ttsVolume === .35));
});

test('a saved zero volume survives loading and does not reset to full volume', () => {
  const f = fixture({ settings: true, storedSettings: { ttsVolume: 0, ttsRate: 1.5, ttsVoiceURI: 'elena' } });
  const u = f.say('Volumen cero elegido por el usuario.');
  assert.equal(u.volume, 0); assert.equal(u.rate, 1.5);
  assert.equal(u.voice.voiceURI, 'elena');
});

test('volume limits and invalid preferences cannot produce an invalid utterance', () => {
  const f = fixture({ settings: true });
  assert.equal(f.KWSR.ttsSettings.setVolume(-1, { announce: false }), 0);
  assert.equal(f.KWSR.ttsSettings.setVolume(5, { announce: false }), 1);
  assert.equal(f.KWSR.ttsSettings.setVolume(NaN, { announce: false }), 1);
  assert.equal(f.KWSR.ttsSettings.setVolume('', { announce: false }), 1);
});

test('a retry uses the latest volume while preserving the chosen voice mode', () => {
  const f = fixture({ settings: true });
  f.KWSR.ttsSettings.setVolume(.8, { announce: false });
  const old = f.say('Reintento con el ajuste actual.');
  f.event(old, 'error', { error: 'network' });
  f.KWSR.ttsSettings.setVolume(.2, { announce: false });
  f.advance(500);
  assert.equal(f.utterances.length, 2);
  assert.equal(f.utterances[1].volume, .2);
  assert.equal(f.KWSR.state.modoNarradorGlobal, 'sintetizador');
});

test('voice volume does not affect screen-reader delivery or video volume', () => {
  const f = fixture({ settings: true });
  f.video.volume = .7;
  f.KWSR.state.modoNarradorGlobal = 'lector';
  f.KWSR.ttsSettings.setVolume(.1, { announce: false });
  f.say('La voz de NVDA se configura en NVDA.'); f.advance(10);
  assert.equal(f.utterances.length, 0);
  assert.equal(f.video.volume, .7);
  assert.equal(f.KWSR.state.liveRegion.textContent, 'La voz de NVDA se configura en NVDA.');
});

test('the labeled slider updates synthesis and keeps keyboard focus and one control', () => {
  const f = fixture({ settings: true, storedSettings: { ttsVolume: .35 } });
  const proto = Object.getPrototypeOf(f.node('div'));
  proto.append = function(...children) { for (const c of children) this.appendChild(c); };
  proto.addEventListener = function(name, fn) { (this.events ||= {})[name] = fn; };
  proto.querySelector = function(selector) {
    const id = selector.slice(1);
    for (const child of this.children) {
      if (child.id === id) return child;
      const found = child.querySelector(selector); if (found) return found;
    }
    return null;
  };
  f.document.querySelector = selector => f.document.documentElement.querySelector(selector);
  f.KWSR.state.overlayPanel = f.player.appendChild(f.node('div'));
  f.KWSR.ttsSettings.enhanceOverlay();
  const panel = f.KWSR.state.overlayPanel;
  const slider = panel.querySelector('#kwsr-tts-volume');
  assert.equal(slider.type, 'range');
  assert.equal(slider.getAttribute('aria-label'), 'Volumen del sintetizador');
  assert.equal(slider.value, '35'); assert.equal(slider.getAttribute('aria-valuetext'), '35%');
  const section = panel.querySelector('#kwsr-tts-settings');
  assert.ok(section.children.some(w => w.children.some(x => x.getAttribute('for') === slider.id)));
  slider.value = '65'; slider.events.input();
  assert.equal(f.say('Ajuste desde el panel.').volume, .65);
  assert.equal(slider.getAttribute('aria-valuetext'), '65%');
  assert.equal(f.document.activeElement, f.focus);
  f.KWSR.ttsSettings.enhanceOverlay();
  assert.equal(panel.children.length, 1);
});
