import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { RACE_LEVELS, createCourse, generateRaceChunk, routeAt, createAttempt, stepRace, ghostAt, RaceRecords, formatTime, checkpointDelta } from '../src/race.js';
import { RaceView } from '../src/race-view.js';
import { CHUNK, obstacleExtents } from '../src/game.js';

const STEP = 1 / 90;
function fly(course, player = 0) {
  const a = createAttempt(course, player);
  for (let i = 0; i < 90 * 100 && !a.finished && !a.dnf; i++) {
    const target = routeAt(course, a.run.distance + a.run.speed * .25);
    stepRace(a, { steer: Math.max(-1, Math.min(1, (target.x - a.run.x) * .14)), lift: Math.max(-1, Math.min(1, (target.y - a.run.altitude) * .16)), boost: a.run.power > 28 }, STEP);
  }
  return a;
}
test('all procedural race difficulties are repeatable, distinct and have clear checkpoint approaches', () => {
  const totals = {};
  for (const level of Object.keys(RACE_LEVELS)) {
    totals[level] = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const course = createCourse(level, seed);
      assert.deepEqual(course, createCourse(level, seed)); assert.equal(course.gates.at(-1).s, course.length);
      for (let i = 0; i < course.length / CHUNK; i++) {
        const chunk = generateRaceChunk(i, course); assert.deepEqual(chunk, generateRaceChunk(i, course));
        assert.equal(chunk.enemies.length + chunk.pickups.length + chunk.rings.length, 0);
        for (const o of chunk.obstacles) {
          totals[level]++; const ext = obstacleExtents(o);
          assert.ok(Math.abs(o.x - routeAt(course, o.s).x) >= ext.x + 9);
          assert.ok(course.gates.every(g => Math.abs(g.s - o.s) >= ext.s + 22));
        }
      }
    }
  }
  assert.ok(totals.easy < totals.medium && totals.medium < totals.hard);
  assert.notDeepEqual(createCourse('hard', 1).gates, createCourse('hard', 2).gates);
});
test('complete routes are flyable using actual flight physics at every difficulty', () => {
  for (const level of Object.keys(RACE_LEVELS)) for (const seed of [1, 3, 42, 999, 17399]) {
    const a = fly(createCourse(level, seed));
    assert.equal(a.finished, true, `${level}/${seed}`); assert.equal(a.crashes, 0, `${level}/${seed}`);
    assert.ok(a.elapsed > 8 && a.elapsed < 60); assert.equal(a.run.hp, 3); assert.equal(a.run.railing, false);
    assert.equal(a.samples.at(-1)[0], a.elapsed); assert.equal(a.samples.at(-1)[3], a.course.length);
  }
});
test('countdown holds position; missing a gate resets with running time; crashes never end the adventure health', () => {
  const a = createAttempt(createCourse('hard', 42), 0);
  for (let i = 0; i < 270; i++) stepRace(a, { boost: true, lift: 1 }, STEP);
  assert.equal(a.countdown, 0); assert.equal(a.elapsed, 0); assert.equal(a.run.distance, 0); assert.equal(a.run.power, 45);
  const gate = a.course.gates[0]; Object.assign(a.run, { distance: gate.s - .1, x: 54, altitude: 54 });
  assert.equal(stepRace(a, { steer: 0, lift: 0 }, STEP), 'miss'); assert.equal(a.nextGate, 0); assert.equal(a.run.distance, 0); assert.equal(a.crashes, 1);
  const time = a.elapsed; stepRace(a, {}, STEP); assert.ok(a.elapsed > time); assert.equal(a.run.distance, 0);
  a.stun = 0; const o = a.collisionChunks.flatMap(c => c.obstacles)[0]; Object.assign(a.run, { distance: o.s - .1, x: o.x, altitude: 2 });
  assert.equal(stepRace(a, { steer: 0, lift: 0 }, STEP), 'crash'); assert.equal(a.run.hp, 3); assert.equal(a.run.ended, false);
  assert.equal(a.samples.at(-1)[8], 1);
});
test('finishing uses the interpolated gate crossing time; no skipped gates or post-finish updates', () => {
  const a = createAttempt(createCourse('easy', 4), 1); a.countdown = 0; a.nextGate = a.course.gates.length - 1;
  const gate = a.course.gates.at(-1); Object.assign(a.run, { distance: gate.s - .2, x: gate.x, altitude: gate.y }); a.elapsed = 20;
  assert.equal(stepRace(a, { steer: 0, lift: 0 }, STEP), 'finish'); assert.ok(a.elapsed > 20 && a.elapsed < 20 + STEP);
  const time = a.elapsed; stepRace(a, {}, STEP); assert.equal(a.elapsed, time); assert.equal(a.run.distance, gate.s);
  const timeout = createAttempt(createCourse(), 0); timeout.countdown = 0; timeout.elapsed = 180;
  assert.equal(stepRace(timeout, {}, STEP), 'timeout'); assert.equal(timeout.finished, false);
});
test('time-based ghosts interpolate flight, retain crash discontinuities and stop at their finish', () => {
  const samples = [[0, 0, 3, 0, 0, 0, 0, 1], [1, 10, 13, 60, 10, 5, 0, 1], [2, 0, 3, 0, 0, 0, 0, 1, 1], [3, 0, 3, 60, 0, 0, 0, 1]];
  assert.equal(ghostAt(samples, .5)[3], 30); assert.equal(ghostAt(samples, 1.5)[3], 60); assert.equal(ghostAt(samples, 2)[3], 0);
  assert.equal(ghostAt(samples, 3.1), null); assert.equal(ghostAt(null, 0), null);
  assert.equal(formatTime(61.123), '1:01.123'); assert.equal(formatTime(59.9999), '1:00.000');
});
test('personal bests save independently, survive reload and never mix different courses', () => {
  let data = null; const storage = { getItem: () => data, setItem: (_, value) => data = value };
  const records = new RaceRecords(storage); records.sessions.easy = { seed: 42, best: [null, null] };
  const first = fly(createCourse('easy', 42)); assert.equal(records.complete(first), true);
  const opponent = createAttempt(first.course, 1, records.get('easy').best[0]); assert.equal(opponent.ghost.time, first.elapsed);
  const second = fly(first.course, 1); assert.equal(records.complete(second), true);
  first.elapsed++; assert.equal(records.complete(first), false);
  assert.deepEqual(new RaceRecords(storage).get('easy').best, records.get('easy').best);
  const original = records.get('easy').seed; records.regenerate('easy'); assert.notEqual(records.get('easy').seed, original); assert.deepEqual(records.get('easy').best, [null, null]);
  assert.equal(records.complete(second), false);
  data = '{"easy":{"seed":42,"best":[{"time":2,"samples":[[0],[2]]},null]}}';
  assert.deepEqual(new RaceRecords(storage).get('easy').best, [null, null]);
  const unavailable = new RaceRecords({ getItem() { throw Error(); }, setItem() { throw Error(); } }); assert.ok(unavailable.get('hard')); unavailable.regenerate('hard');
});
test('ghost and gate visuals use spherical placement and clean up across hot-seat restarts', () => {
  const scene = new THREE.Scene(), view = new RaceView(scene), course = createCourse('easy', 42), a = fly(course);
  const rival = createAttempt(course, 1, { time: a.elapsed, samples: a.samples }); rival.countdown = 0; rival.elapsed = 2;
  view.start(course, 1); view.update(rival); assert.equal(view.ghost.root.visible, true); assert.equal(view.gates.length, course.gates.length);
  assert.ok(view.ghost.root.position.toArray().every(Number.isFinite)); const count = scene.children.length;
  view.start(course, 0); assert.equal(scene.children.length, count);
  rival.finished = true; view.update(rival); assert.equal(view.ghost.root.visible, false);
  view.clear(); assert.equal(view.gates.length, 0); assert.equal(scene.children.length, 1);
});

test('checkpoint splits use exact crossings, survive resets and preserve older ghosts', () => {
  const a = createAttempt(createCourse('easy', 42), 0, { splits: [6, 12, 18, 24] });
  assert.equal(checkpointDelta(a), null); a.countdown = 0; a.elapsed = 5;
  const gate = a.course.gates[0]; Object.assign(a.run, { distance: gate.s - .1, x: gate.x, altitude: gate.y });
  assert.equal(stepRace(a, { steer: 0, lift: 0 }, STEP), 'gate');
  assert.ok(a.splits[0] > 5 && a.splits[0] < 5 + STEP); assert.ok(checkpointDelta(a) < 0);
  const split = a.splits[0], next = a.course.gates[1]; Object.assign(a.run, { distance: next.s - .1, x: 54, altitude: 54 });
  assert.equal(stepRace(a, { steer: 0, lift: 0 }, STEP), 'miss'); assert.deepEqual(a.splits, [split]);
  a.ghost = { time: 24, samples: [] }; assert.equal(checkpointDelta(a), null);
  let data; const storage = { getItem: () => data, setItem: (_, v) => data = v };
  const records = new RaceRecords(storage); records.sessions.easy = { seed: 42, best: [null, null] };
  const complete = fly(a.course); records.complete(complete);
  const saved = new RaceRecords(storage).get('easy').best[0];
  assert.equal(saved.splits.length, a.course.gates.length); assert.equal(saved.splits.at(-1), saved.time);
  const legacy = JSON.parse(data); delete legacy.easy.best[0].splits; data = JSON.stringify(legacy);
  assert.equal(new RaceRecords(storage).get('easy').best[0].time, saved.time);
});
