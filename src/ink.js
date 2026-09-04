import * as THREE from 'three';

// A single screen pass draws thin contours from depth discontinuities and color
// boundaries. It avoids duplicating every world mesh for an outline pass.
export class InkRenderer {
  constructor(renderer, camera) {
    this.renderer = renderer; this.camera = camera;
    this.target = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
    this.scene = new THREE.Scene(); this.screenCamera = new THREE.Camera();
    this.uniforms = {
      picture: { value: this.target.texture }, depth: { value: this.target.depthTexture },
      pixel: { value: new THREE.Vector2(1, 1) }, nearPlane: { value: camera.near }, farPlane: { value: camera.far },
    };
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    const material = new THREE.ShaderMaterial({ uniforms: this.uniforms, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,1.0);}',
      fragmentShader: `
        #include <packing>
        varying vec2 vUv;
        uniform sampler2D picture;
        uniform sampler2D depth;
        uniform vec2 pixel;
        uniform float nearPlane;
        uniform float farPlane;
        float distanceAt(vec2 uv){return -perspectiveDepthToViewZ(texture2D(depth,uv).x,nearPlane,farPlane);}
        void main(){
          vec3 color=texture2D(picture,vUv).rgb;
          float z=distanceAt(vUv);
          float depthEdge=0.0;
          float colorEdge=0.0;
          for(int i=0;i<4;i++){
            vec2 direction=i==0?vec2(1.,0.):i==1?vec2(-1.,0.):i==2?vec2(0.,1.):vec2(0.,-1.);
            vec2 uv=vUv+direction*pixel;
            float nz=distanceAt(uv);
            depthEdge=max(depthEdge,smoothstep(.018,.055,abs(nz-z)/max(z,1.)));
            vec3 neighbor=texture2D(picture,uv).rgb;
            colorEdge=max(colorEdge,smoothstep(.18,.42,length(neighbor-color)));
          }
          float distanceFade=1.-smoothstep(90.,245.,z);
          float edge=max(depthEdge*.72,colorEdge*.28)*distanceFade;
          // Slight pigment separation, with blue-violet ink instead of harsh black.
          color=mix(color,floor(color*22.+.5)/22.,.13);
          color=mix(color,vec3(.026,.020,.048),edge);
          float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5;
          color+=grain*.007;
          gl_FragColor=vec4(max(color,vec3(0.)),1.);
          #include <colorspace_fragment>
        }`,
    });
    this.scene.add(new THREE.Mesh(geometry, material)); this.resize();
  }
  resize() {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.target.setSize(size.x, size.y); this.uniforms.pixel.value.set(1.15 / size.x, 1.15 / size.y);
  }
  render(scene, camera) {
    this.renderer.setRenderTarget(this.target); this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null); this.renderer.render(this.scene, this.screenCamera);
  }
}
