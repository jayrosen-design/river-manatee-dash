type ResultsState =
  | {
      kind: "complete";
      score: number;
      lettuceCollected: number;
      livesRemaining: number;
      completionBonus: number;
      highScore: number;
    }
  | {
      kind: "gameover";
      score: number;
      highScore: number;
      lettuceCollected: number;
    };

interface Props {
  data: ResultsState;
  onPlayAgain: () => void;
  onMenu: () => void;
}

export function ResultsModal({ data, onPlayAgain, onMenu }: Props) {
  const complete = data.kind === "complete";
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-white/10 text-white p-6 shadow-2xl">
        <h2
          className={`text-3xl font-black text-center mb-3 ${
            complete ? "text-emerald-300" : "text-rose-300"
          }`}
        >
          {complete ? "Level Complete!" : "Game Over"}
        </h2>

        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="opacity-70">Final score</dt>
          <dd className="text-right font-mono font-bold">
            {data.score.toLocaleString()}
          </dd>
          <dt className="opacity-70">Lettuce collected</dt>
          <dd className="text-right font-mono">{data.lettuceCollected}</dd>
          {complete ? (
            <>
              <dt className="opacity-70">Lives remaining</dt>
              <dd className="text-right font-mono">
                {data.livesRemaining}
              </dd>
              <dt className="opacity-70">Completion bonus</dt>
              <dd className="text-right font-mono">
                +{data.completionBonus.toLocaleString()}
              </dd>
            </>
          ) : (
            <>
              <dt className="opacity-70">High score</dt>
              <dd className="text-right font-mono">
                {data.highScore.toLocaleString()}
              </dd>
            </>
          )}
        </dl>

        {complete && (
          <p className="mt-4 text-xs italic text-sky-200/80 text-center">
            Slow down in manatee zones. Responsible boating helps protect
            Florida wildlife.
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          <button
            onClick={onPlayAgain}
            autoFocus
            className="px-4 py-2 rounded-lg bg-emerald-400 text-emerald-950 font-bold hover:bg-emerald-300 focus:outline-none focus:ring-4 focus:ring-emerald-300/50"
          >
            Play Again
          </button>
          <button
            onClick={onMenu}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 font-semibold focus:outline-none focus:ring-4 focus:ring-slate-400/50"
          >
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}
