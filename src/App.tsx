import { useCallback, useEffect, useRef, useState } from 'react';
import { Game } from './game/game';
import type { Mode } from './game/game';
import type { HudStats } from './game/core';
import { START_BALLS } from './game/core';
import {
  GameOverOverlay,
  HUD,
  PauseOverlay,
  StartScreen,
  loadScores,
  recordScore,
} from './components/ui';
import type { ScoreEntry } from './components/ui';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const [mode, setMode] = useState<Mode>('menu');
  const [stats, setStats] = useState<HudStats>({ score: 0, balls: START_BALLS, mult: 1, best: 0 });
  const [muted, setMuted] = useState(false);
  const [scores, setScores] = useState<ScoreEntry[]>(() => loadScores());
  const [lastRun, setLastRun] = useState<{ id: number | null; score: number; isBest: boolean }>({
    id: null,
    score: 0,
    isBest: false,
  });

  useEffect(() => {
    if (!canvasRef.current) return;
    const game = new Game(canvasRef.current, {
      onMode: setMode,
      onStats: setStats,
      onMuted: setMuted,
      onGameOver: (score) => {
        if (score > 0) {
          const r = recordScore(score);
          setScores(r.list);
          setLastRun({ id: r.id, score, isBest: r.isBest });
        } else {
          setLastRun({ id: null, score, isBest: false });
        }
      },
    });
    gameRef.current = game;
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  const start = useCallback(() => gameRef.current?.startGame(), []);
  const restart = useCallback(() => gameRef.current?.restart(), []);
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

      {mode === 'menu' && <StartScreen scores={scores} best={stats.best} onStart={start} />}

      {mode === 'paused' && <PauseOverlay onResume={togglePause} onRestart={restart} onMenu={quitToMenu} />}

      {mode === 'over' && (
        <GameOverOverlay
          score={lastRun.score}
          isBest={lastRun.isBest}
          highlightId={lastRun.id}
          scores={scores}
          onRestart={restart}
          onMenu={quitToMenu}
        />
      )}
    </div>
  );
}
