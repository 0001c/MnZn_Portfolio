const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../../assets/intro-depth.js'), 'utf8');
function setup({available = true, uploadError = false} = {}) {
  const stats = {uploads: 0, draws: 0, wakes: 0};
  const gl = new Proxy({
    getShaderParameter: () => true, getProgramParameter: () => true,
    getError: () => 0, isContextLost: () => false, getExtension: () => null,
    createTexture: () => ({}), createShader: () => ({}), createProgram: () => ({}),
    texImage2D(...args) { if (args.length === 6) { stats.uploads++; if (uploadError) throw Object.assign(new Error(), {name:'SecurityError'}); } },
    drawArrays() { stats.draws++; }
  }, {get: (target, key) => key in target ? target[key] : /^[A-Z_]+$/.test(key) ? 0 : () => ({})});
  const element = () => ({dataset:{},style:{},listeners:{},addEventListener(type,fn) { this.listeners[type]=fn; }});
  const canvas = element(); canvas.getContext = () => available ? gl : null;
  const video = Object.assign(element(), {readyState:4,seeking:false,videoWidth:1280,videoHeight:720,currentTime:0});
  const surface = element(); surface.getBoundingClientRect = () => ({width:800,height:440});
  const window = element(); window.devicePixelRatio=2;
  vm.runInNewContext(source, {window,Math,Uint8Array,Float32Array,Object,Error});
  const renderer = window.createIntroDepth(canvas,video,surface,() => stats.wakes++);
  return {renderer,canvas,video,surface,stats};
}
const scene = setup();
scene.renderer.render(16,true,false);
assert.equal(scene.surface.dataset.depth,'ready');
assert.equal(scene.stats.uploads,1);
assert.ok(Math.abs(scene.canvas.width - scene.canvas.height * 1280/720) <= 1,'integer buffer rounding must stay within one source-aspect pixel');
const initialDraws=scene.stats.draws;
scene.renderer.render(16,true,false);
assert.equal(scene.stats.draws,initialDraws,'resting portrait must not keep drawing');
scene.renderer.setTarget(1,-1);
assert.equal(scene.renderer.render(16,true,false),true);
assert.ok(Number(scene.canvas.dataset.tiltX)>0 && Number(scene.canvas.dataset.tiltX)<1,'tilt should ease toward target');
assert.equal(scene.stats.uploads,1,'pointer-only changes must reuse the decoded video texture');
scene.video.currentTime=1/24;scene.video.seeking=true;
scene.renderer.render(16,true,false);
assert.equal(scene.stats.uploads,1,'never upload an undecoded seek');
scene.video.seeking=false;scene.video.listeners.seeked();scene.renderer.render(16,true,false);
assert.equal(scene.stats.uploads,2);assert.equal(scene.canvas.dataset.sourceTime,'0.0417');
scene.renderer.setTarget(0,0);
for(let i=0;i<100;i++)scene.renderer.render(16,true,false);
assert.equal(scene.canvas.dataset.tiltX,'0.0000');assert.equal(scene.canvas.dataset.tiltY,'0.0000');
scene.renderer.render(16,true,true);assert.equal(scene.surface.dataset.depth,'reduced-motion');
scene.renderer.render(16,false,false);assert.equal(scene.surface.dataset.depth,'inactive');
scene.renderer.render(16,true,false);assert.equal(scene.surface.dataset.depth,'ready');
scene.canvas.listeners.webglcontextlost({preventDefault(){}});
assert.equal(scene.surface.dataset.depth,'fallback');assert.equal(scene.renderer.render(16,true,false),false);
scene.canvas.listeners.webglcontextrestored();scene.renderer.render(16,true,false);
assert.equal(scene.surface.dataset.depth,'ready','restored WebGL context must redraw');
for(const options of [{available:false},{uploadError:true}]) {
  const fallback=setup(options);fallback.renderer.render(16,true,false);
  assert.equal(fallback.surface.dataset.depth,'fallback');
  assert.equal(fallback.renderer.render(16,true,false),false,'fallback must not create an animation loop');
}
console.log('PASS: depth easing, idle rendering, decoded texture reuse, source aspect ratio, reduced motion, context recovery and video fallback.');
