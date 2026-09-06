import { RADIUS } from './game.js';
import { passageSolids } from './landscape.js';

// A forgiving carpet footprint with clearance for the rider's head. Damage
// immunity never changes this physical hull.
const HULL = { x: 1.5, s: 2.1, top: 2.5, bottom: .2 };
const SKIN = .003;
const axes = ['x', 'y', 's'];
const point = r => ({ x: r.x, y: r.altitude - r.x * r.x / (2 * RADIUS), s: r.distance });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.s * b.s;

export function chunkSolids(chunk) {
  const solids = chunk.disablePassages ? [] : passageSolids(chunk.start).filter(o => !o.hazard || !chunk.combatClear);
  if (!chunk.combatClear) {
    solids.push(...chunk.obstacles);
    for (const p of chunk.props || []) if (p.active) solids.push({ x: p.x, s: p.s, bottom: p.y - p.radius, width: p.radius * 2, depth: p.radius * 2, height: p.radius * 2 });
  }
  return solids;
}

// Sweep the entire movement segment against an oriented box expanded by the
// carpet hull. Work before spherical rendering, in the same terrain space.
function sweep(from, to, box) {
  const a = box.angle || 0, c = Math.cos(a), s = Math.sin(a);
  const local = p => ({ x: c * (p.x - box.x) + s * (p.s - box.s), y: p.y, s: -s * (p.x - box.x) + c * (p.s - box.s) });
  const p = local(from), q = local(to), d = { x: q.x - p.x, y: q.y - p.y, s: q.s - p.s };
  const wx = box.width / 2 + Math.abs(c) * HULL.x + Math.abs(s) * HULL.s;
  const ws = box.depth / 2 + Math.abs(s) * HULL.x + Math.abs(c) * HULL.s;
  const base = (box.bottom || 0) - (box.flatBase ? 0 : box.x * box.x / (2 * RADIUS));
  const min = { x: -wx, y: base - HULL.top, s: -ws }, max = { x: wx, y: base + box.height + HULL.bottom, s: ws };
  const normal = (axis, sign) => axis === 'x' ? { x: c * sign, y: 0, s: s * sign } : axis === 's' ? { x: -s * sign, y: 0, s: c * sign } : { x: 0, y: sign, s: 0 };
  if (axes.every(k => p[k] > min[k] && p[k] < max[k])) {
    // Recover safely from an embedded starting point (e.g. a restored run).
    let depth = Infinity, n;
    for (const k of axes) for (const sign of [-1, 1]) {
      const distance = sign < 0 ? p[k] - min[k] : max[k] - p[k];
      if (distance < depth) { depth = distance; n = normal(k, sign); }
    }
    return { t: 0, normal: n, depth };
  }
  let enter = -Infinity, exit = Infinity, n;
  for (const k of axes) {
    if (Math.abs(d[k]) < 1e-10) { if (p[k] <= min[k] || p[k] >= max[k]) return null; continue; }
    const t1 = (min[k] - p[k]) / d[k], t2 = (max[k] - p[k]) / d[k];
    const near = Math.min(t1, t2), far = Math.max(t1, t2);
    if (near > enter) { enter = near; n = normal(k, d[k] > 0 ? -1 : 1); }
    exit = Math.min(exit, far);
    if (enter > exit) return null;
  }
  if (enter < -1e-9 || enter > 1 || exit < 0 || !n) return null;
  return { t: Math.max(0, enter), normal: n, depth: 0 };
}

export function movementHitsSolid(previous, run, solids) {
  const from = point(previous), to = point(run);
  return solids.some(box => !!sweep(from, to, box));
}

export function resolveSolidMovement(run, previous, solids) {
  let position = point(previous), target = point(run), hit = false;
  const velocity = { x: run.vx, y: run.vy - run.x * run.vx / RADIUS, s: run.speed };
  // Multiple contacts allow wall sliding, corner contacts and roof glancing
  // without stepping through a second surface while resolving the first.
  for (let iteration = 0; iteration < 8; iteration++) {
    let nearest = null;
    for (const box of solids) { const contact = sweep(position, target, box); if (contact && (!nearest || contact.t < nearest.t)) nearest = contact; }
    if (!nearest) { position = target; break; }
    hit = true;
    const n = nearest.normal, remaining = {};
    const intendedAltitude = target.y + target.x * target.x / (2 * RADIUS);
    const verticalSpeed = velocity.y + target.x * velocity.x / RADIUS;
    for (const k of axes) {
      const travel = target[k] - position[k];
      position[k] += travel * nearest.t + n[k] * (nearest.depth + SKIN);
      remaining[k] = travel * (1 - nearest.t);
    }
    const intoWall = Math.min(0, dot(remaining, n)), velocityIntoWall = Math.min(0, dot(velocity, n));
    for (const k of axes) { target[k] = position[k] + remaining[k] - n[k] * intoWall; velocity[k] -= n[k] * velocityIntoWall; }
    if (!n.y) {
      // Rejecting lateral motion must also reject its latitude correction;
      // otherwise holding steer against a wall slowly sinks the carpet.
      target.y = intendedAltitude - target.x * target.x / (2 * RADIUS);
      velocity.y = verticalSpeed - target.x * velocity.x / RADIUS;
    }
  }
  if (hit) {
    // Do not award distance points for movement rejected by a solid surface.
    run.score = Math.max(0, run.score - Math.max(0, run.distance - position.s) * .2);
    run.x = position.x; run.distance = position.s;
    run.altitude = position.y + position.x * position.x / (2 * RADIUS);
    run.vx = velocity.x; run.vy = velocity.y + position.x * velocity.x / RADIUS; run.speed = Math.max(0, velocity.s);
  }
  return hit;
}
