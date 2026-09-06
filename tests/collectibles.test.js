import test from 'node:test';
import assert from 'node:assert/strict';
import { magnetRadius, pullCollectible } from '../src/collectibles.js';
import { createRun, generateChunk, collectSpell } from '../src/game.js';

test('Magnet stacks to three useful ranges and appears on the early gold route', () => {
  assert.deepEqual([0, 1, 2, 3, 9].map(magnetRadius), [0, 28, 40, 52, 52]);
  for (let seed = 0; seed < 30; seed++) {
    const chunk = generateChunk(6, seed), magnet = chunk.pickups.find(p => p.kind === 'magnet');
    assert.ok(magnet); assert.equal(magnet.y, 3); assert.equal(magnet.x, chunk.safeLane * 22);
  }
  const run = createRun(); for (let i = 0; i < 5; i++) collectSpell(run, 'magnet');
  assert.equal(run.spells.magnet, 3);
});

test('all loot types home in from the side, above and behind a fast moving carpet', () => {
  for (const hz of [30, 90, 144]) for (const kind of ['gold', 'ward', 'fire', 'magnet']) {
    const run = createRun(); run.altitude = 10; run.speed = 126; run.spells.magnet = 1;
    const p = { kind, x: 18, y: 20, s: -8 }; let elapsed = 0;
    while (Math.hypot(p.x - run.x, p.y - run.altitude, p.s - run.distance) > 2.8 && elapsed < 2) {
      run.distance += run.speed / hz; pullCollectible(p, run, 1 / hz); elapsed += 1 / hz;
    }
    assert.ok(elapsed < 1, `${kind} at ${hz}Hz catches the moving player`);
    assert.ok(p.attracted && p.s > 0 && p.x < 3 && p.y < 13);
  }
});

test('unmagnetized, out-of-range and paused pickups stay put', () => {
  const run = createRun(), p = { x: 24, y: 8, s: 5 }, initial = { ...p };
  assert.equal(pullCollectible(p, run, .05), false); assert.deepEqual(p, initial);
  run.spells.magnet = 1; assert.equal(pullCollectible(p, run, 0), false); assert.deepEqual(p, initial);
  const distant = { x: 50, y: 8, s: 5 };
  assert.equal(pullCollectible(distant, run, .05), false);
  run.spells.magnet = 3; assert.equal(pullCollectible(distant, run, .05), true);
});
