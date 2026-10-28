import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Crown,
  Hand,
  Home,
  Keyboard,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import type { HudStats } from '../game/core';

// ── persistent leaderboard ──────────────────────────────────────────────────

export interface ScoreEntry {
  id: number;
  score: number;
  date: string;
}

const LS_KEY = 'prismfall-scores-v1';

export function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const a = JSON.parse(raw);
      if (Array.isArray(a)) return a as ScoreEntry[];
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function recordScore(score: number) {
  const list = loadScores();
  const entry: ScoreEntry = {
    id: Date.now() + Math.floor(Math.random() * 1000),
    score,
    date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const top = list.slice(0, 10);
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(top));
  } catch {
    /* ignore */
  }
  return { list: top, id: entry.id, isBest: top.length > 0 && top[0].id === entry.id };
}

// ── animated number (eases toward target) ───────────────────────────────────

export function useTick(value: number): number {
  const [display, setDisplay] = useState(value);
  const cur = useRef(value);
  useEffect(() => {
    let af = 0;
    const step = () => {
      const diff = value - cur.current;
      if (Math.abs(diff) > 0.6) {
        cur.current += diff * 0.16;
        setDisplay(Math.round(cur.current));
        af = requestAnimationFrame(step);
      } else if (cur.current !== value) {
        cur.current = value;
        setDisplay(value);
      }
    };
    af = requestAnimationFrame(step);
    return () => cancelAnimationFrame(af);
  }, [value]);
  return display;
}

const fmt = (n: number) => n.toLocaleString('en-US');

// ── shared bits ─────────────────────────────────────────────────────────────

function GlowButton({
  children,
  onClick,
  primary = false,
  kbd,
}: {
  children: ReactNode;
  onClick: () => void;
  primary?: boolean;
  kbd?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`group pointer-events-auto relative flex w-full items-center justify-center gap-3 rounded-2xl border px-6 py-3.5 font-display text-sm font-bold tracking-[0.2em] uppercase transition-all duration-200 active:scale-95 ${
        primary
          ? 'btn-primary border-cyan-300/70 bg-cyan-400/15 text-cyan-100 hover:bg-cyan-300/25 hover:text-white'
          : 'border-white/15 bg-white/5 text-white/70 hover:border-white/35 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
      {kbd && (
        <span className="kbd absolute -top-2.5 right-4 rounded-md border border-white/20 bg-[#0a0d28] px-1.5 py-0.5 text-[9px] tracking-widest text-white/50">
          {kbd}
        </span>
      )}
    </button>
  );
}

function IconBtn({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/40 text-white/70 backdrop-blur-md transition-all duration-150 hover:border-cyan-300/60 hover:text-cyan-200 active:scale-90"
    >
      {children}
    </button>
  );
}

function ScoreTable({ scores, highlightId, compact = false }: { scores: ScoreEntry[]; highlightId?: number | null; compact?: boolean }) {
  const list = compact ? scores.slice(0, 5) : scores.slice(0, 8);
  if (list.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 px-4 py-5 text-center text-xs tracking-widest text-white/35">
        NO RUNS YET — BE THE FIRST
      </div>
    );
  }
  const medal = ['text-amber-300', 'text-slate-300', 'text-orange-400'];
  return (
    <ol className="w-full space-y-1">
      {list.map((s, i) => (
        <li
          key={s.id}
          className={`flex items-center gap-3 rounded-lg px-3 py-1.5 font-display text-sm transition-colors ${
            s.id === highlightId ? 'animate-pulse border border-cyan-300/60 bg-cyan-400/15' : 'bg-white/[0.03]'
          }`}
        >
          <span className={`w-5 text-center text-xs font-bold ${i < 3 ? medal[i] : 'text-white/30'}`}>
            {i + 1}
          </span>
          {i === 0 ? (
            <Crown className="h-3.5 w-3.5 text-amber-300" />
          ) : i === 1 || i === 2 ? (
            <Trophy className={`h-3.5 w-3.5 ${medal[i]}`} />
          ) : (
            <Zap className="h-3.5 w-3.5 text-white/20" />
          )}
          <span className="flex-1" />
          <span className={`tabular-nums font-bold ${s.id === highlightId ? 'text-cyan-200' : 'text-white/85'}`}>
            {fmt(s.score)}
          </span>
          <span className="w-14 text-right text-[10px] text-white/30">{s.date}</span>
        </li>
      ))}
    </ol>
  );
}

function Panel({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div
      className={`pointer-events-auto w-full ${wide ? 'max-w-md' : 'max-w-sm'} rounded-3xl border border-white/10 bg-[#07051d]/85 p-6 shadow-[0_0_80px_rgba(37,230,255,0.12)] backdrop-blur-xl sm:p-8`}
    >
      {children}
    </div>
  );
}

// ── screens ─────────────────────────────────────────────────────────────────

export function StartScreen({
  scores,
  best,
  onStart,
}: {
  scores: ScoreEntry[];
  best: number;
  onStart: () => void;
}) {
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[radial-gradient(120%_100%_at_50%_20%,rgba(7,5,29,0.25)_0%,rgba(4,2,17,0.82)_78%)] p-4"
      onClick={onStart}
    >
      <div className="flex w-full max-w-md flex-col items-center gap-5 py-8 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="rise flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-4 py-1.5 text-[10px] font-semibold tracking-[0.35em] text-fuchsia-300 uppercase">
          <Sparkles className="h-3 w-3" />
          Neon Physics Arcade
        </div>

        <h1 className="rise rise-1 title-shine font-display text-[clamp(2.8rem,12vw,4.6rem)] leading-none font-black tracking-tight">
          PRISM
          <br />
          FALL
        </h1>

        <p className="rise rise-2 max-w-xs text-sm leading-relaxed text-white/55">
          Drop the orb. Ride the bounces. Chain pegs into a{' '}
          <span className="text-cyan-300">x5 combo</span>, hunt the{' '}
          <span className="text-amber-300">golden drone</span>, and sink it in the hot slot.
        </p>

        <div className="rise rise-3 w-full">
          <GlowButton primary onClick={onStart} kbd="SPACE">
            <Play className="h-4 w-4 fill-current" />
            Start Drop
          </GlowButton>
          <p className="mt-2 text-[10px] tracking-[0.3em] text-white/30 uppercase">tap anywhere · spacebar</p>
        </div>

        <div className="rise rise-4 grid w-full grid-cols-1 gap-2 text-left sm:grid-cols-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
            <MousePointer2 className="h-4 w-4 shrink-0 text-cyan-300" />
            <span className="text-[11px] leading-tight text-white/60">Drag to aim, release to drop</span>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
            <Hand className="h-4 w-4 shrink-0 text-fuchsia-300" />
            <span className="text-[11px] leading-tight text-white/60">Touch friendly, no swipes needed</span>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
            <Keyboard className="h-4 w-4 shrink-0 text-amber-300" />
            <span className="text-[11px] leading-tight text-white/60">A/D move · Space drop · P pause</span>
          </div>
        </div>

        <div className="rise rise-5 w-full">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.3em] text-white/40 uppercase">
              <Trophy className="h-3 w-3 text-amber-300" /> Local legends
            </span>
            {best > 0 && <span className="font-display text-[10px] tracking-widest text-amber-300/80">BEST {fmt(best)}</span>}
          </div>
          <ScoreTable scores={scores} compact />
        </div>
      </div>
    </div>
  );
}

export function PauseOverlay({
  onResume,
  onRestart,
  onMenu,
}: {
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#040211]/70 p-4 backdrop-blur-md">
      <Panel>
        <div className="rise flex flex-col items-center gap-6">
          <h2 className="font-display text-3xl font-black tracking-[0.25em] text-white/90">PAUSED</h2>
          <div className="flex w-full flex-col gap-2.5">
            <GlowButton primary onClick={onResume} kbd="P">
              <Play className="h-4 w-4 fill-current" /> Resume
            </GlowButton>
            <GlowButton onClick={onRestart} kbd="R">
              <RotateCcw className="h-4 w-4" /> Restart
            </GlowButton>
            <GlowButton onClick={onMenu}>
              <Home className="h-4 w-4" /> Main menu
            </GlowButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}

export function GameOverOverlay({
  score,
  isBest,
  highlightId,
  scores,
  onRestart,
  onMenu,
}: {
  score: number;
  isBest: boolean;
  highlightId: number | null;
  scores: ScoreEntry[];
  onRestart: () => void;
  onMenu: () => void;
}) {
  const [target, setTarget] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setTarget(score), 120);
    return () => window.clearTimeout(t);
  }, [score]);
  const shown = useTick(target);
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[#040211]/60 p-4">
      <Panel wide>
        <div className="flex max-h-full flex-col items-center gap-4 overflow-y-auto">
          {isBest ? (
            <div className="rise flex items-center gap-2 rounded-full border border-amber-300/50 bg-amber-300/15 px-4 py-1.5 text-[11px] font-bold tracking-[0.3em] text-amber-300 uppercase">
              <Crown className="h-3.5 w-3.5" /> New record
            </div>
          ) : (
            <div className="rise rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[11px] font-bold tracking-[0.3em] text-white/50 uppercase">
              Run complete
            </div>
          )}
          <div className="rise rise-1 text-center">
            <div className="text-[10px] tracking-[0.4em] text-white/40 uppercase">Final score</div>
            <div className="font-display text-5xl font-black tabular-nums text-transparent sm:text-6xl bg-gradient-to-b from-cyan-200 via-cyan-300 to-fuchsia-400 bg-clip-text" style={{ filter: 'drop-shadow(0 0 18px rgba(37,230,255,0.45))' }}>
              {fmt(shown)}
            </div>
          </div>
          <div className="rise rise-2 w-full">
            <ScoreTable scores={scores} highlightId={highlightId} />
          </div>
          <div className="rise rise-3 flex w-full flex-col gap-2.5 pb-1">
            <GlowButton primary onClick={onRestart} kbd="R / SPACE">
              <RotateCcw className="h-4 w-4" /> Drop again
            </GlowButton>
            <GlowButton onClick={onMenu}>
              <Home className="h-4 w-4" /> Main menu
            </GlowButton>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ── in-game HUD ─────────────────────────────────────────────────────────────

const TIER_TEXT = ['text-cyan-300', 'text-emerald-300', 'text-amber-300', 'text-orange-300', 'text-fuchsia-300'];
const TIER_BG = ['bg-cyan-300', 'bg-emerald-300', 'bg-amber-300', 'bg-orange-400', 'bg-fuchsia-400'];

export function HUD({
  stats,
  muted,
  onPause,
  onMute,
}: {
  stats: HudStats;
  muted: boolean;
  onPause: () => void;
  onMute: () => void;
}) {
  const score = useTick(stats.score);
  const tier = Math.min(stats.mult, 5) - 1;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 sm:p-5">
      <div className="flex flex-col gap-1.5">
        <div className="flex items-end gap-3">
          <div>
            <div className="text-[9px] font-semibold tracking-[0.35em] text-cyan-300/70 uppercase">Score</div>
            <div className="font-display text-2xl leading-none font-black tabular-nums text-white sm:text-3xl" style={{ textShadow: '0 0 18px rgba(37,230,255,0.5)' }}>
              {fmt(score)}
            </div>
          </div>
          {stats.best > 0 && (
            <div className="mb-0.5 hidden text-[10px] tracking-widest text-white/30 sm:block">
              BEST <span className="font-display text-white/60">{fmt(stats.best)}</span>
            </div>
          )}
        </div>

        {/* combo pips */}
        <div className="flex items-center gap-1.5">
          <span className={`font-display text-[10px] font-bold tracking-widest ${TIER_TEXT[tier]}`}>
            x{stats.mult}
          </span>
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 w-3.5 rounded-full transition-all duration-200 ${
                i < stats.mult ? `${TIER_BG[Math.max(tier, 0)]} shadow-[0_0_8px_rgba(37,230,255,0.8)]` : 'bg-white/12'
              }`}
            />
          ))}
        </div>

        {/* balls remaining */}
        <div className="mt-0.5 flex items-center gap-1">
          {Array.from({ length: Math.min(stats.balls, 12) }, (_, i) => (
            <span key={i} className="h-2 w-2 rounded-full bg-cyan-300/90 shadow-[0_0_6px_rgba(37,230,255,0.9)]" />
          ))}
          {stats.balls > 12 && <span className="ml-1 text-[10px] text-white/50">+{stats.balls - 12}</span>}
          {stats.balls === 0 && <span className="text-[10px] tracking-widest text-red-400/80 uppercase">empty</span>}
        </div>
      </div>

      <div className="flex gap-2">
        <IconBtn onClick={onMute} label={muted ? 'Unmute' : 'Mute'}>
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </IconBtn>
        <IconBtn onClick={onPause} label="Pause">
          <Pause className="h-4 w-4" />
        </IconBtn>
      </div>
    </div>
  );
}
