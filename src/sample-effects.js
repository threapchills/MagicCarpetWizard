export const EFFECT_ASSETS = ['shoot', 'hit', 'death', 'fall', 'land', 'munch', 'jump', 'portal'];

// All effects are excerpts from the user's recordings. Each cue has a short
// retrigger limit, and the shared voice pool stays bounded during large volleys.
export const CUES = {
  fire: { asset: 'shoot', gain: .85, rate: .88, gap: .08 },
  storm: { asset: 'shoot', gain: .8, rate: 1.5, gap: .10 },
  wind: { asset: 'fall', gain: 1.15, rate: 1.25, gap: .22, length: .8 },
  fireImpact: { asset: 'land', gain: 1.2, rate: .78, gap: .10 },
  stormImpact: { asset: 'hit', gain: 1.05, rate: 1.3, gap: .12 },
  windImpact: { asset: 'land', gain: .95, rate: 1.4, gap: .15 },
  collect: { asset: 'portal', gain: .50, rate: 1.5, length: .35, gap: .13 },
  trick: { asset: 'jump', gain: 1, rate: 1.15, gap: .35 },
  hit: { asset: 'hit', gain: 1.25, rate: .86, gap: .18 },
  kill: { asset: 'munch', gain: 1.3, rate: .85, gap: .12 },
  death: { asset: 'death', gain: 1.1, rate: .90, gap: 1 },
  roar: { asset: 'death', gain: .85, rate: .62, gap: 1.5 },
  thunder: { asset: 'fall', gain: 1.1, rate: .60, gap: 2 },
};

export class SampleEffects {
  constructor(ctx, output, { baseUrl, fetcher = url => globalThis.fetch(url) } = {}) {
    Object.assign(this, { ctx, output, baseUrl, fetcher });
    this.buffers = new Map(); this.pending = new Map(); this.failed = new Map(); this.lastCue = new Map(); this.voices = new Set(); this.enabled = true; this.epoch = 0;
  }
  async load(asset) {
    if (this.buffers.has(asset)) return this.buffers.get(asset);
    if (this.pending.has(asset)) return this.pending.get(asset);
    if ((this.failed.get(asset) || 0) > this.ctx.currentTime) return null;
    const task = (async () => {
      try {
        const r = await this.fetcher(new URL(`${asset}.mp3`, this.baseUrl).href);
        if (!r.ok) throw new Error('Effect unavailable');
        const buffer = await this.ctx.decodeAudioData(await r.arrayBuffer());
        this.buffers.set(asset, buffer); this.failed.delete(asset); return buffer;
      } catch { this.failed.set(asset, this.ctx.currentTime + 30); return null; }
      finally { this.pending.delete(asset); }
    })();
    this.pending.set(asset, task); return task;
  }
  preload() { return Promise.all(EFFECT_ASSETS.map(asset => this.load(asset))); }
  setEnabled(enabled) { this.enabled = enabled; if (!enabled) this.stop(); }
  stop() {
    this.epoch++;
    for (const voice of [...this.voices]) { try { voice.source.stop(); } catch { /* Already stopped. */ } voice.cleanup(); }
    this.lastCue.clear();
  }
  async play(cueName) {
    const cue = CUES[cueName]; if (!cue || !this.enabled) return;
    const now = this.ctx.currentTime;
    if (now - (this.lastCue.get(cueName) ?? -Infinity) < cue.gap) return;
    this.lastCue.set(cueName, now); const epoch = this.epoch;
    const buffer = this.buffers.get(cue.asset) || await this.load(cue.asset);
    if (!buffer || !this.enabled || epoch !== this.epoch || this.ctx.currentTime - now > .2) return;
    if (this.voices.size >= 16) { const oldest = this.voices.values().next().value; oldest.source.stop(); oldest.cleanup(); }
    const source = this.ctx.createBufferSource(), envelope = this.ctx.createGain(), pan = this.ctx.createStereoPanner();
    source.buffer = buffer; const rate = cue.rate * (.97 + Math.random() * .06); source.playbackRate.value = rate;
    const t = this.ctx.currentTime, duration = Math.min(cue.length || 4, buffer.duration / rate);
    envelope.gain.setValueAtTime(0, t); envelope.gain.linearRampToValueAtTime(cue.gain, t + .004);
    envelope.gain.setValueAtTime(cue.gain, t + Math.max(.005, duration - .03)); envelope.gain.linearRampToValueAtTime(0, t + duration);
    pan.pan.value = (Math.random() - .5) * .16;
    source.connect(envelope).connect(pan).connect(this.output);
    let cleaned = false;
    const voice = { source, cleanup: () => { if (cleaned) return; cleaned = true; this.voices.delete(voice); source.disconnect(); envelope.disconnect(); pan.disconnect(); } };
    this.voices.add(voice); source.onended = voice.cleanup; source.start(t); source.stop(t + duration + .01);
  }
}
