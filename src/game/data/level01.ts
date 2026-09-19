import { COLS, ROWS } from "../constants";
import type { FoodSpec, JellySpec, LevelData, TileType, Waypoint } from "./types";

// Build a maze procedurally so it's easy to tweak.
// Strategy:
// 1) Fill with water.
// 2) Add a rope border.
// 3) Add interior rope rectangles to form corridors with loops.
// 4) Reserve boat lanes (clear rows/cols).
// 5) Auto-place food on every walkable cell not reserved for spawn / propeller.

function makeGrid(): TileType[][] {
  const g: TileType[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: TileType[] = [];
    for (let c = 0; c < COLS; c++) {
      const border = r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1;
      row.push(border ? "rope" : "water");
    }
    g.push(row);
  }
  return g;
}

function rect(
  g: TileType[][],
  c0: number,
  r0: number,
  c1: number,
  r1: number,
  t: TileType = "rope",
) {
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) g[r][c] = t;
    }
  }
}

function buildGrid(): TileType[][] {
  const g = makeGrid();

  // Top band
  rect(g, 2, 2, 4, 3);
  rect(g, 6, 2, 8, 4);
  rect(g, 10, 2, 11, 5);
  rect(g, 13, 2, 14, 5);
  rect(g, 16, 2, 18, 4);
  rect(g, 20, 2, 22, 3);

  // Upper-middle band
  rect(g, 2, 5, 4, 6);
  rect(g, 6, 6, 8, 7);
  rect(g, 10, 7, 14, 7);
  rect(g, 16, 6, 18, 7);
  rect(g, 20, 5, 22, 6);

  // Lower-middle band (row 8 is open lane)
  rect(g, 2, 9, 4, 10);
  rect(g, 6, 9, 8, 10);
  rect(g, 10, 9, 14, 9);
  rect(g, 16, 9, 18, 10);
  rect(g, 20, 9, 22, 10);

  // Bottom band
  rect(g, 2, 11, 4, 12);
  rect(g, 6, 12, 8, 13);
  rect(g, 10, 11, 11, 14);
  rect(g, 13, 11, 14, 14);
  rect(g, 16, 12, 18, 13);
  rect(g, 20, 11, 22, 12);

  g[1][1] = "water";

  // Boat lanes stay open
  for (let c = 1; c < COLS - 1; c++) g[8][c] = "water";
  for (let r = 1; r < ROWS - 1; r++) g[r][12] = "water";
  for (let c = 1; c < COLS - 1; c++) if (g[3][c] === "rope") g[3][c] = "water";

  return g;
}

const playerSpawn: Waypoint = { c: 1, r: 1 };

const propeller = { c: 5, r: 15, radiusTiles: 1.1 };

const boats = [
  {
    id: "boat-red",
    colorIndex: 0,
    speed: 80,
    waypoints: [
      { c: 1, r: 3 },
      { c: 23, r: 3 },
    ],
  },
  {
    id: "boat-blue",
    colorIndex: 1,
    speed: 95,
    waypoints: [
      { c: 12, r: 1 },
      { c: 12, r: 15 },
    ],
    warnAtCenterCrossing: true,
  },
  {
    id: "boat-yellow",
    colorIndex: 2,
    speed: 70,
    waypoints: [
      { c: 1, r: 8 },
      { c: 23, r: 8 },
    ],
  },
];

// Jellyfish hazards (Manatee Feast heritage): sting costs points, not a life.
const jellyfish: JellySpec[] = [
  { c: 17, r: 15, drift: 0.8 },
  { c: 9, r: 6, drift: 0 },
  { c: 22, r: 8, drift: 0.6 },
];

const decorativeDebris: Waypoint[] = [
  { c: 19, r: 15 },
  { c: 3, r: 14 },
  { c: 21, r: 14 },
];

const decor = {
  rocks: [
    { c: 1, r: 15 },
    { c: 23, r: 1 },
    { c: 15, r: 15 },
  ] as Waypoint[],
  reeds: [
    { c: 1, r: 11 },
    { c: 23, r: 12 },
    { c: 7, r: 15 },
    { c: 12, r: 15 },
  ] as Waypoint[],
};

// Bonus food placements (shrimp/fish/seaweed) — the rest of the maze is lettuce.
const bonusFoods: FoodSpec[] = [
  { c: 23, r: 15, kind: "fish" },
  { c: 1, r: 5, kind: "fish" },
  { c: 12, r: 4, kind: "shrimp" },
  { c: 12, r: 13, kind: "shrimp" },
  { c: 5, r: 8, kind: "shrimp" },
  { c: 19, r: 8, kind: "shrimp" },
  { c: 9, r: 12, kind: "seaweed" },
  { c: 15, r: 12, kind: "seaweed" },
  { c: 9, r: 1, kind: "seaweed" },
  { c: 15, r: 1, kind: "seaweed" },
];

function buildFoods(grid: TileType[][], exclude: Set<string>): FoodSpec[] {
  const bonusKey = new Map(bonusFoods.map((f) => [`${f.c},${f.r}`, f.kind]));
  const out: FoodSpec[] = [];
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (grid[r][c] !== "water") continue;
      const key = `${c},${r}`;
      if (exclude.has(key)) continue;
      out.push({ c, r, kind: bonusKey.get(key) ?? "lettuce" });
    }
  }
  return out;
}

function build(): LevelData {
  const grid = buildGrid();
  const exclude = new Set<string>();
  exclude.add(`${playerSpawn.c},${playerSpawn.r}`);
  exclude.add(`${playerSpawn.c + 1},${playerSpawn.r}`);
  exclude.add(`${playerSpawn.c},${playerSpawn.r + 1}`);
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) exclude.add(`${propeller.c + dc},${propeller.r + dr}`);
  decorativeDebris.forEach((d) => exclude.add(`${d.c},${d.r}`));
  jellyfish.forEach((j) => exclude.add(`${j.c},${j.r}`));
  decor.rocks.forEach((d) => exclude.add(`${d.c},${d.r}`));
  decor.reeds.forEach((d) => exclude.add(`${d.c},${d.r}`));

  return {
    id: "classic",
    name: "Classic Springs",
    subtitle: "The original river course",
    difficulty: 2,
    characterVariant: "manny",
    cols: COLS,
    rows: ROWS,
    zones: [{ index: 0, name: "Classic Springs", c0: 0, c1: COLS - 1 }],
    gates: [],
    grid,
    playerSpawn,
    foods: buildFoods(grid, exclude),
    boats,
    propellers: [propeller],
    jellyfish,
    debrisDecorative: decorativeDebris,
    decor,
  };
}

export const level01: LevelData = build();
