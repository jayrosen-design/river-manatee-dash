interface Props {
  onClose: () => void;
}

export function HowToPlay({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="How to play"
    >
      <div className="max-w-md w-full rounded-2xl bg-slate-900 text-white shadow-2xl border border-white/10 p-6">
        <h2 className="text-2xl font-black text-emerald-300 mb-3">
          How to Play
        </h2>
        <ul className="space-y-2 text-sm leading-relaxed">
          <li>
            🕹️ <b>Move</b> with Arrow Keys or WASD. On mobile, swipe or use the
            on-screen pad.
          </li>
          <li>
            🥬 <b>Collect every lettuce</b> floating in the river to finish the
            level.
          </li>
          <li>
            🚤 <b>Avoid boats</b> patrolling the corridors and the spinning
            propeller hazard.
          </li>
          <li>
            ❤️ You have <b>three lives</b>. After a hit you briefly flash and
            cannot be hit again.
          </li>
          <li>
            ⏸ Press <b>Esc</b> or the pause button to pause.
          </li>
        </ul>
        <p className="mt-4 text-xs text-sky-200/80 italic">
          Slow down in manatee zones. Responsible boating helps protect Florida
          wildlife.
        </p>
        <button
          onClick={onClose}
          className="mt-5 w-full px-4 py-2 rounded-lg bg-emerald-400 text-emerald-950 font-bold hover:bg-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-300/50"
          autoFocus
        >
          Got it
        </button>
      </div>
    </div>
  );
}
