// DOM y reloj para comprobar dónde se emiten los subtítulos sin simular NVDA.
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const voiceSource = fs.readFileSync(path.join(__dirname, '../../Extension/content/core/kwsr.voice.js'), 'utf8');
const overlaySource = fs.readFileSync(path.join(__dirname, '../../Extension/content/ui/kwsr.overlay.js'), 'utf8');

function fixture() {
  let now = 0, id = 0;
  const timers = new Map(), handlers = new Map(), updates = [];
  let document;
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.parentNode = null; this.children = [];
      this.style = {}; this.attrs = {}; this._text = ''; this.focusCalls = 0;
    }
    get parentElement() { return this.parentNode; }
    get isConnected() { let p = this; while (p?.parentNode) p = p.parentNode; return p === document.documentElement; }
    setAttribute(key, value) { this.attrs[key] = value; }
    getAttribute(key) { return this.attrs[key] ?? null; }
    get textContent() { return this._text; }
    set textContent(value) {
      this._text = String(value);
      if (this.id === 'kwsr-live-region') updates.push({ text: this._text, parent: this.parentNode, at: now });
    }
    appendChild(child) { child.remove(); child.parentNode = this; this.children.push(child); return child; }
    remove() {
      if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(x => x !== this);
      this.parentNode = null;
    }
    contains(el) { for (let p = el; p; p = p.parentNode) if (p === this) return true; return false; }
    focus() { this.focusCalls++; document.activeElement = this; }
    closest() { return null; }
  }
  document = {
    documentElement: new Element('html'), fullscreenElement: null, activeElement: null,
    createElement: tag => new Element(tag),
    addEventListener(event, fn) {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event).push(fn);
    }
  };
  const body = document.documentElement.appendChild(new Element('body'));
  const player = body.appendChild(new Element('div'));
  player.id = 'player';
  const video = player.appendChild(new Element('video'));
  Object.assign(video, { paused: false, ended: false, currentTime: 100, playbackRate: 1 });
  const focus = player.appendChild(new Element('button'));
  document.activeElement = focus;
  const KWSR = {
    state: { extensionActiva: true, modoNarradorGlobal: 'lector', currentVideo: video, effectiveFuente: 'visual', liveRegion: null },
    CFG: {}, platforms: { getPlatform: () => 'generic' }
  };
  const context = {
    window: { KWSR }, document, Element, Date: { now: () => now }, console,
    setTimeout(fn, delay) { timers.set(++id, { fn, at: now + delay }); return id; },
    clearTimeout(key) { timers.delete(key); }
  };
  vm.createContext(context);
  vm.runInContext(voiceSource, context);
  return {
    KWSR, document, body, player, video, focus, context, updates,
    loadOverlay() {
      KWSR.state.overlayPanel = { style: { display: 'block' } };
      vm.runInContext(overlaySource, context);
    },
    node: tag => new Element(tag),
    emit(name) { for (const fn of handlers.get(name) || []) fn(); },
    fullscreen(node) { document.fullscreenElement = node; this.emit('fullscreenchange'); },
    advance(ms) {
      const end = now + ms;
      while (true) {
        const next = [...timers].sort((a,b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        timers.delete(next[0]); now = next[1].at; next[1].fn();
      }
      now = end;
    }
  };
}
module.exports = { fixture };
