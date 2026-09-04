import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RADIUS, CHUNK, ZONES, random } from './game.js';

const gradient = new THREE.DataTexture(new Uint8Array([95, 166, 220, 255]), 4, 1, THREE.RedFormat);
gradient.minFilter = gradient.magFilter = THREE.NearestFilter; gradient.needsUpdate = true;
const materials = new Map();
export function mat(color, glow = false) {
  const key = color + glow;
  if (!materials.has(key)) materials.set(key, glow ? new THREE.MeshBasicMaterial({ color }) : new THREE.MeshToonMaterial({ color, gradientMap: gradient }));
  return materials.get(key);
}
const box = new THREE.BoxGeometry(1, 1, 1);
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
const cone = new THREE.ConeGeometry(1, 1, 8);
const orb = new THREE.SphereGeometry(1, 12, 8);
const dome = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
const gem = new THREE.OctahedronGeometry(1, 0);
const ring = new THREE.TorusGeometry(1, .08, 5, 32);
const arch = new THREE.Shape(); arch.moveTo(-.5, 0); arch.lineTo(-.5, .62); arch.quadraticCurveTo(-.48, .84, 0, 1); arch.quadraticCurveTo(.48, .84, .5, .62); arch.lineTo(.5, 0);
const archGeo = new THREE.ShapeGeometry(arch, 5);
export function mesh(geometry, color, parent, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], glow = false) {
  const m = new THREE.Mesh(geometry, mat(color, glow)); m.position.set(...position); m.scale.set(...scale); m.rotation.set(...rotation); m.castShadow = !glow; m.receiveShadow = !glow; parent.add(m); return m;
}
export function block(parent, color, x, y, z, w, h, d, ry = 0) { return mesh(box, color, parent, [x, y, z], [w, h, d], [0, ry, 0]); }
function mergeGroup(group) {
  group.updateMatrixWorld(true); const sets = new Map();
  group.traverse(m => { if (m.isMesh) {
    const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld), positions = g.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const z = positions.getZ(i), radius = RADIUS + positions.getY(i), angle = z / RADIUS;
      positions.setY(i, Math.cos(angle) * radius - RADIUS); positions.setZ(i, Math.sin(angle) * radius);
    }
    g.computeVertexNormals();
    const key = m.material.uuid; if (!sets.has(key)) sets.set(key, { mat: m.material, geos: [] }); sets.get(key).geos.push(g);
  } });
  const result = new THREE.Group();
  for (const { mat: material, geos } of sets.values()) { const geometry = mergeGeometries(geos, false); const m = new THREE.Mesh(geometry, material); m.castShadow = m.receiveShadow = true; result.add(m); geos.forEach(g => g.dispose()); }
  return result;
}
function windowOn(parent, x, y, z, width, height, color = '#354e60', ry = 0) { return mesh(archGeo, color, parent, [x, y, z], [width, height, 1], [0, ry, 0]); }
export function building(parent, x, z, w, h, d, rng, grand = false) {
  const base = -x * x / (2 * RADIUS);
  const g = new THREE.Group(); parent.add(g); g.position.set(x, base, z);
  const walls = ['#f1bc86', '#e6a375', '#efd29f', '#d99672', '#f7d9a6'];
  const color = walls[Math.floor(rng() * walls.length)], roof = rng() > .35 ? '#398e91' : '#d6935e';
  block(g, color, 0, h / 2, 0, w, h, d);
  block(g, '#f8d8a3', 0, h - .1, 0, w + .45, .45, d + .45);
  block(g, '#c88966', 0, .2, 0, w + .3, .4, d + .3);
  if (grand || rng() > .5) {
    mesh(cylinder, '#efcd94', g, [0, h + .5, 0], [w * .43, 1, w * .43]);
    mesh(dome, roof, g, [0, h + .9, 0], [w * .53, w * .62, w * .53]);
    mesh(cone, '#eabd65', g, [0, h + w * .65 + 1, 0], [.18, 1.2, .18]);
    mesh(orb, '#f8d787', g, [0, h + w * .65 + 1.5, 0], [.18, .18, .18]);
  } else {
    block(g, '#d38f6d', 0, h + .13, 0, w - .4, .12, d - .4);
    for (const side of [-1, 1]) block(g, '#f2c48f', side * (w / 2 - .16), h + .45, 0, .3, .8, d);
    for (let k = 0; k < 4; k++) block(g, '#f2c48f', -w / 2 + k * w / 3, h + .4, d / 2, .5, .75, .45);
  }
  windowOn(g, 0, .05, d / 2 + .02, Math.min(2.5, w * .35), Math.min(h * .65, 4), '#53616b');
  const floors = Math.max(1, Math.floor(h / 4));
  for (let f = 0; f < floors; f++) for (const side of [-1, 1]) {
    windowOn(g, side * w * .28, 1.7 + f * 3.3, d / 2 + .025, w * .16, 1.6);
    windowOn(g, w / 2 + .025, 1.7 + f * 3.3, side * d * .23, w * .16, 1.6, '#456073', Math.PI / 2);
  }
  if (!grand && rng() > .45) {
    for (let a = 0; a < 4; a++) mesh(box, a % 2 ? '#f3cd96' : '#b95866', g, [-w * .32 + a * w * .215, 3, d / 2 + .8], [w * .22, .13, 1.8], [.2, 0, 0]);
    for (const side of [-1, 1]) block(g, '#927155', side * w * .43, 1.4, d / 2 + 1.6, .09, 2.8, .09);
  }
  return g;
}
function minaret(parent, x, z, h, rng) {
  const g = new THREE.Group(); g.position.set(x, -x * x / (2 * RADIUS), z); parent.add(g);
  mesh(cylinder, '#efd1a0', g, [0, h * .45, 0], [1.05, h * .9, 1.05]);
  for (const y of [h * .15, h * .68, h * .87]) { mesh(cylinder, '#f8ddae', g, [0, y, 0], [1.55, .4, 1.55]); mesh(cylinder, '#bd8666', g, [0, y - .23, 0], [1.23, .14, 1.23]); }
  mesh(dome, '#359694', g, [0, h, 0], [1.65, 2.5, 1.65]);
  mesh(cone, '#f7cf70', g, [0, h + 2.9, 0], [.15, 1.2, .15]);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; windowOn(g, Math.sin(a) * 1.07, h * .7, Math.cos(a) * 1.07, .65, 1.4, '#315668', a); }
}
function palm(parent, x, z, h, rng) {
  const g = new THREE.Group(); g.position.set(x, -x * x / (2 * RADIUS), z); parent.add(g);
  mesh(cylinder, '#967158', g, [.3, h / 2, 0], [.23, h, .23], [0, 0, -.07]);
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + rng() * .3; const leaf = mesh(orb, i % 2 ? '#477f69' : '#669773', g, [Math.cos(a) * 1.2 + .5, h + .15, Math.sin(a) * 1.2], [2.4, .17, .58], [0, -a, .18]); leaf.rotation.z = Math.cos(a) * .22; }
  mesh(orb, '#c4955e', g, [.4, h - .2, 0], [.48, .45, .48]);
}
function rock(parent, x, z, w, h, color, rng) { mesh(gem, color, parent, [x, h * .35 - x * x / (2 * RADIUS), z], [w, h, w * .8], [0, rng() * 6.28, .1]); }
function ruin(parent, x, z, h) {
  const y = -x * x / (2 * RADIUS);
  for (const side of [-1, 1]) { block(parent, '#cda695', x + side * 2, y + h / 2, z, 1, h, 1.4); block(parent, '#e7c2a0', x + side * 2, y + h, z, 1.5, .6, 1.8); }
  block(parent, '#dfb59a', x, y + h + .5, z, 5.4, .8, 1.6);
  mesh(gem, '#92d2c8', parent, [x, y + h - 1.3, z], [.45, .75, .45], [0, .7, 0], true);
}
function fountain(parent, x, z, scale = 1) {
  const y = -x * x / (2 * RADIUS);
  mesh(cylinder, '#e8caa0', parent, [x, y + .4, z], [3.4 * scale, .7, 3.4 * scale]);
  mesh(cylinder, '#57b9b3', parent, [x, y + .79, z], [3.05 * scale, .1, 3.05 * scale]);
  mesh(cylinder, '#e8caa0', parent, [x, y + 1.7, z], [.4, 2, .4]);
  mesh(cylinder, '#f4dbab', parent, [x, y + 2.5, z], [1.6 * scale, .25, 1.6 * scale]);
  mesh(cone, '#a5e0d5', parent, [x, y + 3.3, z], [.7 * scale, 1.3, .7 * scale]);
}

function landmark(parent, type, side, rng) {
  const x = side * 58, z = -18, ground = -x * x / (2 * RADIUS);
  if (type === 'city' || type === 'palace') {
    building(parent, x, z, 21, 21, 20, rng, true);
    for (const offset of [-15, 15]) {
      building(parent, x + offset, z + 3, 9, 13, 12, rng, true);
      minaret(parent, x + offset * 1.2, z + 10, 36, rng);
    }
    // Three-tier stairs and an arcaded forecourt below the great dome.
    for (let i = 0; i < 3; i++) block(parent, '#efd1a0', x, ground + .3 + i * .45, z + 16 - i, 28 - i * 2, .6, 8);
    for (let i = -2; i <= 2; i++) windowOn(parent, x + i * 3.5, ground + 5, z + 10.04, 2, 5, '#36787f');
  } else if (type === 'canyon') {
    for (const offset of [-10, 10]) rock(parent, x + offset, z, 7, 28, '#ba7f68', rng);
    mesh(orb, '#c88e70', parent, [x, ground + 24, z], [19, 5, 5]);
  } else if (type === 'ancient') {
    for (const offset of [-9, 9]) ruin(parent, x + offset, z, 23);
    mesh(ring, '#e9b992', parent, [x, ground + 22, z], [8, 8, 8], [0, 0, 0]);
    mesh(gem, '#9bd8d0', parent, [x, ground + 22, z], [2.4, 4, 2.4], [0, .5, .15], true);
    for (let i = 0; i < 4; i++) block(parent, '#d7af97', x, ground + i * 1.1, z, 19 - i * 3, 1.2, 19 - i * 3);
  } else if (type === 'desert') {
    for (let i = 0; i < 4; i++) mesh(cone, i % 2 ? '#aa6274' : '#e4be87', parent, [x + (i - 1.5) * 8, ground + 4, z + Math.sin(i) * 6], [6, 8, 6]);
    palm(parent, x - 18, z, 14, rng); palm(parent, x + 16, z + 8, 11, rng);
    fountain(parent, x, z + 15, 2);
  } else if (type === 'river') {
    building(parent, x, z, 16, 16, 15, rng, true);
    for (let i = 0; i < 5; i++) ruin(parent, side * (31 + i * 8), z + 10, 7);
  } else {
    const tower = building(parent, x, z, 8, 15, 8, rng);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .6; mesh(box, '#f5dcaa', tower, [Math.cos(a) * 4, 12 + Math.sin(a) * 4, 4.5], [7, .75, .15], [0, 0, a]); }
    for (const offset of [-14, 14]) building(parent, x + offset, z, 8, 5, 9, rng);
  }
}

export function createChunkVisual(data, seed) {
  const rng = random(seed + data.index * 7919), g = new THREE.Group(), type = ZONES[data.zone].type;
  // Broad ground segments are curved across the planet's latitude.
  for (let x = -112; x <= 112; x += 8) {
    const ground = type === 'river' && Math.abs(x) < 12 ? '#52a6ad' : ZONES[data.zone].ground;
    const tile = block(g, ground, x, -.65 - x * x / (2 * RADIUS), -CHUNK / 2, 8.2, 1.1, CHUNK + .2); tile.rotation.z = -x / RADIUS;
    if ((type === 'city' || type === 'palace') && Math.abs(x) < 22) {
      block(g, '#eac493', x, -.045 - x * x / (2 * RADIUS), -CHUNK / 2, 7.9, .05, CHUNK);
      for (let z = -4; z > -CHUNK; z -= 8) block(g, '#d9b182', x, .01 - x * x / (2 * RADIUS), z, 7.8, .018, .08);
    }
  }
  for (const side of [-1, 1]) {
    if (type === 'city' || type === 'palace') {
      for (let row = 0; row < 3; row++) for (let j = 0; j < 2; j++) {
        const x = side * (30 + row * 17 + rng() * 6), z = -4 - j * 18 - rng() * 6;
        if (type === 'palace' && row === 0) { fountain(g, x, z, 1); palm(g, x + side * 6, z, 6 + rng() * 3, rng); }
        else building(g, x, z, 7 + rng() * 6, 5 + rng() * 13, 7 + rng() * 6, rng, type === 'palace');
      }
      if (data.index % 2 === 0) minaret(g, side * (41 + rng() * 9), -18, 22 + rng() * 12, rng);
      for (let i = 0; i < 3; i++) palm(g, side * (23.5 + rng() * 4), -i * 13, 5 + rng() * 4, rng);
      if (type === 'palace') for (let j = 0; j < 5; j++) block(g, '#567f65', side * 25, 1, -j * 8, 2, 2.1, 6);
    } else if (type === 'desert') {
      for (let i = 0; i < 5; i++) { const x = side * (31 + rng() * 65); mesh(orb, i % 2 ? '#e9ba7a' : '#dbab70', g, [x, -6 - x * x / (2 * RADIUS), -rng() * CHUNK], [12 + rng() * 13, 8 + rng() * 6, 14], [0, rng(), 0]); }
      if (data.index % 3 === 0) { palm(g, side * 30, -12, 7, rng); mesh(cone, '#b45c69', g, [side * 33, 2, -23], [4, 4, 4]); }
    } else if (type === 'canyon') {
      for (let i = 0; i < 6; i++) { const x = side * (28 + rng() * 38), h = 13 + rng() * 34; rock(g, x, -rng() * CHUNK, 5 + rng() * 7, h, i % 2 ? '#b97867' : '#ce9274', rng); }
    } else if (type === 'river') {
      for (let i = 0; i < 6; i++) palm(g, side * (25 + rng() * 45), -rng() * CHUNK, 5 + rng() * 7, rng);
      if (data.index % 2 === 0) building(g, side * 43, -18, 7, 7, 8, rng);
      for (let i = 0; i < 6; i++) block(g, '#a7dace', side * (2 + rng() * 7), .02, -rng() * CHUNK, .2, .035, 2 + rng() * 5);
      if (data.index % 3 === 0) { block(g, '#7e7666', side * 16, .8, -18, 8, .4, 4); mesh(cone, '#fbdeb0', g, [side * 16, 3.9, -18], [2, 5, .08], [0, 0, .12]); }
    } else if (type === 'farm') {
      for (let row = 0; row < 5; row++) { const x = side * (29 + row * 9); block(g, row % 2 ? '#c9b76c' : '#718e5a', x, -.1 - x * x / (2 * RADIUS), -18, 7, .15, 33); for (let k = 0; k < 5; k++) mesh(cone, '#7a985b', g, [x, .7 - x * x / (2 * RADIUS), -k * 7], [1.9, 2, 1.9]); }
      if (data.index % 2 === 0) building(g, side * 36, -18, 6, 5, 7, rng);
    } else {
      for (let i = 0; i < 4; i++) ruin(g, side * (28 + i * 13), -rng() * CHUNK, 6 + rng() * 14);
      for (let i = 0; i < 4; i++) rock(g, side * (35 + rng() * 50), -rng() * CHUNK, 4 + rng() * 5, 8 + rng() * 8, '#ad8b89', rng);
    }
  }
  for (const o of data.obstacles) {
    const z = -(o.s - data.start);
    if (type === 'city' || type === 'palace' || type === 'farm') {
      // Roof ornaments are decorative: obstacle collision covers the main footprint.
      // Flat roofs match the collision envelope exactly inside the playable lane.
      const base = -o.x * o.x / (2 * RADIUS);
      block(g, '#e8b380', o.x, base + o.height / 2, z, o.width, o.height, o.depth);
      block(g, '#f6d9a6', o.x, base + o.height - .18, z, o.width + .2, .35, o.depth + .2);
      windowOn(g, o.x, base + .05, z + o.depth / 2 + .02, 1.8, Math.min(3.5, o.height * .7));
      for (const side of [-1, 1]) windowOn(g, o.x + side * o.width * .3, base + o.height * .57, z + o.depth / 2 + .025, .8, 1.4);
    } else if (type === 'ancient') {
      block(g, '#bf998c', o.x, o.height / 2 - o.x * o.x / (2 * RADIUS), z, o.width, o.height, o.depth);
      block(g, '#e8c5a8', o.x, o.height - o.x * o.x / (2 * RADIUS), z, o.width + .4, .4, o.depth + .4);
    } else {
      const base = -o.x * o.x / (2 * RADIUS);
      block(g, type === 'canyon' ? '#b97d68' : '#c79876', o.x, base + o.height / 2, z, o.width, o.height, o.depth);
      block(g, '#d6aa84', o.x, base + o.height - .3, z, o.width + .1, .6, o.depth + .1);
    }
  }
  if (data.index % 6 === 3) landmark(g, type, Math.floor(data.index / 6) % 2 ? -1 : 1, rng);
  // Gold roadside lanterns make the flight corridor legible at night.
  for (const side of [-1, 1]) {
    block(g, '#8f7967', side * 23, 1.5 - 23 * 23 / (2 * RADIUS), -8, .13, 3, .13);
    mesh(gem, '#ffe0a1', g, [side * 23, 3.3 - 23 * 23 / (2 * RADIUS), -8], [.35, .65, .35], [0, .4, 0], true);
  }
  return mergeGroup(g);
}
export function placeOnWorld(object, x, s, height, distance) {
  const a = (s - distance) / RADIUS, r = RADIUS + height - x * x / (2 * RADIUS);
  object.position.set(x, Math.cos(a) * r - RADIUS, -Math.sin(a) * r); object.rotation.x = -a;
}
export function createCarpet() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const geo = new THREE.PlaneGeometry(3.7, 5.3, 12, 18); geo.rotateX(-Math.PI / 2);
  const fabric = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: '#9d3e69', gradientMap: gradient, side: THREE.DoubleSide })); fabric.castShadow = true; body.add(fabric);
  const trim = new THREE.Group(); body.add(trim);
  for (const side of [-1, 1]) {
    block(trim, '#edbd71', side * 1.69, .06, 0, .14, .07, 4.75);
    block(trim, '#e9b777', 0, .06, side * 2.31, 3.45, .07, .14);
    for (let i = 0; i < 9; i++) block(trim, '#efc87d', -1.6 + i * .4, .015, side * 2.78, .045, .05, .48);
  }
  const pattern = mesh(box, '#e8b979', body, [0, .07, .2], [1.65, .04, 1.65], [0, Math.PI / 4, 0]);
  mesh(box, '#317f8d', body, [0, .1, .2], [1.15, .04, 1.15], [0, Math.PI / 4, 0]);
  for (const z of [-1.5, 1.6]) mesh(gem, '#f2c67e', body, [0, .13, z], [.24, .03, .4]);
  const rider = new THREE.Group(); rider.position.set(0, .15, .25); body.add(rider);
  // A little robed traveler, turban, sash, boots and fluttering scarf.
  mesh(cone, '#286b81', rider, [0, .76, 0], [.66, 1.45, .55]);
  mesh(orb, '#409ba1', rider, [0, 1.19, -.04], [.52, .54, .39]);
  mesh(orb, '#c98666', rider, [0, 1.76, -.12], [.36, .4, .34]);
  mesh(orb, '#f7e2b3', rider, [0, 2.03, -.11], [.46, .3, .41]);
  mesh(gem, '#dd9a64', rider, [0, 2.11, -.49], [.14, .19, .06]);
  mesh(orb, '#f4d99d', rider, [.12, 2.43, -.04], [.08, .35, .1], [0, 0, -.24]);
  block(rider, '#e2b06f', 0, .72, -.1, .99, .18, .76);
  for (const side of [-1, 1]) {
    mesh(orb, '#327f8b', rider, [side * .63, 1.12, -.03], [.38, .18, .21], [0, 0, side * -.4]);
    mesh(orb, '#d89e77', rider, [side * .9, 1.03, -.09], [.15, .15, .16]);
    mesh(orb, '#e9bc78', rider, [side * .33, .15, -.48], [.2, .17, .4]);
  }
  const scarf = block(rider, '#eeab6e', .13, 1.48, .8, .32, .07, 1.4);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(2.5, 24), new THREE.MeshBasicMaterial({ color: '#4e545a', transparent: true, opacity: .16, depthWrite: false })); shadow.rotation.x = -Math.PI / 2;
  return { root, body, fabric, trim, scarf, pattern, shadow };
}
export function createPickup(kind) {
  const g = new THREE.Group();
  if (kind === 'gold') { mesh(gem, '#ffd88e', g, [0, 0, 0], [.34, .6, .34], [0, 0, .3], true); mesh(ring, '#eeb564', g, [0, 0, 0], [.55, .55, .55]); }
  else {
    const colors = { fire: '#ff9d66', frost: '#9de4e9', storm: '#f9dd81', echo: '#cbb0fa', magnet: '#8fdbab', ward: '#a4d5ff' };
    mesh(gem, colors[kind], g, [0, 0, 0], [.85, 1.2, .85], [0, .3, 0], true);
    mesh(ring, '#f8dfb0', g, [0, 0, 0], [1.5, 1.5, 1.5], [.3, .4, 0]);
    mesh(ring, colors[kind], g, [0, 0, 0], [1.35, 1.35, 1.35], [1.6, .2, 0]);
  }
  return g;
}
export function createEnemy() {
  const g = new THREE.Group();
  mesh(orb, '#696083', g, [0, 0, 0], [.8, 1.05, .65]);
  mesh(cone, '#5e587d', g, [0, -1.07, 0], [.6, 1.5, .5], [Math.PI, 0, .22]);
  mesh(orb, '#927ca4', g, [0, .8, 0], [.59, .55, .53]);
  for (const side of [-1, 1]) { mesh(orb, '#ffcd85', g, [side * .23, .82, .48], [.13, .09, .08], [0, 0, side * -.2], true); mesh(cone, '#ddae7f', g, [side * .4, 1.37, 0], [.18, .7, .18], [0, 0, side * -.3]); mesh(orb, '#7d7098', g, [side * 1.1, .2, 0], [.6, .2, .34], [0, 0, side * -.3]); }
  mesh(ring, '#b6a1be', g, [0, -.5, 0], [1.05, 1.05, 1.05], [Math.PI / 2, 0, 0]);
  const healthBack = block(g, '#413b59', 0, 2.05, 0, 1.9, .13, .1);
  const health = block(g, '#f2bf83', 0, 2.05, .065, 1.8, .09, .03);
  const charge = mesh(ring, '#ffb2cd', g, [0, .2, .7], [1.5, 1.5, 1.5], [0, 0, 0], true); charge.visible = false;
  const frost = mesh(ring, '#b8f2f2', g, [0, .1, 0], [1.55, 1.55, 1.55], [.5, 0, 0], true); frost.visible = false;
  g.userData = { health, healthBack, charge, frost };
  return g;
}
export function createRing(radius) {
  const g = new THREE.Group(); mesh(ring, '#f4cc80', g, [0, 0, 0], [radius, radius, radius], [0, 0, 0], true);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; mesh(gem, '#fff0c0', g, [Math.cos(a) * radius, Math.sin(a) * radius, 0], [.2, .35, .2], [0, 0, a - Math.PI / 2], true); }
  return g;
}
export function createSky(scene) {
  const uniforms = { top: { value: new THREE.Color('#72aaa9') }, bottom: { value: new THREE.Color('#efe1b6') } };
  const skyMaterial = new THREE.ShaderMaterial({ uniforms, vertexShader: 'varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}', fragmentShader: 'varying vec3 vPos; uniform vec3 top; uniform vec3 bottom; void main(){float h=normalize(vPos).y; gl_FragColor=vec4(mix(bottom,top,smoothstep(-0.1,0.65,h)),1.0);}', side: THREE.BackSide, depthWrite: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 24, 16), skyMaterial); scene.add(sky);
  const sun = mesh(new THREE.SphereGeometry(17, 24, 16), '#ffe5ac', scene, [110, 130, -310], [1, 1, 1], [0, 0, 0], true);
  const moon = mesh(new THREE.SphereGeometry(9, 18, 12), '#e1e9ed', scene, [-150, 160, -320], [1, 1, 1], [0, 0, 0], true);
  sun.material.fog = false; moon.material.fog = false;
  const rng = random(61), positions = [];
  for (let i = 0; i < 600; i++) { const a = rng() * Math.PI * 2, y = rng() * .9 + .1, r = Math.sqrt(1 - y * y); positions.push(Math.cos(a) * r * 550, y * 550, Math.sin(a) * r * 550); }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#fff3d8', size: 1.1, transparent: true, opacity: 0, depthWrite: false, fog: false })); scene.add(stars);
  const clouds = new THREE.Group();
  for (let i = 0; i < 25; i++) {
    const g = new THREE.Group(), a = rng() * Math.PI * 2, d = 190 + rng() * 110; g.position.set(Math.cos(a) * d, 40 + rng() * 65, Math.sin(a) * d);
    for (let j = 0; j < 4; j++) mesh(orb, '#eadfc9', g, [j * 5 - 7, Math.sin(j) * 2, 0], [7 + rng() * 4, 2 + rng() * 2, 4]);
    clouds.add(g);
  }
  scene.add(clouds);
  const lanterns = new THREE.Group();
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group(); g.position.set((rng() - .5) * 340, 45 + rng() * 80, -70 - rng() * 200); g.userData.baseY = g.position.y;
    mesh(orb, i % 2 ? '#d48b86' : '#e8bb7b', g, [0, 0, 0], [1.8, 2.9, 1.8]);
    mesh(cylinder, '#745c65', g, [0, -2.5, 0], [.7, .2, .7]);
    mesh(gem, '#ffe2a1', g, [0, -2.3, 0], [.3, .65, .3], [0, 0, 0], true);
    lanterns.add(g);
  }
  scene.add(lanterns); return { uniforms, sun, moon, stars, clouds, lanterns };
}
export function disposeChunk(group) { group.traverse(m => { if (m.isMesh) m.geometry.dispose(); }); }
export { gem, orb, ring };
