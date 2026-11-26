// Reloj y eventos de Web Speech simulados; no acreditan el audio real de una voz.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { fixture: liveFixture } = require('./live-region.cjs');

function fixture({ cancellation = 'sync', settings = false, storedSettings = null } = {}) {
  const f = liveFixture(), utterances = [], notices = [], writes = [], warnings = [];
  const listeners = new Map(), started = new Set();
  let current = null;
  f.KWSR.state.modoNarradorGlobal = 'sintetizador';
  f.KWSR.toast = { notify: text => notices.push(text) };
  f.KWSR.warn = (...args) => warnings.push(args);
  f.KWSR.api = { storage: { local: { set: value => writes.push(value) } } };
  if (storedSettings) f.KWSR.api.storage.local.get = (keys, cb) => cb(storedSettings);
  f.document.querySelector = () => null;
  f.video.addEventListener = (name, fn) => {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(fn);
  };
  f.video.removeEventListener = (name, fn) => listeners.get(name)?.delete(fn);
  const voices = [
    { voiceURI: 'default', name: 'Predeterminada', lang: 'es-ES' },
    { voiceURI: 'elena', name: 'Elena', lang: 'es-AR' }
  ];
  const synth = f.context.speechSynthesis = {
    speaking: false, paused: false, pending: false, cancels: 0, resumes: 0,
    getVoices: () => voices,
    speak(u) { utterances.push(u); current = u; this.pending = true; },
    cancel() {
      this.cancels++; this.speaking = false; this.pending = false;
      const old = current; current = null;
      if (!old || cancellation === 'none') return;
      const report = () => old.onerror?.({ error: started.has(old) ? 'interrupted' : 'canceled' });
      if (cancellation === 'async') f.context.setTimeout(report, 50);
      else report();
    },
    resume() { this.paused = false; this.resumes++; }
  };
  f.context.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  if (settings) {
    const source = fs.readFileSync(path.join(__dirname, '../../Extension/content/adapters/kwsr.ttsSettings.js'), 'utf8');
    vm.runInContext(source, f.context);
  }
  return Object.assign(f, {
    synth, voices, utterances, notices, writes, warnings,
    say(text) { f.KWSR.voice.leerTextoAccesible(text); return utterances.at(-1); },
    event(u, type, data = {}) {
      if (type === 'start') started.add(u);
      if (u === current) {
        if (type === 'start') { synth.speaking = true; synth.pending = false; }
        if (type === 'end' || type === 'error') { synth.speaking = false; synth.pending = false; }
      }
      u?.[`on${type}`]?.(data);
    },
    videoEvent(type) { for (const fn of [...(listeners.get(type) || [])]) fn(); },
    diagnosis() { return f.KWSR.voice.getTTSState(); }
  });
}
module.exports = { fixture };
