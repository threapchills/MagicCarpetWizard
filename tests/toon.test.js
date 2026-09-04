import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { pigmentTexture, toonMaterial } from '../src/toon.js';
import { InkRenderer } from '../src/ink.js';

test('surface maps are shared, opaque, filtered and keep pigment within a restrained range', () => {
  const maps = ['plaster', 'sand', 'cloth'].map(pigmentTexture);
  assert.equal(new Set(maps).size, 3);
  for (const [i, map] of maps.entries()) {
    assert.equal(map, pigmentTexture(['plaster', 'sand', 'cloth'][i]));
    assert.equal(map.image.data.length, map.image.width * map.image.height * 4);
    assert.equal(map.generateMipmaps, true);
    assert.equal(map.minFilter, THREE.LinearMipmapLinearFilter);
    let min = 255, max = 0;
    for (let p = 0; p < map.image.data.length; p += 4) {
      const value = map.image.data[p]; min = Math.min(min, value); max = Math.max(max, value);
      assert.equal(map.image.data[p + 3], 255);
    }
    assert.ok(min >= 200 && max <= 255 && max > min);
  }
  assert.equal(toonMaterial('#c92245', { surface: 'smooth' }).map, null);
});

test('cel shader integrates with the installed Three shader and retains shadows, fog and output conversion', () => {
  // An integration contract against Three's actual shader template: an upstream
  // chunk/template change must not silently restore the stock lighting model.
  const shader = { fragmentShader: THREE.ShaderLib.toon.fragmentShader };
  toonMaterial('#e6a375').onBeforeCompile(shader);
  assert.equal((shader.fragmentShader.match(/vec3 outgoingLight\s*=/g) || []).length, 1);
  assert.ok(shader.fragmentShader.includes('float band ='));
  assert.ok(!shader.fragmentShader.includes('#include <gradientmap_pars_fragment>'));
  for (const chunk of ['shadowmap_pars_fragment', 'lights_fragment_begin', 'fog_fragment', 'colorspace_fragment']) {
    assert.ok(shader.fragmentShader.includes(`#include <${chunk}>`));
    assert.ok(THREE.ShaderChunk[chunk]);
  }
});

test('ink width stays constant in CSS pixels at different pixel ratios and render size', () => {
  let ratio = 1, width = 1000, height = 600;
  const renderer = { getPixelRatio: () => ratio, getDrawingBufferSize: v => v.set(width * ratio, height * ratio) };
  const ink = new InkRenderer(renderer, new THREE.PerspectiveCamera());
  const expected = ink.uniforms.pixel.value.clone();
  ratio = 1.65; ink.resize();
  assert.ok(ink.uniforms.pixel.value.distanceTo(expected) < 1e-10);
  assert.equal(ink.target.width, 1650);
  width = 600; height = 1000; ink.resize();
  assert.ok(Math.abs(ink.uniforms.pixel.value.x * width - 1.35) < 1e-10);
  assert.ok(Math.abs(ink.uniforms.pixel.value.y * height - 1.35) < 1e-10);
  ink.target.dispose();
});
