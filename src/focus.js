export const FOCUS_SECONDS = 8;
export function gainFocus(run, amount) { run.focus = Math.min(100, (run.focus || 0) + amount); }
export function toggleFocus(run) {
  if (run.slow) { run.slow = false; return true; }
  if (run.focus < 12) return false;
  run.slow = true; return true;
}
export function spotAmbush(run) {
  if (run.spotCooldown > 0 || run.slow || run.focus < 5) return false;
  run.focus -= 5; run.ambushTime = .5; run.spotCooldown = 9; return true;
}
// Reserve and warning duration use real time, so slowing the world cannot
// make slow motion last forever. Paused frames must never call this.
export function tickFocus(run, dt) {
  run.spotCooldown = Math.max(0, (run.spotCooldown || 0) - dt);
  run.ambushTime = Math.max(0, (run.ambushTime || 0) - dt);
  if (run.slow) { run.focus = Math.max(0, run.focus - dt * 100 / FOCUS_SECONDS); if (!run.focus) run.slow = false; }
  return run.slow ? .28 : run.ambushTime > 0 ? .48 : 1;
}
