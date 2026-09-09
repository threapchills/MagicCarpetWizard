import * as THREE from 'three';
import { placeOnTerrain } from './world.js';

const COLORS = ['#ffcc55', '#ff658c', '#64ffe0', '#a68aff', '#fff4ca'];
export function milestoneBetween(previous, distance) {
  if (!Number.isFinite(distance) || distance <= previous) return null;
  // Prefer the largest tier crossed, including when a frame skips a boundary.
  for (const [interval, tier] of [[50000, 3], [10000, 2], [1000, 1]]) {
    const meters = Math.floor(distance / interval) * interval;
    if (meters > previous) return { meters, tier };
  }
  return null;
}

// Entirely decorative: never registered with collision, combat or pickups.
export class MilestoneCelebrations {
  constructor(scene) {
    this.scene = scene;
    this.point = new THREE.Object3D();
    this.color = new THREE.Color();
    this.sparks = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1), new THREE.MeshBasicMaterial({ vertexColors: false, transparent: true, depthWrite: false }), 1800);
    this.sparks.material.color.multiplyScalar(3);
    this.decor = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial(), 1400);
    for (const mesh of [this.sparks, this.decor]) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      scene.add(mesh);
    }
    this.clear();
  }
  clear() {
    this.highWater = 0; this.active = null; this.particles = []; this.parts = [];
    this.sparks.count = this.decor.count = 0;
  }
  observe(run) {
    const milestone = milestoneBetween(this.highWater, run.distance);
    this.highWater = Math.max(this.highWater, run.distance);
    if (!milestone) return null;
    // A smaller burst cannot truncate a grand festival already in progress.
    if (!this.active || milestone.tier >= this.active.tier) this.start(milestone, run);
    return milestone;
  }
  start(milestone, run) {
    const duration = [0, 3.5, 10, 16][milestone.tier];
    this.active = { ...milestone, age: 0, duration, nextBurst: 0 };
    this.particles = []; this.parts = [];
    const add = (x, y, s, w, h, d, color, motion = '') => this.parts.push({ x, y, s: run.distance + s, w, h, d, color, motion });
    if (milestone.tier > 1) {
      const rows = milestone.tier === 3 ? 12 : 6;
      for (let row = 0; row < rows; row++) for (const side of [-1, 1]) {
        const x = side * (milestone.tier === 3 && row % 2 ? 83 : 65), s = 12 + row * 22;
        const color = COLORS[row % COLORS.length];
        // Market awnings, legs, counters and colourful wares.
        add(x, 7, s, 12, 1, 8, color);
        add(x, 2, s, 10, 3, 5, '#9e5b40');
        for (const dx of [-5, 5]) for (const ds of [-3, 3]) add(x + dx, 4, s + ds, .35, 7, .35, '#ffe1a1');
        for (let j = 0; j < 5; j++) add(x - 4 + j * 2, 4, s, 1.3, 1, 1.3, COLORS[j]);
        // Friendly revellers wave raised arms and dance outside the flight lane.
        for (let j = 0; j < 4; j++) {
          const px = side * (57 + j * 3), ps = s + 7 + j * 2;
          add(px, 2.2, ps, 1.1, 2.4, .9, COLORS[(row + j) % 5], 'dance');
          add(px, 3.9, ps, .9, .9, .9, '#ffd6aa', 'dance');
          for (const dx of [-.8, .8]) {
            add(px + dx, 3.4, ps, .35, 1.9, .35, '#ffd6aa', 'wave');
            add(px + dx * .45, .7, ps, .35, 1.4, .45, '#493c64', 'dance');
          }
        }
        // Prayer flags on individual roadside strings, leaving the centre clear.
        for (const dx of [-9, 9]) add(x + dx, 7, s + 9, .3, 14, .3, '#e3b77d');
        add(x, 13, s + 9, 18, .09, .09, '#fff0cf');
        for (let j = 0; j < 9; j++) add(x - 8 + j * 2, 11.9, s + 9, 1.5, 2, .08, COLORS[j % 5], 'flag');
      }
    }
    this.burst(run);
  }
  burst(run) {
    const tier = this.active.tier;
    for (let shell = 0; shell < tier * 2; shell++) {
      const x = run.x + (shell % 2 ? 1 : -1) * (12 + Math.random() * 26);
      const y = run.altitude + 10 + Math.random() * 15, s = run.distance + 38 + Math.random() * 70;
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      for (let j = 0; j < 45 + tier * 18 && this.particles.length < 1800; j++) {
        const angle = Math.random() * Math.PI * 2, z = Math.random() * 2 - 1, radial = Math.sqrt(1 - z * z);
        const speed = (7 + Math.random() * 7) * (tier === 3 ? 1.8 : 1);
        this.particles.push({ x, y, s, vx: Math.cos(angle) * radial * speed, vy: z * speed, vs: Math.sin(angle) * radial * speed, life: 2 + Math.random(), color });
      }
    }
    this.active.nextBurst = this.active.age + (tier === 3 ? .38 : tier === 2 ? .75 : 1.2);
  }
  instance(mesh, i, x, y, s, distance, w, h, d, color, rotation = 0) {
    placeOnTerrain(this.point, x, s, y, distance);
    this.point.rotation.z = rotation;
    this.point.scale.set(w, h, d); this.point.updateMatrix();
    mesh.setMatrixAt(i, this.point.matrix); mesh.setColorAt(i, this.color.set(color));
  }
  update(dt, run) {
    const a = this.active;
    if (!a) return;
    a.age += dt;
    if (a.age >= a.duration) {
      this.active = null; this.particles = []; this.parts = []; this.sparks.count = this.decor.count = 0; return;
    }
    if (dt > 0 && a.age >= a.nextBurst && a.age < a.duration - 2) this.burst(run);
    this.particles = this.particles.filter(p => (p.life -= dt) > 0);
    this.particles.forEach((p, i) => {
      p.x += p.vx * dt; p.y += p.vy * dt; p.s += p.vs * dt; p.vy -= 6 * dt;
      const size = .28 * Math.min(1, p.life) * (a.tier === 3 ? 1.7 : 1);
      this.instance(this.sparks, i, p.x, p.y, p.s, run.distance, size, size * 2.8, size, p.color, -Math.atan2(p.vx, p.vy));
    });
    const fade = Math.min(1, a.age * 3, (a.duration - a.age) * 1.5);
    this.parts.forEach((p, i) => {
      // Fixed world coordinates, just like terrain and buildings. Only the
      // revellers and flags animate; the player flies past the festival.
      const s = p.s;
      const dance = p.motion === 'dance' || p.motion === 'wave' ? Math.sin(a.age * 7 + p.s) * .25 : 0;
      const rotation = p.motion === 'wave' ? Math.sin(a.age * 8 + p.x) * .55 : p.motion === 'flag' ? Math.sin(a.age * 5 + p.x) * .18 : 0;
      this.instance(this.decor, i, p.x, p.y + dance, s, run.distance, p.w * fade, p.h * fade, p.d * fade, p.color, rotation);
    });
    for (const [mesh, count] of [[this.sparks, this.particles.length], [this.decor, this.parts.length]]) {
      mesh.count = count; mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
}
