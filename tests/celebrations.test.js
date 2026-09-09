import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { milestoneBetween, MilestoneCelebrations } from '../src/celebrations.js';

test('milestones cross exactly once and select the highest tier', () => {
  assert.equal(milestoneBetween(0, 999.99), null);
  for (const [meters, tier] of [[1000, 1], [2000, 1], [10000, 2], [20000, 2], [50000, 3], [100000, 3], [150000, 3]]) {
    assert.deepEqual(milestoneBetween(meters - .01, meters), { meters, tier });
    assert.equal(milestoneBetween(meters, meters + .01), null);
  }
  assert.deepEqual(milestoneBetween(49999, 51001), { meters: 50000, tier: 3 });
  assert.equal(milestoneBetween(2000, 1000), null);
});

test('celebrations are bounded, freeze, expire, and reset for a new journey', () => {
  const scene = new THREE.Scene(), effects = new MilestoneCelebrations(scene);
  const run = { distance: 1000, x: 0, altitude: 3.5, speed: 65 };
  effects.observe(run); effects.update(.1, run);
  assert.ok(effects.sparks.count > 0); assert.equal(effects.decor.count, 0);
  assert.equal(effects.observe(run), null);
  run.distance = 500; effects.observe(run); run.distance = 1000;
  assert.equal(effects.observe(run), null, 'backtracking cannot repeat rewards');
  run.distance = 10000; effects.observe(run); effects.update(.5, run);
  const festivalParts = effects.decor.count, festivalSparks = effects.sparks.count;
  assert.ok(festivalParts > 0);
  run.distance = 50000; effects.observe(run); effects.update(.5, run);
  assert.ok(effects.decor.count > festivalParts); assert.ok(effects.sparks.count > festivalSparks);
  const age = effects.active.age, life = effects.particles[0].life;
  effects.update(0, run);
  assert.equal(effects.active.age, age); assert.equal(effects.particles[0].life, life);
  for (let i = 0; i < 120; i++) {
    effects.update(.1, run);
    assert.ok(effects.sparks.count <= 1800); assert.ok(effects.decor.count <= 1400);
  }
  effects.update(20, run); assert.equal(effects.active, null);
  assert.equal(effects.sparks.count + effects.decor.count, 0);
  effects.clear(); run.distance = 1000;
  assert.equal(effects.observe(run).tier, 1);
  assert.equal(scene.children.length, 2, 'restarts reuse two draw calls');
});
