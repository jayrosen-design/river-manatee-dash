import mitt from "mitt";

export type GameEvents = {
  // Phaser -> React
  score: number;
  highScore: number;
  lives: number;
  lettuceRemaining: number;
  lettuceTotal: number;
  levelComplete: {
    score: number;
    lettuceCollected: number;
    livesRemaining: number;
    completionBonus: number;
  };
  gameOver: {
    score: number;
    highScore: number;
    lettuceCollected: number;
  };
  paused: boolean;
  ready: void;
  // React -> Phaser
  cmd_pause: void;
  cmd_resume: void;
  cmd_restart: void;
  cmd_toMenu: void;
  cmd_setMuted: boolean;
  cmd_setReducedMotion: boolean;
  cmd_dir: "up" | "down" | "left" | "right";
};

export const bus = mitt<GameEvents>();
