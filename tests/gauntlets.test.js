import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRun, generateChunk } from '../src/game.js';
import { obstacleParts, SHAPES, hullPlanes } from '../src/obstacle-shapes.js';
import { movementHitsSolid, resolveSolidMovement } from '../src/collision.js';
import { gauntletAt, gauntletNear, gauntletRows, gatePose, gateSolids } from '../src/gauntlets.js';
import { GauntletField } from '../src/gauntlet-field.js';
import { passageAt } from '../src/landscape.js';
import { shapeGeometry } from '../src/world.js';
const pose=(x,altitude,distance)=>({x,altitude,distance});

test('convex obstacle silhouettes leave genuine corner, slope and arch clearance',()=>{
  const pyramid={shape:'pyramid',x:0,s:30,width:20,height:20,depth:20};
  assert.ok(movementHitsSolid(pose(0,5,0),pose(0,5,60),[pyramid]));
  assert.equal(movementHitsSolid(pose(8,17,0),pose(8,17,60),[pyramid]),false,'empty upper corner is traversable');
  const wedge={...pyramid,shape:'wedge'};
  assert.equal(movementHitsSolid(pose(-7,12,0),pose(-7,12,60),[wedge]),false,'skim the low side');
  assert.ok(movementHitsSolid(pose(7,12,0),pose(7,12,60),[wedge]));
  const arch=obstacleParts({...pyramid,shape:'arch',width:24,height:28,depth:8});
  assert.equal(movementHitsSolid(pose(0,8,0),pose(0,8,60),arch),false,'fly through the opening');
  assert.ok(movementHitsSolid(pose(10,8,0),pose(10,8,60),arch));
  assert.ok(movementHitsSolid(pose(0,22,0),pose(0,22,60),arch));
  for(const hz of [30,90,144]) {
    const r=Object.assign(createRun(),pose(0,10,0),{vx:0,vy:0,speed:138});
    for(let i=0;i<hz;i++){const before={...r};r.distance+=138/hz;resolveSolidMovement(r,before,[pyramid]);assert.ok(Number.isFinite(r.altitude));}
    assert.equal(movementHitsSolid(r,r,[pyramid]),false);
  }
});

test('rendered convex faces point outward and share finite collision planes',()=>{
  for(const kind of Object.keys(SHAPES)) {
    const geo=shapeGeometry(kind),p=geo.attributes.position,n=geo.attributes.normal;
    assert.ok(geo.attributes.uv);assert.ok(hullPlanes(kind,12,18,10).every(p=>Object.values(p).every(Number.isFinite)));
    for(let i=0;i<p.count;i++)assert.ok([p.getX(i),p.getY(i),p.getZ(i),n.getX(i)].every(Number.isFinite));
    geo.dispose();
  }
  const found=new Set();for(let i=20;i<200;i++)for(const o of generateChunk(i,42).obstacles)found.add(o.shape);
  for(const shape of ['pillar','pyramid','wedge','arch'])assert.ok(found.has(shape));
});

test('three kilometre-long gauntlets start after 25km and recur more frequently',()=>{
  for(let s=0;s<25000;s+=16)assert.equal(gauntletAt(s),null);
  const starts=[];let previous=-1;
  for(let s=25000;s<150000;s+=16){const t=gauntletAt(s);if(t&&t.id!==previous){starts.push(t);previous=t.id;}}
  assert.deepEqual(starts.slice(0,3).map(t=>t.type),['axes','volcano','gates']);
  assert.ok(starts.at(-1).start-starts.at(-2).start<starts[1].start-starts[0].start);
  for(const t of starts){assert.equal(t.end-t.start,1024);for(let s=t.start;s<t.end;s+=64){assert.equal(passageAt(s).type,'gauntlet');const c=generateChunk(s/64,42);assert.equal(c.obstacles.length+c.enemies.length+c.props.length+c.rings.length,0);}}
  assert.equal(gauntletNear(25000,600).start,25600);
});

test('shifting gates always leave a usable opening and block their stone slabs',()=>{
  const row={id:0,s:40000,phase:.4};
  for(let t=0;t<30;t+=.1){const p=gatePose(row,t),solids=gateSolids(row,t);assert.equal(movementHitsSolid(pose(p.x,p.y,row.s-10),pose(p.x,p.y,row.s+10),solids),false);assert.ok(movementHitsSolid(pose(-26,12,row.s-10),pose(-26,12,row.s+10),solids));}
});

test('gauntlet hazards animate in world space, freeze, warn before eruption and clean up',()=>{
  const scene=new THREE.Scene(),calls={warn:0,complete:0};
  const field=new GauntletField(scene,{warn(){calls.warn++;},complete(){calls.complete++;}}),run=createRun();
  for(const start of [25600,32768,39936]) {
    Object.assign(run,{distance:start+10,time:1,speed:90,x:0,altitude:15});field.clear();field.update(run);
    const initial=JSON.stringify(field.solids);field.update(run,true,false);assert.equal(JSON.stringify(field.solids),initial);
    for(let i=0;i<1100;i++) {run.distance+=1;run.time+=1/90;field.update(run);scene.updateMatrixWorld(true);assert.ok(field.rows.size<=5);assert.ok(field.solids.length<=20);assert.ok(field.dangers.length<=21);scene.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));}
    assert.equal(field.rows.size,0);assert.equal(scene.children.length,0);
  }
  assert.equal(calls.complete,3);
  field.clear();Object.assign(run,{distance:32768+10,time:0,speed:90,x:0});field.update(run);
  assert.equal(field.dangers.length,1,'only the magma floor hurts during the warning');
  run.time=.8;field.update(run);assert.equal(field.dangers.length,1);
  run.time=1.7;field.update(run);assert.ok(field.dangers.length>1);
  field.clear();assert.equal(scene.children.length,0);
});
