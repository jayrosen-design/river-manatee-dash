import { useEffect, useState } from "react";
import { STORAGE_KEYS } from "@/game/constants";
import { HowToPlay } from "./HowToPlay";

interface Props {
  onPlay: () => void;
}

export function MainMenu({ onPlay }: Props) {
  const [highScore, setHighScore] = useState(0);
  const [muted, setMuted] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const hs = Number(window.localStorage.getItem(STORAGE_KEYS.HIGH) || 0);
    setHighScore(hs);
    setMuted(window.localStorage.getItem(STORAGE_KEYS.MUTED) === "1");
  }, []);

  function toggleMute() {
    const v = !muted;
    setMuted(v);
    window.localStorage.setItem(STORAGE_KEYS.MUTED, v ? "1" : "0");
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center text-white">
      {/* Animated river background */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-600 via-cyan-700 to-emerald-900" />
      <div className="absolute inset-0 opacity-40 mix-blend-screen river-ripples" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-950/80 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-emerald-950/90 to-transparent" />

      <div className="relative z-10 max-w-xl w-full px-6 py-10 text-center">
        <p className="uppercase tracking-[0.4em] text-sky-200/80 text-xs mb-3">
          A peaceful Florida arcade
        </p>
        <h1 className="text-6xl sm:text-7xl font-black drop-shadow-[0_4px_18px_rgba(0,0,0,0.5)]">
          River <span className="text-emerald-300">Manatee</span>
        </h1>
        <p className="mt-4 text-sky-100/90 text-sm sm:text-base max-w-md mx-auto">
          Swim the springs, gather every lettuce, and steer clear of the boats.
        </p>

        <div className="mt-8 flex flex-col gap-3 items-stretch max-w-xs mx-auto">
          <button
            onClick={onPlay}
            className="px-6 py-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-bold text-lg shadow-lg shadow-emerald-900/50 focus:outline-none focus:ring-4 focus:ring-emerald-300/50"
          >
            ▶ Play
          </button>
          <button
            onClick={() => setShowHelp(true)}
            className="px-6 py-3 rounded-xl bg-sky-900/60 hover:bg-sky-900/80 text-white border border-sky-300/30 focus:outline-none focus:ring-4 focus:ring-sky-300/40"
          >
            How to Play
          </button>
          <button
            onClick={toggleMute}
            className="px-6 py-2 rounded-xl bg-slate-900/60 hover:bg-slate-900/80 text-white text-sm border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
          >
            {muted ? "🔇 Sound: Off" : "🔊 Sound: On"}
          </button>
        </div>

        <div className="mt-8 text-sky-100/80 text-sm">
          <span className="opacity-70">High score </span>
          <span className="font-mono font-bold text-emerald-200">
            {highScore.toLocaleString()}
          </span>
        </div>
      </div>

      {showHelp && <HowToPlay onClose={() => setShowHelp(false)} />}
    </div>
  );
}
