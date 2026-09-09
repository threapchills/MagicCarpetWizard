import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ZONES } from '../src/game.js';
import { LOOKS, gradeAt, createGradeUniforms, updateGrade } from '../src/grade.js';
import { InkRenderer } from '../src/ink.js';

test('every landscape has its own bounded day, sunset, night and cave grade', () => {
  const fingerprints = new Set();
  for (const zone of ZONES) {
    assert.ok(LOOKS[zone.type]); fingerprints.add(JSON.stringify(LOOKS[zone.type]));
    const day = gradeAt(zone.type), dusk = gradeAt(zone.type, { daylight: .43 }), night = gradeAt(zone.type, { daylight: .1, night: 1 });
    assert.notDeepEqual(day.light, dusk.light); assert.notDeepEqual(day.shadow, night.shadow);
    for (const options of [{}, { daylight: .43 }, { night: 1 }, { night: 1, rain: true }, { sand: true }, { night: 1, enclosed: true, slow: true }]) {
      const look = gradeAt(zone.type, options);
      assert.ok([...look.shadow, ...look.light, ...look.haze.toArray()].every(Number.isFinite));
      assert.ok(look.exposure >= .85 && look.exposure <= 1.2);
      assert.ok(look.saturation >= .95 && look.saturation <= 1.2);
      assert.ok(look.contrast >= 1 && look.contrast <= 1.25);
      if (options.enclosed || options.rain || options.sand) assert.equal(look.aura, 0);
      if (options.enclosed) assert.equal(look.atmosphere, 0);
    }
  }
  assert.equal(fingerprints.size, ZONES.length);
});

test('grade transitions are time-based, pause without drifting and preserve target palettes', () => {
  const a = createGradeUniforms(), b = createGradeUniforms();
  const day = gradeAt('desert'), night = gradeAt('temple', { night: 1 });
  for (const uniforms of [a, b]) updateGrade(uniforms, day, 0, 0, true);
  for (let i = 0; i < 60; i++) updateGrade(a, night, 1 / 60, 1);
  for (let i = 0; i < 144; i++) updateGrade(b, night, 1 / 144, 1);
  assert.ok(a.gradeShadow.value.distanceTo(b.gradeShadow.value) < 1e-10);
  assert.ok(a.gradeSettings.value.clone().sub(b.gradeSettings.value).length() < 1e-10);
  const before = a.gradeSettings.value.clone(); updateGrade(a, day, 0, 1);
  assert.deepEqual(a.gradeSettings.value, before);
  updateGrade(a, night, 100, 1); assert.ok(Math.abs(a.gradeSettings.value.x - night.exposure) < 1e-10);
});

test('cinematic shading keeps the same four draws and quarter-resolution glow buffers', () => {
  for (const hdr of [false, true]) {
    const draws = [], targets = [];
    const renderer = { extensions: { has: () => hdr }, getDrawingBufferSize: v => v.set(1280, 720), getPixelRatio: () => 1,
      setRenderTarget: target => targets.push(target), render: scene => draws.push(scene) };
    const camera = new THREE.PerspectiveCamera(), ink = new InkRenderer(renderer, camera), scene = new THREE.Scene();
    ink.setLook(gradeAt('ancient', { night: 1 }), .016, 5); ink.render(scene, camera);
    assert.equal(draws.length, 4); assert.equal(draws.filter(s => s === scene).length, 1);
    assert.deepEqual(targets, [ink.target, ink.glowA, ink.glowB, null]);
    assert.equal(ink.glowA.width, 320); assert.equal(ink.glowA.height, 180);
    assert.equal(ink.glowB.width, 320); assert.equal(ink.glowB.height, 180);
    const shader = ink.scene.children[0].material.fragmentShader;
    assert.ok(shader.indexOf('color=cinematicGrade(color,z)') < shader.indexOf('color=mix(color,vec3(.001),edge)'));
    assert.equal((shader.match(/uniform sampler2D /g) || []).length, 3, 'no additional texture samplers');
    ink.target.dispose(); ink.glowA.dispose(); ink.glowB.dispose();
  }
});
