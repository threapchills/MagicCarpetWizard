import { AmbientEngine } from './ambience.js';

export class Soundscape {
  constructor() { this.enabled = false; this.ctx = null; this.paused = false; this.ambient = null; }
  async toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      try {
        if (!this.ctx) {
          this.ctx = new (window.AudioContext || window.webkitAudioContext)();
          this.master = this.ctx.createGain(); this.master.gain.value = .8;
          this.ambienceBus = this.ctx.createGain(); this.ambienceBus.gain.value = this.paused ? 0 : .9;
          this.effectBus = this.ctx.createGain(); this.effectBus.gain.value = 1;
          const limiter = this.ctx.createDynamicsCompressor();
          limiter.threshold.value = -10; limiter.knee.value = 12; limiter.ratio.value = 5; limiter.attack.value = .005; limiter.release.value = .25;
          this.ambienceBus.connect(this.master); this.effectBus.connect(this.master); this.master.connect(limiter); limiter.connect(this.ctx.destination);
          this.ambient = new AmbientEngine(this.ctx, this.ambienceBus, { baseUrl: new URL('./audio/slumbr/', document.baseURI).href });
        }
        await this.ctx.resume();
        this.master.gain.setTargetAtTime(this.enabled ? .8 : 0, this.ctx.currentTime, .08);
        this.ambient.setEnabled(this.enabled);
      } catch { this.enabled = false; }
    } else if (this.ctx) {
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, .04);
      this.ambient.setEnabled(false);
    }
    return this.enabled;
  }
  setPaused(paused) {
    this.paused = paused;
    if (this.ctx) this.ambienceBus.gain.setTargetAtTime(paused ? 0 : .9, this.ctx.currentTime, .16);
  }
  tone(freq, duration = .3, type = 'sine', gain = .06, slide = 1) {
    if (!this.enabled || !this.ctx || this.paused) return;
    const t = this.ctx.currentTime, osc = this.ctx.createOscillator(), envelope = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t); osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + duration);
    envelope.gain.setValueAtTime(0, t); envelope.gain.linearRampToValueAtTime(gain, t + .008); envelope.gain.exponentialRampToValueAtTime(.001, t + duration);
    osc.connect(envelope); envelope.connect(this.effectBus); osc.start(); osc.stop(t + duration + .02);
    osc.onended = () => { osc.disconnect(); envelope.disconnect(); };
  }
  collect() { this.tone(880, .16, 'sine', .035, 1.5); }
  noise(duration, frequency, gain) {
    if (!this.enabled || !this.ctx || this.paused) return;
    const t = this.ctx.currentTime;
    if (!this.noiseBuffer) { this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate); const data = this.noiseBuffer.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1; }
    const source = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), envelope = this.ctx.createGain();
    source.buffer = this.noiseBuffer; filter.type = 'lowpass'; filter.frequency.setValueAtTime(frequency, t); filter.frequency.exponentialRampToValueAtTime(80, t + duration);
    envelope.gain.setValueAtTime(gain, t); envelope.gain.exponentialRampToValueAtTime(.001, t + duration);
    source.connect(filter); filter.connect(envelope); envelope.connect(this.effectBus); source.start(); source.stop(t + duration);
    source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); };
  }
  spell(kind = 'fire') { this.noise(kind === 'wind' ? .35 : .16, kind === 'storm' ? 8000 : 1600, .12); this.tone(kind === 'storm' ? 620 : 180, .18, 'sawtooth', .035, .3); }
  impact(kind = 'fire') { this.noise(.26, kind === 'storm' ? 6500 : 1400, .16); this.tone(85, .25, 'sine', .1, .35); }
  roar() { this.noise(.9, 520, .2); this.tone(65, .8, 'sawtooth', .07, .45); }
  hit() { this.tone(120, .25, 'sawtooth', .035, .3); }
  kill() { this.noise(.35, 1800, .15); this.tone(95, .3, 'triangle', .08, .3); }
  trick() { this.tone(660, .5, 'sine', .045, 2); }
  update(dt, environment) {
    if (!this.enabled || !this.ambient) return;
    if (this.paused !== !!environment.paused) this.setPaused(!!environment.paused);
    if (!this.paused) this.ambient.update(dt, environment);
  }
}
