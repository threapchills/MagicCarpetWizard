import * as THREE from 'three';
import { placeOnTerrain as placeOnWorld, mat } from './world.js';

export class BloodRibbons {
  constructor(scene) { this.scene = scene; this.ribbons = []; this.point = new THREE.Object3D(); }
  burst(x, y, s, count = 24) {
    for (let i = 0; i < count; i++) {
      if (this.ribbons.length >= 72) this.remove(0);
      const geometry = new THREE.BufferGeometry(), positions = new Float32Array(9 * 6), indices = [];
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      for (let j = 0; j < 8; j++) { const n = j * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
      geometry.setIndex(indices); geometry.computeVertexNormals();
      const material = mat(i % 3 ? '#c92245' : '#f04642', false, 'smooth'); material.side = THREE.DoubleSide;
      const visual = new THREE.Mesh(geometry, material); visual.frustumCulled = false; this.scene.add(visual);
      const angle = Math.random() * Math.PI * 2, speed = 5 + Math.random() * 14, life = 1.1 + Math.random() * 1.3;
      this.ribbons.push({ x, y, s, vx: Math.cos(angle) * speed, vy: 4 + Math.random() * 12, vs: Math.sin(angle) * speed, life, maxLife: life, width: .15 + Math.random() * .35, history: [], visual, positions });
    }
  }
  remove(i) { const [r] = this.ribbons.splice(i, 1); this.scene.remove(r.visual); r.visual.geometry.dispose(); }
  clear() { while (this.ribbons.length) this.remove(0); }
  update(dt, distance) {
    for (let i = this.ribbons.length - 1; i >= 0; i--) {
      const r = this.ribbons[i]; r.life -= dt;
      if (r.life <= 0) { this.remove(i); continue; }
      if (dt > 0) {
        r.x += r.vx * dt; r.y += r.vy * dt; r.s += r.vs * dt; r.vy -= 24 * dt;
        if (r.y < .12) { r.y = .12; r.vy = Math.abs(r.vy) * .13; r.vx *= .9; r.vs *= .9; }
        r.history.unshift({ x: r.x, y: r.y, s: r.s }); if (r.history.length > 9) r.history.pop();
      }
      for (let j = 0; j < 9; j++) {
        const p = r.history[Math.min(j, r.history.length - 1)] || r;
        placeOnWorld(this.point, p.x, p.s, p.y, distance);
        const width = r.width * (1 - j / 9) * Math.min(1, r.life * 2);
        for (let edge = 0; edge < 2; edge++) {
          const n = j * 6 + edge * 3, sign = edge ? 1 : -1;
          r.positions[n] = this.point.position.x + sign * width;
          r.positions[n + 1] = this.point.position.y + sign * width * Math.sin(r.life * 8 + j);
          r.positions[n + 2] = this.point.position.z;
        }
      }
      r.visual.geometry.attributes.position.needsUpdate = true; r.visual.geometry.computeVertexNormals();
    }
  }
}
