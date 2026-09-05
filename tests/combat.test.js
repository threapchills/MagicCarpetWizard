import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRun, collectSpell } from '../src/game.js';
import { weaponProfile, tickBuffs, damageFor, attackTargets } from '../src/combat.js';
import { Battle } from '../src/battle.js';
import { createEnemy, placeOnWorld } from '../src/world.js';

function harness() {
  const scene = new THREE.Scene(), chunks = new Map([[0, { enemies: [] }]]), bullets = [], shots = [], run = createRun();
  run.altitude = 10; run.speed = 60;
  const camera = new THREE.PerspectiveCamera(60, 1.6, .2, 1100); camera.position.set(0, 13, 22); camera.lookAt(0, 10, -80); camera.updateMatrixWorld();
  const calls = { arena: [], hits: 0, hurt: 0 };
  const sound = Object.fromEntries(['spell', 'impact', 'kill', 'roar', 'trick'].map(k => [k, () => {}]));
  const battle = new Battle(scene, chunks, bullets, shots, { sound, blood: { burst() {} }, particles() {}, notify() {}, tray() {}, bossUI() {},
    hurt() { calls.hurt++; }, hit() { calls.hits++; }, arena(active) { calls.arena.push(active); } });
  function enemy(x = 0, s = 70, hp = 20) {
    const e = { x, y: 11, s, baseX: x, baseY: 11, baseS: s, hp, maxHp: hp, active: true, radius: 2.4, frozen: 0, kind: 'hexer', phase: 0, cooldown: 2, visual: createEnemy('hexer') };
    scene.add(e.visual); placeOnWorld(e.visual, x, s, 11, run.distance); chunks.get(0).enemies.push(e); return e;
  }
  const aimAt = e => { scene.updateMatrixWorld(); const p = e.visual.position.clone().project(camera); return new THREE.Vector2(p.x, p.y); };
  return { scene, battle, run, bullets, shots, camera, enemy, aimAt, calls };
}

test('Soar-style timed boosts refresh, expire and cannot permanently multiply weapon stats', () => {
  const run = createRun(), base = weaponProfile(run);
  for (const kind of ['rapid', 'fury', 'focus', 'overdrive']) for (let i = 0; i < 30; i++) collectSpell(run, kind);
  const boosted = weaponProfile(run); assert.ok(boosted.cooldown < base.cooldown); assert.ok(boosted.damage > base.damage && boosted.damage < base.damage * 2);
  assert.ok(boosted.shots <= 4); assert.equal(boosted.pierce, 1);
  tickBuffs(run, 99); assert.deepEqual(weaponProfile(run), base);
  for (let i = 0; i < 8; i++) collectSpell(run, 'fire'); assert.equal(run.spells.fire, 3); assert.equal(run.buffs.overdrive, 8);
  assert.ok(damageFor(base, { frozen: 1 }) > damageFor(base, { frozen: 0 }));
  run.weapon = 'wind'; assert.ok(damageFor(weaponProfile(run), { burn: 1 }) > damageFor(weaponProfile(run), { burn: 0 }));
});

test('fireballs hit, explode into nearby enemies, burn, and cannot award a kill twice', () => {
  const h = harness(), e = h.enemy(), nearby = h.enemy(5, 70), far = h.enemy(30, 70);
  h.battle.fire(h.run, h.aimAt(e), h.camera);
  for (let i = 0; i < 40; i++) h.battle.update(1 / 90, h.run, 0);
  assert.ok(e.hp < 20 && nearby.hp < 20); assert.equal(far.hp, 20); assert.ok(e.burn > 0); assert.equal(h.bullets.length, 0);
  h.battle.hit(e, { kind: 'fire', damage: 100 }, h.run); const kills = h.run.kills;
  h.battle.hit(e, { kind: 'fire', damage: 100 }, h.run); assert.equal(h.run.kills, kills); assert.equal(h.battle.drops.length, 1);
  h.battle.clear();
});

test('lightning is immediate, chains to distinct neighbors, and falls off with each jump', () => {
  const h = harness(), a = h.enemy(), b = h.enemy(8), c = h.enemy(90);
  h.run.weapon = 'storm'; h.battle.fire(h.run, h.aimAt(a), h.camera);
  assert.ok(a.hp < b.hp && b.hp < 20); assert.equal(c.hp, 20); assert.equal(h.bullets.length, 0);
  assert.ok(h.battle.fx.some(f => f.geometry)); h.battle.clear();
});

test('wind blasts clear incoming shots, stagger and push monsters, while attack warnings retain their aim', () => {
  const h = harness(), e = h.enemy(0, 60); h.run.weapon = 'wind'; e.burn = 2;
  const visual = new THREE.Group(); h.scene.add(visual);
  h.shots.push({ x: 0, y: 11, s: 34, vx: 0, vy: 0, speed: 34, life: 4, visual });
  h.battle.fire(h.run, h.aimAt(e), h.camera);
  for (let i = 0; i < 40; i++) h.battle.update(1 / 90, h.run, 0);
  assert.equal(h.shots.length, 0); assert.ok(e.stagger > 0 && e.pushS > 0 && e.hp < 20); assert.equal(h.calls.hurt, 0);
  const targets = attackTargets(e, h.run, true); h.run.x = 50; h.run.altitude = 40;
  assert.equal(targets[2].x, 0); assert.equal(targets[2].y, 10); h.battle.clear();
});

test('boss shields block body damage, reform at half health, and victory rewards and clears the arena once', () => {
  const h = harness(); h.run.distance = 1400; h.battle.updateBoss(1 / 90, h.run);
  const b = h.battle.boss, powerful = { kind: 'storm', damage: 100 };
  assert.ok(b && b.sigils.length === 3); h.battle.hit(b, powerful, h.run); assert.equal(b.hp, b.maxHp);
  for (const s of b.sigils) h.battle.hit(s, powerful, h.run); h.battle.updateBoss(1 / 90, h.run); assert.equal(b.shield, false);
  h.battle.hit(b, { ...powerful, damage: b.maxHp * .55 }, h.run); h.battle.updateBoss(1 / 90, h.run);
  assert.equal(b.phase, 2); assert.equal(b.shield, true); assert.equal(b.sigils.filter(s => s.active).length, 3);
  for (const s of b.sigils) h.battle.hit(s, powerful, h.run); h.battle.updateBoss(1 / 90, h.run);
  h.run.hp = 1; h.battle.hit(b, powerful, h.run);
  assert.equal(h.battle.boss, null); assert.equal(h.run.bosses, 1); assert.equal(h.run.hp, 2); assert.equal(h.run.buffs.overdrive, 8);
  assert.deepEqual(h.calls.arena, [true, false]); h.battle.updateBoss(1, h.run); assert.equal(h.battle.boss, null);
  h.battle.clear(); assert.equal(h.battle.fx.length, 0); assert.equal(h.battle.drops.length, 0);
});

test('a moving boss can be defeated through real aimed casts at different simulation rates', () => {
  for (const hz of [30, 90, 144]) {
    const h = harness(); h.run.distance = 1400; h.run.weapon = 'storm'; h.battle.startBoss(h.run);
    let elapsed = 0, sawEnrage = false;
    while (h.battle.boss && elapsed < 60) {
      const dt = 1 / hz, previous = h.run.distance; h.run.distance += 60 * dt; elapsed += dt;
      h.run.shotCooldown = Math.max(0, h.run.shotCooldown - dt);
      h.battle.render(dt, h.run.distance, elapsed);
      const b = h.battle.boss; sawEnrage ||= b.phase === 2;
      const target = b.sigils.find(s => s.active) || b;
      h.battle.fire(h.run, h.aimAt(target), h.camera); h.battle.update(dt, h.run, previous);
    }
    assert.equal(h.run.bosses, 1, `boss defeated at ${hz} Hz`); assert.equal(sawEnrage, true); assert.ok(elapsed > 10 && elapsed < 60);
    assert.ok(h.battle.fx.length <= 64 && h.shots.length <= 64 && h.bullets.length <= 64); h.battle.clear();
  }
});
