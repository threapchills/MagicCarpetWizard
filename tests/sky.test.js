import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSky, updateSky } from '../src/sky.js';
import { building, createChunkVisual, placeOnTerrain, disposeChunk } from '../src/world.js';
import { generateChunk, random, RADIUS } from '../src/game.js';

test('distant skies have broad cloud banks, two outlined moons and outlined star shapes', () => {
  const sky = createSky(new THREE.Scene()), camera = new THREE.PerspectiveCamera();
  assert.equal(sky.moons.children.length, 2);
  assert.ok(sky.stars.count >= 200); assert.equal(sky.stars.count, sky.starOutlines.count);
  for (const cloud of sky.clouds.children) {
    const size = new THREE.Box3().setFromObject(cloud).getSize(new THREE.Vector3());
    assert.ok(Math.max(size.x, size.z) > 120);
    assert.ok(cloud.position.length() > 650);
  }
  const options = { camera, night: 1, daylight: 0, wind: .5, enclosed: false };
  updateSky(sky, 1, options);
  assert.ok(sky.moons.visible && sky.stars.visible && sky.starOutlines.visible);
  assert.equal(sky.sun.visible, false);
  camera.position.set(45, 60, 20); updateSky(sky, 0, { ...options, enclosed: true });
  assert.equal(sky.root.visible, true, 'the sky remains visible through tunnel exits'); assert.deepEqual(sky.root.position, camera.position);
  updateSky(sky, 1, { ...options, night: 0, daylight: 1 });
  assert.ok(sky.root.visible && sky.sun.visible); assert.equal(sky.moons.visible, false); assert.equal(sky.stars.visible, false);
});

test('rotated building foundations reach below terrain across their full footprint', () => {
  for (const x of [-190, -100, 75, 185]) for (const seed of [1, 8, 12]) {
    const root = new THREE.Group(), house = building(root, x, -30, 30, 28, 24, random(seed));
    root.updateMatrixWorld(true);
    const foundation = house.children[0], positions = foundation.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) if (positions.getY(i) < 0) {
      const p = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(foundation.matrixWorld);
      assert.ok(p.y < -p.x * p.x / (2 * RADIUS), `foundation grounded at ${p.x}`);
    }
  }
});

test('cave roofs occlude upward views across the opening and chunk seams', () => {
  const chunks = [];
  for (const index of [12, 13, 14]) {
    const visual = createChunkVisual(generateChunk(index, 42), 42);
    placeOnTerrain(visual, 0, index * 64, 0, 832); visual.updateMatrixWorld(true); chunks.push(visual);
  }
  const ray = new THREE.Raycaster(), origin = new THREE.Object3D();
  for (const x of [-26, -15, 0, 15, 26]) for (const s of [800, 831.9, 832, 832.1, 870, 895.9, 896.1]) {
    placeOnTerrain(origin, x, s, 15, 832);
    ray.set(origin.position, new THREE.Vector3(0, 1, 0));
    const hits = ray.intersectObjects(chunks, true);
    assert.ok(hits.length && hits[0].distance < 25, `roof seals x=${x}, s=${s}`);
  }
  chunks.forEach(disposeChunk);
});
