// ── PRISMFALL core constants & shared types ─────────────────────────────────

export const BOARD_W = 480;
export const BOARD_H = 800;
export const WALL = 16;
export const INNER_L = WALL;
export const INNER_R = BOARD_W - WALL;
export const RAIL_Y = 96;
export const SPAWN_Y = RAIL_Y + 34;
export const DRONE_Y = 596;
export const KILL_Y = 700;
export const SLOT_COUNT = 5;
export const SLOT_W = (INNER_R - INNER_L) / SLOT_COUNT;
export const SLOT_VALUES = [100, 250, 500, 250, 100];
export const SLOT_TIERS = [0, 1, 2, 1, 0]; // palette indexes per slot

export const GRAVITY = 2300;
export const MAX_FALL = 1600;
export const BALL_R = 11;
export const STEP = 1 / 120;
export const START_BALLS = 8;
export const MILESTONE = 7500;
export const DROP_COOLDOWN = 0.55;

// palette indexes
export const C = {
  cyan: 0,
  magenta: 1,
  gold: 2,
  green: 3,
  violet: 4,
  white: 5,
  orange: 6,
} as const;

export const PALETTE = [
  '#25e6ff', // cyan
  '#ff3df2', // magenta
  '#ffd166', // gold
  '#4ade80', // green
  '#8b5cf6', // violet
  '#ffffff', // white
  '#ff9d3d', // orange
];

// ball multiplier tier (mult 1..5) → palette index
export const BALL_TIER = [C.cyan, C.green, C.gold, C.orange, C.magenta];
export const MULT_TINT = ['#bdf3ff', '#dcffe4', '#fff3c4', '#ffd9a8', '#ffd6ff'];

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const rand = (a = 1, b?: number) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type PegKind = 'score' | 'bumper' | 'multi' | 'divider';

export interface Peg {
  x: number;
  y: number;
  r: number;
  kind: PegKind;
  flash: number;
  cool: number;
  rot: number;
}

export interface TrailPt {
  x: number;
  y: number;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  mult: number;
  combo: number;
  life: number;
  spin: number;
  dead: boolean;
  trail: TrailPt[];
}

export interface HudStats {
  score: number;
  balls: number;
  mult: number;
  best: number;
}

export const LS_BEST = 'prismfall-best';
export const LS_SCORES = 'prismfall-scores-v1';
export const LS_MUTED = 'prismfall-muted';
