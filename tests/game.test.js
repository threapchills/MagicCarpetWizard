import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, updateRun, flightSpeed, generateChunk, ZONES, zoneAt, ZONE_LENGTH, collectSpell, award, damage, intersectsObstacle, nearObstacle, spellDamage, safeLaneAt, segmentHitsSphere } from '../src/game.js';
test('low flight is faster; skyfire preserves speed at altitude', () => { assert.ok(flightSpeed(1, false) > flightSpeed(20, false) * 1.5); assert.equal(flightSpeed(1, true), flightSpeed(29, true)); });
test('all seven zones cycle and generation is seeded', () => { for (let i = 0; i < 14; i++) assert.equal(zoneAt(i * ZONE_LENGTH), i % ZONES.length); assert.deepEqual(generateChunk(9, 12), generateChunk(9, 12)); assert.notDeepEqual(generateChunk(9, 12), generateChunk(9, 13)); });
test('1000 procedural rows always preserve a safe flight lane', () => { for (let i = 0; i < 1000; i++) { const row = generateChunk(i, 917); for (const obstacle of row.obstacles) assert.ok(Math.abs(obstacle.x - row.safeLane * 13) > obstacle.width / 2 + 2); } });
test('boost drains, stops empty, and needs 25 power to restart', () => { const run = createRun(); run.altitude = 25; for (let i = 0; i < 100; i++) updateRun(run, { steer: 0, lift: 0, boost: true }, .05); assert.equal(run.boost, false); assert.ok(run.power < 25); });
test('tricks require clearance, award only on completion, and have a cooldown', () => { const run = createRun(); run.altitude = 2; updateRun(run, { steer: 0, lift: 0, roll: true }, .01); assert.equal(run.roll, 0); updateRun(run, { steer: 0, lift: 0, roll: false }, .01); run.altitude = 10; updateRun(run, { steer: 1, lift: 0, roll: true }, .01); assert.ok(run.roll > 0); assert.equal(run.tricks, 0); for (let i = 0; i < 18; i++) updateRun(run, { steer: 0, lift: 0 }, .05); assert.equal(run.tricks, 1); assert.ok(run.rollCooldown > 0); });
test('spell stacks and chains are capped, ward heals, immunity prevents repeated hits', () => { const run = createRun(); for (let i = 0; i < 100; i++) { collectSpell(run, 'echo'); award(run, 1, 10); } assert.equal(run.spells.echo, 3); assert.equal(run.power, 100); assert.equal(run.bestChain, 8); run.invulnerable = 0; assert.equal(damage(run), true); assert.equal(damage(run), false); assert.equal(run.hp, 2); collectSpell(run, 'ward'); assert.equal(run.hp, 3); });
test('frost and fire synergize; high flight clears collision', () => { assert.ok(spellDamage({ fire: 2 }, true) > spellDamage({ fire: 2 }, false)); const run = createRun(); const obstacle = { x: 0, s: 0, width: 5, depth: 5, height: 5 }; assert.equal(intersectsObstacle(run, obstacle), true); run.altitude = 8; assert.equal(intersectsObstacle(run, obstacle), false); });
test('long runs remain bounded and finite under continuous input', () => { const run = createRun(); for (let i = 0; i < 60000; i++) updateRun(run, { steer: Math.sin(i / 100), lift: Math.cos(i / 400), boost: i % 150 > 100, roll: i % 90 === 0 }, 1 / 60); assert.ok(run.distance > 20000); assert.ok(run.x >= -21 && run.x <= 21); assert.ok(run.altitude >= 1 && run.altitude <= 29); assert.ok(Number.isFinite(run.score)); });
test('safe routes stay in adjacent lanes and start in the center', () => {
  for (let seed = 0; seed < 30; seed++) {
    assert.equal(safeLaneAt(0, seed), 0);
    for (let i = 1; i < 1000; i++) assert.ok(Math.abs(safeLaneAt(i, seed) - safeLaneAt(i - 1, seed)) <= 1);
  }
});
test('holding roll cannot farm rewards and a crash cancels a trick', () => {
  const run = createRun(); run.altitude = 10;
  for (let i = 0; i < 600; i++) updateRun(run, { steer: 0, lift: 0, roll: true }, 1 / 60);
  assert.equal(run.tricks, 1);
  updateRun(run, { steer: 0, lift: 0 }, .02); updateRun(run, { steer: 0, lift: 0, roll: true }, .02);
  run.invulnerable = 0; damage(run);
  for (let i = 0; i < 90; i++) updateRun(run, { steer: 0, lift: 0 }, 1 / 60);
  assert.equal(run.tricks, 1);
});
test('swept collision catches fast bolts and rejects distant or stationary misses', () => {
  const from = { x: 0, y: 5, s: -10 }, to = { x: 0, y: 5, s: 10 };
  assert.equal(segmentHitsSphere(from, to, { x: 0, y: 5, s: 0 }, 1), true);
  assert.equal(segmentHitsSphere(from, to, { x: 4, y: 5, s: 0 }, 1), false);
  assert.equal(segmentHitsSphere(from, from, from, 1), true);
  assert.equal(segmentHitsSphere(from, from, to, 1), false);
});
test('near misses only pay after clearing the rear of an obstacle', () => {
  const run = createRun(), obstacle = { x: 0, s: 30, width: 6, height: 7, depth: 6 };
  run.x = 4.5; run.altitude = 3; run.distance = 30; assert.equal(nearObstacle(run, obstacle), false);
  run.distance = 34; assert.equal(nearObstacle(run, obstacle), true);
  run.x = 0; assert.equal(nearObstacle(run, obstacle), false);
  run.altitude = 8; assert.equal(nearObstacle(run, obstacle), true);
});
