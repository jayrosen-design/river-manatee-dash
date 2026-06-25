interface Props {
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
  muted: boolean;
  onToggleMuted: (v: boolean) => void;
  reducedMotion: boolean;
  onToggleReducedMotion: (v: boolean) => void;
}

export function PauseMenu({
  onResume,
  onRestart,
  onMenu,
  muted,
  onToggleMuted,
  reducedMotion,
  onToggleReducedMotion,
}: Props) {
  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Paused"
    >
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-white/10 text-white p-6 shadow-2xl">
        <h2 className="text-2xl font-black mb-4 text-center">Paused</h2>
        <div className="flex flex-col gap-2">
          <button
            onClick={onResume}
            autoFocus
            className="px-4 py-2 rounded-lg bg-emerald-400 text-emerald-950 font-bold hover:bg-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-300/50"
          >
            Resume
          </button>
          <button
            onClick={onRestart}
            className="px-4 py-2 rounded-lg bg-sky-700 hover:bg-sky-600 font-semibold focus:outline-none focus:ring-4 focus:ring-sky-400/50"
          >
            Restart
          </button>
          <button
            onClick={onMenu}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 font-semibold focus:outline-none focus:ring-4 focus:ring-slate-400/50"
          >
            Main Menu
          </button>
        </div>
        <div className="mt-5 space-y-2 text-sm">
          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span>Sound</span>
            <input
              type="checkbox"
              checked={!muted}
              onChange={(e) => onToggleMuted(!e.target.checked)}
              className="h-4 w-8"
            />
          </label>
          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <span>Reduced motion</span>
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => onToggleReducedMotion(e.target.checked)}
              className="h-4 w-8"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
