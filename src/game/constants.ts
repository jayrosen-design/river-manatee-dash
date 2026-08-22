// Game constants for River Manatee
export const TILE = 32;
export const COLS = 25;
export const ROWS = 17;
export const MAZE_W = TILE * COLS; // 800
export const MAZE_H = TILE * ROWS; // 544
export const HUD_H = 56;
export const GAME_W = MAZE_W;       // 800
export const GAME_H = MAZE_H + HUD_H; // 600

export const COLORS = {
  water: 0x118ab2,
  waterDeep: 0x073b4c,
  waterLight: 0x48cae4,
  rope: 0xd6a85a,
  ropeShadow: 0x9c7231,
  buoy: 0xef476f,
  lettuce: 0x7ed957,
  lettuceDark: 0x3f8a2a,
  manatee: 0xa8b8bd,
  manateeDark: 0x76888f,
  manateeBelly: 0xd6e2e6,
  hazard: 0xff8c42,
  hazardWarn: 0xef476f,
  propeller: 0x5b6670,
  hudBg: 0x102a43,
  hudText: 0xffffff,
  debris: 0x8b5a2b,
  boatHull: [0xe23c47, 0x2f9ad6, 0xf5c542],
};

export const SCORE = {
  LETTUCE: 100,
  LEVEL_COMPLETE: 1000,
  LIFE_BONUS: 500,
};

// Manatee Feast food values (from the original paper prototype)
export const FOOD_SCORE = {
  lettuce: 100,
  seaweed: 100,
  shrimp: 200,
  fish: 300,
} as const;

export type FoodKind = keyof typeof FOOD_SCORE;

// Jellyfish penalty (Manatee Feast: jellyfish sting costs points)
export const JELLY_PENALTY = 150;

// Manatee Feast mode: the paper game gave the player 10 moves.
export const FEAST_MOVE_LIMIT = 10;

export const PLAYER_SPEED = 130;   // pixels/sec
export const BOAT_SPEEDS = [80, 95, 70]; // px/sec for each boat
export const INVULN_MS = 2000;
export const HIT_FREEZE_MS = 400;
export const LIVES_START = 3;

export const STORAGE_KEYS = {
  HIGH: "riverManatee.highScore",
  MUTED: "riverManatee.muted",
  REDUCED: "riverManatee.reducedMotion",
};
