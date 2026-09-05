import * as THREE from 'three';
const plane = new THREE.PlaneGeometry(1, 1), halos = new Map(), cores = new Map();
export function glowCore(color) {
  if (!cores.has(color)) cores.set(color, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(6), fog: false }));
  return cores.get(color);
}
export function createHalo(color, size) {
  if (!halos.has(color)) halos.set(color, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { tint: { value: new THREE.Color(color).multiplyScalar(4) } },
    vertexShader: `varying vec2 uvHalo; void main(){uvHalo=uv; vec4 p=modelViewMatrix*vec4(0.,0.,0.,1.); vec2 s=vec2(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz)); p.xy+=position.xy*s; gl_Position=projectionMatrix*p;}`,
    fragmentShader: `varying vec2 uvHalo; uniform vec3 tint; void main(){float r=length(uvHalo-.5)*2.; if(r>1.)discard; float a=pow(1.-r,2.)*.48; gl_FragColor=vec4(tint,a);}`,
  }));
  const halo = new THREE.Mesh(plane, halos.get(color)); halo.scale.setScalar(size); halo.frustumCulled = false; return halo;
}
