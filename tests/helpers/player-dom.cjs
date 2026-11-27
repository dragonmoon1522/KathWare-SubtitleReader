// Una página de juguete para probar foco y botones sin abrir una plataforma.
// Comprueba decisiones y eventos. No sustituye el dibujo real de Chrome ni NVDA.
const { fixture: captionFixture } = require('./selector-dom.cjs');

function fixture({ repaired = false } = {}) {
  const f = captionFixture(), { document, context, KWSR } = f;
  KWSR.CFG.debug = false;
  const proto = context.Element.prototype, originalMatches = proto.matches;
  const handlers = new Map(), events = [], windowHandlers = new Map();
  let pageFocused = true;
  proto.hasAttribute = function(name) { return this.getAttribute(name) != null; };
  proto.removeAttribute = function(name) { delete this.attrs[name]; };
  proto.matches = function(selector) {
    return selector.split(',').some(part => part.trim() === ':disabled'
      ? this.disabled : originalMatches.call(this, part));
  };
  for (const attr of ['hidden','inert','disabled']) Object.defineProperty(proto, attr, {
    configurable: true, get() { return this.hasAttribute(attr); },
    set(value) { if (value) this.setAttribute(attr, ''); else this.removeAttribute(attr); }
  });
  Object.defineProperty(proto, 'tabIndex', { configurable:true,
    get() { const value = this.getAttribute('tabindex'); return value != null ? Number(value)
      : /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(this.tagName) || this.tagName === 'A' && this.hasAttribute('href') ? 0 : -1; },
    set(value) { this.setAttribute('tabindex', value); }
  });
  const decorate = el => {
    const values = new Map(), priorities = new Map();
    Object.assign(el.style, {
      getPropertyValue: name => values.get(name) || '', getPropertyPriority: name => priorities.get(name) || '',
      setProperty(name,value,priority='') { values.set(name,String(value)); priorities.set(name,priority); },
      removeProperty(name) { const old=values.get(name); values.delete(name); priorities.delete(name); return old; }
    });
    return el;
  };
  for (const el of [document.documentElement, ...document.documentElement.descendants()]) decorate(el);
  const originalCreate = document.createElement;
  document.createElement = tag => decorate(originalCreate(tag));
  const node = (tag,attrs={},text='',parent=f.player) => {
    const el = document.createElement(tag);
    for (const [name,value] of Object.entries(attrs)) el.setAttribute(name,value);
    el.textContent=text; parent.appendChild(el); return el;
  };
  proto.dispatchEvent = function(event) {
    event.target ||= this;
    for (let el=this;el;el=event.bubbles ? el.parentElement : null) {
      events.push({ type:event.type, target:this, current:el });
      for (const fn of el.events.get(event.type) || []) fn(event);
    }
    return true;
  };
  proto.addEventListener = function(name,fn) {
    if (!this.events.has(name)) this.events.set(name,[]);
    this.events.get(name).push(fn);
  };
  document.addEventListener = (name,fn) => {
    if (!handlers.has(name)) handlers.set(name,[]);
    handlers.get(name).push(fn);
  };
  context.window.addEventListener = (name,fn) => windowHandlers.set(name,fn);
  context.MouseEvent = context.PointerEvent = class {
    constructor(type,init) { this.type=type;Object.assign(this,init); }
  };
  context.window.PointerEvent=context.PointerEvent;
  document.hasFocus = () => pageFocused;
  document.activeElement = document.body;
  document.elementFromPoint = () => f.video;
  const computed = el => {
    let visibility = el.style.visibility || 'visible';
    for (let p=el.parentElement;p;p=p.parentElement) {
      if (p.style.visibility === 'hidden') visibility='hidden';
    }
    const pinned = el.hasAttribute('data-kwsr-focus-controls') && !el.closest('[hidden],[inert],[aria-hidden="true"]');
    return { display:pinned ? el.style.getPropertyValue('--kwsr-focus-display') : el.style.display || 'block',
      visibility:pinned ? 'visible' : visibility, opacity:pinned ? '1' : el.style.opacity || '1' };
  };
  context.getComputedStyle=context.window.getComputedStyle=computed;
  KWSR.platforms.getPlatform = () => repaired ? 'flow' : 'generic';
  KWSR.platforms.platformCapabilities = () => ({ keepAlive:false });
  const controls=node('div',{id:'controls'});
  const play=node('button',{},'Reproducir',controls);
  const volume=node('button',{},'Volumen',controls);
  const full=node('button',{},'Pantalla completa',controls);
  if (repaired) {
    for (const el of [play,volume,full]) { el.setAttribute('aria-label',el.textContent);el.textContent=''; }
  }
  const ownRoot=node('div',{id:'kathware-overlay-root'},'',document.body);
  const panel=node('div',{id:'kathware-overlay-panel'},'',ownRoot);
  const row=node('div',{},'',panel);
  const ownPlay=node('button',{'aria-label':'Reproducir'},'',row);
  const settings=node('select',{},'',panel);
  KWSR.state.overlayPanel=panel;
  KWSR.overlay={ ensureOverlay(){},setPanelOpen(){},updateOverlayStatus(){},handlePlayerHotkeys(){return false;} };
  const emit = (name,init={}) => {
    const ev={ target:document.activeElement,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...init };
    for (const fn of handlers.get(name)||[]) fn(ev);
    return ev;
  };
  f.load('content/adapters/kwsr.keepAlive.js');
  f.load('content/adapters/kwsr.playerUIRules.js');
  return { ...f,node,controls,play,volume,full,ownRoot,panel,row,ownPlay,settings,events,emit,computed,
    focus(el) { const old=document.activeElement;document.activeElement=el;emit('focusout',{target:old});emit('focusin'); },
    blur() {pageFocused=false;windowHandlers.get('blur')?.();},
    sync() {KWSR.playerUIRules.syncFallbackPlayer();},
    mutate(el) {f.mutate(el);f.advance(16);}
  };
}
module.exports={fixture};
