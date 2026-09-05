import * as THREE from 'three';
import { createCarpet, placeOnTerrain as placeOnWorld } from './world.js';
import { ghostAt } from './race.js';
import { createHalo } from './glow.js';

export class RaceView {
  constructor(scene) {
    this.scene = scene; this.gates = [];
    this.ghost = createCarpet();
    this.ghostMaterial = new THREE.MeshBasicMaterial({ color: '#89ffff', transparent: true, opacity: .65, depthWrite: false, fog: false });
    this.ghost.root.traverse(o => { if (o.isMesh) { o.material = this.ghostMaterial; o.castShadow = false; } });
    this.ghostHalos = ['#ff66ae', '#46ffe7'].map(color => { const halo = createHalo(color, 13); halo.position.y = .5; this.ghost.root.add(halo); return halo; });
    this.ghost.root.visible = false; scene.add(this.ghost.root);
  }
  clear() {
    for (const g of this.gates) { this.scene.remove(g); g.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }
    this.gates = []; this.ghost.root.visible = false;
  }
  start(course, player) {
    this.clear(); this.ghostMaterial.color.set(player === 0 ? '#ff66ae' : '#46ffe7').multiplyScalar(5);
    this.ghostHalos.forEach((halo, i) => halo.visible = i === player);
    course.gates.forEach((gate, i) => {
      const g = new THREE.Group(), finish = i === course.gates.length - 1;
      const segments = finish ? 16 : 1;
      for (let n = 0; n < segments; n++) {
        const material = new THREE.MeshBasicMaterial({ color: finish ? n % 2 ? '#162431' : '#fff6dc' : '#ffd77e' });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(gate.radius, finish ? .65 : .38, 6, finish ? 8 : 72, Math.PI * 2 / segments), material);
        ring.rotation.z = n * Math.PI * 2 / segments; g.add(ring);
      }
      if (!finish) {
        const outline = new THREE.Mesh(new THREE.TorusGeometry(gate.radius, .62, 6, 72), new THREE.MeshBasicMaterial({ color: '#142c35' }));
        outline.position.z = -.55; g.add(outline);
      }
      const pointer = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3, 3), new THREE.MeshBasicMaterial({ color: '#fff6dc' }));
      pointer.position.y = gate.radius + 4; pointer.rotation.z = Math.PI; g.add(pointer);
      const runes = new THREE.InstancedMesh(new THREE.OctahedronGeometry(.55), new THREE.MeshBasicMaterial({ color: '#c3ffe6', fog: false }), 12);
      const transform = new THREE.Object3D();
      for (let n = 0; n < 12; n++) {
        const angle = n / 12 * Math.PI * 2;
        transform.position.set(Math.cos(angle) * (gate.radius + 1.6), Math.sin(angle) * (gate.radius + 1.6), 0);
        transform.rotation.z = angle; transform.scale.set(.65, 1.8, .65); transform.updateMatrix(); runes.setMatrixAt(n, transform.matrix);
      }
      g.add(runes); g.userData.runes = runes; g.userData.pointer = pointer;
      this.scene.add(g); this.gates.push(g);
    });
  }
  update(a) {
    if (!a) return;
    this.gates.forEach((visual, i) => {
      const gate = a.course.gates[i]; visual.visible = i >= a.nextGate && gate.s - a.run.distance < 520;
      placeOnWorld(visual, gate.x, gate.s, gate.y, a.run.distance);
      const active = i === a.nextGate;
      if (i < this.gates.length - 1) visual.children[0].material.color.set(active ? '#a6ffe3' : '#cfaa68').multiplyScalar(active ? 3.3 : 1);
      visual.userData.runes.visible = active;
      visual.userData.runes.rotation.z = a.elapsed * .35;
      visual.userData.runes.material.color.set(i === this.gates.length - 1 ? '#ffd99c' : '#a6ffe3').multiplyScalar(3.5);
      visual.userData.pointer.position.y = gate.radius + 4 + Math.sin(a.elapsed * 3) * .7;
    });
    const sample = a.countdown === 0 ? ghostAt(a.ghost?.samples, a.elapsed) : null;
    this.ghost.root.visible = !!sample && !a.finished && !a.dnf && Math.abs(sample[3] - a.run.distance) < 500;
    if (!this.ghost.root.visible) return;
    placeOnWorld(this.ghost.root, sample[1], sample[3], sample[2], a.run.distance);
    this.ghost.body.rotation.z = -sample[4] * .015;
    if (sample[6] > 0) { const t = 1 - sample[6] / .85; this.ghost.body.rotation.z += t * t * (3 - 2 * t) * Math.PI * 2 * sample[7]; }
    this.ghost.body.rotation.x = sample[5] * .018;
  }
}
