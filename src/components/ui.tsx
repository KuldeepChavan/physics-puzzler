import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Atom,
  Award,
  Bot,
  Crown,
  Flame,
  Gem,
  Hand,
  Home,
  Keyboard,
  Medal,
  MousePointer2,
  Pause,
  Play,
  Rocket,
  RotateCcw,
  Sparkles,
  Star,
  Sun,
  Target,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import type { HudStats, RunStats } from '../game/core';
import { LS_ACH, OVERDRIVE_TIME, STREAK_TARGET } from '../game/core';

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

// ── achievements ────────────────────────────────────────────────────────────

export interface AchDef {
  name: string;
  desc: string;
  icon: typeof Zap;
}

export const ACHIEVEMENTS: Record<string, AchDef> = {
  'first-drop': { name: 'Lift Off', desc: 'Drop your first orb', icon: Rocket },
  'hot-500': { name: 'Jackpot', desc: 'Sink a ball in the 500 well', icon: Gem },
  'drone-1': { name: 'Drone Hunter', desc: 'Catch the golden drone', icon: Bot },
  'max-combo': { name: 'Overcharged', desc: 'Push a ball to x5 combo', icon: Atom },
  supernova: { name: 'Supernova', desc: 'Detonate a Nova ball in the 500 well', icon: Sun },
  streak: { name: 'On Fire', desc: 'Trigger Overdrive with 3 big wells in a row', icon: Flame },
  'score-10k': { name: 'Five Digits', desc: 'Finish a run at 10,000+', icon: Star },
  'score-25k': { name: 'Prism Master', desc: 'Finish a run at 25,000+', icon: Medal },
  'peg-100': { name: 'Crowd Pleaser', desc: '100 peg hits in a single run', icon: Target },
  trifecta: { name: 'Triple Play', desc: 'Catch the drone 3 times in one run', icon: Award },
};

export const ACH_IDS = Object.keys(ACHIEVEMENTS);

export function loadAchievements(): string[] {
  try {
    const raw = localStorage.getItem(LS_ACH);
    if (raw) {
      const a = JSON.parse(raw);
      if (Array.isArray(a)) return a as string[];
    }
  } catch {
    /* ignore */
  }
  return [];
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

function ScoreTable({
  scores,
  highlightId,
  compact = false,
}: {
  scores: ScoreEntry[];
  highlightId?: number | null;
  compact?: boolean;
}) {
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
          <span className={`w-5 text-center text-xs font-bold ${i < 3 ? medal[i] : 'text-white/30'}`}>{i + 1}</span>
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

function Badge({ id, unlocked }: { id: string; unlocked: boolean }) {
  const a = ACHIEVEMENTS[id];
  if (!a) return null;
  const Icon = a.icon;
  return (
    <div
      title={`${a.name} — ${a.desc}`}
      className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2 transition-colors ${
        unlocked ? 'border-amber-300/40 bg-amber-300/10' : 'border-white/8 bg-white/[0.02] opacity-35 grayscale'
      }`}
    >
      <Icon className={`h-4 w-4 ${unlocked ? 'text-amber-300' : 'text-white/50'}`} />
      <span className="max-w-full truncate text-[8px] font-semibold tracking-wider text-white/70 uppercase">{a.name}</span>
    </div>
  );
}

// ── achievement toasts ──────────────────────────────────────────────────────

export interface Toast {
  key: number;
  id: string;
}

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-20 z-40 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => {
        const a = ACHIEVEMENTS[t.id];
        if (!a) return null;
        const Icon = a.icon;
        return (
          <div
            key={t.key}
            className="rise flex items-center gap-3 rounded-2xl border border-amber-300/60 bg-[#141005]/90 px-4 py-2.5 shadow-[0_0_30px_rgba(255,209,102,0.35)] backdrop-blur-md"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-300/20">
              <Icon className="h-4 w-4 text-amber-300" />
            </span>
            <div className="text-left">
              <div className="text-[9px] font-bold tracking-[0.3em] text-amber-300/80 uppercase">Achievement</div>
              <div className="font-display text-sm font-bold text-amber-100">{a.name}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── screens ─────────────────────────────────────────────────────────────────

export function StartScreen({
  scores,
  best,
  achievements,
  onStart,
}: {
  scores: ScoreEntry[];
  best: number;
  achievements: string[];
  onStart: () => void;
}) {
  const unlocked = new Set(achievements);
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[radial-gradient(120%_100%_at_50%_20%,rgba(7,5,29,0.25)_0%,rgba(4,2,17,0.82)_78%)] p-4"
      onClick={onStart}
    >
      <div className="flex w-full max-w-md flex-col items-center gap-5 py-8 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="rise flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-4 py-1.5 text-[10px] font-semibold tracking-[0.35em] text-fuchsia-300 uppercase">
          <Sparkles className="h-3 w-3" />
          Neon Physics Arcade · v2
        </div>

        <h1 className="rise rise-1 title-shine font-display text-[clamp(2.8rem,12vw,4.6rem)] leading-none font-black tracking-tight">
          PRISM
          <br />
          FALL
        </h1>

        <p className="rise rise-2 max-w-xs text-sm leading-relaxed text-white/55">
          Chain wells to ignite <span className="text-fuchsia-300">Overdrive x2</span>. Arm the{' '}
          <span className="text-amber-300">Nova ball</span> every 4th drop. Hunt the drone for +500 and an extra ball.
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
              <Medal className="h-3 w-3 text-amber-300" /> Achievements
            </span>
            <span className="font-display text-[10px] tracking-widest text-amber-300/80">
              {unlocked.size}/{ACH_IDS.length}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {ACH_IDS.map((id) => (
              <Badge key={id} id={id} unlocked={unlocked.has(id)} />
            ))}
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
  runStats,
  newAch,
  onRestart,
  onMenu,
}: {
  score: number;
  isBest: boolean;
  highlightId: number | null;
  scores: ScoreEntry[];
  runStats: RunStats | null;
  newAch: string[];
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
            <div
              className="font-display bg-gradient-to-b from-cyan-200 via-cyan-300 to-fuchsia-400 bg-clip-text text-5xl font-black tabular-nums text-transparent sm:text-6xl"
              style={{ filter: 'drop-shadow(0 0 18px rgba(37,230,255,0.45))' }}
            >
              {fmt(shown)}
            </div>
          </div>

          {newAch.length > 0 && (
            <div className="rise flex w-full flex-wrap items-center justify-center gap-1.5">
              {newAch.map((id) => {
                const a = ACHIEVEMENTS[id];
                if (!a) return null;
                const Icon = a.icon;
                return (
                  <span
                    key={id}
                    title={a.desc}
                    className="flex items-center gap-1.5 rounded-full border border-amber-300/50 bg-amber-300/15 px-2.5 py-1 text-[10px] font-bold tracking-wider text-amber-200 uppercase"
                  >
                    <Icon className="h-3 w-3" /> {a.name}
                  </span>
                );
              })}
            </div>
          )}

          {runStats && (
            <div className="rise rise-2 grid w-full grid-cols-4 gap-1.5">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-1 py-2 text-center">
                <Target className="mx-auto h-3.5 w-3.5 text-cyan-300" />
                <div className="mt-1 font-display text-sm font-bold text-white">{runStats.pegs}</div>
                <div className="text-[8px] tracking-widest text-white/40 uppercase">Peg hits</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-1 py-2 text-center">
                <Bot className="mx-auto h-3.5 w-3.5 text-amber-300" />
                <div className="mt-1 font-display text-sm font-bold text-white">{runStats.drones}</div>
                <div className="text-[8px] tracking-widest text-white/40 uppercase">Drones</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-1 py-2 text-center">
                <Zap className="mx-auto h-3.5 w-3.5 text-fuchsia-300" />
                <div className="mt-1 font-display text-sm font-bold text-white">x{runStats.topCombo}</div>
                <div className="text-[8px] tracking-widest text-white/40 uppercase">Top combo</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-1 py-2 text-center">
                <Star className="mx-auto h-3.5 w-3.5 text-orange-300" />
                <div className="mt-1 font-display text-sm font-bold text-white">{fmt(runStats.bestPlay)}</div>
                <div className="text-[8px] tracking-widest text-white/40 uppercase">Best play</div>
              </div>
            </div>
          )}

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
  const odFrac = Math.max(0, Math.min(1, stats.overdrive / OVERDRIVE_TIME));
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20">
      {/* overdrive banner */}
      {stats.overdrive > 0 && (
        <div className="absolute inset-x-0 top-14 flex justify-center sm:top-3">
          <div className="od-chip flex items-center gap-2 rounded-full border border-fuchsia-400/70 bg-fuchsia-500/20 px-4 py-1.5 backdrop-blur-md">
            <Flame className="h-4 w-4 animate-pulse text-fuchsia-300" />
            <span className="font-display text-xs font-black tracking-[0.25em] text-fuchsia-200">OVERDRIVE x2</span>
            <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-white/15">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-fuchsia-300 transition-[width] duration-150"
                style={{ width: `${odFrac * 100}%` }}
              />
            </span>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-3 p-3 sm:p-5">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-end gap-3">
            <div>
              <div className="text-[9px] font-semibold tracking-[0.35em] text-cyan-300/70 uppercase">Score</div>
              <div
                className="font-display text-2xl leading-none font-black tabular-nums text-white sm:text-3xl"
                style={{ textShadow: '0 0 18px rgba(37,230,255,0.5)' }}
              >
                {fmt(score)}
              </div>
            </div>
            {stats.best > 0 && (
              <div className="mb-0.5 hidden text-[10px] tracking-widest text-white/30 sm:block">
                BEST <span className="font-display text-white/60">{fmt(stats.best)}</span>
              </div>
            )}
          </div>

          {/* combo pips + streak flames */}
          <div className="flex items-center gap-2">
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
            <span className="mx-1 h-3 w-px bg-white/15" />
            {Array.from({ length: STREAK_TARGET }, (_, i) => (
              <Flame
                key={i}
                className={`h-3.5 w-3.5 transition-all duration-200 ${
                  i < stats.streak
                    ? 'scale-110 text-orange-400 drop-shadow-[0_0_6px_rgba(255,157,61,0.9)]'
                    : 'text-white/15'
                }`}
              />
            ))}
            {stats.nextNova && (
              <span className="ml-1 flex items-center gap-1 rounded-full border border-amber-300/50 bg-amber-300/15 px-2 py-0.5 text-[8px] font-bold tracking-widest text-amber-200 uppercase">
                <Sun className="h-2.5 w-2.5" /> Nova armed
              </span>
            )}
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
    </div>
  );
}
