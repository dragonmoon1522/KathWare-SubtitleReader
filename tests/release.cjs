// Integridad de la estable y comportamiento de sus atajos con DOM simulado.
// Las pruebas de interfaz en un navegador real se ejecutan por separado.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../Extension');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

function fixture() {
  const handlers = new Map(), nodes = new Map(), messages = [];
  let restarts = 0, stops = 0, pauses = 0;
  class Node {
    constructor() { this.style = {}; this.dataset = {}; this.children = []; this.attributes = {}; this.textContent = ''; }
    set id(value) { this._id = value; nodes.set(value, this); }
    get id() { return this._id; }
    setAttribute(name, value) { this.attributes[name] = value; }
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.append(child); }
    addEventListener() {}
    querySelector(selector) { return selector.startsWith('#') ? nodes.get(selector.slice(1)) : null; }
    querySelectorAll() { return []; }
  }
  const focus = new Node();
  const document = {
    activeElement: focus,
    createElement: () => new Node(),
    addEventListener(name, fn) {
      if (!handlers.has(name)) handlers.set(name, []);
      handlers.get(name).push(fn);
    }
  };
  const KWSR = {
    version: manifest.version_name, CFG: {},
    state: {
      extensionActiva: true, modoNarradorGlobal: 'lector', effectiveFuente: 'visual',
      overlayPanel: new Node(),
      currentVideo: { currentTime: 10, pause() { pauses++; }, paused: false }
    },
    platforms: { getPlatform: () => 'flow' },
    pipeline: { restartPipeline() { restarts++; } },
    voice: { detenerLectura() { stops++; } },
    overlay: { ensureOverlay() {}, updateOverlayStatus() {}, setPanelOpen() {} },
    toast: { notify(text) { messages.push(text); } }
  };
  const context = {
    window: { KWSR }, document, location: { href: 'https://example.invalid/player' },
    console: { log() {} }, setTimeout,
    MutationObserver: class { observe() {} }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'content/adapters/kwsr.diagnostics.js'), 'utf8'), context);
  KWSR.overlay.ensureOverlay();
  return {
    KWSR, document, nodes, messages,
    counts: () => ({ restarts, stops, pauses }),
    emit(name, event) { for (const fn of handlers.get(name) || []) fn(event); },
    press(key) {
      let prevented = false;
      this.emit('keydown', {
        key, altKey: true, shiftKey: true,
        preventDefault() { prevented = true; }, stopImmediatePropagation() {}
      });
      return prevented;
    }
  };
}

test('the stable manifest names real, syntactically valid scripts without experimental modules', () => {
  assert.equal(manifest.version_name, manifest.version);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  const files = manifest.content_scripts.flatMap(x => [...x.js, ...(x.css || [])]);
  assert.ok(!files.some(x => /flowTiming|betaTools/.test(x)));
  assert.equal(fs.existsSync(path.join(root, 'content/adapters/kwsr.flowTiming.js')), false);
  for (const file of files) {
    assert.ok(fs.statSync(path.join(root, file)).isFile(), file);
    if (file.endsWith('.js')) new vm.Script(fs.readFileSync(path.join(root, file), 'utf8'), { filename: file });
  }
});

test('stable diagnostics and the D/R shortcuts retain their normal behavior', () => {
  const f = fixture();
  assert.equal(f.KWSR.diagnostics.getDebugState().version, manifest.version);
  assert.equal(f.nodes.get('kwsr-diagnostics-tools').attributes['aria-label'], 'Herramientas de diagnóstico');
  f.KWSR.overlay.ensureOverlay();
  assert.equal(f.KWSR.state.overlayPanel.children.length, 1);
  assert.equal(f.press('D'), true);
  assert.equal(f.KWSR.CFG.debug, true);
  assert.equal(f.press('R'), true);
  assert.deepEqual(f.counts(), { restarts: 1, stops: 1, pauses: 0 });
});

test('the removed Flow shortcuts leave playback, focus and voice unchanged', () => {
  const f = fixture(), focus = f.document.activeElement;
  assert.equal(f.press('M'), false);
  assert.equal(f.press('N'), false);
  assert.equal(f.document.activeElement, focus);
  assert.deepEqual(f.counts(), { restarts: 0, stops: 0, pauses: 0 });
  assert.equal(f.messages.length, 0);
  assert.equal('flowTiming' in f.KWSR.diagnostics.getDebugState(), false);
});

test('fullscreen changes no longer restart reading or cancel voice automatically', async () => {
  const f = fixture();
  f.emit('fullscreenchange', {});
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.deepEqual(f.counts(), { restarts: 0, stops: 0, pauses: 0 });
});
