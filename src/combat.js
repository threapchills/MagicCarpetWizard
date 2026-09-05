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
export function makeBoss(number, distance) {
  const hp = 82 + Math.min(4, number) * 22;
  return { boss: true, number, name: ['AZRAKH · THE ASH DEVOURER', 'ZAHRA · QUEEN OF THE TEMPEST', 'MALIK · THE HOLLOW KING'][(number - 1) % 3],
    x: 0, y: 22, s: distance + 95, hp, maxHp: hp, radius: 7, active: true, phase: 1,
    age: 0, cooldown: 3, attack: 0, frozen: 0, burn: 0, stagger: 0, sigils: [], shield: true };
}
export function attackTargets(enemy, run, fan = false) {
  // Aim is captured when the warning starts, allowing the player to dodge it.
  const offsets = fan ? [-22, -11, 0, 11, 22] : [0];
  return offsets.map(x => ({ x: clamp(run.x + x, -62, 62), y: run.altitude, s: run.distance }));
}
