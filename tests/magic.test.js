import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MagicField } from '../src/magic.js';
import { InkRenderer } from '../src/ink.js';
import { createRun, RADIUS } from '../src/game.js';

test('magic effects bound particles, retain four lights, expire and clear on restart', () => {
  const scene = new THREE.Scene(), magic = new MagicField(scene, 1.65), run = createRun();
  const initialObjects = scene.children.length;
  for (let i = 0; i < 100; i++) magic.burst(5, 12, 70, '#ff8833', 15);
  assert.equal(magic.sparks.length, 384); assert.equal(magic.flashes.length, 8);
  magic.cast({ x: 0, y: 4, s: 2 }, 'storm');
  magic.update(.01, .01, 0, run, [], { night: .8 }, true);
  assert.ok(magic.lights[0].intensity > 0 && magic.lights[3].intensity > 0); assert.equal(magic.aura.visible, true);
  const lifetime = magic.sparks[0].life, castLife = magic.castLife;
  magic.update(0, .01, 0, run, [], { night: .8 }, true);
  assert.equal(magic.sparks[0].life, lifetime); assert.equal(magic.castLife, castLife);
  magic.update(2, 2, 100, run, [], {}, false);
  assert.equal(magic.sparks.length, 0); assert.equal(magic.flashes.length, 0);
  assert.equal(magic.burstCloud.geometry.drawRange.count, 0); assert.equal(scene.children.length, initialObjects);
  assert.equal(scene.children.filter(o => o.isPointLight).length, 4);
  magic.cast({ x: 0, y: 5, s: 102 }, 'fire'); magic.clear();
  assert.equal(magic.sparks.length, 0); assert.equal(magic.aura.visible, false); assert.ok(magic.lights.every(l => l.intensity === 0));
});

test('projectile lights follow spherical positions and particle buffers remain finite in long flights', () => {
  const magic = new MagicField(new THREE.Scene()), run = createRun(); run.x = 24; run.altitude = 18;
  const bolt = { x: 24, y: 18, s: 130, profile: { kind: 'fire' } };
  magic.update(.04, 1, 100, run, [bolt], { rain: true }, true);
  const light = magic.lights[1], expectedRadius = RADIUS + bolt.y - bolt.x * bolt.x / (2 * RADIUS);
  assert.ok(Math.abs(Math.hypot(light.position.y + RADIUS, light.position.z) - expectedRadius) < 1e-6);
  assert.equal(light.position.x, bolt.x); assert.ok(light.intensity > 0); assert.equal(light.castShadow, false);
  for (let i = 0; i < 240; i++) { magic.emit(3, 10, i * 7 + 50, '#aeefff', 3); magic.update(.03, i * .03, i * 7, run, [], { night: .5 }, true); }
  for (const cloud of [magic.burstCloud, magic.motes]) {
    assert.ok(cloud.geometry.drawRange.count <= cloud.capacity);
    for (const attribute of Object.values(cloud.geometry.attributes)) for (const value of attribute.array) assert.ok(Number.isFinite(value));
  }
  magic.clear();
});

test('glow uses quarter-size targets, draws the world once, then composites ink last; HDR has a fallback', () => {
  for (const hdr of [true, false]) {
    const calls = [], camera = new THREE.PerspectiveCamera(), world = new THREE.Scene();
    const renderer = { extensions: { has: () => hdr }, getPixelRatio: () => 2, getDrawingBufferSize: v => v.set(2000, 1200),
      setRenderTarget(target) { this.target = target; }, render(scene) { calls.push({ target: this.target, scene }); } };
    const ink = new InkRenderer(renderer, camera); ink.render(world, camera);
    assert.equal(ink.target.texture.type, hdr ? THREE.HalfFloatType : THREE.UnsignedByteType);
    assert.equal(ink.glowA.width, 500); assert.equal(ink.glowA.height, 300);
    assert.deepEqual(calls.map(c => c.target), [ink.target, ink.glowA, ink.glowB, null]);
    assert.equal(calls.filter(c => c.scene === world).length, 1); assert.equal(calls[3].scene, ink.scene);
    assert.equal(ink.uniforms.glow.value, ink.glowB.texture);
    ink.target.dispose(); ink.glowA.dispose(); ink.glowB.dispose();
  }
});

test('motes stay in the world when steering and boost ignition fires once per activation', () => {
  const magic = new MagicField(new THREE.Scene()), run = createRun();
  magic.update(.01, 10, 500, run, [], {}, true);
  const positions = magic.motes.positions.slice(); run.x = 42; run.altitude = 35;
  magic.update(0, 10, 500, run, [], {}, true);
  assert.deepEqual(magic.motes.positions, positions);
  run.boost = true; magic.update(.001, 10, 500, run, [], {}, true);
  assert.equal(magic.sparks.length, 40);
  magic.update(.001, 10, 500, run, [], {}, true); assert.equal(magic.sparks.length, 40);
  magic.clear(); magic.checkpoint(0, 20, 600, 13);
  assert.equal(magic.sparks.length, 48);
  assert.ok(magic.sparks.every(p => Math.abs(Math.hypot(p.x, p.y - 20) - 13) < 1e-6));
});
