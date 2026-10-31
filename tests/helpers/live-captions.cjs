// DOM y reloj simulados para las pruebas de lectura incremental.
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../../Extension/content/adapters/kwsr.consoleRenderers.js'), 'utf8');

function fixture(platform = 'flow') {
  let now = 0, id = 0;
  const timers = new Map(), spoken = [], logs = [];
  class Element {
    constructor() { this.textContent = ''; this.tagName = 'DIV'; }
    get innerText() { return this.textContent; }
    closest() { return null; }
    getBoundingClientRect() { return { width: 200, height: 40 }; }
  }
  let elements = [new Element()];
  const KWSR = {
    state: { extensionActiva: true, effectiveFuente: 'visual' }, CFG: { debug: true },
    visual: {}, platforms: { getPlatform: () => platform },
    voice: { shouldReadNow: () => true, leerTextoAccesible: text => spoken.push({ text, at: now }) },
    log: (...args) => logs.push(args)
  };
  const context = {
    window: { KWSR }, Element, Date: { now: () => now },
    document: { querySelectorAll: () => elements.filter(el => el.textContent) },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
    setTimeout: (fn, delay) => { timers.set(++id, { at: now + delay, fn }); return id; },
    clearTimeout: key => timers.delete(key)
  };
  vm.runInNewContext(source, context);
  return {
    KWSR, spoken, logs,
    text(value) { this.dom(value); KWSR.consoleRenderers.livePoll(); },
    dom(value) { elements = [new Element()]; elements[0].textContent = value; },
    segments(values) {
      elements = values.map(value => { const el = new Element(); el.textContent = value; return el; });
      KWSR.consoleRenderers.livePoll();
    },
    advance(ms) {
      const end = now + ms;
      while (true) {
        const next = [...timers].sort((a,b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        timers.delete(next[0]); now = next[1].at; next[1].fn();
      }
      now = end;
    },
    texts() { return spoken.map(x => x.text); }
  };
}

module.exports = { fixture };
