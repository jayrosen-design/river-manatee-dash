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
  lettuce: Waypoint[];
  boats: BoatRoute[];
  propellers: PropellerSpec[];
  debrisDecorative: Waypoint[];
}
