// Encounter rules have no renderer dependencies, so generation and AI can be tested directly.
import { balanceAt } from './pacing.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const FOES = {
  stalker: { name: 'Dune stalker', hp: 5, radius: 2.4, interval: 2, warning: .7, speed: 48 },
  brute: { name: 'Ogre', hp: 8, radius: 3.1, interval: 2.3, warning: .8, speed: 54 },
  hexer: { name: 'Hex spirit', hp: 5, radius: 2.4, interval: 2, warning: .7, speed: 48 },
  bandit: { name: 'Bandit', hp: 2.5, radius: 1.6, interval: 2.4, warning: .65, speed: 78, arrow: true },
  guard: { name: 'Tower guard', hp: 4, radius: 1.7, interval: 1.9, warning: .75, speed: 88, arrow: true },
  dragon: { name: 'Ember drake', hp: 12, radius: 4, interval: 1.5, warning: .65, speed: 64, mobile: true },
  wizard: { name: 'Rogue carpet mage', hp: 7, radius: 2.6, interval: 1.35, warning: .6, speed: 68, mobile: true },
  fish: { name: 'River fang', hp: 2, radius: 1.8, interval: Infinity, warning: 0, speed: 0 },
  giant: { name: 'Kandahar giant', hp: 18, radius: 6, interval: 2, warning: 1, speed: 65 },
};
export function spawnEnemies(type, index, start, difficulty, rng, obstacles) {
  const balance = balanceAt(start);
  const giantEncounter = ['mountain', 'temple'].includes(type) && index % 8 === 4;
  if (start < 640 || index % 2 || !giantEncounter && rng() > balance.enemyChance) return [];
  const pools = { city: ['bandit', 'guard', 'wizard'], palace: ['guard', 'wizard', 'dragon'], desert: ['bandit', 'dragon', 'stalker'], canyon: ['dragon', 'bandit', 'brute'], river: ['fish', 'fish', 'wizard', 'guard'], farm: ['bandit', 'wizard', 'dragon'], ancient: ['hexer', 'dragon', 'wizard', 'brute'] };
  Object.assign(pools, { fishing: ['fish', 'guard', 'bandit'], mountain: ['giant', 'giant', 'dragon'], jungle: ['brute', 'wizard', 'bandit'], beach: ['fish', 'bandit', 'dragon'], island: ['wizard', 'dragon', 'bandit'], temple: ['giant', 'guard', 'wizard'] });
  const unlocked = (pools[type] || pools.desert).filter(kind => !(kind === 'wizard' && start < 2500) && !(kind === 'dragon' && start < 5000) && !(kind === 'guard' && start < 1200));
  const pool = unlocked.length ? unlocked : ['bandit'], kind = giantEncounter ? 'giant' : pool[Math.floor(rng() * pool.length)], rule = FOES[kind];
  const count = kind === 'bandit' ? 2 + Math.floor(balance.strength * 3) + Math.floor(rng() * 2) : kind === 'fish' ? 2 + Number(balance.strength > .3) : kind === 'guard' ? 1 + Number(balance.strength > .3) : 1 + Number(!!rule.mobile && balance.strength > .65 && rng() < .45);
  const enemies = [];
  for (let i = 0; i < count; i++) {
    const side = i % 2 ? 1 : -1, s = start + 10 + i * 7;
    let x = (rng() - .5) * 70, y = 9 + rng() * 20;
    if (kind === 'bandit') { x = side * (35 + rng() * 16); y = 1.7; }
    if (kind === 'guard') { x = side * 59; y = 18 + rng() * 10; }
    if (kind === 'fish') { x = Math.sin(s / 180) * 21 + side * 11; y = -.8; }
    if (kind === 'giant') { x = side * (35 + rng() * 12); y = 8; }
    if (kind === 'bandit' && obstacles.some(o => Math.abs(x - o.x) < 13 && Math.abs(s - o.s) < 16)) x = side * 57;
    enemies.push({ kind, x, y, s, hp: rule.hp + Math.min(2, Math.floor(difficulty)), radius: rule.radius, phase: rng() * Math.PI * 2, spawnDelay: .6 * (1 - balance.strength) + i * .35 });
  }
  return enemies;
}
export function moveEnemy(e, run, dt) {
  const rate = e.frozen ? .25 : e.stagger ? .35 : 1;
  e.age = (e.age || 0) + dt * rate; e.phase += dt * rate;
  e.pushS = (e.pushS || 0) * Math.exp(-dt * 2); e.pushY = (e.pushY || 0) * Math.exp(-dt * 2);
  const ahead = e.s - run.distance;
  if (e.kind === 'fish') {
    if (e.leap == null && ahead < 65 && ahead > 5) {
      e.leap = 0; e.leapX = clamp(run.x + run.vx * .35, -48, 48); e.leapY = clamp(run.altitude + 5, 10, 35);
    }
    if (e.leap != null) {
      e.leap += dt * rate; const t = clamp(e.leap / 1.65, 0, 1);
      e.x = e.baseX + (e.leapX - e.baseX) * Math.min(1, t * 1.6); e.y = -.8 + 4 * e.leapY * t * (1 - t); e.s = e.baseS - t * 24;
      if (t >= 1) { e.active = false; e.visual && (e.visual.visible = false); }
    }
    return;
  }
  if (e.kind === 'giant') { e.x = e.baseX + Math.sin(e.age * .7) * 8; e.y = 8; e.s = e.baseS - Math.sin(e.age * .5) * 15; return; }
  if (e.kind === 'guard' || e.kind === 'bandit') {
    e.x = e.baseX; e.y = e.baseY; e.s = e.baseS; return;
  }
  if (FOES[e.kind]?.mobile) {
    e.travel = (e.travel || 0) + dt * rate * (e.kind === 'dragon' ? 47 + Math.sin(e.age * 1.3) * 19 : 55 + Math.sin(e.age * 2.7) * 13);
    e.s = e.baseS + e.travel + e.pushS;
    // Strafe away from the rider's firing line, then cross it; lead their lateral motion.
    const dodge = Math.abs(e.x - run.x) < 6 ? (Math.sin(e.phase) > 0 ? 16 : -16) : 0;
    const x = clamp(run.x + run.vx * .35 + Math.sin(e.age * 2.1 + e.phase) * 22 + dodge, -48, 48);
    const y = clamp(run.altitude + 7 + Math.sin(e.age * 2.8 + e.phase) * 12, 6, 47);
    e.x += clamp(x - e.x, -25 * dt * rate, 25 * dt * rate); e.y += clamp(y - e.y, -14 * dt * rate, 14 * dt * rate);
    return;
  }
  const hunt = e.kind === 'stalker' && ahead < 120 ? .48 : 0;
  e.x = e.baseX + (run.x - e.baseX) * hunt + Math.sin(e.phase) * 4;
  e.y = e.baseY + (run.altitude - e.baseY) * hunt + Math.sin(e.phase * 1.4) * 1.6 + e.pushY;
  e.s = e.baseS + e.pushS;
}
