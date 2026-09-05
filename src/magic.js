import * as THREE from 'three';
import { random } from './game.js';
import { placeOnWorld, mat } from './world.js';

const spellColors = { fire: '#ff762d', storm: '#94dfff', wind: '#92ffcd' };

function sparkCloud(capacity, ratio) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(capacity * 3), tints = new Float32Array(capacity * 3), sizes = new Float32Array(capacity), alphas = new Float32Array(capacity);
  for (const [name, data, count] of [['position', positions, 3], ['tint', tints, 3], ['size', sizes, 1], ['alpha', alphas, 1]]) geometry.setAttribute(name, new THREE.BufferAttribute(data, count).setUsage(THREE.DynamicDrawUsage));
  const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), pixelRatio: { value: ratio } },
    vertexShader: `
      attribute vec3 tint; attribute float size; attribute float alpha;
      varying vec3 vTint; varying float vAlpha;
      uniform float pixelRatio;
      #include <fog_pars_vertex>
      void main(){
        vTint=tint; vAlpha=alpha;
        vec4 mvPosition=modelViewMatrix*vec4(position,1.);
        gl_Position=projectionMatrix*mvPosition;
        gl_PointSize=clamp(size*pixelRatio*320./max(1.,-mvPosition.z),1.,72.);
        #include <fog_vertex>
      }`,
    fragmentShader: `
      varying vec3 vTint; varying float vAlpha;
      #include <fog_pars_fragment>
      void main(){
        vec2 p=gl_PointCoord*2.-1.; float r=length(p);
        float halo=pow(max(0.,1.-r),2.5);
        float core=1.-smoothstep(.08,.30,r);
        float rays=pow(max(0.,1.-min(abs(p.x),abs(p.y))*18.),3.)*max(0.,1.-r)*.24;
        float mask=max(halo,max(core,rays))*vAlpha;
        if(mask<.008) discard;
        gl_FragColor=vec4(vTint*3.+core*.35,mask);
        #include <fog_fragment>
        #include <colorspace_fragment>
      }` });
  const visual = new THREE.Points(geometry, material); visual.frustumCulled = false; geometry.setDrawRange(0, 0);
  return { visual, geometry, positions, tints, sizes, alphas, capacity };
}

export class MagicField {
  constructor(scene, ratio = 1) {
    this.scene = scene; this.sparks = []; this.flashes = []; this.castLife = 0; this.trailClock = 0;
    this.point = new THREE.Object3D(); this.color = new THREE.Color();
    this.burstCloud = sparkCloud(384, ratio); this.motes = sparkCloud(100, ratio);
    scene.add(this.burstCloud.visual, this.motes.visual);
    const rng = random(3419); this.seeds = Array.from({ length: 100 }, () => [rng(), rng(), rng(), rng()]);
    // Keep the light count fixed: no shader recompilation for each cast.
    this.lights = Array.from({ length: 4 }, () => { const light = new THREE.PointLight('#ffffff', 0, 28, 2); light.castShadow = false; scene.add(light); return light; });
    this.aura = new THREE.Group(); scene.add(this.aura);
    const ring = new THREE.TorusGeometry(1, .035, 4, 48), shard = new THREE.OctahedronGeometry(.12);
    for (const radius of [2.3, 2.8]) { const mesh = new THREE.Mesh(ring, mat('#9beed9', true)); mesh.scale.setScalar(radius); this.aura.add(mesh); }
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, rune = new THREE.Mesh(shard, mat('#ffe3a8', true)); rune.position.set(Math.cos(a) * 2.55, Math.sin(a) * 2.55, 0); rune.scale.set(1, 2.7, 1); rune.rotation.z = a; this.aura.add(rune); }
    this.aura.visible = false;
  }
  clear() {
    this.sparks.length = this.flashes.length = 0; this.castLife = this.trailClock = 0;
    this.burstCloud.geometry.setDrawRange(0, 0); this.aura.visible = false;
    this.lights.forEach(l => l.intensity = 0);
  }
  emit(x, y, s, color, count, power = 1) {
    this.color.set(color); const tint = [this.color.r, this.color.g, this.color.b];
    for (let i = 0; i < count && this.sparks.length < 384; i++) {
      const a = Math.random() * Math.PI * 2, velocity = (4 + Math.random() * 13) * power, life = .35 + Math.random() * .7;
      this.sparks.push({ x, y, s, vx: Math.cos(a) * velocity, vy: (Math.random() * 11 - 2) * power, vs: Math.sin(a) * velocity,
        size: (.18 + Math.random() * .42) * power, life, maxLife: life, curl: (Math.random() - .5) * 4, tint });
    }
  }
  flash(x, y, s, color, power = 1) {
    if (this.flashes.length >= 8) this.flashes.shift();
    this.flashes.push({ x, y, s, color, power, life: .4, maxLife: .4 });
  }
  burst(x, y, s, color, radius) {
    if (radius < 4) return;
    const power = Math.min(2, radius / 6);
    this.emit(x, y, s, color, radius > 12 ? 48 : 20, power);
    this.flash(x, y, s, color, power);
  }
  cast(source, kind) {
    this.castLife = .22; this.castColor = spellColors[kind];
    this.emit(source.x, source.y, source.s, this.castColor, 7, .55);
    if (kind === 'storm') this.flash(source.x, source.y, source.s + 12, this.castColor, .65);
  }
  write(cloud, i, x, y, s, distance, tint, size, alpha) {
    placeOnWorld(this.point, x, s, y, distance);
    const p = this.point.position;
    cloud.positions.set([p.x, p.y, p.z], i * 3); cloud.tints.set(tint, i * 3); cloud.sizes[i] = size; cloud.alphas[i] = alpha;
  }
  upload(cloud, count) {
    cloud.geometry.setDrawRange(0, count);
    for (const attribute of Object.values(cloud.geometry.attributes)) attribute.needsUpdate = true;
  }
  setLight(light, x, y, s, distance, color, intensity, reach) {
    placeOnWorld(light, x, s, y, distance); light.color.set(color); light.intensity = intensity; light.distance = reach;
  }
  update(dt, time, distance, run, bullets, environment, playing) {
    this.castLife = Math.max(0, this.castLife - dt);
    for (let i = this.flashes.length - 1; i >= 0; i--) { this.flashes[i].life -= dt; if (this.flashes[i].life <= 0) this.flashes.splice(i, 1); }
    this.trailClock += playing ? dt : 0;
    if (this.trailClock >= .035) {
      this.trailClock %= .035;
      for (const b of bullets.slice(0, 8)) this.emit(b.x, b.y, b.s, spellColors[b.profile.kind], 1, .45);
      if (run.boost || run.railing) {
        for (const side of [-1, 1]) this.emit(run.x + side * 1.5, run.altitude - .25, distance - 2.5, run.railing ? '#ffda8b' : '#9bfce9', 1, .45);
      }
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const p = this.sparks[i]; p.life -= dt;
      if (p.life <= 0) { this.sparks.splice(i, 1); continue; }
      const angle = p.curl * dt, vx = p.vx * Math.cos(angle) - p.vs * Math.sin(angle);
      p.vs = p.vx * Math.sin(angle) + p.vs * Math.cos(angle); p.vx = vx;
      p.x += p.vx * dt; p.y += p.vy * dt; p.s += p.vs * dt; p.vy -= dt * 11;
    }
    // Removal above shifts later entries; upload a compact array after integration.
    this.sparks.forEach((p, i) => this.write(this.burstCloud, i, p.x, p.y, p.s, distance, p.tint, p.size * (.5 + p.life / p.maxLife), Math.min(1, p.life / p.maxLife * 2)));
    this.upload(this.burstCloud, this.sparks.length);
    const night = environment.night || 0, windy = environment.sand || environment.rain;
    const moteTint = night > .4 ? [.25, .85, .65] : [.85, .62, .25];
    for (let i = 0; i < 100; i++) {
      const [a, b, c, d] = this.seeds[i], phase = time * (.4 + d) + a * 20;
      this.write(this.motes, i, run.x + (a - .5) * 125 + Math.sin(phase) * 2,
        2 + b * (night > .4 ? 13 : 32) + Math.cos(phase) * 1.5, distance + 160 - ((c * 190 + distance) % 190), distance,
        moteTint, .12 + d * .18, (windy ? .10 : .30 + night * .5) * (.55 + Math.sin(phase * 2) * .35));
    }
    this.upload(this.motes, 100);
    this.lights.forEach(l => l.intensity = 0);
    const cast = this.castLife / .22;
    if (playing && (cast > 0 || run.boost)) this.setLight(this.lights[0], run.x, run.altitude + 1.5, distance, distance, this.castColor || '#9fffe1', 65 * cast + (run.boost ? 45 : 0), 20);
    const nearBolts = bullets.filter(b => b.s > distance - 5 && b.s < distance + 170).sort((a, b) => a.s - b.s).slice(0, 2);
    nearBolts.forEach((b, i) => this.setLight(this.lights[i + 1], b.x, b.y, b.s, distance, spellColors[b.profile.kind], b.profile.kind === 'fire' ? 240 : 110, 30));
    const brightest = this.flashes.reduce((best, f) => !best || f.power * f.life > best.power * best.life ? f : best, null);
    if (brightest) this.setLight(this.lights[3], brightest.x, brightest.y, brightest.s, distance, brightest.color, 550 * brightest.power * brightest.life / brightest.maxLife, 38);
    this.aura.visible = playing && (run.boost || cast > 0);
    if (this.aura.visible) {
      placeOnWorld(this.aura, run.x, distance - 1, run.altitude - .2, distance); this.aura.rotation.x -= Math.PI / 2; this.aura.rotation.z = time * (run.boost ? 2 : -3);
      this.aura.scale.setScalar(run.boost ? 1 : .7 + cast * .3);
    }
  }
}
