import { magmaMaterial } from './magma.js';
import * as THREE from 'three';
import { gauntletNear, gauntletRows, GAUNTLET_NAMES, axePose, gatePose, gateSolids } from './gauntlets.js';
import { mesh, mat, shapeGeometry, placeOnTerrain } from './world.js';
import { movementHitsSolid } from './collision.js';

const cube=new THREE.BoxGeometry(1,1,1), cylinder=new THREE.CylinderGeometry(1,1,1,8);
const blade=shapeGeometry('axe'), rightBlade=shapeGeometry('axeRight'), blob=new THREE.IcosahedronGeometry(1,1);
const ring=new THREE.TorusGeometry(1,.10,5,24);
export class GauntletField {
  constructor(scene,hooks={}) {this.scene=scene;this.hooks=hooks;this.rows=new Map();this.trap=null;this.warned=-1;this.completed=-1;this.solids=[];this.dangers=[];}
  clear() {for(const row of this.rows.values())this.scene.remove(row.root);this.rows.clear();this.trap=null;this.warned=this.completed=-1;this.solids=[];this.dangers=[];}
  build(row,type) {
    const root=new THREE.Group();root.name=`${type} gauntlet ${row.id}`;this.scene.add(root);
    const entry={...row,type,root,trigger:null};
    if(type==='axes') {
      const rig=new THREE.Group();root.add(rig);entry.rig=rig;
      mesh(cylinder,'#596979',rig,[0,-12,0],[.38,24,.38]);
      mesh(blade,'#abc5d1',rig,[0,-24,0],[16,14,2.5]);
      mesh(rightBlade,'#abc5d1',rig,[0,-24,0],[16,14,2.5]);
      mesh(cylinder,'#ddb684',rig,[0,-24,0],[.75,6,.75]);
      mesh(cube,'#51475d',root,[0,1,0],[54,2,4]);
      mesh(ring,'#ffb567',root,[0,0,2],[1.3,1.3,1],[0,0,0],true);
      entry.trace=mesh(ring,'#dc7469',root,[0,-22,0],[7,5,1],[0,0,0],true);
    } else if(type==='gates') {
      entry.blocks=Array.from({length:4},()=>mesh(cube,'#817288',root));
      entry.frame=new THREE.Group();root.add(entry.frame);
      for(const side of [-1,1]) {mesh(cube,'#b4ffe0',entry.frame,[side*10,0,2],[.3,19,.4],[0,0,0],true);mesh(cube,'#b4ffe0',entry.frame,[0,side*9.5,2],[20,.3,.4],[0,0,0],true);}
      mesh(cube,'#493c56',root,[0,33,0],[58,3,5]);
      for(const x of [-25,25])mesh(ring,'#d7ac76',root,[x,16,2],[2,2,1],[0,0,0],true);
    } else {
      entry.vents=[-18,0,18].map(x=>mesh(ring,'#ff8636',root,[x,2.5,0],[4,4,4],[Math.PI/2,0,0],true));
      entry.plume=mesh(cylinder,'#ff7138',root,[0,1,0],[1,1,1],[0,0,0],true);
      entry.balls=Array.from({length:3},()=>mesh(blob,'#ffb457',root,[0,-10,0],[2.7,2.7,2.7],[0,0,0],true));
      entry.warning=mesh(ring,'#fff29c',root,[0,1,0],[4,4,4],[Math.PI/2,0,0],true);
    }
    return entry;
  }
  update(run,enabled=true,playing=true) {
    this.solids=[];this.dangers=[];magmaMaterial.uniforms.time.value=run.time;
    const trap=enabled?gauntletNear(run.distance,360):null;
    if(this.trap&&run.distance>=this.trap.end&&this.completed!==this.trap.id&&playing) {
      this.completed=this.trap.id;this.hooks.complete?.(this.trap);
    }
    if(!trap||this.trap?.id!==trap.id) {for(const row of this.rows.values())this.scene.remove(row.root);this.rows.clear();}
    this.trap=trap;if(!trap)return;
    if(this.warned!==trap.id&&playing) {this.warned=trap.id;this.hooks.warn?.(GAUNTLET_NAMES[trap.type],trap.type);}
    for(const row of gauntletRows(trap)) {
      const ahead=row.s-run.distance;
      if(ahead< -80||ahead>420) {const old=this.rows.get(row.id);if(old){this.scene.remove(old.root);this.rows.delete(row.id);}continue;}
      let v=this.rows.get(row.id);if(!v){v=this.build(row,trap.type);this.rows.set(row.id,v);}
      if(trap.type==='axes') {
        const p=axePose(row,run.time);placeOnTerrain(v.root,0,row.s,p.pivot,run.distance);v.rig.rotation.z=p.angle;
        v.trace.position.set(p.x,p.y-p.pivot,0);v.trace.scale.set(7+Math.sin(run.time*8)*.3,5,1);
        for(const shape of ['axe','axeRight'])this.solids.push({shape,x:p.x,s:row.s,bottom:p.y-7,width:16,height:14,depth:2.5,roll:p.angle,flatBase:true});
      } else if(trap.type==='gates') {
        placeOnTerrain(v.root,0,row.s,0,run.distance);
        const blocks=gateSolids(row,run.time),p=gatePose(row,run.time);
        blocks.forEach((o,i)=>{v.blocks[i].position.set(o.x,o.bottom+o.height/2,0);v.blocks[i].scale.set(o.width,o.height,o.depth);});
        v.frame.position.set(p.x,p.y,0);this.solids.push(...blocks);
      } else {
        placeOnTerrain(v.root,0,row.s,0,run.distance);
        if(v.trigger===null&&playing&&ahead<Math.max(145,run.speed*1.7)&&ahead>0) {
          v.trigger=run.time;v.target=[-18,0,18].reduce((a,b)=>Math.abs(a-run.x)<Math.abs(b-run.x)?a:b);this.hooks.erupt?.();
        }
        const age=v.trigger===null?-1:run.time-v.trigger;
        const warning=age>=0&&age<1.05,active=age>=1.05&&age<3.1;
        v.warning.visible=warning;v.warning.position.set(v.target||0,2.8,0);v.warning.scale.setScalar(4+(warning?age:0)*3);
        v.plume.visible=active;
        if(active) {
          const h=27*Math.min(1,(age-1.05)/.25,(3.1-age)/.4);v.plume.position.set(v.target,h/2,0);v.plume.scale.set(3.5,h,3.5);
          if(h>.1)this.dangers.push({shape:'pillar',x:v.target,s:row.s,bottom:0,width:7,height:h,depth:7,flatBase:true});
        }
        v.balls.forEach((ball,i)=>{
          const t=age-1.05-i*.13,y=2+38*t-16*t*t;
          ball.visible=t>=0&&t<2.5&&y>0;
          if(ball.visible) {
            const x=v.target+(i-1)*5*t,ds=-22*t;
            // Each lava blob stays in world space after launch, never homes on the rider.
            placeOnTerrain(ball,x,row.s+ds,y,run.distance);v.root.updateMatrixWorld(true);v.root.worldToLocal(ball.position);ball.rotation.set(0,0,0);
            this.dangers.push({shape:'pillar',x,s:row.s+ds,bottom:y-2.4,width:4.8,height:4.8,depth:4.8});
          }
        });
      }
    }
    if(trap.type==='volcano'&&run.distance>=trap.start) this.dangers.push({x:0,s:(trap.start+trap.end)/2,bottom:-1,width:34,height:3,depth:trap.end-trap.start,flatBase:true});
  }
  hits(previous,run) {return movementHitsSolid(previous,run,this.dangers);}
}
