import { COLS, ROWS } from "../constants";
import type { LevelData, TileType, Waypoint } from "./types";

// Build a maze procedurally so it's easy to tweak.
// Strategy:
// 1) Fill with water.
// 2) Add a rope border.
// 3) Add interior rope rectangles to form corridors with loops.
// 4) Reserve boat lanes (clear rows/cols).
// 5) Auto-place lettuce on every walkable cell not reserved for spawn / propeller / boat-only lanes.

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

  // Interior wall blocks — arranged with horizontal corridors at rows 2, 8, 14
  // and vertical corridors at cols 2, 12, 22. Plus loops in between.
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
  rect(g, 10, 7, 14, 7); // spine across middle (row 7)
  rect(g, 16, 6, 18, 7);
  rect(g, 20, 5, 22, 6);

  // Lower-middle band (row 8 is open lane)
  rect(g, 2, 9, 4, 10);
  rect(g, 6, 9, 8, 10);
  rect(g, 10, 9, 14, 9); // spine across middle (row 9)
  rect(g, 16, 9, 18, 10);
  rect(g, 20, 9, 22, 10);

  // Bottom band
  rect(g, 2, 11, 4, 12);
  rect(g, 6, 12, 8, 13);
  rect(g, 10, 11, 11, 14);
  rect(g, 13, 11, 14, 14);
  rect(g, 16, 12, 18, 13);
  rect(g, 20, 11, 22, 12);

  // Carve a small safe pocket near player spawn to avoid hugging walls
  g[1][1] = "water";

  // Ensure boat lanes are open:
  // Row 8 fully open (horizontal lane)
  for (let c = 1; c < COLS - 1; c++) g[8][c] = "water";
  // Col 12 fully open (vertical lane)
  for (let r = 1; r < ROWS - 1; r++) g[r][12] = "water";
  // Row 3 horizontal patrol partial — open it fully too
  for (let c = 1; c < COLS - 1; c++) if (g[3][c] === "rope") g[3][c] = "water";

  return g;
}

function autoLettuce(
  grid: TileType[][],
  exclude: Set<string>,
): Waypoint[] {
  const out: Waypoint[] = [];
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (grid[r][c] !== "water") continue;
      if (exclude.has(`${c},${r}`)) continue;
      out.push({ c, r });
    }
  }
  return out;
}

const playerSpawn: Waypoint = { c: 1, r: 1 };

// Propeller location (in a wider water area along bottom-left)
const propeller = { c: 5, r: 15, radiusTiles: 1.1 };

// Boat routes (loop through these waypoints, walking valid corridors)
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

const decorativeDebris: Waypoint[] = [
  { c: 19, r: 15 },
  { c: 3, r: 14 },
  { c: 21, r: 14 },
];

function build(): LevelData {
  const grid = buildGrid();
  const exclude = new Set<string>();
  exclude.add(`${playerSpawn.c},${playerSpawn.r}`);
  // Reserve a small safe ring around spawn
  exclude.add(`${playerSpawn.c + 1},${playerSpawn.r}`);
  exclude.add(`${playerSpawn.c},${playerSpawn.r + 1}`);
  // Reserve propeller cell + adjacent cells
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++)
      exclude.add(`${propeller.c + dc},${propeller.r + dr}`);
  // Reserve decorative debris cells
  decorativeDebris.forEach((d) => exclude.add(`${d.c},${d.r}`));

  const lettuce = autoLettuce(grid, exclude);

  return {
    cols: COLS,
    rows: ROWS,
    grid,
    playerSpawn,
    lettuce,
    boats,
    propellers: [propeller],
    debrisDecorative: decorativeDebris,
  };
}

export const level01: LevelData = build();
