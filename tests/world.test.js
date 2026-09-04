import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { generateChunk, RADIUS } from '../src/game.js';
import { createChunkVisual, createCarpet, createEnemy, createPickup, createRing, placeOnWorld, disposeChunk } from '../src/world.js';

test('every zone creates finite merged geometry without mutating collision shapes', () => {
  for (let zone = 0; zone < 7; zone++) {
    const chunk = generateChunk(zone * 20 + 5, 671), expected = structuredClone(chunk.obstacles), visual = createChunkVisual(chunk, 671);
    assert.deepEqual(chunk.obstacles, expected);
    assert.ok(visual.children.length > 0 && visual.children.length < 40);
    visual.traverse(m => { if (m.isMesh) { assert.ok(m.geometry.attributes.position.count > 0); for (const n of m.geometry.attributes.position.array) assert.ok(Number.isFinite(n)); m.geometry.computeBoundingSphere(); assert.ok(Number.isFinite(m.geometry.boundingSphere.radius)); } });
    disposeChunk(visual);
  }
});
test('sphere placement keeps entities on the same radius around the horizon', () => {
  const object = new THREE.Group();
  for (let s = -50; s < 300; s += 7) { placeOnWorld(object, 0, s, 8, 0); assert.ok(Math.abs(Math.hypot(object.position.y + RADIUS, object.position.z) - (RADIUS + 8)) < 1e-8); }
});
test('all interactive models construct successfully', () => {
  for (const object of [createCarpet().root, createEnemy(), createRing(3.8), ...['gold', 'fire', 'frost', 'storm', 'echo', 'magnet', 'ward'].map(createPickup)]) {
    let meshes = 0; object.traverse(m => { if (m.isMesh) meshes++; }); assert.ok(meshes > 0);
  }
});
