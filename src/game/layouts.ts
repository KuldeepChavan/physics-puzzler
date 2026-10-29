// ── Peg field layouts — three rotating board patterns ───────────────────────

import { INNER_L, INNER_R, Peg } from './core';

const SPAN = INNER_R - INNER_L;
const px = (u: number) => INNER_L + u * SPAN;
const j = (n: number) => (Math.random() * 2 - 1) * n;
const clampU = (v: number) => Math.min(0.97, Math.max(0.03, v));

const mk = (u: number, y: number, kind: Peg['kind']): Peg => ({
  x: px(u),
  y,
  r: kind === 'bumper' ? 10 : kind === 'divider' ? 7 : 8,
  kind,
  flash: 0,
  cool: 0,
  rot: Math.random() * Math.PI * 2,
});

export const LAYOUT_COUNT = 5;

export function buildLayout(idx: number): Peg[] {
  const pegs: Peg[] = [];
  const v = ((idx % LAYOUT_COUNT) + LAYOUT_COUNT) % LAYOUT_COUNT;

  if (v === 0) {
    // CASCADE GARDEN — offset grid, bumper spine, gold multi corners
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 7; c++) {
        const off = r % 2 === 1 ? 0.5 : 0;
        const u = (c + 0.5 + off) / 7;
        if (u > 0.97) continue;
        let kind: Peg['kind'] = 'score';
        if (r === 2 && (c === 2 || c === 4)) kind = 'bumper';
        else if ((r === 0 && (c === 0 || c === 6)) || (r === 4 && c === 3)) kind = 'multi';
        else if (r === 5 && (c === 1 || c === 5)) kind = 'bumper';
        pegs.push(mk(clampU(u + j(0.012)), 196 + r * 58 + j(6), kind));
      }
    }
  } else if (v === 1) {
    // THE FUNNEL — rows narrow toward the hot center slot
    const widths = [7, 6, 5, 4, 3];
    widths.forEach((cols, r) => {
      for (let c = 0; c < cols; c++) {
        const u = 0.5 + (c - (cols - 1) / 2) * 0.105;
        let kind: Peg['kind'] = 'score';
        if (r === 0 && (c === 0 || c === cols - 1)) kind = 'multi';
        else if (r === 3 && (c === 1 || c === 2)) kind = 'bumper';
        else if (r === 4 && c === 1) kind = 'multi';
        pegs.push(mk(clampU(u + j(0.012)), 200 + r * 62 + j(6), kind));
      }
    });
    for (let r = 0; r < 4; r++) {
      pegs.push(mk(0.07, 226 + r * 62, r === 1 ? 'bumper' : 'score'));
      pegs.push(mk(0.93, 226 + r * 62, r === 2 ? 'bumper' : 'score'));
    }
  } else if (v === 2) {
    // TWIN SPIRES — two vertical towers with a bridging arc
    for (let r = 0; r < 5; r++) {
      pegs.push(mk(0.27 + j(0.01), 200 + r * 64, r === 2 ? 'multi' : 'score'));
      pegs.push(mk(0.73 + j(0.01), 200 + r * 64, r === 2 ? 'multi' : 'score'));
    }
    const arcs: ReadonlyArray<readonly [number, number]> = [
      [0.4, 250],
      [0.6, 250],
      [0.5, 320],
      [0.38, 386],
      [0.62, 386],
      [0.5, 452],
    ];
    arcs.forEach(([u, y], i) => pegs.push(mk(u, y, i === 2 || i === 5 ? 'bumper' : 'score')));
    pegs.push(mk(0.08, 300, 'multi'));
    pegs.push(mk(0.92, 300, 'multi'));
    pegs.push(mk(0.13, 430, 'bumper'));
    pegs.push(mk(0.87, 430, 'bumper'));
  } else if (v === 3) {
    // PINWHEEL — three concentric rings spinning around mid-board
    const cy = 366;
    const ring = (count: number, rad: number, kindAt: (i: number) => Peg['kind'], spin = 0) => {
      for (let i = 0; i < count; i++) {
        const a = spin + (i / count) * Math.PI * 2;
        pegs.push(mk(clampU(0.5 + Math.cos(a) * (rad / 448)), cy + Math.sin(a) * rad * 0.92, kindAt(i)));
      }
    };
    ring(6, 86, (i) => (i % 3 === 0 ? 'bumper' : 'score'), 0.2);
    ring(8, 152, (i) => (i % 4 === 2 ? 'multi' : 'score'), 0.43);
    ring(10, 220, (i) => (i === 0 || i === 5 ? 'bumper' : 'score'), 0.12);
    pegs.push(mk(0.09, 200, 'multi'));
    pegs.push(mk(0.91, 200, 'multi'));
    pegs.push(mk(0.07, 480, 'bumper'));
    pegs.push(mk(0.93, 480, 'bumper'));
  } else {
    // HEX POCKETS — two trap hexagons with bumper hearts
    const hex = (cu: number, chy: number, rad: number) => {
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + (i * Math.PI) / 3;
        pegs.push(
          mk(clampU(cu + Math.cos(a) * (rad / 448)), chy + Math.sin(a) * rad, i % 2 === 1 ? 'multi' : 'score'),
        );
      }
      pegs.push(mk(cu, chy, 'bumper'));
    };
    hex(0.29, 256, 76);
    hex(0.71, 452, 76);
    pegs.push(mk(0.5, 208, 'multi'));
    pegs.push(mk(0.5, 316, 'score'));
    pegs.push(mk(0.12, 420, 'score'));
    pegs.push(mk(0.88, 420, 'score'));
    pegs.push(mk(0.5, 536, 'bumper'));
    pegs.push(mk(0.17, 554, 'score'));
    pegs.push(mk(0.83, 554, 'score'));
  }

  // slot dividers — plinko rails above the score wells
  for (let i = 1; i < 5; i++) {
    const u = i / 5;
    pegs.push(mk(u, 634, 'divider'));
    pegs.push(mk(u, 672, 'divider'));
  }

  return pegs;
}
