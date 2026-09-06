import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRun, collectSpell, award, generateChunk, ZONES, paletteAt } from '../src/game.js';
import { toggleFocus, tickFocus, spotAmbush } from '../src/focus.js';
import { tickBuffs } from '../src/combat.js';
import { createCourse, createAttempt, stepRace } from '../src/race.js';
import { createCarpet, animateRider, createPickup, createEnemy, createChunkVisual, disposeChunk, placeOnTerrain } from '../src/world.js';
import { Battle, orientShot } from '../src/battle.js';
import { ambientProfile } from '../src/ambience.js';

test('Hourglass toggles, drains in real seconds, caps rewards and cannot be used empty', () => {
  for(const hz of [30,90,144]) {
    const r=createRun(); r.focus=100; assert.equal(toggleFocus(r),true);
    for(let i=0;i<hz*4;i++) assert.equal(tickFocus(r,1/hz),.28);
    assert.ok(Math.abs(r.focus-50)<.001);
    assert.equal(toggleFocus(r),true); const saved=r.focus; tickFocus(r,1); assert.equal(r.focus,saved);
    toggleFocus(r); for(let i=0;i<hz*5;i++) tickFocus(r,1/hz);
    assert.equal(r.focus,0); assert.equal(r.slow,false); assert.equal(toggleFocus(r),false);
    award(r,90,11); assert.ok(r.focus>0); for(let i=0;i<100;i++) award(r,90,11); assert.equal(r.focus,100);
  }
});
test('ambush sense has a real-time cooldown and a limited reserve cost', () => {
  const r=createRun(), initial=r.focus;
  assert.equal(spotAmbush(r),true); assert.equal(r.focus,initial-5);
  assert.equal(spotAmbush(r),false); assert.equal(tickFocus(r,.1),.48);
  assert.equal(tickFocus(r,.5),1); assert.equal(spotAmbush(r),false);
  tickFocus(r,9); assert.equal(spotAmbush(r),true);
  r.focus=0; tickFocus(r,9); assert.equal(spotAmbush(r),false);
});
test('race time and ghost recording stay in real seconds while movement is slowed', () => {
  const normal=createAttempt(createCourse('easy',42),0), slow=createAttempt(normal.course,1);
  for(const a of [normal,slow]) { a.countdown=0; a.collisionChunks.forEach(c=>{c.obstacles=[];c.props=[];}); }
  for(let i=0;i<90;i++) stepRace(normal,{steer:0,lift:0},1/90);
  for(let i=0;i<90;i++) stepRace(slow,{steer:0,lift:0,clockRate:1/.28},.28/90);
  assert.ok(Math.abs(normal.elapsed-slow.elapsed)<1e-8); assert.ok(slow.run.distance<normal.run.distance*.5);
  assert.ok(slow.samples.at(-1)[0]>.9);
});
test('temporary magnets refresh and expire, hearts heal, and scheduled magnets are four times as frequent', () => {
  const r=createRun(); collectSpell(r,'magnet'); assert.equal(r.magnetTime,18);
  tickBuffs(r,10); collectSpell(r,'magnet'); assert.equal(r.magnetTime,26); assert.equal(r.spells.magnet,2);
  collectSpell(r,'magnet'); assert.equal(r.magnetTime,32); tickBuffs(r,32); assert.equal(r.spells.magnet,0);
  r.hp=1; collectSpell(r,'heart'); assert.equal(r.hp,2); collectSpell(r,'heart'); collectSpell(r,'heart'); assert.equal(r.hp,3);
  for(const i of [6,18,30,42]) assert.ok(generateChunk(i,42).pickups.some(p=>p.kind==='magnet'));
  assert.ok(generateChunk(5,42).pickups.some(p=>p.kind==='heart'));
});
test('surfing rider has bounded animated hair that lengthens with speed and power', () => {
  const c=createCarpet(), r=createRun(); assert.ok(c.body.scale.x<1); assert.ok(Math.abs(c.rider.rotation.y)>1);
  r.speed=30; r.power=0; animateRider(c,r,0,2); const short=c.strands[8].bead.position.distanceTo(c.strands[8].anchor);
  r.speed=125; r.power=100; r.boost=true; animateRider(c,r,1,2);
  assert.ok(c.strands[8].bead.position.distanceTo(c.strands[8].anchor)>short*2);
  assert.equal(c.strands.length,12);
  c.root.updateMatrixWorld(); c.root.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));
  for(const kind of ['heart','ward','rapid','fire','fury','storm','wind','frost','echo','focus','overdrive','magnet']) {
    const p=createPickup(kind); p.updateMatrixWorld(); assert.ok(p.children.length>=2); p.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));
  }
});
test('all new biomes render finite geometry, select ambience and produce stable changing palettes', () => {
  assert.equal(ZONES.length,13); const names=new Set();
  for(let zone=7;zone<ZONES.length;zone++) {
    const c=generateChunk(zone*20+3,42), visual=createChunkVisual(c,42);
    names.add(ZONES[zone].type); visual.traverse(o=>{if(o.isMesh)assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));}); disposeChunk(visual);
    assert.equal(ambientProfile({zone:ZONES[zone].type}).length,3);
  }
  assert.equal(names.size,6); assert.deepEqual(paletteAt(1280,42),paletteAt(1300,42)); assert.notDeepEqual(paletteAt(1280,42),paletteAt(17920,42));
  const giants=[]; for(let i=160;i<180;i++) giants.push(...generateChunk(i,42).enemies.filter(e=>e.kind==='giant'));
  assert.ok(giants.length>0); assert.ok(createEnemy('giant').scale.x>=3);
  const props=[]; for(let i=9;i<100;i++) props.push(...generateChunk(i,42).props.filter(p=>p.large));
  assert.ok(props.length>10); assert.ok(props.every(p=>p.radius>6&&p.y>=7&&p.scale>2));
});

function arena() {
  const scene=new THREE.Scene(), chunks=new Map([[0,{enemies:[],props:[]}]]), shots=[], bullets=[], run=createRun(); run.altitude=10; run.speed=60;
  const calls={hurt:0,parry:0};
  const sound=Object.fromEntries(['spell','impact','kill','roar','trick'].map(k=>[k,()=>{}]));
  const battle=new Battle(scene,chunks,bullets,shots,{sound,blood:{burst(){}},particles(){},notify(){},hit(){},hurt(){calls.hurt++;},parried(){calls.parry++;},tray(){},bossUI(){},arena(){}});
  const enemy={kind:'bandit',active:true,x:40,y:10,s:60,hp:20,maxHp:20,radius:2,visual:createEnemy('bandit')}; scene.add(enemy.visual); chunks.get(0).enemies.push(enemy);
  const camera=new THREE.PerspectiveCamera(60,1.6,.2,1000);camera.position.set(0,13,22);camera.lookAt(0,10,-80);camera.updateMatrixWorld();
  return {scene,chunks,shots,bullets,run,battle,enemy,camera,calls};
}
test('arrowheads follow actual world velocity from either side, above and behind the carpet', () => {
  const h=arena();
  for(const [x,s,y] of [[40,50,2],[-40,50,30],[40,-20,20]]) {
    Object.assign(h.enemy,{x,s,y}); h.battle.launch(h.enemy,[{x:0,y:10,s:0}],h.run,78);
    const p=h.shots.at(-1); orientShot(p,0);
    const next=new THREE.Object3D();placeOnTerrain(next,p.x+p.vx*.01,p.s+p.vs*.01,p.y+p.vy*.01,0);
    const expected=next.position.sub(p.visual.position).normalize(), forward=new THREE.Vector3(0,0,-1).applyQuaternion(p.visual.quaternion);
    assert.ok(forward.dot(expected)>.99999);
  }
});
test('a precisely aimed late click returns a hostile shot; misses cannot parry and reflected shots hurt enemies only', () => {
  const h=arena(); h.battle.launch(h.enemy,[{x:0,y:10,s:0}],h.run,78);
  const p=h.shots[0];Object.assign(p,{x:0,y:10,s:12,vx:0,vy:0,vs:-90,gravity:0});orientShot(p,0);
  const screen=p.visual.position.clone().project(h.camera);
  assert.equal(h.battle.parry(h.run,{x:screen.x+.8,y:screen.y},h.camera),false);
  assert.equal(h.battle.parry(h.run,screen,h.camera),true);assert.equal(p.friendly,true);assert.equal(h.calls.parry,1);
  for(let i=0;i<90;i++)h.battle.update(1/90,h.run,0);
  assert.ok(h.enemy.hp<20);assert.equal(h.calls.hurt,0);
});
test('wind remotely reflects hostile projectiles without needing a perfect parry window', () => {
  const h=arena(); h.run.weapon='wind'; h.battle.launch(h.enemy,[{x:0,y:10,s:0}],h.run,78);
  Object.assign(h.shots[0],{x:0,y:11,s:30,vx:0,vy:0,vs:-30,gravity:0});
  h.battle.lock=()=>({x:0,y:11,s:100});h.battle.fire(h.run,{x:0,y:0},h.camera);
  for(let i=0;i<12;i++)h.battle.update(1/90,h.run,0);
  assert.ok(h.shots.some(p=>p.friendly));assert.equal(h.calls.parry,0);assert.equal(h.calls.hurt,0);
});
