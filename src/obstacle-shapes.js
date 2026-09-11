// Shared convex silhouettes: rendering and collision use the same vertices.
const prism = polygon => ({ vertices: [-.5, .5].flatMap(z => polygon.map(([x,y]) => [x,y,z])), faces: [polygon.map((_,i)=>i).reverse(), polygon.map((_,i)=>i+polygon.length), ...polygon.map((_,i)=>[i,(i+1)%polygon.length,(i+1)%polygon.length+polygon.length,i+polygon.length])] });
export const SHAPES = {
  wedge: prism([[-.5,0],[.5,0],[.5,1]]),
  axe: prism([[-.5,.12],[-.43,0],[0,.35],[0,.65],[-.43,1],[-.5,.88]]),
  axeRight: prism([[.5,.12],[.43,0],[0,.35],[0,.65],[.43,1],[.5,.88]]),
  pyramid: { vertices: [[-.5,0,-.5],[.5,0,-.5],[.5,0,.5],[-.5,0,.5],[0,1,0]], faces:[[0,3,2,1],[0,1,4],[1,2,4],[2,3,4],[3,0,4]] },
};
const ring = Array.from({length:10},(_,i)=>[Math.cos(i*Math.PI/5)*.5,Math.sin(i*Math.PI/5)*.5]);
SHAPES.pillar = { vertices:[0,1].flatMap(y=>ring.map(([x,z])=>[x,y,z])), faces:[ring.map((_,i)=>i).reverse(),ring.map((_,i)=>i+10),...ring.map((_,i)=>[i,(i+1)%10,(i+1)%10+10,i+10])] };
export function hullPlanes(shape, width, height, depth) {
  const data=SHAPES[shape]; if(!data) return null;
  const vertices=data.vertices.map(([x,y,z])=>[x*width,(y-.5)*height,z*depth]);
  const center=vertices.reduce((sum,v)=>sum.map((n,i)=>n+v[i]/vertices.length),[0,0,0]);
  return data.faces.map(face=>{
    const a=vertices[face[0]], b=vertices[face[1]], c=vertices[face[2]], u=b.map((v,i)=>v-a[i]),v=c.map((n,i)=>n-a[i]);
    let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const length=Math.hypot(...n); n=n.map(x=>x/length);
    let d=n.reduce((sum,x,i)=>sum+x*a[i],0);
    if(n.reduce((sum,x,i)=>sum+x*center[i],0)>d) {n=n.map(x=>-x);d=-d;}
    return {x:n[0],y:n[1],s:n[2],d};
  });
}
export function obstacleParts(o) {
  if(o.shape!=='arch') return [o];
  const thickness=o.width*.18, opening=o.height*.64;
  const a=o.angle||0, c=Math.cos(a),s=Math.sin(a);
  const part=(x,bottom,width,height)=>({...o,shape:'pillar',x:o.x+c*x,s:o.s+s*x,bottom:(o.bottom||0)+bottom,width,height,depth:o.depth});
  // An open colonnade: two round piers and a stone lintel, with real fly-through clearance.
  return [part(-(o.width-thickness)/2,0,thickness,o.height),part((o.width-thickness)/2,0,thickness,o.height),{...part(0,opening,o.width,o.height-opening),shape:null}];
}
