import test from 'node:test';
import assert from 'node:assert/strict';
import { ADVENTURE_TIME_SCALE, progressionAt, balanceAt } from '../src/pacing.js';
import { createRun, updateRun, generateChunk, flightSpeed, difficultyAt } from '../src/game.js';

test('adventure difficulty rises through 40km and beyond, with bounded speed and attack pressure', () => {
  let previous = -1;
  for (let s = 0; s <= 100000; s += 32) {
    const p = progressionAt(s), b = balanceAt(s);
    assert.ok(p >= previous && p <= 1); previous = p;
    assert.ok(b.obstacleChance >= 0 && b.obstacleChance < .9);
    assert.ok(b.enemyChance >= 0 && b.enemyChance < 1);
    assert.ok(b.attackInterval >= .57 && b.warning >= .9 && b.bossSpacing >= 1600);
  }
  const early = balanceAt(1000), late = balanceAt(40000), distant = balanceAt(64000);
  assert.ok(late.attackInterval < early.attackInterval * .6);
  assert.ok(distant.strength > late.strength);
  for (const [s, strength] of [[0, 0], [1000, .04], [1500, .06], [2500, .10]]) {
    const b = balanceAt(s);
    assert.ok(Math.abs(b.strength - strength) < 1e-9);
    assert.equal(b.mastery, 0);
    assert.equal(b.attackInterval, 1.55 - .8 * strength);
  }
  assert.ok(balanceAt(10000).strength > .45);
  assert.ok(balanceAt(80000).attackInterval < balanceAt(20000).attackInterval * .7);
  assert.ok(balanceAt(80000).projectileSpeed > balanceAt(20000).projectileSpeed);
  const speed = s => flightSpeed(3.5, false, difficultyAt(s)) * ADVENTURE_TIME_SCALE;
  assert.ok(speed(1000) < flightSpeed(3.5, false) * .85);
  assert.ok(speed(40000) > speed(1000) * 1.25);
  // Opening and late-game both keep an easier section in each encounter phrase.
  for (const base of [0, 40960, 65536]) {
    const busy = balanceAt(base + 1024), respite = balanceAt(base + 1792);
    assert.ok(respite.obstacleChance < busy.obstacleChance * .6);
    assert.ok(respite.enemyChance < busy.enemyChance * .4);
  }
});

test('generated late-game hazards grow substantially while dangerous enemies are introduced gradually', () => {
  const totals = [0, 560].map(start => {
    const tally = { obstacles: 0, enemies: 0 };
    for (let seed = 0; seed < 12; seed++) for (let i = start; i < start + 140; i++) {
      const chunk = generateChunk(i, seed);
      tally.obstacles += chunk.obstacles.length; tally.enemies += chunk.enemies.length;
      for (const e of chunk.enemies) {
        assert.ok(chunk.start >= 640);
        if (e.kind === 'wizard') assert.ok(chunk.start >= 2500);
        if (e.kind === 'dragon') assert.ok(chunk.start >= 5000);
      }
    }
    return tally;
  });
  assert.ok(totals[1].obstacles > totals[0].obstacles * 1.8);
  assert.ok(totals[1].enemies > totals[0].enemies * 2.5);
});

test('time dilation preserves input response and simulation is consistent across display rates', () => {
  const runs = [30, 60, 144].map(hz => {
    const run = createRun(); let accumulator = 0;
    for (let i = 0; i < hz * 10; i++) {
      accumulator += ADVENTURE_TIME_SCALE / hz;
      while (accumulator >= 1 / 90) {
        updateRun(run, { steer: 0, lift: 0, controlRate: 1 / ADVENTURE_TIME_SCALE }, 1 / 90); accumulator -= 1 / 90;
      }
    }
    return run;
  });
  assert.ok(Math.abs(runs[0].time - 8.2) < .02);
  for (const r of runs) assert.ok(Math.abs(r.distance - runs[0].distance) < 1);
  const input = createRun();
  for (let i = 0; i < 7; i++) updateRun(input, { steer: 1, lift: 1, controlRate: 1 / ADVENTURE_TIME_SCALE }, 1 / 90);
  assert.ok(input.vx > 43 && input.vy > 22);
});
