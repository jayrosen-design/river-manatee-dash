import { useEffect, useRef, useState } from "react";
import { bus } from "@/game/eventBus";
import { PauseMenu } from "./PauseMenu";
import { ResultsModal } from "./ResultsModal";
import { TouchControls } from "./TouchControls";
import { STORAGE_KEYS } from "@/game/constants";

interface Props {
  onExitToMenu: () => void;
}

type ResultsState =
  | { kind: "complete"; score: number; lettuceCollected: number; livesRemaining: number; completionBonus: number; highScore: number }
  | { kind: "gameover"; score: number; highScore: number; lettuceCollected: number }
  | null;

export function GameContainer({ onExitToMenu }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<unknown>(null);
  const [paused, setPaused] = useState(false);
  const [results, setResults] = useState<ResultsState>(null);
  const [muted, setMuted] = useState(
    typeof window !== "undefined" &&
      window.localStorage.getItem(STORAGE_KEYS.MUTED) === "1",
  );
  const [reducedMotion, setReducedMotion] = useState(
    typeof window !== "undefined" &&
      window.localStorage.getItem(STORAGE_KEYS.REDUCED) === "1",
  );
  const [highScore, setHighScore] = useState(0);

  useEffect(() => {
    let disposed = false;
    let game: { destroy: (removeCanvas: boolean) => void } | null = null;
    (async () => {
      const { createGame } = await import("@/game/config");
      if (disposed || !hostRef.current) return;
      game = createGame(hostRef.current) as unknown as typeof game;
      gameRef.current = game;
    })();

    const onHigh = (s: number) => setHighScore(s);
    const onPaused = (p: boolean) => setPaused(p);
    const onComplete = (d: {
      score: number;
      lettuceCollected: number;
      livesRemaining: number;
      completionBonus: number;
    }) =>
      setResults((prev) => ({
        kind: "complete",
        score: d.score,
        lettuceCollected: d.lettuceCollected,
        livesRemaining: d.livesRemaining,
        completionBonus: d.completionBonus,
        highScore: prev?.highScore ?? highScore,
      }));
    const onGameOver = (d: {
      score: number;
      highScore: number;
      lettuceCollected: number;
    }) =>
      setResults({
        kind: "gameover",
        score: d.score,
        highScore: d.highScore,
        lettuceCollected: d.lettuceCollected,
      });

    bus.on("highScore", onHigh);
    bus.on("paused", onPaused);
    bus.on("levelComplete", onComplete);
    bus.on("gameOver", onGameOver);

    return () => {
      disposed = true;
      bus.off("highScore", onHigh);
      bus.off("paused", onPaused);
      bus.off("levelComplete", onComplete);
      bus.off("gameOver", onGameOver);
      try {
        game?.destroy(true);
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prevent page scroll while playing
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const stopKeys = (e: KeyboardEvent) => {
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)
      )
        e.preventDefault();
    };
    window.addEventListener("keydown", stopKeys, { passive: false });
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", stopKeys);
    };
  }, []);

  function handleRestart() {
    setResults(null);
    bus.emit("cmd_restart");
  }
  function handleResume() {
    bus.emit("cmd_resume");
  }
  function handlePause() {
    bus.emit("cmd_pause");
  }
  function handleMenu() {
    setResults(null);
    onExitToMenu();
  }
  function handleToggleMuted(v: boolean) {
    setMuted(v);
    bus.emit("cmd_setMuted", v);
  }
  function handleToggleReducedMotion(v: boolean) {
    setReducedMotion(v);
    bus.emit("cmd_setReducedMotion", v);
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center river-frame">
      {/* Lush shoreline framing around the playfield */}
      <div className="absolute inset-0 pointer-events-none opacity-35 mix-blend-screen river-ripples" />
      <div className="absolute inset-y-0 left-0 w-[10vw] pointer-events-none river-vines opacity-90 [mask-image:linear-gradient(to_right,black,transparent)]" />
      <div className="absolute inset-y-0 right-0 w-[10vw] pointer-events-none river-vines opacity-90 [mask-image:linear-gradient(to_left,black,transparent)]" />
      <div className="absolute inset-x-0 bottom-0 h-[8vh] pointer-events-none river-vines opacity-80 [mask-image:linear-gradient(to_top,black,transparent)]" />

      <div
        ref={hostRef}
        id="phaser-host"
        className="relative z-10 rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.55)] ring-4 ring-river-wood/70"
        style={{
          width: "min(96vw, calc(96vh * (800 / 600)))",
          aspectRatio: "800 / 600",
          touchAction: "none",
        }}
      />


      <TouchControls />

      {paused && !results && (
        <PauseMenu
          onResume={handleResume}
          onRestart={handleRestart}
          onMenu={handleMenu}
          muted={muted}
          onToggleMuted={handleToggleMuted}
          reducedMotion={reducedMotion}
          onToggleReducedMotion={handleToggleReducedMotion}
        />
      )}

      {results && (
        <ResultsModal
          data={results}
          onPlayAgain={handleRestart}
          onMenu={handleMenu}
        />
      )}

      <button
        onClick={handlePause}
        className="press-pop absolute top-3 left-3 z-30 px-3.5 py-1.5 rounded-xl bg-river-navy/80 text-river-foam text-xs font-bold uppercase tracking-widest backdrop-blur border border-river-aqua/30 hover:bg-river-navy focus:outline-none focus:ring-2 focus:ring-river-aqua"
      >
        Menu
      </button>

    </div>
  );
}
