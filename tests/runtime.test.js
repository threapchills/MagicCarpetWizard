import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Exercise the actual application loop with real Three.js scene objects.
// Only the GPU, browser events and DOM surface are replaced; this is not a visual test.
test('application boots, flies, casts, rolls once per press, pauses, resumes and restarts', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const listeners = new Map(), elements = new Map();
  function element() {
    const classes = new Set(), children = new Map();
    return { hidden: false, textContent: '', innerHTML: '', style: { setProperty() {} },
      classList: { add(...xs) { xs.forEach(x => classes.add(x)); }, remove(...xs) { xs.forEach(x => classes.delete(x)); }, toggle(x, on = !classes.has(x)) { on ? classes.add(x) : classes.delete(x); }, contains(x) { return classes.has(x); } },
      setAttribute() {}, replaceChildren() {}, append() {}, focus() {}, click() { this.onclick?.(); }, setPointerCapture(id) { this.capturedPointer = id; },
      querySelector(s) { if (!children.has(s)) children.set(s, element()); return children.get(s); },
      addEventListener(type, fn) { this[type] = fn; },
    };
  }
  for (const match of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g)) { const e = element(); e.hidden = /\bhidden\b/.test(match[0]); elements.set(match[1], e); }
  const addListener = (type, fn) => { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); };
  const dispatch = (type, data = {}) => { for (const fn of listeners.get(type) || []) fn({ preventDefault() {}, repeat: false, ...data }); };
  const oldGlobals = new Map();
  const install = (key, value) => { oldGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }); };
  let callback, renders = 0;
  class FakeRenderer {
    constructor() { this.shadowMap = {}; }
    setPixelRatio() {} setSize() {}
    getDrawingBufferSize(size) { return size.set(1440, 900); }
    setRenderTarget() {}
    render(scene, camera) { scene.updateMatrixWorld(); camera.updateMatrixWorld(); renders++; }
  }
  install('__TestRenderer', FakeRenderer);
  install('window', { addEventListener: addListener });
  install('document', { body: element(), hidden: false, addEventListener: addListener, getElementById: id => elements.get(id), createElement: element });
  install('localStorage', { getItem() { return null; }, setItem() {} });
  install('devicePixelRatio', 1); install('innerWidth', 1440); install('innerHeight', 900);
  install('requestAnimationFrame', cb => { callback = cb; });
  install('setTimeout', cb => { cb(); return 0; });
  let now = performance.now();
  const advance = (seconds, hz = 60) => { for (let i = 0; i < Math.round(seconds * hz); i++) { now += 1000 / hz; callback(now); } };
  try {
    let source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
    source = source.replace(/^import '\.\/[^']+\.css';\r?\n/gm, '')
      .replace("from 'three'", `from '${import.meta.resolve('three')}'`)
      .replace(/from '(\.\/[^']+)'/g, (_, path) => `from '${new URL('../src/' + path.slice(2), import.meta.url).href}'`)
      .replace('new THREE.WebGLRenderer(', 'new globalThis.__TestRenderer(');
    source += '\nexport const snapshot = () => ({ state, distance: run.distance, altitude: run.altitude, tricks: run.tricks, shots: bullets.length, chunks: chunks.size, particles: particles.length, hp: run.hp });';
    const { snapshot } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
    advance(.1); assert.equal(snapshot().state, 'menu');
    elements.get('start').onclick(); dispatch('keydown', { code: 'KeyW' }); advance(2.1); dispatch('keyup', { code: 'KeyW' });
    assert.equal(snapshot().state, 'playing'); assert.ok(snapshot().altitude > 20); assert.ok(snapshot().distance > 45);
    const highAltitude = snapshot().altitude;
    dispatch('keydown', { code: 'KeyS' }); advance(.4); dispatch('keyup', { code: 'KeyS' }); assert.ok(snapshot().altitude < highAltitude);
    dispatch('keydown', { code: 'KeyW' }); advance(.7); dispatch('keyup', { code: 'KeyW' }); assert.ok(snapshot().altitude > highAltitude);
    dispatch('keydown', { code: 'Space' }); advance(3); assert.equal(snapshot().tricks, 1);
    dispatch('keyup', { code: 'Space' });
    let prevented = false;
    elements.get('world').pointerdown({ button: 0, pointerId: 7, preventDefault() { prevented = true; } }); advance(.8); assert.ok(snapshot().shots > 0); assert.equal(prevented, true); assert.equal(elements.get('world').capturedPointer, 7); dispatch('pointerup');
    let selectionBlocked = false; dispatch('selectstart', { preventDefault() { selectionBlocked = true; } }); assert.equal(selectionBlocked, true);
    assert.equal(elements.get('crosshair').hidden, false);
    elements.get('pause').onclick(); const distance = snapshot().distance; advance(2); assert.equal(snapshot().distance, distance);
    elements.get('resume').onclick(); advance(.5); assert.ok(snapshot().distance > distance);
    elements.get('help-button').onclick(); elements.get('help-button').onclick(); advance(.5); assert.equal(snapshot().state, 'paused');
    elements.get('close-help').onclick(); assert.equal(snapshot().state, 'playing');
    // Several streamed chunks at different presentation rates; flight remains active and bounded.
    advance(9, 30); advance(9, 144); if (snapshot().state === 'dying') advance(1);
    assert.ok(['playing', 'ended'].includes(snapshot().state)); assert.ok(snapshot().chunks <= 11); assert.ok(snapshot().particles <= 240);
    if (snapshot().state === 'ended') { assert.equal(elements.get('end-screen').hidden, false); elements.get('restart').onclick(); }
    dispatch('blur'); assert.equal(snapshot().state, 'paused');
    elements.get('pause-restart').onclick(); assert.equal(snapshot().state, 'playing'); assert.equal(snapshot().distance, 0); assert.equal(snapshot().hp, 3); assert.equal(snapshot().shots, 0);
    advance(.1); assert.ok(renders > 1000);
  } finally {
    for (const [key, descriptor] of oldGlobals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});
