import './style.css';
import * as THREE from 'three';
import { CHUNK, RADIUS, ZONES, ZONE_LENGTH, SPELLS, clamp, lerp, random, createRun, updateRun, generateChunk, zoneAt, multiplier, award, collectSpell, damage, intersectsObstacle, nearObstacle, spellDamage } from './game.js';
import { mat, mesh, gem, orb, createChunkVisual, placeOnWorld, createCarpet, createPickup, createEnemy, createRing, createSky, disposeChunk } from './world.js';
import { Soundscape } from './audio.js';

const $ = id => document.getElementById(id);
const canvas = $('world');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
catch { $('loading').innerHTML = '<p>This carpet needs WebGL 2 to fly.</p><p>Please enable hardware acceleration or try a current Chrome, Edge, Firefox or Safari browser.</p>'; throw new Error('WebGL renderer unavailable'); }
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.28;
const scene = new THREE.Scene(); scene.fog = new THREE.Fog('#c7d8c5', 110, 295);
const camera = new THREE.PerspectiveCamera(49, innerWidth / innerHeight, .2, 1100);
const ambient = new THREE.HemisphereLight('#e8f0d6', '#8d6978', 2.5); scene.add(ambient);
const sunlight = new THREE.DirectionalLight('#ffe4bd', 3); sunlight.position.set(-45, 80, 25); sunlight.castShadow = true;
sunlight.shadow.mapSize.set(2048, 2048); Object.assign(sunlight.shadow.camera, { left: -58, right: 58, top: 48, bottom: -55, near: 1, far: 190 });
sunlight.shadow.bias = -.0007; sunlight.shadow.normalBias = .3; sunlight.target.position.set(0, 0, -28); scene.add(sunlight, sunlight.target);
const planetMaterial = mat('#dca773');
const planet = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 96, 64), planetMaterial); planet.position.y = -RADIUS - 1; planet.receiveShadow = true; scene.add(planet);
const sky = createSky(scene);
const carpet = createCarpet(); scene.add(carpet.root, carpet.shadow);
const chunks = new Map(), bullets = [], particles = [], enemyShots = [];
const sound = new Soundscape();
let state = 'menu', run = createRun(), globalTime = 0, lastTime = performance.now(), uiClock = 0;
let menuDistance = 90, lastZone = 0, bannerTime = 0, toastTime = 0, flashTime = 0, shootHeld = false, helpWasRunning = false;
let aim = new THREE.Vector2(0, .03), best = 0, highScore = 0;
const keys = new Set();
try { best = Number(localStorage.getItem('mcw-best')) || 0; highScore = Number(localStorage.getItem('mcw-score')) || 0; } catch { /* Private browsing still supports complete runs. */ }
$('menu-best').textContent = best ? `${Math.floor(best).toLocaleString()} m` : 'Your story starts here';
const temp = new THREE.Vector3(), goalPosition = new THREE.Vector3(), goalLook = new THREE.Vector3();
const weatherRng = random(191); const rainCount = 350;
const rainArray = new Float32Array(rainCount * 3), rainSeeds = [];
for (let i = 0; i < rainCount; i++) rainSeeds.push([weatherRng() * 90 - 45, weatherRng() * 65, weatherRng() * 110 - 70]);
const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainArray, 3));
const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: '#e2eddf', size: .15, transparent: true, opacity: .45, depthWrite: false })); scene.add(rain); rain.visible = false;

function notify(text, duration = 2.2) { $('toast').textContent = text; $('toast').classList.add('show'); toastTime = duration; }
function banner(zone) { const z = ZONES[zone]; $('zone-banner').querySelector('strong').textContent = z.name; $('zone-banner').querySelector('em').textContent = z.subtitle; $('zone-banner').classList.add('show'); bannerTime = 4; }
function updateSpellTray() {
  $('spell-tray').replaceChildren();
  for (const [kind, count] of Object.entries(run.spells)) if (count) {
    const item = document.createElement('div'); item.className = 'spell'; item.style.setProperty('--spell-color', SPELLS[kind].color); item.title = `${SPELLS[kind].description} · level ${count}`;
    item.innerHTML = `<b>${SPELLS[kind].glyph}</b><span>${SPELLS[kind].name.toUpperCase()}</span><small>${count}</small>`; $('spell-tray').append(item);
  }
}
function clearWorld() {
  for (const c of chunks.values()) { scene.remove(c.visual); disposeChunk(c.visual); for (const item of [...c.pickups, ...c.enemies, ...c.rings]) scene.remove(item.visual); }
  chunks.clear();
  for (const array of [bullets, particles, enemyShots]) { array.forEach(p => scene.remove(p.visual)); array.length = 0; }
}
function ensureChunks(distance, seed) {
  const index = Math.floor(distance / CHUNK);
  for (const [id, c] of chunks) if (id < index - 2 || id > index + 8) { scene.remove(c.visual); disposeChunk(c.visual); for (const item of [...c.pickups, ...c.enemies, ...c.rings]) scene.remove(item.visual); chunks.delete(id); }
  for (let id = Math.max(0, index - 2); id <= index + 8; id++) {
    if (chunks.has(id)) continue;
    const c = generateChunk(id, seed); c.visual = createChunkVisual(c, seed); scene.add(c.visual);
    for (const p of c.pickups) { p.visual = createPickup(p.kind); scene.add(p.visual); p.active = true; }
    for (const e of c.enemies) { e.visual = createEnemy(); scene.add(e.visual); e.active = true; e.baseX = e.x; e.baseY = e.y; e.cooldown = 2 + (id % 3); e.frozen = 0; }
    for (const r of c.rings) { r.visual = createRing(r.radius); scene.add(r.visual); r.active = true; }
    chunks.set(id, c);
  }
}
function begin() {
  clearWorld(); run = createRun(Math.floor(Math.random() * 1000000)); state = 'playing'; lastZone = 0;
  keys.clear(); shootHeld = false; bannerTime = toastTime = flashTime = 0;
  for (const id of ['start-screen', 'end-screen', 'pause-screen', 'help-screen', 'menu-footer']) $(id).hidden = true;
  for (const id of ['hud', 'pause', 'crosshair']) $(id).hidden = false;
  document.body.classList.add('playing'); $('zone-banner').classList.remove('show'); updateSpellTray(); ensureChunks(0, run.seed);
  notify('S to skim low · W to climb · hold click to cast', 5); canvas.focus();
  if (sound.ctx && sound.enabled) sound.ctx.resume();
}
function pauseGame() { if (state !== 'playing') return; state = 'paused'; keys.clear(); shootHeld = false; $('pause-screen').hidden = false; $('crosshair').hidden = true; document.body.classList.remove('playing'); $('resume').focus(); }
function resume() { if (state !== 'paused') return; state = 'playing'; $('pause-screen').hidden = true; $('crosshair').hidden = false; document.body.classList.add('playing'); }
function finish() {
  state = 'ended'; shootHeld = false; keys.clear(); $('end-screen').hidden = false; $('hud').hidden = true; $('pause').hidden = true; $('crosshair').hidden = true; document.body.classList.remove('playing');
  $('end-distance').textContent = Math.floor(run.distance).toLocaleString(); $('end-score').textContent = Math.floor(run.score).toLocaleString(); $('end-combo').textContent = `×${run.bestChain}`;
  $('end-copy').textContent = `${run.kills} spirits banished · ${run.tricks} sky rolls · ${run.nearMisses} close calls`;
  $('end-best').textContent = run.distance > best ? '✦ A new farthest horizon' : `Farthest horizon · ${Math.floor(best).toLocaleString()} m`;
  best = Math.max(best, run.distance); highScore = Math.max(highScore, run.score);
  try { localStorage.setItem('mcw-best', String(best)); localStorage.setItem('mcw-score', String(highScore)); } catch { /* Best scores are optional. */ }
  $('menu-best').textContent = `${Math.floor(best).toLocaleString()} m`; $('restart').focus();
}
function menu() {
  state = 'menu'; clearWorld(); run = createRun(); menuDistance = 90;
  ['end-screen', 'hud', 'pause', 'crosshair', 'pause-screen'].forEach(id => $(id).hidden = true);
  $('start-screen').hidden = $('menu-footer').hidden = false; $('zone-banner').classList.remove('show'); $('toast').classList.remove('show'); document.body.classList.remove('playing'); $('start').focus();
}
function openHelp() { helpWasRunning = state === 'playing'; if (helpWasRunning) pauseGame(); $('pause-screen').hidden = true; $('help-screen').hidden = false; $('close-help').focus(); }
function closeHelp() { $('help-screen').hidden = true; if (helpWasRunning) resume(); else if (state === 'paused') $('pause-screen').hidden = false; }
$('start').onclick = begin; $('restart').onclick = begin; $('pause-restart').onclick = begin; $('resume').onclick = resume; $('pause').onclick = pauseGame; $('back-menu').onclick = menu;
$('help-button').onclick = openHelp; $('close-help').onclick = closeHelp; $('guide-fly').onclick = closeHelp;
$('sound').onclick = async () => { const on = await sound.toggle(); $('sound').classList.toggle('sound-on', on); $('sound').setAttribute('aria-label', `Turn sound ${on ? 'off' : 'on'}`); };
document.addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (!e.repeat) {
    if (e.code === 'Escape' || e.code === 'KeyP') { if (!$('help-screen').hidden) closeHelp(); else if (state === 'playing') pauseGame(); else if (state === 'paused') resume(); return; }
    if (e.code === 'Enter' && $('help-screen').hidden && (state === 'menu' || state === 'ended')) { e.preventDefault(); begin(); return; }
    if (e.code === 'KeyM') $('sound').click();
    if (e.code === 'Space' && state === 'playing' && run.altitude < 4) notify('Climb above 4m to barrel roll', 1.5);
  }
  keys.add(e.code);
});
document.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', pauseGame); document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
canvas.addEventListener('pointermove', e => { aim.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); $('crosshair').style.left = `${e.clientX}px`; $('crosshair').style.top = `${e.clientY}px`; });
canvas.addEventListener('pointerdown', e => { if (e.button === 0 && state === 'playing') shootHeld = true; });
window.addEventListener('pointerup', () => shootHeld = false); canvas.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); pauseGame(); $('loading').hidden = false; $('loading').style.opacity = '1'; $('loading').innerHTML = '<p>The sky needs a moment.</p><p>Reload this page to restore the graphics.</p>'; });

function particleBurst(x, y, s, color, count = 12) {
  for (let i = 0; i < count && particles.length < 240; i++) {
    const visual = mesh(gem, color, scene, [0, 0, 0], [.1, .16, .1], [0, 0, 0], true);
    const angle = Math.random() * Math.PI * 2, speed = 1 + Math.random() * 5;
    particles.push({ visual, x, y, s, vx: Math.cos(angle) * speed, vy: Math.random() * 5, vs: Math.sin(angle) * speed, life: .45 + Math.random() * .5, max: 1 });
  }
}
function hurt() {
  if (!damage(run)) return;
  flashTime = .4; $('damage-flash').style.opacity = '1'; sound.hit(); particleBurst(run.x, run.altitude, run.distance, '#ffc1a1', 18); notify(run.hp === 1 ? 'One heart. You’ve got this.' : 'Close call · chain lost', 2);
}
function defeat(e) {
  if (!e.active) return;
  e.active = false; e.visual.visible = false; run.kills++; award(run, 160, 12); sound.kill();
  particleBurst(e.x, e.y, e.s, '#d9b8ff', 19); notify(`Spirit banished · +${160 * multiplier(run)}`, 1.1);
}
function strike(e, chained = false) {
  if (!e.active) return;
  const frozen = e.frozen > 0;
  e.hp -= spellDamage(run.spells, frozen) * (chained ? .7 : 1);
  if (run.spells.frost) e.frozen = 1.4 + run.spells.frost * .6;
  particleBurst(e.x, e.y, e.s, frozen ? '#bdf3ec' : '#ffc382', 5);
  if (e.hp <= 0) defeat(e);
  if (!chained && run.spells.storm) {
    let jumps = run.spells.storm;
    for (const c of chunks.values()) for (const other of c.enemies) {
      if (!jumps || !other.active || other === e) continue;
      if (Math.hypot(other.x - e.x, other.y - e.y, other.s - e.s) < 19 + run.spells.storm * 5) {
        for (let i = 0; i < 10; i++) particleBurst(lerp(e.x, other.x, i / 10), lerp(e.y, other.y, i / 10), lerp(e.s, other.s, i / 10), '#ffecaa', 1);
        strike(other, true); jumps--;
      }
    }
  }
}
function fire() {
  if (run.shotCooldown > 0 || bullets.length > 65) return;
  run.shotCooldown = .25 - Math.min(3, run.spells.fire) * .022; sound.spell();
  let target = null, closest = .24;
  for (const c of chunks.values()) for (const e of c.enemies) {
    if (!e.active || e.s < run.distance + 3 || e.s > run.distance + 145) continue;
    temp.copy(e.visual.position).project(camera);
    const delta = Math.hypot(temp.x - aim.x, temp.y - aim.y);
    if (delta < closest) { closest = delta; target = e; }
  }
  let tx, ty, ts;
  if (target) { tx = target.x; ty = target.y; ts = target.s; }
  else {
    // Intersect the pointer ray with a plane ahead, then convert back to spherical altitude.
    const rayPoint = new THREE.Vector3(aim.x, aim.y, .5).unproject(camera), direction = rayPoint.sub(camera.position).normalize();
    const t = (-70 - camera.position.z) / Math.min(-.01, direction.z); rayPoint.copy(camera.position).addScaledVector(direction, t);
    tx = clamp(rayPoint.x, -65, 65); ty = clamp(rayPoint.y + 70 * 70 / (2 * RADIUS), .3, 65); ts = run.distance + 70;
  }
  const count = 1 + run.spells.echo;
  for (let i = 0; i < count; i++) {
    const spread = (i - (count - 1) / 2) * .018, ds = Math.max(7, ts - run.distance);
    const visual = mesh(orb, run.spells.frost ? '#b6eeee' : '#ffc28a', scene, [0, 0, 0], [.27, .27, .75], [0, 0, 0], true);
    bullets.push({ visual, x: run.x, y: run.altitude + .9, s: run.distance + 2, vx: (tx - run.x) / ds * 130 + spread * 130, vy: (ty - run.altitude - .9) / ds * 130, life: 1.8 });
  }
}

function updateEntities(dt, distance, playing) {
  for (const c of chunks.values()) {
    placeOnWorld(c.visual, 0, c.start, 0, distance);
    for (const p of c.pickups) {
      if (!p.active) continue;
      const ahead = p.s - distance;
      if (playing && ahead < 17 && ahead > -3) {
        const range = (p.kind === 'gold' ? 2.15 : 2.7) + run.spells.magnet * 1.3;
        const d = Math.hypot(p.x - run.x, p.y - run.altitude, ahead);
        if (run.spells.magnet && d < 8 + run.spells.magnet * 2) { p.x = lerp(p.x, run.x, dt * 5); p.y = lerp(p.y, run.altitude, dt * 5); }
        if (d < range) {
          p.active = false; p.visual.visible = false;
          if (p.kind === 'gold') { award(run, 15, 2, false); if (run.chain) run.chainTimer = Math.max(run.chainTimer, 3); sound.collect(); }
          else { collectSpell(run, p.kind); updateSpellTray(); notify(SPELLS[p.kind].description, 3); sound.trick(); }
          particleBurst(p.x, p.y, p.s, p.kind === 'gold' ? '#ffe5a6' : SPELLS[p.kind].color, p.kind === 'gold' ? 4 : 20); continue;
        }
      }
      placeOnWorld(p.visual, p.x, p.s, p.y + Math.sin(globalTime * 2 + p.s) * .18, distance); p.visual.rotation.y = globalTime * 1.5 + p.s;
    }
    for (const r of c.rings) {
      if (!r.active) continue;
      placeOnWorld(r.visual, r.x, r.s, r.y, distance); r.visual.rotation.z = globalTime * .2;
      if (playing && Math.abs(r.s - distance) < 1.8 && Math.hypot(r.x - run.x, r.y - run.altitude) < r.radius - .45) {
        r.active = false; r.visual.visible = false; award(run, 120, 14); sound.trick(); notify(`Thread the needle · +${120 * multiplier(run)}`, 1.5); particleBurst(r.x, r.y, r.s, '#ffdf92', 24);
      }
    }
    for (const e of c.enemies) {
      if (!e.active) continue;
      e.frozen = Math.max(0, e.frozen - dt);
      if (playing) { e.phase += dt * (e.frozen ? .15 : .7); e.x = e.baseX + Math.sin(e.phase) * 2; e.y = e.baseY + Math.sin(e.phase * 1.4) * .9; }
      placeOnWorld(e.visual, e.x, e.s, e.y, distance); e.visual.rotation.z = Math.sin(e.phase) * .12;
      if (e.frozen) e.visual.scale.setScalar(.92 + Math.sin(globalTime * 14) * .025); else e.visual.scale.setScalar(1);
      const ahead = e.s - distance;
      if (playing && ahead > 12 && ahead < 85) {
        e.cooldown -= dt * (e.frozen ? .25 : 1);
        if (e.cooldown <= 0 && enemyShots.length < 28) {
          e.cooldown = 3.2; const visual = mesh(gem, '#e68fab', scene, [0, 0, 0], [.45, .45, .7], [0, 0, 0], true);
          const arrival = ahead / (run.speed + 28);
          enemyShots.push({ visual, x: e.x, y: e.y, s: e.s, vx: (run.x - e.x) / arrival, vy: (run.altitude - e.y) / arrival, life: 4 });
        }
      }
      if (playing && Math.abs(ahead) < 1.7 && Math.hypot(e.x - run.x, e.y - run.altitude) < 2) { hurt(); e.active = false; e.visual.visible = false; }
    }
    if (playing) for (const o of c.obstacles) {
      if (intersectsObstacle(run, o)) hurt();
      else if (!o.near && nearObstacle(run, o)) { o.near = true; run.nearMisses++; award(run, 70, 9); notify('Silk-thin escape · +skyfire', 1.1); sound.collect(); }
    }
  }
  if (!playing) return;
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]; b.s += 130 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let hit = false;
    for (const c of chunks.values()) for (const e of c.enemies) if (!hit && e.active && Math.abs(e.s - b.s) < 2.8 && Math.hypot(e.x - b.x, e.y - b.y) < 1.9 + run.spells.fire * .15) { strike(e); hit = true; }
    if (b.life <= 0 || hit) { scene.remove(b.visual); bullets.splice(i, 1); } else placeOnWorld(b.visual, b.x, b.s, b.y, distance);
  }
  for (let i = enemyShots.length - 1; i >= 0; i--) {
    const p = enemyShots[i]; p.s -= 28 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    if (Math.abs(p.s - distance) < 1.6 && Math.hypot(p.x - run.x, p.y - run.altitude) < 1.3) { if (!run.roll) hurt(); p.life = 0; }
    if (p.life <= 0 || p.s < distance - 10) { scene.remove(p.visual); enemyShots.splice(i, 1); } else { placeOnWorld(p.visual, p.x, p.s, p.y, distance); p.visual.rotation.z = globalTime * 5; }
  }
}
function updateParticles(dt, distance) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.life -= dt;
    if (p.life <= 0) { scene.remove(p.visual); particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.s += p.vs * dt; p.vy -= 3 * dt;
    placeOnWorld(p.visual, p.x, p.s, p.y, distance); p.visual.scale.setScalar(p.life * .2); p.visual.rotation.z = globalTime * 3;
  }
}
function updateAtmosphere(dt, distance) {
  const z = ZONES[zoneAt(distance)], cycle = state === 'menu' ? .14 : run.time / 150 + .14;
  const daylight = (Math.sin(cycle * Math.PI * 2) + 1) / 2, night = 1 - THREE.MathUtils.smoothstep(daylight, .12, .6);
  const weatherCycle = Math.floor((state === 'menu' ? 0 : run.time) / 38);
  const weather = state === 'menu' ? 0 : [0, 1, 0, 2, 0, 1, 2][(weatherCycle + zoneAt(distance)) % 7];
  const sand = weather === 2 && ['desert', 'ancient', 'canyon'].includes(z.type), raining = weather === 2 && !sand;
  const skyTop = new THREE.Color(z.sky).lerp(new THREE.Color('#407677'), .32).lerp(new THREE.Color('#202d55'), night);
  const horizon = new THREE.Color(z.fog).lerp(new THREE.Color('#eba777'), (1 - Math.abs(daylight * 2 - 1)) * .26).lerp(new THREE.Color('#646086'), night);
  if (sand) horizon.lerp(new THREE.Color('#d3a773'), .55);
  if (raining) skyTop.lerp(new THREE.Color('#667e91'), .5);
  sky.uniforms.top.value.lerp(skyTop, dt * .5); sky.uniforms.bottom.value.lerp(horizon, dt * .5); scene.fog.color.lerp(horizon, dt * .5);
  scene.fog.far = lerp(scene.fog.far, sand ? 165 : raining ? 215 : 295, dt * .3);
  planetMaterial.color.lerp(new THREE.Color(z.ground), dt * .5);
  ambient.intensity = lerp(ambient.intensity, 2.4 - night * .75, dt); sunlight.intensity = lerp(sunlight.intensity, 2.7 - night * 1.65, dt);
  sunlight.color.lerp(new THREE.Color(night > .5 ? '#b5c9fa' : '#ffe1b1'), dt * .5);
  sky.sun.visible = night < .7; sky.moon.visible = night > .2; sky.stars.material.opacity = night * .8;
  sky.sun.position.y = 35 + daylight * 115; sky.clouds.rotation.y += dt * (weather ? .005 : .0015);
  rain.visible = raining || sand;
  if (rain.visible) {
    rain.material.color.set(sand ? '#edc38a' : '#d7e8e0'); rain.material.size = sand ? .2 : .11;
    for (let i = 0; i < rainCount; i++) { const [x, y, s] = rainSeeds[i]; rainArray[i * 3] = ((x + globalTime * (sand ? 12 : 2) + 100) % 90) - 45; rainArray[i * 3 + 1] = (y - globalTime * (sand ? 3 : 25) % 65 + 65) % 65; rainArray[i * 3 + 2] = s; }
    rainGeo.attributes.position.needsUpdate = true;
  }
  return `${night > .6 ? '☾ MOONLIT' : daylight > .85 ? '✦ DAYLIGHT' : '✦ GOLDEN HOUR'} · ${sand ? 'SAND WINDS' : raining ? 'PASSING RAIN' : weather === 1 ? 'GENTLE WINDS' : 'CLEAR SKIES'}`;
}
function updateCarpet(dt, playing) {
  const x = state === 'menu' ? 8 : run.x, altitude = state === 'menu' ? 7 + Math.sin(globalTime * .8) * .5 : run.altitude;
  carpet.root.position.set(x, altitude - x * x / (2 * RADIUS), 0);
  const rollAngle = run.roll > 0 ? (1 - run.roll / .85) * Math.PI * 2 * run.rollDirection : 0;
  carpet.body.rotation.z = lerp(carpet.body.rotation.z, -run.vx * .025 - x / RADIUS, dt * 7);
  // Roll has a separate axis transform so ending at 2π never snaps the bank.
  carpet.root.rotation.z = rollAngle; carpet.body.rotation.x = lerp(carpet.body.rotation.x, run.vy * .023, dt * 5);
  carpet.body.rotation.y = lerp(carpet.body.rotation.y, -run.vx * .018, dt * 5);
  carpet.root.visible = !(playing && run.invulnerable > 0 && Math.floor(globalTime * 12) % 3 === 0);
  const pos = carpet.fabric.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) { const px = pos.getX(i), pz = pos.getZ(i); pos.setY(i, Math.sin(pz * 1.7 + globalTime * 5) * .075 + Math.pow(Math.abs(pz) / 2.65, 5) * (.22 + Math.sin(globalTime * 4) * .08) + Math.pow(Math.abs(px) / 1.85, 4) * .08); }
  pos.needsUpdate = true; carpet.fabric.geometry.computeVertexNormals(); carpet.scarf.rotation.x = Math.sin(globalTime * 8) * .2;
  carpet.shadow.position.set(x, .12 - x * x / (2 * RADIUS), 0); carpet.shadow.scale.setScalar(1 + altitude * .035); carpet.shadow.material.opacity = clamp(.23 - altitude * .004, .06, .23);
  if (playing && Math.random() < .7) {
    const color = run.boost ? '#a4e9e0' : '#edbf78';
    particleBurst(x + (Math.random() - .5) * 2.7, altitude - .15, run.distance - 2.3, color, run.boost ? 2 : 1);
  }
}
function updateCamera(dt) {
  if (state === 'menu') { goalPosition.set(11 + Math.sin(globalTime * .08) * 3, 26, 48); goalLook.set(-19, 1, -35); }
  else { goalPosition.set(run.x * .48 + 3, 12 + run.altitude * .62, run.boost ? 27 : 24); goalLook.set(run.x * .65, 2 + run.altitude * .45, -32); }
  camera.position.lerp(goalPosition, 1 - Math.exp(-dt * 3)); camera.lookAt(goalLook);
  camera.fov = lerp(camera.fov, state === 'menu' ? 49 : run.boost ? 64 : 54, dt * 2); camera.updateProjectionMatrix();
}
function updateUI(weather) {
  $('weather').textContent = weather; $('zone-name').textContent = ZONES[zoneAt(state === 'menu' ? menuDistance : run.distance)].name;
  if (state !== 'playing') return;
  $('distance').textContent = Math.floor(run.distance).toLocaleString(); $('score').textContent = Math.floor(run.score).toLocaleString();
  $('hearts').textContent = Array.from({ length: 3 }, (_, i) => i < run.hp ? '♥' : '♡').join(' '); $('hearts').setAttribute('aria-label', `${run.hp} health`);
  $('combo').textContent = `×${multiplier(run)}`; $('combo-label').textContent = run.chain ? `${run.chain} MOMENTS OF MAGIC` : 'FIND YOUR FLOW'; $('combo-bar').style.width = `${run.chainTimer / 5 * 100}%`;
  $('power-bar').style.width = `${run.power}%`; $('power-value').textContent = `${Math.floor(run.power)}%`; $('power-hint').textContent = run.boost ? 'Skyfire flowing · keep the chain alive' : run.power >= 25 ? 'Hold SHIFT to ride the skyfire' : 'Skim low to gather power';
  $('speed-value').textContent = Math.round(run.speed * 3.6); $('altitude').textContent = `${run.altitude.toFixed(1)} m above ground`;
  $('flight-mode').textContent = run.boost ? '✦ SKYFIRE ASCENDANT' : run.altitude < 3.5 ? '✦ GROUND EFFECT' : run.roll ? '✧ SILK SPIRAL' : 'RIDE THE WIND';
}

ensureChunks(menuDistance, run.seed); camera.position.set(11, 26, 48); camera.lookAt(-19, 1, -35);
let firstFrame = true;
function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, .04); lastTime = now;
  const frozen = state === 'paused' || !$('help-screen').hidden;
  const worldDt = frozen ? 0 : dt; globalTime += worldDt;
  const playing = state === 'playing';
  if (playing) {
    const steer = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const lift = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    updateRun(run, { steer, lift, boost: keys.has('ShiftLeft') || keys.has('ShiftRight'), roll: keys.has('Space') }, dt);
    while (run.events.length) { run.events.pop(); notify(`Silk spiral · +${90 * multiplier(run)} · +11 skyfire`, 1.2); sound.trick(); }
    if (shootHeld) fire();
    const nextZone = zoneAt(run.distance); if (nextZone !== lastZone) { lastZone = nextZone; banner(lastZone); }
  }
  const distance = state === 'menu' ? menuDistance : run.distance;
  ensureChunks(distance, run.seed); updateEntities(worldDt, distance, playing); updateParticles(worldDt, distance); updateCarpet(worldDt, playing); updateCamera(dt);
  const weather = updateAtmosphere(worldDt, distance);
  if (!frozen) sound.update(dt, playing, run.boost);
  if (toastTime > 0) { toastTime -= worldDt; if (toastTime <= 0) $('toast').classList.remove('show'); }
  if (bannerTime > 0) { bannerTime -= worldDt; if (bannerTime <= 0) $('zone-banner').classList.remove('show'); }
  if (flashTime > 0) { flashTime -= dt; if (flashTime <= 0) $('damage-flash').style.opacity = '0'; }
  uiClock += dt; if (uiClock >= .1) { updateUI(weather); uiClock = 0; }
  renderer.render(scene, camera);
  if (firstFrame) { firstFrame = false; $('loading').style.opacity = '0'; setTimeout(() => $('loading').hidden = true, 650); }
  if (playing && run.ended) finish();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
