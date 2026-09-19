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
  | {
      kind: "gameover";
      score: number;
      highScore: number;
      lettuceCollected: number;
    };

interface Props {
  data: ResultsState;
  onPlayAgain: () => void;
  onContinue: () => void;
  onMenu: () => void;
}

export function ResultsModal({ data, onPlayAgain, onContinue, onMenu }: Props) {
  const complete = data.kind === "complete";
  const campaignComplete = complete && data.levelIndex === data.levelCount - 1;
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-river-navy/85 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-sm rounded-3xl bg-river-navy border-2 border-river-aqua/35 text-river-foam p-6 shadow-2xl">
        <h2
          className={`text-3xl font-black text-center mb-4 ${
            complete ? "title-splash-green" : "title-splash"
          }`}
        >
          {campaignComplete ? "River Champion!" : complete ? "Course Cleared!" : "Game Over"}
        </h2>

        <dl className="grid grid-cols-2 gap-y-1.5 text-sm rounded-2xl bg-river-deep/50 p-4">
          {complete && (
            <>
              <dt className="opacity-75">Course</dt>
              <dd className="text-right font-black text-river-aqua">{data.levelName}</dd>
            </>
          )}
          <dt className="opacity-75">Final score</dt>
          <dd className="text-right font-mono font-black text-river-lettuce">
            {data.score.toLocaleString()}
          </dd>
          <dt className="opacity-75">Food collected</dt>
          <dd className="text-right font-mono">{data.lettuceCollected}</dd>
          {complete ? (
            <>
              <dt className="opacity-75">Manatees left</dt>
              <dd className="text-right font-mono">{data.livesRemaining}</dd>
              <dt className="opacity-75">Completion bonus</dt>
              <dd className="text-right font-mono">+{data.completionBonus.toLocaleString()}</dd>
            </>
          ) : (
            <>
              <dt className="opacity-75">High score</dt>
              <dd className="text-right font-mono">{data.highScore.toLocaleString()}</dd>
            </>
          )}
        </dl>

        {complete && (
          <p className="mt-4 text-xs italic text-river-aqua/85 text-center">
            {data.nextLevelName
              ? `Next up: ${data.nextLevelName}`
              : "All three waterways are safe. Responsible boating protects Florida wildlife."}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            onClick={complete ? onContinue : onPlayAgain}
            autoFocus
            className="press-pop px-4 py-2.5 rounded-xl bg-river-lettuce text-river-navy font-black shadow-[0_6px_0_var(--river-seaweed)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_3px_0_var(--river-seaweed)] focus:outline-none focus:ring-4 focus:ring-river-lettuce/40"
          >
            {campaignComplete
              ? "Start New Campaign"
              : complete
                ? `Continue to Level ${data.levelIndex + 2}`
                : "Try Again"}
          </button>
          {complete && !campaignComplete && (
            <button
              onClick={onPlayAgain}
              className="press-pop px-4 py-2 rounded-xl bg-river-teal/70 font-bold border border-river-aqua/30 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-river-aqua/30"
            >
              Replay Course
            </button>
          )}
          <button
            onClick={onMenu}
            className="press-pop px-4 py-2.5 rounded-xl bg-river-deep/80 font-bold border border-river-foam/15 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-river-foam/30"
          >
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}
