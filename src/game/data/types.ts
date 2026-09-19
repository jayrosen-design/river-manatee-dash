import type { FoodKind } from "../constants";

export type TileType =
  "water" | "rope" | "gate" | "lettuce" | "playerSpawn" | "boatSpawn" | "propeller" | "debris";

export interface Waypoint {
  c: number;
  r: number;
}

export interface FoodSpec extends Waypoint {
  kind: FoodKind;
}

export interface JellySpec extends Waypoint {
  /** drift amplitude in tiles; 0 = pulses in place */
  drift?: number;
}

export interface BoatRoute {
  id: string;
  colorIndex: number;
  speed: number;
  waypoints: Waypoint[]; // tile coords; boat loops through these
  warnAtCenterCrossing?: boolean;
}

export interface PropellerSpec {
  c: number;
  r: number;
  radiusTiles: number;
}

/** A screen-wide stretch of river. Zones are laid out left to right. */
export interface ZoneSpec {
  index: number;
  name: string;
  /** Inclusive column range owned by this zone. */
  c0: number;
  c1: number;
}

/** A locked opening in the wall between zone `index` and zone `index + 1`. */
export interface GateSpec {
  index: number;
  c: number;
  rows: number[];
}

export interface LevelData {
  id: string;
  name: string;
  subtitle: string;
  difficulty: 1 | 2 | 3;
  characterVariant: "manny" | "coral" | "sage";
  cols: number;
  rows: number;
  zones: ZoneSpec[];
  gates: GateSpec[];
  // grid[row][col] holds the base tile type (water/rope/debris).
  grid: TileType[][];
  playerSpawn: Waypoint;
  /** All collectibles, typed (lettuce is the common one). */
  foods: FoodSpec[];
  boats: BoatRoute[];
  propellers: PropellerSpec[];
  jellyfish: JellySpec[];
  debrisDecorative: Waypoint[];
  decor: { rocks: Waypoint[]; reeds: Waypoint[] };
}
