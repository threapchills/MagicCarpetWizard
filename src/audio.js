export class Soundscape {
  constructor() { this.enabled = false; this.ctx = null; this.beat = 0; this.clock = 0; }
  async toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      try { this.ctx ??= new (window.AudioContext || window.webkitAudioContext)(); await this.ctx.resume(); } catch { this.enabled = false; }
    }
    return this.enabled;
  }
  tone(freq, duration = .3, type = 'sine', gain = .06, slide = 1) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime, osc = this.ctx.createOscillator(), envelope = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t); osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + duration);
    envelope.gain.setValueAtTime(0, t); envelope.gain.linearRampToValueAtTime(gain, t + .008); envelope.gain.exponentialRampToValueAtTime(.001, t + duration);
    osc.connect(envelope); envelope.connect(this.ctx.destination); osc.start(); osc.stop(t + duration + .02);
  }
  collect() { this.tone(880, .16, 'sine', .035, 1.5); }
  spell() { this.tone(260, .17, 'triangle', .025, 2.7); }
  hit() { this.tone(120, .25, 'sawtooth', .035, .3); }
  kill() { this.tone(330, .25, 'triangle', .04, 2); this.tone(495, .35, 'sine', .025); }
  trick() { this.tone(660, .5, 'sine', .045, 2); }
  update(dt, running, boost) {
    if (!this.enabled) return;
    this.clock -= dt;
    if (this.clock > 0) return;
    this.clock = boost ? .23 : .31;
    const notes = [220, 246.94, 277.18, 329.63, 369.99, 440, 493.88, 554.37];
    const melody = [0, 2, 4, 5, 4, 2, 1, 4, 2, 0, 4, 6, 5, 4, 2, 1];
    const b = this.beat++;
    if (b % 2 === 0) this.tone(notes[melody[(b / 2) % melody.length]], .5, 'triangle', .018);
    if (b % 8 === 0) this.tone(b % 32 < 16 ? 110 : 82.4, 1.6, 'sine', .035);
    if (running && b % 2 === 0) this.tone(b % 4 === 0 ? 100 : 170, .1, 'sine', .028, .4);
  }
}
