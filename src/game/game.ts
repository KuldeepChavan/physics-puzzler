// ── PRISMFALL 2.0 — game orchestration: sim, render, input, juice ───────────
// Fixed 120Hz physics substeps behind a rAF loop. Nova balls (x2), Overdrive
// streaks (global x2), achievements, run stats, and a live music mix.

import {
  BALL_R,
  BOARD_H,
  BOARD_W,
  C,
  DROP_COOLDOWN,
  GRAVITY,
  INNER_L,
  INNER_R,
  KILL_Y,
  LS_ACH,
  LS_BEST,
  MAX_FALL,
  MILESTONE,
  NOVA_CYCLE,
  OVERDRIVE_TIME,
  PALETTE,
  RAIL_Y,
  SLOT_COUNT,
  SLOT_VALUES,
  SLOT_W,
  SPAWN_Y,
  STEP,
  START_BALLS,
  STREAK_TARGET,
  DRONE_Y,
  BALL_TIER,
  clamp,
  rand,
} from './core';
import type { Ball, HudStats, Peg, RunStats } from './core';
import { SFX } from './audio';
import { LAYOUT_COUNT, buildLayout } from './layouts';
import { FloatTexts, Particles, Rings } from './particles';
import { buildSprites, drawSprite, rgba } from './sprites';
import type { Sprites } from './sprites';

export type Mode = 'menu' | 'playing' | 'paused' | 'over';

export interface GameEvents {
  onMode: (m: Mode) => void;
  onStats: (s: HudStats) => void;
  onMuted: (m: boolean) => void;
  onGameOver: (score: number, stats: RunStats) => void;
  onAchievement: (id: string) => void;
}

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

const PEG_GLOW: Record<Peg['kind'], number> = { score: C.cyan, bumper: C.magenta, multi: C.gold, divider: C.cyan };
const NOVA_SPRITE = 5;

export class Game {
  private cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private ev: GameEvents;
  private sprites: Sprites;
  private sfx = new SFX();
  private parts = new Particles();
  private ftexts = new FloatTexts();
  private rings = new Rings();

  mode: Mode = 'menu';

  private dpr = 1;
  private view = { w: 1, h: 1 };
  private board = { x: 0, y: 0, s: 1 };
  private staticC: HTMLCanvasElement | null = null;

  // sim state
  private pegs: Peg[] = [];
  private balls: Ball[] = [];
  private score = 0;
  private ballsLeft = START_BALLS;
  private best = 0;
  private nextMilestone = MILESTONE;
  private droneT = rand(Math.PI * 2);
  private slotFlash: number[] = new Array(SLOT_COUNT).fill(0);
  private px = BOARD_W / 2;
  private ptx = BOARD_W / 2;
  private cool = 0;
  private layoutIdx = Math.floor(rand(LAYOUT_COUNT));
  private hasDropped = false;
  private celebrate = false;

  // v2 systems
  private streakSeal = 0;
  private overdrive = 0;
  private achSet = new Set<string>();
  private rs: RunStats = { pegs: 0, drones: 0, topCombo: 1, bestPlay: 0, overdrives: 0, drops: 0 };

  // juice
  private trauma = 0;
  private hitstop = 0;
  private time = 0;
  private dustT = 0;
  private demoT = 0;
  private celebT = 0;

  private raf = 0;
  private lastT = 0;
  private acc = 0;
  private lastStatsKey = '';
  private keys = new Set<string>();
  private pointerHeld = false;
  private twinkle: { x: number; y: number; s: number; p: number; sp: number; ci: number }[] = [];

  constructor(canvas: HTMLCanvasElement, ev: GameEvents) {
    this.cv = canvas;
    this.ev = ev;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D unsupported');
    this.ctx = ctx;
    this.sprites = buildSprites();
    try {
      this.best = Number(localStorage.getItem(LS_BEST) || 0) || 0;
      const raw = localStorage.getItem(LS_ACH);
      if (raw) {
        const a = JSON.parse(raw);
        if (Array.isArray(a)) this.achSet = new Set(a as string[]);
      }
    } catch {
      /* fresh profile */
    }
    this.pegs = buildLayout(this.layoutIdx);

    window.addEventListener('resize', this.onResize);
    window.addEventListener('orientationchange', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('visibilitychange', this.onVisibility);
    canvas.addEventListener('pointerdown', this.onPointerDown, { passive: false });
    canvas.addEventListener('pointermove', this.onPointerMove, { passive: false });
    canvas.addEventListener('pointerup', this.onPointerUp, { passive: false });
    canvas.addEventListener('pointercancel', this.onPointerUp, { passive: false });
    canvas.addEventListener('contextmenu', this.onContextMenu);

    this.onResize();
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      void document.fonts.ready.then(() => this.buildStatic());
    }
    this.ev.onMuted(this.sfx.muted);
    this.pushStats(true);
    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.sfx.dispose();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('orientationchange', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.cv.removeEventListener('pointerdown', this.onPointerDown);
    this.cv.removeEventListener('pointermove', this.onPointerMove);
    this.cv.removeEventListener('pointerup', this.onPointerUp);
    this.cv.removeEventListener('pointercancel', this.onPointerUp);
    this.cv.removeEventListener('contextmenu', this.onContextMenu);
  }

  // ── public controls ───────────────────────────────────────────────────────

  startGame() {
    this.sfx.unlock();
    this.sfx.ui();
    this.score = 0;
    this.ballsLeft = START_BALLS;
    this.nextMilestone = MILESTONE;
    this.balls.length = 0;
    this.parts.clear();
    this.ftexts.clear();
    this.rings.clear();
    this.slotFlash.fill(0);
    const next = Math.floor(rand(LAYOUT_COUNT - 0.001));
    this.layoutIdx = next === this.layoutIdx ? (next + 1) % LAYOUT_COUNT : next;
    this.pegs = buildLayout(this.layoutIdx);
    this.px = this.ptx = BOARD_W / 2;
    this.cool = 0;
    this.trauma = 0;
    this.hitstop = 0;
    this.hasDropped = false;
    this.celebrate = false;
    this.droneT = rand(Math.PI * 2);
    this.streakSeal = 0;
    this.overdrive = 0;
    this.rs = { pegs: 0, drones: 0, topCombo: 1, bestPlay: 0, overdrives: 0, drops: 0 };
    this.setMode('playing');
    this.pushStats(true);
  }

  restart() {
    this.startGame();
  }

  togglePause() {
    if (this.mode === 'playing') {
      this.sfx.unlock();
      this.sfx.ui();
      this.setMode('paused');
    } else if (this.mode === 'paused') {
      this.sfx.unlock();
      this.sfx.ui();
      this.setMode('playing');
    }
  }

  quitToMenu() {
    this.sfx.ui();
    this.balls.length = 0;
    this.celebrate = false;
    this.overdrive = 0;
    this.streakSeal = 0;
    this.setMode('menu');
  }

  toggleMute() {
    this.sfx.unlock();
    this.sfx.setMuted(!this.sfx.muted);
    this.ev.onMuted(this.sfx.muted);
  }

  private setMode(m: Mode) {
    this.mode = m;
    this.ev.onMode(m);
  }

  // ── events ────────────────────────────────────────────────────────────────

  private onResize = () => {
    const w = this.cv.clientWidth || window.innerWidth;
    const h = this.cv.clientHeight || window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cv.width = Math.max(2, Math.round(w * this.dpr));
    this.cv.height = Math.max(2, Math.round(h * this.dpr));
    this.view = { w, h };
    const s = Math.min((w - 16) / BOARD_W, (h - 16) / BOARD_H);
    this.board = { x: (w - BOARD_W * s) / 2, y: (h - BOARD_H * s) / 2, s };
    this.twinkle = [];
    for (let i = 0; i < 26; i++) {
      this.twinkle.push({
        x: rand(w),
        y: rand(h),
        s: rand(2, 5),
        p: rand(Math.PI * 2),
        sp: rand(1.5, 4),
        ci: Math.random() < 0.7 ? 5 : 0,
      });
    }
    this.buildStatic();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const code = e.code;
    if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW'].includes(code)) {
      e.preventDefault();
    }
    if (!e.repeat) {
      this.keys.add(code);
      if (code === 'Space' || code === 'Enter') {
        if (this.mode === 'menu') this.startGame();
        else if (this.mode === 'playing') this.drop();
        else if (this.mode === 'over') this.startGame();
        else if (this.mode === 'paused') this.togglePause();
      } else if (code === 'KeyP' || code === 'Escape') {
        if (this.mode === 'playing' || this.mode === 'paused') this.togglePause();
      } else if (code === 'KeyR') {
        if (this.mode === 'over' || this.mode === 'paused') this.restart();
      } else if (code === 'KeyM') {
        this.toggleMute();
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onVisibility = () => {
    if (document.hidden && this.mode === 'playing') this.setMode('paused');
  };

  private onContextMenu = (e: Event) => e.preventDefault();

  private aimFromClientX(clientX: number) {
    const bx = (clientX - this.board.x) / this.board.s;
    this.ptx = clamp(bx, INNER_L + 16, INNER_R - 16);
  }

  private onPointerDown = (e: PointerEvent) => {
    e.preventDefault();
    this.sfx.unlock();
    this.pointerHeld = true;
    this.aimFromClientX(e.clientX);
  };

  private onPointerMove = (e: PointerEvent) => {
    e.preventDefault();
    this.aimFromClientX(e.clientX);
  };

  private onPointerUp = (e: PointerEvent) => {
    e.preventDefault();
    if (this.pointerHeld) {
      this.pointerHeld = false;
      this.aimFromClientX(e.clientX);
      if (this.mode === 'playing') this.drop();
    }
  };

  // ── v2 helpers ────────────────────────────────────────────────────────────

  private nextIsNova() {
    return this.rs.drops % NOVA_CYCLE === NOVA_CYCLE - 1;
  }

  /** Combined score multiplier: ball combo x Nova x Overdrive */
  private scoreMult(b: Ball) {
    return b.mult * (b.nova ? 2 : 1) * (this.overdrive > 0 ? 2 : 1);
  }

  private ach(id: string) {
    if (this.achSet.has(id)) return;
    this.achSet.add(id);
    try {
      localStorage.setItem(LS_ACH, JSON.stringify([...this.achSet]));
    } catch {
      /* ignore */
    }
    this.ev.onAchievement(id);
    this.sfx.achievement();
    this.parts.confetti(BOARD_W / 2, 230, 22);
    this.ftexts.spawn(BOARD_W / 2, 240, 'ACHIEVEMENT UNLOCKED', C.gold, 15, true);
  }

  /** Track consecutive big wins; trigger Overdrive at the target. */
  private seal(big: boolean) {
    if (big) this.streakSeal++;
    else this.streakSeal = 0;
    if (this.streakSeal >= STREAK_TARGET && this.overdrive <= 0) {
      this.overdrive = OVERDRIVE_TIME;
      this.rs.overdrives++;
      this.ftexts.spawn(BOARD_W / 2, 210, 'OVERDRIVE — ALL SCORES x2', C.magenta, 20, true);
      this.rings.spawn(BOARD_W / 2, 420, C.magenta, 260, 0.7);
      this.rings.spawn(BOARD_W / 2, 420, C.white, 180, 0.5);
      this.parts.confetti(BOARD_W / 2, 420, 40);
      this.trauma = Math.min(1, this.trauma + 0.25);
      this.sfx.overdriveOn();
      this.ach('streak');
    }
  }

  private bumpCombo(mult: number) {
    if (mult > this.rs.topCombo) this.rs.topCombo = mult;
    if (mult >= 5) this.ach('max-combo');
  }

  // ── sim ───────────────────────────────────────────────────────────────────

  private drop() {
    if (this.mode !== 'playing') return;
    if (this.cool > 0 || this.ballsLeft <= 0 || this.balls.length >= 8) return;
    this.ballsLeft--;
    this.hasDropped = true;
    this.cool = DROP_COOLDOWN;
    const nova = this.nextIsNova();
    this.rs.drops++;
    this.balls.push({
      x: this.px,
      y: SPAWN_Y,
      vx: rand(-12, 12),
      vy: 40,
      r: BALL_R,
      mult: 1,
      combo: 0,
      life: 0,
      spin: 0,
      dead: false,
      nova,
      trail: [],
    });
    this.sfx.launch();
    if (nova) {
      this.sfx.tick();
      this.parts.burst(this.px, SPAWN_Y, C.gold, 20, 260, 3, 0.55, 600);
      this.rings.spawn(this.px, SPAWN_Y, C.gold, 60, 0.4);
      this.trauma = Math.min(1, this.trauma + 0.08);
    } else {
      this.parts.burst(this.px, SPAWN_Y, C.cyan, 8, 160, 2.4, 0.4, 500);
    }
    this.ach('first-drop');
  }

  private droneX() {
    return BOARD_W / 2 + Math.sin(this.droneT * 0.85) * ((INNER_R - INNER_L) / 2 - 58);
  }

  private addScore(n: number) {
    this.score += n;
    while (this.score >= this.nextMilestone) {
      this.nextMilestone += MILESTONE;
      this.ballsLeft++;
      this.ftexts.spawn(this.px, RAIL_Y + 44, '+1 BALL', C.green, 20, true);
      this.sfx.milestone();
    }
  }

  private onPegHit(b: Ball, p: Peg) {
    if (p.cool > 0) return;
    p.cool = 0.09;
    p.flash = 1;
    p.rot = rand(Math.PI * 2);
    const sm = this.scoreMult(b);
    let gain = 0;
    if (p.kind === 'score') {
      gain = 10 * sm;
      b.mult = Math.min(5, b.mult + 1);
      b.combo++;
      this.rs.pegs++;
      this.parts.burst(p.x, p.y, C.cyan, 10, 210, 2.6, 0.5);
      this.sfx.peg(b.combo);
    } else if (p.kind === 'bumper') {
      gain = 25 * sm;
      b.mult = Math.min(5, b.mult + 1);
      b.combo++;
      this.rs.pegs++;
      this.parts.burst(p.x, p.y, C.magenta, 18, 330, 3, 0.6);
      this.rings.spawn(p.x, p.y, C.magenta, 56, 0.4);
      this.trauma = Math.min(1, this.trauma + 0.1);
      this.sfx.bumper();
    } else if (p.kind === 'multi') {
      b.mult = Math.min(5, b.mult + 2);
      gain = 15 * sm;
      b.combo += 2;
      this.rs.pegs++;
      this.parts.burst(p.x, p.y, C.gold, 24, 380, 3.2, 0.65);
      this.rings.spawn(p.x, p.y, C.gold, 80, 0.5);
      this.trauma = Math.min(1, this.trauma + 0.12);
      this.sfx.multi();
    } else {
      this.parts.burst(p.x, p.y, C.cyan, 3, 120, 1.8, 0.35);
      this.sfx.tick();
    }
    this.bumpCombo(b.mult);
    if (this.rs.pegs >= 100) this.ach('peg-100');
    if (gain > 0) {
      this.addScore(gain);
      this.ftexts.spawn(p.x, p.y - p.r - 8, '+' + gain, PEG_GLOW[p.kind], gain >= 200 ? 16 : 12);
      this.trauma = Math.min(1, this.trauma + clamp(gain / 5000, 0, 0.07));
    }
  }

  private caught(b: Ball) {
    b.dead = true;
    const drx = this.droneX();
    const gain = 500 * this.scoreMult(b);
    this.addScore(gain);
    this.ballsLeft++;
    this.rs.drones++;
    if (gain > this.rs.bestPlay) this.rs.bestPlay = gain;
    this.seal(true);
    this.parts.confetti(drx, DRONE_Y, 64);
    this.rings.spawn(drx, DRONE_Y, C.gold, 130, 0.6);
    this.rings.spawn(drx, DRONE_Y, C.white, 90, 0.45);
    this.ftexts.spawn(drx, DRONE_Y - 26, '+' + gain, C.gold, 26, true);
    this.ftexts.spawn(drx, DRONE_Y + 26, '+1 BALL', C.green, 17, true);
    this.trauma = Math.min(1, this.trauma + 0.45);
    this.hitstop = Math.max(this.hitstop, 0.06);
    this.sfx.drone();
    this.ach('drone-1');
    if (this.rs.drones >= 3) this.ach('trifecta');
  }

  private resolveSlot(b: Ball) {
    b.dead = true;
    const idx = clamp(Math.floor((b.x - INNER_L) / SLOT_W), 0, SLOT_COUNT - 1);
    const base = SLOT_VALUES[idx];
    const gain = base * this.scoreMult(b);
    this.addScore(gain);
    if (gain > this.rs.bestPlay) this.rs.bestPlay = gain;
    this.seal(base >= 250);
    const cx = INNER_L + (idx + 0.5) * SLOT_W;
    const ci = base >= 500 ? C.gold : base >= 250 ? C.magenta : C.cyan;
    this.parts.burst(cx, KILL_Y, ci, 20, 320, 3.2, 0.7);
    this.rings.spawn(cx, KILL_Y - 4, ci, 70 + base * 0.12, 0.5);
    this.ftexts.spawn(cx, KILL_Y - 24, '+' + gain, ci, clamp(15 + base / 32, 16, 30), gain >= 500);
    if (b.mult >= 5) this.ftexts.spawn(cx, KILL_Y - 56, 'MAX COMBO!', C.magenta, 16, true);
    if (b.nova) {
      // supernova finisher
      this.parts.confetti(cx, KILL_Y - 10, 44);
      this.rings.spawn(cx, KILL_Y - 10, C.gold, 170, 0.7);
      this.rings.spawn(cx, KILL_Y - 10, C.orange, 120, 0.55);
      this.ftexts.spawn(cx, KILL_Y - 84, base >= 500 ? 'SUPERNOVA!' : 'NOVA BLAST', C.orange, 22, true);
      this.trauma = Math.min(1, this.trauma + 0.28);
      this.hitstop = Math.max(this.hitstop, 0.07);
      this.sfx.nova();
      if (base >= 500) this.ach('supernova');
    }
    if (base >= 500) this.ach('hot-500');
    this.slotFlash[idx] = 1;
    this.trauma = Math.min(1, this.trauma + 0.16 + base / 2200);
    this.hitstop = Math.max(this.hitstop, gain >= 1000 ? 0.05 : 0.028);
    this.sfx.catch(base >= 500 ? 2 : base >= 250 ? 1 : 0);
  }

  private step(dt: number) {
    // player movement — keyboard nudges target, pointer sets it directly
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) this.ptx -= 950 * dt;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) this.ptx += 950 * dt;
    this.ptx = clamp(this.ptx, INNER_L + 16, INNER_R - 16);
    const dx = this.ptx - this.px;
    const mx = 1150 * dt;
    this.px = clamp(this.px + clamp(dx, -mx, mx), INNER_L + 16, INNER_R - 16);
    this.cool = Math.max(0, this.cool - dt);
    this.droneT += dt;

    const drx = this.droneX();

    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.life += dt;
      b.vy = Math.min(b.vy + GRAVITY * dt, MAX_FALL);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.spin += b.vx * dt * 0.04;
      b.trail.unshift({ x: b.x, y: b.y });
      if (b.trail.length > 9) b.trail.pop();

      // walls
      if (b.x < INNER_L + b.r) {
        b.x = INNER_L + b.r;
        b.vx = Math.abs(b.vx) * 0.72;
      } else if (b.x > INNER_R - b.r) {
        b.x = INNER_R - b.r;
        b.vx = -Math.abs(b.vx) * 0.72;
      }
      if (b.y < RAIL_Y + 4 && b.vy < 0) b.vy = Math.abs(b.vy) * 0.45;

      // ball vs ball
      for (let j2 = i - 1; j2 >= 0; j2--) {
        const o = this.balls[j2];
        if (o.dead) continue;
        const ddx = b.x - o.x;
        const ddy = b.y - o.y;
        const rr2 = (b.r + o.r) * (b.r + o.r);
        const d2 = ddx * ddx + ddy * ddy;
        if (d2 > 0.0001 && d2 < rr2) {
          const d = Math.sqrt(d2);
          const nx = ddx / d;
          const ny = ddy / d;
          const ov = (b.r + o.r - d) / 2;
          b.x += nx * ov;
          b.y += ny * ov;
          o.x -= nx * ov;
          o.y -= ny * ov;
          const bn = b.vx * nx + b.vy * ny;
          const on = o.vx * nx + o.vy * ny;
          const e = 0.92;
          b.vx += (on - bn) * e * nx;
          b.vy += (on - bn) * e * ny;
          o.vx += (bn - on) * e * nx;
          o.vy += (bn - on) * e * ny;
        }
      }

      // pegs
      for (let k = 0; k < this.pegs.length; k++) {
        const p = this.pegs[k];
        const ddx = b.x - p.x;
        const ddy = b.y - p.y;
        const rad = b.r + p.r;
        const d2 = ddx * ddx + ddy * ddy;
        if (d2 >= rad * rad) continue;
        const d = Math.max(0.001, Math.sqrt(d2));
        const nx = ddx / d;
        const ny = ddy / d;
        b.x = p.x + nx * (rad + 0.2);
        b.y = p.y + ny * (rad + 0.2);
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          let e = 0.62;
          if (p.kind === 'bumper') e = 1.08;
          else if (p.kind === 'divider') e = 0.55;
          let jimp = -(1 + e) * vn;
          if (p.kind === 'bumper') jimp = Math.max(jimp, 380);
          b.vx += jimp * nx;
          b.vy += jimp * ny;
          // organic micro-jitter so drops never repeat
          const ja = rand(-0.045, 0.045);
          const cs = Math.cos(ja);
          const sn = Math.sin(ja);
          const nvx = b.vx * cs - b.vy * sn;
          const nvy = b.vx * sn + b.vy * cs;
          b.vx = nvx;
          b.vy = nvy;
        }
        this.onPegHit(b, p);
      }

      // golden drone catch
      if (!b.dead && Math.abs(b.x - drx) < 40 && Math.abs(b.y - DRONE_Y) < 19) {
        this.caught(b);
      }
      // slot resolution
      if (!b.dead && b.y > KILL_Y) {
        this.resolveSlot(b);
      }
      // failsafe
      if (!b.dead && b.life > 9) {
        this.resolveSlot(b);
      }
      if (b.dead) {
        this.balls[i] = this.balls[this.balls.length - 1];
        this.balls.pop();
      }
    }
  }

  private finish() {
    this.setMode('over');
    this.sfx.over();
    if (this.score >= 10000) this.ach('score-10k');
    if (this.score >= 25000) this.ach('score-25k');
    if (this.score > 0 && this.score >= this.best) {
      this.best = this.score;
      this.celebrate = true;
      try {
        localStorage.setItem(LS_BEST, String(this.best));
      } catch {
        /* ignore */
      }
    }
    this.ev.onGameOver(this.score, { ...this.rs });
  }

  private ambient(dt: number) {
    this.droneT += dt * 0.5;
    this.demoT -= dt;
    if (this.demoT <= 0) {
      this.demoT = rand(0.25, 0.7);
      if (this.pegs.length > 0) {
        const p = this.pegs[Math.floor(rand(this.pegs.length))];
        p.flash = Math.max(p.flash, 0.8);
      }
    }
    if (this.mode === 'over' && this.celebrate) {
      this.celebT -= dt;
      if (this.celebT <= 0) {
        this.celebT = rand(0.5, 1);
        this.parts.confetti(rand(60, BOARD_W - 60), rand(160, 420), 26);
      }
    }
  }

  private musicTarget() {
    let m = this.mode === 'playing' ? 0.42 : this.mode === 'menu' ? 0.15 : this.mode === 'paused' ? 0.1 : 0.22;
    if (this.mode === 'playing') {
      let mx = 1;
      for (let i = 0; i < this.balls.length; i++) mx = Math.max(mx, this.balls[i].mult);
      m += (mx - 1) * 0.08;
    }
    if (this.overdrive > 0) m = 1;
    return clamp(m, 0, 1);
  }

  // ── frame loop ────────────────────────────────────────────────────────────

  private tick = (t: number) => {
    this.raf = requestAnimationFrame(this.tick);
    const dtRaw = Math.min(0.05, Math.max(0.0001, (t - this.lastT) / 1000));
    this.lastT = t;
    this.time += dtRaw;

    if (this.hitstop > 0) {
      this.hitstop -= dtRaw;
      this.render();
      return;
    }
    this.trauma = Math.max(0, this.trauma - 2.4 * dtRaw);

    // peg timers always tick so menu attract mode glows
    for (let k = 0; k < this.pegs.length; k++) {
      const p = this.pegs[k];
      p.flash = Math.max(0, p.flash - 3.2 * dtRaw);
      p.cool = Math.max(0, p.cool - dtRaw);
    }
    for (let i = 0; i < SLOT_COUNT; i++) {
      this.slotFlash[i] = Math.max(0, this.slotFlash[i] - 2.6 * dtRaw);
    }

    if (this.mode === 'playing') {
      const odWas = this.overdrive;
      this.overdrive = Math.max(0, this.overdrive - dtRaw);
      if (odWas > 0 && this.overdrive === 0) this.streakSeal = 0;

      this.acc = Math.min(this.acc + dtRaw, 0.14);
      while (this.acc >= STEP) {
        this.step(STEP);
        this.acc -= STEP;
      }
      if (this.ballsLeft <= 0 && this.balls.length === 0) this.finish();
    } else if (this.mode !== 'paused') {
      this.ambient(dtRaw);
    }

    if (this.mode !== 'paused') {
      this.parts.update(dtRaw);
      this.ftexts.update(dtRaw);
      this.rings.update(dtRaw);
      this.dustT -= dtRaw;
      if (this.dustT <= 0) {
        this.dustT = 0.24;
        this.parts.dust(rand(INNER_L + 8, INNER_R - 8), rand(140, BOARD_H - 30));
      }
    }

    this.sfx.setIntensity(this.musicTarget());
    this.render();
    this.pushStats(false);
  };

  private pushStats(force: boolean) {
    let m = 1;
    for (let i = 0; i < this.balls.length; i++) m = Math.max(m, this.balls[i].mult);
    const best = Math.max(this.best, this.score);
    const nextNova = this.ballsLeft > 0 && this.nextIsNova();
    const od = Math.round(this.overdrive * 10) / 10;
    const key = `${this.score}|${this.ballsLeft}|${m}|${best}|${this.streakSeal}|${od}|${nextNova}`;
    if (force || key !== this.lastStatsKey) {
      this.lastStatsKey = key;
      this.ev.onStats({
        score: this.score,
        balls: this.ballsLeft,
        mult: m,
        best,
        streak: this.streakSeal,
        overdrive: this.overdrive,
        nextNova,
      });
    }
  }

  // ── rendering ─────────────────────────────────────────────────────────────

  private buildStatic() {
    const B = 48; // bleed for shake
    const w = this.view.w + B * 2;
    const h = this.view.h + B * 2;
    const c = document.createElement('canvas');
    c.width = Math.max(2, Math.round(w * this.dpr));
    c.height = Math.max(2, Math.round(h * this.dpr));
    const g = c.getContext('2d');
    if (!g) return;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.translate(B, B);

    // deep-space gradient
    const bg = g.createLinearGradient(0, -B, 0, this.view.h + B);
    bg.addColorStop(0, '#040211');
    bg.addColorStop(0.5, '#0a0724');
    bg.addColorStop(1, '#040211');
    g.fillStyle = bg;
    g.fillRect(-B, -B, w, h);

    // nebula blobs
    const blobs: ReadonlyArray<readonly [number, number, number, number, number]> = [
      [0.2, 0.22, 0.42, 4, 0.16],
      [0.85, 0.35, 0.38, 1, 0.13],
      [0.7, 0.85, 0.45, 0, 0.14],
      [0.1, 0.75, 0.36, 2, 0.1],
      [0.5, 0.05, 0.4, 0, 0.09],
    ];
    for (const [fx, fy, fr, ci, al] of blobs) {
      const bx = fx * this.view.w;
      const by = fy * this.view.h;
      const brad = fr * Math.max(this.view.w, this.view.h);
      const neb = g.createRadialGradient(bx, by, 0, bx, by, brad);
      neb.addColorStop(0, rgba(PALETTE[ci], al));
      neb.addColorStop(1, rgba(PALETTE[ci], 0));
      g.fillStyle = neb;
      g.fillRect(bx - brad, by - brad, brad * 2, brad * 2);
    }

    // static stars
    for (let i = 0; i < 150; i++) {
      const sx = rand(-B, this.view.w + B);
      const sy = rand(-B, this.view.h + B);
      const sr = rand(0.4, 1.5);
      g.globalAlpha = rand(0.15, 0.8);
      g.fillStyle = Math.random() < 0.12 ? '#9beaff' : '#ffffff';
      g.beginPath();
      g.arc(sx, sy, sr, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;

    // board panel
    const { x: bx, y: by, s: bs } = this.board;
    g.save();
    g.translate(bx, by);
    g.scale(bs, bs);

    rr(g, 0, 0, BOARD_W, BOARD_H, 22);
    g.fillStyle = 'rgba(9,7,28,0.74)';
    g.fill();
    const frame = g.createLinearGradient(0, 0, BOARD_W, BOARD_H);
    frame.addColorStop(0, rgba(PALETTE[0], 0.55));
    frame.addColorStop(0.5, rgba(PALETTE[4], 0.3));
    frame.addColorStop(1, rgba(PALETTE[1], 0.55));
    g.strokeStyle = frame;
    g.lineWidth = 2;
    g.stroke();
    // outer soft glow
    rr(g, -1.5, -1.5, BOARD_W + 3, BOARD_H + 3, 24);
    g.strokeStyle = rgba(PALETTE[0], 0.14);
    g.lineWidth = 6;
    g.stroke();

    // side wall glow strips
    for (const side of [0, 1]) {
      const wx = side === 0 ? 0 : BOARD_W - 16;
      const strip = g.createLinearGradient(wx + (side === 0 ? 16 : 0), 0, wx + (side === 0 ? 0 : 16), 0);
      strip.addColorStop(0, rgba(PALETTE[0], 0));
      strip.addColorStop(1, rgba(PALETTE[0], 0.28));
      g.fillStyle = strip;
      g.fillRect(wx, 18, 16, BOARD_H - 36);
    }

    // drop rail
    const rail = g.createLinearGradient(INNER_L, 0, INNER_R, 0);
    rail.addColorStop(0, rgba(PALETTE[0], 0));
    rail.addColorStop(0.5, rgba(PALETTE[0], 0.5));
    rail.addColorStop(1, rgba(PALETTE[0], 0));
    g.strokeStyle = rail;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(INNER_L + 4, RAIL_Y);
    g.lineTo(INNER_R - 4, RAIL_Y);
    g.stroke();

    // slot holograms
    for (let i = 0; i < SLOT_COUNT; i++) {
      const cx = INNER_L + (i + 0.5) * SLOT_W;
      const col = PALETTE[SLOT_VALUES[i] >= 500 ? 2 : SLOT_VALUES[i] >= 250 ? 1 : 0];
      const half = SLOT_W * 0.46;
      const trap = g.createLinearGradient(0, KILL_Y + 4, 0, 768);
      trap.addColorStop(0, rgba(col, 0.24));
      trap.addColorStop(1, rgba(col, 0.02));
      g.fillStyle = trap;
      g.beginPath();
      g.moveTo(cx - half, KILL_Y + 4);
      g.lineTo(cx + half, KILL_Y + 4);
      g.lineTo(cx + half * 0.7, 764);
      g.lineTo(cx - half * 0.7, 764);
      g.closePath();
      g.fill();
      g.strokeStyle = rgba(col, 0.5);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx - half, KILL_Y + 4);
      g.lineTo(cx + half, KILL_Y + 4);
      g.stroke();
      // value label
      g.font = '800 22px Orbitron, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = rgba(col, SLOT_VALUES[i] >= 500 ? 0.95 : 0.6);
      g.fillText(String(SLOT_VALUES[i]), cx, 734);
    }

    // divider guide lines
    g.strokeStyle = rgba(PALETTE[0], 0.1);
    g.lineWidth = 1;
    for (let i = 1; i < SLOT_COUNT; i++) {
      const gx = INNER_L + i * SLOT_W;
      g.beginPath();
      g.moveTo(gx, 618);
      g.lineTo(gx, KILL_Y + 2);
      g.stroke();
    }

    // watermark
    g.font = '700 11px Orbitron, sans-serif';
    g.textAlign = 'center';
    g.fillStyle = 'rgba(140,170,255,0.14)';
    g.fillText('P R I S M F A L L // N E O N  A R C A D E', BOARD_W / 2, 786);
    g.restore();

    // vignette
    const vg = g.createRadialGradient(
      this.view.w / 2,
      this.view.h * 0.42,
      Math.min(this.view.w, this.view.h) * 0.36,
      this.view.w / 2,
      this.view.h * 0.5,
      Math.max(this.view.w, this.view.h) * 0.82,
    );
    vg.addColorStop(0, 'rgba(2,1,10,0)');
    vg.addColorStop(1, 'rgba(2,1,10,0.6)');
    g.fillStyle = vg;
    g.fillRect(-B, -B, w, h);

    this.staticC = c;
  }

  private render() {
    const ctx = this.ctx;
    const { w, h } = this.view;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#040211';
    ctx.fillRect(0, 0, w, h);

    // trauma-based screen shake
    const amp = this.trauma * this.trauma * 15;
    const sx = amp * (Math.sin(this.time * 47.3) + Math.sin(this.time * 89.7) * 0.5) / 1.5;
    const sy = amp * (Math.cos(this.time * 53.1) + Math.sin(this.time * 71.9) * 0.5) / 1.5;

    if (this.staticC) {
      ctx.drawImage(this.staticC, 0, 0, this.staticC.width, this.staticC.height, sx - 48, sy - 48, w + 96, h + 96);
    }

    // twinkling stars (screen space, above static bg)
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.twinkle.length; i++) {
      const t = this.twinkle[i];
      const a = ((Math.sin(this.time * t.sp + t.p) + 1) / 2) * 0.5;
      if (a < 0.05) continue;
      const img = this.sprites.dots[t.ci];
      const s = t.s * 3;
      ctx.globalAlpha = a;
      ctx.drawImage(img, t.x - s / 2, t.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    const { x: bx, y: by, s: bs } = this.board;
    ctx.save();
    ctx.translate(bx + sx, by + sy);
    ctx.scale(bs, bs);

    // slot flashes
    for (let i = 0; i < SLOT_COUNT; i++) {
      const f = this.slotFlash[i];
      if (f <= 0.02) continue;
      const cx = INNER_L + (i + 0.5) * SLOT_W;
      const col = SLOT_VALUES[i] >= 500 ? 2 : SLOT_VALUES[i] >= 250 ? 1 : 0;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = f * 0.85;
      ctx.drawImage(this.sprites.dots[col], cx - SLOT_W * 0.7, KILL_Y - 26, SLOT_W * 1.4, 64);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // pegs
    for (let i = 0; i < this.pegs.length; i++) {
      const p = this.pegs[i];
      const spr = this.sprites.pegs[p.kind];
      const pulse = 1 + p.flash * 0.4;
      const rot =
        p.kind === 'multi' ? p.rot * 0.3 + this.time * 0.9 : p.kind === 'bumper' ? this.time * 1.6 : 0;
      drawSprite(ctx, spr, p.x, p.y, pulse, rot);
      if (p.flash > 0.02 && p.kind !== 'divider') {
        const gi = PEG_GLOW[p.kind];
        const gs = p.r * (4 + p.flash * 5);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = p.flash * 0.75;
        ctx.drawImage(this.sprites.dots[gi], p.x - gs / 2, p.y - gs / 2, gs, gs);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    this.renderDrone(ctx);

    // aim line + dropper (only while playing)
    if (this.mode === 'playing') {
      const novaNext = this.nextIsNova() && this.ballsLeft > 0;
      const aimCol = novaNext ? C.gold : C.cyan;
      const aimA = this.cool <= 0 && this.ballsLeft > 0 ? 0.16 : 0.06;
      ctx.save();
      ctx.strokeStyle = rgba(PALETTE[aimCol], aimA);
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 14]);
      ctx.lineDashOffset = -this.time * 70;
      ctx.beginPath();
      ctx.moveTo(this.px, RAIL_Y + 26);
      ctx.lineTo(this.px, KILL_Y - 14);
      ctx.stroke();
      ctx.restore();

      // dropper glow
      ctx.globalCompositeOperation = 'lighter';
      const dg = 92 + Math.sin(this.time * 3) * 8;
      ctx.globalAlpha = novaNext ? 0.7 : 0.5;
      ctx.drawImage(this.sprites.dots[aimCol], this.px - dg / 2, RAIL_Y - dg / 2, dg, dg * 0.55);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';

      // aimed plank under rail (the "cup")
      const plankGrad = ctx.createLinearGradient(this.px - 34, RAIL_Y + 16, this.px + 34, RAIL_Y + 16);
      plankGrad.addColorStop(0, rgba(PALETTE[aimCol], 0));
      plankGrad.addColorStop(0.5, rgba(PALETTE[aimCol], this.cool <= 0 ? 0.85 : 0.3));
      plankGrad.addColorStop(1, rgba(PALETTE[aimCol], 0));
      ctx.strokeStyle = plankGrad;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(this.px - 34, RAIL_Y + 18);
      ctx.lineTo(this.px + 34, RAIL_Y + 18);
      ctx.stroke();

      // dropper body
      const bodyG = ctx.createLinearGradient(0, RAIL_Y - 14, 0, RAIL_Y + 14);
      bodyG.addColorStop(0, '#1b2260');
      bodyG.addColorStop(1, '#0a0d28');
      rr(ctx, this.px - 33, RAIL_Y - 14, 66, 28, 14);
      ctx.fillStyle = bodyG;
      ctx.fill();
      ctx.strokeStyle = rgba(PALETTE[aimCol], 0.8);
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // charged ball preview / reload bubble
      if (this.ballsLeft > 0) {
        const charge = this.cool <= 0 ? 1 : 1 - this.cool / DROP_COOLDOWN;
        const pop = charge >= 1 ? 1 + Math.sin(this.time * 6) * 0.06 : 0.25 + charge * 0.75;
        drawSprite(ctx, this.sprites.balls[novaNext ? NOVA_SPRITE : 0], this.px, RAIL_Y, pop, this.time * 1.5, 0.35 + charge * 0.65);
        if (novaNext && this.cool <= 0) {
          ctx.font = '800 10px Orbitron, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = rgba(PALETTE[C.gold], 0.9);
          ctx.fillText('NOVA x2', this.px, RAIL_Y - 24);
        }
      }

      // first-drop hint
      if (!this.hasDropped && this.balls.length === 0) {
        const blink = 0.55 + Math.sin(this.time * 5) * 0.35;
        ctx.globalAlpha = blink;
        ctx.font = '700 15px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = rgba(PALETTE[0], 0.95);
        ctx.fillText('TAP OR PRESS SPACE TO DROP', BOARD_W / 2, 556);
        // bouncing arrow
        const ay = 522 + Math.sin(this.time * 5) * 5;
        ctx.fillStyle = rgba(PALETTE[0], 0.9);
        ctx.beginPath();
        ctx.moveTo(BOARD_W / 2 - 7, ay);
        ctx.lineTo(BOARD_W / 2 + 7, ay);
        ctx.lineTo(BOARD_W / 2, ay + 9);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    // balls
    for (let i = 0; i < this.balls.length; i++) {
      const b = this.balls[i];
      const tier = clamp(b.mult - 1, 0, 4);
      const col = b.nova ? C.gold : BALL_TIER[tier];
      // trail
      const tr = b.trail;
      if (tr.length > 1) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = rgba(PALETTE[col], b.nova ? 0.45 : 0.3);
        ctx.lineWidth = b.r * 1.15;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(tr[0].x, tr[0].y);
        for (let k2 = 1; k2 < tr.length; k2++) ctx.lineTo(tr[k2].x, tr[k2].y);
        ctx.stroke();
        ctx.restore();
      }
      drawSprite(ctx, this.sprites.balls[b.nova ? NOVA_SPRITE : tier], b.x, b.y, b.nova ? 1.12 : 1, b.spin);
    }

    // fx layers
    this.rings.render(ctx);
    this.parts.render(ctx, this.sprites.dots);
    this.ftexts.render(ctx);

    ctx.restore();

    // overdrive edge glow (screen space)
    if (this.overdrive > 0) {
      const k = 0.5 + 0.5 * Math.sin(this.time * 7);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.05 + k * 0.05;
      ctx.fillStyle = PALETTE[C.magenta];
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = rgba(PALETTE[C.magenta], 0.3 + k * 0.3);
      ctx.lineWidth = 5;
      ctx.strokeRect(3, 3, w - 6, h - 6);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  private renderDrone(ctx: CanvasRenderingContext2D) {
    const x = this.droneX();
    const y = DRONE_Y;
    const bob = Math.sin(this.time * 2.4) * 2.5;

    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 + Math.sin(this.time * 4) * 0.12;
    ctx.drawImage(this.sprites.dots[C.gold], x - 48, y + bob - 30, 96, 60);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // body capsule
    const g2 = ctx.createLinearGradient(0, y - 9 + bob, 0, y + 9 + bob);
    g2.addColorStop(0, '#ffe9b0');
    g2.addColorStop(0.5, '#ffd166');
    g2.addColorStop(1, '#8a5a00');
    rr(ctx, x - 30, y - 9 + bob, 60, 18, 9);
    ctx.fillStyle = g2;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // core eye
    ctx.fillStyle = '#fff6da';
    ctx.beginPath();
    ctx.arc(x, y + bob, 4, 0, Math.PI * 2);
    ctx.fill();

    // thrusters
    ctx.globalCompositeOperation = 'lighter';
    const th = 6 + Math.sin(this.time * 18) * 2;
    ctx.globalAlpha = 0.7;
    ctx.drawImage(this.sprites.dots[C.orange], x - 22 - th / 2, y + bob + 8, th, th * 1.6);
    ctx.drawImage(this.sprites.dots[C.orange], x + 22 - th / 2, y + bob + 8, th, th * 1.6);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    // label
    ctx.font = '800 10px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(6,4,20,0.85)';
    ctx.fillText('+1', x, y + bob);
  }
}
