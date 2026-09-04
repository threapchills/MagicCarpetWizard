export const RADIUS = 340;
export const CHUNK = 36;
export const ZONE_LENGTH = 720;
export const ZONES = [
  { name: 'The Amber City', subtitle: 'A thousand rooftops. Not a single road.', ground: '#dfa06c', sky: '#c3ded7', fog: '#c7d8c5', accent: '#309b98', type: 'city' },
  { name: 'The Sultan’s Gardens', subtitle: 'Even the fountains have stories to tell.', ground: '#89a679', sky: '#c6dfdb', fog: '#bbd5bf', accent: '#dfba66', type: 'palace' },
  { name: 'The Saffron Sea', subtitle: 'Follow the wind. Leave only wonder.', ground: '#e6b775', sky: '#d8dfc6', fog: '#e6c895', accent: '#cd7655', type: 'desert' },
  { name: 'The Singing Canyons', subtitle: 'Stone remembers every passing storm.', ground: '#bb7963', sky: '#c9c2d3', fog: '#c7a593', accent: '#ce8b69', type: 'canyon' },
  { name: 'The River of Stars', subtitle: 'A ribbon of blue between two eternities.', ground: '#629f99', sky: '#b0d6d6', fog: '#a2c7be', accent: '#54b8b6', type: 'river' },
  { name: 'The Emerald Fields', subtitle: 'Where the earth dreams in green.', ground: '#9ca971', sky: '#caddca', fog: '#c9cba0', accent: '#67a282', type: 'farm' },
  { name: 'The Ancestors’ Reach', subtitle: 'Old magic. New horizons.', ground: '#c49186', sky: '#b9b7d1', fog: '#c2a5b3', accent: '#aa89ba', type: 'ancient' },
];
export const SPELLS = {
  fire: { name: 'Ember', glyph: '♨', color: '#ffac6d', description: 'Ember · stronger flame, wider impact' },
  frost: { name: 'Frost', glyph: '❄', color: '#9ce8ed', description: 'Frost · slows enemies; fire shatters frozen foes' },
  storm: { name: 'Storm', glyph: 'ϟ', color: '#edda86', description: 'Storm · lightning jumps between enemies' },
  echo: { name: 'Echo', glyph: '✧', color: '#d4b6ff', description: 'Echo · extra spell bolts' },
  magnet: { name: 'Charm', glyph: '◎', color: '#8ae0b4', description: 'Charm · draws gold and power toward you' },
  ward: { name: 'Ward', glyph: '◇', color: '#99ddff', description: 'Ward · restores a heart and shields you briefly' },
};
export const clamp = (x, min, max) => Math.min(max, Math.max(min, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export function random(seed) { let n = seed >>> 0; return () => { n += 0x6D2B79F5; let t = n; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function zoneAt(distance) { return Math.floor(Math.max(0, distance) / ZONE_LENGTH) % ZONES.length; }
export function difficultyAt(distance) { return Math.min(3, Math.max(0, distance) / 3600); }
export function flightSpeed(altitude, boosting, difficulty = 0) { return (boosting ? 54 : 23 + 21 * Math.exp(-Math.max(0, altitude - 1) / 5)) + difficulty * 3; }
export function createRun(seed = 42) { return { seed, distance: 0, time: 0, x: 0, altitude: 3.5, vx: 0, vy: 0, speed: 30, power: 25, hp: 3, score: 0, chain: 0, chainTimer: 0, bestChain: 1, invulnerable: 2.5, boost: false, roll: 0, rollCooldown: 0, rollDirection: 1, shotCooldown: 0, spells: { fire: 1, frost: 0, storm: 0, echo: 0, magnet: 0 }, kills: 0, nearMisses: 0, tricks: 0, ended: false, events: [] }; }
export function multiplier(run) { return Math.min(8, 1 + Math.floor(run.chain / 3)); }
export function award(run, points, power = 0, chain = true) { if (chain) { run.chain++; run.chainTimer = 5; } run.score += Math.round(points * multiplier(run)); run.power = clamp(run.power + power, 0, 100); run.bestChain = Math.max(run.bestChain, multiplier(run)); }
export function collectSpell(run, kind) { if (kind === 'ward') { run.hp = Math.min(3, run.hp + 1); run.invulnerable = Math.max(run.invulnerable, 5); } else { run.spells[kind] = Math.min(3, (run.spells[kind] || 0) + 1); } award(run, 100, 12); }
export function damage(run) { if (run.invulnerable > 0 || run.ended) return false; run.hp--; run.invulnerable = 2; run.chain = 0; run.chainTimer = 0; run.power = Math.max(0, run.power - 15); if (run.hp <= 0) run.ended = true; return true; }
export function updateRun(run, input, dt) {
  if (run.ended) return;
  dt = clamp(dt, 0, .05); run.time += dt;
  run.invulnerable = Math.max(0, run.invulnerable - dt); run.rollCooldown = Math.max(0, run.rollCooldown - dt); run.shotCooldown = Math.max(0, run.shotCooldown - dt);
  run.vx = lerp(run.vx, input.steer * 19, 1 - Math.exp(-7 * dt));
  run.vy = lerp(run.vy, input.lift * 12, 1 - Math.exp(-6 * dt));
  run.x = clamp(run.x + run.vx * dt, -21, 21); run.altitude = clamp(run.altitude + run.vy * dt, 1, 29);
  if (input.roll && !run.roll && !run.rollCooldown && run.altitude >= 4) { run.roll = .85; run.rollCooldown = 1.35; run.rollDirection = input.steer < 0 ? -1 : 1; }
  if (run.roll > 0) { run.roll = Math.max(0, run.roll - dt); if (run.roll === 0 && run.altitude >= 4) { award(run, 90, 11); run.tricks++; run.events.push('roll'); } }
  run.boost = !!input.boost && (run.boost ? run.power > 0 : run.power >= 25);
  const rate = run.boost ? -15 : run.altitude < 3.5 ? 4.5 : .3;
  run.power = clamp(run.power + rate * dt, 0, 100);
  run.speed = lerp(run.speed, flightSpeed(run.altitude, run.boost, difficultyAt(run.distance)), 1 - Math.exp(-2 * dt));
  run.distance += run.speed * dt; run.score += run.speed * dt * .2;
  run.chainTimer = Math.max(0, run.chainTimer - dt); if (!run.chainTimer) run.chain = 0;
}
export function generateChunk(index, seed) {
  const rng = random(seed + index * 104729), start = index * CHUNK;
  const zone = zoneAt(start), difficulty = difficultyAt(start), type = ZONES[zone].type;
  const obstacles = [], pickups = [], enemies = [], rings = [];
  const safeLane = Math.floor(rng() * 3) - 1;
  // Every row leaves a full flight lane clear. Outer architecture is decoration.
  if (index > 1) {
    for (let lane = -1; lane <= 1; lane++) {
      if (lane === safeLane || rng() > .58 + difficulty * .09) continue;
      obstacles.push({ x: lane * 13 + (rng() - .5) * 2, s: start + 18, width: 5 + rng() * 3, height: 4 + rng() * (type === 'canyon' ? 16 : 10), depth: 5 + rng() * 3, type });
    }
  }
  const laneX = safeLane * 13;
  for (let i = 0; i < 5; i++) pickups.push({ kind: 'gold', x: laneX + Math.sin(index + i * .7) * 2, s: start + 4 + i * 5, y: 2.3 + (index % 5 === 0 ? Math.sin(i / 4 * Math.PI) * 6 : 0) });
  if (index > 2 && index % 3 === 0) {
    const kinds = ['frost', 'storm', 'echo', 'fire', 'magnet', 'ward'];
    pickups.push({ kind: kinds[Math.floor(rng() * kinds.length)], x: laneX, s: start + 22, y: 5.5 + rng() * 3 });
  }
  if (index > 3 && index % 2 === 0) {
    const count = 1 + (difficulty > .5 && rng() < .4 ? 1 : 0);
    for (let i = 0; i < count; i++) enemies.push({ x: (rng() - .5) * 30, s: start + 10 + i * 12, y: 5 + rng() * 13, hp: 2 + Math.floor(difficulty * 1.3), phase: rng() * Math.PI * 2 });
  }
  if (index % 4 === 2) rings.push({ x: laneX, s: start + 10, y: 8 + rng() * 7, radius: 3.8 });
  return { index, start, zone, safeLane, obstacles, pickups, enemies, rings };
}
export function intersectsObstacle(run, obstacle) { return Math.abs(run.distance - obstacle.s) < obstacle.depth / 2 + .7 && Math.abs(run.x - obstacle.x) < obstacle.width / 2 + .7 && run.altitude < obstacle.height + .6; }
export function nearObstacle(run, obstacle) { return Math.abs(run.distance - obstacle.s) < 2 && Math.abs(run.x - obstacle.x) < obstacle.width / 2 + 3 && run.altitude < obstacle.height + 3 && !intersectsObstacle(run, obstacle); }
export function spellDamage(spells, frozen = false) { return (1 + .45 * (spells.fire - 1)) * (frozen && spells.fire ? 1.8 : 1); }
