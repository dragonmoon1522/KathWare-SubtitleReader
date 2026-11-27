// El motor de juguete nos avisa cuándo termina cada frase. No reproduce audio.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {fixture}=require('./helpers/tts.cjs');

test('new captions wait in order without cancelling a phrase that is speaking',()=>{
  const f=fixture(),first=f.say('Primera frase completa.');f.event(first,'start');
  const cancels=f.synth.cancels;f.say('Segunda frase completa.');f.say('Tercera frase completa.');
  assert.equal(f.synth.cancels,cancels);assert.equal(f.utterances.length,1);
  assert.equal(f.diagnosis().queued,2);
  f.event(first,'end');f.advance(0);
  assert.equal(f.utterances[1].text,'Segunda frase completa.');
  f.event(f.utterances[1],'start');f.event(f.utterances[1],'end');f.advance(0);
  assert.equal(f.utterances[2].text,'Tercera frase completa.');
  f.event(f.utterances[2],'start');f.event(f.utterances[2],'end');
  assert.equal(f.diagnosis().queued,0);assert.equal(f.diagnosis().phase,'idle');
});

test('a caption arriving during startup does not replace or restart that attempt',()=>{
  const f=fixture(),first=f.say('El motor todavía no empezó.');
  f.say('La siguiente espera.');f.advance(8000);
  assert.equal(f.utterances.length,1);assert.equal(f.diagnosis().queued,1);
  f.event(first,'start');f.event(first,'end');f.advance(0);
  assert.equal(f.utterances[1].text,'La siguiente espera.');
});

test('queued phrases use the latest voice, speed and volume without changing the current phrase',()=>{
  const f=fixture({settings:true}),first=f.say('Voz que ya está hablando.');f.event(first,'start');
  f.say('Voz del próximo turno.');
  f.KWSR.ttsSettings.setVoice('elena',{announce:false});
  f.KWSR.ttsSettings.setRate(2.25,{announce:false});f.KWSR.ttsSettings.setVolume(.35,{announce:false});
  assert.equal(first.rate,1.75);assert.equal(first.volume,1);
  f.event(first,'end');f.advance(0);const next=f.utterances[1];
  assert.equal(next.voice.voiceURI,'elena');assert.equal(next.rate,2.25);assert.equal(next.volume,.35);
  assert.equal(f.KWSR.state.modoNarradorGlobal,'sintetizador');
  assert.ok(f.writes.every(v=>!('modoNarrador' in v)));
});

test('a bounded recovery keeps its place ahead of newer subtitles',()=>{
  const f=fixture(),first=f.say('Primera con fallo recuperable.');
  f.event(first,'error',{error:'network'});f.say('Segunda en espera.');f.advance(500);
  assert.equal(f.utterances[1].text,first.text);assert.equal(f.diagnosis().queued,1);
  f.event(first,'end');assert.equal(f.utterances.length,2);
  const retry=f.utterances[1];f.event(retry,'start');f.event(retry,'end');f.advance(0);
  assert.equal(f.utterances[2].text,'Segunda en espera.');
});

test('a terminal failure advances to the next queued phrase without replaying heard words',()=>{
  const f=fixture(),first=f.say('Parte de esta frase ya se escuchó.');f.event(first,'start');
  f.say('Segunda frase.');f.say('Tercera frase.');
  f.event(first,'error',{error:'synthesis-failed'});f.advance(0);
  assert.deepEqual(f.utterances.map(u=>u.text),[first.text,'Segunda frase.']);
  f.event(first,'end');f.event(first,'error',{error:'network'});f.advance(0);
  assert.equal(f.utterances.length,2);assert.equal(f.diagnosis().queued,1);
});

test('pause, seek, ended and emptied discard both active speech and all waiting captions',()=>{
  for(const type of ['pause','seeking','ended','emptied']) {
    const f=fixture(),first=f.say('Antes del cambio.');f.event(first,'start');f.say('No leer después.');
    f.videoEvent(type);f.video.paused=false;f.event(first,'end');f.advance(120000);
    assert.equal(f.utterances.length,1);assert.equal(f.diagnosis().queued,0);
    const current=f.say('Después del cambio.');assert.equal(current.text,'Después del cambio.');
  }
});

test('a seek between two turns cancels the next turn before it starts',()=>{
  const f=fixture(),first=f.say('Terminada.');f.say('Pendiente de la escena anterior.');
  f.event(first,'start');f.event(first,'end');f.videoEvent('seeking');f.advance(0);
  assert.equal(f.utterances.length,1);assert.equal(f.diagnosis().queued,0);
});

test('mode, activation, video and source changes cannot release captions from the old context',()=>{
  for(const change of [
    f=>{f.KWSR.state.modoNarradorGlobal='lector';},f=>{f.KWSR.state.extensionActiva=false;},
    f=>{f.KWSR.state.currentVideo={};},f=>{f.video.currentSrc='blob:nuevo';}
  ]) {
    const f=fixture(),first=f.say('Del contexto anterior.');f.say('También anterior.');
    change(f);f.event(first,'end');f.advance(120000);
    assert.equal(f.utterances.length,1);assert.equal(f.diagnosis().queued,0);
  }
});

test('manual restart clears the queue and stale events cannot interrupt the new speech',()=>{
  const f=fixture({cancellation:'async'}),first=f.say('Frase vieja.');f.event(first,'start');
  f.say('En espera vieja.');f.KWSR.voice.detenerLectura();const current=f.say('Frase nueva.');f.event(current,'start');
  f.advance(50);f.event(first,'end');assert.equal(f.diagnosis().phase,'speaking');
  assert.deepEqual(f.utterances.map(u=>u.text),['Frase vieja.','Frase nueva.']);
});

test('an external speech cancellation stops the queue without changing the selected mode',()=>{
  const f=fixture(),first=f.say('Cancelación externa.');f.say('No continuar automáticamente.');
  f.event(first,'error',{error:'interrupted'});f.advance(120000);
  assert.equal(f.utterances.length,1);assert.equal(f.diagnosis().queued,0);
  assert.equal(f.KWSR.state.modoNarradorGlobal,'sintetizador');assert.equal(f.notices.length,0);
});

test('reader and voice deliver the same ordered captions with the same duplicate filter',()=>{
  const sequences=[];
  for(const mode of ['lector','sintetizador']) {
    const f=fixture();f.KWSR.state.modoNarradorGlobal=mode;
    for(const text of ['Hola.','Hola.','Otra frase.','Hola.']) {f.say(text);f.advance(20);}
    if(mode==='lector') sequences.push(f.updates.filter(x=>x.text).map(x=>x.text));
    else {
      for(let i=0;i<f.utterances.length;i++) {f.event(f.utterances[i],'start');f.event(f.utterances[i],'end');f.advance(0);}
      sequences.push(f.utterances.map(u=>u.text));
    }
  }
  assert.deepEqual(sequences[0],['Hola.','Otra frase.','Hola.']);assert.deepEqual(sequences[1],sequences[0]);
});

test('fullscreen transitions keep the current phrase and its waiting captions',()=>{
  const f=fixture(),first=f.say('Sigue hablando.');f.event(first,'start');f.say('Sigue esperando.');
  const cancels=f.synth.cancels;f.fullscreen(f.player);f.fullscreen(null);
  assert.equal(f.synth.cancels,cancels);assert.equal(f.diagnosis().queued,1);
  f.event(first,'end');f.advance(0);assert.equal(f.utterances[1].text,'Sigue esperando.');
});

test('a backlog is read completely even when the engine ends later turns synchronously',()=>{
  const f=fixture(),first=f.say('Primera.');f.event(first,'start');
  for(let i=0;i<300;i++)f.say(`En espera ${i}.`);
  const speak=f.synth.speak.bind(f.synth);
  f.synth.speak=u=>{speak(u);f.event(u,'start');f.event(u,'end');};
  f.event(first,'end');f.advance(0);
  assert.equal(f.utterances.length,301);assert.equal(f.diagnosis().queued,0);assert.equal(f.diagnosis().phase,'idle');
});
