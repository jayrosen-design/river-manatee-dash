import { useEffect, useRef, useState } from "react";
import { bus } from "@/game/eventBus";
import { PauseMenu } from "./PauseMenu";
import { ResultsModal } from "./ResultsModal";
import { TouchControls } from "./TouchControls";
import { STORAGE_KEYS } from "@/game/constants";
import { audio } from "@/game/systems/AudioSystem";

interface Props {
  onExitToMenu: () => void;
}

type ResultsState =
  | {
      kind: "complete";
      score: number;
      lettuceCollected: number;
      livesRemaining: number;
      completionBonus: number;
      highScore: number;
      levelIndex: number;
      levelCount: number;
      levelName: string;
      nextLevelName?: string;
    }
  | { kind: "gameover"; score: number; highScore: number; lettuceCollected: number }
  | null;

export function GameContainer({ onExitToMenu }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<unknown>(null);
  const [paused, setPaused] = useState(false);
  const [results, setResults] = useState<ResultsState>(null);
  const [muted, setMuted] = useState(
    typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEYS.MUTED) === "1",
  );
  const [reducedMotion, setReducedMotion] = useState(
    typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEYS.REDUCED) === "1",
  );
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [foodRemaining, setFoodRemaining] = useState(0);
  const [combo, setCombo] = useState(1);
  const [dash, setDash] = useState(1);
  const [zone, setZone] = useState({
    index: 0,
    count: 3,
    name: "Headspring",
    remaining: 0,
    unlocked: false,
  });
  const [levelInfo, setLevelInfo] = useState({
    index: 0,
    count: 3,
    name: "Spring Run",
    subtitle: "",
  });

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
    const onScore = (s: number) => setScore(s);
    const onLives = (n: number) => setLives(n);
    const onFood = (n: number) => setFoodRemaining(n);
    const onCombo = (n: number) => setCombo(n);
    const onDash = (n: number) => setDash(n);
    const onZone = (z: typeof zone) => setZone(z);
    const onLevel = (info: typeof levelInfo) => setLevelInfo(info);
    const onPaused = (p: boolean) => setPaused(p);
    const onComplete = (d: {
      score: number;
      lettuceCollected: number;
      livesRemaining: number;
      completionBonus: number;
      highScore: number;
      levelIndex: number;
      levelCount: number;
      levelName: string;
      nextLevelName?: string;
    }) =>
      setResults({
        kind: "complete",
        ...d,
      });
    const onGameOver = (d: { score: number; highScore: number; lettuceCollected: number }) =>
      setResults({
        kind: "gameover",
        score: d.score,
        highScore: d.highScore,
        lettuceCollected: d.lettuceCollected,
      });

    bus.on("highScore", onHigh);
    bus.on("score", onScore);
    bus.on("lives", onLives);
    bus.on("lettuceRemaining", onFood);
    bus.on("combo", onCombo);
    bus.on("dash", onDash);
    bus.on("zone", onZone);
    bus.on("levelInfo", onLevel);
    bus.on("paused", onPaused);
    bus.on("levelComplete", onComplete);
    bus.on("gameOver", onGameOver);

    return () => {
      disposed = true;
      bus.off("highScore", onHigh);
      bus.off("score", onScore);
      bus.off("lives", onLives);
      bus.off("lettuceRemaining", onFood);
      bus.off("combo", onCombo);
      bus.off("dash", onDash);
      bus.off("zone", onZone);
      bus.off("levelInfo", onLevel);
      bus.off("paused", onPaused);
      bus.off("levelComplete", onComplete);
      bus.off("gameOver", onGameOver);
      try {
        audio.dispose();
      } catch {
        /* ignore */
      }
      try {
        game?.destroy(true);
      } catch {
        /* ignore */
      }
    };
  }, []);

  // Prevent page scroll while playing
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function handleRestart() {
    setResults(null);
    bus.emit("cmd_restart");
  }
  function handleNextLevel() {
    setResults(null);
    bus.emit("cmd_nextLevel");
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
        id="three-game-host"
        className="relative z-10 rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.55)] ring-4 ring-river-wood/70"
        style={{
          width: "min(96vw, calc(96vh * (800 / 600)))",
          aspectRatio: "800 / 600",
          touchAction: "none",
        }}
      />

      <div className="pointer-events-none absolute top-3 left-1/2 z-20 flex w-[min(78vw,650px)] -translate-x-1/2 items-center justify-between gap-2 rounded-2xl border border-river-aqua/30 bg-river-navy/85 px-4 py-2 text-river-foam shadow-xl backdrop-blur-md">
        <div className="min-w-0">
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-river-aqua">
            Level {levelInfo.index + 1} / {levelInfo.count}
          </div>
          <div className="truncate text-sm font-black uppercase">{levelInfo.name}</div>
          <div className="truncate text-[10px] font-bold uppercase tracking-wider text-river-foam/80">
            Zone {zone.index + 1}/{zone.count} · {zone.name}
            <span className={zone.unlocked ? "text-river-lettuce" : "text-amber-300"}>
              {" "}
              {zone.unlocked ? "· open" : `· ${zone.remaining} to unlock`}
            </span>
          </div>
        </div>
        <div className="hidden gap-5 sm:flex">
          <div className="text-center">
            <div className="text-[9px] font-black uppercase tracking-wider text-river-aqua">
              Score
            </div>
            <div className="font-mono text-sm font-black text-river-lettuce">
              {score.toLocaleString()}
            </div>
          </div>
          <div className="text-center">
            <div className="text-[9px] font-black uppercase tracking-wider text-river-aqua">
              Best
            </div>
            <div className="font-mono text-sm font-black">{highScore.toLocaleString()}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs font-black">
          <span title="Food remaining in this zone / whole river">
            🥬 {zone.remaining}
            <span className="hidden text-river-foam/60 sm:inline"> / {foodRemaining}</span>
          </span>
          <span title="Manatees remaining">♥ {lives}</span>
        </div>
      </div>

      {/* Combo badge: pops in whenever a chain multiplier is active. */}
      <div
        className={`pointer-events-none absolute top-[4.4rem] left-1/2 z-20 -translate-x-1/2 rounded-full border px-4 py-1 text-sm font-black uppercase tracking-[0.18em] shadow-lg backdrop-blur-md transition-all duration-200 ${
          combo > 1
            ? "scale-100 opacity-100 " +
              (combo >= 4
                ? "border-pink-300/60 bg-pink-500/80 text-white"
                : combo >= 3
                  ? "border-amber-200/60 bg-amber-400/85 text-river-navy"
                  : "border-river-lettuce/60 bg-river-lettuce/85 text-river-navy")
            : "scale-75 opacity-0"
        }`}
        aria-live="polite"
      >
        x{combo} Combo
      </div>

      {/* Dash meter: hold Space/Shift (or the DASH button) to boost. */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 w-[min(60vw,320px)] -translate-x-1/2 rounded-full border border-river-aqua/30 bg-river-navy/80 px-3 py-1.5 text-river-foam shadow-lg backdrop-blur-md">
        <div className="mb-1 flex justify-between text-[9px] font-black uppercase tracking-[0.2em] text-river-aqua">
          <span>Dash</span>
          <span className="hidden sm:inline">hold Space / Shift</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-[width] duration-100 ${
              dash < 0.2 ? "bg-red-400" : "bg-gradient-to-r from-river-aqua to-river-lettuce"
            }`}
            style={{ width: `${Math.round(dash * 100)}%` }}
          />
        </div>
      </div>

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
          onContinue={handleNextLevel}
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
