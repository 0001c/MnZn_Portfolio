const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.resolve(__dirname, '../../index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const unit = { Math };
vm.runInNewContext(script.slice(script.indexOf('function pointerTime('), script.indexOf('function updatePointer(')), unit);
for (const [x,y,time] of [[0,0,0],[1,0,1.3],[0,-1,3],[-1,0,5],[0,1,7]]) {
  assert.ok(Math.abs(unit.pointerTime(x,y)-time)<1e-8, 'cardinal directions must match calibrated video times');
}
for (let y=-1;y<=1;y+=.05) for(let x=-1;x<=1;x+=.05) {
  const time=unit.pointerTime(x,y);
  assert.ok(Number.isFinite(time)&&time>=0&&time<=8.3,'mapping must exclude out-of-range/closed-eye frames');
}
assert.equal(unit.pointerTime(.08,.06),0,'central dead zone must remain neutral');
assert.ok(unit.pointerTime(1,-1)>1.3&&unit.pointerTime(1,-1)<3);
assert.ok(unit.pointerTime(-1,-1)>3&&unit.pointerTime(-1,-1)<5);
assert.ok(unit.pointerTime(0,1,4)<4,'short replacement video must remain within duration');

// Run the complete inline controller with deterministic media decoding delays.
// This verifies real event/state logic; it does not replace browser video QA.
let clock=0,id=0,decodeDelay=20;
const raf=new Map(),timers=new Map(),decodes=[];
class Element {
  constructor(){this.listeners={};this.dataset={};this.hidden=false;this.attrs={};this.textContent='';this.props={};this.style={setProperty:(k,v)=>{this.props[k]=v;}};this.classList={toggle:()=>{}};}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
  emit(type,event={}){for(const fn of this.listeners[type]??[])fn(event);}
  setAttribute(k,v){this.attrs[k]=v;}
  removeAttribute(k){delete this.attrs[k];}
  hasPointerCapture(id){return this.capture===id;}
  setPointerCapture(id){this.capture=id;}
  releasePointerCapture(){this.capture=null;}
  closest(){return null;}
  contains(target){return target===this;}
}
class Video extends Element {
  constructor(){super();this.duration=10;this.readyState=4;this._time=0;this.paused=true;this.seeking=false;this.seeks=[];this.loads=0;}
  get currentTime(){return this._time;}
  set currentTime(time){
    assert.ok(!this.seeking,'must not queue seeks while decoding');
    assert.ok(time>=0&&time<this.duration,'seek must remain within video');
    this.seeking=true;this._time=time;this.seeks.push(time);decodes.push({video:this,due:clock+decodeDelay});
  }
  pause(){this.paused=true;}
  play(){this.paused=false;this.emit('play');return Promise.resolve();}
  load(){this.loads++;}
}
const elements=new Map();
const get=id=>{if(!elements.has(id))elements.set(id,id.endsWith('-video')?new Video():new Element());return elements.get(id);};
const surface=new Element(),root=new Element(),body=new Element(),statusText=new Element(),statusButton=new Element();
body.dataset.mode='intro';
get('media-status').querySelector=q=>q==='span'?statusText:statusButton;
const chapters=Array.from({length:3},()=>new Element()),nav=Array.from({length:3},()=>new Element());
const document={hidden:false,body,documentElement:root,getElementById:get,
  querySelector:q=>q==='.intro-window'?surface:get(q),
  querySelectorAll:q=>q==='.chapter'?chapters:q==='.nav a'?nav:[],listeners:{},
  addEventListener:Element.prototype.addEventListener,emit:Element.prototype.emit};
Object.defineProperty(get('scroll-track'),'offsetHeight',{get:()=>parseFloat(get('scroll-track').style.height)||9000});
const window=new Element();Object.assign(window,{innerWidth:1440,innerHeight:900,scrollY:0});
surface.getBoundingClientRect=()=>{
  const stacked=window.innerWidth<=600||(window.innerWidth<=900&&window.innerHeight>window.innerWidth);
  const width=window.innerWidth*(stacked?1.12:.72)*.78,height=window.innerHeight*(stacked?.40:.64)*.78;
  return {width,height,left:window.innerWidth/2-width/2,top:window.innerHeight*(stacked?.49:.52)-height/2};
};
window.scrollTo=({top})=>{window.scrollY=top;window.emit('scroll');};
const reduced=new Element();reduced.matches=false;
const context={window,document,innerWidth:1440,innerHeight:900,Math,Number,Object,String,performance:{now:()=>clock},
  matchMedia:()=>reduced,requestAnimationFrame:fn=>{raf.set(++id,fn);return id;},cancelAnimationFrame:id=>raf.delete(id),
  setTimeout:(fn,delay)=>{timers.set(++id,{fn,due:clock+delay});return id;},clearTimeout:id=>timers.delete(id)};
window.setTimeout=context.setTimeout;
vm.runInNewContext(script,context);
const intro=get('intro-video'),main=get('main-video'),outro=get('outro-video');
main.emit('loadedmetadata');main.emit('loadeddata');intro.emit('loadeddata');
function advance(ms=700){
  const end=clock+ms;
  while(clock<end){
    clock+=10;
    for(let i=decodes.length-1;i>=0;i--)if(decodes[i].due<=clock){const d=decodes.splice(i,1)[0];d.video.seeking=false;d.video.emit('seeked');}
    for(const [key,t] of [...timers])if(t.due<=clock){timers.delete(key);t.fn();}
    const callbacks=[...raf.values()];raf.clear();callbacks.forEach(fn=>fn(clock));
  }
}
function pointer(x,y,buttons=1,extra={}){const rect=surface.getBoundingClientRect();return {pointerType:'mouse',pointerId:1,button:0,buttons,target:surface,clientX:(x/2+.5)*window.innerWidth,clientY:y*.48*window.innerHeight+rect.top+rect.height/2,...extra};}
function mouse(x,y,buttons=1){window.emit('pointermove',pointer(x,y,buttons));}
function down(x=0,y=0,extra={}){window.emit('pointerdown',pointer(x,y,1,extra));}
function up(extra={}){window.emit('pointerup',pointer(0,0,0,extra));}
function expectIntro(time){advance(12000);assert.ok(Math.abs(intro.currentTime-time)<=1/24,'video must settle at requested frame');assert.ok(intro.paused&&!intro.seeking);}
advance();assert.ok(intro.paused&&main.paused);
mouse(-1,0,0);expectIntro(0);
down(-1,0,{button:2,buttons:2});mouse(-1,0,2);expectIntro(0);
down(-1,0,{target:{closest:()=>({})}});mouse(-1,0);expectIntro(0);
down();
for(const [x,y,time] of [[1,0,1.3],[0,-1,3],[-1,0,5],[0,1,7]]){mouse(x,y);expectIntro(time);}
// Large direction changes must show adjacent recorded frames at natural speed, allowing lag.
let seekStart=intro.seeks.length;mouse(0,0);advance(1000);
assert.ok(intro.currentTime>5.9&&intro.currentTime<7,'one second must not sweep seven seconds of video');
assert.ok(intro.seeks.length-seekStart<=24,'follow must not exceed source frame rate');
assert.ok(intro.seeks.length>seekStart,'delayed follower must keep progressing');
expectIntro(0);
assert.ok(intro.seeks.slice(seekStart).every((t,i,a)=>Math.abs(t-(i?a[i-1]:7))<=1/24+1e-6),'large change must never skip a source frame');
mouse(-1,0);expectIntro(5);seekStart=intro.seeks.length;
for(const x of [-.6,-.3,-.1,0,.1,.3,.6,1]){mouse(x,0);advance(60);}
expectIntro(1.3);
assert.ok(intro.seeks.slice(seekStart).every((t,i,a)=>Math.abs(t-(i?a[i-1]:5))<=1/24+1e-6),'crossing center must remain frame-continuous');
decodeDelay=150;mouse(-1,0);advance(1000);
const slowTime=intro.currentTime;
assert.ok(slowTime<1.7,'slow decoding should add latency instead of skipping frames');
decodeDelay=20;advance(200);
assert.ok(intro.currentTime-slowTime<=.25,'decoder recovery must not trigger a catch-up burst');
expectIntro(5);
for(let i=0;i<200;i++)mouse(Math.sin(i),Math.cos(i));mouse(1,0);expectIntro(1.3);
const held=intro.currentTime;advance();assert.equal(intro.currentTime,held,'stationary pointer must hold frame');
up();assert.equal(intro.currentTime,held,'release must not jump immediately');mouse(-1,0,0);expectIntro(0);
down(0,-1);up();expectIntro(0); // Return is based on current frame, not the unrendered pointer target.
down(0,-1);advance(200);up();const released=intro.currentTime;
assert.ok(released>0&&released<.3,'release test must start during an in-progress turn');
assert.equal(intro.dataset.returning,'true');mouse(1,0,0);expectIntro(0);
down(0,1);expectIntro(7);seekStart=intro.seeks.length;up();
assert.equal(intro.currentTime,7,'nearest end return must not jump immediately');
root.emit('pointerleave');advance(1000);
assert.ok(intro.currentTime>7&&intro.currentTime<=8,'return should continue slowly even after unheld pointer leaves');
expectIntro(239/24);
assert.ok(intro.seeks.slice(seekStart).every((t,i,a)=>Math.abs(t-(i?a[i-1]:7))<=1/24+1e-6),'return-to-end must use every intervening frame');
// Pressing again interrupts the return and follows from the current visible pose.
down(1,0);expectIntro(1.3);up();advance(300);const interrupted=intro.currentTime;
down(0,-1);assert.equal(intro.currentTime,interrupted);expectIntro(3);
window.emit('blur');
down(0,1);expectIntro(7);root.emit('pointerleave');mouse(-1,0);expectIntro(7);
down(1,0);expectIntro(1.3);window.emit('blur');mouse(-1,0);expectIntro(1.3);
surface.emit('keydown',{key:'Home',preventDefault(){}});expectIntro(0);
for(let i=0;i<4;i++)surface.emit('keydown',{key:'ArrowLeft',preventDefault(){}});expectIntro(5);
surface.emit('keydown',{key:'Home',preventDefault(){}});expectIntro(0);
down(0,-1,{pointerType:'touch',pointerId:2});expectIntro(3);assert.equal(surface.capture,2);
window.emit('pointermove',pointer(-1,0,1,{pointerType:'touch',pointerId:3}));expectIntro(3);
window.emit('pointercancel',pointer(0,0,0,{pointerType:'touch',pointerId:2}));assert.equal(surface.capture,null);
down(1,0);expectIntro(1.3);mouse(-1,0,0);expectIntro(0); // Missed pointerup also returns to nearest endpoint.
reduced.matches=true;reduced.emit('change');down(0,-1);expectIntro(3);
reduced.matches=false;reduced.emit('change');
const expectedIntroWidth=Math.min(1440*.72*.78,900*.64*.78*1280/720);
assert.ok(Math.abs(parseFloat(main.style.width)-expectedIntroWidth)<.001,'opening story scale must match intro contain scale');
window.scrollTo({top:1});advance();assert.ok(Math.abs(parseFloat(main.style.width)-expectedIntroWidth)<.001);
assert.ok(Math.abs(parseFloat(get('main-window').style.top)-900*.52)<.001,'opening story must preserve intro center');
window.scrollTo({top:4050});advance();assert.equal(body.dataset.mode,'main');assert.ok(Math.abs(main.currentTime-5)<.01&&main.paused);
assert.ok(Math.abs(parseFloat(main.style.width)-1600)<.001,'later story must expand to full cover size');
const introHeld=intro.currentTime;mouse(1,0);advance();assert.equal(intro.currentTime,introHeld,'pointer must not interfere with story video');
window.scrollTo({top:8100});advance();assert.equal(body.dataset.mode,'outro');assert.equal(outro.paused,false);
window.scrollTo({top:0});advance();mouse(1,0);expectIntro(introHeld);assert.equal(body.dataset.mode,'intro');assert.equal(outro.paused,true);
Object.assign(window,{innerWidth:390,innerHeight:844});context.innerWidth=390;context.innerHeight=844;window.emit('resize');advance();
assert.ok(Math.abs(parseFloat(main.style.width)-390*1.12*.78)<.001,'phone opening story scale must match intro');
assert.ok(Math.abs(parseFloat(get('main-window').style.top)-844*.49)<.001);
document.hidden=true;document.emit('visibilitychange');assert.equal(raf.size,0,'background tab must not retain a render loop');
document.hidden=false;document.emit('visibilitychange');advance();
intro.emit('error');assert.equal(intro.src,'assets/videos/首屏视频.mp4');assert.equal(intro.loads,1);
intro.emit('loadeddata');down(-1,0);expectIntro(5);
intro.emit('error');assert.equal(get('media-status').hidden,false);assert.ok(statusText.textContent.includes('首屏视频'));
console.log('PASS: adjacent-frame delayed follow, natural speed cap, nearest-endpoint slow return/resume, left-button gating, touch, keyboard, single pending seek, responsive handoff scale, scroll/outro and media fallback.');
