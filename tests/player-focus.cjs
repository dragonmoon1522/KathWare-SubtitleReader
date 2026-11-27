const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./helpers/player-dom.cjs');
const PIN='data-kwsr-focus-controls';

test('Tab and Shift+Tab wake native controls without consuming either key',()=>{
  const f=fixture();
  const before=f.node('button',{},'Antes',f.body);f.focus(before);
  for(const shiftKey of [false,true]) {
    f.advance(40);const event=f.emit('keydown',{key:'Tab',shiftKey});
    assert.equal(event.defaultPrevented,false);
  }
  assert.ok(f.events.some(e=>e.type==='mousemove'&&e.current===f.player));
  assert.equal(f.document.activeElement,before);
});

test('native controls and SubtitleReader settings keep the current player pinned',()=>{
  for(const idOnVideo of [false,true]) {
    const f=fixture();
    if(idOnVideo) {f.player.id='outer-player';f.video.id='video-player';}
    f.focus(f.play);assert.ok(f.controls.hasAttribute(PIN));
    f.focus(f.settings);f.advance(16);
    assert.ok(f.controls.hasAttribute(PIN));
    assert.equal(f.document.activeElement,f.settings);
    assert.equal(f.settings.hasAttribute(PIN),false);
    assert.ok(f.events.some(e=>e.type==='mouseover'));
  }
});

test('fallback controls also keep native bars awake while the user works there',()=>{
  const f=fixture();f.focus(f.ownPlay);
  assert.ok(f.controls.hasAttribute(PIN));
  f.controls.style.display='none';
  assert.equal(f.computed(f.controls).display,'block');
  assert.equal(f.document.activeElement,f.ownPlay);
});

test('leaving all player controls restores the page display and previous custom property',()=>{
  const f=fixture();f.controls.style.setProperty('--kwsr-focus-display','grid','important');
  f.focus(f.play);f.controls.style.display='none';
  const after=f.node('button',{},'Después',f.body);f.focus(after);f.advance(16);
  assert.equal(f.controls.hasAttribute(PIN),false);
  assert.equal(f.controls.style.getPropertyValue('--kwsr-focus-display'),'grid');
  assert.equal(f.controls.style.getPropertyPriority('--kwsr-focus-display'),'important');
  assert.equal(f.computed(f.controls).display,'none');
});

test('closed menus and a second player are never pinned',()=>{
  const f=fixture();
  const menu=f.node('div',{role:'menu','aria-hidden':'true'});
  const menuBar=f.node('div',{'data-player-controls':''},'',menu);
  f.node('button',{},'Opción',menuBar);
  const other=f.node('div',{id:'other-player'},'',f.body);
  const bar=f.node('div',{'data-player-controls':''},'',other);f.node('button',{},'Otro',bar);
  f.focus(f.settings);
  assert.equal(menuBar.hasAttribute(PIN),false);assert.equal(bar.hasAttribute(PIN),false);
  assert.equal(menu.getAttribute('aria-hidden'),'true');
});

test('OFF and window blur remove the temporary visibility protection',()=>{
  for(const stop of [f=>{f.KWSR.state.extensionActiva=false;f.KWSR.keepAlive.tick();},f=>f.blur()]) {
    const f=fixture();f.focus(f.play);assert.ok(f.controls.hasAttribute(PIN));stop(f);
    assert.equal(f.controls.hasAttribute(PIN),false);
  }
});

test('replacement bars are protected while focus stays on SubtitleReader settings',()=>{
  const f=fixture();f.focus(f.settings);
  const replacement=f.node('div',{'data-player-controls':''});f.node('button',{},'Reproducir',replacement);
  f.mutate(replacement);
  assert.ok(replacement.hasAttribute(PIN));assert.equal(f.document.activeElement,f.settings);
});

test('a known toolbar already hidden with display none is restored when entering our settings',()=>{
  const f=fixture();f.controls.style.display='flex';f.sync();f.controls.style.display='none';
  f.focus(f.settings);
  assert.ok(f.controls.hasAttribute(PIN));assert.equal(f.computed(f.controls).display,'flex');
  f.focus(f.body);f.advance(16);
  assert.equal(f.computed(f.controls).display,'none');
});

test('named native controls and controls repaired with labels hide only our playback row',()=>{
  for(const repaired of [false,true]) {
    const f=fixture({repaired});f.sync();
    assert.equal(f.row.style.display,'none');assert.equal(f.row.getAttribute('aria-hidden'),'true');
    assert.notEqual(f.panel.style.display,'none');
    assert.equal(f.settings.isConnected,true);
  }
});

test('a previously usable toolbar fading out does not introduce duplicate controls',()=>{
  for(const style of [{opacity:'0'},{visibility:'hidden'},{display:'none'}]) {
    const f=fixture();f.sync();Object.assign(f.controls.style,style);f.sync();
    assert.equal(f.row.style.display,'none');
    assert.equal(f.KWSR.playerUIRules.nativePlayerAccessibility().reason,'known-controls-auto-hidden');
  }
});

test('hidden menus, removed buttons, disabled buttons and a changed video invalidate fallback evidence',()=>{
  for(const change of [
    f=>f.full.remove(),f=>{f.volume.disabled=true;},f=>f.controls.setAttribute('aria-hidden','true'),
    f=>f.controls.setAttribute('hidden',''),
    f=>{f.video.currentSrc='blob:otro';f.controls.style.display='none';}
  ]) {
    const f=fixture();f.sync();change(f);f.sync();assert.equal(f.row.style.display,'flex');
  }
});

test('fallback is kept until focus leaves its playback row when native controls become usable',()=>{
  const f=fixture();f.full.disabled=true;f.sync();f.focus(f.ownPlay);
  f.full.disabled=false;f.sync();assert.equal(f.row.style.display,'flex');
  f.focus(f.settings);f.advance(16);f.sync();assert.equal(f.row.style.display,'none');
});
