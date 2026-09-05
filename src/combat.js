import { clamp } from './game.js';

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
export function tickBuffs(run, dt) { for (const key of Object.keys(run.buffs)) run.buffs[key] = Math.max(0, run.buffs[key] - dt); }
export function damageFor(profile, enemy) {
  return profile.damage * (profile.kind === 'fire' && enemy.frozen > 0 ? 1.8 : 1)
    * (profile.kind === 'wind' && enemy.burn > 0 ? 1.5 : 1);
}
export function bossPhase(hp, maxHp) { return hp > maxHp * .5 ? 1 : 2; }
export const BOSS_TYPES = [
  { kind: 'dragon', name: 'AZRAKH · THE CINDER DRAGON', hp: 30, speed: 57, interval: 1.5, radius: 7, scale: 2.3 },
  { kind: 'wizard', name: 'SAHIR · THE EXILED VIZIER', hp: 24, speed: 61, interval: 1.25, radius: 5, scale: 2.6 },
  { kind: 'scarab', name: 'KHEPRI · THE IRON SWARM', hp: 32, speed: 51, interval: 1.65, radius: 7, scale: 3.2, wards: 2 },
  { kind: 'serpent', name: 'NADIRA · THE SAND WYRM', hp: 28, speed: 55, interval: 1.4, radius: 6, scale: 3 },
];
export function makeBoss(number, distance) {
  const type = BOSS_TYPES[(number - 1) % BOSS_TYPES.length], hp = type.hp + Math.min(6, Math.floor((number - 1) / 4) * 2);
  return { ...type, boss: true, number, x: 0, y: 22, s: distance + 105, hp, maxHp: hp, active: true, phase: 1,
    age: 0, cooldown: 1.1, attack: 0, frozen: 0, burn: 0, stagger: 0, sigils: [], shield: !!type.wards };
}
export function moveBoss(b, run, dt) {
  b.age += dt;
  const cycle = b.age % 5, charge = cycle > 3.9, rate = b.frozen ? .75 : 1;
  // World speed is independent of the rider: boosts can pass it, while high flight loses ground.
  b.speed = (BOSS_TYPES[(b.number - 1) % BOSS_TYPES.length].speed + (charge ? 25 : -5)) * rate;
  b.s += b.speed * dt;
  const x = b.kind === 'wizard' ? Math.sin(b.age * 1.9) * 36 : b.kind === 'serpent' ? Math.sin(b.age * .85) * 38 : clamp(run.x * .6 + Math.sin(b.age * .9) * 20, -42, 42);
  const y = b.kind === 'serpent' ? 6 + Math.abs(Math.sin(b.age * .8)) * 27 : b.kind === 'scarab' ? 14 + Math.sin(b.age) * 7 : clamp(run.altitude + 7 + Math.sin(b.age * 1.4) * 10, 9, 43);
  b.x += clamp(x - b.x, -22 * dt * rate, 22 * dt * rate); b.y += clamp(y - b.y, -15 * dt * rate, 15 * dt * rate);
  b.charging = charge;
}
export function attackTargets(enemy, run, fan = false) {
  // Aim is captured when the warning starts, allowing the player to dodge it.
  const offsets = fan ? [-22, -11, 0, 11, 22] : [0];
  return offsets.map(x => ({ x: clamp(run.x + x, -62, 62), y: run.altitude, s: run.distance }));
}
