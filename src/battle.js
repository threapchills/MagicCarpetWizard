import * as THREE from 'three';
import { RADIUS, SPELLS, clamp, lerp, award, multiplier, collectSpell, segmentHitsSphere } from './game.js';
import { WEAPONS, weaponProfile, tickBuffs, damageFor, makeBoss, moveBoss, bossPhase, attackTargets } from './combat.js';
import { FOES, moveEnemy } from './foes.js';
import { createHalo, glowCore } from './glow.js';
import { elevationAt } from './landscape.js';
import { balanceAt, FIRST_BOSS_DISTANCE } from './pacing.js';
import { mesh, mat, gem, orb, createEnemy, createPickup, placeOnTerrain as placeOnWorld } from './world.js';

const hoop = new THREE.TorusGeometry(1, .055, 5, 36);
const arrowShaft = new THREE.CylinderGeometry(.07, .07, 2.8, 5);
const colors = { fire: '#ff6b25', storm: '#aeeaff', wind: '#b8ffe6' };

export class Battle {
  constructor(scene, chunks, bullets, shots, hooks) {
    Object.assign(this, { scene, chunks, bullets, shots, hooks });
    this.fx = []; this.drops = []; this.boss = null; this.nextBoss = FIRST_BOSS_DISTANCE; this.warning = false;
    this.shake = 0; this.killsAtBoss = 0; this.castPulse = 0; this.temp = new THREE.Vector3();
    this.roamers = []; this.encounters = 0;
  }
  clear() {
    for (const e of this.roamers) this.scene.remove(e.visual); this.roamers.length = 0; this.encounters = 0;
    for (const f of this.fx) { this.scene.remove(f.visual); f.geometry?.dispose(); }
    for (const p of this.drops) this.scene.remove(p.visual);
    if (this.boss) { this.scene.remove(this.boss.visual); this.boss.sigils.forEach(s => this.scene.remove(s.visual)); }
    this.fx.length = this.drops.length = 0; this.boss = null; this.nextBoss = FIRST_BOSS_DISTANCE; this.warning = false; this.killsAtBoss = 0; this.shake = this.castPulse = 0;
    this.hooks.bossUI(null);
  }
  targets() {
    const list = [];
    for (const c of this.chunks.values()) for (const e of c.enemies) if (e.active && !this.boss) list.push(e);
    for (const c of this.chunks.values()) for (const p of c.props || []) if (p.active && p.visual && !c.combatClear && !this.boss) list.push(p);
    if (!this.boss) list.push(...this.roamers.filter(e => e.active));
    if (this.boss) list.push(...this.boss.sigils.filter(s => s.active), this.boss);
    return list;
  }
  retainEnemy(e, distance) {
    if (this.boss || !e.active || !FOES[e.kind]?.mobile || e.s < distance - 35 || e.s > distance + 220) return false;
    if (this.roamers.length >= 10) this.scene.remove(this.roamers.shift().visual);
    this.roamers.push(e); return true;
  }
  lock(run, aim, camera) {
    let found = null, closest = .25;
    for (const e of this.targets()) {
      if (e.boss && e.shield || e.s < run.distance + 3 || e.s > run.distance + 185) continue;
      this.temp.copy(e.visual.position).project(camera);
      if (this.temp.z > 1 || this.temp.z < -1) continue;
      const delta = Math.hypot(this.temp.x - aim.x, this.temp.y - aim.y);
      if (delta < closest) { closest = delta; found = e; }
    }
    return found;
  }
  switchWeapon(run, kind) {
    if (!WEAPONS.includes(kind)) return;
    run.weapon = kind; this.hooks.tray();
    this.hooks.notify(`${SPELLS[kind].name} · ${kind === 'wind' ? 'clear shots and fan burning foes' : kind === 'storm' ? 'instant strikes and chaining arcs' : 'explosive impacts and burning damage'}`, 2, 1);
  }
  addFX(f) {
    if (this.fx.length >= 64) { const old = this.fx.shift(); this.scene.remove(old.visual); old.geometry?.dispose(); }
    this.fx.push(f);
  }
  ring(x, y, s, color, radius = 6, life = .35) {
    this.hooks.magic?.burst(x, y, s, color, radius);
    const visual = mesh(hoop, color, this.scene, [0, 0, 0], [1, 1, 1], [0, 0, 0], true);
    this.addFX({ visual, x, y, s, life, maxLife: life, radius, ring: true });
  }
  arc(a, b, color = colors.storm) {
    const points = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, jitter = i === 0 || i === 12 ? 0 : 1.5;
      const x = lerp(a.x, b.x, t) + (Math.random() - .5) * jitter;
      const radius = RADIUS + lerp(a.y, b.y, t) + (Math.random() - .5) * jitter - x * x / (2 * RADIUS);
      const angle = (b.s - a.s) * t / RADIUS;
      points.push(new THREE.Vector3(x, Math.cos(angle) * radius - RADIUS, -Math.sin(angle) * radius));
    }
    const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, .14, 4, false);
    // Geometry is relative to the source's forward position; model placement
    // follows the planet as the carpet advances during the short arc lifetime.
    const visual = new THREE.Mesh(geometry, mat(color, true)); this.scene.add(visual);
    this.addFX({ visual, geometry, x: 0, y: 0, s: a.s, life: .13, maxLife: .13 });
    this.ring(b.x, b.y, b.s, '#ffffff', 2.5, .16);
  }
  drop(kind, x, y, s) {
    if (this.drops.length >= 24) { const old = this.drops.shift(); this.scene.remove(old.visual); }
    const visual = createPickup(kind); this.scene.add(visual);
    this.drops.push({ kind, x, y, s, visual });
  }
  collect(run, kind) {
    const maxed = run.spells[kind] >= 3;
    collectSpell(run, kind); this.hooks.tray(); this.hooks.sound.trick();
    this.hooks.notify(maxed ? 'MAX LEVEL · OVERDRIVE! Extra shots for 8s' : SPELLS[kind].description, 2.6, 2);
  }
  kill(e, run) {
    if (!e.active) return;
    e.active = false; e.visual.visible = false; this.shake = Math.max(this.shake, e.boss ? 1.1 : .32);
    if (e.destructible) { this.ring(e.x, e.y, e.s, '#ffc687', 6, .35); this.hooks.particles(e.x, e.y, e.s, '#d69c66', 18); this.hooks.sound.impact('fire'); award(run, 30, 4, false); return; }
    this.hooks.blood.burst(e.x, e.y, e.s, e.boss ? 60 : 30);
    this.ring(e.x, e.y, e.s, '#ff462a', e.boss ? 23 : 7, .55); this.hooks.sound.kill();
    if (e.sigil) { award(run, 80, 6); this.hooks.notify('WARD SIGIL SHATTERED', 1.1, 2); return; }
    if (e.boss) {
      run.bosses++; award(run, 2000, 50); collectSpell(run, 'ward'); collectSpell(run, 'overdrive');
      this.drop(WEAPONS[run.bosses % 3], run.x, run.altitude, run.distance + 25);
      this.drop('fury', run.x, run.altitude, run.distance + 40);
      this.hooks.notify('BOSS SLAIN · +2,000 · HEART RESTORED · OVERDRIVE', 5, 5);
      this.scene.remove(e.visual); e.sigils.forEach(s => this.scene.remove(s.visual)); this.boss = null;
      this.shots.forEach(p => this.scene.remove(p.visual)); this.shots.length = 0;
      this.nextBoss = run.distance + balanceAt(run.distance).bossSpacing; this.killsAtBoss = run.kills; this.warning = false;
      this.hooks.arena(false); this.hooks.bossUI(null); this.hooks.tray(); return;
    }
    run.kills++; award(run, 180, 12);
    const loot = ['fire', 'rapid', 'storm', 'fury', 'wind', 'focus', 'frost', 'echo', 'ward', 'magnet'];
    this.drop(run.hp === 1 && run.kills % 3 === 0 ? 'ward' : loot[(run.kills - 1) % loot.length], e.x, e.y, e.s);
    this.hooks.notify(`${(FOES[e.kind]?.name || e.kind).toUpperCase()} SLAIN · +${180 * multiplier(run)}`, 1, 0);
  }
  hit(e, profile, run, scale = 1) {
    if (!e.active || e.boss && e.shield) return;
    e.hp -= damageFor(profile, e) * scale;
    this.hooks.hit();
    if (profile.kind === 'fire') { e.burn = 2.5; e.burnDps = profile.damage * .30; }
    if (profile.frost) e.frozen = 1.2 + profile.frost * .35;
    if (profile.kind === 'wind') {
      e.stagger = e.boss ? .25 : 1.1;
      if (!e.boss && !e.sigil && !e.destructible) { e.pushS = Math.min(24, (e.pushS || 0) + 10); e.pushY = Math.min(10, (e.pushY || 0) + 3); }
      if (e.burn > 0) this.ring(e.x, e.y, e.s, colors.fire, 9);
    }
    this.hooks.particles(e.x, e.y, e.s, colors[profile.kind], 8);
    if (e.hp <= 0) this.kill(e, run); else if (!e.sigil && !e.destructible) this.hooks.blood.burst(e.x, e.y, e.s, 3);
  }
  fire(run, aim, camera) {
    if (run.shotCooldown > 0 || this.bullets.length >= 60) return;
    const profile = weaponProfile(run); profile.frost = run.spells.frost;
    run.shotCooldown = profile.cooldown; this.hooks.sound.spell(profile.kind); this.castPulse = .14;
    let target = this.lock(run, aim, camera), endpoint;
    if (target) endpoint = { x: target.x, y: target.y, s: target.s };
    else {
      const ray = new THREE.Vector3(aim.x, aim.y, .5).unproject(camera).sub(camera.position).normalize();
      const t = (-100 - camera.position.z) / Math.min(-.01, ray.z);
      const p = camera.position.clone().addScaledVector(ray, t);
      endpoint = { x: clamp(p.x, -140, 140), y: clamp(p.y + 10000 / (2 * RADIUS) - elevationAt(run.distance + 100), .3, 100), s: run.distance + 100 };
    }
    const source = { x: run.x, y: run.altitude + 1, s: run.distance + 2 };
    this.hooks.magic?.cast(source, profile.kind);
    this.ring(source.x, source.y, source.s, '#fff4c5', 1.6, .13);
    if (profile.kind === 'storm') {
      if (!target) target = this.targets().filter(e => !(e.boss && e.shield) && segmentHitsSphere(source, endpoint, e, e.radius || 2.4))[0];
      this.arc(source, target || endpoint);
      if (target) {
        this.hooks.magic?.burst(target.x, target.y, target.s, colors.storm, 5);
        const visited = new Set(); let current = target;
        for (let n = 0; current && n < profile.chains + profile.shots - 1; n++) {
          visited.add(current); this.hit(current, profile, run, Math.pow(.78, n));
          const next = this.targets().filter(e => !visited.has(e) && !(e.boss && e.shield) && Math.hypot(e.x - current.x, e.y - current.y, e.s - current.s) < 42)
            .sort((a, b) => Math.hypot(a.x - current.x, a.y - current.y, a.s - current.s) - Math.hypot(b.x - current.x, b.y - current.y, b.s - current.s))[0];
          if (next) this.arc(current, next); current = next;
        }
        this.hooks.sound.impact('storm'); this.shake = Math.max(this.shake, .16);
      }
      return;
    }
    const ds = Math.max(8, endpoint.s - source.s);
    for (let i = 0; i < profile.shots && this.bullets.length < 64; i++) {
      const spread = (i - (profile.shots - 1) / 2) * profile.spread;
      const visual = new THREE.Group(); this.scene.add(visual);
      if (profile.kind === 'fire') {
        mesh(orb, '#ff531b', visual, [0, 0, 0], [.75, .75, 1.3], [0, 0, 0], true);
        mesh(gem, '#fff0a3', visual, [0, 0, .65], [.47, .47, 1.1], [0, 0, 0], true);
        mesh(hoop, '#ffd474', visual, [0, 0, 0], [1, 1, 1], [.3, .5, 0], true);
      } else {
        for (let j = 0; j < 3; j++) mesh(hoop, j === 1 ? '#ffffff' : colors.wind, visual, [0, 0, j * 1.7], [profile.radius * (1 - j * .2), profile.radius * (1 - j * .2), 1], [0, 0, j], true);
      }
      visual.traverse(o => { if (o.isMesh && o.material === mat('#ff531b', true)) o.material = glowCore('#ff722c'); });
      visual.add(createHalo(profile.kind === 'fire' ? '#ff8d42' : '#66ffc5', profile.kind === 'fire' ? 7 : 12));
      this.bullets.push({ visual, ...source, vx: ((endpoint.x - source.x) / ds + spread) * profile.speed, vy: (endpoint.y - source.y) / ds * profile.speed,
        profile, speed: profile.speed, life: 1.25, trail: 0, hits: new Set(), pierce: profile.pierce });
    }
  }
  launch(enemy, targets, run, speed = 34) {
    const pace = balanceAt(run.distance).projectileSpeed;
    speed *= pace;
    for (const target of targets) {
      if (this.shots.length >= 64) break;
      const behind = enemy.s < run.distance, vs = behind ? 155 * pace : -speed;
      const arrival = Math.max(.35, Math.abs(enemy.s - run.distance) / Math.max(25, behind ? vs - run.speed : run.speed + speed));
      const arrow = !!FOES[enemy.kind]?.arrow, gravity = arrow ? 9 : 0;
      const visual = new THREE.Group(); this.scene.add(visual);
      if (arrow) {
        mesh(arrowShaft, '#402b2e', visual, [0, 0, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
        mesh(gem, '#ffae39', visual, [0, 0, -1.5], [.25, .25, .65], [0, 0, 0], true);
      } else mesh(gem, enemy.kind === 'wizard' ? '#ba8bff' : enemy.kind === 'scarab' ? '#a1ffb4' : '#ff6631', visual, [0, 0, 0], [.6, .6, 1.3], [0, 0, 0], true);
      const tint = enemy.kind === 'wizard' ? '#c586ff' : enemy.kind === 'scarab' ? '#87ff9f' : '#ff7f32';
      visual.children[visual.children.length - 1].material = glowCore(tint); visual.add(createHalo(tint, arrow ? 5 : 7));
      this.shots.push({ visual, x: enemy.x, y: enemy.y, s: enemy.s, vx: (target.x - enemy.x) / arrival, vy: (target.y - enemy.y + .5 * gravity * arrival * arrival) / arrival, speed, vs, gravity, arrow, life: 5 });
    }
    this.ring(enemy.x, enemy.y, enemy.s, '#ff7359', enemy.boss ? 12 : 4);
  }
  status(e, dt, run) {
    e.frozen = Math.max(0, (e.frozen || 0) - dt); e.stagger = Math.max(0, (e.stagger || 0) - dt);
    if (e.burn > 0 && !(e.boss && e.shield)) {
      const burnDt = Math.min(dt, e.burn); e.burn -= burnDt; e.hp -= burnDt * e.burnDps;
      if (e.hp <= 0) this.kill(e, run);
    }
  }
  updateEnemy(e, dt, distance, run, playing, time) {
    if (!e.active) return;
    e.visual.visible = !this.boss && e.s - distance < 230 && e.s - distance > -75;
    if (!e.visual.visible) return;
    if (playing && e.s - distance < 230 && e.s - distance > -75) {
      this.status(e, dt, run); if (!e.active) return;
      const rule = FOES[e.kind] || FOES.stalker, leaping = e.leap != null, balance = balanceAt(distance);
      moveEnemy(e, run, dt);
      if (e.kind === 'fish' && !leaping && e.leap != null) this.ring(e.baseX, .25, e.baseS, '#b7ffff', 5, .6);
      if (!e.active) { this.ring(e.x, .25, e.s, '#b7ffff', 4, .5); return; }
      const ahead = e.s - distance;
      if ((ahead > 8 || rule.mobile && ahead > -55) && ahead < 170 && !e.stagger && e.kind !== 'fish') {
        e.cooldown -= dt * (e.frozen ? .3 : 1);
        if (e.cooldown < rule.warning * balance.warning && !e.aimTargets) {
          e.aimTargets = attackTargets(e, run, e.kind === 'hexer' || e.kind === 'dragon');
          if (e.kind === 'wizard') for (const target of e.aimTargets) { target.x = clamp(target.x + run.vx * .25, -52, 52); target.y = clamp(target.y + run.vy * .2, 2, 52); }
        }
        if (e.cooldown <= 0) { this.launch(e, e.aimTargets || attackTargets(e, run), run, rule.speed); e.aimTargets = null; e.cooldown = rule.interval * balance.attackInterval; }
      }
      if (Math.abs(ahead) < 2.5 && Math.hypot(e.x - run.x, e.y - run.altitude) < e.radius) this.hooks.hurt();
    }
    placeOnWorld(e.visual, e.x, e.s, e.y, distance); e.visual.rotation.z = Math.sin(time * 1.7 + e.phase) * .10;
    if (e.kind === 'fish') { e.visual.visible = e.y > -.3; e.visual.rotation.x += e.leap == null ? 0 : (e.leap / 1.65 - .5) * 2; }
    if (e.kind === 'guard' || e.kind === 'bandit') e.visual.rotation.z = 0;
    for (const wing of e.visual.userData.limbs || []) wing.object.rotation.z = wing.side * Math.sin(time * 7 + e.phase) * .45;
    const feedback = e.visual.userData;
    feedback.health.scale.x = 1.8 * clamp(e.hp / e.maxHp, 0, 1); feedback.health.position.x = -.9 * (1 - e.hp / e.maxHp);
    feedback.frost.visible = e.frozen > 0; feedback.frost.rotation.y = time;
    feedback.burn.visible = e.burn > 0; feedback.burn.scale.setScalar(1 + Math.sin(time * 19) * .1);
    feedback.charge.visible = !!e.aimTargets;
    feedback.charge.scale.setScalar(1.7 + Math.sin(time * 13) * .2);
    e.visual.scale.setScalar(feedback.baseScale * (e.stagger ? .92 : 1));
  }
  sigils(boss) {
    boss.sigils.forEach(s => this.scene.remove(s.visual));
    boss.sigils = [];
    for (let i = 0; i < (boss.wards || 0); i++) {
      const visual = createPickup('storm'); visual.scale.setScalar(2); this.scene.add(visual);
      boss.sigils.push({ sigil: true, active: true, hp: 3, maxHp: 3, x: 0, y: 0, s: boss.s, radius: 3.5, angle: i * Math.PI * 2 / boss.wards, visual, frozen: 0, burn: 0 });
    }
    boss.shield = boss.sigils.length > 0;
  }
  startBoss(run) {
    this.boss = makeBoss(++this.encounters, run.distance); const b = this.boss;
    const balance = balanceAt(run.distance); b.interval *= balance.attackInterval; b.cooldown *= balance.warning; b.warningTime = .65 * balance.warning;
    b.visual = createEnemy(b.kind); b.visual.scale.setScalar(b.scale); this.scene.add(b.visual); b.visual.userData.health.visible = b.visual.userData.healthBack.visible = false;
    for (const e of this.roamers) this.scene.remove(e.visual); this.roamers.length = 0;
    this.sigils(b); this.hooks.arena(true); this.shots.forEach(p => this.scene.remove(p.visual)); this.shots.length = 0;
    this.hooks.notify(`${b.name} · ${b.shield ? 'BREAK TWO WARDS' : 'ATTACK OR OUTRUN IT'}`, 4, 5); this.hooks.sound.roar(); this.shake = .5;
  }
  escapeBoss(run, outrun) {
    const b = this.boss; if (!b) return;
    this.scene.remove(b.visual); b.sigils.forEach(s => this.scene.remove(s.visual)); this.boss = null;
    this.shots.forEach(p => this.scene.remove(p.visual)); this.shots.length = 0;
    this.nextBoss = run.distance + balanceAt(run.distance).bossSpacing; this.killsAtBoss = run.kills; this.warning = false;
    if (outrun) award(run, 350, 15);
    this.hooks.notify(outrun ? 'BOSS OUTRUN · +350 · THE SKY IS YOURS' : 'THE HUNTER BREAKS AWAY · KEEP FLYING', 3, 5);
    this.hooks.arena(false); this.hooks.bossUI(null);
  }
  updateBoss(dt, run) {
    const b = this.boss;
    if (!b) {
      if (run.distance > this.nextBoss - 180 && !this.warning) { this.warning = true; this.hooks.notify('SOMETHING ENORMOUS IS HUNTING YOU…', 3, 4); this.hooks.sound.roar(); }
      if (run.distance >= this.nextBoss) this.startBoss(run);
      return;
    }
    moveBoss(b, run, dt);
    if (b.s < run.distance - 85 || b.s > run.distance + 310 || b.age > 35) { this.escapeBoss(run, b.s < run.distance - 85); return; }
    this.status(b, dt, run); if (!this.boss) return;
    for (const s of b.sigils) {
      if (!s.active) continue;
      this.status(s, dt, run);
      const a = s.angle + b.age * .45; s.x = b.x + Math.cos(a) * 15; s.y = b.y + Math.sin(a) * 13; s.s = b.s - 3;
    }
    b.shield = b.sigils.some(s => s.active);
    if (bossPhase(b.hp, b.maxHp) > b.phase) {
      b.phase = 2; b.cooldown = Math.min(b.cooldown, .8); b.aimTargets = null;
      this.hooks.notify('ENRAGED · FINISH IT OR BURN PAST', 2, 5); this.hooks.sound.roar();
    }
    if (!b.stagger) b.cooldown -= dt * (b.frozen ? .65 : 1);
    if (b.cooldown < b.warningTime && !b.aimTargets) {
      b.aimTargets = attackTargets(b, run, b.kind === 'dragon' || b.kind === 'scarab');
      if (b.kind === 'wizard') for (const target of b.aimTargets) { target.x = clamp(target.x + run.vx * .3, -52, 52); target.y = clamp(target.y + run.vy * .25, 2, 52); }
      if (b.kind === 'serpent') b.aimTargets.push({ x: run.x, y: clamp(run.altitude + 12, 2, 52) }, { x: run.x, y: clamp(run.altitude - 12, 2, 52) });
      this.hooks.notify(b.kind === 'dragon' ? 'DRAGONFIRE · WEAVE!' : b.kind === 'wizard' ? 'HEX MARKED · CHANGE DIRECTION!' : b.kind === 'scarab' ? 'SWARM VOLLEY · WIND BLAST!' : 'WYRM STRIKE · DODGE!', .8, 3);
    }
    if (b.cooldown <= 0) {
      this.launch(b, b.aimTargets || attackTargets(b, run), run, b.phase === 2 ? 88 : 70);
      b.attack++; b.cooldown = b.interval * (b.phase === 2 ? .73 : 1); b.aimTargets = null;
      if (b.attack % 3 === 0) this.drop(b.attack % 6 === 0 ? 'ward' : 'rapid', run.x, run.altitude, run.distance + 35);
    }
    if (Math.abs(b.s - run.distance) < b.radius && Math.hypot(b.x - run.x, b.y - run.altitude) < b.radius && !run.roll) this.hooks.hurt();
    this.hooks.bossUI(b);
  }
  update(dt, run, previousDistance, race = false) {
    tickBuffs(run, dt); if (!race) this.updateBoss(dt, run);
    for (const c of this.chunks.values()) for (const p of c.props || []) if (p.active && p.burn) this.status(p, dt, run);
    for (let i = this.roamers.length - 1; i >= 0; i--) {
      const e = this.roamers[i]; this.updateEnemy(e, dt, run.distance, run, true, run.time);
      if (!e.active || e.s < run.distance - 75 || e.s > run.distance + 240 || e.age > 16) { this.scene.remove(e.visual); this.roamers.splice(i, 1); }
    }
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i], from = { x: b.x, y: b.y, s: b.s }, p = b.profile;
      b.x += b.vx * dt; b.y += b.vy * dt; b.s += b.speed * dt; b.life -= dt; b.trail += dt;
      if (p.kind === 'fire' && b.trail > .045) { b.trail = 0; this.hooks.particles(b.x, b.y, b.s, '#ff9a35', 2); }
      let collision = false;
      const targets = this.targets().sort((a, c) => a.s - c.s);
      for (const e of targets) {
        if (b.hits.has(e) || !e.active || !segmentHitsSphere(from, b, e, (e.radius || 2.4) + (p.kind === 'wind' ? p.radius : .75))) continue;
        b.hits.add(e); this.hit(e, p, run); collision = true;
        if (p.kind === 'fire') {
          for (const other of targets) if (other !== e && other.active && !b.hits.has(other) && Math.hypot(other.x - e.x, other.y - e.y, other.s - e.s) < p.radius + (other.radius || 2)) { this.hit(other, p, run, .6); b.hits.add(other); }
          this.ring(e.x, e.y, e.s, '#ffae43', p.radius, .4); this.hooks.sound.impact('fire'); this.shake = Math.max(this.shake, .2);
          if (b.pierce-- <= 0) { b.life = 0; break; }
        }
      }
      if (p.kind === 'wind') {
        for (let j = this.shots.length - 1; j >= 0; j--) {
          const shot = this.shots[j];
          if (segmentHitsSphere(from, b, shot, p.radius + 1)) { this.scene.remove(shot.visual); this.shots.splice(j, 1); award(run, 10, 1, false); this.ring(shot.x, shot.y, shot.s, '#ffffff', 3, .2); }
        }
        if (collision) this.hooks.sound.impact('wind');
      }
      if (b.life <= 0) { this.scene.remove(b.visual); this.bullets.splice(i, 1); }
    }
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const p = this.shots[i], from = { x: p.x, y: p.y, s: p.s - previousDistance };
      p.s += (p.vs ?? -p.speed) * dt; p.x += p.vx * dt; p.y += p.vy * dt - .5 * (p.gravity || 0) * dt * dt; p.vy -= (p.gravity || 0) * dt; p.life -= dt;
      if (segmentHitsSphere(from, { x: p.x, y: p.y, s: p.s - run.distance }, { x: run.x, y: run.altitude, s: 0 }, 1.5)) {
        if (run.roll) { award(run, 35, 4); this.hooks.notify('SPELL SLIP · +SKYFIRE', 1); } else this.hooks.hurt(); p.life = 0;
      }
      if (p.life <= 0 || p.s < run.distance - 110 || p.s > run.distance + 250 || p.y < -3) { this.scene.remove(p.visual); this.shots.splice(i, 1); }
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const p = this.drops[i], ahead = p.s - run.distance, d = Math.hypot(p.x - run.x, p.y - run.altitude, ahead);
      if (d < 12 + run.spells.magnet * 4) { p.x = lerp(p.x, run.x, 1 - Math.exp(-dt * 8)); p.y = lerp(p.y, run.altitude, 1 - Math.exp(-dt * 8)); }
      if (d < 4.5 + run.spells.magnet || ahead < -12) {
        if (d < 4.5 + run.spells.magnet) this.collect(run, p.kind);
        this.scene.remove(p.visual); this.drops.splice(i, 1);
      }
    }
  }
  render(dt, distance, time) {
    for (const e of this.roamers) this.updateEnemy(e, 0, distance, {}, false, time);
    this.shake = Math.max(0, this.shake - dt * 2.5); this.castPulse = Math.max(0, this.castPulse - dt);
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i]; f.life -= dt;
      if (f.life <= 0) { this.scene.remove(f.visual); f.geometry?.dispose(); this.fx.splice(i, 1); continue; }
      placeOnWorld(f.visual, f.x, f.s, f.y, distance);
      if (f.ring) f.visual.scale.setScalar(f.radius * (1 - f.life / f.maxLife) + .2);
    }
    for (const b of this.bullets) { placeOnWorld(b.visual, b.x, b.s, b.y, distance); b.visual.rotation.z = time * 9; }
    for (const p of this.shots) { placeOnWorld(p.visual, p.x, p.s, p.y, distance); p.visual.rotation.y = Math.atan2(-p.vx, p.vs ?? -p.speed); p.visual.rotation.x += Math.atan2(p.vy, Math.abs(p.vs ?? p.speed)); if (!p.arrow) p.visual.rotation.z = time * 6; }
    for (const p of this.drops) { placeOnWorld(p.visual, p.x, p.s, p.y, distance); p.visual.rotation.y = time * 2; }
    if (this.boss) {
      const b = this.boss; placeOnWorld(b.visual, b.x, b.s, b.y, distance); b.visual.rotation.z = Math.sin(time) * .07;
      for (const wing of b.visual.userData.limbs || []) wing.object.rotation.z = wing.side * Math.sin(time * 6) * .4;
      b.visual.userData.charge.visible = b.shield || !!b.aimTargets;
      b.visual.userData.charge.scale.setScalar(b.shield ? 2.8 : 1.6 + Math.sin(time * 14) * .3);
      b.visual.userData.frost.visible = b.frozen > 0;
      b.visual.userData.burn.visible = b.burn > 0 && !b.shield;
      for (const s of b.sigils) if (s.active) { placeOnWorld(s.visual, s.x, s.s, s.y, distance); s.visual.rotation.z = time; }
    }
  }
}
