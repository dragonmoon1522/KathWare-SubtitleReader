// Medición con audio marcado, DOM independiente y reloj simulado.
// La prueba no observa ni puede medir cuándo NVDA pronuncia una live region.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../Extension/content/adapters/kwsr.flowTiming.js'), 'utf8');
const voiceSource = fs.readFileSync(path.join(__dirname, '../Extension/content/core/kwsr.voice.js'), 'utf8');
const betaSource = fs.readFileSync(path.join(__dirname, '../Extension/content/adapters/kwsr.betaTools.js'), 'utf8');

function fixture() {
  let now = 0, raw = '', platform = 'flow', id = 0;
  const timers = new Map(), observers = [], events = new Map();
  const video = {
    currentTime: 100, playbackRate: 1, paused: false, ended: false, currentSrc: 'blob:flow',
    pause() { this.paused = true; for (const fn of [...(events.get('pause') || [])]) fn(); },
    play() { this.paused = false; return Promise.resolve(); },
    addEventListener(event, fn) { if (!events.has(event)) events.set(event, new Set()); events.get(event).add(fn); },
    removeEventListener(event, fn) { events.get(event)?.delete(fn); }
  };
  const KWSR = {
    state: { extensionActiva: true, currentVideo: video, effectiveFuente: 'visual', modoNarradorGlobal: 'lector', liveRegion: { textContent: '' } }, CFG: {},
    platforms: { getPlatform: () => platform }, consoleRenderers: { getRendererText: () => ({ text: raw }) }
  };
  const context = {
    window: { KWSR }, performance: { now: () => now }, Date: { now: () => 1793476800000 + now },
    document: { documentElement: {} },
    MutationObserver: class {
      constructor(fn) { this.fn = fn; this.active = false; observers.push(this); }
      observe() { this.active = true; }
      disconnect() { this.active = false; }
    },
    setTimeout(fn, delay) { timers.set(++id, { at: now + delay, fn }); return id; },
    clearTimeout(key) { timers.delete(key); }
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return {
    KWSR, video, context,
    source(value) { raw = value; for (const observer of [...observers]) if (observer.active) observer.fn([]); },
    platform(value) { platform = value; },
    event(name) { for (const fn of [...(events.get(name) || [])]) fn(); },
    report() { return KWSR.flowTiming.getReport(); },
    activeObservers() { return observers.filter(o => o.active).length; },
    advance(ms) {
      const end = now + ms;
      const tick = next => { if (!video.paused) video.currentTime += (next - now) / 1000 * video.playbackRate; now = next; };
      while (true) {
        const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        timers.delete(next[0]); tick(next[1].at); next[1].fn();
      }
      tick(end);
    }
  };
}

test('the probe is inactive until the person marks the original audio', () => {
  const f = fixture(); f.source('Texto'); f.advance(10000);
  assert.equal(f.report().phase, 'idle');
  assert.equal(f.activeObservers(), 0);
});

test('a 10-second source delay is distinguished from 350 ms of adapter delivery', () => {
  const f = fixture();
  f.KWSR.flowTiming.markAudio(); f.KWSR.flowTiming.setWord('Danielsan');
  f.advance(10000); f.source('>> DANIELSAN.');
  f.advance(350); f.KWSR.flowTiming.noteOutput('adapter', 'DANIELSAN.');
  f.advance(10); f.KWSR.flowTiming.noteOutput('live-region', 'DANIELSAN.');
  const r = f.report();
  assert.equal(r.phase, 'matched');
  assert.equal(r.caption.observedAfterAudioMarkMs, 10000);
  assert.equal(r.caption.videoSecondsAfterAudioMark, 10);
  assert.equal(r.output.adapter.afterCaptionMs, 350);
  assert.equal(r.output['live-region'].afterCaptionMs, 360);
  assert.equal(r.output['tts-start'], null);
  assert.equal(r.nvdaSpeechStartMeasured, false);
});

test('an early caption and a delayed browser voice are reported separately', () => {
  const f = fixture(); f.KWSR.flowTiming.markAudio(); f.KWSR.flowTiming.setWord('humor');
  f.advance(50); f.source('CUÁNTO HUMOR.');
  f.advance(350); f.KWSR.flowTiming.noteOutput('adapter', 'HUMOR.');
  f.advance(10000); f.KWSR.flowTiming.noteOutput('tts-start', 'HUMOR.');
  const r = f.report();
  assert.equal(r.caption.observedAfterAudioMarkMs, 50);
  assert.equal(r.output['tts-start'].afterCaptionMs, 10350);
});

test('typing the word later does not move the audio reference or the first caption observation', () => {
  const f = fixture(); f.KWSR.flowTiming.markAudio();
  f.advance(2000); f.source('LIJA JAPONESA.');
  f.advance(350); f.KWSR.flowTiming.noteOutput('adapter', 'JAPONESA.');
  f.advance(4000); f.KWSR.flowTiming.setWord('japonesa');
  assert.equal(f.report().caption.observedAfterAudioMarkMs, 2000);
  assert.equal(f.report().output.adapter.afterCaptionMs, 350);
});

test('a word already visible at the mark has an unknown onset, never an invented zero delay', () => {
  const f = fixture(); f.source('CUÁNTO HUMOR.');
  f.KWSR.flowTiming.markAudio(); f.KWSR.flowTiming.setWord('HUMOR');
  assert.equal(f.report().phase, 'already-visible');
  assert.equal(f.report().caption, null);
});

test('an already visible word can still have its later output measured from the audio mark', () => {
  const f = fixture(); f.source('HUMOR.');
  f.KWSR.flowTiming.markAudio(); f.KWSR.flowTiming.setWord('humor');
  f.advance(10000); f.KWSR.flowTiming.noteOutput('tts-start', 'HUMOR.');
  assert.equal(f.report().phase, 'already-visible');
  assert.equal(f.report().output['tts-start'].afterAudioMarkMs, 10000);
  assert.equal(f.report().output['tts-start'].afterCaptionMs, null);
});

test('partial words do not match; punctuation, accents and letter case do', () => {
  const f = fixture(); f.KWSR.flowTiming.markAudio(); f.KWSR.flowTiming.setWord('Qué');
  f.advance(100); f.source('>> QUEBRADO'); assert.equal(f.report().phase, 'waiting');
  f.advance(100); f.source('>> QU'); assert.equal(f.report().phase, 'waiting');
  f.advance(100); f.source('>> QUÉ?');
  assert.equal(f.report().caption.observedAfterAudioMarkMs, 300);
});

test('pausing, seeking and changing playback rate invalidate the comparison', () => {
  for (const event of ['pause', 'seeking', 'ratechange', 'emptied']) {
    const f = fixture(); f.KWSR.flowTiming.markAudio(); f.KWSR.flowTiming.setWord('palabra');
    f.event(event); f.advance(10000); f.source('palabra');
    assert.equal(f.report().phase, 'invalid');
    assert.equal(f.report().caption, null);
    assert.equal(f.activeObservers(), 0);
  }
});

test('changing video, source, platform or activation invalidates the trial', () => {
  for (const change of [
    f => { f.KWSR.state.currentVideo = { ...f.video }; },
    f => { f.video.currentSrc = 'blob:other'; },
    f => f.platform('youtube'),
    f => { f.KWSR.state.extensionActiva = false; }
  ]) {
    const f = fixture(); f.KWSR.flowTiming.markAudio(); f.KWSR.flowTiming.setWord('palabra');
    change(f); f.source('palabra');
    assert.equal(f.report().phase, 'invalid');
    assert.equal(f.activeObservers(), 0);
  }
});

test('the trial ends after 30 seconds and keeps a report without further observers', () => {
  const f = fixture(); f.KWSR.flowTiming.markAudio(); f.KWSR.flowTiming.setWord('ausente');
  f.advance(30000);
  assert.equal(f.report().phase, 'not-found');
  assert.equal(f.report().running, false);
  assert.equal(f.activeObservers(), 0);
  f.source('ausente'); assert.equal(f.report().phase, 'not-found');
});

test('a new mark replaces the previous observer and reference', () => {
  const f = fixture(); f.KWSR.flowTiming.markAudio();
  f.advance(5000); f.KWSR.flowTiming.markAudio(); f.KWSR.flowTiming.setWord('nueva');
  assert.equal(f.activeObservers(), 1);
  f.advance(1000); f.source('nueva');
  assert.equal(f.report().caption.observedAfterAudioMarkMs, 1000);
});

test('a failed UI listener cannot interrupt measurement', () => {
  const f = fixture(); f.KWSR.flowTiming.setListener(() => { throw new Error('UI'); });
  f.KWSR.flowTiming.markAudio(); f.KWSR.flowTiming.setWord('palabra'); f.source('palabra');
  assert.equal(f.report().phase, 'matched');
});

test('the live-region timestamp is captured on its real update, not when queued', () => {
  const f = fixture(), stages = [];
  f.KWSR.flowTiming.noteOutput = (stage, text) => stages.push([stage, text]);
  vm.runInContext(voiceSource, f.context);
  f.KWSR.voice.leerTextoAccesible('Medición');
  assert.equal(stages.length, 0);
  f.advance(9); assert.equal(stages.length, 0);
  f.advance(1); assert.equal(stages[0][0], 'live-region');
  assert.equal(f.KWSR.state.liveRegion.textContent, 'Medición');
});

test('the TTS timestamp is captured on start, not when speak is called', () => {
  const f = fixture(), stages = [];
  let utterance;
  f.context.speechSynthesis = { getVoices: () => [], cancel() {}, speak(u) { utterance = u; } };
  f.context.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  f.KWSR.state.modoNarradorGlobal = 'sintetizador';
  f.KWSR.flowTiming.noteOutput = (stage, text) => stages.push([stage, text]);
  vm.runInContext(voiceSource, f.context);
  f.KWSR.voice.leerTextoAccesible('Medición');
  assert.equal(stages.length, 0);
  f.advance(120); utterance.onstart();
  assert.equal(stages[0][0], 'tts-start');
});

test('a failed diagnostic hook cannot stop the live-region update', () => {
  const f = fixture();
  f.KWSR.flowTiming.noteOutput = () => { throw new Error('diagnostic'); };
  vm.runInContext(voiceSource, f.context);
  f.KWSR.voice.leerTextoAccesible('Lectura'); f.advance(10);
  assert.equal(f.KWSR.state.liveRegion.textContent, 'Lectura');
});

test('the adapter reports delivery before the voice call and survives a failed probe', () => {
  const f = require('./helpers/live-captions.cjs').fixture();
  let stage;
  f.KWSR.flowTiming = { noteOutput(name, text) {
    stage = [name, text, f.spoken.length];
    throw new Error('diagnostic');
  } };
  f.text('Hola'); f.advance(350);
  assert.deepEqual(stage, ['adapter', 'Hola', 0]);
  assert.deepEqual(f.texts(), ['Hola']);
});

test('evicted history never invents a first appearance for a word submitted too late', () => {
  const f = fixture(); f.KWSR.flowTiming.markAudio();
  for (let i = 0; i < 1100; i++) f.source(`palabra ${i}`);
  f.KWSR.flowTiming.setWord('palabra');
  assert.equal(f.report().phase, 'history-incomplete');
  assert.equal(f.report().caption, null);
  assert.ok(f.report().samples <= 1000);
});

test('an already measured appearance survives bounded history eviction', () => {
  const f = fixture(); f.KWSR.flowTiming.markAudio(); f.KWSR.flowTiming.setWord('única');
  f.advance(50); f.source('única');
  for (let i = 0; i < 1100; i++) f.source(`otro ${i}`);
  assert.equal(f.report().phase, 'matched');
  assert.equal(f.report().caption.observedAfterAudioMarkMs, 50);
});

function installUI(f) {
  const nodes = new Map(), handlers = new Map();
  const doc = f.context.document;
  class Node {
    constructor() { this.style = {}; this.dataset = {}; this.children = []; this.attrs = {}; this.handlers = new Map(); this.textContent = ''; }
    set id(value) { this._id = value; nodes.set(value, this); }
    get id() { return this._id; }
    setAttribute(name, value) { this.attrs[name] = value; }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.append(child); return child; }
    addEventListener(event, fn) { this.handlers.set(event, fn); }
    querySelector(selector) { return selector.startsWith('#') ? nodes.get(selector.slice(1)) : null; }
    querySelectorAll() { return []; }
    focus() { doc.activeElement = this; }
  }
  doc.createElement = () => new Node();
  doc.querySelector = selector => nodes.get(selector.slice(1));
  doc.addEventListener = (event, fn) => handlers.set(event, fn);
  f.KWSR.state.overlayPanel = new Node();
  f.KWSR.overlay = { ensureOverlay() {}, updateOverlayStatus() {}, setPanelOpen() {} };
  f.context.console = { log() {} };
  vm.runInContext(betaSource, f.context);
  f.KWSR.overlay.ensureOverlay();
  return { nodes, handlers, doc };
}

test('Alt+Shift+M captures and pauses before focusing a read-only result', () => {
  const f = fixture(), ui = installUI(f);
  f.source('>> EL TEXTO DE FLOW.');
  let prevented = false;
  ui.handlers.get('keydown')({ key: 'm', altKey: true, shiftKey: true, ctrlKey: false, metaKey: false,
    preventDefault() { prevented = true; }, stopImmediatePropagation() {} });
  const input = ui.nodes.get('kwsr-flow-timing-snapshot');
  assert.equal(prevented, true);
  assert.equal(ui.doc.activeElement, input);
  assert.equal(f.report().phase, 'snapshot');
  assert.equal(f.video.paused, true);
  assert.equal(input.readOnly, true);
  assert.equal(input.value, 'EL TEXTO DE FLOW.');
  assert.equal(f.report().sourceText, '>> EL TEXTO DE FLOW.');
  const status = ui.nodes.get('kwsr-flow-timing-status');
  assert.equal(status.attrs.role, 'status');
  assert.match(status.textContent, /video pausado/);
});

test('the measurement shortcut and fields are scoped to Flow', () => {
  const f = fixture(); f.platform('youtube'); const ui = installUI(f);
  assert.equal(ui.nodes.has('kwsr-flow-timing-snapshot'), false);
  let prevented = false;
  ui.handlers.get('keydown')({ key: 'm', altKey: true, shiftKey: true, ctrlKey: false, metaKey: false,
    preventDefault() { prevented = true; }, stopImmediatePropagation() {} });
  assert.equal(prevented, false);
  assert.equal(f.report().phase, 'idle');
});

test('the snapshot reads captions and last delivery before pause or stop can clear them', () => {
  const f = fixture(); f.source('Texto antes de pausar');
  f.KWSR.state.lastEmitText = 'Última lectura';
  f.KWSR.state.lastEmitAt = f.context.Date.now() - 450;
  f.KWSR.voice = { detenerLectura() { f.KWSR.state.lastEmitText = ''; } };
  f.video.pause = () => { f.source(''); f.video.paused = true; };
  const r = f.KWSR.flowTiming.captureSnapshot();
  assert.equal(r.sourceText, 'Texto antes de pausar');
  assert.equal(r.lastDeliveredText, 'Última lectura');
  assert.equal(r.lastDeliveredAgoMs, 450);
  assert.equal(r.audioOffsetMeasured, false);
});

test('a snapshot replaces the running probe and stays fixed after later DOM changes', () => {
  const f = fixture(); f.KWSR.flowTiming.markAudio(); f.KWSR.flowTiming.setWord('palabra');
  f.source('Captura fija'); f.KWSR.flowTiming.captureSnapshot();
  assert.equal(f.activeObservers(), 0);
  f.source('Otro texto'); f.advance(40000);
  assert.equal(f.report().phase, 'snapshot');
  assert.equal(f.report().sourceText, 'Captura fija');
  assert.equal(f.report().videoTime, 100);
});

test('a failed pause is reported without losing the captured text', () => {
  const f = fixture(); f.source('Texto');
  f.video.pause = () => { throw new Error('pause'); };
  const r = f.KWSR.flowTiming.captureSnapshot();
  assert.equal(r.sourceText, 'Texto');
  assert.equal(r.pauseSucceeded, false);
});

test('snapshot capture cannot pause another platform', () => {
  const f = fixture(); f.platform('youtube');
  const r = f.KWSR.flowTiming.captureSnapshot();
  assert.equal(r.phase, 'invalid');
  assert.equal(f.video.paused, false);
});
