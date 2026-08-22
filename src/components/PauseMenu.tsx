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
      className="absolute inset-0 z-20 flex items-center justify-center bg-river-navy/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Paused"
    >
      <div className="w-full max-w-sm rounded-3xl bg-river-navy border-2 border-river-aqua/35 text-river-foam p-6 shadow-2xl">
        <h2 className="text-3xl font-black mb-5 text-center title-splash">
          Paused
        </h2>
        <div className="flex flex-col gap-2.5">
          <button
            onClick={onResume}
            autoFocus
            className="press-pop px-4 py-2.5 rounded-xl bg-river-lettuce text-river-navy font-black shadow-[0_6px_0_var(--river-seaweed)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_3px_0_var(--river-seaweed)] focus:outline-none focus:ring-4 focus:ring-river-lettuce/40"
          >
            Resume
          </button>
          <button
            onClick={onRestart}
            className="press-pop px-4 py-2.5 rounded-xl bg-river-teal font-bold hover:-translate-y-0.5 border border-river-aqua/40 focus:outline-none focus:ring-4 focus:ring-river-aqua/40"
          >
            Restart
          </button>
          <button
            onClick={onMenu}
            className="press-pop px-4 py-2.5 rounded-xl bg-river-deep/80 font-bold hover:-translate-y-0.5 border border-river-foam/15 focus:outline-none focus:ring-4 focus:ring-river-foam/30"
          >
            Main Menu
          </button>
        </div>
        <div className="mt-5 space-y-2 text-sm">
          <label className="flex items-center justify-between gap-2 cursor-pointer rounded-lg px-3 py-2 bg-river-deep/50">
            <span>Sound</span>
            <input
              type="checkbox"
              checked={!muted}
              onChange={(e) => onToggleMuted(!e.target.checked)}
              className="h-4 w-8 accent-[var(--river-lettuce)]"
            />
          </label>
          <label className="flex items-center justify-between gap-2 cursor-pointer rounded-lg px-3 py-2 bg-river-deep/50">
            <span>Reduced motion</span>
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => onToggleReducedMotion(e.target.checked)}
              className="h-4 w-8 accent-[var(--river-lettuce)]"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
