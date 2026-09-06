import * as THREE from 'three';

export class ThreatRadar {
  constructor(root) {
    this.root = root; this.point = new THREE.Vector3();
    this.markers = Array.from({ length: 4 }, () => { const m = document.createElement('div'); m.className = 'threat-marker'; root.append(m); return m; });
  }
  update(targets, run, camera, visible, time) {
    this.root.hidden = !visible;
    if (!visible) return;
    const threats = targets.filter(e => ['bandit', 'guard', 'giant'].includes(e.kind) && e.s > run.distance - 45 && e.s < run.distance + 165)
      .sort((a, b) => Math.abs(a.s - run.distance) - Math.abs(b.s - run.distance)).slice(0, 4);
    this.markers.forEach((m, i) => {
      const e = threats[i]; m.hidden = !e; if (!e) return;
      this.point.copy(e.visual.position).project(camera);
      const behind = e.s < run.distance;
      const x = behind ? (e.x < run.x ? -.95 : .95) : Math.max(-.90, Math.min(.90, this.point.x));
      const y = behind ? -.1 : Math.max(-.4, Math.min(.5, this.point.y));
      m.style.left = (x + 1) * 50 + '%'; m.style.top = (1 - y) * 50 + '%';
      m.classList.toggle('firing', !!e.aimTargets);
      const range = Math.round(Math.hypot(e.x - run.x, e.y - run.altitude, e.s - run.distance));
      m.textContent = `${e.x < run.x ? '‹' : '›'} ${e.kind === 'guard' ? 'TOWER' : e.kind === 'giant' ? 'GIANT' : 'ARCHER'} · ${range}m`;
      m.style.setProperty('--pulse', String(1 + Math.sin(time * 7 + i) * .08));
    });
  }
}
