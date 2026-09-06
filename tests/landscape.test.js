import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { elevationAt, passageAt, passageSolids } from '../src/landscape.js';
import { movementHitsSolid } from '../src/collision.js';
import { createRun, generateChunk } from '../src/game.js';
import { createChunkVisual, placeOnTerrain, disposeChunk } from '../src/world.js';
import { createCourse, createAttempt, stepRace } from '../src/race.js';
import { WeatherField } from '../src/weather.js';
import { createHalo, glowCore } from '../src/glow.js';

test('terraces are continuous and terrain placement lifts actors with the rendered world', () => {
  const heights = [];
  for (let s = 0; s < 12000; s += 1) { const height = elevationAt(s); heights.push(height); assert.ok(height >= 0 && height <= 30); assert.ok(Math.abs(elevationAt(s + 1) - height) < .1); }
  assert.ok(Math.max(...heights) > 25);
  const model = new THREE.Object3D(); placeOnTerrain(model, 0, 900, 4, 900); assert.equal(model.position.y, 4 + elevationAt(900));
  for (const index of [11, 12, 13, 16, 17, 40]) { const visual = createChunkVisual(generateChunk(index, 42), 42); visual.traverse(o => { if (o.isMesh) assert.ok(o.geometry.attributes.position.array.every(Number.isFinite)); }); disposeChunk(visual); }
});
test('long passages preserve a clear central opening and have matching ceiling and wall collisions', () => {
  assert.equal(passageAt(767), null); assert.ok(passageAt(768)); assert.ok(passageAt(1087)); assert.equal(passageAt(1088), null);
  const solids = passageSolids(896), run = createRun(); run.distance = 900; run.altitude = 15; assert.equal(movementHitsSolid(run, run, solids), false);
  run.x = 30; assert.equal(movementHitsSolid(run, run, solids), true); run.x = 0; run.altitude = 32; assert.equal(movementHitsSolid(run, run, solids), true);
  for (let index = 12; index <= 16; index++) assert.equal(generateChunk(index, 14).obstacles.length, 0);
});
test('leaves and gusts do not inherit rider steering or climb, and drift laterally over time', () => {
  const w = new WeatherField(new THREE.Scene()), weather = { wind: .7, rain: true, sand: false, storm: false };
  w.update(3, 400, -40, 2, 'river', weather); const before = w.leaves.instanceMatrix.array.slice(), gusts = w.gustPositions.slice();
  w.update(3, 400, 40, 45, 'river', weather); assert.deepEqual(w.leaves.instanceMatrix.array, before); assert.deepEqual(w.gustPositions, gusts);
  w.update(3.2, 400, 40, 45, 'river', weather); assert.notEqual(w.leaves.instanceMatrix.array[12], before[12]);
});
test('race breakables reset per attempt and only intact props obstruct the rider', () => {
  const course = createCourse('hard', 42), a = createAttempt(course, 0), b = createAttempt(course, 1);
  const p = a.collisionChunks.flatMap(c => c.props)[0]; assert.ok(p);
  a.countdown = 0; Object.assign(a.run, { distance: p.s - .1, x: p.x, altitude: p.y });
  assert.equal(stepRace(a, { steer: 0, lift: 0 }, 1 / 90), 'crash');
  p.active = false; a.stun = 0; Object.assign(a.run, { distance: p.s - .1, x: p.x, altitude: p.y });
  assert.notEqual(stepRace(a, { steer: 0, lift: 0 }, 1 / 90), 'crash');
  assert.equal(b.collisionChunks.flatMap(c => c.props).find(q => q.s === p.s).active, true);
});
test('projectile glow uses shared high-intensity cores and halos without extra lights', () => {
  const a = createHalo('#ff8833', 7), b = createHalo('#ff8833', 7);
  assert.equal(a.material, b.material); assert.equal(a.geometry, b.geometry); assert.equal(a.material.depthWrite, false);
  assert.ok(glowCore('#ff8833').color.r > 5); assert.equal(a.isLight, undefined);
});

test('boss arenas preserve identical scenery and only dissolve separately owned hazards', () => {
  for (const index of [3, 10, 12, 44]) {
    const chunk = generateChunk(index, 17), normal = createChunkVisual(chunk, 17), arena = createChunkVisual(chunk, 17, true);
    const a = normal.userData.scenery.children, b = arena.userData.scenery.children;
    assert.equal(a.length, b.length);
    for (let i = 0; i < a.length; i++) {
      assert.deepEqual(a[i].geometry.attributes.position.array, b[i].geometry.attributes.position.array);
      assert.deepEqual(a[i].geometry.attributes.color.array, b[i].geometry.attributes.color.array);
    }
    assert.equal(normal.userData.hazards.visible, true); assert.equal(arena.userData.hazards.visible, false);
    for (const m of normal.userData.hazards.children) { assert.equal(m.material.transparent, true); m.material.opacity = .2; }
    for (const m of arena.userData.hazards.children) assert.equal(m.material.opacity, 1);
    disposeChunk(normal); disposeChunk(arena);
  }
});
