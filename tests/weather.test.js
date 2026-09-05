import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WeatherField, weatherAt } from '../src/weather.js';
import { createRun, cliffRailAt, updateRun, generateChunk } from '../src/game.js';

test('weather varies by biome and keeps fixed particle budgets through long runs', () => {
  assert.equal(weatherAt(50, 'palace').rain, true); assert.equal(weatherAt(50, 'desert').sand, true);
  assert.equal(weatherAt(75, 'river').storm, true); assert.equal(weatherAt(0, 'city').rain, false);
  const scene = new THREE.Scene(), field = new WeatherField(scene);
  for (let i = 0; i < 250; i++) {
    const time = i * 7.3, zone = i % 2 ? 'river' : 'desert';
    field.update(time, time * 76, Math.sin(time) * 54, 30, zone, weatherAt(time, zone));
    assert.ok(field.leaves.count <= 180); assert.equal(scene.children.length, 4);
  }
  for (const values of [field.rainPositions, field.gustPositions, field.sandPositions, field.leaves.instanceMatrix.array]) for (const v of values) assert.ok(Number.isFinite(v));
});

test('cliff skimming grants speed and power only beside the actual marked face', () => {
  const run = createRun(), away = createRun(); run.distance = away.distance = 660; run.altitude = away.altitude = 15; run.x = 53;
  assert.equal(cliffRailAt(660).side, 1); assert.equal(cliffRailAt(3220).side, -1); assert.equal(cliffRailAt(200), null);
  for (let i = 0; i < 100; i++) { updateRun(run, { steer: 0, lift: 0 }, .01); updateRun(away, { steer: 0, lift: 0 }, .01); }
  assert.equal(run.railing, true); assert.ok(run.speed > away.speed + 15); assert.ok(run.power > away.power + 5);
  updateRun(run, { steer: 0, lift: 0, arena: true }, .01); assert.equal(run.railing, false);
  run.altitude = 50; updateRun(run, { steer: 0, lift: 0 }, .01); assert.equal(run.railing, false);
  for (let i = 10; i <= 16; i++) assert.ok(generateChunk(i, 20).obstacles.every(o => o.x < 30));
});
