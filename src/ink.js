import * as THREE from 'three';

// A single screen pass draws black contours from depth discontinuities and color
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
        void edgePair(vec2 offset, float z, vec3 color, inout float depthEdge, inout float colorEdge, inout float nearest){
          float a=distanceAt(vUv+offset), b=distanceAt(vUv-offset);
          nearest=min(nearest,min(a,b));
          // Opposing samples cancel gradual depth slopes on the planet. A raw
          // first difference would blacken the ground near the horizon.
          float bend=abs(a+b-2.*z)/max(min(z,min(a,b)),1.);
          depthEdge=max(depthEdge,smoothstep(.014,.045,bend));
          vec3 ca=texture2D(picture,vUv+offset).rgb;
          vec3 cb=texture2D(picture,vUv-offset).rgb;
          colorEdge=max(colorEdge,smoothstep(.24,.55,max(length(ca-color),length(cb-color))));
        }
        void main(){
          vec3 color=texture2D(picture,vUv).rgb;
          float z=distanceAt(vUv);
          float depthEdge=0.0;
          float colorEdge=0.0;
          float nearest=z;
          edgePair(vec2(pixel.x,0.),z,color,depthEdge,colorEdge,nearest);
          edgePair(vec2(0.,pixel.y),z,color,depthEdge,colorEdge,nearest);
          edgePair(pixel*.7071,z,color,depthEdge,colorEdge,nearest);
          edgePair(vec2(pixel.x,-pixel.y)*.7071,z,color,depthEdge,colorEdge,nearest);
          // Carry silhouettes well into the expanded landscape, then let fog
          // absorb the ink. Fine color details use a lighter stroke weight.
          float distanceFade=1.-smoothstep(190.,440.,nearest);
          float edge=max(depthEdge,colorEdge*.55)*distanceFade;
          color=mix(color,vec3(.001),edge);
          gl_FragColor=vec4(max(color,vec3(0.)),1.);
          #include <colorspace_fragment>
        }`,
    });
    this.scene.add(new THREE.Mesh(geometry, material)); this.resize();
  }
  resize() {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const width = 1.35 * (this.renderer.getPixelRatio?.() || 1);
    this.target.setSize(size.x, size.y); this.uniforms.pixel.value.set(width / size.x, width / size.y);
  }
  render(scene, camera) {
    this.renderer.setRenderTarget(this.target); this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null); this.renderer.render(this.scene, this.screenCamera);
  }
}
