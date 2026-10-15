const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
let clock = 0, id = 0;
const raf = new Map(), timers = new Map(), decodes = [];
class Element {
  constructor() {
    this.dataset = {}; this.listeners = {}; this.props = {}; this.attrs = {}; this.hidden = false;
    this.style = { setProperty: (key, value) => { this.props[key] = value; } };
    this.classList = { add() {}, toggle() {} };
    this.draws = [];
  }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  emit(type, event = {}) { for (const fn of this.listeners[type] ?? []) fn(event); }
  setAttribute(key, value) { this.attrs[key] = value; }
  removeAttribute(key) { delete this.attrs[key]; }
  hasAttribute(key) { return Object.hasOwn(this.attrs, key); }
  closest() { return null; }
  contains(target) { return target === this; }
  hasPointerCapture() { return false; }
  getContext() { return {
    clearRect() { this.owner.draws.length = 0; }, owner: this,
    drawImage: (...args) => this.draws.push(args)
  }; }
}
class Video extends Element {
  constructor() { super(); this.duration = 10; this._time = 0; this.paused = true; this.seeking = false; this.readyState = 4; this.loads = 0; this.loop = false; }
  get currentTime() { return this._time; }
  set currentTime(value) {
    assert.ok(!this.seeking, 'a video must have at most one pending seek');
    assert.ok(value >= 0 && value < this.duration);
    this._time = value; this.seeking = true;
    decodes.push({ video: this, due: clock + 40 });
  }
  pause() { this.paused = true; }
  play() { this.paused = false; this.emit('play'); return Promise.resolve(); }
  load() { this.loads++; this._time = 0; }
}
const elements = new Map(), surfaces = [];
const get = name => {
  if (!elements.has(name)) elements.set(name, name.endsWith('-video') ? new Video() : new Element());
  return elements.get(name);
};
const root = new Element(), body = new Element(), surface = new Element(), window = new Element();
Object.assign(window, { innerWidth: 1440, innerHeight: 900, scrollY: 0 });
surface.getBoundingClientRect = () => {
  const width = parseFloat(root.props['--ellipse-width']) * .78;
  const height = parseFloat(root.props['--ellipse-height']) * .78;
  const stacked = window.innerWidth <= 600 || (window.innerWidth <= 900 && window.innerHeight > window.innerWidth);
  return { width, height, left: window.innerWidth / 2 - width / 2, top: window.innerHeight * (stacked ? .49 : .52) - height / 2 };
};
get('media-status').querySelector = selector => get('status-' + selector);
Object.defineProperty(get('scroll-track'), 'offsetHeight', { get: () => parseFloat(get('scroll-track').style.height) });
const chapters = Array.from({ length: 3 }, () => new Element());
const nav = [...html.matchAll(/<a href="#chapter-\d" data-jump="([\d.]+)"/g)].map(match => {
  const el = new Element(); el.dataset.jump = match[1]; return el;
});
const document = { body, documentElement: root, hidden: false, listeners: {},
  getElementById: get,
  createElement() { const el = new Element(); surfaces.push(el); return el; },
  querySelector: selector => selector === '.intro-window' ? surface : get(selector),
  querySelectorAll: selector => selector === '.chapter' ? chapters : selector === '.nav a' ? nav : nav,
  addEventListener: Element.prototype.addEventListener, emit: Element.prototype.emit
};
window.scrollTo = ({ top }) => { window.scrollY = top; window.emit('scroll'); };
const reduced = new Element(); reduced.matches = false;
class Image {
  constructor() { this.naturalWidth = 3840; this.naturalHeight = 2160; }
  set src(value) { this.onload(); }
}
const context = { document, window, Image, Math, Number, Object, String, innerWidth: 1440, innerHeight: 900,
  performance: { now: () => clock }, matchMedia: () => reduced,
  requestAnimationFrame: fn => { raf.set(++id, fn); return id; }, cancelAnimationFrame: key => raf.delete(key),
  setTimeout: (fn, delay) => { timers.set(++id, { fn, due: clock + delay }); return id; }, clearTimeout: key => timers.delete(key) };
window.setTimeout = context.setTimeout;
vm.runInNewContext(script, context);
assert.doesNotMatch(html, /id="intro-video"|首屏视频(?:-pointer)?\.mp4/, 'intro must not load a fallback video');
const main = get('main-video'), outro = get('outro-video'), work = get('work-video');
outro.dataset.src = html.match(/id="outro-video" data-src="([^"]+)"/)[1];
work.dataset.src = html.match(/id="work-video" data-src="([^"]+)"/)[1];
assert.equal(outro.src, undefined, 'third-page video must have no src on initial entry');
assert.equal(outro.loads, 0, 'third-page video must not load before biography');
assert.doesNotMatch(html.match(/<video[^>]*id="outro-video"[^>]*>/)[0], /\b(autoplay|loop)\b/);
main.emit('loadedmetadata'); main.emit('loadeddata'); outro.emit('loadedmetadata'); outro.emit('loadeddata'); work.emit('loadedmetadata'); work.emit('loadeddata');
function advance(ms = 1000) {
  const end = clock + ms;
  while (clock < end) {
    clock += 10;
    for (let i = decodes.length - 1; i >= 0; i--) if (decodes[i].due <= clock) {
      const { video } = decodes.splice(i, 1)[0]; video.seeking = false; video.emit('seeked');
    }
    for (const [key, timer] of [...timers]) if (timer.due <= clock) { timers.delete(key); timer.fn(); }
    const callbacks = [...raf.values()]; raf.clear(); callbacks.forEach(fn => fn(clock));
  }
}
const maxScroll = () => get('scroll-track').offsetHeight - window.innerHeight;
const sourceTime = storyTime => storyTime / 6.7 * 10;
function scrub(top) {
  window.scrollTo({ top });
  for (let i = 0; i < 10; i++) { advance(70); window.emit('scroll'); }
  advance(40);
}
advance();
nav[2].emit('click', { preventDefault() {} });
main.emit('loadedmetadata'); advance();
assert.ok(outro.currentTime < 1.2, 'one second after entry must not fast-forward the ten-second action');
assert.equal(work.paused, true, 'working loop waits for the complete action');
window.emit('wheel', { deltaY: -120, deltaX: 0, preventDefault() {} }); advance(2000);
assert.ok(Math.abs(window.scrollY / maxScroll() - .35) < .00001, 'upward return interrupts normal-speed completion and remains on chapter two');
nav[2].emit('click', { preventDefault() {} }); advance(12000);
assert.ok(Math.abs(window.scrollY / maxScroll() - 1) < .00001, 'third-page navigation must complete to the working pose after idle');
assert.equal(body.dataset.mode, 'outro');
window.scrollTo({ top: 0 }); advance();
window.scrollTo({ top: 120 }); advance(100);
assert.ok(main.currentTime < sourceTime(3.5), 'continuous scrolling must retain the scrubbed transition');
window.scrollTo({ top: 180 }); advance(100);
assert.equal(window.scrollY, 180, 'each scroll event must postpone the idle snap');
advance();
assert.ok(Math.abs(main.currentTime - sourceTime(3.5)) < .003, 'stopping a small downward scroll must reach chapter two');
assert.equal(get('main-window').style.clipPath, 'none');
window.scrollTo({ top: 2 / 10 * maxScroll() }); advance();
assert.ok(Math.abs(main.currentTime - sourceTime(2)) < .003, 'reverse scrolling must remain freely seekable');
window.scrollTo({ top: 0 }); advance();
window.scrollTo({ top: 100 }); advance(80);
window.scrollTo({ top: 0 }); advance();
assert.equal(window.scrollY, 0, 'returning to the intro must cancel an armed downward snap');
window.scrollTo({ top: .6 * maxScroll() }); advance();
assert.ok(Math.abs(main.currentTime - sourceTime(6)) < .003, 'scrolling beyond chapter two must not snap backwards');
window.scrollTo({ top: 0 }); advance();
window.scrollTo({ top: 120 }); advance(80);
main.emit('loadedmetadata'); advance();
assert.ok(Math.abs(main.currentTime - sourceTime(3.5)) < .003, 'metadata relayout must not cancel a requested intro completion');
window.scrollTo({ top: 0 }); advance();
assert.equal(surfaces.length, 9, 'all nine original poses must load');
const poseNames = ['upLeft','up','upRight','left','center','right','downLeft','down','downRight'];
for (const [x, y, name] of [[0,0,'center'],[-1,-1,'upLeft'],[0,-1,'up'],[1,-1,'upRight'],[-1,0,'left'],[1,0,'right'],[-1,1,'downLeft'],[0,1,'down'],[1,1,'downRight'],[.38,.38,null]]) {
  window.emit('pointermove', { pointerType:'mouse', clientX:window.innerWidth / 2 + x * window.innerWidth * .38, clientY:window.innerHeight * .52 + y * window.innerHeight * .38 }); advance();
  const base = get('intro-canvas').draws;
  if (name) {
    assert.equal(base.length, 1, 'a settled direction must render a single original pose');
    assert.equal(base[0][0], surfaces[poseNames.indexOf(name)]);
  } else assert.ok(base.length > 1, 'the transition must preserve directional blending');
}
window.emit('pointermove', { pointerType:'mouse', clientX:window.innerWidth / 2, clientY:window.innerHeight * .52 }); advance();
const centerDraw = surfaces[4].draws[0];
assert.equal(centerDraw[2], 720 + 16, 'embedded top bar must be cropped');
assert.equal(centerDraw[4], 688, 'embedded bottom bar must be cropped');
assert.ok(Math.abs(centerDraw[7] / centerDraw[8] - centerDraw[3] / centerDraw[4]) < 1e-10, 'face proportions must be preserved');
for (const [width, height] of [[1440, 900], [390, 844], [768, 1024], [720, 450]]) {
  Object.assign(window, { innerWidth: width, innerHeight: height });
  Object.assign(context, { innerWidth: width, innerHeight: height });
  root.clientWidth = width; window.emit('resize'); advance();
  const rect = surface.getBoundingClientRect();
  assert.ok(Math.abs(rect.width / rect.height - 16 / 9) < 1e-10, 'intro must remain a wide ellipse');
  nav[1].emit('click', { preventDefault() {} }); advance();
  assert.equal(body.dataset.mode, 'main');
  assert.ok(Math.abs(main.currentTime - sourceTime(3.5)) < .003);
  assert.equal(get('main-window').style.clipPath, 'none');
  assert.equal(parseFloat(get('main-window').style.width), width);
  assert.equal(parseFloat(get('main-window').style.height), height);
  window.scrollTo({ top: .665 * maxScroll() }); advance();
  assert.equal(body.dataset.mode, 'main', 'chapter two must retain the main video until the third-page boundary');
  const renderedScale = parseFloat(main.style.width) / Math.max(width, height * 16 / 9);
  assert.ok(Math.abs(renderedScale - 1.045470953) < 1e-8, 'end frame must use the measured uniform calibration');
  nav[2].emit('click', { preventDefault() {} }); advance(12000);
  assert.equal(body.dataset.mode, 'outro', 'third-page navigation must immediately use the independent third-page video');
  assert.ok(main.currentTime > 9.95, 'the complete main video must reach its final frame before the third page');
  assert.equal(outro.src, 'assets/videos/尾部视频-scroll.mp4'); assert.equal(outro.loop, false);
  assert.ok(outro.currentTime > 9.95 && outro.paused, 'third-page navigation must complete the sitting action');
  assert.equal(work.paused, false, 'the working clip must play after completion');
  assert.equal(work.loop, true);
  let prevented = false;
  window.emit('wheel', { deltaY: -120, deltaX: 0, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.ok(Math.abs(window.scrollY / maxScroll() - .35) < .00001, 'upward wheel from page three must jump directly to biography start');
  advance();
  assert.equal(body.dataset.mode, 'main'); assert.equal(work.paused, true);
  assert.ok(Math.abs(main.currentTime - sourceTime(3.5)) < .003);
  nav[2].emit('click', { preventDefault() {} }); advance(12000);
  get('work-detail').open = true;
  prevented = false;
  window.emit('wheel', { deltaY: -120, deltaX: 0, preventDefault() { prevented = true; } });
  assert.equal(prevented, false, 'detail dialog must retain its own scrolling');
  assert.equal(window.scrollY, maxScroll());
  get('work-detail').open = false;
  window.emit('touchstart', { touches: [{ clientY: 200 }] });
  window.emit('touchmove', { touches: [{ clientY: 240 }], preventDefault() {} });
  window.emit('touchend'); advance();
  assert.ok(Math.abs(window.scrollY / maxScroll() - .35) < .00001, 'touch scrolling toward page two must jump directly');
  nav[2].emit('click', { preventDefault() {} }); advance(12000);
  window.emit('keydown', { key: 'PageUp', target: new Element(), preventDefault() {} }); advance();
  assert.ok(Math.abs(window.scrollY / maxScroll() - .35) < .00001, 'PageUp must return to biography');
  nav[2].emit('click', { preventDefault() {} }); advance(12000);
  const entryLoads = outro.loads;
  outro.readyState = 1; window.emit('scroll'); advance();
  assert.equal(body.dataset.mode, 'outro', 'loading after entry must not exit or reload the third-page video');
  assert.equal(outro.loads, entryLoads);
  outro.readyState = 4;
  outro.emit('loadeddata'); assert.equal(outro.paused, true);
  scrub(.835 * maxScroll());
  assert.ok(Math.abs(outro.currentTime - 5) < .003 && outro.paused, 'halfway through page three must show source time five');
  assert.equal(work.paused, true, 'scrubbing must pause the ambient work loop');
  advance(2000);
  assert.ok(outro.currentTime > 6.5 && outro.currentTime < 7.3, 'two seconds idle must advance the remaining action at about normal speed');
  assert.equal(work.paused, true);
  advance(5000);
  assert.ok(outro.currentTime > 9.95, 'idle must complete a partial pose instead of freezing it');
  assert.equal(work.paused, false);
  assert.equal(raf.size, 0, 'native video playback must not require an idle render loop');
  scrub(.7525 * maxScroll());
  assert.ok(Math.abs(outro.currentTime - 2.5) < .003, 'reverse scrolling must scrub the third-page video backwards');
  window.scrollTo({ top: maxScroll() }); advance();
  assert.ok(Math.abs(outro.currentTime - 9.999) < .003 && outro.paused, 'the scrub video must hold its calibrated final frame underneath the loop');
  assert.equal(work.paused, false);
  outro.emit('ended'); assert.equal(outro.src, 'assets/videos/尾部视频-scroll.mp4');
  outro.play(); assert.equal(outro.paused, true, 'unexpected playback must be paused');
  assert.equal(outro.loads, entryLoads, 'scrolling within page three must not reload its media');
  window.scrollTo({ top: .5 * maxScroll() }); advance();
  assert.equal(outro.paused, true); assert.equal(main.paused, true); assert.equal(work.paused, true);
  assert.ok(outro.currentTime < .003, 'leaving page three must prepare the calibrated first-frame handoff');
  scrub(.8 * maxScroll());
  assert.ok(Math.abs(outro.currentTime - (8 - 6.7) / 3.3 * 10) < .003, 're-entry must follow scroll progress');
  assert.equal(outro.src, 'assets/videos/尾部视频-scroll.mp4'); assert.equal(outro.loop, false); assert.equal(outro.loads, entryLoads);
  window.scrollTo({ top: 0 }); advance();
}
window.scrollTo({ top: .835 * maxScroll() }); advance(); outro.emit('error');
assert.equal(outro.src, 'assets/videos/尾部视频.mp4', 'missing scroll copy must fall back to the original third-page video');
outro.emit('loadedmetadata'); outro.emit('loadeddata'); scrub(.835 * maxScroll()); assert.ok(Math.abs(outro.currentTime - 5) < .003 && outro.paused);
reduced.matches = true; reduced.emit('change'); assert.equal(outro.paused, true);
scrub(.7525 * maxScroll()); assert.ok(Math.abs(outro.currentTime - 2.5) < .003);
advance(); assert.ok(outro.currentTime > 9.95); assert.equal(work.paused, true, 'reduced motion must preserve a static working pose');
reduced.matches = false; reduced.emit('change'); advance(); assert.equal(work.paused, false);
work.emit('error'); assert.equal(work.src, 'assets/videos/尾部视频.mp4'); work.emit('loadedmetadata'); work.emit('loadeddata'); advance(); assert.ok(Math.abs(work.currentTime - 6) < .003); assert.equal(work.loop, false);
work.emit('ended'); advance(); assert.ok(Math.abs(work.currentTime - 6) < .003 && !work.paused, 'fallback work clip must loop only the sitting segment');
nav[1].emit('click', { preventDefault() {} }); advance();
nav[2].emit('click', { preventDefault() {} }); advance(80);
reduced.matches = true; reduced.emit('change'); advance();
assert.equal(window.scrollY, maxScroll(), 'enabling reduced motion during the idle delay must still complete the working pose');
assert.equal(work.paused, true);
reduced.matches = false; reduced.emit('change'); advance();
outro.emit('error'); assert.equal(get('media-status').hidden, false); assert.ok(get('status-span').textContent.includes('第三屏'));
document.hidden = true; document.emit('visibilitychange'); assert.equal(raf.size, 0); assert.equal(work.paused, true);
main.emit('error'); assert.equal(main.src, 'assets/videos/主视频.mp4');
console.log('PASS: gaze, proportional layout, main scrub and handoff, normal-speed third-page completion, upward interruption and wheel/touch/keyboard return, dialog scrolling, working loop and fallback, single pending seek, reduced motion and hidden pause.');
