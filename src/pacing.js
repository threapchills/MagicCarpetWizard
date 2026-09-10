// Adventure pacing is distance based; seeded courses keep their own fixed rules.
export const ADVENTURE_TIME_SCALE = .82;
export const FIRST_BOSS_DISTANCE = 2600;
// Preserve the opening 2.5 km exactly, then introduce pressure more decisively.
const milestones = [[0, 0], [1500, .06], [2500, .10], [5000, .28], [10000, .48], [18000, .70], [32000, .86], [50000, 1]];
export function progressionAt(distance) {
  const s = Math.max(0, distance);
  for (let i = 1; i < milestones.length; i++) {
    const [end, high] = milestones[i], [start, low] = milestones[i - 1];
    if (s <= end) return low + (high - low) * (s - start) / (end - start);
  }
  return 1;
}
export function balanceAt(distance) {
  const strength = progressionAt(distance);
  const mastery = Math.max(0, Math.min(1, (distance - 12000) / 68000));
  // The last 512 m of each 2,048 m phrase eases pressure, even very late in a run.
  const phase = ((Math.max(0, distance) % 2048) / 2048);
  const ease = phase < .75 ? 0 : Math.sin((phase - .75) * 4 * Math.PI) ** 2;
  return {
    strength, mastery, difficulty: strength * 8 + mastery * 4, respite: ease,
    obstacleChance: (.22 + .60 * strength) * (1 - .5 * ease),
    obstacleHeight: 10 + 23 * strength,
    enemyChance: (.26 + .70 * strength) * (1 - .7 * ease),
    attackInterval: 1.55 - .80 * strength - .18 * mastery,
    warning: 1.35 - .35 * strength - .10 * mastery,
    projectileSpeed: .85 + .25 * strength + .18 * mastery,
    bossSpacing: Math.round(3400 - 1400 * strength - 400 * mastery),
    stage: strength < .06 ? 'GENTLE SKIES' : strength < .2 ? 'FINDING FLOW' : strength < .4 ? 'RISING WINDS' : strength < .64 ? 'WILD HORIZONS' : strength < .86 ? 'RELENTLESS SKIES' : 'LEGENDARY FLIGHT',
  };
}
