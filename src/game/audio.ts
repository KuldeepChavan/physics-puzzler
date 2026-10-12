// ── Synthesized WebAudio SFX — no assets, all oscillators & filtered noise ──

import { LS_MUTED } from './core';

interface ToneOpts {
  f: number;
  f1?: number;
  d?: number;
  type?: OscillatorType;
  v?: number;
  dl?: number;
}

interface NoiseOpts {
  d?: number;
  v?: number;
  f?: number;
  f1?: number;
  dl?: number;
  type?: BiquadFilterType;
}

export class SFX {
  muted = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  constructor() {
    try {
      this.muted = localStorage.getItem(LS_MUTED) === '1';
    } catch {
      this.muted = false;
    }
  }

  unlock() {
    try {
      if (!this.ctx) {
        const AC: typeof AudioContext =
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.42;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = buf;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      /* audio unavailable — stay silent */
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      localStorage.setItem(LS_MUTED, m ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.42, this.ctx.currentTime, 0.02);
    }
  }

  private tone(o: ToneOpts) {
    if (!this.ctx || !this.master) return;
    try {
      const t = this.ctx.currentTime + (o.dl ?? 0);
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = o.type ?? 'sine';
      osc.frequency.setValueAtTime(o.f, t);
      if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + (o.d ?? 0.1));
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(o.v ?? 0.3, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (o.d ?? 0.1));
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + (o.d ?? 0.1) + 0.05);
    } catch {
      /* ignore */
    }
  }

  private noise(o: NoiseOpts) {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    try {
      const t = this.ctx.currentTime + (o.dl ?? 0);
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const fl = this.ctx.createBiquadFilter();
      fl.type = o.type ?? 'lowpass';
      fl.frequency.setValueAtTime(o.f ?? 1200, t);
      if (o.f1) fl.frequency.exponentialRampToValueAtTime(o.f1, t + (o.d ?? 0.15));
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(o.v ?? 0.25, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (o.d ?? 0.15));
      src.connect(fl);
      fl.connect(g);
      g.connect(this.master);
      src.start(t);
      src.stop(t + (o.d ?? 0.15) + 0.05);
    } catch {
      /* ignore */
    }
  }

  // Pentatonic pop ladder — each consecutive peg hit climbs the scale.
  peg(step: number) {
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];
    const s = scale[Math.min(Math.max(step, 0), scale.length - 1)];
    const f = 392 * Math.pow(2, s / 12);
    this.tone({ f, d: 0.12, type: 'sine', v: 0.3 });
    this.tone({ f: f * 2, d: 0.07, type: 'triangle', v: 0.09 });
  }

  tick() {
    this.tone({ f: 340, d: 0.03, v: 0.05, type: 'sine' });
  }

  bumper() {
    this.tone({ f: 170, f1: 58, d: 0.14, type: 'sawtooth', v: 0.18 });
    this.noise({ d: 0.12, v: 0.12, f: 900, f1: 200 });
  }

  multi() {
    [0, 4, 7].forEach((s, i) =>
      this.tone({ f: 523 * Math.pow(2, s / 12), d: 0.24, dl: i * 0.02, type: 'triangle', v: 0.15 }),
    );
  }

  catch(tier: number) {
    const base = [330, 392, 523][Math.min(tier, 2)];
    [0, 4, 7, 12].forEach((s, i) =>
      this.tone({ f: base * Math.pow(2, s / 12), d: 0.16, dl: i * 0.035, v: 0.2, type: 'sine' }),
    );
  }

  drone() {
    [0, 4, 7, 11, 14, 19].forEach((s, i) =>
      this.tone({ f: 440 * Math.pow(2, s / 12), d: 0.3, dl: i * 0.045, v: 0.17, type: 'triangle' }),
    );
    this.noise({ d: 0.5, v: 0.08, f: 3000, type: 'highpass' });
  }

  launch() {
    this.noise({ d: 0.16, v: 0.15, f: 1800, f1: 300 });
    this.tone({ f: 240, f1: 120, d: 0.12, v: 0.1, type: 'triangle' });
  }

  milestone() {
    [12, 16, 19, 24].forEach((s, i) =>
      this.tone({ f: 261.6 * Math.pow(2, s / 12), d: 0.22, dl: i * 0.05, v: 0.15 }),
    );
  }

  over() {
    [19, 14, 7, 0].forEach((s, i) =>
      this.tone({ f: 220 * Math.pow(2, s / 12), d: 0.4, dl: i * 0.14, v: 0.16, type: 'sawtooth' }),
    );
  }

  ui() {
    this.tone({ f: 740, d: 0.05, v: 0.12, type: 'square' });
  }
}
