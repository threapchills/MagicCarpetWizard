import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { random } from './game.js';

const INK = '#080b18';
function starShape() {
  const shape = new THREE.Shape();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, r = i % 2 ? .24 : 1;
    const x = Math.sin(a) * r, y = Math.cos(a) * r;
    if (i) shape.lineTo(x, y); else shape.moveTo(x, y);
  }
  shape.closePath(); return new THREE.ShapeGeometry(shape);
}
function moonDisc(parent, x, y, z, radius, color) {
  const group = new THREE.Group(); group.position.set(x, y, z); group.lookAt(0, 0, 0); parent.add(group);
  const outline = new THREE.Mesh(new THREE.CircleGeometry(radius + 2.4, 64), new THREE.MeshBasicMaterial({ color: INK, fog: false }));
  const face = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), new THREE.MeshBasicMaterial({ color, fog: false }));
  face.position.z = .4; group.add(outline, face);
  for (const [px, py, r] of [[-.32, .3, .17], [.38, -.18, .23], [-.12, -.5, .1]]) {
    const crater = new THREE.Mesh(new THREE.CircleGeometry(radius * r, 20), new THREE.MeshBasicMaterial({ color: '#c2bbcf', fog: false }));
    crater.position.set(px * radius, py * radius, .6); group.add(crater);
    const rim = new THREE.Mesh(new THREE.RingGeometry(radius * r, radius * r + .7, 20), new THREE.MeshBasicMaterial({ color: INK, fog: false }));
    rim.position.copy(crater.position); rim.position.z = .65; group.add(rim);
  }
  return group;
}

export function createSky(scene) {
  const root = new THREE.Group(); root.name = 'Distant sky'; scene.add(root);
  const uniforms = { top: { value: new THREE.Color('#72aaa9') }, bottom: { value: new THREE.Color('#efe1b6') }, night: { value: 0 }, aura: { value: 0 }, time: { value: 0 } };
  const material = new THREE.ShaderMaterial({ uniforms, side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `varying vec3 vPos; uniform vec3 top; uniform vec3 bottom; uniform float night; uniform float aura; uniform float time;
      void main(){vec3 p=normalize(vPos); float h=p.y;
        vec3 color=mix(bottom,top,smoothstep(-.12,.68,h));
        float ribbon=pow(max(0.,1.-abs(p.y-.24-p.x*.19)*5.),3.);
        color+=vec3(.09,.10,.20)*ribbon*night;
        if(aura>.001){
          float wave=.30+sin(p.x*5.+time*.06+p.z*2.)*.10;
          float curtain=pow(max(0.,1.-abs(p.y-wave)*7.),3.);
          float folds=.6+.4*sin(p.x*29.+p.z*11.+time*.10);
          vec3 silk=mix(vec3(.06,.25,.20),vec3(.24,.09,.29),.5+.5*sin(p.x*4.+time*.025));
          color+=silk*curtain*folds*aura;
        }
        gl_FragColor=vec4(color,1.);}` });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 20), material); dome.renderOrder = -100; root.add(dome);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(32, 32, 20), new THREE.MeshBasicMaterial({ color: '#ffe5ac', fog: false }));
  sun.position.set(280, 270, -760); root.add(sun);
  const moons = new THREE.Group(); root.add(moons);
  moonDisc(moons, -210, 185, -780, 58, '#fff2c7');
  moonDisc(moons, 290, 285, -750, 32, '#e0eaff');

  const rng = random(61), geometry = starShape(), count = 260;
  const stars = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ color: '#fff4d7', fog: false }), count);
  const starOutlines = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ color: INK, fog: false }), count);
  const point = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2, y = .07 + rng() * .8, r = Math.sqrt(1 - y * y);
    point.position.set(Math.cos(a) * r * 890, y * 890, Math.sin(a) * r * 890); point.lookAt(0, 0, 0);
    const size = 2.2 + Math.pow(rng(), 3) * 6.5;
    point.scale.setScalar(size * 1.4); point.updateMatrix(); starOutlines.setMatrixAt(i, point.matrix);
    point.position.multiplyScalar(.999); point.scale.setScalar(size); point.updateMatrix(); stars.setMatrixAt(i, point.matrix);
  }
  root.add(starOutlines, stars);

  const clouds = new THREE.Group(), cloudMaterials = [];
  for (let i = 0; i < 15; i++) {
    const bank = new THREE.Group(), a = i / 15 * Math.PI * 2 + .2, d = 690 + rng() * 60;
    bank.position.set(Math.cos(a) * d, 105 + rng() * 145, Math.sin(a) * d);
    bank.lookAt(0, bank.position.y, 0);
    const pieces = [];
    for (let j = 0; j < 7; j++) {
      const geo = new THREE.SphereGeometry(1, 16, 10);
      geo.scale(25 + rng() * 15, 12 + Math.sin(j / 6 * Math.PI) * 20, 16 + rng() * 9);
      geo.translate((j - 3) * 24, Math.sin(j / 6 * Math.PI) * 8, rng() * 8); pieces.push(geo);
    }
    const cloudGeo = mergeGeometries(pieces); pieces.forEach(g => g.dispose());
    const cloudMaterial = new THREE.MeshLambertMaterial({ color: '#fff1d6', fog: false }); cloudMaterials.push(cloudMaterial);
    const body = new THREE.Mesh(cloudGeo, cloudMaterial);
    const outline = new THREE.Mesh(cloudGeo, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide, fog: false }));
    outline.scale.set(1.018, 1.075, 1.045); bank.add(outline, body); clouds.add(bank);
  }
  root.add(clouds);
  return { root, uniforms, sun, moons, stars, starOutlines, clouds, cloudMaterials };
}

export function updateSky(sky, dt, { camera, night, daylight, wind, enclosed, aura = 0, time = 0 }) {
  // Every sky object stays well beyond streamed scenery. No small foreground
  // lanterns or camera-relative cloud puffs can intrude into a cave.
  sky.root.position.copy(camera.position);
  sky.root.visible = !enclosed;
  sky.uniforms.night.value = night;
  sky.uniforms.aura.value = THREE.MathUtils.lerp(sky.uniforms.aura.value, aura, 1 - Math.exp(-Math.max(0, dt) * .65));
  sky.uniforms.time.value = time;
  sky.sun.visible = night < .7; sky.sun.position.y = 90 + daylight * 235;
  sky.moons.visible = night > .2;
  sky.stars.visible = sky.starOutlines.visible = night > .35;
  sky.clouds.rotation.y += dt * wind * .006;
  const color = new THREE.Color('#fff1d6').lerp(new THREE.Color('#747997'), night);
  for (const material of sky.cloudMaterials) material.color.copy(color);
}
