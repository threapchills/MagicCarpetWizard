export const RADIUS = 680;
export const CHUNK = 64;
export const ZONE_LENGTH = CHUNK * 20;
export const FLIGHT_HALF_WIDTH = 54;
export const MAX_ALTITUDE = 54;
export const LANE_SPACING = 22;
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
export function difficultyAt(distance) { return Math.min(3, Math.max(0, distance) / 6400); }
export function flightSpeed(altitude, boosting, difficulty = 0) { return (boosting ? 102 : 40 + 36 * Math.exp(-Math.max(0, altitude - 1) / 7)) + difficulty * 3; }
export function createRun(seed = 42) { return { seed, distance: 0, time: 0, x: 0, altitude: 3.5, vx: 0, vy: 0, speed: 30, power: 25, hp: 3, score: 0, chain: 0, chainTimer: 0, bestChain: 1, invulnerable: 2.5, boost: false, roll: 0, rollHeld: false, rollCooldown: 0, rollDirection: 1, shotCooldown: 0, spells: { fire: 1, frost: 0, storm: 0, echo: 0, magnet: 0 }, kills: 0, nearMisses: 0, tricks: 0, ended: false, events: [] }; }
export function multiplier(run) { return Math.min(8, 1 + Math.floor(run.chain / 3)); }
export function award(run, points, power = 0, chain = true) { if (chain) { run.chain++; run.chainTimer = 5; } run.score += Math.round(points * multiplier(run)); run.power = clamp(run.power + power, 0, 100); run.bestChain = Math.max(run.bestChain, multiplier(run)); }
export function collectSpell(run, kind) { if (kind === 'ward') { run.hp = Math.min(3, run.hp + 1); run.invulnerable = Math.max(run.invulnerable, 5); } else { run.spells[kind] = Math.min(3, (run.spells[kind] || 0) + 1); } award(run, 100, 12); }
export function damage(run) { if (run.invulnerable > 0 || run.ended) return false; run.hp--; run.invulnerable = 2; run.chain = 0; run.chainTimer = 0; run.roll = 0; run.power = Math.max(0, run.power - 15); if (run.hp <= 0) run.ended = true; return true; }
export function updateRun(run, input, dt) {
  if (run.ended) return;
  dt = clamp(dt, 0, .05); run.time += dt;
  run.invulnerable = Math.max(0, run.invulnerable - dt); run.rollCooldown = Math.max(0, run.rollCooldown - dt); run.shotCooldown = Math.max(0, run.shotCooldown - dt);
  run.vx = lerp(run.vx, input.steer * (run.boost ? 56 : 48), 1 - Math.exp(-(input.steer ? 28 : 36) * dt));
  run.vy = lerp(run.vy, input.lift * (input.lift < 0 ? 29 : 25), 1 - Math.exp(-(input.lift ? 25 : 34) * dt));
  run.x = clamp(run.x + run.vx * dt, -FLIGHT_HALF_WIDTH, FLIGHT_HALF_WIDTH); run.altitude = clamp(run.altitude + run.vy * dt, 1, MAX_ALTITUDE);
  if ((run.x <= -FLIGHT_HALF_WIDTH && run.vx < 0) || (run.x >= FLIGHT_HALF_WIDTH && run.vx > 0)) run.vx = 0;
  if ((run.altitude <= 1 && run.vy < 0) || (run.altitude >= MAX_ALTITUDE && run.vy > 0)) run.vy = 0;
  if (input.roll && !run.rollHeld && !run.roll && !run.rollCooldown && run.altitude >= 4) { run.roll = .85; run.rollCooldown = 1.35; run.rollDirection = input.steer < 0 ? -1 : 1; }
  run.rollHeld = !!input.roll;
  if (run.roll > 0) { run.roll = Math.max(0, run.roll - dt); if (run.roll === 0 && run.altitude >= 4) { award(run, 90, 11); run.tricks++; run.events.push('roll'); } }
  run.boost = !!input.boost && (run.boost ? run.power > 0 : run.power >= 25);
  const rate = run.boost ? -15 : run.altitude < 3.5 ? 4.5 : .3;
  run.power = clamp(run.power + rate * dt, 0, 100);
  const dive = Math.max(0, -run.vy) * .35;
  run.speed = lerp(run.speed, flightSpeed(run.altitude, run.boost, difficultyAt(run.distance)) + dive, 1 - Math.exp(-5 * dt));
  run.distance += run.speed * dt; run.score += run.speed * dt * .2;
  run.chainTimer = Math.max(0, run.chainTimer - dt); if (!run.chainTimer) run.chain = 0;
}
export function safeLaneAt(index, seed) {
  // Meandering phrases explore five lanes, changing at most one lane per row.
  if (index < 2) return 0;
  const phrase = [0, 1, 2, 1, 0, -1, -2, -1];
  const direction = random(seed)() < .5 ? -1 : 1;
  return phrase[Math.floor(index / 2) % phrase.length] * direction;
}
export function segmentHitsSphere(from, to, center, radius) {
  const dx = to.x - from.x, dy = to.y - from.y, ds = to.s - from.s;
  const lengthSquared = dx * dx + dy * dy + ds * ds;
  const t = lengthSquared ? clamp(((center.x - from.x) * dx + (center.y - from.y) * dy + (center.s - from.s) * ds) / lengthSquared, 0, 1) : 0;
  return Math.hypot(from.x + dx * t - center.x, from.y + dy * t - center.y, from.s + ds * t - center.s) <= radius;
}
export function generateChunk(index, seed) {
  const rng = random(seed + index * 104729), start = index * CHUNK;
  const zone = zoneAt(start), difficulty = difficultyAt(start), type = ZONES[zone].type;
  const obstacles = [], pickups = [], enemies = [], rings = [];
  const safeLane = safeLaneAt(index, seed);
  // Every row leaves a full flight lane clear. Outer architecture is decoration.
  if (index > 1) {
    for (let lane = -2; lane <= 2; lane++) {
      if (lane === safeLane || rng() > .58 + difficulty * .09) continue;
      obstacles.push({ x: lane * LANE_SPACING + (rng() - .5) * 3, s: start + 42 + (rng() - .5) * 8, width: 8 + rng() * 6, height: 7 + rng() * (type === 'canyon' ? 25 : 21), depth: 8 + rng() * 7, angle: (rng() - .5) * 1.4, type });
    }
  }
  const laneX = safeLane * LANE_SPACING;
  const previousX = safeLaneAt(index - 1, seed) * LANE_SPACING;
  for (let i = 0; i < 8; i++) {
    const t = clamp((6 + i * 7) / 23, 0, 1), ease = t * t * (3 - 2 * t);
    pickups.push({ kind: 'gold', x: lerp(previousX, laneX, ease) + Math.sin(index + i * .7) * .9, s: start + 6 + i * 7, y: 2.3 + (index % 5 === 0 ? Math.sin(i / 7 * Math.PI) * 9 : 0) });
  }
  if (index > 2 && index % 3 === 0) {
    const kinds = ['frost', 'storm', 'echo', 'fire', 'magnet', 'ward'];
    pickups.push({ kind: kinds[Math.floor(rng() * kinds.length)], x: laneX, s: start + 40, y: 5.5 + rng() * 5 });
  }
  if (index > 3 && index % 2 === 0) {
    const count = 1 + (difficulty > .5 && rng() < .4 ? 1 : 0);
    for (let i = 0; i < count; i++) enemies.push({ x: (rng() - .5) * 88, s: start + 16 + i * 23, y: 6 + rng() * 25, hp: 2 + Math.floor(difficulty * 1.3), phase: rng() * Math.PI * 2 });
  }
  if (index % 4 === 2) rings.push({ x: laneX, s: start + 15, y: 10 + rng() * 13, radius: 5.2 });
  return { index, start, zone, safeLane, obstacles, pickups, enemies, rings };
}
export function obstacleExtents(obstacle) {
  const c = Math.abs(Math.cos(obstacle.angle || 0)), s = Math.abs(Math.sin(obstacle.angle || 0));
  return { x: (c * obstacle.width + s * obstacle.depth) / 2, s: (s * obstacle.width + c * obstacle.depth) / 2 };
}
export function intersectsObstacle(run, obstacle) {
  const dx = run.x - obstacle.x, ds = run.distance - obstacle.s, a = obstacle.angle || 0;
  const localX = Math.cos(a) * dx + Math.sin(a) * ds;
  const localS = -Math.sin(a) * dx + Math.cos(a) * ds;
  return Math.abs(localX) < obstacle.width / 2 + .7 && Math.abs(localS) < obstacle.depth / 2 + .7 && run.altitude < obstacle.height + .6;
}
export function nearObstacle(run, obstacle) {
  const extent = obstacleExtents(obstacle), passed = run.distance - obstacle.s - extent.s;
  const lateral = Math.abs(run.x - obstacle.x);
  return passed > .7 && passed < 4.5 && lateral < extent.x + 4 && run.altitude < obstacle.height + 3 && (lateral > extent.x + .7 || run.altitude > obstacle.height + .6);
}
export function spellDamage(spells, frozen = false) { return (1 + .45 * (spells.fire - 1)) * (frozen && spells.fire ? 1.8 : 1); }
