export const PROP_TYPES = { city: 'crate', palace: 'urn', desert: 'rock', canyon: 'rock', river: 'timber', farm: 'hay', ancient: 'seal' };
export function elevationAt(s) {
  // Broad, smooth terraces start after the opening stretch; no steps at chunk seams.
  const t = Math.max(0, s - 320);
  return 11 * (1 - Math.cos(t / 270)) + 4 * (1 - Math.cos(t / 113));
}
export function passageAt(s) {
  const phrase = Math.floor(s / 1792), local = s - phrase * 1792;
  if (local < 768 || local >= 1088) return null;
  return { start: phrase * 1792 + 768, end: phrase * 1792 + 1088, halfWidth: 29, ceiling: 32, type: phrase % 2 ? 'cave' : 'cliff tunnel' };
}
export function hitsPassage(run) {
  const passage = passageAt(run.distance);
  return !!passage && (Math.abs(run.x) > passage.halfWidth - 1 || run.altitude > passage.ceiling - 1);
}
export function breakables(type, index, start, rng) {
  if (index < 2 || index % 3 !== 1) return [];
  return Array.from({ length: 2 }, (_, i) => ({ destructible: true, kind: PROP_TYPES[type], x: (rng() - .5) * 76, y: 2.1, s: start + 17 + i * 24, hp: 3.8, maxHp: 3.8, radius: 2.5, active: true }));
}
