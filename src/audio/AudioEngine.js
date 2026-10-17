import { Settings } from "../core/Settings.js";
import { clamp, rand } from "../core/math.js";

/**
 * Procedural audio (Web Audio API). No asset files needed.
 * To use real sound files later, replace the bodies of the public methods
 * (ui, cast, impact, hurt, lowMana, down, respawn, chargeVoice) and keep their signatures.
 */
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this._lastPreview = 0;
  }

  /** Browsers block audio until a user gesture. Safe to call repeatedly. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      const comp = this.ctx.createDynamicsCompressor(); // keeps overlapping sounds from clipping
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }
  setSuspended(hidden) {
    if (this.ctx) hidden ? this.ctx.suspend() : this.ctx.resume();
  }

  // ---- internals --------------------------------------------------------
  _begin() {
    if (!this.ctx) return null;
    this.master.gain.value = Math.pow(Settings.get("masterVolume"), 2) * 0.8; // squared = perceptual curve
    return this.ctx.currentTime;
  }
  _out(pan, vol) {
    const c = this.ctx,
      g = c.createGain();
    g.gain.value = vol;
    if (c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      g.connect(p);
      p.connect(this.master);
    } else g.connect(this.master);
    return g;
  }
  _osc(type, f0, f1, t0, dur, out, vol) {
    const c = this.ctx,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(out);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }
  _noise(
    t0,
    dur,
    out,
    vol,
    { type = "lowpass", f0 = 2000, f1 = 300, q = 1 } = {},
  ) {
    const c = this.ctx,
      s = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain();
    s.buffer = this.noise;
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f);
    f.connect(g);
    g.connect(out);
    s.start(t0, rand(0, 0.8));
    s.stop(t0 + dur + 0.02);
  }

  // ---- public sounds ----------------------------------------------------
  ui() {
    const t = this._begin();
    if (t === null) return;
    this._osc("triangle", 900, 600, t, 0.06, this._out(0, 0.5), 0.25);
  }
  preview() {
    // slider feedback, throttled
    const now = performance.now();
    if (now - this._lastPreview < 120) return;
    this._lastPreview = now;
    const t = this._begin();
    if (t === null) return;
    this._osc("sine", 520, 440, t, 0.12, this._out(0, 0.6), 0.4);
  }
  cast(charge, pan = 0, vol = 1) {
    const t = this._begin();
    if (t === null) return;
    const out = this._out(pan, vol),
      d = 0.35 + charge * 0.25;
    this._noise(t, d, out, 0.5, {
      type: "bandpass",
      f0: 300 + (1 - charge) * 900,
      f1: 120,
      q: 0.9,
    });
    this._osc("sine", 180 - charge * 90, 45, t, d, out, 0.7);
    this._osc("sawtooth", 500 - charge * 250, 120, t, 0.18, out, 0.12);
  }
  impact(charge, crit, pan = 0, vol = 1) {
    const t = this._begin();
    if (t === null) return;
    const out = this._out(pan, vol);
    this._osc("sine", 170 - charge * 60, 38, t, 0.28 + charge * 0.2, out, 0.9);
    this._noise(t, 0.3 + charge * 0.25, out, 0.7, {
      type: "lowpass",
      f0: 3500,
      f1: 250,
    });
    for (let i = 0; i < 3 + charge * 6; i++) {
      // crackling sparks
      this._noise(t + rand(0.02, 0.45), 0.04, out, 0.22, {
        type: "highpass",
        f0: 3200,
        f1: 2200,
      });
    }
    if (crit) this._osc("triangle", 1500, 900, t, 0.18, out, 0.25);
  }
  hurt(charge, pan = 0, vol = 1) {
    const t = this._begin();
    if (t === null) return;
    const out = this._out(pan, vol);
    this._osc("square", 120, 50, t, 0.22, out, 0.35);
    this._osc("sine", 150, 35, t, 0.3, out, 0.8);
    this._noise(t, 0.25, out, 0.6, { type: "lowpass", f0: 2200, f1: 200 });
  }
  lowMana(pan = 0, vol = 1) {
    const t = this._begin();
    if (t === null) return;
    this._osc("sawtooth", 150, 80, t, 0.12, this._out(pan, vol), 0.25);
  }
  down(pan = 0, vol = 1) {
    const t = this._begin();
    if (t === null) return;
    const out = this._out(pan, vol);
    this._osc("sawtooth", 260, 40, t, 0.9, out, 0.22);
    this._osc("sine", 160, 30, t, 1.0, out, 0.6);
    this._noise(t, 0.6, out, 0.4, { type: "lowpass", f0: 1200, f1: 100 });
  }
  respawn(pan = 0, vol = 1) {
    const t = this._begin();
    if (t === null) return;
    const out = this._out(pan, vol);
    [392, 523, 659].forEach((f, i) =>
      this._osc("sine", f, f, t + i * 0.09, 0.28, out, 0.25),
    );
  }

  /** Continuous charge hum. Returns { update(charge, pan, vol), stop() } or null if audio is locked. */
  chargeVoice() {
    if (!this.ctx) return null;
    const c = this.ctx,
      t = this._begin();
    const gain = c.createGain();
    gain.gain.value = 0;
    const filt = c.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 400;
    const o1 = c.createOscillator(),
      o2 = c.createOscillator(),
      lfo = c.createOscillator(),
      lg = c.createGain();
    o1.type = "sawtooth";
    o2.type = "triangle";
    lfo.frequency.value = 9;
    lfo.connect(lg);
    lg.connect(gain.gain); // tremolo
    o1.connect(filt);
    o2.connect(filt);
    filt.connect(gain);
    const panNode = c.createStereoPanner ? c.createStereoPanner() : null;
    if (panNode) {
      gain.connect(panNode);
      panNode.connect(this.master);
    } else gain.connect(this.master);
    [o1, o2, lfo].forEach((n) => n.start(t));
    return {
      update: (charge, pan, vol) => {
        this._begin();
        const now = c.currentTime,
          f = 80 + charge * 240,
          tc = 0.05;
        o1.frequency.setTargetAtTime(f, now, tc);
        o2.frequency.setTargetAtTime(f * 1.5, now, tc);
        filt.frequency.setTargetAtTime(300 + charge * 2200, now, tc);
        const v = vol * (0.05 + 0.09 * charge);
        gain.gain.setTargetAtTime(v, now, tc);
        lg.gain.setTargetAtTime(v * 0.25, now, tc);
        panNode?.pan.setTargetAtTime(clamp(pan, -1, 1), now, tc);
      },
      stop: () => {
        const now = c.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setTargetAtTime(0, now, 0.04);
        lg.gain.setTargetAtTime(0, now, 0.04);
        setTimeout(() => {
          [o1, o2, lfo].forEach((n) => {
            try {
              n.stop();
            } catch {
              /* already stopped */
            }
          });
          gain.disconnect();
        }, 300);
      },
    };
  }
}

export const GameAudio = new AudioEngine();
