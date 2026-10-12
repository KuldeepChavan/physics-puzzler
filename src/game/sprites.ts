// ── Pre-rendered sprites — every glow is baked once, drawn with drawImage ───
// This is what keeps us at 60fps: zero shadowBlur / gradient work per frame.

import { BALL_TIER, MULT_TINT, PALETTE, PegKind } from './core';

export interface Sprites {
  dots: HTMLCanvasElement[]; // soft additive glow dots, one per palette color
  balls: HTMLCanvasElement[]; // one per multiplier tier
  pegs: Record<PegKind, HTMLCanvasElement>;
}

const SS = 2; // supersample

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function bake(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = Math.max(2, Math.round(size * SS));
  const g = c.getContext('2d');
  if (g) {
    g.scale(SS, SS);
    draw(g, size);
  }
  (c as HTMLCanvasElement & { ls: number }).ls = size;
  return c;
}

export function spriteSize(img: HTMLCanvasElement): number {
  return (img as HTMLCanvasElement & { ls: number }).ls;
}

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement,
  x: number,
  y: number,
  scale = 1,
  rot = 0,
  alpha = 1,
) {
  const s = spriteSize(img) * scale;
  if (rot === 0 && alpha >= 1) {
    ctx.drawImage(img, x - s / 2, y - s / 2, s, s);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  if (rot !== 0) ctx.rotate(rot);
  if (alpha < 1) ctx.globalAlpha = alpha;
  ctx.drawImage(img, -s / 2, -s / 2, s, s);
  ctx.restore();
}

function bakeDot(hex: string): HTMLCanvasElement {
  const S = 64;
  return bake(S, (g) => {
    const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.18, rgba(hex, 0.9));
    grad.addColorStop(0.5, rgba(hex, 0.28));
    grad.addColorStop(1, rgba(hex, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
  });
}

function bakeBall(tier: number): HTMLCanvasElement {
  const S = 56;
  const main = PALETTE[BALL_TIER[tier]];
  const hi = MULT_TINT[tier];
  return bake(S, (g) => {
    const cx = S / 2;
    // outer aura
    const aura = g.createRadialGradient(cx, cx, 8, cx, cx, S / 2);
    aura.addColorStop(0, rgba(main, 0.35));
    aura.addColorStop(1, rgba(main, 0));
    g.fillStyle = aura;
    g.fillRect(0, 0, S, S);
    // sphere body
    const body = g.createRadialGradient(cx - 5, cx - 6, 2, cx, cx, 15);
    body.addColorStop(0, hi);
    body.addColorStop(0.45, main);
    body.addColorStop(1, '#120b2e');
    g.fillStyle = body;
    g.beginPath();
    g.arc(cx, cx, 13.5, 0, Math.PI * 2);
    g.fill();
    // rim light
    g.strokeStyle = rgba(hi, 0.85);
    g.lineWidth = 1.4;
    g.beginPath();
    g.arc(cx, cx, 13.2, 0, Math.PI * 2);
    g.stroke();
    // specular sparkle
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath();
    g.arc(cx - 4.5, cx - 5.5, 2.4, 0, Math.PI * 2);
    g.fill();
  });
}

function bakePeg(kind: PegKind): HTMLCanvasElement {
  const S = 64;
  const col =
    kind === 'score' ? PALETTE[0] : kind === 'bumper' ? PALETTE[1] : kind === 'multi' ? PALETTE[2] : '#2a9db8';
  return bake(S, (g) => {
    const cx = S / 2;
    if (kind !== 'divider') {
      const halo = g.createRadialGradient(cx, cx, 4, cx, cx, S / 2);
      halo.addColorStop(0, rgba(col, 0.32));
      halo.addColorStop(1, rgba(col, 0));
      g.fillStyle = halo;
      g.fillRect(0, 0, S, S);
    }
    // socket
    g.fillStyle = '#0c0e2a';
    g.beginPath();
    g.arc(cx, cx, kind === 'bumper' ? 11.5 : kind === 'divider' ? 8 : 9.5, 0, Math.PI * 2);
    g.fill();
    if (kind === 'multi') {
      // rotating gold diamond
      g.strokeStyle = rgba(col, 0.95);
      g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(cx, cx - 11);
      g.lineTo(cx + 11, cx);
      g.lineTo(cx, cx + 11);
      g.lineTo(cx - 11, cx);
      g.closePath();
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.beginPath();
      g.arc(cx, cx, 2.6, 0, Math.PI * 2);
      g.fill();
    } else {
      g.strokeStyle = rgba(col, kind === 'divider' ? 0.55 : 0.95);
      g.lineWidth = kind === 'bumper' ? 3.4 : 2.4;
      g.beginPath();
      g.arc(cx, cx, kind === 'bumper' ? 10 : kind === 'divider' ? 6.6 : 8, 0, Math.PI * 2);
      g.stroke();
      if (kind === 'bumper') {
        g.strokeStyle = rgba(col, 0.5);
        g.lineWidth = 1.6;
        g.beginPath();
        g.arc(cx, cx, 5.4, 0, Math.PI * 2);
        g.stroke();
      }
      g.fillStyle = kind === 'divider' ? rgba(col, 0.7) : 'rgba(255,255,255,0.95)';
      g.beginPath();
      g.arc(cx, cx, kind === 'bumper' ? 3 : 2.4, 0, Math.PI * 2);
      g.fill();
    }
  });
}

export function buildSprites(): Sprites {
  return {
    dots: PALETTE.map((c) => bakeDot(c)),
    balls: [0, 1, 2, 3, 4].map((t) => bakeBall(t)),
    pegs: {
      score: bakePeg('score'),
      bumper: bakePeg('bumper'),
      multi: bakePeg('multi'),
      divider: bakePeg('divider'),
    },
  };
}
