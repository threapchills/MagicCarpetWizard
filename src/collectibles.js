export function magnetRadius(level) { return level > 0 ? 28 + (Math.min(3, level) - 1) * 12 : 0; }

// Once caught, loot follows the moving rider until collected. Forward velocity
// keeps it from lagging forever behind a boosted carpet.
export function pullCollectible(pickup, run, dt, assistRadius = 0) {
  if (dt <= 0) return false;
  const level = run.spells.magnet, radius = magnetRadius(level) || assistRadius;
  if (!radius) return false;
  const distance = Math.hypot(pickup.x - run.x, pickup.y - run.altitude, pickup.s - run.distance);
  if (!pickup.attracted && distance > radius) return false;
  pickup.attracted = true;
  const pull = 1 - Math.exp(-dt * (6 + level * 1.5));
  pickup.x += (run.x - pickup.x) * pull;
  pickup.y += (run.altitude - pickup.y) * pull;
  pickup.s += run.speed * dt;
  pickup.s += (run.distance - pickup.s) * pull;
  return true;
}
