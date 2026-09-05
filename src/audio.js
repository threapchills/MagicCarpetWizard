import { AmbientEngine } from './ambience.js';
import { SampleEffects } from './sample-effects.js';

export class Soundscape {
  constructor({ contextFactory, baseUrl, fetcher, storage } = {}) {
    this.enabled = false; this.ctx = null; this.paused = false; this.keepAmbience = false; this.ambient = null; this.effects = null; this.epoch = 0; this.error = false;
    this.contextFactory = contextFactory || (() => new (window.AudioContext || window.webkitAudioContext)());
    this.baseUrl = baseUrl; this.fetcher = fetcher; this.environment = {};
    this.muted = false; this.ambienceVolume = .85; this.effectsVolume = .8;
    try {
      this.storage = storage || globalThis.localStorage;
      this.muted = this.storage?.getItem('mcw-muted') === 'true';
      for (const key of ['ambienceVolume', 'effectsVolume']) {
        const value = this.storage?.getItem('mcw-' + key);
        if (value != null && Number.isFinite(Number(value))) this[key] = Math.max(0, Math.min(1, Number(value)));
      }
    } catch { /* Audio works without preference storage. */ }
  }
  save(key, value) { try { this.storage?.setItem('mcw-' + key, String(value)); } catch { /* Optional. */ } }
  async start() {
    if (this.muted) return false;
    const epoch = ++this.epoch, wasEnabled = this.enabled;
    try {
      if (!this.ctx) {
        this.ctx = this.contextFactory();
        this.master = this.ctx.createGain(); this.master.gain.value = 0;
        this.ambienceBus = this.ctx.createGain(); this.effectBus = this.ctx.createGain();
        const limiter = this.ctx.createDynamicsCompressor();
        limiter.threshold.value = -3; limiter.knee.value = 3; limiter.ratio.value = 8; limiter.attack.value = .003; limiter.release.value = .18;
        this.ambienceBus.connect(this.master); this.effectBus.connect(this.master); this.master.connect(limiter); limiter.connect(this.ctx.destination);
        const base = this.baseUrl || new URL('./audio/', document.baseURI).href;
        this.ambient = new AmbientEngine(this.ctx, this.ambienceBus, { baseUrl: new URL('slumbr/', base).href, fetcher: this.fetcher });
        this.effects = new SampleEffects(this.ctx, this.effectBus, { baseUrl: new URL('effects/', base).href, fetcher: this.fetcher });
      }
      // Called directly from Take Flight / M, before awaiting any fetch, so the
      // browser receives the user's audio-unlock gesture synchronously.
      const resume = this.ctx.resume();
      this.enabled = true; this.error = false;
      if (!wasEnabled) { this.ambient.failed.clear(); this.effects.failed.clear(); this.ambient.setEnabled(true); }
      this.effects.setEnabled(!this.paused);
      this.applyMix(); this.ambient.update(1, this.environment); void this.effects.preload();
      await resume;
      if (epoch !== this.epoch || this.muted) return false;
      this.master.gain.setTargetAtTime(.9, this.ctx.currentTime, .06);
      return true;
    } catch {
      if (epoch === this.epoch) { this.enabled = false; this.error = true; this.ambient?.setEnabled(false); this.effects?.setEnabled(false); }
      return false;
    }
  }
  async toggle() {
    this.muted = this.enabled; this.save('muted', this.muted);
    if (!this.muted) return this.start();
    this.epoch++; this.enabled = false;
    if (this.ctx) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, .025);
    this.ambient?.setEnabled(false); this.effects?.setEnabled(false); return false;
  }
  applyMix() {
    if (!this.ctx) return;
    this.ambienceBus.gain.setTargetAtTime(this.paused && !this.keepAmbience ? 0 : this.ambienceVolume, this.ctx.currentTime, .10);
    this.effectBus.gain.setTargetAtTime(this.paused ? 0 : this.effectsVolume, this.ctx.currentTime, .04);
  }
  setVolume(kind, value) {
    if (!['ambience', 'effects'].includes(kind) || !Number.isFinite(value)) return;
    const key = kind + 'Volume'; this[key] = Math.max(0, Math.min(1, value)); this.save(key, this[key]); this.applyMix();
  }
  setPaused(paused) {
    this.paused = paused; this.applyMix(); this.effects?.setEnabled(this.enabled && !paused);
  }
  play(cue) { if (this.enabled && !this.paused) void this.effects?.play(cue); }
  spell(kind = 'fire') { this.play(kind); }
  impact(kind = 'fire') { this.play(kind + 'Impact'); }
  collect() { this.play('collect'); }
  trick() { this.play('trick'); }
  hit() { this.play('hit'); }
  kill() { this.play('kill'); }
  death() { this.play('death'); }
  roar() { this.play('roar'); }
  thunder() { this.play('thunder'); }
  status() {
    if (this.error) return 'Audio could not start · press M to retry';
    if (this.muted) return 'Sound muted · press M to enable';
    if (!this.enabled) return 'Sound starts when you take flight · M to preview';
    if (this.ctx?.state === 'suspended') return 'Audio waiting · press M to retry';
    if (this.paused && !this.keepAmbience) return 'Sound paused with the game';
    if (!this.ambienceVolume) return 'Ambience volume is at zero';
    const audible = [...(this.ambient?.voices || [])].filter(v => v.asset === this.ambient.layers.get(v.role)?.asset).length;
    if (audible) return `Ambience playing · ${audible} active layers`;
    if (this.ambient?.failed.size) return 'Ambience unavailable · toggle M to retry';
    return 'Loading ambience…';
  }
  update(dt, environment) {
    this.environment = environment;
    if (this.keepAmbience !== !!environment.keepAmbience) { this.keepAmbience = !!environment.keepAmbience; this.applyMix(); }
    if (!this.enabled || !this.ambient) return;
    if (this.paused !== !!environment.paused) this.setPaused(!!environment.paused);
    if (!this.paused || this.keepAmbience) this.ambient.update(dt, environment);
  }
}
