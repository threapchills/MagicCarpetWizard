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
    source += '\nexport const snapshot = () => ({ state, distance: run.distance, altitude: run.altitude, tricks: run.tricks, shots: bullets.length, chunks: chunks.size, particles: particles.length, hp: run.hp, weapon: run.weapon, boss: !!battle.boss, bossAge: battle.boss?.age, arenaClear: [...chunks.values()].every(c => c.combatClear), buff: run.buffs.rapid });';
    source += '\nexport const enterBoss = () => { run.distance = 1400; run.invulnerable = 999; run.buffs.rapid = 10; ensureChunks(run.distance, run.seed); };';
    source += '\nexport const raceSnapshot = () => ({ state, player: raceAttempt?.player, elapsed: raceAttempt?.elapsed, countdown: raceAttempt?.countdown, ghost: !!raceAttempt?.ghost, seed: raceAttempt?.course.seed, gates: raceView.gates.length, next: raceAttempt?.nextGate, records: raceRecords.get(raceLevel).best.map(b => b?.time), racing: document.body.classList.contains("racing") });';
    source += '\nexport const approachNextGate = () => { const g = raceAttempt.course.gates[raceAttempt.nextGate]; Object.assign(run, { distance: g.s - .1, x: g.x, altitude: g.y, vx: 0, vy: 0 }); };';
    const { snapshot, enterBoss, raceSnapshot, approachNextGate } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
    advance(.1); assert.equal(snapshot().state, 'menu');
    dispatch('keydown', { code: 'Enter', target: { tagName: 'BUTTON' } }); assert.equal(snapshot().state, 'menu');
    elements.get('start').onclick(); dispatch('keydown', { code: 'KeyW' }); advance(2.1); dispatch('keyup', { code: 'KeyW' });
    assert.equal(snapshot().state, 'playing'); assert.ok(snapshot().altitude > 20); assert.ok(snapshot().distance > 45);
    const highAltitude = snapshot().altitude;
    dispatch('keydown', { code: 'KeyS' }); advance(.4); dispatch('keyup', { code: 'KeyS' }); assert.ok(snapshot().altitude < highAltitude);
    const lowAltitude = snapshot().altitude;
    dispatch('keydown', { code: 'KeyW' }); advance(.7); dispatch('keyup', { code: 'KeyW' }); assert.ok(snapshot().altitude > lowAltitude);
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
    dispatch('keydown', { code: 'Digit2' }); assert.equal(snapshot().weapon, 'storm');
    dispatch('keydown', { code: 'Digit3' }); assert.equal(snapshot().weapon, 'wind');
    dispatch('keydown', { code: 'KeyQ' }); assert.equal(snapshot().weapon, 'fire');
    enterBoss(); advance(.2); assert.equal(snapshot().boss, true); assert.equal(snapshot().arenaClear, true); assert.equal(elements.get('boss-hud').hidden, false);
    elements.get('pause').onclick(); const bossAge = snapshot().bossAge, buff = snapshot().buff; advance(2);
    assert.equal(snapshot().bossAge, bossAge); assert.equal(snapshot().buff, buff);
    elements.get('resume').onclick(); advance(2); assert.ok(snapshot().bossAge > bossAge);
    elements.get('pause').onclick(); elements.get('pause-restart').onclick();
    assert.equal(snapshot().boss, false); assert.equal(snapshot().arenaClear, false); assert.equal(snapshot().buff, 0); assert.equal(elements.get('boss-hud').hidden, true);
    advance(.1); assert.ok(renders > 1000);
    elements.get('pause').onclick(); elements.get('pause-menu').onclick(); elements.get('race-button').onclick();
    assert.equal(raceSnapshot().state, 'race-setup'); assert.equal(elements.get('race-setup').hidden, false);
    elements.get('race-hard').onclick(); elements.get('race-start').onclick();
    assert.equal(raceSnapshot().player, 0); assert.equal(raceSnapshot().ghost, false); assert.equal(raceSnapshot().racing, true); assert.equal(raceSnapshot().gates, 8);
    const seed = raceSnapshot().seed; advance(1); assert.equal(snapshot().distance, 0); assert.equal(raceSnapshot().elapsed, 0);
    elements.get('pause').onclick(); const countdown = raceSnapshot().countdown; advance(1); assert.equal(raceSnapshot().countdown, countdown);
    elements.get('resume').onclick(); advance(2.2); assert.ok(raceSnapshot().elapsed > 0);
    elements.get('world').pointerdown({ button: 0, pointerId: 8, preventDefault() {} }); advance(.1); assert.ok(snapshot().shots > 0); assert.equal(elements.get('crosshair').hidden, false); dispatch('pointerup');
    elements.get('pause').onclick(); const raceTime = raceSnapshot().elapsed; advance(.5); assert.equal(raceSnapshot().elapsed, raceTime);
    elements.get('pause-restart').onclick(); assert.equal(raceSnapshot().seed, seed); assert.equal(raceSnapshot().elapsed, 0); assert.equal(raceSnapshot().player, 0);
    advance(3.1);
    for (let i = 0; i < 8; i++) { approachNextGate(); advance(.03); }
    assert.equal(raceSnapshot().state, 'race-ended'); assert.equal(elements.get('race-results').hidden, false); assert.ok(raceSnapshot().records[0] > 0); assert.equal(snapshot().boss, false);
    elements.get('race-next').onclick(); assert.equal(raceSnapshot().player, 1); assert.equal(raceSnapshot().seed, seed); assert.equal(raceSnapshot().ghost, true);
    advance(3.2); for (let i = 0; i < 8; i++) { approachNextGate(); advance(.03); }
    assert.equal(raceSnapshot().state, 'race-ended'); assert.ok(raceSnapshot().records[1] > 0);
    elements.get('race-next').onclick(); assert.equal(raceSnapshot().player, 0); assert.equal(raceSnapshot().ghost, true);
    advance(3.1); const savedTimes = raceSnapshot().records;
    dispatch('keydown', { code: 'KeyR' });
    assert.equal(raceSnapshot().player, 0); assert.equal(raceSnapshot().seed, seed); assert.equal(raceSnapshot().elapsed, 0);
    assert.equal(raceSnapshot().countdown, 3); assert.deepEqual(raceSnapshot().records, savedTimes); assert.equal(snapshot().shots, 0);
    advance(.2); const retryCountdown = raceSnapshot().countdown;
    dispatch('keydown', { code: 'KeyR', repeat: true }); assert.equal(raceSnapshot().countdown, retryCountdown);
    dispatch('keyup', { code: 'KeyR' });
    elements.get('pause').onclick(); elements.get('pause-menu').onclick(); assert.equal(raceSnapshot().state, 'race-setup');
    elements.get('race-new').onclick(); assert.deepEqual(raceSnapshot().records, [undefined, undefined]);
    elements.get('race-back').onclick(); elements.get('start').onclick(); advance(.1);
    assert.equal(raceSnapshot().racing, false); assert.equal(raceSnapshot().gates, 0); assert.equal(snapshot().state, 'playing'); assert.equal(snapshot().hp, 3);
  } finally {
    for (const [key, descriptor] of oldGlobals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});
