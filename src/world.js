import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RADIUS, CHUNK, ZONE_LENGTH, ZONES, SPELLS, cliffRailAt, random, paletteAt } from './game.js';
import { toonMaterial } from './toon.js';
import { elevationAt, passageAt, passageSolids } from './landscape.js';

const materials = new Map();
const mergedMaterials = new Map();
export function mat(color, glow = false, surface = 'plaster') {
  const key = `${color}:${glow}:${surface}`;
  if (!materials.has(key)) {
    const material = glow ? new THREE.MeshBasicMaterial({ color }) : toonMaterial(color, { surface });
    if (glow) material.color.multiplyScalar(3);
    materials.set(key, material);
  }
  return materials.get(key);
}
const box = new THREE.BoxGeometry(1, 1, 1);
// Long tunnel faces follow the sphere and elevation terraces rather than
// stretching a single flat quad below their collision surface.
const tunnelBox = new THREE.BoxGeometry(1, 1, 1, 4, 1, 16);
const groundBox = new THREE.BoxGeometry(1, 1, 1, 4, 1, 16);
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
const cone = new THREE.ConeGeometry(1, 1, 8);
const orb = new THREE.SphereGeometry(1, 12, 8);
const dome = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
const gem = new THREE.OctahedronGeometry(1, 0);
const ring = new THREE.TorusGeometry(1, .08, 5, 32);
const magnetArc = new THREE.TorusGeometry(.72, .22, 8, 24, Math.PI);
const arch = new THREE.Shape(); arch.moveTo(-.5, 0); arch.lineTo(-.5, .62); arch.quadraticCurveTo(-.48, .84, 0, 1); arch.quadraticCurveTo(.48, .84, .5, .62); arch.lineTo(.5, 0);
const archGeo = new THREE.ShapeGeometry(arch, 5);
export function mesh(geometry, color, parent, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], glow = false) {
  const m = new THREE.Mesh(geometry, mat(color, glow)); m.position.set(...position); m.scale.set(...scale); m.rotation.set(...rotation); m.castShadow = !glow; m.receiveShadow = !glow; parent.add(m); return m;
}
export function block(parent, color, x, y, z, w, h, d, ry = 0) { return mesh(box, color, parent, [x, y, z], [w, h, d], [0, ry, 0]); }
function mergeGroup(group, start = 0, palette = null) {
  group.updateMatrixWorld(true); const sets = new Map();
  group.traverse(m => { if (m.isMesh) {
    const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld), positions = g.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const z = positions.getZ(i), radius = RADIUS + positions.getY(i) + elevationAt(start - z) - elevationAt(start), angle = z / RADIUS;
      positions.setY(i, Math.cos(angle) * radius - RADIUS); positions.setZ(i, Math.sin(angle) * radius);
    }
    g.computeVertexNormals();
    // Bake each object's linear pigment into vertex colors, then merge by
    // surface instead of color. Dense groves cost a few draws per chunk.
    const colors = new Float32Array(positions.count * 3), tint = m.material.color.clone();
    if (palette && !m.material.isMeshBasicMaterial) tint.offsetHSL(palette.hue, palette.saturation, palette.lightness);
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
  g.rotation.y = (rng() - .5) * Math.PI * 2; g.scale.set(1.1, 1.25, 1.1);
  const walls = ['#f1bc86', '#e6a375', '#efd29f', '#d99672', '#f7d9a6'];
  const color = walls[Math.floor(rng() * walls.length)], roof = rng() > .35 ? '#398e91' : '#d6935e';
  // Embed a deep plinth below the lowest edge of the rotated footprint.
  // Latitude curves away from a flat building floor, especially far from the lane.
  const reach = Math.hypot(w, d) * .55;
  const foundationDepth = 1 + (Math.abs(x) * reach + reach * reach / 2) / RADIUS;
  block(g, '#b88664', 0, -foundationDepth / 2, 0, w + .3, foundationDepth + .2, d + .3);
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
  const rng = random(seed + data.index * 7919), g = new THREE.Group(), hazards = new THREE.Group(), type = ZONES[data.zone].type;
  const coastal = ['fishing', 'beach', 'island'].includes(type), highland = ['mountain', 'temple'].includes(type);
  // Broad ground segments are curved across the planet's latitude.
  for (let x = -216; x <= 216; x += 12) {
    const tile = mesh(groundBox, ZONES[data.zone].ground, g, [x, -.65 - x * x / (2 * RADIUS), -CHUNK / 2], [12.2, 1.1, CHUNK + .2]); tile.rotation.z = -x / RADIUS;
    tile.material = mat(ZONES[data.zone].ground, false, 'sand');
    if ((type === 'city' || type === 'palace') && Math.abs(x) < 60) {
      const paving = mesh(groundBox, '#eac493', g, [x, -.045 - x * x / (2 * RADIUS), -CHUNK / 2], [12.1, .05, CHUNK]); paving.rotation.z = -x / RADIUS;
    }
  }
  if (type === 'river') for (let z = 0; z < CHUNK; z += 8) {
    const center = Math.sin((data.start + z) / 220) * 23;
    const angle = Math.atan(Math.cos((data.start + z) / 220) * 23 / 220);
    block(g, '#52a6ad', center, .02 - center * center / (2 * RADIUS), -z - 4, 40 + Math.sin((data.start + z) / 130) * 8, .08, 9, angle);
  }
  if (coastal) {
    for (const side of [-1, 1]) {
      block(g, '#52b8be', side * 153, -3, -32, 184, .2, CHUNK + .2);
      for (let i = 0; i < 4; i++) block(g, '#d8f5dd', side * (68 + Math.sin((data.start+i*16)/110)*4), -1.2, -i*16, 3, .15, 11, .15);
      const x = side * (93 + rng() * 20);
      palm(g, side * 73, -14, 24 + rng()*10, rng);
      if (type === 'fishing') {
        for(const z of [-12,-43]) {
          const hut = building(g,x,z,12,10,13,rng); hut.position.y += 5;
          for (const dx of [-5, 5]) for (const dz of [-5, 5]) block(hut, '#786454', dx, -3, dz, .55, 7, .55);
          block(g,'#b88a65',x,3,z+9,16,.55,5);
          mesh(cone,'#f5d9a2',g,[x-side*18,7,z],[5,14,.12],[0,side*.4,.2]);
          mesh(orb,'#775c4a',g,[x-side*18,-1,z],[3.2,1.2,8]);
        }
      } else if(type === 'island') {
        mesh(cone,'#645e77',g,[side*158,40,-32],[55,120,55]);
        mesh(ring,'#f09557',g,[side*158,100,-32],[5,5,5],[Math.PI/2,0,0],true);
        for (let i = 0; i < 4; i++) {
          const px = x + (i - 2) * 8, base = -px * px / (2 * RADIUS);
          block(g, '#95745f', px, base - 1, -34, 8, 3, 10, .2);
          block(g, ['#ba655b', '#c79849', '#755171'][i % 3], px, base + 4, -34, 7, 9, 9, .2);
          mesh(cone, '#eed5a8', g, [px, base + 11, -34], [6, 6, 6]);
        }
      } else {
        for(let i=0;i<4;i++) { const px=side*(77+i*22); palm(g,px,-35+rng()*20,18+rng()*18,rng); mesh(gem,'#efd3b3',g,[px,-1,-50],[6,2.5,5]); }
      }
    }
  }
  if (highland) for(const side of [-1,1]) {
    for(let i=0;i<3;i++) {
      const x=side*(105+i*42), h=95+rng()*90, z=-10-rng()*45;
      mesh(cone,i%2?'#8e8198':'#a399b0',g,[x,h*.30,z],[35,h,37],[0,rng(),0]);
      mesh(cone,'#eee6d9',g,[x,h*.65,z],[10,h*.3,11],[0,0,0]);
    }
    if(type==='temple') {
      const x=side*89, base=-x*x/(2*RADIUS);
      block(g, '#8f7c80', x, base - 1.5, -30, 36, 5, 33);
      for(let tier=0;tier<4;tier++) {
        block(g,tier%2?'#b77369':'#eed8b4',x,base+3+tier*8,-30,30-tier*5,8,27-tier*4);
        block(g,'#744c65',x,base+8+tier*8,-30,35-tier*5,1,32-tier*4);
      }
      mesh(cone,'#e4bd72',g,[x,base+42,-30],[5,18,5]);
      for(let i=0;i<9;i++) mesh(box,['#d59864','#76b4ac','#b95b77','#e4c98e'][i%4],g,[side*(64+i*5),23+Math.sin(i/8*Math.PI)*-3,-6],[3,3.5,.10],[0,.2,(rng()-.5)*.3]);
    }
  }
  if(type==='jungle') for(const side of [-1,1]) {
    for(let i=0;i<7;i++) {
      const x=side*(83+rng()*95), z=-rng()*64;
      acacia(g,x,z,40+rng()*24,rng); palm(g,x+side*13,z-8,30+rng()*15,rng);
      mesh(cylinder,'#496746',g,[x,18,z],[.18,28,.18],[0,0,.12]);
      mesh(gem,'#e8aa77',g,[x,4,z+3],[2,3,2]);
    }
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
    } else if(type === 'ancient') {
      for (let i = 0; i < 4; i++) ruin(g, side * (75 + i * 29 + rng() * 13), -rng() * CHUNK, 13 + rng() * 29);
      for (let i = 0; i < 4; i++) rock(g, side * (90 + rng() * 95), -rng() * CHUNK, 7 + rng() * 10, 14 + rng() * 18, '#ad8b89', rng);
    }
  }
  const rail = data.disableRails ? null : cliffRailAt(data.start);
  if (rail) {
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
  for (const e of data.enemies || []) if (e.kind === 'guard') {
    const z = -(e.s - data.start), base = -e.x * e.x / (2 * RADIUS), h = e.y - 1.7;
    block(g, '#b99072', e.x, base + h / 2, z, 6, h, 6);
    block(g, '#b99072', e.x, base - .5, z, 6, 1.4, 6);
    block(g, '#efd3a0', e.x, base + h, z, 7, .7, 7);
    for (const side of [-1, 1]) block(g, '#c39e7c', e.x + side * 2.6, base + h + .7, z, 1, 1.4, 6);
    windowOn(g, e.x, base + h * .65, z + 3.04, 1.4, 3);
  }
  for (const o of data.obstacles) {
    const body = new THREE.Group(); body.position.set(o.x, -o.x * o.x / (2 * RADIUS), -(o.s - data.start)); body.rotation.y = o.angle || 0; hazards.add(body);
    const reach = Math.hypot(o.width, o.depth) / 2;
    const footing = .5 + (Math.abs(o.x) * reach + reach * reach / 2) / RADIUS;
    block(body, '#b28a6a', 0, -footing / 2, 0, o.width, footing + .15, o.depth);
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
  const passage = !data.disablePassages && passageAt(data.start);
  if (passage) {
    for (const o of passageSolids(data.start)) mesh(tunnelBox, o.color, o.hazard ? hazards : g, [o.x, o.bottom + o.height / 2, -(o.s - data.start)], [o.width, o.height, o.depth], [0, o.angle, 0]);
    for (const side of [-1, 1]) {
      // Uneven rock faces and roof teeth break up the engineered slab silhouette.
      for (let i = 0; i < 6; i++) {
        const z = -5 - i * 10;
        mesh(gem, i % 2 ? '#9d7970' : '#896772', hazards, [side * 30.8, 20 + rng() * 9, z], [2.2, 8 + rng() * 4, 6], [0, rng(), .15 * side]);
        mesh(cone, '#876971', hazards, [side * (18 + rng() * 8), 33, z], [2.4, 5, 3], [Math.PI, 0, 0]);
        mesh(orb, '#795c61', g, [side * (40 + rng() * 40), 77, z], [22, 8 + rng() * 8, 16]);
      }
      mesh(gem, '#74f2da', hazards, [side * 27.7, 9, -16], [.5, 1.7, .5], [0, 0, .2], true);
      mesh(gem, '#ffd29a', hazards, [side * 27.7, 17, -48], [.5, 1.7, .5], [0, 0, -.2], true);
    }
  }
  if (data.index % 6 === 3 && !coastal && !highland && type !== 'jungle') landmark(g, type, Math.floor(data.index / 6) % 2 ? -1 : 1, rng);
  // Gold roadside lanterns make the flight corridor legible at night.
  for (const side of [-1, 1]) {
    const x = side * (59 + rng() * 3), z = -rng() * CHUNK;
    block(g, '#8f7967', x, 2 - x * x / (2 * RADIUS), z, .18, 4, .18);
    mesh(gem, '#ffe0a1', g, [x, 4.3 - x * x / (2 * RADIUS), z], [.5, .9, .5], [0, .4, 0], true);
  }
  // Build both layers with the same random sequence. Arena mode never rerolls
  // landmarks, foliage, terrain, roadside towers or lanterns.
  const palette = paletteAt(data.disablePassages ? data.zone * ZONE_LENGTH : data.start, seed);
  const result = new THREE.Group(), scenery = mergeGroup(g, data.start, palette), hazardVisual = mergeGroup(hazards, data.start, palette);
  hazardVisual.traverse(m => { if (m.isMesh) {
    const source = m.material; m.material = source.clone();
    m.material.onBeforeCompile = source.onBeforeCompile; m.material.customProgramCacheKey = source.customProgramCacheKey;
    m.material.transparent = true; m.material.userData.chunkOwned = true;
  } });
  hazardVisual.visible = !arena; result.add(scenery, hazardVisual);
  result.userData.scenery = scenery; result.userData.hazards = hazardVisual;
  return result;
}
export function placeOnWorld(object, x, s, height, distance) {
  const a = (s - distance) / RADIUS, r = RADIUS + height - x * x / (2 * RADIUS);
  object.position.set(x, Math.cos(a) * r - RADIUS, -Math.sin(a) * r); object.rotation.x = -a;
}
export function placeOnTerrain(object, x, s, height, distance) { placeOnWorld(object, x, s, height + elevationAt(s), distance); }
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

  body.scale.setScalar(.83);
  const rider = new THREE.Group(); rider.position.y = .13; rider.rotation.y = -Math.PI / 2; body.add(rider);
  // A youthful, side-on stance: bent knees, short coat, wide planted feet.
  for (const side of [-1, 1]) {
    mesh(orb, '#343e66', rider, [side * .62, .58, .03], [.25, .57, .27], [0, 0, side * -.36]);
    mesh(orb, '#55416c', rider, [side * .45, 1.01, .10], [.30, .38, .30], [0, 0, side * .55]);
    mesh(orb, '#e4bd79', rider, [side * .79, .16, -.12], [.28, .16, .43]);
  }
  mesh(cone, '#386b82', rider, [0, 1.37, .06], [.58, .94, .49]);
  mesh(orb, '#459e9d', rider, [0, 1.73, .05], [.52, .53, .39]);
  block(rider, '#f1bc70', 0, 1.17, -.02, .93, .18, .78);
  mesh(orb, '#bd845c', rider, [0, 2.20, -.10], [.34, .40, .33]);
  mesh(orb, '#dc9f73', rider, [0, 2.21, -.42], [.13, .13, .17]);
  for (const side of [-1, 1]) {
    mesh(orb, '#202637', rider, [side * .15, 2.28, -.395], [.065, .035, .035]);
    mesh(orb, '#397b8f', rider, [side * .65, 1.68, -.06], [.39, .17, .22], [0, 0, side * -.27]);
    mesh(orb, '#d49a6d', rider, [side * .96, 1.56, -.12], [.15, .15, .15]);
  }
  mesh(orb, '#39334f', rider, [0, 2.48, .02], [.43, .27, .4]);
  mesh(cone, '#534178', rider, [-.06, 2.93, .08], [.48, .95, .45], [0, 0, -.27]);
  mesh(cone, '#73528a', rider, [.14, 3.27, .08], [.24, .5, .23], [0, 0, -.95]);
  mesh(ring, '#dbb568', rider, [0, 2.54, .02], [.44, .44, .44], [Math.PI / 2, 0, 0]);
  mesh(gem, '#b4ffee', rider, [0, 2.65, -.38], [.12, .20, .1], [0, 0, 0], true);
  const scarf = block(rider, '#dca665', .13, 1.9, .48, .28, .08, .8);
  // Jointed, tapered locks and beard are real 3D strands, with bounded meshes.
  const strands = [];
  for (let i = 0; i < 12; i++) {
    const beard = i < 4, t = i / 12 * Math.PI * 2;
    const anchor = beard ? new THREE.Vector3(.40, 2.02, (i - 1.5) * .11) : new THREE.Vector3(Math.cos(t) * .34, 2.39, Math.sin(t) * .35);
    const segments = [];
    for (let j = 0; j < 6; j++) segments.push(mesh(cylinder, beard ? '#8f6a58' : i % 3 ? '#353049' : '#56405c', body));
    const bead = mesh(gem, i % 2 ? '#d9a75f' : '#77d5cb', body, [0, 0, 0], [.075, .12, .075]);
    strands.push({ beard, anchor, segments, bead, phase: i * 1.9 });
  }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(2.5, 24), new THREE.MeshBasicMaterial({ color: '#4e545a', transparent: true, opacity: .16, depthWrite: false })); shadow.rotation.x = -Math.PI / 2;
  const rig = { root, body, fabric, trim, scarf, pattern, shadow, rider, strands, hairFlow: 0 };
  animateRider(rig, { speed: 30, power: 25, vx: 0 }, 0, 1); return rig;
}
const strandUp = new THREE.Vector3(0, 1, 0), strandA = new THREE.Vector3(), strandB = new THREE.Vector3(), strandDirection = new THREE.Vector3();
export function animateRider(carpet, run, time, dt) {
  const target = Math.min(1, Math.max(0, (run.speed - 35) / 100) * .65 + run.power / 100 * .35 + (run.boost ? .25 : 0));
  carpet.hairFlow += (target - carpet.hairFlow) * (1 - Math.exp(-dt * 5));
  const flow = carpet.hairFlow;
  carpet.rider.rotation.z = Math.sin(time * 2) * .035 - (run.vx || 0) * .002;
  carpet.scarf.rotation.x = -.15 - flow * .5 + Math.sin(time * 7) * .1;
  for (const strand of carpet.strands) {
    const length = (strand.beard ? .9 : 1.3) + flow * (strand.beard ? 2.3 : 4.1);
    strandA.copy(strand.anchor);
    for (let j = 0; j < strand.segments.length; j++) {
      const t = (j + 1) / strand.segments.length;
      strandB.set(strand.anchor.x + Math.sin(time * 7 - t * 5 + strand.phase) * t * (.06 + flow * .16),
        strand.anchor.y - t * length * (1 - flow * .77), strand.anchor.z + t * length * (.18 + flow * .95));
      const segment = strand.segments[j]; strandDirection.subVectors(strandB, strandA);
      segment.position.copy(strandA).add(strandB).multiplyScalar(.5);
      segment.quaternion.setFromUnitVectors(strandUp, strandDirection.clone().normalize());
      const width = (strand.beard ? .075 : .095) * (1 - t * .65);
      segment.scale.set(width, strandDirection.length() + .035, width); strandA.copy(strandB);
    }
    strand.bead.position.copy(strandB);
  }
}
const pickupShapes = new Map();
export function createPickup(kind) {
  const g = new THREE.Group();
  if (kind === 'gold') { mesh(gem, '#ffd88e', g, [0, 0, 0], [.34, .6, .34], [0, 0, .3], true); mesh(ring, '#eeb564', g, [0, 0, 0], [.55, .55, .55]); }
  else if (kind === 'magnet') {
    mesh(magnetArc, '#8ae0b4', g, [0, -.05, 0], [1, 1, 1], [0, 0, Math.PI], true);
    for (const side of [-1, 1]) {
      mesh(box, '#8ae0b4', g, [side * .72, .23, 0], [.44, .6, .44], [0, 0, 0], true);
      mesh(box, '#fff2d0', g, [side * .72, .63, 0], [.47, .22, .47], [0, 0, 0], true);
    }
    mesh(ring, '#fff2d0', g, [0, 0, 0], [1.55, 1.55, 1.55], [.25, .3, 0], true);
  }
  else if (kind === 'heart' || kind === 'ward') {
    const color = kind === 'heart' ? '#ff527b' : '#8ddfff';
    const heart = new THREE.Shape(); heart.moveTo(0,-1.2); heart.bezierCurveTo(-2,.2,-1.3,1.7,0,.65); heart.bezierCurveTo(1.3,1.7,2,.2,0,-1.2);
    const shape = new THREE.ExtrudeGeometry(heart,{depth:.35,bevelEnabled:true,bevelSize:.12,bevelThickness:.12,bevelSegments:1,steps:1,curveSegments:8});
    // Cache silhouettes below, once per pickup kind.
    if (!pickupShapes.has(kind)) pickupShapes.set(kind, shape); else shape.dispose();
    mesh(pickupShapes.get(kind), color, g, [0,.15,0], [1,1,1], [0,0,0], true);
    if(kind==='ward') mesh(ring,'#ffffff',g,[0,0,0],[1.65,1.65,1.65],[0,0,0],true);
  } else {
    const color = SPELLS[kind]?.color || '#fff3c7';
    if (kind === 'fury') {
      mesh(orb,color,g,[0,0,0],[.7,.7,.7],[0,0,0],true);
      for(let i=0;i<8;i++) { const a=i*Math.PI/4; mesh(gem,color,g,[Math.cos(a)*1.1,Math.sin(a)*1.1,0],[.2,.55,.2],[0,0,a-Math.PI/2],true); }
    } else if (kind === 'fire') {
      for(let i=0;i<3;i++) mesh(cone,i===1?'#fff2ae':color,g,[(i-1)*.45,i===1?.3:0,0],[.5,i===1?2.5:1.5,.45],[0,0,(i-1)*-.2],true);
    } else if(kind==='storm') {
      for(const [x,y,angle] of [[.25,.75,-.5],[0,0,1.0],[-.25,-.75,-.5]]) mesh(box,color,g,[x,y,0],[.36,1.3,.3],[0,0,angle],true);
    } else if(kind==='wind') {
      for(let i=0;i<3;i++) mesh(ring,color,g,[0,(i-1)*.65,0],[1.2-i*.25,.4,.65],[.7,0,0],true);
    } else if(kind==='frost') {
      for(let i=0;i<3;i++) mesh(box,color,g,[0,0,0],[.24,2.6,.24],[0,0,i*Math.PI/3],true);
    } else if(kind==='echo') {
      for(const side of [-1,1]) mesh(ring,color,g,[side*.6,0,0],[.7,1.1,.7],[0,0,side*.4],true);
    } else if(kind==='rapid' || kind==='overdrive') {
      for(let i=0;i<3;i++) { mesh(cone,color,g,[(i-1)*.8,.1,0],[.25,1.8,.25],[0,0,0],true); mesh(box,'#fff5db',g,[(i-1)*.8,-.8,0],[.4,.25,.4],[0,0,0],true); }
      if(kind==='overdrive') mesh(ring,color,g,[0,0,0],[1.7,1.7,1.7],[0,0,0],true);
    } else {
      mesh(ring,color,g,[0,0,0],[1.2,1.2,1.2],[0,0,0],true);
      for(const angle of [0,Math.PI/2]) mesh(box,'#ffffff',g,[0,0,0],[.15,2.8,.15],[0,0,angle],true);
    }
  }
  if(kind !== 'gold') {
    mesh(ring, '#fff0cf', g, [0,0,-.3], [2.0,2.0,2.0], [0,0,0], true);
    g.scale.setScalar(1.3);
  }
  return g;
}
export function createBreakable(kind, large = false) {
  const g = new THREE.Group();
  if (kind === 'urn') { mesh(orb, '#b45772', g, [0, -.4, 0], [1.7, 1.7, 1.7]); mesh(cylinder, '#e6bd82', g, [0, 1.15, 0], [.85, .8, .85]); }
  else if (kind === 'timber') for (let i = 0; i < 3; i++) { mesh(cylinder, '#745440', g, [i - 1, -.7 + (i % 2), 0], [.7, 4.5, .7], [Math.PI / 2, 0, i * .15]); mesh(orb, '#dfb576', g, [i - 1, -.7 + (i % 2), 2.2], [.65, .65, .06]); }
  else if (kind === 'rock' || kind === 'seal') {
    mesh(gem, kind === 'seal' ? '#77749a' : '#bf805e', g, [0, 0, 0], [2.3, 2.5, 2]);
    mesh(ring, '#ffdca0', g, [0, 0, 1.8], [1, 1, 1], [0, 0, .4], true);
  } else {
    block(g, kind === 'hay' ? '#cda850' : '#8b5b40', 0, -.1, 0, 3.9, 3.8, 3.8);
    for (const side of [-1, 1]) { block(g, '#e2b279', side * 1.4, -.1, 1.98, .2, 3.8, .08); block(g, '#e2b279', 0, side * 1.4, 1.98, 3.9, .2, .08); }
    block(g, '#f6d096', 0, 0, 2, 4.7, .18, .1, Math.PI / 4);
  }
  if (large) {
    for (const side of [-1, 1]) {
      mesh(ring, '#ffdaa0', g, [0, 0, side * 2.15], [1.25, 1.25, 1.25], [0, 0, 0], true);
      for (const a of [0, Math.PI / 2]) mesh(box, '#fff6d0', g, [0, 0, side * 2.18], [.1, 1.3, .1], [0, 0, a], true);
    }
    mesh(ring, '#f2b978', g, [0, -1.5, 0], [2.3, 2.3, 2.3], [Math.PI / 2, 0, 0], true);
  }
  return g;
}
function creatureModel(g, kind) {
  const limbs = [];
  if (['bandit', 'guard', 'wizard'].includes(kind)) {
    const robe = kind === 'wizard' ? '#713a9c' : kind === 'guard' ? '#318287' : '#a53f38';
    mesh(cone, robe, g, [0, -.2, 0], [.8, 1.7, .7]);
    mesh(orb, '#c69470', g, [0, .95, .1], [.48, .5, .43]);
    mesh(orb, kind === 'guard' ? '#c5ac79' : '#233247', g, [0, 1.3, .05], [.62, .35, .5]);
    mesh(box, '#232535', g, [0, .82, .48], [.88, .22, .07]);
    for (const side of [-1, 1]) {
      mesh(orb, '#ffe9a6', g, [side * .2, 1.06, .48], [.07, .055, .06], [0, 0, 0], true);
      mesh(cylinder, robe, g, [side * .75, .3, .1], [.18, 1.1, .18], [0, 0, side * .7]);
      mesh(box, '#233044', g, [side * .27, -1.1, .1], [.27, .7, .35]);
    }
    if (kind === 'wizard') {
      mesh(box, '#2d2447', g, [0, -1.45, 0], [3.9, .18, 3.1]);
      mesh(box, '#daa96e', g, [0, -1.33, 0], [3.5, .07, 2.7]);
      mesh(box, '#8a3e91', g, [0, -1.27, 0], [2.9, .06, 2.1]);
      mesh(gem, '#afeeff', g, [-1, 1.1, .3], [.3, .5, .3], [0, 0, 0], true);
      mesh(cylinder, '#4b334f', g, [1.1, .35, 0], [.09, 3.2, .09]);
      mesh(gem, '#e99cff', g, [1.1, 2.05, 0], [.36, .6, .36], [0, 0, 0], true);
      for (const side of [-1, 1]) for (let i = 0; i < 4; i++) mesh(cone, '#f4c17d', g, [side * 2.1, -1.45, i * .65 - 1], [.13, .7, .1], [0, 0, side * Math.PI / 2]);
    } else {
      mesh(ring, '#e0bd7a', g, [1.02, .1, .55], [.55, 1.15, .7], [0, .6, 0]);
      mesh(cylinder, '#673f32', g, [.8, .05, .6], [.055, 2.3, .055], [Math.PI / 2, 0, 0]);
      mesh(gem, '#ffb365', g, [.8, .05, 1.75], [.15, .15, .3], [0, 0, 0], true);
    }
  } else if (kind === 'dragon') {
    mesh(orb, '#884131', g, [0, 0, -.4], [1.2, .8, 2.7]);
    mesh(orb, '#bd7650', g, [0, .6, 1.85], [.75, .65, 1.05]);
    mesh(cone, '#673748', g, [0, -.1, -3.8], [.7, 3.5, .7], [-Math.PI / 2, 0, 0]);
    for (let i = 0; i < 6; i++) mesh(cone, '#efd1a0', g, [0, 1, 1 - i * .65], [.22, .75, .25]);
    for (const side of [-1, 1]) {
      const wing = new THREE.Group(); wing.position.set(side * .8, .35, -.4); g.add(wing); limbs.push({ object: wing, side });
      mesh(cone, '#cb7957', wing, [side * 2.2, 0, -.4], [2.1, 4.8, .12], [Math.PI / 2, 0, side * -.6]);
      mesh(cylinder, '#553144', wing, [side * 2, .1, 0], [.12, 4.5, .12], [0, 0, side * Math.PI / 2]);
      mesh(orb, '#ffe6a1', g, [side * .53, .82, 2.43], [.19, .14, .15], [0, 0, 0], true);
      mesh(cone, '#eee1b7', g, [side * .48, 1.45, 1.45], [.19, 1.15, .19], [0, 0, side * -.4]);
      for (let i = 0; i < 3; i++) mesh(cone, '#f8ddb0', g, [side * .43, .14, 2.1 + i * .3], [.11, .38, .11], [Math.PI, 0, 0]);
    }
  } else if (kind === 'scarab') {
    mesh(orb, '#287d76', g, [0, 0, 0], [1.9, .85, 2.4]); mesh(box, '#d7b16b', g, [0, .8, 0], [.13, .12, 4.1]);
    mesh(orb, '#273549', g, [0, -.05, 2.1], [1.1, .65, .7]);
    for (const side of [-1, 1]) {
      mesh(orb, '#ff9c43', g, [side * .55, .3, 2.6], [.23, .12, .12], [0, 0, 0], true);
      mesh(cone, '#dfc582', g, [side * .75, -.1, 3], [.23, 1.4, .19], [Math.PI / 2, 0, side * .4]);
      for (let i = 0; i < 3; i++) mesh(cone, '#2e3445', g, [side * 2, -.5, 1 - i * 1.1], [.3, 2.6, .3], [0, 0, side * 1.15]);
    }
  } else {
    const fish = kind === 'fish', skin = fish ? '#38a9b6' : '#b5925d';
    for (let i = 0; i < (fish ? 1 : 7); i++) mesh(orb, skin, g, [Math.sin(i * .7) * .5, Math.sin(i * .9) * .35, -i * .75], [Math.max(.25, 1 - i * .1), .65, 1.35]);
    mesh(cone, fish ? '#ffba78' : '#78647c', g, [0, .7, -.3], [.85, 1.2, .12], [0, 0, -.3]);
    for (const side of [-1, 1]) {
      mesh(cone, skin, g, [side * 1.2, -.1, -.1], [.5, 2, .13], [0, 0, side * 1.1]);
      mesh(orb, '#ffef91', g, [side * .57, .3, .8], [.2, .16, .15], [0, 0, 0], true);
      mesh(cone, '#fff2cc', g, [side * .35, -.1, 1.25], [.14, .6, .14], [Math.PI, 0, 0]);
    }
  }
  g.userData.limbs = limbs;
}
export function createEnemy(kind = 'stalker') {
  const g = new THREE.Group();
  const creature = ['bandit', 'guard', 'wizard', 'dragon', 'fish', 'scarab', 'serpent'].includes(kind);
  if (kind === 'giant') {
    mesh(orb,'#8a877b',g,[0,0,0],[1.2,1.5,.8]);
    mesh(orb,'#aaa191',g,[0,1.55,.1],[.65,.7,.6]);
    mesh(gem,'#655d60',g,[0,1.15,.65],[.5,.65,.25]);
    for(const side of [-1,1]) {
      mesh(orb,'#ffddb1',g,[side*.25,1.7,.65],[.12,.07,.08],[0,0,0],true);
      mesh(orb,'#777b71',g,[side*.65,-1.7,0],[.4,1.2,.5]);
      mesh(orb,'#aaa08a',g,[side*.7,-2.6,.35],[.6,.3,.8]);
      mesh(orb,'#8a877b',g,[side*1.45,.1,0],[.55,1.3,.55],[0,0,side*.22]);
    }
    mesh(gem,'#b4a593',g,[1.8,-.6,.65],[.85,.7,.85]);
    block(g,'#684e52',0,-.7,0,2.3,.6,1.7);
  } else if (creature) creatureModel(g, kind);
  else {
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
  }
  const healthBack = block(g, '#413b59', 0, 2.05, 0, 1.9, .13, .1);
  const health = block(g, '#f2bf83', 0, 2.05, .065, 1.8, .09, .03);
  const charge = mesh(ring, '#ffb2cd', g, [0, .2, .7], [1.5, 1.5, 1.5], [0, 0, 0], true); charge.visible = false;
  const frost = mesh(ring, '#b8f2f2', g, [0, .1, 0], [1.55, 1.55, 1.55], [.5, 0, 0], true); frost.visible = false;
  const burn = new THREE.Group(); g.add(burn); burn.visible = false;
  for (let i = 0; i < 3; i++) mesh(cone, i === 1 ? '#ffe29a' : '#ff6324', burn, [Math.sin(i * 2.1) * .8, -.3, Math.cos(i * 2.1) * .8], [.3, 1.7, .3], [0, 0, .2], true);
  g.userData = { ...g.userData, health, healthBack, charge, frost, burn, baseScale: kind === 'giant' ? 3 : kind === 'boss' ? 4.4 : kind === 'brute' ? 1.65 : creature ? 1 : 1.25 };
  g.scale.setScalar(g.userData.baseScale);
  return g;
}
export function createRing(radius) {
  const g = new THREE.Group(); mesh(ring, '#f4cc80', g, [0, 0, 0], [radius, radius, radius], [0, 0, 0], true);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; mesh(gem, '#fff0c0', g, [Math.cos(a) * radius, Math.sin(a) * radius, 0], [.2, .35, .2], [0, 0, a - Math.PI / 2], true); }
  return g;
}
export { createSky } from './sky.js';
export function disposeChunk(group) { group.traverse(m => { if (m.isMesh) { m.geometry.dispose(); if (m.material.userData.chunkOwned) m.material.dispose(); } }); }
export { gem, orb, ring };
