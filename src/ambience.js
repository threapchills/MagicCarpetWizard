import { clamp, random } from './game.js';

export const AMBIENT_ASSETS = ['sky2', 'sky4', 'sky5', 'fire3', 'fire7', 'earth5', 'earth7', 'sea2', 'sea4'];
const beds = {
  city: ['fire3', 'sky4'], palace: ['sea2', 'sky4'], desert: ['fire7', 'earth7'],
  canyon: ['earth7', 'fire7'], river: ['sea2', 'sea4'], farm: ['earth5', 'sea2'], ancient: ['earth7', 'sky4'],
  fishing: ['sea4', 'sea2'], mountain: ['sky5', 'earth7'], jungle: ['earth5', 'sea2'], beach: ['sea2', 'sea4'], island: ['sea4', 'fire3'], temple: ['earth7', 'sky4'],
};
export function ambientProfile({ zone = 'city', altitude = 3, speed = 30, night = 0, rain = false, sand = false, wind = 0, boost = false, running = false } = {}) {
  const ground = clamp(1 - altitude / 38, .18, 1);
  const [bed, detail] = beds[zone] || beds.city;
  return [
    { role: 'air', asset: rain ? 'sky5' : sand ? 'fire7' : 'sky2', gain: .72 + altitude / 160 + clamp(wind, 0, 1) * .22 + (boost ? .08 : 0), cutoff: clamp(3600 + speed * 45 + altitude * 40 + wind * 1100, 3600, 8500), width: .5 + clamp(wind, 0, 1) * .35 },
    { role: 'land', asset: bed, gain: (.65 * ground + .10) * (running ? 1 : .85), cutoff: 2400 + ground * 3900, width: .28 },
    { role: 'dream', asset: night > .6 && !['palace', 'ancient'].includes(zone) ? 'sky4' : detail, gain: .28 + night * .12 + (boost ? .04 : 0), cutoff: 3200 + night * 700, width: .65 },
  ];
}

export class AmbientEngine {
  constructor(context, output, { baseUrl, fetcher = url => globalThis.fetch(url), seed = 571 } = {}) {
    this.ctx = context; this.output = output; this.baseUrl = baseUrl; this.fetcher = fetcher; this.rng = random(seed);
    this.buffers = new Map(); this.pending = new Map(); this.failed = new Map(); this.voices = new Set(); this.layers = new Map(); this.enabled = true; this.clock = 0;
    this.profile = ambientProfile();
    for (const p of this.profile) this.layers.set(p.role, { ...p, next: 0 });
  }
  async load(asset) {
    if (this.buffers.has(asset)) return this.buffers.get(asset);
    if (this.pending.has(asset)) return this.pending.get(asset);
    if ((this.failed.get(asset) || 0) > this.ctx.currentTime) return null;
    const task = (async () => {
      try {
        const response = await this.fetcher(new URL(`${asset}.mp3`, this.baseUrl).href);
        if (!response.ok) throw new Error('Ambient sample unavailable');
        const buffer = await this.ctx.decodeAudioData(await response.arrayBuffer());
        if (buffer.duration < 2) throw new Error('Ambient sample too short');
        this.buffers.set(asset, buffer); this.failed.delete(asset);
        // Keep memory bounded while protecting the current three layer choices.
        const protectedAssets = new Set(this.profile.map(p => p.asset));
        for (const key of this.buffers.keys()) { if (this.buffers.size <= 6) break; if (!protectedAssets.has(key)) this.buffers.delete(key); }
        return buffer;
      } catch { this.failed.set(asset, this.ctx.currentTime + 30); return null; }
      finally { this.pending.delete(asset); }
    })();
    this.pending.set(asset, task); return task;
  }
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.stop();
    else for (const layer of this.layers.values()) { layer.next = 0; layer.started = false; }
  }
  stop() {
    const now = this.ctx.currentTime;
    for (const voice of [...this.voices]) {
      voice.envelope.gain.cancelScheduledValues(now); voice.envelope.gain.setTargetAtTime(0, now, .04);
      try { voice.source.stop(now + .18); } catch { voice.cleanup(); }
    }
  }
  spawn(layer, buffer) {
    if (!this.enabled || this.voices.size >= 12) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const rate = .94 + this.rng() * .11;
    const length = Math.min(9 + this.rng() * 4, buffer.duration / rate - .1);
    const source = ctx.createBufferSource(), envelope = ctx.createGain(), filter = ctx.createBiquadFilter(), panner = ctx.createStereoPanner(), level = ctx.createGain();
    source.buffer = buffer; source.playbackRate.value = rate;
    const available = Math.max(0, buffer.duration - length * rate - .05), offset = this.rng() * available;
    filter.type = 'lowpass'; filter.frequency.value = layer.cutoff; filter.Q.value = .4;
    panner.pan.value = (this.rng() - .5) * layer.width;
    panner.pan.linearRampToValueAtTime((this.rng() - .5) * layer.width, now + length);
    level.gain.value = layer.gain;
    const fade = Math.min(3.2, length * .3);
    const fadeIn = layer.started ? fade : .35; layer.started = true;
    envelope.gain.setValueAtTime(0, now); envelope.gain.linearRampToValueAtTime(.9, now + fadeIn);
    envelope.gain.setValueAtTime(.9, now + length - fade); envelope.gain.linearRampToValueAtTime(0, now + length);
    source.connect(envelope).connect(filter).connect(panner).connect(level).connect(this.output);
    const voice = { source, envelope, filter, panner, level, role: layer.role, asset: layer.asset, cleanup: () => {
      this.voices.delete(voice); source.disconnect(); envelope.disconnect(); filter.disconnect(); panner.disconnect(); level.disconnect();
    } };
    source.onended = voice.cleanup; this.voices.add(voice);
    source.start(now, offset); source.stop(now + length + .02);
    layer.next = now + length - fade;
  }
  update(dt, environment) {
    if (!this.enabled) return;
    this.clock -= dt; if (this.clock > 0) return; this.clock = .25;
    this.profile = ambientProfile(environment);
    const now = this.ctx.currentTime;
    for (const desired of this.profile) {
      const layer = this.layers.get(desired.role);
      if (layer.asset !== desired.asset) layer.next = 0;
      Object.assign(layer, desired);
      for (const voice of this.voices) if (voice.role === layer.role) {
        voice.level.gain.setTargetAtTime(voice.asset === layer.asset ? layer.gain : 0, now, 1.8);
        voice.filter.frequency.setTargetAtTime(layer.cutoff, now, 2);
      }
      if (now >= layer.next) {
        const buffer = this.buffers.get(layer.asset);
        if (buffer) this.spawn(layer, buffer);
        else void this.load(layer.asset);
      }
    }
  }
}
