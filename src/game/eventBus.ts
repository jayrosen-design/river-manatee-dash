import mitt from "mitt";

export type GameEvents = {
  // Phaser -> React
  score: number;
  highScore: number;
  lives: number;
  lettuceRemaining: number;
  lettuceTotal: number;
  levelInfo: {
    index: number;
    count: number;
    name: string;
    subtitle: string;
  };
  levelComplete: {
    score: number;
    lettuceCollected: number;
    livesRemaining: number;
    completionBonus: number;
    highScore: number;
    levelIndex: number;
    levelCount: number;
    levelName: string;
    nextLevelName?: string;
  };
  gameOver: {
    score: number;
    highScore: number;
    lettuceCollected: number;
  };
  paused: boolean;
  ready: void;
  /** Current chain multiplier (1 = no combo). */
  combo: number;
  /** Dash stamina, 0..1. */
  dash: number;
  /** Which stretch of river the player is in and how much is left to clear there. */
  zone: { index: number; count: number; name: string; remaining: number; unlocked: boolean };
  // React -> Phaser
  cmd_pause: void;
  cmd_resume: void;
  cmd_restart: void;
  cmd_nextLevel: void;
  cmd_toMenu: void;
  cmd_setMuted: boolean;
  cmd_setReducedMotion: boolean;
  cmd_dir: "up" | "down" | "left" | "right";
  /** Hold-to-dash from touch controls. */
  cmd_dash: boolean;
};

export const bus = mitt<GameEvents>();
