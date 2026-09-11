// Deterministic cave gauntlets: long approaches, then increasingly frequent runs.
export const GAUNTLET_LENGTH = 1024;
export const GAUNTLET_TYPES = ['axes', 'volcano', 'gates'];
export const GAUNTLET_NAMES = { axes: 'THE PENDULUM VAULT', volcano: 'THE MOLTEN ARTERY', gates: 'THE SHIFTING SEALS' };
const starts=[25600];
while(starts.at(-1)<95600) {
  const last=starts.at(-1), spacing=Math.max(2560,7168-Math.floor((last-25600)/14000)*1024);
  starts.push(last+spacing);
}
const tail=starts.at(-1);
export function gauntletNear(distance, ahead=0) {
  if(distance<starts[0]-ahead) return null;
  let index;
  if(distance>=tail) index=starts.length-1+Math.floor((distance-tail)/2560);
  else {index=starts.findIndex(s=>s>distance)-1; if(index<0)index=0;}
  for(let i=Math.max(0,index);i<=index+1;i++) {
    const start=i<starts.length?starts[i]:tail+(i-starts.length+1)*2560;
    if(distance>=start-ahead&&distance<start+GAUNTLET_LENGTH) return {id:i,start,end:start+GAUNTLET_LENGTH,type:GAUNTLET_TYPES[i%3]};
  }
  return null;
}
export const gauntletAt = distance => gauntletNear(distance);
export function gauntletRows(trap) {
  return Array.from({length:8},(_,i)=>({id:i,s:trap.start+128+i*112,phase:i*1.13}));
}
export function axePose(row,time) {
  const angle=Math.sin(time*1.45+row.phase)*1.02;
  const pivot=row.id%2?45:32;
  return {angle,pivot,x:Math.sin(angle)*24,y:pivot-Math.cos(angle)*24};
}
export function gatePose(row,time) {
  return {x:Math.sin(time*.68+row.phase)*11,y:15+Math.sin(time*.51+row.phase)*4,width:20,height:19};
}
export function gateSolids(row,time) {
  const p=gatePose(row,time),left=p.x-p.width/2,right=p.x+p.width/2,low=p.y-p.height/2,high=p.y+p.height/2;
  return [{x:(-29+left)/2,bottom:0,width:left+29,height:32},{x:(right+29)/2,bottom:0,width:29-right,height:32}, {x:p.x,bottom:0,width:p.width,height:low},{x:p.x,bottom:high,width:p.width,height:32-high}].map(o=>({...o,s:row.s,depth:3,flatBase:true}));
}
