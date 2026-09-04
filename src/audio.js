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
  spell() { this.tone(260, .17, 'triangle', .025, 2.7); }
  hit() { this.tone(120, .25, 'sawtooth', .035, .3); }
  kill() { this.tone(330, .25, 'triangle', .04, 2); this.tone(495, .35, 'sine', .025); }
  trick() { this.tone(660, .5, 'sine', .045, 2); }
  update(dt, environment) {
    if (!this.enabled || !this.ambient) return;
    if (this.paused !== !!environment.paused) this.setPaused(!!environment.paused);
    if (!this.paused) this.ambient.update(dt, environment);
  }
}
