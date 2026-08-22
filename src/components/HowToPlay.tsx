import { FOOD_SCORE, JELLY_PENALTY } from "@/game/constants";

interface Props {
  onClose: () => void;
}

export function HowToPlay({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-river-navy/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="How to play"
    >
      <div className="max-w-md w-full rounded-3xl bg-river-navy text-river-foam shadow-2xl border-2 border-river-aqua/35 p-6">
        <h2 className="text-3xl font-black title-splash mb-4">How to Play</h2>
        <ul className="space-y-2 text-sm leading-relaxed list-disc pl-5 marker:text-river-lettuce">
          <li>
            <b>Move</b> with Arrow Keys or WASD. On mobile, swipe or use the
            on-screen pad.
          </li>
          <li>
            <b>Clear the river</b> of every food item to finish the level.
          </li>
          <li>
            <b>Food values:</b> lettuce {FOOD_SCORE.lettuce}, seaweed{" "}
            {FOOD_SCORE.seaweed}, shrimp {FOOD_SCORE.shrimp}, fish{" "}
            {FOOD_SCORE.fish}.
          </li>
          <li>
            <b>Avoid boats</b> and the spinning propeller — each costs a
            manatee.
          </li>
          <li>
            <b>Jellyfish sting</b> for −{JELLY_PENALTY} points, so weave
            around them.
          </li>
          <li>
            You have <b>three manatees</b>. After a hit you briefly flash and
            cannot be hit again.
          </li>
          <li>
            Press <b>Esc</b> or the pause button to pause.
          </li>
        </ul>
        <button
          onClick={onClose}
          className="press-pop mt-5 w-full px-4 py-2.5 rounded-xl bg-river-lettuce text-river-navy font-black shadow-[0_6px_0_var(--river-seaweed)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_3px_0_var(--river-seaweed)] focus:outline-none focus:ring-4 focus:ring-river-lettuce/40"
          autoFocus
        >
          Got it
        </button>
      </div>
    </div>
  );
}
