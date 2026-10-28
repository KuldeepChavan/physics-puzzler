// ── Pooled FX systems — particles, floating score texts, shockwave rings ────
// Zero per-frame allocation: fixed pools, swap-remove, additive glow sprites.

import { PALETTE, rand } from './core';

interface P {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  grav: number;
  drag: number;
  ci: number;
}

const MAX_P = 420;

export class Particles {
  private ps: P[] = [];

  clear() {
    this.ps.length = 0;
  }

  private push(p: P) {
    if (this.ps.length >= MAX_P) this.ps.shift();
    this.ps.push(p);
  }

  burst(x: number, y: number, ci: number, count: number, speed: number, size = 3, life = 0.55, grav = 1100) {
    for (let i = 0; i < count; i++) {
      const a = rand(Math.PI * 2);
      const s = rand(0.25, 1) * speed;
      const L = life * rand(0.6, 1.15);
      this.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - speed * 0.22,
        life: L,
        max: L,
        size: size * rand(0.6, 1.5),
        grav,
        drag: rand(0.9, 0.965),
        ci,
      });
    }
  }

  confetti(x: number, y: number, count = 48) {
    const cols = [0, 1, 2, 3, 5];
    for (let i = 0; i < count; i++) {
      const a = rand(Math.PI * 2);
      const s = rand(120, 520);
      const L = rand(0.8, 1.5);
      this.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 160,
        life: L,
        max: L,
        size: rand(2.4, 4.6),
        grav: 1500,
        drag: 0.975,
        ci: cols[Math.floor(rand(cols.length))],
      });
    }
  }

  dust(x: number, y: number) {
    const L = rand(1.6, 2.6);
    this.push({
      x,
      y,
      vx: rand(-8, 8),
      vy: rand(-26, -10),
      life: L,
      max: L,
      size: rand(1, 2.2),
      grav: -14,
      drag: 0.995,
      ci: Math.random() < 0.6 ? 0 : 4,
    });
  }

  update(dt: number) {
    const ps = this.ps;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) {
        ps[i] = ps[ps.length - 1];
        ps.pop();
        continue;
      }
      p.vy += p.grav * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  render(ctx: CanvasRenderingContext2D, dots: HTMLCanvasElement[]) {
    const ps = this.ps;
    if (ps.length === 0) return;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      const t = p.life / p.max;
      const img = dots[p.ci];
      const s = p.size * (0.5 + t) * 4.4;
      ctx.globalAlpha = Math.min(1, t * 1.6);
      ctx.drawImage(img, p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ── floating texts ──────────────────────────────────────────────────────────

interface FT {
  x: number;
  y: number;
  text: string;
  ci: number;
  size: number;
  t: number;
  max: number;
  vy: number;
  big: boolean;
}

export class FloatTexts {
  private ts: FT[] = [];

  clear() {
    this.ts.length = 0;
  }

  spawn(x: number, y: number, text: string, ci: number, size: number, big = false) {
    if (this.ts.length > 24) this.ts.shift();
    this.ts.push({ x, y, text, ci, size, t: 0, max: big ? 1.25 : 0.85, vy: big ? 34 : 58, big });
  }

  update(dt: number) {
    const ts = this.ts;
    for (let i = ts.length - 1; i >= 0; i--) {
      const t = ts[i];
      t.t += dt;
      t.y -= t.vy * dt;
      if (t.t >= t.max) {
        ts[i] = ts[ts.length - 1];
        ts.pop();
      }
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    const ts = this.ts;
    if (ts.length === 0) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i];
      const k = t.t / t.max;
      const alpha = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35;
      const pop = t.big ? 1 + Math.max(0, 1 - k * 5) * 0.4 : 1;
      ctx.globalAlpha = alpha;
      ctx.font = `800 ${Math.round(t.size * pop)}px Orbitron, sans-serif`;
      ctx.fillStyle = PALETTE[t.ci];
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}

// ── shockwave rings ─────────────────────────────────────────────────────────

interface R {
  x: number;
  y: number;
  ci: number;
  max: number;
  t: number;
  dur: number;
}

export class Rings {
  private rs: R[] = [];

  clear() {
    this.rs.length = 0;
  }

  spawn(x: number, y: number, ci: number, max = 70, dur = 0.45) {
    if (this.rs.length > 12) this.rs.shift();
    this.rs.push({ x, y, ci, max, t: 0, dur });
  }

  update(dt: number) {
    const rs = this.rs;
    for (let i = rs.length - 1; i >= 0; i--) {
      rs[i].t += dt;
      if (rs[i].t >= rs[i].dur) {
        rs[i] = rs[rs.length - 1];
        rs.pop();
      }
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    const rs = this.rs;
    if (rs.length === 0) return;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i];
      const k = r.t / r.dur;
      const e = 1 - (1 - k) * (1 - k); // easeOutQuad
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = PALETTE[r.ci];
      ctx.lineWidth = 1 + (1 - k) * 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 4 + e * r.max, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
