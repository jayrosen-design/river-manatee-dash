import { FEAST_MOVE_LIMIT } from "@/game/constants";

interface Props {
  /** Moves already used. */
  used: number;
  /** Total moves allowed (defaults to the Manatee Feast limit of 10). */
  limit?: number;
  className?: string;
}

/**
 * Reusable move counter for Manatee Feast Mode (10-move scoring from the
 * original paper prototype). Rendered as a row of pips plus a numeric readout.
 */
export function MoveCounter({
  used,
  limit = FEAST_MOVE_LIMIT,
  className = "",
}: Props) {
  const left = Math.max(0, limit - used);
  return (
    <div
      className={`inline-flex items-center gap-3 rounded-2xl bg-river-navy/85 border border-river-aqua/30 px-4 py-2 ${className}`}
      role="status"
      aria-label={`${left} of ${limit} moves remaining`}
    >
      <span className="text-[10px] uppercase tracking-[0.25em] text-river-aqua font-bold">
        Moves
      </span>
      <span className="flex gap-1" aria-hidden>
        {Array.from({ length: limit }).map((_, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full ${
              i < left ? "bg-river-lettuce" : "bg-river-foam/20"
            }`}
          />
        ))}
      </span>
      <span className="font-mono font-black text-river-foam text-sm">
        {left}/{limit}
      </span>
    </div>
  );
}
