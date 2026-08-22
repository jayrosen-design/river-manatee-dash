import type { FoodKind } from "../constants";

export type TileType =
  | "water"
  | "rope"
  | "lettuce"
  | "playerSpawn"
  | "boatSpawn"
  | "propeller"
  | "debris";

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

export interface LevelData {
  cols: number;
  rows: number;
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
