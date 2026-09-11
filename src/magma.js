import * as THREE from 'three';
import { elevationAt } from './landscape.js';
export const magmaMaterial=new THREE.ShaderMaterial({
  uniforms:{time:{value:0}},
  vertexShader:`varying vec2 flow; void main(){flow=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`varying vec2 flow; uniform float time;
    void main(){
      vec2 p=flow*vec2(.22,.16);float t=time*.45;
      float a=sin(p.x*2.1+sin(p.y*1.7+t*.3))*sin(p.y*2.3-t+sin(p.x*1.5));
      float cracks=1.-smoothstep(.025,.18,abs(a));
      float heat=.5+.5*sin(p.y*.9-p.x*.7-t*.6);
      vec3 crust=mix(vec3(.09,.017,.025),vec3(.34,.04,.012),heat);
      vec3 molten=mix(vec3(1.45,.15,.01),vec3(2.2,.95,.12),heat);
      gl_FragColor=vec4(mix(crust,molten,cracks),1.);
    }`
});
export function createMagmaStrip(start,radius) {
  const geometry=new THREE.BoxGeometry(34,2,64.1,4,1,16);geometry.translate(0,1,-32);
  const p=geometry.attributes.position,uv=geometry.attributes.uv;
  for(let i=0;i<p.count;i++){
    const z=p.getZ(i),r=radius+p.getY(i)+elevationAt(start-z)-elevationAt(start),angle=z/radius;
    uv.setXY(i,p.getX(i),start-z);p.setY(i,Math.cos(angle)*r-radius);p.setZ(i,Math.sin(angle)*r);
  }
  geometry.computeVertexNormals();return new THREE.Mesh(geometry,magmaMaterial);
}
