export const PROP_TYPES = { city: 'crate', palace: 'urn', desert: 'rock', canyon: 'rock', river: 'timber', farm: 'hay', ancient: 'seal', fishing: 'timber', mountain: 'rock', jungle: 'timber', beach: 'crate', island: 'urn', temple: 'seal' };
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
// Shared by the renderer and physics, including the yawed ceiling ribs and
// the little overlap that seals neighbouring tunnel sections.
export function passageSolids(start) {
  if (!passageAt(start)) return [];
  const solids = [], depth = 64.2, s = start + 32;
  const add = (color, x, bottom, width, height, hazard = true, angle = 0) => solids.push({ color, x, s, bottom, width, height, depth, hazard, angle, flatBase: true });
  for (const side of [-1, 1]) {
    add('#795c61', side * 90, -1, 58, 80, false);
    add('#795c61', side * 45, -1, 32, 80);
  }
  add('#725b62', 0, 58, 59, 24, false);
  add('#725b62', 0, 32, 59, 26);
  for (const side of [-1, 1]) add('#c18f72', side * 21, 30, 12, 8, true, side * .28);
  return solids;
}
export function breakables(type, index, start, rng) {
  if (index < 2 || index % 3 !== 1) return [];
  return Array.from({ length: 2 }, (_, i) => {
    const large = index > 8 && i === 0, scale = large ? 2.6 : 1;
    return { destructible: true, kind: PROP_TYPES[type], x: (rng() - .5) * 76, y: large ? 7 + rng() * 14 : 2.1, s: start + 17 + i * 24, hp: large ? 6.5 : 3.8, maxHp: large ? 6.5 : 3.8, radius: 2.5 * scale, scale, large, active: true };
  });
}
