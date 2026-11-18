// DOM controlado para probar el recorrido de bancos y los filtros del lector.
// No sustituye las pruebas de renderizado en un navegador real.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const base = path.join(__dirname, '../../Extension');

function fixture(hostname = 'www.crunchyroll.com') {
  let now = 0, id = 0;
  const timers = new Map(), observers = [], handlers = new Map(), spoken = [], logs = [];
  const simple = (el, token) => {
    const tag = token.match(/^(\w+|\*)/), ids = [...token.matchAll(/#([\w-]+)/g)];
    if (tag && tag[1] !== '*' && el.tagName !== tag[1].toUpperCase()) return false;
    if (ids.some(m => el.id !== m[1])) return false;
    const withoutAttrs = token.replace(/\[[^\]]+\]/g, '');
    if ([...withoutAttrs.matchAll(/\.([\w-]+)/g)].some(m => !el.className.split(/\s+/).includes(m[1]))) return false;
    for (const m of token.matchAll(/\[([\w-]+)(?:(\*?=)['"]?([^'"\]]*)['"]?)?\]/g)) {
      const value = el.getAttribute(m[1]);
      if (value == null || m[2] === '=' && value !== m[3] || m[2] === '*=' && !value.includes(m[3])) return false;
    }
    return true;
  };
  const matches = (el, selector) => selector.split(',').some(part => {
    const tokens = part.trim().replace(/\s*>\s*/g, ' > ').split(/\s+/);
    const visit = (node, i) => {
      if (!node || !simple(node, tokens[i])) return false;
      if (i === 0) return true;
      if (tokens[i - 1] === '>') return visit(node.parentElement, i - 2);
      for (let p = node.parentElement; p; p = p.parentElement) if (visit(p, i - 1)) return true;
      return false;
    };
    return visit(el, tokens.length - 1);
  });
  class Element {
    constructor(tag = 'div', attrs = {}, text = '') {
      this.tagName = tag.toUpperCase(); this.nodeType = 1; this.attrs = { ...attrs };
      this.children = []; this.parentElement = null; this._text = text;
      this.style = { display: 'block', visibility: 'visible', opacity: '1' };
      this.box = { left: 80, top: 280, width: 450, height: 30 };
      this.events = new Map(); this.value = ''; this.checked = false;
    }
    get parentNode() { return this.parentElement; }
    get id() { return this.attrs.id || ''; } set id(v) { this.attrs.id = v; }
    get className() { return this.attrs.class || ''; } set className(v) { this.attrs.class = v; }
    get textContent() { return this._text + this.children.map(c => c.textContent).join(''); }
    set textContent(v) { this._text = String(v); this.children = []; }
    get innerText() { return this._text + this.children.filter(c => !c.hidden && c.style.display !== 'none').map(c => c.innerText).join(''); }
    get isConnected() { let el = this; while (el.parentElement) el = el.parentElement; return el === document.documentElement; }
    setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return this.attrs[k] ?? null; }
    matches(selector) { return matches(this, selector); }
    closest(selector) { for (let p = this; p; p = p.parentElement) if (p.matches(selector)) return p; return null; }
    appendChild(child) { child.remove(); child.parentElement = this; this.children.push(child); return child; }
    append(...children) { children.forEach(c => this.appendChild(c)); }
    remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(c => c !== this); this.parentElement = null; }
    descendants() { return this.children.flatMap(c => [c, ...c.descendants()]); }
    querySelectorAll(sel) { return this.descendants().filter(el => el.matches(sel)); }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    contains(el) { for (let p = el; p; p = p.parentElement) if (p === this) return true; return false; }
    getBoundingClientRect() { return { ...this.box, right: this.box.left + this.box.width, bottom: this.box.top + this.box.height }; }
    addEventListener(name, fn) { this.events.set(name, fn); }
    focus() { document.activeElement = this; }
  }
  const document = {
    documentElement: new Element('html'), fullscreenElement: null,
    createElement: tag => new Element(tag),
    addEventListener(name, fn) { handlers.set(name, fn); },
    querySelectorAll(sel) { return [this.documentElement, ...this.documentElement.descendants()].filter(el => el.matches(sel)); },
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
    getElementById(id) { return this.querySelector(`#${id}`); }
  };
  const body = document.body = document.documentElement.appendChild(new Element('body'));
  const player = body.appendChild(new Element('div', { id: 'video-player' }));
  const video = player.appendChild(new Element('video'));
  Object.assign(video, { paused: false, ended: false, currentTime: 100, currentSrc: 'blob:video', textTracks: [] });
  video.box = { left: 0, top: 0, width: 640, height: 360 };
  const KWSR = {
    state: { extensionActiva: true, effectiveFuente: 'visual', modoNarradorGlobal: 'lector', currentVideo: video },
    CFG: { debug: true, debugVisual: true },
    voice: { shouldReadNow: () => !video.paused && KWSR.state.extensionActiva, leerTextoAccesible: t => spoken.push(t) },
    log: (...args) => logs.push(args), video: { getMainVideo: () => video }
  };
  const context = {
    window: { KWSR, getComputedStyle: el => el.style }, document, Element, console,
    getComputedStyle: el => el.style, location: { hostname, href: `https://${hostname}/watch/example` },
    Date: class extends Date { constructor() { super(1794931200000 + now); } static now() { return now; } },
    performance: { now: () => now },
    MutationObserver: class {
      constructor(fn) { this.fn = fn; observers.push(this); }
      observe() { this.active = true; } disconnect() { this.active = false; }
    },
    setTimeout(fn, ms) { timers.set(++id, { fn, at: now + ms }); return id; },
    clearTimeout(key) { timers.delete(key); }
  };
  context.requestAnimationFrame = fn => context.setTimeout(fn, 16);
  vm.createContext(context);
  const load = file => vm.runInContext(fs.readFileSync(path.join(base, file), 'utf8'), context);
  load('content/core/kwsr.platforms.js'); load('content/core/kwsr.visual.js'); load('content/adapters/kwsr.consoleRenderers.js');
  return {
    KWSR, context, document, body, player, video, spoken, logs, handlers, load,
    node(tag = 'div', attrs = {}, text = '', parent = player) { return parent.appendChild(new Element(tag, attrs, text)); },
    start() { KWSR.visual.startVisual(); KWSR.visual.pollVisualTick(); },
    mutate(node) { for (const observer of observers) if (observer.active) observer.fn([{ target: node }]); },
    advance(ms) {
      const end = now + ms;
      while (true) {
        const next = [...timers].sort((a,b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        timers.delete(next[0]); now = next[1].at; next[1].fn();
      }
      if (!video.paused) video.currentTime += ms / 1000;
      now = end;
    }
  };
}
module.exports = { fixture };
