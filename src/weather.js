import * as THREE from 'three';
import { random } from './game.js';
import { mat } from './world.js';
import { elevationAt } from './landscape.js';
const wrap = (v, span) => ((v % span) + span) % span;

export function weatherAt(time, zone) {
  const stage = Math.floor(time / 24) % 7, dry = ['desert', 'canyon', 'ancient'].includes(zone);
  const name = ['clear', 'wind', 'rain', 'storm', 'wind', 'clear', 'storm'][stage];
  return { wind: name === 'clear' ? .25 : name === 'wind' ? .65 : 1,
    rain: !dry && (name === 'rain' || name === 'storm'), sand: dry && (name === 'rain' || name === 'storm'), storm: name === 'storm' };
}

export class WeatherField {
  constructor(scene) {
    const rng = random(57291);
    this.seeds = Array.from({ length: 1400 }, () => [rng(), rng(), rng(), rng()]);
    const leafGeo = new THREE.OctahedronGeometry(1, 0);
    this.leaves = new THREE.InstancedMesh(leafGeo, mat('#85a45d', false, 'smooth'), 180);
    this.leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.leaves.frustumCulled = false; scene.add(this.leaves);
    for (let i = 0; i < 180; i++) this.leaves.setColorAt(i, new THREE.Color(['#eee4a4', '#b8dc86', '#e8ad65', '#93bd9e'][i % 4]));
    this.rainPositions = new Float32Array(700 * 6); const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#d2e9ed', transparent: true, opacity: .45, depthWrite: false })); this.rain.frustumCulled = false; scene.add(this.rain);
    this.sandPositions = new Float32Array(1400 * 3); const sandGeo = new THREE.BufferGeometry();
    sandGeo.setAttribute('position', new THREE.BufferAttribute(this.sandPositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.sand = new THREE.Points(sandGeo, new THREE.PointsMaterial({ color: '#f2c087', size: .36, transparent: true, opacity: .5, depthWrite: false })); this.sand.frustumCulled = false; scene.add(this.sand);
    this.gustPositions = new Float32Array(48 * 4 * 6); const gustGeo = new THREE.BufferGeometry();
    gustGeo.setAttribute('position', new THREE.BufferAttribute(this.gustPositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.gusts = new THREE.LineSegments(gustGeo, new THREE.LineBasicMaterial({ color: '#eaf2d3', transparent: true, opacity: .25, depthWrite: false })); this.gusts.frustumCulled = false; scene.add(this.gusts);
    this.transform = new THREE.Object3D(); this.flash = 0; this.lastFlash = -1;
  }
  update(time, distance, x, altitude, zone, weather) {
    const { wind, rain, sand, storm } = weather, lush = ['city', 'palace', 'river', 'farm'].includes(zone);
    const centeredHeight = elevationAt(distance);
    this.leaves.count = lush ? Math.floor(70 + wind * 110) : 0;
    for (let i = 0; i < this.leaves.count; i++) {
      const [a, b, c, d] = this.seeds[i], spin = time * (1 + wind * 2) + a * 40;
      this.transform.position.set(wrap(a * 220 + time * (10 + wind * 17), 220) - 110 + Math.cos(spin) * 3, centeredHeight + 5 + b * 42 + Math.sin(spin) * 3, 35 - wrap(c * 280 - distance + time * wind * 5, 280));
      this.transform.rotation.set(spin, spin * .7, d * 6 + spin * 1.4); this.transform.scale.set(.16 + d * .22, .025, .45 + d * .6); this.transform.updateMatrix(); this.leaves.setMatrixAt(i, this.transform.matrix);
    }
    this.leaves.instanceMatrix.needsUpdate = true;
    this.rain.visible = rain; this.sand.visible = sand;
    if (rain) for (let i = 0; i < 700; i++) {
      const [a, b, c] = this.seeds[i], px = wrap(a * 220 + time * wind * 14, 220) - 110;
      const py = centeredHeight + 70 - ((b * 90 + time * 48) % 90), pz = 20 - wrap(c * 230 - distance, 230), n = i * 6;
      this.rainPositions.set([px, py, pz, px - wind * 1.4, py + 3, pz - 1], n);
    }
    if (sand) for (let i = 0; i < 1400; i++) {
      const [a, b, c] = this.seeds[i], angle = time * 1.7 + b * 35;
      this.sandPositions.set([wrap(a * 220 + time * 32, 220) - 110, centeredHeight + b * 55 + Math.sin(angle) * 7, 25 - wrap(c * 240 - distance + time * 9, 240)], i * 3);
    }
    this.rain.geometry.attributes.position.needsUpdate = rain; this.sand.geometry.attributes.position.needsUpdate = sand;
    this.gusts.material.opacity = .08 + wind * .22;
    for (let i = 0; i < 48; i++) {
      const [a, b, c] = this.seeds[i], z = 20 - wrap(c * 260 - distance + time * 7, 260), angle = time * .7 + a * 20;
      for (let j = 0; j < 4; j++) for (let end = 0; end < 2; end++) {
        const t = (j + end) / 4, arc = angle + t * 1.6;
        this.gustPositions.set([wrap(a * 220 + time * (12 + wind * 14), 220) - 110 + t * 13 + Math.sin(arc) * 3, centeredHeight + b * 50 + Math.cos(arc) * 3, z - t * 5], (i * 8 + j * 2 + end) * 3);
      }
    }
    this.gusts.geometry.attributes.position.needsUpdate = true;
    // A brief distant flash every nine seconds, never a rapid full-screen strobe.
    const cycle = Math.floor(time / 9), phase = time % 9;
    this.flash = storm && phase < .18 ? (1 - phase / .18) * .6 : 0;
    const thunder = this.flash > 0 && cycle !== this.lastFlash;
    if (thunder) this.lastFlash = cycle;
    return thunder;
  }
}
