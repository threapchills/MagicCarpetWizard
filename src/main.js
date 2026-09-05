import './style.css';
import './flight.css';
import * as THREE from 'three';
import { CHUNK, RADIUS, ZONES, ZONE_LENGTH, SPELLS, clamp, lerp, cliffRailAt, createRun, updateRun, generateChunk, zoneAt, multiplier, award, damage, intersectsObstacle, nearObstacle } from './game.js';
import { mat, mesh, gem, orb, createChunkVisual, placeOnTerrain as placeOnWorld, createCarpet, createPickup, createEnemy, createBreakable, createRing, createSky, disposeChunk } from './world.js';
import { elevationAt, passageAt, hitsPassage } from './landscape.js';
import { Soundscape } from './audio.js';
import { InkRenderer } from './ink.js';
import { BloodRibbons } from './effects.js';
import { Battle } from './battle.js';
import { WEAPONS } from './combat.js';
import { WeatherField, weatherAt } from './weather.js';
import { MagicField } from './magic.js';
import { RACE_LEVELS, RaceRecords, createCourse, createAttempt, generateRaceChunk, stepRace, formatTime, checkpointDelta } from './race.js';
import { RaceView } from './race-view.js';
import { ADVENTURE_TIME_SCALE, balanceAt } from './pacing.js';
import './race.css';

const $ = id => document.getElementById(id);
const canvas = $('world');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
catch { $('loading').innerHTML = '<p>This carpet needs WebGL 2 to fly.</p><p>Please enable hardware acceleration or try a current Chrome, Edge, Firefox or Safari browser.</p>'; throw new Error('WebGL renderer unavailable'); }
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
const scene = new THREE.Scene(); scene.fog = new THREE.Fog('#c7d8c5', 185, 480);
const camera = new THREE.PerspectiveCamera(49, innerWidth / innerHeight, .2, 1100);
const ink = new InkRenderer(renderer, camera);
const ambient = new THREE.HemisphereLight('#f7dba6', '#655581', 1); scene.add(ambient);
const caveLight = new THREE.PointLight('#ffd3a0', 0, 85, 1.5); scene.add(caveLight);
const sunlight = new THREE.DirectionalLight('#fff0c7', 1.9); sunlight.position.set(-60, 65, 25); sunlight.castShadow = true;
sunlight.shadow.mapSize.set(2048, 2048); Object.assign(sunlight.shadow.camera, { left: -90, right: 90, top: 75, bottom: -85, near: 1, far: 230 });
sunlight.shadow.bias = -.0007; sunlight.shadow.normalBias = .3; sunlight.target.position.set(0, 0, -28); scene.add(sunlight, sunlight.target);
const planetMaterial = mat('#dca773');
const planet = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 96, 64), planetMaterial); planet.position.y = -RADIUS - 1; planet.receiveShadow = true; scene.add(planet);
const sky = createSky(scene);
const carpet = createCarpet(); scene.add(carpet.root, carpet.shadow);
const blood = new BloodRibbons(scene);
const magic = new MagicField(scene, Math.min(devicePixelRatio, 1.65));
const chunks = new Map(), bullets = [], particles = [], enemyShots = [];
const sound = new Soundscape();
const raceRecords = new RaceRecords(), raceView = new RaceView(scene);
let raceAttempt = null, raceLevel = 'easy', nextPlayer = 0;
let state = 'menu', run = createRun(), globalTime = 0, lastTime = performance.now(), uiClock = 0;
let menuDistance = 90, lastZone = 0, bannerTime = 0, toastTime = 0, flashTime = 0, shootHeld = false, helpWasRunning = false;
let notifyPriority = 0, hitTime = 0, trailClock = 0, particleClock = 0, accumulator = 0;
let deathTime = 0;
let audioEnvironment = {};
let windowFocused = true;
const battle = new Battle(scene, chunks, bullets, enemyShots, {
  sound, blood, magic, particles: particleBurst, notify, hurt, tray: updateSpellTray, arena: setArena,
  hit() { hitTime = .13; $('crosshair').classList.add('hit'); },
  bossUI(b) {
    $('boss-hud').hidden = !b;
    if (!b) return;
    $('boss-name').textContent = b.name;
    $('boss-health').style.width = Math.max(0, b.hp / b.maxHp * 100) + '%';
    $('boss-health-track').setAttribute('aria-valuenow', Math.round(b.hp / b.maxHp * 100));
    const gap = Math.round(b.s - run.distance);
    $('boss-phase').textContent = (b.shield ? `${b.sigils.filter(s => s.active).length} WARDS · ` : b.phase === 2 ? 'ENRAGED · ' : '') + (gap < 0 ? `${-gap}m BEHIND · KEEP BOOSTING` : `${gap}m AHEAD · ATTACK OR PASS`);
  },
});
const STEP = 1 / 90;
let aim = new THREE.Vector2(0, .03), best = 0, highScore = 0;
const keys = new Set();
try { best = Number(localStorage.getItem('mcw-best')) || 0; highScore = Number(localStorage.getItem('mcw-score')) || 0; } catch { /* Private browsing still supports complete runs. */ }
$('menu-best').textContent = best ? `${Math.floor(best).toLocaleString()} m` : 'Your story starts here';
const temp = new THREE.Vector3(), goalPosition = new THREE.Vector3(), goalLook = new THREE.Vector3();
const currentLook = new THREE.Vector3(-19, 1, -35);
const particleMesh = new THREE.InstancedMesh(gem, new THREE.MeshBasicMaterial({ color: '#ffffff' }), 240);
particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); particleMesh.count = 0; particleMesh.frustumCulled = false; scene.add(particleMesh);
const particleTransform = new THREE.Object3D(), particleColor = new THREE.Color();
const trailHistory = [], trails = [];
for (const side of [-1, 1]) {
  const geometry = new THREE.BufferGeometry(), positions = new Float32Array(32 * 6), colors = new Float32Array(32 * 6), indices = [];
  for (let i = 0; i < 31; i++) { const n = i * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometry.setIndex(indices);
  const visual = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: '#c0fff3', vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending }));
  visual.frustumCulled = false; scene.add(visual); trails.push({ side, visual, positions, colors });
}
const weatherField = new WeatherField(scene);

function notify(text, duration = 2.2, priority = 0) { if (toastTime > 0 && priority < notifyPriority) return; notifyPriority = priority; $('toast').textContent = text; $('toast').classList.add('show'); toastTime = duration; }
function banner(zone) { const z = ZONES[zone]; $('zone-banner').querySelector('strong').textContent = z.name; $('zone-banner').querySelector('em').textContent = z.subtitle; $('zone-banner').classList.add('show'); bannerTime = 4; }
function updateSpellTray() {
  $('spell-tray').replaceChildren();
  for (const [kind, count] of Object.entries(run.spells)) if (count) {
    const item = document.createElement('div'); item.className = 'spell' + (kind === run.weapon ? ' selected' : ''); item.style.setProperty('--spell-color', SPELLS[kind].color); item.title = `${SPELLS[kind].description} · level ${count}`;
    item.innerHTML = `<b>${SPELLS[kind].glyph}</b><span>${SPELLS[kind].name.toUpperCase()}</span><small>${WEAPONS.includes(kind) ? WEAPONS.indexOf(kind) + 1 + ' · ' : ''}LV ${count}</small>`; $('spell-tray').append(item);
  }
}
function clearWorld() {
  raceView.clear();
  battle.clear(); blood.clear(); magic.clear();
  for (const c of chunks.values()) { scene.remove(c.visual); disposeChunk(c.visual); for (const item of [...c.pickups, ...c.enemies, ...c.rings, ...(c.props || [])]) scene.remove(item.visual); }
  chunks.clear();
  for (const array of [bullets, enemyShots]) { array.forEach(p => scene.remove(p.visual)); array.length = 0; }
  particles.length = 0; particleMesh.count = 0; trailHistory.length = 0; trails.forEach(t => t.visual.visible = false);
}
function ensureChunks(distance, seed) {
  const index = Math.floor(distance / CHUNK);
  for (const [id, c] of chunks) if (id < index - 2 || id > index + 8) {
    scene.remove(c.visual); disposeChunk(c.visual);
    for (const item of [...c.pickups, ...c.rings, ...(c.props || [])]) scene.remove(item.visual);
    for (const e of c.enemies) if (!battle.retainEnemy(e, distance)) scene.remove(e.visual);
    chunks.delete(id);
  }
  for (let id = Math.max(0, index - 2); id <= index + 8; id++) {
    if (chunks.has(id)) continue;
    const c = raceAttempt ? raceAttempt.collisionChunks[id] || generateRaceChunk(id, raceAttempt.course) : generateChunk(id, seed); c.combatClear = !!battle.boss; c.visual = createChunkVisual(c, seed, c.combatClear); scene.add(c.visual);
    for (const p of c.props || []) { p.visual = createBreakable(p.kind); p.visual.visible = p.active; scene.add(p.visual); }
    for (const p of c.pickups) { p.visual = createPickup(p.kind); scene.add(p.visual); p.active = true; }
    for (const e of c.enemies) { e.visual = createEnemy(e.kind); scene.add(e.visual); e.active = true; e.baseX = e.x; e.baseY = e.y; e.baseS = e.s; e.radius ||= 2.4; e.maxHp = e.hp; e.cooldown = .85 + (e.spawnDelay || 0); e.frozen = 0; }
    for (const r of c.rings) { r.visual = createRing(r.radius); scene.add(r.visual); r.active = true; }
    chunks.set(id, c);
  }
}
function setArena(active) {
  for (const c of chunks.values()) {
    c.combatClear = active || c.start < run.distance + 128;
    scene.remove(c.visual); disposeChunk(c.visual);
    c.visual = createChunkVisual(c, run.seed, c.combatClear); scene.add(c.visual);
    if (!active && c.combatClear) for (const e of c.enemies) { e.active = false; e.visual.visible = false; }
  }
}
function begin(mode = 'adventure') {
  windowFocused = true;
  sound.setPaused(false);
  void sound.start();
  clearWorld();
  if (mode !== 'race') raceAttempt = null;
  run = raceAttempt ? raceAttempt.run : createRun(Math.floor(Math.random() * 1000000)); state = 'playing'; lastZone = 0;
  document.body.classList.toggle('racing', !!raceAttempt);
  if (raceAttempt) { globalTime = 0; raceView.start(raceAttempt.course, raceAttempt.player); }
  keys.clear(); shootHeld = false; bannerTime = toastTime = flashTime = hitTime = accumulator = trailClock = particleClock = 0;
  $('damage-flash').style.opacity = '0'; $('crosshair').classList.remove('hit', 'locked');
  for (const id of ['start-screen', 'end-screen', 'pause-screen', 'help-screen', 'menu-footer', 'race-setup', 'race-results']) $(id).hidden = true;
  for (const id of ['hud', 'pause', 'crosshair']) $(id).hidden = false;
  document.body.classList.add('playing'); $('zone-banner').classList.remove('show'); updateSpellTray(); ensureChunks(0, run.seed);
  $('race-hud').hidden = !raceAttempt; $('race-countdown').hidden = !raceAttempt;
  $('pause-restart').textContent = raceAttempt ? 'Retry this course' : 'Start a fresh journey';
  notify(raceAttempt ? 'Fly through every gate · skim low · SHIFT to boost' : '1 Fireball · 2 Lightning · 3 Wind blast · hold click to cast', 5); canvas.focus();
  updateRaceUI();
}
function pauseGame() { if (state !== 'playing') return; sound.setPaused(true); state = 'paused'; accumulator = 0; keys.clear(); shootHeld = false; $('pause-screen').hidden = false; $('crosshair').hidden = true; document.body.classList.remove('playing', 'boosting'); $('resume').focus(); }
function resume() { if (state !== 'paused') return; sound.setPaused(false); state = 'playing'; accumulator = 0; $('pause-screen').hidden = true; $('crosshair').hidden = false; document.body.classList.add('playing'); }
function finish() {
  state = 'ended'; shootHeld = false; keys.clear(); $('end-screen').hidden = false; $('hud').hidden = true; $('pause').hidden = true; $('crosshair').hidden = true; document.body.classList.remove('playing', 'boosting');
  $('end-distance').textContent = Math.floor(run.distance).toLocaleString(); $('end-score').textContent = Math.floor(run.score).toLocaleString(); $('end-combo').textContent = `×${run.bestChain}`;
  $('end-copy').textContent = `${run.kills} monsters slain · ${run.bosses} bosses defeated · ${run.tricks} sky rolls`;
  $('end-best').textContent = run.distance > best ? '✦ A new farthest horizon' : `Farthest horizon · ${Math.floor(best).toLocaleString()} m`;
  best = Math.max(best, run.distance); highScore = Math.max(highScore, run.score);
  try { localStorage.setItem('mcw-best', String(best)); localStorage.setItem('mcw-score', String(highScore)); } catch { /* Best scores are optional. */ }
  $('menu-best').textContent = `${Math.floor(best).toLocaleString()} m`; $('restart').focus();
}
function menu() {
  state = 'menu'; clearWorld(); raceAttempt = null; run = createRun(); menuDistance = 90; toastTime = bannerTime = 0;
  ['end-screen', 'hud', 'pause', 'crosshair', 'pause-screen', 'race-setup', 'race-results', 'race-hud', 'race-countdown'].forEach(id => $(id).hidden = true);
  $('start-screen').hidden = $('menu-footer').hidden = false; $('zone-banner').classList.remove('show'); $('toast').classList.remove('show'); document.body.classList.remove('playing', 'racing', 'boosting'); $('start').focus();
}
function raceSetup() {
  menu(); state = 'race-setup'; $('start-screen').hidden = true; $('race-setup').hidden = false;
  windowFocused = true; sound.setPaused(false); void sound.start();
  updateRaceSetup(); $('race-start').focus();
}
function updateRaceSetup() {
  const session = raceRecords.get(raceLevel), config = RACE_LEVELS[raceLevel];
  for (const level of Object.keys(RACE_LEVELS)) $('race-' + level).setAttribute('aria-pressed', String(level === raceLevel));
  $('race-description').textContent = `${config.description} · ${config.length.toLocaleString()} m`;
  $('race-course').textContent = `COURSE ${session.seed.toString(36).toUpperCase()} · SAME COURSE FOR BOTH RIDERS`;
  for (let i = 0; i < 2; i++) $('race-p' + (i + 1)).textContent = formatTime(session.best[i]?.time);
  $('race-start').textContent = `Player ${nextPlayer + 1} · Ready to race ↗`;
}
function startRace(player = nextPlayer) {
  const session = raceRecords.get(raceLevel);
  raceAttempt = createAttempt(createCourse(raceLevel, session.seed), player, session.best[1 - player]);
  begin('race');
}
function finishRace() {
  const a = raceAttempt, personalBest = raceRecords.complete(a);
  state = 'race-ended'; nextPlayer = 1 - a.player; shootHeld = false; keys.clear();
  for (const id of ['hud', 'pause', 'crosshair', 'race-countdown']) $(id).hidden = true;
  document.body.classList.remove('playing', 'boosting'); $('race-results').hidden = false;
  $('race-result-title').textContent = a.dnf ? 'Time’s up.' : personalBest ? 'Personal best!' : 'Across the line.';
  $('race-result-time').textContent = a.dnf ? 'DNF' : formatTime(a.elapsed);
  $('race-result-copy').textContent = `Player ${a.player + 1} · ${a.course.name} · ${a.crashes} resets${a.dnf ? ' · 3 minute limit' : ''}`;
  const bests = raceRecords.get(raceLevel).best;
  $('race-result-scores').textContent = `P1 ${formatTime(bests[0]?.time)}   /   P2 ${formatTime(bests[1]?.time)}`;
  $('race-result-leader').textContent = bests.every(Boolean) ? Math.abs(bests[0].time - bests[1].time) < .0005 ? 'A dead heat. Settle it on the next run.' : `Player ${bests[0].time < bests[1].time ? 1 : 2} leads by ${formatTime(Math.abs(bests[0].time - bests[1].time))}` : 'Your opponent’s best finished run becomes your ghost.';
  $('race-next').textContent = `Pass to Player ${nextPlayer + 1} ↗`; $('race-retry').textContent = `Retry · Player ${a.player + 1}`; $('race-next').focus();
  raceView.update(a);
}
function updateRaceUI() {
  if (!raceAttempt) return;
  const a = raceAttempt, gate = a.course.gates[a.nextGate];
  $('race-timer').textContent = formatTime(a.elapsed);
  $('race-rider').textContent = `PLAYER ${a.player + 1} · ${a.course.name.toUpperCase()}`;
  $('race-target').textContent = gate ? `${a.nextGate === a.course.gates.length - 1 ? 'FINISH' : 'GATE ' + (a.nextGate + 1) + ' / ' + a.course.gates.length} · ${Math.max(0, Math.ceil(gate.s - run.distance))} m · ${Math.round(gate.y)} m HIGH` : 'FINISHED';
  $('race-ghost-label').textContent = a.ghost ? `P${2 - a.player} GHOST · ${formatTime(a.ghost.time)}` : 'NO OPPONENT GHOST YET · SET THE FIRST TIME';
  const delta = checkpointDelta(a);
  const splitText = delta !== null ? `GATE ${a.nextGate} · ${delta <= 0 ? '−' : '+'}${Math.abs(delta).toFixed(3)}s · ${Math.abs(delta) < .0005 ? 'LEVEL' : delta < 0 ? 'AHEAD' : 'BEHIND'}` : a.nextGate ? `GATE ${a.nextGate} · ${formatTime(a.splits.at(-1))} · +12 SKYFIRE` : 'CHECKPOINTS REFILL SKYFIRE · R TO RETRY';
  if ($('race-split').textContent !== splitText) $('race-split').textContent = splitText;
  $('race-split').classList.toggle('behind', delta > 0);
  const countdown = a.countdown > 0 ? String(Math.ceil(a.countdown)) : a.elapsed < .65 ? 'GO!' : '';
  $('race-countdown').hidden = !countdown || state !== 'playing';
  if ($('race-countdown').textContent !== countdown) $('race-countdown').textContent = countdown;
}
function raceStep(input) {
  const event = stepRace(raceAttempt, input, STEP);
  if (event === 'crash' || event === 'miss') { trailHistory.length = 0; sound.hit(); flashTime = .3; $('damage-flash').style.opacity = '1'; notify(event === 'miss' ? 'Missed gate · back to checkpoint' : 'Clipped it · back to checkpoint', 1.6, 3); }
  if (event === 'gate' || event === 'finish') {
    const g = raceAttempt.course.gates[raceAttempt.nextGate - 1];
    sound.trick(); magic.checkpoint(g.x, g.y, g.s, g.radius, event === 'finish');
    if (event === 'gate') notify(`GATE ${raceAttempt.nextGate} CLEARED · +12 SKYFIRE`, 1.2, 2);
  }
  if (event === 'finish' || event === 'timeout') finishRace();
}
function openHelp() { if (!$('help-screen').hidden) return; helpWasRunning = state === 'playing'; if (helpWasRunning) pauseGame(); $('pause-screen').hidden = true; $('help-screen').hidden = false; $('close-help').focus(); }
function closeHelp() { $('help-screen').hidden = true; if (helpWasRunning) resume(); else if (state === 'paused') $('pause-screen').hidden = false; }
$('start').onclick = () => begin(); $('restart').onclick = () => begin(); $('pause-restart').onclick = () => raceAttempt ? startRace(raceAttempt.player) : begin(); $('resume').onclick = resume; $('pause').onclick = pauseGame; $('back-menu').onclick = menu;
$('race-button').onclick = raceSetup; $('race-start').onclick = () => startRace(); $('race-next').onclick = () => startRace();
$('race-retry').onclick = () => startRace(raceAttempt.player); $('race-change').onclick = raceSetup;
$('race-back').onclick = menu; $('race-home').onclick = menu; $('pause-menu').onclick = () => raceAttempt ? raceSetup() : menu();
$('race-new').onclick = () => { raceRecords.regenerate(raceLevel); nextPlayer = 0; updateRaceSetup(); };
$('race-swap').onclick = () => { nextPlayer = 1 - nextPlayer; updateRaceSetup(); };
for (const level of Object.keys(RACE_LEVELS)) $('race-' + level).onclick = () => { raceLevel = level; nextPlayer = 0; updateRaceSetup(); };
$('help-button').onclick = openHelp; $('close-help').onclick = closeHelp; $('guide-fly').onclick = closeHelp;
function updateAudioUI() {
  $('sound').classList.toggle('sound-on', sound.enabled);
  $('sound').setAttribute('aria-label', sound.enabled ? 'Mute sound' : 'Enable ambience and effects');
  $('sound').setAttribute('aria-pressed', String(sound.enabled));
  $('sound').title = sound.status();
  $('audio-status').textContent = sound.status();
  $('audio-controls').hidden = !['menu', 'paused'].includes(state) || !$('help-screen').hidden;
  for (const kind of ['ambience', 'effects']) {
    const value = Math.round(sound[kind + 'Volume'] * 100);
    $(kind + '-volume').value = value; $(kind + '-level').textContent = value + '%';
  }
}
$('sound').onclick = async () => { await sound.toggle(); updateAudioUI(); };
for (const kind of ['ambience', 'effects']) $(kind + '-volume').addEventListener('input', e => { sound.setVolume(kind, Number(e.target.value) / 100); updateAudioUI(); });
updateAudioUI();
document.addEventListener('keydown', e => {
  const nativeControl = ['BUTTON', 'INPUT', 'SUMMARY'].includes(e.target?.tagName);
  if (!nativeControl && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (!e.repeat) {
    if (e.code === 'KeyR' && !nativeControl && $('help-screen').hidden && ['playing', 'paused', 'ended', 'race-ended'].includes(state)) { e.preventDefault(); raceAttempt ? startRace(raceAttempt.player) : begin(); return; }
    if (e.code === 'Escape' || e.code === 'KeyP') { if (!$('help-screen').hidden) closeHelp(); else if (state === 'playing') pauseGame(); else if (state === 'paused') resume(); return; }
    if (e.code === 'Enter' && !nativeControl && $('help-screen').hidden && (state === 'menu' || state === 'ended')) { e.preventDefault(); begin(); return; }
    if (e.code === 'Enter' && !nativeControl && $('help-screen').hidden && ['race-setup', 'race-ended'].includes(state)) { e.preventDefault(); startRace(); return; }
    if (e.code === 'KeyM') $('sound').click();
    if (state === 'playing') {
      const weapon = { Digit1: 'fire', Digit2: 'storm', Digit3: 'wind' }[e.code];
      if (weapon) battle.switchWeapon(run, weapon);
      if (e.code === 'KeyQ') battle.switchWeapon(run, WEAPONS[(WEAPONS.indexOf(run.weapon) + 1) % WEAPONS.length]);
    }
    if (e.code === 'Space' && state === 'playing' && run.altitude < 4) notify('Climb above 4m to barrel roll', 1.5);
  }
  keys.add(e.code);
});
document.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => { windowFocused = false; sound.setPaused(true); pauseGame(); });
window.addEventListener('focus', () => { windowFocused = true; sound.setPaused(state === 'paused' || !$('help-screen').hidden); });
document.addEventListener('visibilitychange', () => { sound.setPaused(document.hidden || state === 'paused'); if (document.hidden) pauseGame(); });
window.addEventListener('pointermove', e => { aim.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); $('crosshair').style.left = `${e.clientX}px`; $('crosshair').style.top = `${e.clientY}px`; });
canvas.addEventListener('pointerdown', e => {
  if (e.button === 0 && state === 'playing') {
    e.preventDefault(); shootHeld = true;
    if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
  }
});
window.addEventListener('pointerup', () => shootHeld = false); canvas.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('pointercancel', () => shootHeld = false);
canvas.addEventListener('lostpointercapture', () => shootHeld = false);
document.addEventListener('selectstart', e => { if (state === 'playing') e.preventDefault(); });
document.addEventListener('dragstart', e => { if (state === 'playing') e.preventDefault(); });
window.addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); ink.resize(); });
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); pauseGame(); $('loading').hidden = false; $('loading').style.opacity = '1'; $('loading').innerHTML = '<p>The sky needs a moment.</p><p>Reload this page to restore the graphics.</p>'; });

function particleBurst(x, y, s, color, count = 12) {
  for (let i = 0; i < count && particles.length < 240; i++) {
    const angle = Math.random() * Math.PI * 2, speed = 1 + Math.random() * 5;
    particles.push({ color, x, y, s, vx: Math.cos(angle) * speed, vy: Math.random() * 5, vs: Math.sin(angle) * speed, life: .45 + Math.random() * .5 });
  }
}
function hurt() {
  if (!damage(run)) return;
  flashTime = .4; $('damage-flash').style.opacity = '1'; sound.hit(); particleBurst(run.x, run.altitude, run.distance, '#ffc1a1', 18); notify(run.hp === 1 ? 'One heart. You’ve got this.' : 'Close call · chain lost', 2, 3);
}
function fire() { battle.fire(run, aim, camera); }

function updateEntities(dt, distance, playing, previousDistance = distance) {
  for (const c of chunks.values()) {
    placeOnWorld(c.visual, 0, c.start, 0, distance);
    for (const p of c.props || []) {
      p.visual.visible = p.active && !c.combatClear; placeOnWorld(p.visual, p.x, p.s, p.y, distance);
      if (playing && p.active && !c.combatClear && Math.abs(p.s - distance) < p.radius && Math.hypot(p.x - run.x, p.y - run.altitude) < p.radius + .6) hurt();
    }
    for (const p of c.pickups) {
      if (!p.active) continue;
      const ahead = p.s - distance;
      if (playing && ahead < 17 && ahead > -3) {
        const range = (p.kind === 'gold' ? 2.8 : 3.5) + run.spells.magnet * 1.3;
        const d = Math.hypot(p.x - run.x, p.y - run.altitude, ahead);
        if (run.spells.magnet && d < 8 + run.spells.magnet * 2) { p.x = lerp(p.x, run.x, dt * 5); p.y = lerp(p.y, run.altitude, dt * 5); }
        if (d < range) {
          p.active = false; p.visual.visible = false;
          if (p.kind === 'gold') { award(run, 15, 2, false); if (run.chain) run.chainTimer = Math.max(run.chainTimer, 3); sound.collect(); }
          else battle.collect(run, p.kind);
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
    for (const e of c.enemies) battle.updateEnemy(e, dt, distance, run, playing, globalTime);
    if (playing && !raceAttempt && !c.combatClear) for (const o of c.obstacles) {
      if (intersectsObstacle(run, o)) hurt();
      else if (!o.near && nearObstacle(run, o)) { o.near = true; run.nearMisses++; award(run, 70, 9); notify('Silk-thin escape · +skyfire', 1.1); sound.collect(); }
    }
  }
  if (playing && !raceAttempt) battle.update(dt, run, previousDistance);
  if (playing && !raceAttempt && !battle.boss && !chunks.get(Math.floor(distance / CHUNK))?.combatClear && hitsPassage(run)) hurt();
}
function updateParticles(dt, distance) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]; p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.s += p.vs * dt; p.vy -= 3 * dt;
  }
  particleMesh.count = particles.length;
  particles.forEach((p, i) => { placeOnWorld(particleTransform, p.x, p.s, p.y, distance); particleTransform.scale.setScalar(p.life * .22); particleTransform.rotation.z = globalTime * 3; particleTransform.updateMatrix(); particleMesh.setMatrixAt(i, particleTransform.matrix); particleMesh.setColorAt(i, particleColor.set(p.color)); });
  particleMesh.instanceMatrix.needsUpdate = true; if (particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true;
}
function updateAtmosphere(dt, distance) {
  const z = ZONES[raceAttempt ? raceAttempt.course.zone : zoneAt(distance)], cycle = state === 'menu' ? .14 : run.time / 150 + .14;
  const daylight = (Math.sin(cycle * Math.PI * 2) + 1) / 2, night = 1 - THREE.MathUtils.smoothstep(daylight, .12, .6);
  const conditions = weatherAt(state === 'menu' ? 0 : run.time, z.type);
  const { sand, rain: raining, storm, wind } = conditions;
  audioEnvironment = { zone: z.type, altitude: state === 'menu' ? 8 : run.altitude, speed: run.speed, night, rain: raining, sand, boost: run.boost, wind };
  const skyTop = new THREE.Color(z.sky).lerp(new THREE.Color('#407677'), .32).lerp(new THREE.Color('#202d55'), night);
  const horizon = new THREE.Color(z.fog).lerp(new THREE.Color('#eba777'), (1 - Math.abs(daylight * 2 - 1)) * .26).lerp(new THREE.Color('#646086'), night);
  if (sand) horizon.lerp(new THREE.Color('#c79562'), .72);
  if (raining) skyTop.lerp(new THREE.Color('#40536a'), storm ? .8 : .5);
  sky.uniforms.top.value.lerp(skyTop, dt * .5); sky.uniforms.bottom.value.lerp(horizon, dt * .5); scene.fog.color.lerp(horizon, dt * .5);
  scene.fog.far = lerp(scene.fog.far, sand ? 200 : storm ? 250 : raining ? 340 : 480, dt * .3);
  planetMaterial.color.lerp(new THREE.Color(z.ground), dt * .5);
  const enclosed = !raceAttempt && !battle.boss && passageAt(distance);
  caveLight.intensity = lerp(caveLight.intensity, enclosed ? 45 : 0, 1 - Math.exp(-dt * 4));
  placeOnWorld(caveLight, run.x * .35, distance + 15, 15, distance);
  sunlight.position.y = 65 + elevationAt(distance); sunlight.target.position.y = elevationAt(distance);
  ambient.intensity = lerp(ambient.intensity, enclosed ? .48 : 1.05 - night * .28, dt * 2); sunlight.intensity = lerp(sunlight.intensity, enclosed ? .45 : 1.85 - night * .85, dt * 2);
  sunlight.color.lerp(new THREE.Color(night > .5 ? '#b5c9fa' : '#ffe1b1'), dt * .5);
  sky.sun.visible = night < .7; sky.moon.visible = night > .2; sky.stars.material.opacity = night * .8;
  sky.sun.position.y = 35 + daylight * 115; sky.clouds.rotation.y += dt * (wind * .016);
  sky.lanterns.children.forEach((lantern, i) => { lantern.position.y = lantern.userData.baseY + Math.sin(globalTime * .3 + i) * 2; lantern.rotation.z = Math.sin(globalTime * .5 + i) * .07; });
  if (weatherField.update(globalTime, distance, state === 'menu' ? 0 : run.x, state === 'menu' ? 8 : run.altitude, z.type, conditions)) sound.thunder();
  weatherField.leaves.visible = weatherField.rain.visible = weatherField.sand.visible = !enclosed;
  weatherField.rain.visible &&= conditions.rain; weatherField.sand.visible &&= conditions.sand;
  sunlight.intensity += weatherField.flash * dt * 12;
  return `${night > .6 ? '☾ MOONLIT' : daylight > .85 ? '✦ DAYLIGHT' : '✦ GOLDEN HOUR'} · ${sand ? 'SANDSTORM' : storm ? 'THUNDERSTORM' : raining ? 'DRIVING RAIN' : wind > .5 ? 'SWIRLING WINDS' : 'CLEAR SKIES'}`;

}
function updateCarpet(dt, playing) {
  const x = state === 'menu' ? 8 : run.x, altitude = state === 'menu' ? 7 + Math.sin(globalTime * .8) * .5 : run.altitude;
  carpet.root.position.set(x, altitude + elevationAt(state === 'menu' ? menuDistance : run.distance) - x * x / (2 * RADIUS), 0);
  const rollProgress = 1 - run.roll / .85;
  const rollAngle = run.roll > 0 ? rollProgress * rollProgress * (3 - 2 * rollProgress) * Math.PI * 2 * run.rollDirection : 0;
  carpet.body.rotation.z = lerp(carpet.body.rotation.z, clamp(-run.vx * .015, -.7, .7) - x / RADIUS, 1 - Math.exp(-18 * dt));
  // Roll has a separate axis transform so ending at 2π never snaps the bank.
  carpet.root.rotation.z = rollAngle; carpet.body.rotation.x = lerp(carpet.body.rotation.x, run.vy * .018, 1 - Math.exp(-16 * dt));
  carpet.body.rotation.y = lerp(carpet.body.rotation.y, clamp(-run.vx * .009, -.45, .45), 1 - Math.exp(-16 * dt));
  carpet.root.visible = !(playing && run.invulnerable > 0 && Math.floor(globalTime * 12) % 3 === 0);
  const pos = carpet.fabric.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) { const px = pos.getX(i), pz = pos.getZ(i); pos.setY(i, Math.sin(pz * 1.7 + globalTime * 5) * .075 + Math.pow(Math.abs(pz) / 2.65, 5) * (.22 + Math.sin(globalTime * 4) * .08) + Math.pow(Math.abs(px) / 1.85, 4) * .08); }
  pos.needsUpdate = true; carpet.fabric.geometry.computeVertexNormals(); carpet.scarf.rotation.x = Math.sin(globalTime * 8) * .2;
  carpet.shadow.position.set(x, .12 + elevationAt(state === 'menu' ? menuDistance : run.distance) - x * x / (2 * RADIUS), 0); carpet.shadow.scale.setScalar(1 + altitude * .035); carpet.shadow.material.opacity = clamp(.23 - altitude * .004, .06, .23);
  particleClock += playing ? dt : 0;
  if (playing && particleClock >= 1 / 35) {
    particleClock %= 1 / 35;
    const color = run.railing ? '#b1ffda' : run.boost ? '#a4e9e0' : '#edbf78';
    particleBurst(x + (Math.random() - .5) * 2.7, altitude - .15, run.distance - 2.3, color, run.boost ? 2 : 1);
  }
}
function updateTrails(dt, distance, playing) {
  if (playing) {
    trailClock += dt;
    if (trailClock >= 1 / 60) { trailClock %= 1 / 60; trailHistory.unshift({ x: run.x, y: run.altitude, s: distance - 2.4 }); if (trailHistory.length > 32) trailHistory.pop(); }
  }
  for (const t of trails) {
    t.visual.visible = trailHistory.length > 2 && state !== 'menu';
    if (!t.visual.visible) continue;
    t.visual.material.opacity = run.boost ? .72 : .22;
    for (let i = 0; i < 32; i++) {
      const point = trailHistory[Math.min(i, trailHistory.length - 1)], fade = 1 - i / 31;
      placeOnWorld(particleTransform, point.x + t.side * 1.5, point.s, point.y, distance);
      const width = (run.boost ? .22 : .1) * fade;
      for (let edge = 0; edge < 2; edge++) {
        const n = i * 6 + edge * 3;
        t.positions[n] = particleTransform.position.x + (edge ? width : -width); t.positions[n + 1] = particleTransform.position.y; t.positions[n + 2] = particleTransform.position.z;
        t.colors[n] = fade * (run.boost ? .6 : 1); t.colors[n + 1] = fade * .9; t.colors[n + 2] = fade * (run.boost ? 1 : .5);
      }
    }
    t.visual.geometry.attributes.position.needsUpdate = true; t.visual.geometry.attributes.color.needsUpdate = true;
  }
}
function updateCamera(dt) {
  if (state === 'menu') { goalPosition.set(11 + Math.sin(globalTime * .08) * 3, 26, 48); goalLook.set(-19, 1, -35); }
  else {
    const curvature = run.x * run.x / (2 * RADIUS) - elevationAt(run.distance);
    const cameraHeight = !raceAttempt && !battle.boss && passageAt(run.distance) ? Math.min(28, 7.5 + run.altitude * .82) : 7.5 + run.altitude * .82;
    goalPosition.set(run.x * .96 + 1.2, cameraHeight - curvature, run.boost ? 23 : 22);
    goalLook.set(run.x + run.vx * .12, 1.5 + run.altitude * .72 - curvature, -45);
  }
  const follow = state === 'menu' ? 4 : 10;
  camera.position.lerp(goalPosition, 1 - Math.exp(-dt * follow)); currentLook.lerp(goalLook, 1 - Math.exp(-dt * follow)); camera.lookAt(currentLook);
  if (state === 'playing') { camera.position.x += Math.sin(globalTime * 77) * battle.shake * .35; camera.position.y += Math.cos(globalTime * 91) * battle.shake * .25; }
  camera.fov = lerp(camera.fov, state === 'menu' ? 49 : run.boost ? 78 : 60 + clamp((run.speed - 40) * .2, 0, 10), 1 - Math.exp(-dt * 5)); camera.updateProjectionMatrix();
}
function updateUI(weather) {
  updateAudioUI();
  $('weather').textContent = weather; $('zone-name').textContent = raceAttempt ? `${raceAttempt.course.name} · Ghost race` : ZONES[zoneAt(state === 'menu' ? menuDistance : run.distance)].name;
  if (state !== 'playing') return;
  $('distance').textContent = Math.floor(run.distance).toLocaleString(); $('score').textContent = Math.floor(run.score).toLocaleString();
  $('hearts').textContent = Array.from({ length: 3 }, (_, i) => i < run.hp ? '♥' : '♡').join(' '); $('hearts').setAttribute('aria-label', `${run.hp} health`);
  $('combo').textContent = `×${multiplier(run)}`; $('combo-label').textContent = run.chain ? `${run.chain} MOMENTS OF MAGIC` : 'FIND YOUR FLOW'; $('combo-bar').style.width = `${run.chainTimer / 5 * 100}%`;
  $('power-bar').style.width = `${run.power}%`; $('power-value').textContent = `${Math.floor(run.power)}%`; $('power-hint').textContent = run.boost ? 'Skyfire flowing · keep the chain alive' : run.power >= 25 ? 'Hold SHIFT to ride the skyfire' : 'Skim low to gather power';
  $('speed-value').textContent = Math.round(run.speed * 3.6 * (raceAttempt ? 1 : ADVENTURE_TIME_SCALE)); $('altitude').textContent = `${run.vy > 1 ? '↑ ' : run.vy < -1 ? '↓ ' : ''}${run.altitude.toFixed(1)} m above ground`;
  $('flight-mode').textContent = run.boost ? '✦ SKYFIRE ASCENDANT' : run.railing ? '✦ CLIFF RIDER · +SPEED' : run.altitude < 3.5 ? '✦ GROUND EFFECT' : run.roll ? '✧ SILK SPIRAL' : 'RIDE THE WIND';
  const zone = zoneAt(run.distance), progress = (run.distance % ZONE_LENGTH) / ZONE_LENGTH;
  $('zone-progress').style.width = `${progress * 100}%`;
  const balance = balanceAt(run.distance);
  $('journey-stage').textContent = balance.respite > .6 ? 'CATCH YOUR BREATH' : balance.stage;
  $('next-zone').textContent = `${Math.ceil(ZONE_LENGTH - run.distance % ZONE_LENGTH)} m to ${ZONES[(zone + 1) % ZONES.length].name}`;
  $('combat-buffs').textContent = Object.entries(run.buffs).filter(([, t]) => t > 0).map(([kind, t]) => SPELLS[kind].name.toUpperCase() + ' ' + Math.ceil(t) + 's').join('  ·  ');
  $('active-spell').textContent = SPELLS[run.weapon].name.toUpperCase() + ' · LV ' + run.spells[run.weapon] + ' · 1 / 2 / 3 OR Q';
  const nextRail = cliffRailAt(run.distance + 140), railPhrase = Math.floor((run.distance + 140) / 2560);
  const passage = !raceAttempt && passageAt(run.distance + 200);
  if (passage && !battle.boss && run.passageNotified !== passage.start) { run.passageNotified = passage.start; notify('CLIFF PASSAGE AHEAD · CENTER UP · BELOW 30m', 4, 4); }
  if (nextRail && !raceAttempt && !battle.boss && run.railNotified !== railPhrase) {
    run.railNotified = railPhrase;
    notify(`CLIFF RAIL AHEAD · ${nextRail.side > 0 ? 'RIGHT' : 'LEFT'} EDGE · SKIM AT 6–46m`, 4, 2);
  }
  $('roll-ready').textContent = run.roll ? '✧ ROLLING' : run.rollCooldown > 0 ? `ROLL · ${run.rollCooldown.toFixed(1)}s` : run.altitude < 4 ? 'ROLL · CLIMB TO 4m' : 'SPACE · ROLL READY';
  document.body.classList.toggle('boosting', run.boost);
  $('crosshair').classList.toggle('locked', !!battle.lock(run, aim, camera));
}

ensureChunks(menuDistance, run.seed); camera.position.set(11, 26, 48); camera.lookAt(-19, 1, -35);
let firstFrame = true;
function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, .09); lastTime = now;
  const frozen = state === 'paused' || !$('help-screen').hidden;
  const timeScale = raceAttempt || state === 'menu' || state === 'race-setup' ? 1 : ADVENTURE_TIME_SCALE;
  const worldDt = frozen ? 0 : dt * timeScale; globalTime += worldDt;
  const playing = state === 'playing';
  if (playing) {
    const steer = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    const lift = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
    const input = { steer, lift, controlRate: 1 / timeScale, boost: keys.has('ShiftLeft') || keys.has('ShiftRight'), roll: keys.has('Space'), arena: !!battle.boss || !!chunks.get(Math.floor(run.distance / CHUNK))?.combatClear };
    accumulator = Math.min(accumulator + dt * timeScale, STEP * 8);
    while (accumulator >= STEP && !run.ended && state === 'playing') {
      const previousDistance = run.distance;
      if (raceAttempt) {
        raceStep(input);
        if (raceAttempt.countdown === 0 && state === 'playing') { if (shootHeld) fire(); battle.update(STEP, run, previousDistance, true); }
      }
      else {
        updateRun(run, input, STEP);
        if (shootHeld) fire();
        updateEntities(STEP, run.distance, true, previousDistance);
      }
      accumulator -= STEP;
    }
    while (run.events.length) { const event = run.events.pop(); notify(event === 'rail' ? 'CLIFF RIDER · +45 · +SKYFIRE' : `Silk spiral · +${90 * multiplier(run)} · +11 skyfire`, 1.2); if (event !== 'rail') sound.trick(); }
    const nextZone = zoneAt(run.distance); if (!raceAttempt && nextZone !== lastZone) { lastZone = nextZone; banner(lastZone); }
  }
  const distance = state === 'menu' ? menuDistance : run.distance;
  ensureChunks(distance, run.seed);
  // Refresh placement after streaming even if this display frame had no simulation step.
  updateEntities(0, distance, false); updateParticles(worldDt, distance); updateCarpet(worldDt, playing); updateTrails(worldDt, distance, playing); updateCamera(frozen ? 0 : dt);
  raceView.update(raceAttempt); updateRaceUI();
  const weather = updateAtmosphere(worldDt, distance);
  blood.update(worldDt, distance); battle.render(worldDt, distance, globalTime);
  magic.update(worldDt, globalTime, distance, run, bullets, audioEnvironment, playing);
  sound.update(dt, { ...audioEnvironment, running: playing, paused: frozen || document.hidden || !windowFocused, keepAmbience: !document.hidden && (!!raceAttempt || state === 'race-setup') });
  if (toastTime > 0) { toastTime -= worldDt; if (toastTime <= 0) $('toast').classList.remove('show'); }
  if (bannerTime > 0) { bannerTime -= worldDt; if (bannerTime <= 0) $('zone-banner').classList.remove('show'); }
  if (flashTime > 0) { flashTime -= dt; if (flashTime <= 0) $('damage-flash').style.opacity = '0'; }
  if (hitTime > 0) { hitTime -= worldDt; if (hitTime <= 0) $('crosshair').classList.remove('hit'); }
  uiClock += dt; if (uiClock >= .1) { updateUI(weather); uiClock = 0; }
  ink.render(scene, camera);
  if (firstFrame) { firstFrame = false; $('loading').style.opacity = '0'; setTimeout(() => $('loading').hidden = true, 650); }
  if (playing && !raceAttempt && run.ended) { state = 'dying'; deathTime = .85; shootHeld = false; $('crosshair').hidden = true; sound.death(); blood.burst(run.x, run.altitude + 1, run.distance, 46); }
  if (state === 'dying') { deathTime -= worldDt; carpet.body.rotation.z += (1 - deathTime / .85) * .6; if (deathTime <= 0) finish(); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
