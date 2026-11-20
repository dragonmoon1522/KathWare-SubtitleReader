const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./helpers/local-player.cjs');

test('the generated player remains isolated from the streaming extension namespace',()=>{
  const f=fixture();
  assert.equal(f.context.window.KWSR,f.original);
  assert.notEqual(f.app,f.original);
  assert.equal(f.app.version,'3.0.0');
  assert.equal(f.app.voice.getTTSState().revision,1);
});

test('reading controls require loaded media and an accessible subtitle track',async()=>{
  const f=fixture(); assert.equal(f.el('modoNarrador').disabled,true);
  f.loadMedia(); assert.equal(f.el('btnPlay').disabled,false); assert.equal(f.el('modoNarrador').disabled,true);
  await f.loadSubs(); assert.equal(f.el('modoNarrador').disabled,false);
});

test('SRT timing commas are converted before the local track is attached',async()=>{
  const f=fixture(); f.loadMedia();
  await f.loadSubs('1\r\n00:00:01,000 --> 00:00:10,000\r\nUna frase.');
  const text=await f.blobs.at(-1).value.text();
  assert.ok(text.startsWith('WEBVTT\n\n')); assert.ok(text.includes('00:00:01.000 --> 00:00:10.000'));
});

test('reader output follows container fullscreen while preserving focus',async()=>{
  const f=fixture(); f.loadMedia(); await f.loadSubs(); f.mode('lector');
  f.cue('Antes de pantalla completa.'); await f.el('btnPlay').onclick(); f.advance(10);
  assert.equal(f.app.state.liveRegion.textContent,'Antes de pantalla completa.');
  const focus=f.document.activeElement;
  f.el('btnFullscreen').onclick();
  assert.equal(f.requested[0],f.root); assert.equal(f.app.state.liveRegion.parentNode,f.root);
  assert.equal(f.document.activeElement,focus);
  f.cue('Dentro de pantalla completa.'); f.advance(10);
  assert.equal(f.app.state.liveRegion.textContent,'Dentro de pantalla completa.');
  f.fullscreen(null); assert.equal(f.app.state.liveRegion.parentNode,f.document.documentElement);
});

test('the player uses the browser default without imposing Spanish',async()=>{
  const f=fixture(); f.loadMedia(); await f.loadSubs(); f.mode('sintetizador');
  f.cue('Browser default.'); await f.el('btnPlay').onclick();
  assert.equal(f.calls[0].voice.voiceURI,'english'); assert.equal(f.calls[0].lang,'en-US');
});

test('an explicit voice and speed survive a transient synthesis error',async()=>{
  const f=fixture(); f.loadMedia(); await f.loadSubs(); f.mode('sintetizador');
  f.el('kwp-voice').value='french'; f.el('kwp-voice').onchange();
  f.el('kwp-rate').value='0.8'; f.el('kwp-rate').onchange();
  f.synth.failNext=true; f.cue('Une phrase.'); await f.el('btnPlay').onclick(); f.advance(500);
  assert.equal(f.calls.length,2); assert.equal(f.calls[1].voice.voiceURI,'french'); assert.equal(f.calls[1].rate,.8);
  assert.equal(f.app.state.modoNarradorGlobal,'sintetizador');
  assert.equal(f.app.state.liveRegion.textContent,'');
});

test('pausing cancels a pending retry and does not revive it on resume',async()=>{
  const f=fixture(); f.loadMedia(); await f.loadSubs(); f.mode('sintetizador');
  f.synth.failNext=true; f.cue('Pendiente.'); await f.el('btnPlay').onclick(); f.el('btnPause').onclick(); f.advance(1000);
  assert.equal(f.calls.length,1); assert.equal(f.app.voice.getTTSState().phase,'idle');
});

test('switching output cancels synthesis and delivers the current cue through the reader',async()=>{
  const f=fixture(); f.loadMedia(); await f.loadSubs(); f.mode('sintetizador');
  f.cue('Frase actual.'); await f.el('btnPlay').onclick();
  f.mode('lector'); f.advance(10);
  assert.equal(f.synth.speaking,false); assert.equal(f.app.state.liveRegion.textContent,'Frase actual.');
});

test('replacing local files revokes their previous object URLs and resets subtitle readiness',async()=>{
  const f=fixture(); f.loadMedia(); await f.loadSubs();
  const media=f.blobs[0].url, subs=f.blobs[1].url;
  f.loadMedia();
  assert.ok(f.revoked.includes(media)); assert.ok(f.revoked.includes(subs));
  assert.equal(f.el('modoNarrador').disabled,true);
});
