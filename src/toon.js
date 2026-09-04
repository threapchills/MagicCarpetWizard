import * as THREE from 'three';

// Small, tileable pigment maps. Mipmaps filter the fine marks during fast flight;
// UVs keep them attached to the models, including merged and curved scenery.
const textures = new Map();
function hash(x, y) {
  let n = Math.imul(x + 19, 374761393) ^ Math.imul(y + 71, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function noise(x, y, cells) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix % cells, iy % cells), b = hash((ix + 1) % cells, iy % cells);
  const c = hash(ix % cells, (iy + 1) % cells), d = hash((ix + 1) % cells, (iy + 1) % cells);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, u), THREE.MathUtils.lerp(c, d, u), v);
}
export function pigmentTexture(surface = 'plaster') {
  if (textures.has(surface)) return textures.get(surface);
  const size = 256, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const wash = noise(u * 8, v * 8, 8), grain = hash(x, y);
    let value = .94 + .045 * wash + .015 * grain;
    if (surface === 'sand') {
      const ripple = Math.sin(v * Math.PI * 32 + Math.sin(u * Math.PI * 2) * 1.6);
      value = .93 + .045 * wash + .025 * grain - .065 * Math.pow(Math.max(0, ripple), 10);
    } else if (surface === 'cloth') {
      const weave = ((x % 4 < 2) !== (y % 4 < 2)) ? .018 : -.018;
      const border = Math.min(u, 1 - u, v, 1 - v);
      const diamond = Math.abs(u - .5) * 1.5 + Math.abs(v - .5);
      const ornament = (border > .055 && border < .075) || (diamond > .28 && diamond < .30);
      value = .88 + .06 * wash + weave + (ornament ? .12 : 0);
    } else if (grain > .985) value -= .065;
    const index = (y * size + x) * 4, ink = Math.round(THREE.MathUtils.clamp(value, 0, 1) * 255);
    pixels[index] = pixels[index + 1] = pixels[index + 2] = ink; pixels[index + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.name = `${surface} pigment`;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.anisotropy = 4;
  if (surface === 'sand') texture.repeat.set(2, 8);
  // Values are linear reflectance multipliers, not sRGB artwork.
  texture.colorSpace = THREE.NoColorSpace; texture.needsUpdate = true;
  textures.set(surface, texture); return texture;
}

const celLighting = /* glsl */`
  // Quantize combined illumination, so hemisphere fill and soft shadow maps
  // cannot wash away the bands. Pigment changes color, never the band boundary.
  vec3 illumination = (reflectedLight.directDiffuse + reflectedLight.indirectDiffuse)
    / max(diffuseColor.rgb, vec3(.0001));
  float energy = dot(illumination, vec3(.2126, .7152, .0722));
  float aa = clamp(fwidth(energy) * .5, .001, .012);
  float middle = smoothstep(.30 - aa, .30 + aa, energy);
  float lit = smoothstep(.58 - aa, .58 + aa, energy);
  float band = .28 + .34 * middle + .43 * lit;
  vec3 lightTint = mix(vec3(1.), clamp(illumination / max(energy, .001), .65, 1.4), .30);
  vec3 shadowTint = mix(vec3(.78, .82, 1.08), vec3(1.), middle);
  vec3 outgoingLight = diffuseColor.rgb * band * lightTint * shadowTint + totalEmissiveRadiance;
`;

export function toonMaterial(color, { surface = 'plaster', side = THREE.FrontSide } = {}) {
  const material = new THREE.MeshToonMaterial({ color, map: surface === 'smooth' ? null : pigmentTexture(surface), side });
  material.onBeforeCompile = shader => {
    // Leave Three's shadowing, lights, fog and color management intact. Use an
    // unstepped light input because the final combined result is quantized below.
    shader.fragmentShader = shader.fragmentShader.replace('#include <gradientmap_pars_fragment>', `
      vec3 getGradientIrradiance(vec3 normal, vec3 lightDirection) {
        return vec3(max(dot(normal, lightDirection), 0.));
      }
    `).replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;', celLighting);
  };
  material.customProgramCacheKey = () => 'pigment-cel-3-band-v1';
  return material;
}
