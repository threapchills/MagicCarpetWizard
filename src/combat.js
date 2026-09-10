import { clamp } from './game.js';
import { balanceAt } from './pacing.js';

export const WEAPONS = ['fire', 'storm', 'wind'];
export const BOOSTS = { rapid: 10, fury: 10, focus: 12, overdrive: 8 };
export function weaponProfile(run, kind = run.weapon) {
  const level = clamp(run.spells[kind] || 1, 1, 3), buffs = run.buffs;
  const p = kind === 'storm'
    ? { kind, damage: 3 + level * .6, cooldown: .58 - level * .035, radius: 2, chains: level + 1, speed: 0 }
    : kind === 'wind'
      ? { kind, damage: 1.6 + level * .5, cooldown: .65 - level * .045, radius: 5 + level * 1.2, speed: 230, chains: 0 }
      : { kind, damage: 2.2 + level * .7, cooldown: .40 - level * .025, radius: 4 + level * 1.5, speed: 280, chains: 0 };
  p.shots = 1 + Math.min(2, run.spells.echo || 0);
  p.damage *= buffs.fury > 0 ? 1.4 : 1;
  p.cooldown *= buffs.rapid > 0 ? .72 : 1;
  p.radius += buffs.fury > 0 ? 2 : 0;
  p.pierce = buffs.focus > 0 ? 1 : 0;
  p.spread = buffs.focus > 0 ? .012 : .035;
  if (buffs.overdrive > 0) { p.shots = Math.min(4, p.shots + 1); p.damage *= 1.15; }
  return p;
}
export function tickBuffs(run, dt) {
  for (const key of Object.keys(run.buffs)) run.buffs[key] = Math.max(0, run.buffs[key] - dt);
  if (run.magnetTime > 0) { run.magnetTime = Math.max(0, run.magnetTime - dt); if (!run.magnetTime) run.spells.magnet = 0; }
}
export function damageFor(profile, enemy) {
  return profile.damage * (profile.kind === 'fire' && enemy.frozen > 0 ? 1.8 : 1)
    * (profile.kind === 'wind' && enemy.burn > 0 ? 1.5 : 1);
}
export function bossPhase(hp, maxHp) { return hp > maxHp * .5 ? 1 : 2; }
export const BOSS_TYPES = [
  { kind: 'dragon', name: 'EMBERWRACK · THE CINDER DRAGON', hp: 30, speed: 57, interval: 1.5, radius: 7, scale: 2.3 },
  { kind: 'wizard', name: 'MALGRAVE · THE HOLLOW WARLOCK', hp: 24, speed: 61, interval: 1.25, radius: 5, scale: 2.6 },
  { kind: 'scarab', name: 'CARAPAX · THE IRON SWARM', hp: 32, speed: 51, interval: 1.65, radius: 7, scale: 3.2, wards: 2 },
  { kind: 'serpent', name: 'VORRAX · THE SAND WYRM', hp: 28, speed: 55, interval: 1.4, radius: 6, scale: 3 },
];
export function makeBoss(number, distance) {
  const type = BOSS_TYPES[(number - 1) % BOSS_TYPES.length], { strength, mastery } = balanceAt(distance);
  const hp = Math.round(type.hp * (1.08 + .48 * strength + .16 * mastery));
  return { ...type, boss: true, number, x: 0, y: 22, s: distance + 105, hp, maxHp: hp, active: true, phase: 1,
    pursuit: strength, maxSpeed: 92 + 78 * strength + 20 * mastery, maxDuration: 50 + 30 * strength,
    age: 0, cooldown: 1.1, attack: 0, frozen: 0, burn: 0, stagger: 0, sigils: [], shield: !!type.wards };
}
export function moveBoss(b, run, dt) {
  b.age += dt;
  const cycle = b.age % 5, charge = cycle > 3.9, rate = b.frozen ? .75 : 1;
  // Close on the rider in world space, with finite acceleration and a speed cap.
  // Early boosts can still escape; experienced riders must fight the pursuit.
  const pressure = b.pursuit, gap = b.s - run.distance;
  const targetGap = (charge ? 44 : 78) - pressure * 22;
  const desired = clamp(run.speed + (targetGap - gap) * (1.1 + pressure), 12, b.maxSpeed) * rate;
  const acceleration = (80 + 90 * pressure) * dt;
  b.speed += clamp(desired - b.speed, -acceleration, acceleration);
  b.s += b.speed * dt;
  const weave = b.kind === 'wizard' ? Math.sin(b.age * 1.9) * 28 : b.kind === 'serpent' ? Math.sin(b.age * .85) * 30 : Math.sin(b.age * .9) * 20;
  const x = clamp(run.x * (.6 + pressure * .35) + weave * (1 - pressure * .5), -52, 52);
  const y = b.kind === 'serpent' ? 6 + Math.abs(Math.sin(b.age * .8)) * 27 : b.kind === 'scarab' ? 14 + Math.sin(b.age) * 7 : clamp(run.altitude + 7 + Math.sin(b.age * 1.4) * 10, 9, 43);
  const lateral = (22 + pressure * 20) * dt * rate;
  b.x += clamp(x - b.x, -lateral, lateral); b.y += clamp(y - b.y, -15 * dt * rate, 15 * dt * rate);
  b.charging = charge;
}
export function attackTargets(enemy, run, fan = false) {
  // Aim is captured when the warning starts, allowing the player to dodge it.
  const offsets = fan ? [-22, -11, 0, 11, 22] : [0];
  return offsets.map(x => ({ x: clamp(run.x + x, -62, 62), y: run.altitude, s: run.distance }));
}
