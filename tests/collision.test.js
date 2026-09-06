import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, updateRun, damage, generateChunk, RADIUS } from '../src/game.js';
import { passageSolids } from '../src/landscape.js';
import { chunkSolids, movementHitsSolid, resolveSolidMovement } from '../src/collision.js';
import { createCourse, createAttempt, stepRace } from '../src/race.js';

const pose = (x, altitude, distance) => ({ x, altitude, distance });
function move(from, to, solids) {
  const run = Object.assign(createRun(), to, { vx: 30, vy: 20, speed: 125 });
  const hit = resolveSolidMovement(run, from, solids);
  return { run, hit };
}
const cave = Array.from({ length: 5 }, (_, i) => passageSolids(768 + i * 64)).flat();

test('continuous cave walls block both sides through every seam, even while invulnerable', () => {
  for (const side of [-1, 1]) for (const hz of [30, 90, 144]) {
    const r = Object.assign(createRun(), pose(side * 26, 15, 780), { invulnerable: 999, power: 100 });
    let contacts = 0, last = r.distance;
    for (let step = 0; step < hz * 4 && r.distance < 1080; step++) {
      const previous = { ...r };
      updateRun(r, { steer: side, lift: 0, boost: true }, 1 / hz);
      if (resolveSolidMovement(r, previous, cave)) { contacts++; damage(r); }
      assert.ok(Math.abs(r.x) < 27.501, `${side}/${hz}: wall penetration at ${r.distance}`);
      assert.ok(Math.abs(r.altitude - 15) < .001, 'wall sliding must not introduce a climb or dive');
      assert.ok(r.distance > last, 'sliding must preserve forward travel through chunk seams'); last = r.distance;
    }
    assert.ok(contacts > 30); assert.equal(r.hp, 3); assert.ok(r.distance > 1060);
  }
});

test('tunnel mouths and exit edges cannot be skipped by a long movement step', () => {
  const front = move(pose(40, 15, 730), pose(40, 15, 820), cave);
  assert.equal(front.hit, true); assert.ok(front.run.distance < 766); assert.equal(front.run.speed, 0);
  const roof = move(pose(0, 45, 730), pose(0, 45, 820), cave);
  assert.equal(roof.hit, true); assert.ok(roof.run.distance < 766);
  const open = move(pose(0, 15, 730), pose(0, 15, 1120), cave);
  assert.equal(open.hit, false); assert.equal(open.run.distance, 1120);
  const exit = move(pose(26, 15, 1086), pose(45, 15, 1095), cave);
  assert.equal(exit.hit, true); assert.ok(exit.run.x < 27.501);
  const outside = move(pose(26, 15, 1092), pose(45, 15, 1100), cave);
  assert.equal(outside.hit, false);
});

test('ceilings and angled ribs stop the rider at their actual height, while letting the carpet slide', () => {
  for (const x of [0, 21, -21]) {
    const { run, hit } = move(pose(x, 20, 860), pose(x, 45, 864), cave);
    assert.equal(hit, true); assert.ok(run.distance > 863.9);
    const ceiling = x === 0 ? 32 : 30;
    assert.ok(run.altitude - x * x / (2 * RADIUS) + 2.5 < ceiling);
    assert.ok(Math.abs(run.vy - run.x * run.vx / RADIUS) < 1e-9, 'no velocity into the ceiling');
  }
});

test('fast sweeps hit thin rotated buildings and reject a clear route above or beside them', () => {
  for (const angle of [0, .5, -1.2, Math.PI / 2]) {
    const boxes = [{ x: 0, s: 20, width: 6, depth: .2, height: 12, angle }];
    const from = pose(0, 5, 0), to = pose(0, 5, 40);
    assert.equal(movementHitsSolid(from, to, boxes), true);
    const { run, hit } = move(from, to, boxes);
    assert.equal(hit, true); assert.equal(movementHitsSolid(run, run, boxes), false);
    assert.equal(movementHitsSolid(pose(15, 5, 0), pose(15, 5, 40), boxes), false);
    assert.equal(movementHitsSolid(pose(0, 16, 0), pose(0, 16, 40), boxes), false);
  }
});

test('embedded positions recover and simultaneous roof/wall contacts stay outside solid geometry', () => {
  const recovered = move(pose(30, 15, 900), pose(31, 15, 902), cave);
  assert.equal(recovered.hit, true); assert.ok(recovered.run.x < 27.5);
  const corner = move(pose(25, 25, 900), pose(40, 40, 904), cave);
  assert.equal(corner.hit, true); assert.equal(movementHitsSolid(corner.run, corner.run, cave), false);
});

test('only dissolved arena hazards and destroyed props lose solidity; race has no invisible caves', () => {
  const chunk = generateChunk(12, 42);
  const from = pose(25, 15, 780), to = pose(45, 15, 784);
  assert.equal(movementHitsSolid(from, to, chunkSolids(chunk)), true);
  chunk.combatClear = true;
  assert.equal(movementHitsSolid(from, to, chunkSolids(chunk)), false);
  assert.equal(chunkSolids(chunk).length, 3, 'the preserved outer cliff mass remains solid');
  const propChunk = { start: 0, disablePassages: true, obstacles: [], props: [{ active: true, x: 0, y: 2, s: 10, radius: 2 }] };
  assert.equal(movementHitsSolid(pose(0, 2, 0), pose(0, 2, 20), chunkSolids(propChunk)), true);
  propChunk.props[0].active = false;
  assert.equal(chunkSolids(propChunk).length, 0);
  const a = createAttempt(createCourse('easy', 42), 0); a.countdown = 0;
  a.collisionChunks.forEach(c => { c.obstacles = []; c.props = []; });
  Object.assign(a.run, pose(40, 45, 900));
  assert.equal(chunkSolids(a.collisionChunks[12]).length, 0);
});

test('race mode uses swept collisions for thin obstacles without damaging health or ghosts', () => {
  const a = createAttempt(createCourse('easy', 42), 0, { samples: [[0, 0, 5, 100]] });
  a.countdown = 0; a.collisionChunks.forEach(c => { c.obstacles = []; c.props = []; });
  a.collisionChunks[1].obstacles.push({ x: 0, s: 101, width: 4, depth: .05, height: 10 });
  Object.assign(a.run, pose(0, 5, 97), { speed: 125 });
  assert.equal(stepRace(a, { steer: 0, lift: 0, boost: true }, .05), 'crash');
  assert.equal(a.run.hp, 3); assert.equal(a.run.distance, 0); assert.equal(a.crashes, 1);
  a.collisionChunks[1].obstacles = []; a.stun = 0;
  Object.assign(a.run, pose(0, 5, 97), { speed: 125 });
  assert.equal(stepRace(a, { steer: 0, lift: 0, boost: true }, .05), null);
});
