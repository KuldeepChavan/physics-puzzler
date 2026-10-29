import { useCallback, useEffect, useRef, useState } from 'react';
import { Game } from './game/game';
import type { Mode } from './game/game';
import type { HudStats, RunStats } from './game/core';
import { START_BALLS } from './game/core';
import {
  GameOverOverlay,
  HUD,
  PauseOverlay,
  StartScreen,
  ToastStack,
  loadAchievements,
  loadScores,
  recordScore,
} from './components/ui';
import type { ScoreEntry, Toast } from './components/ui';

const INIT_STATS: HudStats = {
  score: 0,
  balls: START_BALLS,
  mult: 1,
  best: 0,
  streak: 0,
  overdrive: 0,
  nextNova: false,
};

interface LastRun {
  id: number | null;
  score: number;
  isBest: boolean;
  stats: RunStats | null;
  achievements: string[];
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [mode, setMode] = useState<Mode>('menu');
  const [stats, setStats] = useState<HudStats>(INIT_STATS);
  const [muted, setMuted] = useState(false);
  const [scores, setScores] = useState<ScoreEntry[]>(() => loadScores());
  const [achievements, setAchievements] = useState<string[]>(() => loadAchievements());
  const runAchRef = useRef<string[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [lastRun, setLastRun] = useState<LastRun>({
    id: null,
    score: 0,
    isBest: false,
    stats: null,
    achievements: [],
  });

  useEffect(() => {
    if (!canvasRef.current) return;
    const game = new Game(canvasRef.current, {
      onMode: setMode,
      onStats: setStats,
      onMuted: setMuted,
      onAchievement: (id) => {
        runAchRef.current = [...runAchRef.current, id];
        setAchievements((prev) => (prev.includes(id) ? prev : [...prev, id]));
        const key = Date.now() + Math.floor(Math.random() * 1000);
        setToasts((t) => [...t, { key, id }]);
        window.setTimeout(() => {
          setToasts((t) => t.filter((x) => x.key !== key));
        }, 2600);
      },
      onGameOver: (score, runStats) => {
        const achieved = [...runAchRef.current];
        if (score > 0) {
          const r = recordScore(score);
          setScores(r.list);
          setLastRun({ id: r.id, score, isBest: r.isBest, stats: runStats, achievements: achieved });
        } else {
          setLastRun({ id: null, score, isBest: false, stats: runStats, achievements: achieved });
        }
      },
    });
    gameRef.current = game;
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  const start = useCallback(() => {
    runAchRef.current = [];
    gameRef.current?.startGame();
  }, []);
  const restart = useCallback(() => {
    runAchRef.current = [];
    gameRef.current?.restart();
  }, []);
  const togglePause = useCallback(() => gameRef.current?.togglePause(), []);
  const quitToMenu = useCallback(() => gameRef.current?.quitToMenu(), []);
  const toggleMute = useCallback(() => gameRef.current?.toggleMute(), []);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#040211] text-white select-none">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* CRT flavor */}
      <div className="scanlines pointer-events-none absolute inset-0 z-10" />
      <div className="vign-edge pointer-events-none absolute inset-0 z-10" />

      {(mode === 'playing' || mode === 'paused') && (
        <HUD stats={stats} muted={muted} onPause={togglePause} onMute={toggleMute} />
      )}

      <ToastStack toasts={toasts} />

      {mode === 'menu' && <StartScreen scores={scores} best={stats.best} achievements={achievements} onStart={start} />}

      {mode === 'paused' && <PauseOverlay onResume={togglePause} onRestart={restart} onMenu={quitToMenu} />}

      {mode === 'over' && (
        <GameOverOverlay
          score={lastRun.score}
          isBest={lastRun.isBest}
          highlightId={lastRun.id}
          scores={scores}
          runStats={lastRun.stats}
          newAch={lastRun.achievements}
          onRestart={restart}
          onMenu={quitToMenu}
        />
      )}
    </div>
  );
}
