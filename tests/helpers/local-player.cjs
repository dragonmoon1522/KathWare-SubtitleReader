// Ejecuta el snippet generado con DOM, archivos y síntesis controlados.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { fixture: liveFixture } = require('./live-region.cjs');
const html = fs.readFileSync(path.join(__dirname,'../../web/kathware-player-local.html'),'utf8');

function fixture() {
  const f = liveFixture(), root = f.player, original = f.KWSR;
  original.state.extensionActiva = false;
  root.id = 'kathware-local-player'; f.video.id = 'videoPlayer';
  const descendants = node => [node,...node.children.flatMap(descendants)];
  const proto = Object.getPrototypeOf(root);
  proto.querySelector = function(selector) { return descendants(this).find(node => selector.startsWith('#') && node.id === selector.slice(1)) || null; };
  f.document.getElementById = id => descendants(f.document.documentElement).find(node => node.id === id) || null;
  f.document.readyState = 'complete';
  const el = id => f.document.getElementById(id);
  for (const m of html.matchAll(/<(section|input|select|video|button|span|p|div)[^>]*\bid="([^"]+)"/g)) {
    if (!el(m[2])) { const node = f.node(m[1]); node.id = m[2]; root.appendChild(node); }
  }
  el('modoNarrador').value = 'off'; el('kwp-rate').value = '1.75';
  const videoListeners = new Map();
  f.video.addEventListener = (name,fn) => { if(!videoListeners.has(name)) videoListeners.set(name,new Set()); videoListeners.get(name).add(fn); };
  f.video.removeEventListener = (name,fn) => videoListeners.get(name)?.delete(fn);
  const event = name => { f.video['on'+name]?.(); for(const fn of [...(videoListeners.get(name)||[])]) fn(); };
  Object.assign(f.video,{paused:true,ended:false,currentTime:0,duration:120,currentSrc:'',volume:1,muted:false});
  f.video.play = () => { f.video.paused=false; event('play'); return Promise.resolve(); };
  f.video.pause = () => { f.video.paused=true; event('pause'); };
  f.video.load = () => f.context.setTimeout(() => { f.video.currentSrc=f.video.src; event('loadedmetadata'); },10);
  const calls=[], revoked=[], blobs=[], requested=[];
  const synth={speaking:false,paused:false,current:null,failNext:false,
    voices:[{voiceURI:'spanish',name:'Español',lang:'es-ES'},{voiceURI:'english',name:'English',lang:'en-US',default:true},{voiceURI:'french',name:'Français',lang:'fr-FR'}],
    getVoices(){return this.voices;},addEventListener(){},
    speak(u){calls.push(u);this.current=u;if(this.failNext){this.failNext=false;u.onerror?.({error:'network'});return;}this.speaking=true;u.started=true;u.onstart?.();},
    cancel(){const old=this.current;this.current=null;this.speaking=false;old?.onerror?.({error:old.started?'interrupted':'canceled'});}
  };
  f.context.speechSynthesis=synth;
  f.context.SpeechSynthesisUtterance=class {constructor(text){this.text=text;}};
  const create=f.document.createElement;
  f.document.createElement=tag=>{const node=create(tag);if(tag==='track')node.track={activeCues:[],mode:'disabled'};return node;};
  const append=f.video.appendChild.bind(f.video);
  f.video.appendChild=node=>{append(node);if(node.tagName==='TRACK')f.context.setTimeout(()=>node.onload?.(),10);return node;};
  f.context.URL={createObjectURL(value){const url='blob:fixture-'+blobs.length;blobs.push({url,value});return url;},revokeObjectURL:url=>revoked.push(url)};
  f.context.Blob=Blob;
  f.context.window.addEventListener=()=>{};
  root.requestFullscreen=()=>{requested.push(root);f.fullscreen(root);return Promise.resolve();};
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],f.context);
  const app=f.context.window.__KATHWARE_LOCAL_PLAYER__;
  return {...f,root,el,app,synth,calls,blobs,revoked,requested,original,event,
    loadMedia(){el('videoInput').onchange({target:{files:[{name:'sample.wav'}]}});f.advance(10);},
    async loadSubs(text='WEBVTT\n\n00:00:01.000 --> 00:00:10.000\nUna frase.'){await el('subtitleInput').onchange({target:{files:[{text:async()=>text}]}});f.advance(10);},
    cue(text){const track=f.video.children.find(node=>node.tagName==='TRACK');track.track.activeCues=text?[{text}]:[];track.track.oncuechange?.();},
    mode(value){el('modoNarrador').value=value;el('modoNarrador').onchange();}
  };
}
module.exports={fixture};
