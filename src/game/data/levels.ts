import { COLS, ROWS } from "../constants";
import type {
  BoatRoute,
  FoodSpec,
  GateSpec,
  JellySpec,
  LevelData,
  PropellerSpec,
  TileType,
  Waypoint,
  ZoneSpec,
} from "./types";

type Rect = [c0: number, r0: number, c1: number, r1: number];

/**
 * One screen-wide stretch of river, authored in local columns 0..COLS-1.
 * Levels chain several sections left to right; the shared border column
 * between two sections becomes a wall with a locked gate in the middle rows.
 */
interface SectionRecipe {
  name: string;
  islands: Rect[];
  boats: BoatRoute[];
  propellers: PropellerSpec[];
  jellyfish: JellySpec[];
  decor: LevelData["decor"];
  debris: Waypoint[];
  foodStride: number;
  bonusFoods: FoodSpec[];
}

interface LevelRecipe {
  id: string;
  name: string;
  subtitle: string;
  difficulty: 1 | 2 | 3;
  characterVariant: LevelData["characterVariant"];
  spawn: Waypoint;
  sections: SectionRecipe[];
  /** Rows of the opening in each wall between sections. */
  gateRows?: number[];
}

/** Sections overlap by one column (the shared wall), so each adds COLS - 1. */
const SECTION_STRIDE = COLS - 1;
const DEFAULT_GATE_ROWS = [7, 8, 9];

function routeCells(route: BoatRoute): Waypoint[] {
  const cells: Waypoint[] = [];
  for (let index = 0; index < route.waypoints.length; index++) {
    const from = route.waypoints[index];
    const to = route.waypoints[(index + 1) % route.waypoints.length];
    const dc = Math.sign(to.c - from.c);
    const dr = Math.sign(to.r - from.r);
    const length = Math.max(Math.abs(to.c - from.c), Math.abs(to.r - from.r));
    for (let step = 0; step <= length; step++) {
      cells.push({ c: from.c + dc * step, r: from.r + dr * step });
    }
  }
  return cells;
}

function makeGrid(islands: Rect[], boats: BoatRoute[]): TileType[][] {
  const grid = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c): TileType =>
      r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1 ? "rope" : "water",
    ),
  );

  for (const [c0, r0, c1, r1] of islands) {
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) grid[r][c] = "rope";
    }
  }

  // Patrols always get a visually clear channel through the course.
  for (const route of boats) {
    for (const { c, r } of routeCells(route)) {
      if (c > 0 && c < COLS - 1 && r > 0 && r < ROWS - 1) {
        grid[r][c] = "water";
      }
    }
  }
  return grid;
}

function buildFoods(
  grid: TileType[][],
  columns: [first: number, last: number],
  stride: number,
  difficulty: number,
  bonuses: Map<string, FoodSpec>,
  excluded: Set<string>,
): FoodSpec[] {
  const foods: FoodSpec[] = [];
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = columns[0]; c <= columns[1]; c++) {
      const key = `${c},${r}`;
      if (grid[r][c] !== "water" || excluded.has(key)) continue;

      const bonus = bonuses.get(key);
      // A spaced trail keeps each pickup meaningful and removes tedious cleanup.
      const onTrail =
        (c + r * 2 + difficulty) % stride === 0 || (r % 5 === 1 && c % 6 === difficulty);
      if (bonus || onTrail) {
        foods.push(bonus ?? { c, r, kind: "lettuce" });
      }
    }
  }
  return foods;
}

/** Shift a section-local point into level columns, keeping boats off the walls. */
function offsetPoint<T extends Waypoint>(point: T, offset: number): T {
  return { ...point, c: Math.min(COLS - 2, Math.max(1, point.c)) + offset };
}

function buildLevel(recipe: LevelRecipe): LevelData {
  const gateRows = recipe.gateRows ?? DEFAULT_GATE_ROWS;
  const cols = SECTION_STRIDE * recipe.sections.length + 1;
  const grid: TileType[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: cols }, (): TileType => "rope"),
  );
  const zones: ZoneSpec[] = [];
  const gates: GateSpec[] = [];
  const boats: BoatRoute[] = [];
  const propellers: PropellerSpec[] = [];
  const jellyfish: JellySpec[] = [];
  const debris: Waypoint[] = [];
  const decor: LevelData["decor"] = { rocks: [], reeds: [] };
  const excluded = new Set<string>([
    `${recipe.spawn.c},${recipe.spawn.r}`,
    `${recipe.spawn.c + 1},${recipe.spawn.r}`,
    `${recipe.spawn.c},${recipe.spawn.r + 1}`,
  ]);
  const bonuses = new Map<string, FoodSpec>();

  recipe.sections.forEach((section, index) => {
    const offset = index * SECTION_STRIDE;
    const sectionBoats = section.boats.map((route) => ({
      ...route,
      id: `${recipe.id}-${index}-${route.id}`,
      waypoints: route.waypoints.map((point) => offsetPoint(point, 0)),
    }));
    const local = makeGrid(section.islands, sectionBoats);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) grid[r][offset + c] = local[r][c];
    }

    boats.push(
      ...sectionBoats.map((route) => ({
        ...route,
        waypoints: route.waypoints.map((point) => offsetPoint(point, offset)),
      })),
    );
    propellers.push(...section.propellers.map((p) => offsetPoint(p, offset)));
    jellyfish.push(...section.jellyfish.map((p) => offsetPoint(p, offset)));
    debris.push(...section.debris.map((p) => offsetPoint(p, offset)));
    decor.rocks.push(...section.decor.rocks.map((p) => offsetPoint(p, offset)));
    decor.reeds.push(...section.decor.reeds.map((p) => offsetPoint(p, offset)));
    for (const food of section.bonusFoods) {
      const placed = offsetPoint(food, offset);
      bonuses.set(`${placed.c},${placed.r}`, placed);
    }

    const last = index === recipe.sections.length - 1;
    zones.push({
      index,
      name: section.name,
      c0: offset,
      c1: last ? cols - 1 : offset + SECTION_STRIDE - 1,
    });
    if (!last) {
      gates.push({ index, c: offset + SECTION_STRIDE, rows: [...gateRows] });
    }
  });

  // Carve gates only after every section has been stamped in, otherwise the next
  // section's border column would overwrite the opening with wall again.
  for (const gate of gates) {
    for (const r of gate.rows) {
      grid[r][gate.c] = "gate";
      // Short approach channel on both sides so the doorway is never blocked.
      for (const dc of [-2, -1, 1, 2]) grid[r][gate.c + dc] = "water";
    }
  }

  for (const propeller of propellers) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        excluded.add(`${propeller.c + dc},${propeller.r + dr}`);
      }
    }
  }
  // Collectibles sit beside traffic lanes, never directly under a boat.
  for (const route of boats) {
    for (const point of routeCells(route)) excluded.add(`${point.c},${point.r}`);
  }
  for (const point of [...jellyfish, ...debris, ...decor.rocks, ...decor.reeds]) {
    excluded.add(`${point.c},${point.r}`);
  }
  // Keep gate approaches clear so a fresh zone never starts with food in the doorway.
  for (const gate of gates) {
    for (const r of gate.rows) {
      for (const dc of [-1, 1]) excluded.add(`${gate.c + dc},${r}`);
    }
  }

  const foods = recipe.sections.flatMap((section, index) => {
    const offset = index * SECTION_STRIDE;
    return buildFoods(
      grid,
      [offset + 1, offset + COLS - 2],
      section.foodStride,
      recipe.difficulty,
      bonuses,
      excluded,
    );
  });

  return {
    id: recipe.id,
    name: recipe.name,
    subtitle: recipe.subtitle,
    difficulty: recipe.difficulty,
    characterVariant: recipe.characterVariant,
    cols,
    rows: ROWS,
    zones,
    gates,
    grid,
    playerSpawn: recipe.spawn,
    foods,
    boats,
    propellers,
    jellyfish,
    debrisDecorative: debris,
    decor,
  };
}

// ---------------------------------------------------------------------------
// Level 1: Spring Run — three stretches of a first-magnitude spring run.
// ---------------------------------------------------------------------------

const headspring: SectionRecipe = {
  name: "Headspring",
  islands: [
    [4, 3, 7, 5],
    [11, 2, 14, 4],
    [18, 3, 21, 5],
    [3, 10, 6, 13],
    [10, 9, 14, 12],
    [18, 10, 21, 13],
  ],
  boats: [
    {
      id: "spring-skiff",
      colorIndex: 1,
      speed: 68,
      waypoints: [
        { c: 2, r: 7 },
        { c: 22, r: 7 },
      ],
      warnAtCenterCrossing: true,
    },
    {
      id: "spring-cruiser",
      colorIndex: 2,
      speed: 60,
      waypoints: [
        { c: 16, r: 1 },
        { c: 16, r: 15 },
      ],
    },
    {
      id: "spring-north-runner",
      colorIndex: 0,
      speed: 78,
      waypoints: [
        { c: 5, r: 1 },
        { c: 23, r: 1 },
      ],
    },
    {
      id: "spring-channel-runner",
      colorIndex: 1,
      speed: 74,
      waypoints: [
        { c: 8, r: 1 },
        { c: 8, r: 13 },
      ],
    },
    {
      id: "spring-south-runner",
      colorIndex: 0,
      speed: 84,
      waypoints: [
        { c: 10, r: 15 },
        { c: 23, r: 15 },
      ],
    },
  ],
  propellers: [{ c: 8, r: 14, radiusTiles: 0.9 }],
  jellyfish: [
    { c: 9, r: 6, drift: 0.45 },
    { c: 22, r: 14, drift: 0.35 },
  ],
  debris: [{ c: 2, r: 14 }],
  decor: {
    rocks: [
      { c: 4, r: 4 },
      { c: 19, r: 11 },
    ],
    reeds: [
      { c: 12, r: 3 },
      { c: 5, r: 12 },
    ],
  },
  foodStride: 5,
  bonusFoods: [
    { c: 3, r: 1, kind: "seaweed" },
    { c: 22, r: 8, kind: "shrimp" },
    { c: 1, r: 15, kind: "fish" },
  ],
};

const cypressRun: SectionRecipe = {
  name: "Cypress Run",
  islands: [
    [3, 2, 5, 6],
    [8, 3, 10, 4],
    [13, 2, 15, 6],
    [18, 2, 20, 5],
    [3, 10, 6, 12],
    [9, 8, 11, 13],
    [14, 10, 16, 12],
    [19, 9, 21, 13],
  ],
  boats: [
    {
      id: "north",
      colorIndex: 0,
      speed: 74,
      waypoints: [
        { c: 2, r: 6 },
        { c: 22, r: 6 },
      ],
    },
    {
      id: "south",
      colorIndex: 1,
      speed: 70,
      waypoints: [
        { c: 22, r: 10 },
        { c: 2, r: 10 },
      ],
    },
    {
      id: "west-runner",
      colorIndex: 2,
      speed: 66,
      waypoints: [
        { c: 7, r: 1 },
        { c: 7, r: 15 },
      ],
    },
    {
      id: "east-runner",
      colorIndex: 0,
      speed: 80,
      waypoints: [
        { c: 17, r: 15 },
        { c: 17, r: 1 },
      ],
    },
  ],
  propellers: [{ c: 12, r: 7, radiusTiles: 0.9 }],
  jellyfish: [
    { c: 5, r: 8, drift: 0.4 },
    { c: 21, r: 3, drift: 0.3 },
  ],
  debris: [{ c: 2, r: 14 }],
  decor: {
    rocks: [
      { c: 4, r: 4 },
      { c: 19, r: 11 },
    ],
    reeds: [
      { c: 9, r: 3 },
      { c: 15, r: 12 },
    ],
  },
  foodStride: 5,
  bonusFoods: [
    { c: 2, r: 1, kind: "seaweed" },
    { c: 22, r: 15, kind: "fish" },
    { c: 12, r: 15, kind: "shrimp" },
  ],
};

const manateeCove: SectionRecipe = {
  name: "Manatee Cove",
  islands: [
    [2, 2, 4, 4],
    [7, 2, 9, 5],
    [12, 2, 14, 3],
    [17, 2, 20, 5],
    [6, 8, 8, 9],
    [15, 8, 17, 9],
    [2, 11, 5, 13],
    [8, 12, 12, 14],
    [15, 12, 19, 14],
  ],
  boats: [
    {
      id: "north",
      colorIndex: 2,
      speed: 80,
      waypoints: [
        { c: 1, r: 6 },
        { c: 22, r: 6 },
      ],
      warnAtCenterCrossing: true,
    },
    {
      id: "south",
      colorIndex: 0,
      speed: 76,
      waypoints: [
        { c: 22, r: 10 },
        { c: 1, r: 10 },
      ],
    },
    {
      id: "loop",
      colorIndex: 1,
      speed: 70,
      waypoints: [
        { c: 11, r: 5 },
        { c: 21, r: 5 },
        { c: 21, r: 11 },
        { c: 11, r: 11 },
      ],
    },
    {
      id: "west-runner",
      colorIndex: 2,
      speed: 70,
      waypoints: [
        { c: 5, r: 1 },
        { c: 5, r: 15 },
      ],
    },
  ],
  propellers: [
    { c: 11, r: 7, radiusTiles: 0.9 },
    { c: 20, r: 14, radiusTiles: 0.85 },
  ],
  jellyfish: [
    { c: 3, r: 7, drift: 0.4 },
    { c: 13, r: 10, drift: 0.5 },
    { c: 21, r: 2, drift: 0.3 },
  ],
  debris: [{ c: 1, r: 14 }],
  decor: {
    rocks: [
      { c: 3, r: 3 },
      { c: 18, r: 4 },
    ],
    reeds: [
      { c: 9, r: 13 },
      { c: 16, r: 13 },
    ],
  },
  foodStride: 5,
  bonusFoods: [
    { c: 12, r: 1, kind: "fish" },
    { c: 22, r: 15, kind: "shrimp" },
    { c: 1, r: 9, kind: "seaweed" },
  ],
};

const springRun = buildLevel({
  id: "spring-run",
  name: "Spring Run",
  subtitle: "Clear each stretch to open the channel downstream",
  difficulty: 1,
  characterVariant: "manny",
  spawn: { c: 1, r: 1 },
  sections: [headspring, cypressRun, manateeCove],
});

// ---------------------------------------------------------------------------
// Level 2: Mangrove Bend — tight coves, root tangles and an oyster bar.
// ---------------------------------------------------------------------------

const mangroveBendSection: SectionRecipe = {
  name: "Mangrove Bend",
  islands: [
    [3, 2, 6, 6],
    [9, 2, 12, 3],
    [15, 2, 20, 4],
    [9, 6, 12, 10],
    [16, 7, 21, 10],
    [3, 9, 6, 13],
    [9, 13, 14, 14],
    [18, 12, 21, 14],
  ],
  boats: [
    {
      id: "bend-red",
      colorIndex: 0,
      speed: 76,
      waypoints: [
        { c: 1, r: 8 },
        { c: 23, r: 8 },
      ],
      warnAtCenterCrossing: true,
    },
    {
      id: "bend-blue",
      colorIndex: 1,
      speed: 82,
      waypoints: [
        { c: 8, r: 1 },
        { c: 8, r: 15 },
      ],
    },
    {
      id: "bend-yellow",
      colorIndex: 2,
      speed: 68,
      waypoints: [
        { c: 14, r: 5 },
        { c: 23, r: 5 },
        { c: 23, r: 11 },
        { c: 14, r: 11 },
      ],
    },
  ],
  propellers: [
    { c: 2, r: 7, radiusTiles: 0.85 },
    { c: 15, r: 15, radiusTiles: 0.9 },
  ],
  jellyfish: [
    { c: 7, r: 4, drift: 0.4 },
    { c: 14, r: 9, drift: 0.55 },
    { c: 22, r: 2, drift: 0.35 },
  ],
  debris: [
    { c: 2, r: 2 },
    { c: 22, r: 13 },
  ],
  decor: {
    rocks: [
      { c: 4, r: 11 },
      { c: 18, r: 8 },
    ],
    reeds: [
      { c: 5, r: 3 },
      { c: 11, r: 7 },
      { c: 20, r: 13 },
    ],
  },
  foodStride: 5,
  bonusFoods: [
    { c: 1, r: 1, kind: "fish" },
    { c: 14, r: 5, kind: "shrimp" },
    { c: 23, r: 15, kind: "fish" },
  ],
};

const rootTangle: SectionRecipe = {
  name: "Root Tangle",
  islands: [
    [2, 2, 4, 5],
    [7, 2, 8, 6],
    [11, 2, 14, 4],
    [17, 2, 19, 6],
    [2, 8, 5, 9],
    [8, 9, 10, 13],
    [13, 7, 15, 9],
    [18, 9, 21, 10],
    [3, 12, 6, 14],
    [12, 12, 16, 14],
    [19, 13, 21, 14],
  ],
  boats: [
    {
      id: "north",
      colorIndex: 0,
      speed: 84,
      waypoints: [
        { c: 1, r: 7 },
        { c: 22, r: 7 },
      ],
      warnAtCenterCrossing: true,
    },
    {
      id: "south",
      colorIndex: 2,
      speed: 78,
      waypoints: [
        { c: 22, r: 11 },
        { c: 1, r: 11 },
      ],
    },
    {
      id: "west-runner",
      colorIndex: 1,
      speed: 72,
      waypoints: [
        { c: 6, r: 1 },
        { c: 6, r: 15 },
      ],
    },
    {
      id: "east-runner",
      colorIndex: 0,
      speed: 88,
      waypoints: [
        { c: 16, r: 15 },
        { c: 16, r: 1 },
      ],
    },
  ],
  propellers: [
    { c: 11, r: 6, radiusTiles: 0.9 },
    { c: 1, r: 14, radiusTiles: 0.85 },
  ],
  jellyfish: [
    { c: 9, r: 7, drift: 0.5 },
    { c: 17, r: 12, drift: 0.4 },
    { c: 21, r: 3, drift: 0.35 },
  ],
  debris: [{ c: 22, r: 1 }],
  decor: {
    rocks: [
      { c: 3, r: 3 },
      { c: 20, r: 9 },
    ],
    reeds: [
      { c: 12, r: 3 },
      { c: 4, r: 13 },
    ],
  },
  foodStride: 5,
  bonusFoods: [
    { c: 1, r: 1, kind: "fish" },
    { c: 22, r: 15, kind: "fish" },
    { c: 11, r: 10, kind: "shrimp" },
  ],
};

const oysterBar: SectionRecipe = {
  name: "Oyster Bar",
  islands: [
    [2, 2, 5, 3],
    [8, 2, 10, 4],
    [13, 2, 15, 4],
    [18, 2, 21, 3],
    [2, 6, 3, 10],
    [6, 6, 9, 7],
    [14, 6, 17, 7],
    [20, 6, 21, 10],
    [6, 10, 9, 11],
    [14, 10, 17, 11],
    [2, 13, 5, 14],
    [8, 13, 10, 14],
    [13, 13, 15, 14],
    [18, 13, 21, 14],
  ],
  boats: [
    {
      id: "north",
      colorIndex: 1,
      speed: 86,
      waypoints: [
        { c: 1, r: 5 },
        { c: 22, r: 5 },
      ],
    },
    {
      id: "south",
      colorIndex: 0,
      speed: 82,
      waypoints: [
        { c: 22, r: 12 },
        { c: 1, r: 12 },
      ],
    },
    {
      id: "spine",
      colorIndex: 2,
      speed: 90,
      waypoints: [
        { c: 11, r: 1 },
        { c: 11, r: 15 },
      ],
      warnAtCenterCrossing: true,
    },
    {
      id: "loop",
      colorIndex: 1,
      speed: 70,
      waypoints: [
        { c: 5, r: 8 },
        { c: 18, r: 8 },
        { c: 18, r: 9 },
        { c: 5, r: 9 },
      ],
    },
  ],
  propellers: [
    { c: 12, r: 8, radiusTiles: 0.9 },
    { c: 22, r: 14, radiusTiles: 0.85 },
  ],
  jellyfish: [
    { c: 4, r: 5, drift: 0.4 },
    { c: 19, r: 12, drift: 0.4 },
    { c: 12, r: 12, drift: 0.3 },
  ],
  debris: [{ c: 1, r: 15 }],
  decor: {
    rocks: [
      { c: 3, r: 7 },
      { c: 20, r: 7 },
    ],
    reeds: [
      { c: 7, r: 3 },
      { c: 16, r: 13 },
    ],
  },
  foodStride: 5,
  bonusFoods: [
    { c: 1, r: 1, kind: "fish" },
    { c: 22, r: 1, kind: "fish" },
    { c: 11, r: 7, kind: "shrimp" },
    { c: 22, r: 15, kind: "seaweed" },
  ],
};

const mangroveBend = buildLevel({
  id: "mangrove-bend",
  name: "Mangrove Bend",
  subtitle: "Read the turns and use the sheltered coves",
  difficulty: 2,
  characterVariant: "coral",
  spawn: { c: 1, r: 15 },
  sections: [mangroveBendSection, rootTangle, oysterBar],
});

// ---------------------------------------------------------------------------
// Level 3: Gulf Gauntlet — fast lanes all the way out to open water.
// ---------------------------------------------------------------------------

const gulfGauntletSection: SectionRecipe = {
  name: "Gulf Gauntlet",
  islands: [
    [2, 2, 5, 4],
    [8, 2, 10, 6],
    [14, 2, 16, 6],
    [19, 2, 22, 4],
    [2, 7, 6, 9],
    [10, 8, 14, 10],
    [18, 7, 22, 9],
    [3, 12, 7, 14],
    [10, 12, 11, 14],
    [13, 12, 14, 14],
    [17, 12, 21, 14],
  ],
  boats: [
    {
      id: "gulf-red",
      colorIndex: 0,
      speed: 88,
      waypoints: [
        { c: 1, r: 6 },
        { c: 23, r: 6 },
      ],
      warnAtCenterCrossing: true,
    },
    {
      id: "gulf-blue",
      colorIndex: 1,
      speed: 96,
      waypoints: [
        { c: 12, r: 1 },
        { c: 12, r: 15 },
      ],
      warnAtCenterCrossing: true,
    },
    {
      id: "gulf-yellow",
      colorIndex: 2,
      speed: 80,
      waypoints: [
        { c: 1, r: 11 },
        { c: 23, r: 11 },
      ],
    },
    {
      id: "gulf-loop",
      colorIndex: 1,
      speed: 72,
      waypoints: [
        { c: 7, r: 1 },
        { c: 17, r: 1 },
        { c: 17, r: 15 },
        { c: 7, r: 15 },
      ],
    },
  ],
  propellers: [
    { c: 1, r: 10, radiusTiles: 0.85 },
    { c: 23, r: 10, radiusTiles: 0.85 },
  ],
  jellyfish: [
    { c: 6, r: 5, drift: 0.4 },
    { c: 18, r: 5, drift: 0.4 },
    { c: 8, r: 11, drift: 0.5 },
    { c: 16, r: 11, drift: 0.5 },
  ],
  debris: [
    { c: 1, r: 14 },
    { c: 23, r: 14 },
  ],
  decor: {
    rocks: [
      { c: 3, r: 3 },
      { c: 20, r: 3 },
      { c: 12, r: 9 },
    ],
    reeds: [
      { c: 5, r: 8 },
      { c: 19, r: 8 },
      { c: 4, r: 13 },
      { c: 20, r: 13 },
    ],
  },
  foodStride: 6,
  bonusFoods: [
    { c: 1, r: 1, kind: "fish" },
    { c: 23, r: 1, kind: "fish" },
    { c: 12, r: 7, kind: "shrimp" },
    { c: 1, r: 15, kind: "seaweed" },
    { c: 23, r: 15, kind: "seaweed" },
  ],
};

const shippingLane: SectionRecipe = {
  name: "Shipping Lane",
  islands: [
    [2, 2, 4, 3],
    [7, 2, 9, 3],
    [14, 2, 16, 3],
    [19, 2, 21, 3],
    [2, 6, 5, 6],
    [9, 5, 14, 6],
    [18, 6, 21, 6],
    [2, 10, 5, 10],
    [9, 10, 14, 11],
    [18, 10, 21, 10],
    [2, 13, 4, 14],
    [7, 13, 9, 14],
    [14, 13, 16, 14],
    [19, 13, 21, 14],
  ],
  boats: [
    {
      id: "north",
      colorIndex: 0,
      speed: 92,
      waypoints: [
        { c: 1, r: 4 },
        { c: 22, r: 4 },
      ],
    },
    {
      id: "middle",
      colorIndex: 1,
      speed: 96,
      waypoints: [
        { c: 22, r: 8 },
        { c: 1, r: 8 },
      ],
      warnAtCenterCrossing: true,
    },
    {
      id: "south",
      colorIndex: 2,
      speed: 90,
      waypoints: [
        { c: 1, r: 12 },
        { c: 22, r: 12 },
      ],
    },
    {
      id: "west-runner",
      colorIndex: 1,
      speed: 84,
      waypoints: [
        { c: 6, r: 1 },
        { c: 6, r: 15 },
      ],
    },
    {
      id: "east-runner",
      colorIndex: 0,
      speed: 88,
      waypoints: [
        { c: 17, r: 15 },
        { c: 17, r: 1 },
      ],
    },
  ],
  propellers: [
    { c: 11, r: 8, radiusTiles: 0.9 },
    { c: 22, r: 1, radiusTiles: 0.8 },
  ],
  jellyfish: [
    { c: 3, r: 8, drift: 0.3 },
    { c: 20, r: 8, drift: 0.3 },
    { c: 11, r: 2, drift: 0.4 },
    { c: 11, r: 14, drift: 0.4 },
  ],
  debris: [{ c: 1, r: 14 }],
  decor: {
    rocks: [
      { c: 7, r: 8 },
      { c: 16, r: 8 },
    ],
    reeds: [
      { c: 4, r: 4 },
      { c: 19, r: 12 },
    ],
  },
  foodStride: 6,
  bonusFoods: [
    { c: 1, r: 1, kind: "fish" },
    { c: 22, r: 15, kind: "fish" },
    { c: 11, r: 7, kind: "shrimp" },
    { c: 11, r: 9, kind: "shrimp" },
  ],
};

const openGulf: SectionRecipe = {
  name: "Open Gulf",
  islands: [
    [3, 3, 5, 4],
    [9, 2, 10, 5],
    [13, 2, 14, 5],
    [18, 3, 20, 4],
    [2, 7, 4, 9],
    [7, 7, 8, 9],
    [15, 7, 16, 9],
    [19, 7, 21, 9],
    [3, 12, 5, 13],
    [9, 11, 10, 14],
    [13, 11, 14, 14],
    [18, 12, 20, 13],
  ],
  boats: [
    {
      id: "north-edge",
      colorIndex: 0,
      speed: 96,
      waypoints: [
        { c: 1, r: 1 },
        { c: 22, r: 1 },
      ],
    },
    {
      id: "south-edge",
      colorIndex: 2,
      speed: 96,
      waypoints: [
        { c: 22, r: 15 },
        { c: 1, r: 15 },
      ],
    },
    {
      id: "north",
      colorIndex: 1,
      speed: 90,
      waypoints: [
        { c: 1, r: 6 },
        { c: 22, r: 6 },
      ],
      warnAtCenterCrossing: true,
    },
    {
      id: "south",
      colorIndex: 0,
      speed: 92,
      waypoints: [
        { c: 22, r: 10 },
        { c: 1, r: 10 },
      ],
      warnAtCenterCrossing: true,
    },
    {
      id: "spine-down",
      colorIndex: 2,
      speed: 100,
      waypoints: [
        { c: 11, r: 1 },
        { c: 11, r: 15 },
      ],
    },
    {
      id: "spine-up",
      colorIndex: 1,
      speed: 100,
      waypoints: [
        { c: 12, r: 15 },
        { c: 12, r: 1 },
      ],
    },
  ],
  propellers: [
    { c: 6, r: 8, radiusTiles: 0.9 },
    { c: 17, r: 8, radiusTiles: 0.9 },
  ],
  jellyfish: [
    { c: 3, r: 5, drift: 0.4 },
    { c: 20, r: 11, drift: 0.4 },
    { c: 7, r: 12, drift: 0.5 },
    { c: 16, r: 4, drift: 0.5 },
  ],
  debris: [
    { c: 1, r: 14 },
    { c: 22, r: 2 },
  ],
  decor: {
    rocks: [
      { c: 4, r: 8 },
      { c: 19, r: 8 },
    ],
    reeds: [
      { c: 7, r: 3 },
      { c: 16, r: 13 },
    ],
  },
  foodStride: 6,
  bonusFoods: [
    { c: 22, r: 8, kind: "fish" },
    { c: 1, r: 12, kind: "seaweed" },
    { c: 6, r: 15, kind: "shrimp" },
    { c: 17, r: 1, kind: "shrimp" },
  ],
};

const gulfGauntlet = buildLevel({
  id: "gulf-gauntlet",
  name: "Gulf Gauntlet",
  subtitle: "Time the crossings, then rest in safe pockets",
  difficulty: 3,
  characterVariant: "sage",
  spawn: { c: 12, r: 15 },
  sections: [gulfGauntletSection, shippingLane, openGulf],
});

export const levels: LevelData[] = [springRun, mangroveBend, gulfGauntlet];
