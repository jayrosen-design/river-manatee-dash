import { createFileRoute } from "@tanstack/react-router";
import { useState, lazy, Suspense } from "react";
import { MainMenu } from "@/components/MainMenu";

const GameContainer = lazy(() =>
  import("@/components/GameContainer").then((m) => ({ default: m.GameContainer })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "River Manatee — A peaceful Florida arcade game" },
      {
        name: "description",
        content:
          "Swim a friendly manatee through rope mazes, collect lettuce, and dodge boats in this top-down arcade game set on a Florida river.",
      },
      { property: "og:title", content: "River Manatee" },
      {
        property: "og:description",
        content:
          "A polished top-down arcade game about a Florida manatee gathering lettuce while avoiding boats and propellers.",
      },
    ],
  }),
  component: Index,
  ssr: false,
});

function Index() {
  const [screen, setScreen] = useState<"menu" | "game">("menu");
  return (
    <div className="min-h-screen w-full bg-slate-950 text-white">
      {screen === "menu" ? (
        <MainMenu onPlay={() => setScreen("game")} />
      ) : (
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center text-sky-200">
              Loading river…
            </div>
          }
        >
          <div className="min-h-screen w-full">
            <GameContainer onExitToMenu={() => setScreen("menu")} />
          </div>
        </Suspense>
      )}
    </div>
  );
}
