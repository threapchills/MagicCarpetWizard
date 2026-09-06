import { CHUNK, ZONES, clamp, lerp, random, createRun, updateRun, obstacleExtents } from './game.js';
import { breakables } from './landscape.js';
import { chunkSolids, movementHitsSolid } from './collision.js';

export const RACE_LEVELS = {
  easy: { name: 'Easy', length: 896, spacing: 224, radius: 40, gateBase: 14, density: .22, height: 12, spread: 20, zone: 1, description: 'Open gardens · giant forgiving gates · a few obstacles' },
  medium: { name: 'Medium', length: 1280, spacing: 256, radius: 10, density: .5, height: 23, spread: 32, zone: 0, description: 'Rooftop slalom · sharper turns · taller obstacles' },
  hard: { name: 'Hard', length: 1536, spacing: 192, radius: 8, density: .82, height: 35, spread: 39, zone: 3, description: 'Canyon sprint · tight gates · dense rock formations' },
};
export const RACE_LIMIT = 180;
export function createCourse(level = 'easy', seed = 42) {
  const config = RACE_LEVELS[level];
  if (!config) throw new Error('Unknown race difficulty');
  const rng = random(seed), gates = [];
  for (let s = config.spacing; s <= config.length; s += config.spacing) {
    // Keep Easy's centers low: enlarging the ring must also welcome ground skimming.
    gates.push({ s, x: (rng() * 2 - 1) * config.spread, y: (config.gateBase ?? config.radius + 1) + rng() * (level === 'hard' ? 18 : 7), radius: config.radius });
  }
  return { ...config, level, seed: seed >>> 0, gates };
}
export function routeAt(course, s) {
  let previous = { s: 0, x: 0, y: 3.5 };
  for (const gate of course.gates) {
    if (s <= gate.s) { const t = clamp((s - previous.s) / (gate.s - previous.s), 0, 1); return { x: lerp(previous.x, gate.x, t), y: lerp(previous.y, gate.y, t) }; }
    previous = gate;
  }
  return previous;
}
export function generateRaceChunk(index, course) {
  const start = index * CHUNK, rng = random(course.seed + index * 104729), obstacles = [];
  if (index > 0 && start < course.length) for (let lane = -2; lane <= 2; lane++) {
    if (rng() > course.density) continue;
    const s = start + 30 + rng() * 12;
    const o = { x: lane * 22 + (rng() - .5) * 6, s, width: 8 + rng() * 5, depth: 9 + rng() * 5, height: 6 + rng() * (course.height - 6), angle: (rng() - .5) * 1.6, type: ZONES[course.zone].type };
    const ext = obstacleExtents(o);
    // A continuous clear corridor and clear checkpoint approaches guarantee a flyable route.
    if (Math.abs(o.x - routeAt(course, s).x) < ext.x + 9 || course.gates.some(g => Math.abs(g.s - s) < ext.s + 22)) continue;
    obstacles.push(o);
  }
  const props = start < course.length ? breakables(ZONES[course.zone].type, index, start, random(course.seed + index * 967 + 91)) : [];
  return { index, start, zone: course.zone, safeLane: 0, disableRails: true, disablePassages: true, obstacles, pickups: [], enemies: [], rings: [], props: props.filter(p => Math.abs(p.x - routeAt(course, p.s).x) > 7 && !course.gates.some(g => Math.abs(g.s - p.s) < 25) && !obstacles.some(o => Math.abs(p.x - o.x) < 13 && Math.abs(p.s - o.s) < 15)) };
}
export function createAttempt(course, player, ghost = null) {
  const run = createRun(course.seed); run.power = 45; run.invulnerable = 0;
  const attempt = { course, player, ghost, run, countdown: 3, elapsed: 0, nextGate: 0, crashes: 0, stun: 0, finished: false, dnf: false, splits: [], samples: [], recordAt: 0 };
  attempt.collisionChunks = Array.from({ length: Math.ceil(course.length / CHUNK) }, (_, i) => generateRaceChunk(i, course));
  record(attempt, true); return attempt;
}
function record(a, force = false) {
  if (!force && a.elapsed < a.recordAt) return;
  const r = a.run, p = [a.elapsed, r.x, r.altitude, r.distance, r.vx, r.vy, r.roll, r.rollDirection];
  if (a.samples.at(-1)?.[0] === a.elapsed) a.samples[a.samples.length - 1] = p;
  else a.samples.push(p);
  a.recordAt = a.elapsed + .05;
}
function resetAtGate(a) {
  const p = a.course.gates[a.nextGate - 1] || { s: 0, x: 0, y: 3.5 };
  a.crashes++; a.stun = .55;
  Object.assign(a.run, { distance: p.s, x: p.x, altitude: p.y, vx: 0, vy: 0, speed: 22, roll: 0, boost: false, invulnerable: 0 });
  // Mark discontinuities; playback holds the pre-crash sample instead of flying backwards.
  record(a, true); a.samples.at(-1)[8] = 1;
}
export function stepRace(a, input, dt) {
  if (a.finished || a.dnf) return null;
  if (a.countdown > 0) { a.countdown = Math.max(0, a.countdown - dt); if (a.countdown < 1e-8) a.countdown = 0; return null; }
  a.elapsed += dt;
  if (a.elapsed >= RACE_LIMIT) { a.dnf = true; return 'timeout'; }
  if (a.stun > 0) { a.stun = Math.max(0, a.stun - dt); a.run.time += dt; record(a); return null; }
  const r = a.run, previous = { s: r.distance, x: r.x, y: r.altitude };
  updateRun(r, { ...input, arena: true, difficulty: Math.min(3, Math.max(0, r.distance) / 6400) }, dt);
  const index = Math.floor(r.distance / CHUNK);
  for (let i = Math.max(0, index - 1); i <= index + 1; i++) {
    const chunk = a.collisionChunks[i];
    if (chunk && movementHitsSolid({ x: previous.x, altitude: previous.y, distance: previous.s }, r, chunkSolids(chunk))) { resetAtGate(a); return 'crash'; }
  }
  const gate = a.course.gates[a.nextGate];
  if (gate && r.distance >= gate.s) {
    const fraction = clamp((gate.s - previous.s) / (r.distance - previous.s), 0, 1);
    const x = lerp(previous.x, r.x, fraction), y = lerp(previous.y, r.altitude, fraction);
    if (Math.hypot(x - gate.x, y - gate.y) > gate.radius - .75) { resetAtGate(a); return 'miss'; }
    a.splits.push(a.elapsed - dt * (1 - fraction));
    a.nextGate++; r.power = Math.min(100, r.power + 12);
    if (a.nextGate === a.course.gates.length) {
      a.elapsed -= dt * (1 - fraction); Object.assign(r, { distance: gate.s, x, altitude: y });
      a.finished = true; record(a, true); return 'finish';
    }
    record(a, true); return 'gate';
  }
  record(a); return null;
}
export function ghostAt(samples, time) {
  if (!samples?.length || time < 0 || time > samples.at(-1)[0]) return null;
  let lo = 0, hi = samples.length - 1;
  while (lo < hi) { const m = Math.ceil((lo + hi) / 2); if (samples[m][0] <= time) lo = m; else hi = m - 1; }
  const a = samples[lo], b = samples[Math.min(lo + 1, samples.length - 1)];
  const t = b[8] || b[0] === a[0] ? 0 : clamp((time - a[0]) / (b[0] - a[0]), 0, 1);
  return a.map((v, i) => i > 5 ? v : lerp(v, b[i], t));
}
export function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const ms = Math.round(seconds * 1000);
  return `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
}
export function checkpointDelta(attempt) {
  const i = attempt.nextGate - 1, rival = attempt.ghost?.splits?.[i];
  return i >= 0 && Number.isFinite(rival) ? attempt.splits[i] - rival : null;
}
export class RaceRecords {
  constructor(storage) {
    this.sessions = {};
    try {
      this.storage = storage || globalThis.localStorage;
      const saved = JSON.parse(this.storage.getItem('mcw-races-v2'));
      for (const level of Object.keys(RACE_LEVELS)) {
        const s = saved?.[level]; if (!s || !Number.isInteger(s.seed) || s.seed < 0 || s.seed > 0xffffffff || !Array.isArray(s.best)) continue;
        const course = createCourse(level, s.seed);
        this.sessions[level] = { seed: s.seed, best: [0, 1].map(i => validRecord(s.best[i], course) ? s.best[i] : null) };
      }
    } catch { /* Local records are optional; inaccessible or old data starts a fresh match. */ }
  }
  get(level) { return this.sessions[level] ||= { seed: Math.floor(Math.random() * 0xffffffff), best: [null, null] }; }
  regenerate(level) { const old = this.get(level).seed; this.sessions[level] = { seed: (old + 104729) >>> 0, best: [null, null] }; this.save(); }
  complete(a) {
    const s = this.get(a.course.level), old = s.best[a.player];
    if (!a.finished || a.dnf || s.seed !== a.course.seed || (old && a.elapsed >= old.time)) return false;
    s.best[a.player] = { time: a.elapsed, splits: a.splits.slice(), samples: a.samples.map(p => p.slice()) }; this.save(); return true;
  }
  save() { try { this.storage.setItem('mcw-races-v2', JSON.stringify(this.sessions)); } catch { /* The match still works when storage is full or disabled. */ } }
}
function validRecord(r, course) {
  if (!r || !Number.isFinite(r.time) || r.time <= 0 || r.time > RACE_LIMIT || !Array.isArray(r.samples) || r.samples.length < 2 || r.samples.length > 12000) return false;
  // Older ghosts remain usable; split timing is optional and never reconstructed across crashes.
  if (r.splits !== undefined && (!Array.isArray(r.splits) || r.splits.length !== course.gates.length || r.splits.some((t, i) => !Number.isFinite(t) || t <= (r.splits[i - 1] || 0) || t > r.time))) return false;
  let last = -1;
  for (const p of r.samples) {
    if (!Array.isArray(p) || p.length < 8 || p.length > 9 || !p.every(Number.isFinite) || p[0] <= last || p[0] > r.time || Math.abs(p[1]) > 54 || p[2] < 1 || p[2] > 54 || p[3] < 0 || p[3] > course.length || Math.abs(p[4]) > 56 || Math.abs(p[5]) > 29 || p[6] < 0 || p[6] > .85 || Math.abs(p[7]) !== 1) return false;
    last = p[0];
  }
  return r.samples[0][0] === 0 && Math.abs(last - r.time) < .001 && r.samples.at(-1)[3] === course.length;
}
