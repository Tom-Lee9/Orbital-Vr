// Station ambience made live with Web Audio: low reactor hum, air-vent hiss, occasional console chirps.
export class Ambience {
  constructor(muted) { this.muted = muted; this.ctx = null; this.next = 3; }
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.8; this.master.connect(ctx.destination);
    const g = v => { const n = ctx.createGain(); n.gain.value = v; return n; };
    for (const [f, v] of [[55, 0.05], [110, 0.025], [165.5, 0.01]]) {   // hum with a slow beat between partials
      const o = ctx.createOscillator(); o.frequency.value = f; o.connect(g(v)).connect(this.master); o.start();
    }
    const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    this.vent = g(0.04); src.connect(lp).connect(this.vent).connect(this.master); src.start();
    document.addEventListener('visibilitychange', () => document.hidden ? ctx.suspend() : ctx.resume());
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05); }
  update(dt) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    this.vent.gain.setTargetAtTime(0.03 + 0.015 * Math.sin(t * 0.3), t, 0.5);
    if (t > this.next) {                       // soft two-tone console blip
      this.next = t + 6 + Math.random() * 12;
      for (const [k, f] of [[0, 1320], [0.12, 1760]]) {
        const o = this.ctx.createOscillator(), e = this.ctx.createGain(); o.frequency.value = f * (0.9 + Math.random() * 0.2);
        e.gain.setValueAtTime(0.0001, t + k); e.gain.exponentialRampToValueAtTime(0.02, t + k + 0.01); e.gain.exponentialRampToValueAtTime(0.0001, t + k + 0.25);
        o.connect(e).connect(this.master); o.start(t + k); o.stop(t + k + 0.3);
      }
    }
  }
}
