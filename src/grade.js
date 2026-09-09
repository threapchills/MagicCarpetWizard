import * as THREE from 'three';

// Linear-light multipliers: retain the underlying pigments and spell colours.
// Every landscape gets a different shadow / highlight pairing.
export const LOOKS = {
  city:     { shadow: [.63, .97, 1.16], light: [1.20, 1.06, .83], haze: '#e8b88a', saturation: 1.13, contrast: 1.10, aura: .15 },
  palace:   { shadow: [.69, 1.04, .91], light: [1.18, 1.12, .86], haze: '#b9d6b6', saturation: 1.12, contrast: 1.08, aura: .28 },
  desert:   { shadow: [.90, .73, 1.22], light: [1.28, 1.02, .71], haze: '#efaa78', saturation: 1.16, contrast: 1.13, aura: .16 },
  canyon:   { shadow: [.71, .79, 1.23], light: [1.27, .96, .80], haze: '#d89389', saturation: 1.13, contrast: 1.17, aura: .15 },
  river:    { shadow: [.59, 1.02, 1.20], light: [.96, 1.13, 1.16], haze: '#99d8dc', saturation: 1.12, contrast: 1.09, aura: .55 },
  farm:     { shadow: [.78, 1.04, .83], light: [1.17, 1.13, .81], haze: '#d4d69c', saturation: 1.09, contrast: 1.08, aura: .18 },
  ancient:  { shadow: [1.02, .70, 1.19], light: [1.19, 1.02, .91], haze: '#c5a1d5', saturation: 1.12, contrast: 1.15, aura: .90 },
  fishing:  { shadow: [.60, .95, 1.24], light: [1.21, 1.01, .93], haze: '#c7bacd', saturation: 1.13, contrast: 1.10, aura: .44 },
  mountain: { shadow: [.65, .81, 1.29], light: [1.01, 1.10, 1.20], haze: '#b0c9e9', saturation: 1.06, contrast: 1.16, aura: .80 },
  jungle:   { shadow: [.60, 1.07, .89], light: [1.12, 1.18, .71], haze: '#acc990', saturation: 1.16, contrast: 1.16, aura: .60 },
  beach:    { shadow: [.60, .97, 1.23], light: [1.23, 1.08, .85], haze: '#b8e1d9', saturation: 1.17, contrast: 1.08, aura: .38 },
  island:   { shadow: [.94, .68, 1.13], light: [1.34, .93, .68], haze: '#dc958c', saturation: 1.14, contrast: 1.18, aura: .45 },
  temple:   { shadow: [.84, .75, 1.26], light: [1.20, 1.12, .89], haze: '#c5b2df', saturation: 1.12, contrast: 1.12, aura: 1 },
};
const mix = THREE.MathUtils.lerp;
const smooth = THREE.MathUtils.smoothstep;

export function gradeAt(type, { daylight = 1, night = 0, enclosed = false, rain = false, sand = false, slow = false } = {}) {
  const look = LOOKS[type] || LOOKS.city;
  const dusk = (1 - smooth(Math.abs(daylight - .43), .04, .4)) * (1 - night);
  const shelter = enclosed ? 1 : 0;
  const shadow = look.shadow.map((v, i) => mix(mix(v, [.66, .76, 1.30][i], night * .38), [.64, .94, 1.12][i], shelter * .6));
  const light = look.light.map((v, i) => mix(mix(mix(v, [1.35, .99, .76][i], dusk * .65), [.88, 1.06, 1.24][i], night * .5), [1.15, 1.02, .86][i], shelter * .5));
  const haze = new THREE.Color(look.haze).lerp(new THREE.Color('#d77b9b'), dusk * .3).lerp(new THREE.Color('#535e9b'), night * .68);
  if (sand) haze.lerp(new THREE.Color('#d99663'), .5);
  if (rain) haze.lerp(new THREE.Color('#70849b'), .3);
  return { shadow, light, haze,
    exposure: 1.04 - night * .14 + shelter * .09,
    saturation: look.saturation - night * .04 - (rain ? .06 : 0),
    contrast: look.contrast + dusk * .05 - shelter * .07,
    strength: .92 + dusk * .08,
    atmosphere: shelter ? 0 : .055 + night * .025 + (rain || sand ? .025 : 0),
    bloom: .32 + dusk * .07 + night * .14 + shelter * .06,
    vignette: .13 + night * .07,
    aura: look.aura * night * (shelter || rain || sand ? 0 : 1),
    focus: slow ? 1 : 0,
  };
}

export function createGradeUniforms() {
  return {
    gradeShadow: { value: new THREE.Vector3(1, 1, 1) }, gradeLight: { value: new THREE.Vector3(1, 1, 1) },
    gradeHaze: { value: new THREE.Color('#e8b88a') },
    gradeSettings: { value: new THREE.Vector4(1, 1, 1, 0) }, // exposure, saturation, contrast, strength
    gradeEffects: { value: new THREE.Vector4(0, .32, 0, 0) }, // atmosphere, bloom, vignette, focus
    gradeTime: { value: 0 },
  };
}

export function updateGrade(uniforms, look, dt, time, immediate = false) {
  const t = immediate ? 1 : 1 - Math.exp(-Math.max(0, dt) * .65);
  uniforms.gradeShadow.value.lerp(new THREE.Vector3(...look.shadow), t);
  uniforms.gradeLight.value.lerp(new THREE.Vector3(...look.light), t);
  uniforms.gradeHaze.value.lerp(look.haze, t);
  uniforms.gradeSettings.value.lerp(new THREE.Vector4(look.exposure, look.saturation, look.contrast, look.strength), t);
  uniforms.gradeEffects.value.lerp(new THREE.Vector4(look.atmosphere, look.bloom, look.vignette, look.focus), t);
  uniforms.gradeTime.value = time;
}

// Fused into the existing ink composite: no extra targets, passes or texture
// fetches. Apply ink afterwards so split toning never lifts the black outlines.
export const gradeShader = /* glsl */`
  uniform vec3 gradeShadow;
  uniform vec3 gradeLight;
  uniform vec3 gradeHaze;
  uniform vec4 gradeSettings;
  uniform vec4 gradeEffects;
  uniform float gradeTime;
  vec3 cinematicGrade(vec3 color, float depth) {
    color *= gradeSettings.x;
    float luma = dot(color, vec3(.2126,.7152,.0722));
    float shadows = 1.-smoothstep(.035,.45,luma);
    float highlights = smoothstep(.09,.75,luma);
    vec3 tone = mix(vec3(1.),gradeShadow,shadows*gradeSettings.w);
    tone *= mix(vec3(1.),gradeLight,highlights*gradeSettings.w);
    color *= tone;
    luma = dot(color,vec3(.2126,.7152,.0722));
    // Gently protect very bright magic and saturated pickup colours.
    float vibrance = mix(gradeSettings.y,1.,smoothstep(.8,2.,luma));
    color = max(vec3(0.),mix(vec3(luma),color,vibrance));
    color *= (1.+(gradeSettings.z-1.)*(smoothstep(.02,.65,luma)*2.-1.));
    color /= 1.+max(color-.8,vec3(0.))*.24;
    float distanceVeil = smoothstep(65.,420.,depth)*gradeEffects.x;
    color = mix(color,gradeHaze,distanceVeil);
    vec2 centered = vUv*2.-1.;
    float edge = smoothstep(.20,1.45,dot(centered,centered));
    color *= 1.-edge*gradeEffects.z;
    // A restrained pearlescent pulse at the edges while bending time.
    if(gradeEffects.w>.001){
      float silk = .5+.5*sin(vUv.y*16.+gradeTime*.8+vUv.x*5.);
      color += vec3(.025,.065,.055)*silk*edge*gradeEffects.w;
    }
    // Fine static film grain: stable under pause, no texture or extra sample.
    float grain = fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))-.5;
    color += grain*.0035*smoothstep(.015,.12,luma);
    return max(color,vec3(0.));
  }
`;
