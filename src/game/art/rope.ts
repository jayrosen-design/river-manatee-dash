import Phaser from "phaser";
import { PAL } from "./palette";
import { COLS, ROWS, TILE } from "../constants";
import type { TileType } from "../data/types";

/**
 * Renders wall tiles as a floating rope maze: braided rope runs along the
 * outer edges of each wall region, wooden posts sit at the corners, and the
 * enclosed water is shaded with shallow vegetation. Grid logic is untouched —
 * this is purely presentation.
 */

const INSET = 5;

export interface RopeDecor {
  posts: { x: number; y: number }[];
  pads: { x: number; y: number; scale: number }[];
}

function isRope(grid: TileType[][], c: number, r: number) {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return true; // outside = solid
  return grid[r][c] === "rope";
}

function braid(
  g: Phaser.GameObjects.Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  // shadow on the water
  g.lineStyle(8, PAL.riverNavy, 0.22);
  g.lineBetween(x1 + 2, y1 + 3, x2 + 2, y2 + 3);
  // rope core
  g.lineStyle(7, PAL.ropeDark, 1);
  g.lineBetween(x1, y1, x2, y2);
  g.lineStyle(5, PAL.rope, 1);
  g.lineBetween(x1, y1, x2, y2);
  g.lineStyle(2, PAL.ropeLight, 0.85);
  g.lineBetween(x1, y1 - 1.4, x2, y2 - 1.4);
  // braid ticks
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const nx = -uy;
  const ny = ux;
  g.lineStyle(1.4, PAL.ropeDark, 0.75);
  for (let d = 3; d < len - 2; d += 6) {
    const px = x1 + ux * d;
    const py = y1 + uy * d;
    g.lineBetween(
      px - nx * 2.6 - ux * 1.8,
      py - ny * 2.6 - uy * 1.8,
      px + nx * 2.6 + ux * 1.8,
      py + ny * 2.6 + uy * 1.8,
    );
  }
}

export function drawRopeMaze(
  g: Phaser.GameObjects.Graphics,
  grid: TileType[][],
  offsetY: number,
): RopeDecor {
  g.clear();
  const posts: { x: number; y: number }[] = [];
  const pads: { x: number; y: number; scale: number }[] = [];
  const postKeys = new Set<string>();

  // 1) shade the enclosed water inside rope regions (shallow / weedy look)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== "rope") continue;
      const x = c * TILE;
      const y = r * TILE + offsetY;
      g.fillStyle(PAL.riverNavy, 0.34);
      g.fillRect(x, y, TILE, TILE);
      g.fillStyle(PAL.seaweed, 0.16);
      g.fillEllipse(x + TILE / 2, y + TILE / 2, TILE * 0.95, TILE * 0.85);
      if ((c * 7 + r * 5) % 6 === 0) {
        pads.push({
          x: x + TILE / 2,
          y: y + TILE / 2,
          scale: 0.55 + ((c + r) % 3) * 0.12,
        });
      }
    }
  }

  // 2) rope runs along every wall/water boundary edge
  const addPost = (x: number, y: number) => {
    const k = `${Math.round(x)},${Math.round(y)}`;
    if (postKeys.has(k)) return;
    postKeys.add(k);
    posts.push({ x, y });
  };

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== "rope") continue;
      const x0 = c * TILE + INSET;
      const y0 = r * TILE + offsetY + INSET;
      const x1 = (c + 1) * TILE - INSET;
      const y1 = (r + 1) * TILE + offsetY - INSET;

      if (!isRope(grid, c, r - 1)) {
        braid(g, x0, y0, x1, y0);
        addPost(x0, y0);
        addPost(x1, y0);
      }
      if (!isRope(grid, c, r + 1)) {
        braid(g, x0, y1, x1, y1);
        addPost(x0, y1);
        addPost(x1, y1);
      }
      if (!isRope(grid, c - 1, r)) {
        braid(g, x0, y0, x0, y1);
        addPost(x0, y0);
        addPost(x0, y1);
      }
      if (!isRope(grid, c + 1, r)) {
        braid(g, x1, y0, x1, y1);
        addPost(x1, y0);
        addPost(x1, y1);
      }
    }
  }

  return { posts, pads };
}
