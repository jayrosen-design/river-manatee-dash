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
  water: 0x2a8aa8,
  waterDeep: 0x176079,
  waterLight: 0x3fb3c9,
  rope: 0xc9a86a,
  ropeShadow: 0x8b6b3a,
  buoy: 0xe85a3a,
  lettuce: 0x6fd14a,
  lettuceDark: 0x3f8a2a,
  manatee: 0x9aa1ac,
  manateeDark: 0x6b727c,
  manateeBelly: 0xc4c9d0,
  hazard: 0xff7a1a,
  hazardWarn: 0xff3a3a,
  propeller: 0x444a55,
  hudBg: 0x0e1f3a,
  hudText: 0xffffff,
  debris: 0x6b4a2a,
  boatHull: [0xd64545, 0x3fa9d6, 0xf2c14e],
};

export const SCORE = {
  LETTUCE: 100,
  LEVEL_COMPLETE: 1000,
  LIFE_BONUS: 500,
};

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
