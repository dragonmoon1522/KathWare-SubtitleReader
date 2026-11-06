// Medición con dos marcas manuales, DOM independiente y reloj simulado.
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
  const timers = new Map(), observers = [], events = new Map(), logs = [];
  const video = {
    currentTime: 100, playbackRate: 1, paused: false, ended: false, currentSrc: 'blob:flow',
    pause() { this.paused = true; for (const fn of [...(events.get('pause') || [])]) fn({ type: 'pause' }); },
    play() { this.paused = false; return Promise.resolve(); },
    addEventListener(event, fn) { if (!events.has(event)) events.set(event, new Set()); events.get(event).add(fn); },
    removeEventListener(event, fn) { events.get(event)?.delete(fn); }
  };
  const KWSR = {
    state: { extensionActiva: true, currentVideo: video, effectiveFuente: 'visual', modoNarradorGlobal: 'lector', liveRegion: { textContent: '' } }, CFG: {},
    platforms: { getPlatform: () => platform }, consoleRenderers: { getRendererText: () => ({ text: raw, selector: '.theoplayer-texttracks span' }) }
  };
  const context = {
    window: { KWSR }, performance: { now: () => now }, Date: { now: () => 1793476800000 + now },
    document: { documentElement: {} },
    console: { log: line => logs.push(line) },
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
    KWSR, video, context, logs,
    source(value, observed = true) {
      raw = value;
      if (observed) for (const observer of [...observers]) if (observer.active) observer.fn([]);
    },
    platform(value) { platform = value; },
    event(name) { for (const fn of [...(events.get(name) || [])]) fn({ type: name }); },
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

test('the probe is inactive before M and N alone does not invent a delay', () => {
  const f = fixture(); f.source('Texto'); f.advance(10000);
  assert.equal(f.report().phase, 'idle');
  assert.equal(f.activeObservers(), 0);
  assert.equal(f.KWSR.flowTiming.markSubtitle().reason, 'audio-mark-required');
  assert.equal(f.report().manualDelayMs, undefined);
});

test('a 10-second source delay is distinguishable from delivery and user reaction time', () => {
  const f = fixture(); f.source('Texto anterior');
  f.KWSR.flowTiming.markAudio();
  f.advance(10000); f.source('>> DANIELSAN.');
  f.advance(350); f.KWSR.flowTiming.noteOutput('adapter', 'DANIELSAN.');
  f.advance(10); f.KWSR.flowTiming.noteOutput('live-region', 'DANIELSAN.');
  f.advance(200);
  const r = f.KWSR.flowTiming.markSubtitle();
  assert.equal(r.phase, 'measured');
  assert.equal(r.manualDelayMs, 10560);
  assert.equal(r.videoElapsedMs, 10560);
  assert.equal(r.audioMark.caption.text, 'Texto anterior');
  assert.equal(r.subtitleMark.caption.text, '>> DANIELSAN.');
  assert.deepEqual(Array.from(r.timeline, e => [e.stage, e.afterAudioMarkMs]), [
    ['caption', 10000], ['adapter', 10350], ['live-region', 10360]
  ]);
  assert.equal(r.nvdaSpeechStartMeasured, false);
});

test('a late TTS start is separable from an early caption and the video uses its own clock', () => {
  const f = fixture(); f.video.playbackRate = 1.5;
  f.KWSR.state.modoNarradorGlobal = 'sintetizador';
  f.KWSR.flowTiming.markAudio();
  f.advance(50); f.source('CUÁNTO HUMOR.');
  f.advance(350); f.KWSR.flowTiming.noteOutput('adapter', 'HUMOR.');
  f.advance(10000); f.KWSR.flowTiming.noteOutput('tts-start', 'HUMOR.');
  const r = f.KWSR.flowTiming.markSubtitle();
  assert.equal(r.manualDelayMs, 10400);
  assert.equal(r.videoElapsedMs, 15600);
  assert.equal(r.playbackRate, 1.5);
  assert.equal(r.subtitleMark.readingMode, 'sintetizador');
  assert.deepEqual(Array.from(r.timeline, e => [e.stage, e.afterAudioMarkMs]), [
    ['caption', 50], ['adapter', 400], ['tts-start', 10400]
  ]);
});

test('both marks read Flow immediately and do not mistake existing text for a new cue', () => {
  const f = fixture(); f.source('Ya visible.');
  f.KWSR.flowTiming.markAudio();
  f.source('Ya visible.');
  f.advance(500); f.source('Nuevo texto.', false);
  const r = f.KWSR.flowTiming.markSubtitle();
  assert.equal(r.audioMark.caption.text, 'Ya visible.');
  assert.equal(r.subtitleMark.caption.text, 'Nuevo texto.');
  assert.equal(r.subtitleMark.caption.selector, '.theoplayer-texttracks span');
  assert.equal(r.timeline.length, 0);
});

test('pausing, seeking, ending and changing playback rate invalidate the comparison', () => {
  for (const event of ['pause', 'seeking', 'ratechange', 'emptied', 'ended']) {
    const f = fixture(); f.KWSR.flowTiming.markAudio();
    f.event(event); f.advance(10000); f.source('palabra');
    assert.equal(f.KWSR.flowTiming.markSubtitle().phase, 'invalid');
    assert.equal(f.report().reason, event);
    assert.equal(f.report().manualDelayMs, undefined);
    assert.equal(f.activeObservers(), 0);
  }
});

test('N refuses to pair with a replaced video or changed source, platform or activation', () => {
  for (const change of [
    f => { f.KWSR.state.currentVideo = { ...f.video }; },
    f => { f.video.currentSrc = 'blob:other'; },
    f => f.platform('youtube'),
    f => { f.KWSR.state.extensionActiva = false; }
  ]) {
    const f = fixture(); f.KWSR.flowTiming.markAudio(); f.advance(10000);
    change(f);
    assert.equal(f.KWSR.flowTiming.markSubtitle().reason, 'source-changed');
    assert.equal(f.activeObservers(), 0);
  }
});

test('a trial expires after 30 seconds, with no second mark or observer', () => {
  const f = fixture(); f.KWSR.flowTiming.markAudio();
  f.advance(30000);
  assert.equal(f.KWSR.flowTiming.markSubtitle().phase, 'expired');
  assert.equal(f.report().manualDelayMs, undefined);
  assert.equal(f.activeObservers(), 0);
});

test('a new audio mark replaces the previous observer, timer and reference', () => {
  const f = fixture(); f.KWSR.flowTiming.markAudio();
  f.advance(29000); f.KWSR.flowTiming.markAudio();
  assert.equal(f.activeObservers(), 1);
  f.advance(3000);
  assert.equal(f.KWSR.flowTiming.markSubtitle().manualDelayMs, 3000);
  assert.equal(f.activeObservers(), 0);
});

test('the report remains fixed after further changes and an extra N', () => {
  const f = fixture(); f.KWSR.flowTiming.markAudio();
  f.advance(1000); f.source('Subtítulo.');
  const result = f.KWSR.flowTiming.markSubtitle();
  f.advance(30000); f.source('Otro.'); f.KWSR.flowTiming.noteOutput('adapter', 'Otro.');
  assert.equal(f.KWSR.flowTiming.markSubtitle(), result);
  assert.equal(result.subtitleMark.caption.text, 'Subtítulo.');
  assert.equal(f.logs.length, 1);
});

test('a failed UI listener cannot interrupt the paired measurement', () => {
  const f = fixture(); f.KWSR.flowTiming.setListener(() => { throw new Error('UI'); });
  f.KWSR.flowTiming.markAudio(); f.source('palabra');
  assert.equal(f.KWSR.flowTiming.markSubtitle().phase, 'measured');
  assert.equal(f.logs.length, 1);
});

test('bounded history discloses omitted events and keeps the manual reference', () => {
  const f = fixture(); f.KWSR.flowTiming.markAudio();
  for (let i = 0; i < 500; i++) f.source('palabra ' + i);
  f.advance(2000);
  const result = f.KWSR.flowTiming.markSubtitle();
  assert.ok(result.timeline.length < 500);
  assert.equal(result.omittedEvents + result.timeline.length, 500);
  assert.equal(result.timeline.at(-1).text, 'palabra 499');
  assert.equal(result.manualDelayMs, 2000);
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

function installUI(f, withPanel = true) {
  const nodes = new Map(), handlers = new Map(), panelOpens = [];
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
  if (withPanel) f.KWSR.state.overlayPanel = new Node();
  f.KWSR.overlay = { ensureOverlay() {}, updateOverlayStatus() {}, setPanelOpen(open) { panelOpens.push(open); } };
  vm.runInContext(betaSource, f.context);
  if (withPanel) f.KWSR.overlay.ensureOverlay();
  return { nodes, handlers, doc, panelOpens };
}

function press(ui, key, props = {}) {
  let prevented = false;
  ui.handlers.get('keydown')({ key, altKey: true, shiftKey: true, ctrlKey: false, metaKey: false,
    preventDefault() { prevented = true; }, stopImmediatePropagation() {}, ...props });
  return prevented;
}

test('Alt+Shift+M and N log the result even with the panel closed, without moving focus or interrupting playback', () => {
  const f = fixture(), ui = installUI(f, false);
  const focus = ui.doc.activeElement = { id: 'player-control' };
  let voiceStops = 0;
  f.KWSR.voice = { detenerLectura() { voiceStops++; } };
  assert.equal(press(ui, 'M'), true);
  assert.equal(f.report().phase, 'waiting-subtitle');
  f.advance(2000); press(ui, 'M', { repeat: true });
  f.advance(8000); f.source('>> EL TEXTO DE FLOW.');
  press(ui, 'N', { repeat: true });
  assert.equal(f.report().phase, 'waiting-subtitle');
  assert.equal(press(ui, 'N'), true);
  assert.equal(f.report().phase, 'measured');
  assert.equal(f.report().manualDelayMs, 10000);
  assert.equal(f.video.paused, false);
  assert.equal(voiceStops, 0);
  assert.equal(ui.doc.activeElement, focus);
  assert.deepEqual(ui.panelOpens, []);
  assert.equal(f.logs.length, 1);
  assert.match(f.logs[0], /^\[KathWare\] CONSOLE RENDERER FLOW TIMING .*"phase":"measured"/);
});

test('an open panel keeps the result readable without a live announcement', () => {
  const f = fixture(), ui = installUI(f);
  press(ui, 'M'); f.advance(10250); press(ui, 'N');
  const status = ui.nodes.get('kwsr-flow-timing-status');
  assert.match(status.textContent, /10,25 segundos/);
  assert.equal(status.attrs.role, undefined);
  assert.equal(status.attrs['aria-live'], undefined);
});

test('M and N leave other sites and an inactive extension alone', () => {
  const f = fixture(); f.platform('youtube'); const ui = installUI(f);
  assert.equal(ui.nodes.has('kwsr-flow-timing-status'), false);
  assert.equal(press(ui, 'M'), false);
  assert.equal(press(ui, 'N'), false);
  f.platform('flow'); f.KWSR.state.extensionActiva = false;
  assert.equal(press(ui, 'M'), false);
  assert.equal(press(ui, 'N'), false);
  assert.equal(f.report().phase, 'idle');
});
