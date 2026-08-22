import { useEffect, useState } from "react";
import { FEAST_MOVE_LIMIT, FOOD_SCORE, STORAGE_KEYS } from "@/game/constants";
import { HowToPlay } from "./HowToPlay";

interface Props {
  onPlay: () => void;
}

const FEATURES: { icon: string; title: string; sub: string }[] = [
  { icon: "🥬", title: "Collect Food", sub: `Lettuce ${FOOD_SCORE.lettuce} · Fish ${FOOD_SCORE.fish}` },
  { icon: "🚤", title: "Avoid Boats", sub: "Stay safe in the lanes" },
  { icon: "🌀", title: "Dodge Hazards", sub: "Propellers & jellyfish" },
  { icon: "🩶", title: "3 Manatees", sub: "Can you clear the maze?" },
];

export function MainMenu({ onPlay }: Props) {
  const [highScore, setHighScore] = useState(0);
  const [muted, setMuted] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    setHighScore(Number(window.localStorage.getItem(STORAGE_KEYS.HIGH) || 0));
    setMuted(window.localStorage.getItem(STORAGE_KEYS.MUTED) === "1");
  }, []);

  function toggleMute() {
    const v = !muted;
    setMuted(v);
    window.localStorage.setItem(STORAGE_KEYS.MUTED, v ? "1" : "0");
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex items-center justify-center text-river-foam river-frame">
      {/* animated water surface */}
      <div className="absolute inset-0 opacity-50 mix-blend-screen river-ripples" />
      {/* shoreline vegetation */}
      <div className="absolute inset-y-0 left-0 w-24 sm:w-40 river-vines opacity-90 [mask-image:linear-gradient(to_right,black,transparent)]" />
      <div className="absolute inset-y-0 right-0 w-24 sm:w-40 river-vines opacity-90 [mask-image:linear-gradient(to_left,black,transparent)]" />
      <div className="absolute inset-x-0 bottom-0 h-24 river-vines opacity-80 [mask-image:linear-gradient(to_top,black,transparent)]" />

      <div className="relative z-10 w-full max-w-5xl px-6 py-10 grid gap-8 lg:grid-cols-[1.1fr_1fr] items-center">
        {/* Title block */}
        <div className="text-center lg:text-left">
          <p className="uppercase tracking-[0.45em] text-river-aqua text-[10px] sm:text-xs mb-3">
            A peaceful Florida arcade
          </p>
          <h1 className="text-6xl sm:text-8xl font-black leading-[0.85] tracking-tight bob-slow">
            <span className="block title-splash">RIVER</span>
            <span className="block title-splash-green">MANATEE</span>
          </h1>
          <div className="mt-4 inline-block rounded-lg bg-river-wood/90 px-4 py-1.5 border border-river-rope/60 shadow-lg">
            <span className="uppercase tracking-[0.3em] text-xs font-bold text-river-foam">
              Swim · Collect · Survive
            </span>
          </div>
          <p className="mt-5 text-river-foam/85 text-sm sm:text-base max-w-md mx-auto lg:mx-0">
            Guide Manny through the floating rope maze of the springs, feast on
            every lettuce, shrimp and fish, and slip past the boats.
          </p>

          <div className="mt-7 flex flex-col gap-3 items-stretch max-w-xs mx-auto lg:mx-0">
            <button
              onClick={onPlay}
              className="press-pop px-6 py-3.5 rounded-2xl bg-river-lettuce text-river-navy font-black text-lg tracking-wide shadow-[0_8px_0_var(--river-seaweed)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_4px_0_var(--river-seaweed)] focus:outline-none focus:ring-4 focus:ring-river-lettuce/40"
            >
              ▶ PLAY ARCADE
            </button>
            <button
              disabled
              title="Coming soon"
              className="px-6 py-3 rounded-2xl bg-river-navy/70 text-river-foam/50 border border-dashed border-river-aqua/40 font-semibold cursor-not-allowed text-sm"
            >
              🍽 Manatee Feast Mode — {FEAST_MOVE_LIMIT} moves (coming soon)
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => setShowHelp(true)}
                className="press-pop flex-1 px-4 py-2.5 rounded-xl bg-river-teal/70 hover:bg-river-teal text-river-foam border border-river-aqua/40 text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-river-aqua/40"
              >
                How to Play
              </button>
              <button
                onClick={toggleMute}
                className="press-pop px-4 py-2.5 rounded-xl bg-river-navy/70 hover:bg-river-navy text-river-foam text-sm border border-river-foam/15 focus:outline-none focus:ring-2 focus:ring-river-foam/40"
              >
                {muted ? "🔇" : "🔊"}
              </button>
            </div>
          </div>
        </div>

        {/* Feature cards + high score sign */}
        <div className="space-y-3">
          <div className="flex justify-center lg:justify-end">
            <div className="rounded-xl bg-river-wood px-5 py-2 border-2 border-river-rope shadow-[0_6px_0_rgba(0,0,0,0.35)] text-center">
              <div className="text-[10px] uppercase tracking-[0.25em] text-river-foam/80">
                High score
              </div>
              <div className="font-mono text-2xl font-black text-river-rope">
                {highScore.toLocaleString()}
              </div>
            </div>
          </div>
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex items-center gap-3 rounded-2xl bg-river-navy/80 border border-river-aqua/25 px-4 py-3 backdrop-blur-sm shadow-lg"
            >
              <span className="text-2xl leading-none" aria-hidden>
                {f.icon}
              </span>
              <div>
                <div className="font-black uppercase tracking-wide text-sm text-river-foam">
                  {f.title}
                </div>
                <div className="text-xs text-river-lettuce/90 font-semibold">
                  {f.sub}
                </div>
              </div>
            </div>
          ))}
          <p className="text-center lg:text-right text-[11px] text-river-foam/60 italic">
            Inspired by the paper prototype “Manatee Feast”.
          </p>
        </div>
      </div>

      {showHelp && <HowToPlay onClose={() => setShowHelp(false)} />}
    </div>
  );
}
