import test from 'node:test';
import assert from 'node:assert/strict';
import { stat, readFile } from 'node:fs/promises';
import { Soundscape } from '../src/audio.js';
import { SampleEffects, EFFECT_ASSETS } from '../src/sample-effects.js';
import { AmbientEngine } from '../src/ambience.js';

function setup({ muted = false, fetcher } = {}) {
  const params = () => ({ value: 0, setValueAtTime(v) { this.value = v; }, linearRampToValueAtTime(v) { this.value = v; }, setTargetAtTime(v) { this.value = v; }, cancelScheduledValues() {} });
  const node = () => ({ connect(next) { return next; }, disconnect() {}, gain: params(), frequency: params(), Q: params(), pan: params() });
  const urls = [], events = [], sources = [];
  const ctx = { currentTime: 0, state: 'suspended', destination: node(), createGain: node, createStereoPanner: node, createBiquadFilter: node,
    createDynamicsCompressor() { return { ...node(), threshold: params(), knee: params(), ratio: params(), attack: params(), release: params() }; },
    resume() { events.push('resume'); this.state = 'running'; return Promise.resolve(); },
    createBufferSource() { const n = { ...node(), playbackRate: params(), start(t, offset) { this.started = { t, offset }; }, stop() { this.stopped = true; } }; sources.push(n); return n; },
    async decodeAudioData() { return { duration: 16 }; },
  };
  const preferences = new Map([['mcw-muted', String(muted)]]), storage = { getItem: k => preferences.get(k) ?? null, setItem: (k, v) => preferences.set(k, v) };
  const fetchAudio = fetcher || (async url => { events.push('fetch'); urls.push(url); return { ok: true, arrayBuffer: async () => new ArrayBuffer(16) }; });
  const sound = new Soundscape({ contextFactory: () => ctx, baseUrl: 'https://threapchills.github.io/MagicCarpetWizard/audio/', fetcher: fetchAudio, storage });
  return { ctx, sound, urls, events, sources, preferences, storage };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('default sample loaders preserve the browser fetch receiver for ambience and effects', async () => {
  const original = globalThis.fetch, h = setup(); let requests = 0;
  globalThis.fetch = function () {
    assert.equal(this, globalThis, 'Window.fetch must be called on Window, not the audio loader'); requests++;
    return Promise.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(16) });
  };
  try {
    const ambience = new AmbientEngine(h.ctx, {}, { baseUrl: 'https://example.invalid/audio/' });
    const effects = new SampleEffects(h.ctx, {}, { baseUrl: 'https://example.invalid/audio/' });
    assert.ok(await ambience.load('sky2')); assert.ok(await effects.load('shoot')); assert.equal(requests, 2);
    assert.equal(ambience.failed.size + effects.failed.size, 0);
  } finally { globalThis.fetch = original; }
});

test('Take Flight unlocks audio before network work and starts audible ambience through the complete routing', async () => {
  const h = setup(); assert.equal(h.sound.enabled, false);
  assert.equal(await h.sound.start(), true); await flush(); h.sound.update(.3, { running: true });
  assert.equal(h.events[0], 'resume'); assert.ok(h.urls.every(url => url.startsWith('https://threapchills.github.io/MagicCarpetWizard/audio/')));
  assert.equal(h.sound.master.gain.value, .9); assert.equal(h.sound.ambienceBus.gain.value, .85); assert.equal(h.sound.effectBus.gain.value, .8);
  assert.ok(h.sound.ambient.voices.size >= 3); assert.match(h.sound.status(), /Ambience playing/);
  const air = [...h.sound.ambient.voices].find(v => v.role === 'air');
  assert.ok(air.level.gain.value >= .72);
  assert.ok(air.source.started); assert.ok(h.sound.effects.buffers.size === EFFECT_ASSETS.length);
});

test('deliberate mute and independent volumes persist across starts; mute cancels all effects', async () => {
  const h = setup({ muted: true }); assert.equal(await h.sound.start(), false); assert.equal(h.events.length, 0);
  await h.sound.toggle(); await flush(); assert.equal(h.sound.enabled, true);
  h.sound.setVolume('ambience', .95); h.sound.setVolume('effects', .4);
  await h.sound.effects.play('fire'); assert.ok(h.sound.effects.voices.size);
  await h.sound.toggle(); assert.equal(h.sound.enabled, false); assert.equal(h.sound.master.gain.value, 0); assert.equal(h.sound.effects.voices.size, 0);
  const restored = new Soundscape({ storage: h.storage }); assert.equal(restored.muted, true); assert.equal(restored.ambienceVolume, .95); assert.equal(restored.effectsVolume, .4);
  assert.equal(await restored.start(), false);
});

test('pause stops action voices and resume restores the user mix', async () => {
  const h = setup(); await h.sound.start(); await flush();
  await h.sound.effects.play('death'); h.sound.setPaused(true);
  assert.equal(h.sound.effects.voices.size, 0); assert.equal(h.sound.ambienceBus.gain.value, 0); assert.equal(h.sound.effectBus.gain.value, 0);
  h.sound.setPaused(false); assert.equal(h.sound.ambienceBus.gain.value, .85); assert.equal(h.sound.effectBus.gain.value, .8);
});
test('race ambience continues across handoffs and pauses while mute remains authoritative', async () => {
  const h = setup(); await h.sound.start(); await flush(); h.sound.update(.3, { running: true, keepAmbience: true });
  const voices = h.sound.ambient.voices.size; assert.ok(voices > 0);
  h.sound.setPaused(true); h.sound.update(.3, { running: false, paused: true, keepAmbience: true });
  assert.equal(h.sound.ambienceBus.gain.value, .85); assert.equal(h.sound.effectBus.gain.value, 0); assert.ok(h.sound.ambient.voices.size >= voices);
  assert.match(h.sound.status(), /Ambience playing/); await h.sound.start(); assert.equal(h.sound.ambient.voices.size >= voices, true);
  await h.sound.toggle(); assert.equal(h.sound.master.gain.value, 0); assert.equal(await h.sound.start(), false);
});

test('late unlock or sample downloads cannot resurrect audio after muting', async () => {
  const h = setup(); let unlock;
  h.ctx.resume = () => new Promise(resolve => unlock = resolve);
  const starting = h.sound.start(); await h.sound.toggle(); unlock(); await starting;
  assert.equal(h.sound.enabled, false); assert.equal(h.sound.master.gain.value, 0);
  let deliver;
  const bank = new SampleEffects(h.ctx, {}, { baseUrl: 'https://example.invalid/', fetcher: () => new Promise(resolve => deliver = resolve) });
  const before = h.sources.length, playing = bank.play('fire'); bank.setEnabled(false);
  deliver({ ok: true, arrayBuffer: async () => new ArrayBuffer(16) }); await playing;
  assert.equal(h.sources.length, before);
});

test('sample effects deduplicate loads, throttle repeated events and keep at most sixteen voices', async () => {
  const h = setup(); await h.sound.start(); await flush();
  const bank = h.sound.effects, requests = h.urls.length;
  await Promise.all([bank.load('shoot'), bank.load('shoot')]); assert.equal(h.urls.length, requests);
  await bank.play('fire'); await bank.play('fire'); assert.equal(bank.voices.size, 1);
  for (let i = 0; i < 100; i++) { h.ctx.currentTime += .1; await bank.play('fire'); assert.ok(bank.voices.size <= 16); }
  bank.stop(); assert.equal(bank.voices.size, 0);
});

test('failed audio fetches are visible and all shipped effects are recordings, without synthesized fallback', async () => {
  const h = setup({ fetcher: async () => ({ ok: false }) }); await h.sound.start(); await flush(); h.sound.update(.3, {});
  assert.match(h.sound.status(), /Ambience unavailable/);
  for (const asset of EFFECT_ASSETS) assert.ok((await stat(new URL(`../public/audio/effects/${asset}.mp3`, import.meta.url))).size > 1000);
  const source = await readFile(new URL('../src/audio.js', import.meta.url), 'utf8');
  const effects = await readFile(new URL('../src/sample-effects.js', import.meta.url), 'utf8');
  assert.ok(!/createOscillator|createBuffer\(/.test(source + effects));
  assert.ok(!/music\.ogg/.test(source + effects));
});
