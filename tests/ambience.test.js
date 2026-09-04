import test from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { AMBIENT_ASSETS, ambientProfile, AmbientEngine } from '../src/ambience.js';
import { Soundscape } from '../src/audio.js';

function context() {
  const sources = [];
  const parameter = () => ({ value: 0, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.value = v; }, setTargetAtTime(v) { this.value = v; }, cancelScheduledValues() {} });
  const node = () => ({ connect() { return arguments[0]; }, disconnect() {}, gain: parameter(), frequency: parameter(), Q: parameter(), pan: parameter() });
  const ctx = { currentTime: 0, createGain: node, createBiquadFilter: node, createStereoPanner: node,
    createBufferSource() { const n = { ...node(), playbackRate: parameter(), start(time, offset) { this.started = { time, offset }; }, stop(time) { this.stopTime = time; } }; sources.push(n); return n; },
    async decodeAudioData() { return { duration: 16 }; }, sources,
  };
  return ctx;
}

test('Slumbr samples ship locally and music has no background oscillator loop', async () => {
  for (const name of AMBIENT_ASSETS) assert.ok((await stat(new URL(`../public/audio/slumbr/${name}.mp3`, import.meta.url))).size > 1000);
  const sound = new Soundscape(); let tones = 0; sound.tone = () => tones++; sound.enabled = true;
  let updates = 0; sound.ambient = { update() { updates++; } };
  for (let i = 0; i < 1000; i++) sound.update(.1, {});
  assert.equal(tones, 0); assert.equal(updates, 1000);
});
test('ambience responds to height, biome, night, rain and sand', () => {
  const low = ambientProfile({ zone: 'river', altitude: 1, running: true }), high = ambientProfile({ zone: 'river', altitude: 29, running: true });
  assert.ok(high[0].gain > low[0].gain); assert.ok(high[1].gain < low[1].gain);
  assert.equal(low[1].asset, 'sea2'); assert.equal(ambientProfile({ zone: 'farm' })[1].asset, 'earth5');
  assert.equal(ambientProfile({ rain: true })[0].asset, 'sky5'); assert.equal(ambientProfile({ sand: true })[0].asset, 'fire7');
  assert.equal(ambientProfile({ zone: 'desert', night: .9 })[2].asset, 'sky4');
});
test('sample loading deduplicates, retries failures with backoff and overlaps bounded voices', async () => {
  const ctx = context(); let requests = 0;
  const engine = new AmbientEngine(ctx, {}, { baseUrl: 'https://example.invalid/audio/', fetcher: async () => { requests++; return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; } });
  await Promise.all([engine.load('sky2'), engine.load('sky2')]); assert.equal(requests, 1);
  for (const name of AMBIENT_ASSETS) await engine.load(name); assert.ok(engine.buffers.size <= 6);
  for (let i = 0; i < 200; i++) {
    ctx.currentTime += .5;
    for (const source of ctx.sources) if (source.stopTime <= ctx.currentTime && source.onended) { source.onended(); source.onended = null; }
    engine.update(.5, { zone: i < 100 ? 'city' : 'river', altitude: 5, running: true });
    await Promise.resolve(); await Promise.resolve();
    assert.ok(engine.voices.size <= 12);
  }
  assert.ok(ctx.sources.length > 10);
  for (const source of ctx.sources) assert.ok(source.started.offset >= 0 && source.started.offset < 16);
  engine.setEnabled(false); ctx.currentTime += 1;
  for (const source of ctx.sources) source.onended?.(); assert.equal(engine.voices.size, 0);
  const failed = new AmbientEngine(ctx, {}, { baseUrl: 'https://example.invalid/', fetcher: async () => { requests++; return { ok: false }; } });
  const before = requests; await failed.load('sky2'); await failed.load('sky2'); assert.equal(requests, before + 1);
  ctx.currentTime += 31; await failed.load('sky2'); assert.equal(requests, before + 2);
});
