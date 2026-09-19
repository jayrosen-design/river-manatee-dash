import { bus } from "@/game/eventBus";

const btn =
  "w-12 h-12 rounded-full bg-white/15 backdrop-blur border border-white/30 text-white text-xl font-bold flex items-center justify-center active:bg-white/30 select-none touch-manipulation focus:outline-none focus:ring-2 focus:ring-white/60";

export function TouchControls() {
  const startDash = () => bus.emit("cmd_dash", true);
  const stopDash = () => bus.emit("cmd_dash", false);

  return (
    <>
      <button
        className="absolute z-20 bottom-3 left-3 md:hidden h-16 w-16 rounded-full border-2 border-river-lettuce/60 bg-river-lettuce/30 text-[11px] font-black uppercase tracking-widest text-white backdrop-blur select-none touch-manipulation active:bg-river-lettuce/60 focus:outline-none focus:ring-2 focus:ring-white/60 pointer-events-auto"
        onPointerDown={startDash}
        onPointerUp={stopDash}
        onPointerCancel={stopDash}
        onPointerLeave={stopDash}
        onContextMenu={(event) => event.preventDefault()}
        aria-label="Hold to dash"
      >
        Dash
      </button>
      <div
        className="absolute z-20 bottom-3 right-3 md:hidden flex flex-col items-center gap-1 pointer-events-auto"
        aria-label="Directional pad"
      >
        <button className={btn} onPointerDown={() => bus.emit("cmd_dir", "up")} aria-label="Up">
          ▲
        </button>
        <div className="flex gap-1">
          <button
            className={btn}
            onPointerDown={() => bus.emit("cmd_dir", "left")}
            aria-label="Left"
          >
            ◀
          </button>
          <button
            className={btn}
            onPointerDown={() => bus.emit("cmd_dir", "down")}
            aria-label="Down"
          >
            ▼
          </button>
          <button
            className={btn}
            onPointerDown={() => bus.emit("cmd_dir", "right")}
            aria-label="Right"
          >
            ▶
          </button>
        </div>
      </div>
    </>
  );
}
