import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RADIUS, CHUNK, ZONES, SPELLS, cliffRailAt, random } from './game.js';
import { toonMaterial } from './toon.js';

const materials = new Map();
const mergedMaterials = new Map();
export function mat(color, glow = false, surface = 'plaster') {
  const key = `${color}:${glow}:${surface}`;
  if (!materials.has(key)) materials.set(key, glow ? new THREE.MeshBasicMaterial({ color }) : toonMaterial(color, { surface }));
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
    // Bake each object's linear pigment into vertex colors, then merge by
    // surface instead of color. Dense groves cost a few draws per chunk.
    const colors = new Float32Array(positions.count * 3), tint = m.material.color;
    for (let i = 0; i < positions.count; i++) { colors[i * 3] = tint.r; colors[i * 3 + 1] = tint.g; colors[i * 3 + 2] = tint.b; }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const key = `${m.material.type}:${m.material.map?.uuid || ''}:${m.material.side}`;
    if (!mergedMaterials.has(key)) {
      const material = m.material.isMeshBasicMaterial ? new THREE.MeshBasicMaterial({ color: '#ffffff', vertexColors: true }) : toonMaterial('#ffffff');
      material.map = m.material.map; material.side = m.material.side; material.vertexColors = true;
      mergedMaterials.set(key, material);
    }
    if (!sets.has(key)) sets.set(key, { mat: mergedMaterials.get(key), geos: [] }); sets.get(key).geos.push(g);
  } });
  const result = new THREE.Group();
  for (const { mat: material, geos } of sets.values()) { const geometry = mergeGeometries(geos, false); const m = new THREE.Mesh(geometry, material); m.castShadow = m.receiveShadow = true; result.add(m); geos.forEach(g => g.dispose()); }
  return result;
}
function windowOn(parent, x, y, z, width, height, color = '#354e60', ry = 0) { return mesh(archGeo, color, parent, [x, y, z], [width, height, 1], [0, ry, 0]); }
export function building(parent, x, z, w, h, d, rng, grand = false) {
  const base = -x * x / (2 * RADIUS);
  const g = new THREE.Group(); parent.add(g); g.position.set(x, base, z);
  g.rotation.y = (rng() - .5) * Math.PI * 2;
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
function acacia(parent, x, z, height, rng) {
  const y = -x * x / (2 * RADIUS);
  mesh(cylinder, '#765542', parent, [x, y + height * .42, z], [.65, height * .84, .65], [0, 0, .12]);
  for (const side of [-1, 1]) {
    mesh(cylinder, '#765542', parent, [x + side * height * .13, y + height * .7, z], [.32, height * .45, .32], [0, 0, side * -.65]);
    for (let layer = 0; layer < 3; layer++) mesh(orb, ['#3d7157', '#639160', '#87ab68'][layer], parent,
      [x + side * height * .19 + (rng() - .5) * 2, y + height * (.82 + layer * .055), z + (rng() - .5) * 3],
      [height * (.42 - layer * .055), height * .13, height * (.32 - layer * .04)]);
  }
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
  const x = side * (120 + rng() * 28), z = -18 - rng() * 28, ground = -x * x / (2 * RADIUS);
  if (type === 'city' || type === 'palace') {
    building(parent, x, z, 34, 34, 29, rng, true);
    for (const offset of [-25, 25]) {
      building(parent, x + offset, z + 3, 15, 23, 18, rng, true);
      minaret(parent, x + offset * 1.2, z + 10, 56, rng);
    }
    // Three-tier stairs and an arcaded forecourt below the great dome.
    for (let i = 0; i < 3; i++) block(parent, '#efd1a0', x, ground + .3 + i * .45, z + 16 - i, 28 - i * 2, .6, 8);
    for (let i = -2; i <= 2; i++) windowOn(parent, x + i * 3.5, ground + 5, z + 10.04, 2, 5, '#36787f');
  } else if (type === 'canyon') {
    for (const offset of [-17, 17]) rock(parent, x + offset, z, 12, 48, '#ba7f68', rng);
    mesh(orb, '#c88e70', parent, [x, ground + 41, z], [32, 8, 9]);
  } else if (type === 'ancient') {
    for (const offset of [-16, 16]) ruin(parent, x + offset, z, 40);
    mesh(ring, '#e9b992', parent, [x, ground + 36, z], [14, 14, 14], [0, 0, 0]);
    mesh(gem, '#9bd8d0', parent, [x, ground + 36, z], [4, 7, 4], [0, .5, .15], true);
    for (let i = 0; i < 4; i++) block(parent, '#d7af97', x, ground + i * 1.1, z, 19 - i * 3, 1.2, 19 - i * 3);
  } else if (type === 'desert') {
    for (let i = 0; i < 4; i++) mesh(cone, i % 2 ? '#aa6274' : '#e4be87', parent, [x + (i - 1.5) * 8, ground + 4, z + Math.sin(i) * 6], [6, 8, 6]);
    palm(parent, x - 18, z, 14, rng); palm(parent, x + 16, z + 8, 11, rng);
    fountain(parent, x, z + 15, 2);
  } else if (type === 'river') {
    building(parent, x, z, 16, 16, 15, rng, true);
    for (let i = 0; i < 5; i++) ruin(parent, side * (75 + i * 18), z + 10, 13);
  } else {
    const tower = building(parent, x, z, 8, 15, 8, rng);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .6; mesh(box, '#f5dcaa', tower, [Math.cos(a) * 4, 12 + Math.sin(a) * 4, 4.5], [7, .75, .15], [0, 0, a]); }
    for (const offset of [-14, 14]) building(parent, x + offset, z, 8, 5, 9, rng);
  }
}

export function createChunkVisual(data, seed, arena = false) {
  const rng = random(seed + data.index * 7919), g = new THREE.Group(), type = ZONES[data.zone].type;
  // Broad ground segments are curved across the planet's latitude.
  for (let x = -216; x <= 216; x += 12) {
    const tile = block(g, ZONES[data.zone].ground, x, -.65 - x * x / (2 * RADIUS), -CHUNK / 2, 12.2, 1.1, CHUNK + .2); tile.rotation.z = -x / RADIUS;
    tile.material = mat(ZONES[data.zone].ground, false, 'sand');
    if ((type === 'city' || type === 'palace') && Math.abs(x) < 60) {
      block(g, '#eac493', x, -.045 - x * x / (2 * RADIUS), -CHUNK / 2, 12.1, .05, CHUNK);
    }
  }
  if (type === 'river') for (let z = 0; z < CHUNK; z += 8) {
    const center = Math.sin((data.start + z) / 220) * 23;
    const angle = Math.atan(Math.cos((data.start + z) / 220) * 23 / 220);
    block(g, '#52a6ad', center, .02 - center * center / (2 * RADIUS), -z - 4, 40 + Math.sin((data.start + z) / 130) * 8, .08, 9, angle);
  }
  for (const side of [-1, 1]) {
    if (['city', 'palace', 'river', 'farm'].includes(type)) {
      const lush = type === 'palace' || type === 'river' || type === 'farm';
      for (let i = 0; i < (lush ? 7 : 3); i++) {
        const x = side * (78 + rng() * 115), z = -rng() * CHUNK;
        if (i % 3 === 0) acacia(g, x, z, 23 + rng() * 22, rng);
        else palm(g, x, z, 14 + rng() * 17, rng);
      }
      for (let i = 0; i < 12; i++) {
        const x = side * (64 + rng() * 95), z = -rng() * CHUNK, base = -x * x / (2 * RADIUS);
        mesh(orb, i % 2 ? '#527e59' : '#7a9c64', g, [x, base + 1, z], [2 + rng() * 3, 1.5 + rng() * 2, 3]);
      }
    }
    if (type === 'city' || type === 'palace') {
      const count = 4 + Math.floor(rng() * 7);
      for (let j = 0; j < count; j++) {
        const x = side * (76 + rng() * 108), z = -rng() * CHUNK;
        if (type === 'palace' && j % 3 === 0) { fountain(g, x, z, 1.7); palm(g, x + side * 10, z, 10 + rng() * 7, rng); }
        else building(g, x, z, 10 + rng() * 14, 10 + rng() * 27, 10 + rng() * 13, rng, type === 'palace');
      }
      if (rng() > .35) minaret(g, side * (95 + rng() * 60), -rng() * CHUNK, 34 + rng() * 30, rng);
      for (let i = 0; i < 4; i++) palm(g, side * (62 + rng() * 30), -rng() * CHUNK, 8 + rng() * 7, rng);
      if (type === 'palace') for (let j = 0; j < 4; j++) block(g, '#567f65', side * (64 + rng() * 16), -1, -rng() * CHUNK, 5, 4, 10, rng());
    } else if (type === 'desert') {
      for (let i = 0; i < 5; i++) { const x = side * (94 + rng() * 100); mesh(orb, i % 2 ? '#e9ba7a' : '#dbab70', g, [x, -9 - x * x / (2 * RADIUS), -rng() * CHUNK], [22 + rng() * 20, 16 + rng() * 14, 28], [0, rng() * 3, 0]); }
      if (data.index % 3 === 0) { palm(g, side * 73, -22, 13, rng); mesh(cone, '#b45c69', g, [side * 82, -1, -35], [7, 8, 7]); }
    } else if (type === 'canyon') {
      for (let i = 0; i < 7; i++) { const x = side * (80 + rng() * 100), h = 22 + rng() * 64; rock(g, x, -rng() * CHUNK, 9 + rng() * 16, h, i % 2 ? '#b97867' : '#ce9274', rng); }
    } else if (type === 'river') {
      for (let i = 0; i < 7; i++) palm(g, side * (67 + rng() * 95), -rng() * CHUNK, 9 + rng() * 10, rng);
      if (data.index % 2 === 0) building(g, side * 103, -rng() * CHUNK, 15, 18, 17, rng);
      if (data.index % 3 === 0) { block(g, '#7e7666', side * 66, -1.4, -28, 12, .7, 7, .3); mesh(cone, '#fbdeb0', g, [side * 66, 4, -28], [3, 9, .08], [0, .3, .12]); }
    } else if (type === 'farm') {
      for (let row = 0; row < 5; row++) { const x = side * (80 + row * 22); block(g, row % 2 ? '#c9b76c' : '#718e5a', x, -.1 - x * x / (2 * RADIUS), -32, 18, .15, 55, (rng() - .5) * .45); for (let k = 0; k < 5; k++) mesh(cone, '#7a985b', g, [x + rng() * 7, .7 - x * x / (2 * RADIUS), -k * 13], [3, 4, 3]); }
      if (data.index % 2 === 0) building(g, side * 85, -rng() * CHUNK, 12, 11, 14, rng);
    } else {
      for (let i = 0; i < 4; i++) ruin(g, side * (75 + i * 29 + rng() * 13), -rng() * CHUNK, 13 + rng() * 29);
      for (let i = 0; i < 4; i++) rock(g, side * (90 + rng() * 95), -rng() * CHUNK, 7 + rng() * 10, 14 + rng() * 18, '#ad8b89', rng);
    }
  }
  const rail = cliffRailAt(data.start);
  if (rail && !arena) {
    // The inner face stays at |x|=56, just outside the playable boundary.
    // Low ledge stripes mark the wall that grants cliff-skimming speed.
    for (let i = 0; i < 4; i++) {
      const z = -8 - i * 16, x = rail.side * 68, base = -56 * 56 / (2 * RADIUS);
      block(g, i % 2 ? '#a96857' : '#b87960', x, base + 23, z, 24, 46, 16.2);
      for (const y of [7, 20, 34]) block(g, '#deb285', rail.side * 56.15, base + y, z, .25, .35, 16.2);
      mesh(gem, '#9cf5dc', g, [rail.side * 55.7, base + 12, z], [.18, .4, .7], [0, 0, 0], true);
      rock(g, rail.side * (77 + rng() * 12), z, 12, 52 + rng() * 20, '#ba8168', rng);
    }
  }
  for (const o of arena ? [] : data.obstacles) {
    const body = new THREE.Group(); body.position.set(o.x, -o.x * o.x / (2 * RADIUS), -(o.s - data.start)); body.rotation.y = o.angle || 0; g.add(body);
    if (type === 'city' || type === 'palace' || type === 'farm') {
      block(body, rng() > .5 ? '#e8b380' : '#edc89b', 0, o.height / 2, 0, o.width, o.height, o.depth);
      block(body, '#f6d9a6', 0, o.height - .18, 0, o.width + .2, .35, o.depth + .2);
      windowOn(body, 0, .05, o.depth / 2 + .02, 2.8, Math.min(5.5, o.height * .7));
      for (const side of [-1, 1]) for (let level = 4; level < o.height - 2; level += 4.5) {
        windowOn(body, side * o.width * .3, level, o.depth / 2 + .025, 1.2, 2);
        windowOn(body, side * (o.width / 2 + .025), level, 0, 1.4, 2, '#354e60', side * Math.PI / 2);
      }
    } else if (type === 'ancient') {
      block(body, '#bf998c', 0, o.height / 2, 0, o.width, o.height, o.depth);
      block(body, '#e8c5a8', 0, o.height - .2, 0, o.width + .4, .4, o.depth + .4);
    } else {
      block(body, type === 'canyon' ? '#b97d68' : '#c79876', 0, o.height / 2, 0, o.width, o.height, o.depth);
      block(body, '#d6aa84', 0, o.height - .3, 0, o.width + .1, .6, o.depth + .1);
    }
  }
  if (data.index % 6 === 3) landmark(g, type, Math.floor(data.index / 6) % 2 ? -1 : 1, rng);
  // Gold roadside lanterns make the flight corridor legible at night.
  for (const side of [-1, 1]) {
    const x = side * (59 + rng() * 3), z = -rng() * CHUNK;
    block(g, '#8f7967', x, 2 - x * x / (2 * RADIUS), z, .18, 4, .18);
    mesh(gem, '#ffe0a1', g, [x, 4.3 - x * x / (2 * RADIUS), z], [.5, .9, .5], [0, .4, 0], true);
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
  const fabric = new THREE.Mesh(geo, toonMaterial('#9d3e69', { surface: 'cloth', side: THREE.DoubleSide })); fabric.castShadow = true; fabric.receiveShadow = true; body.add(fabric);
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
    const colors = Object.fromEntries(Object.entries(SPELLS).map(([key, value]) => [key, value.color]));
    mesh(gem, colors[kind], g, [0, 0, 0], [.85, 1.2, .85], [0, .3, 0], true);
    mesh(ring, '#f8dfb0', g, [0, 0, 0], [1.5, 1.5, 1.5], [.3, .4, 0]);
    mesh(ring, colors[kind], g, [0, 0, 0], [1.35, 1.35, 1.35], [1.6, .2, 0]);
  }
  return g;
}
export function createEnemy(kind = 'stalker') {
  const g = new THREE.Group();
  const skin = kind === 'hexer' ? '#373050' : kind === 'brute' ? '#652c35' : '#282b3d';
  const glow = kind === 'hexer' ? '#b48bff' : '#ff4c24';
  mesh(orb, skin, g, [0, 0, 0], [1.05, 1.3, .75]);
  mesh(cone, '#211f32', g, [0, -1.3, 0], [.9, 2, .6], [Math.PI, 0, .22]);
  mesh(gem, '#d0b690', g, [0, .95, .3], [.74, .7, .54]);
  mesh(orb, '#1a1423', g, [0, .62, .76], [.4, .28, .12]);
  for (let i = -2; i <= 2; i++) mesh(cone, '#fff1c6', g, [i * .13, .73, .85], [.065, .26, .055], [Math.PI, 0, 0]);
  for (const side of [-1, 1]) {
    mesh(orb, glow, g, [side * .29, 1.04, .74], [.22, .10, .10], [0, 0, side * -.35], true);
    mesh(cone, '#211c2c', g, [side * .6, 1.75, 0], [.28, 1.6, .26], [0, 0, side * -.5]);
    mesh(orb, skin, g, [side * 1.45, .15, .15], [.8, .3, .4], [0, 0, side * -.4]);
    for (let finger = 0; finger < 3; finger++) mesh(cone, '#d7bd94', g, [side * (1.85 + finger * .12), -.38, .25 + finger * .24], [.12, .95, .12], [Math.PI, 0, side * .3]);
    if (kind === 'stalker' || kind === 'boss') mesh(cone, skin, g, [side * 2, .4, -.35], [1.5, 2.5, .12], [0, 0, side * -.95]);
    for (let rib = 0; rib < 3; rib++) mesh(box, '#9b735f', g, [side * .42, .2 - rib * .3, .71], [.68, .10, .12], [0, 0, side * .18]);
  }
  mesh(gem, glow, g, [0, -.15, .83], [.23, .4, .17], [0, 0, 0], true);
  const healthBack = block(g, '#413b59', 0, 2.05, 0, 1.9, .13, .1);
  const health = block(g, '#f2bf83', 0, 2.05, .065, 1.8, .09, .03);
  const charge = mesh(ring, '#ffb2cd', g, [0, .2, .7], [1.5, 1.5, 1.5], [0, 0, 0], true); charge.visible = false;
  const frost = mesh(ring, '#b8f2f2', g, [0, .1, 0], [1.55, 1.55, 1.55], [.5, 0, 0], true); frost.visible = false;
  const burn = new THREE.Group(); g.add(burn); burn.visible = false;
  for (let i = 0; i < 3; i++) mesh(cone, i === 1 ? '#ffe29a' : '#ff6324', burn, [Math.sin(i * 2.1) * .8, -.3, Math.cos(i * 2.1) * .8], [.3, 1.7, .3], [0, 0, .2], true);
  g.userData = { health, healthBack, charge, frost, burn, baseScale: kind === 'boss' ? 4.4 : kind === 'brute' ? 1.65 : 1.25 };
  g.scale.setScalar(g.userData.baseScale);
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
