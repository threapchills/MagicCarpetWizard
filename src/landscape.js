import { gauntletAt, gauntletNear } from './gauntlets.js';
export const PROP_TYPES = { city: 'crate', palace: 'urn', desert: 'rock', canyon: 'rock', river: 'timber', farm: 'hay', ancient: 'seal', fishing: 'timber', mountain: 'rock', jungle: 'timber', beach: 'crate', island: 'urn', temple: 'seal' };
export function elevationAt(s) {
  // Broad, smooth terraces start after the opening stretch; no steps at chunk seams.
  const t = Math.max(0, s - 320);
  return 11 * (1 - Math.cos(t / 270)) + 4 * (1 - Math.cos(t / 113));
}
export function passageAt(s) {
  const trap=gauntletAt(s);
  if(trap) return {...trap,halfWidth:29,ceiling:32,type:'gauntlet'};
  const phrase = Math.floor(s / 1792), local = s - phrase * 1792;
  if (local < 768 || local >= 1088) return null;
  const start=phrase*1792+768;
  if(gauntletNear(start,384)||gauntletNear(start+320,384))return null;
  return { start: phrase * 1792 + 768, end: phrase * 1792 + 1088, halfWidth: 29, ceiling: 32, type: phrase % 2 ? 'cave' : 'cliff tunnel' };
}
// Shared by the renderer and physics, including the lowered rock shoulders and
// the little overlap that seals neighbouring tunnel sections.
export function passageSolids(start) {
  if (!passageAt(start)) return [];
  const solids = [], depth = 64.2, s = start + 32;
  const add = (color, x, bottom, width, height, hazard = true, angle = 0) => solids.push({ color, x, s, bottom, width, height, depth, hazard, angle, flatBase: true });
  for (const side of [-1, 1]) {
    add('#795c61', side * 90, -1, 58, 80, false);
    add('#795c61', side * 45, -1, 32, 80);
  }
  // Both roof layers bridge the entire rock formation, overlapping the walls.
  // The upper layer remains solid when a boss clears the lower flight hazards.
  add('#725b62', 0, 58, 240, 24, false);
  add('#725b62', 0, 32, 124, 26);
  for (const side of [-1, 1]) add('#725b62', side * 21, 30, 16, 8);
  return solids;
}
export function breakables(type, index, start, rng) {
  if (index < 2 || index % 3 !== 1) return [];
  return Array.from({ length: 2 }, (_, i) => {
    const large = index > 8 && i === 0, scale = large ? 2.6 : 1;
    return { destructible: true, kind: PROP_TYPES[type], x: (rng() - .5) * 76, y: large ? 7 + rng() * 14 : 2.1, s: start + 17 + i * 24, hp: large ? 6.5 : 3.8, maxHp: large ? 6.5 : 3.8, radius: 2.5 * scale, scale, large, active: true };
  });
}
