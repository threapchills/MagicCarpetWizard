import * as THREE from 'three';

// Two quarter-resolution glow passes precede the ink composite. The scene is
// drawn only once; black outlines are applied after glow to retain contrast.
export class InkRenderer {
  constructor(renderer, camera) {
    this.renderer = renderer; this.camera = camera;
    this.hdr = renderer.extensions?.has('EXT_color_buffer_float') || false;
    const type = this.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
    this.target = new THREE.WebGLRenderTarget(1, 1, { type, depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.glowA = new THREE.WebGLRenderTarget(1, 1, { type, depthBuffer: false });
    this.glowB = new THREE.WebGLRenderTarget(1, 1, { type, depthBuffer: false });
    this.target.depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
    this.scene = new THREE.Scene(); this.screenCamera = new THREE.Camera();
    this.uniforms = {
      picture: { value: this.target.texture }, depth: { value: this.target.depthTexture },
      glow: { value: this.glowB.texture },
      hdr: { value: this.hdr },
      pixel: { value: new THREE.Vector2(1, 1) }, nearPlane: { value: camera.near }, farPlane: { value: camera.far },
    };
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    const vertexShader = 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,1.0);}';
    this.blurUniforms = { source: { value: this.target.texture }, direction: { value: new THREE.Vector2() }, extract: { value: true }, hdr: { value: this.hdr } };
    const blur = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, uniforms: this.blurUniforms, vertexShader,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D source;
        uniform vec2 direction;
        uniform bool extract;
        uniform bool hdr;
        vec3 sampleGlow(vec2 uv) {
          vec3 c=texture2D(source,uv).rgb;
          if(!extract) return c;
          float high=max(c.r,max(c.g,c.b)), low=min(c.r,min(c.g,c.b));
          // HDR magic exceeds the paper palette. The 8-bit fallback gates on
          // saturation as well, avoiding a glow wash over white architecture.
          float mask=hdr?smoothstep(1.05,2.1,high):smoothstep(.72,.98,high)*smoothstep(.2,.5,high-low);
          return min(c,vec3(4.))*mask;
        }
        void main(){
          vec3 c=sampleGlow(vUv)*.227027;
          c+=(sampleGlow(vUv+direction*1.384615)+sampleGlow(vUv-direction*1.384615))*.316216;
          c+=(sampleGlow(vUv+direction*3.230769)+sampleGlow(vUv-direction*3.230769))*.070270;
          gl_FragColor=vec4(c,1.);
        }` });
    this.blurScene = new THREE.Scene(); this.blurScene.add(new THREE.Mesh(geometry, blur));
    const material = new THREE.ShaderMaterial({ uniforms: this.uniforms, depthTest: false, depthWrite: false,
      vertexShader,
      fragmentShader: `
        #include <packing>
        varying vec2 vUv;
        uniform sampler2D picture;
        uniform sampler2D depth;
        uniform sampler2D glow;
        uniform bool hdr;
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
          // Preserve luminous cores inside narrow spells and runes. Neighboring
          // background pixels still carry their black silhouette contour.
          if(hdr) edge*=1.-.82*smoothstep(1.8,3.,max(color.r,max(color.g,color.b)));
          color+=texture2D(glow,vUv).rgb*.32;
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
    this.glowA.setSize(Math.max(1, Math.ceil(size.x / 4)), Math.max(1, Math.ceil(size.y / 4)));
    this.glowB.setSize(this.glowA.width, this.glowA.height);
  }
  render(scene, camera) {
    this.renderer.setRenderTarget(this.target); this.renderer.render(scene, camera);
    this.blurUniforms.source.value = this.target.texture; this.blurUniforms.extract.value = true;
    this.blurUniforms.direction.value.set(1 / this.glowA.width, 0);
    this.renderer.setRenderTarget(this.glowA); this.renderer.render(this.blurScene, this.screenCamera);
    this.blurUniforms.source.value = this.glowA.texture; this.blurUniforms.extract.value = false;
    this.blurUniforms.direction.value.set(0, 1 / this.glowA.height);
    this.renderer.setRenderTarget(this.glowB); this.renderer.render(this.blurScene, this.screenCamera);
    this.renderer.setRenderTarget(null); this.renderer.render(this.scene, this.screenCamera);
  }
}
