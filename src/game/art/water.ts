import Phaser from "phaser";
import { PAL } from "./palette";

/**
 * Layered animated river surface. Drawn into two Graphics layers:
 *  - base: static depth gradient + current lines (redrawn rarely)
 *  - anim: ripples / wave streaks / caustics (redrawn a few times per second)
 */
export class WaterRenderer {
  private base: Phaser.GameObjects.Graphics;
  private anim: Phaser.GameObjects.Graphics;

  constructor(
    private scene: Phaser.Scene,
    private x: number,
    private y: number,
    private w: number,
    private h: number,
  ) {
    this.base = scene.add.graphics().setDepth(-20);
    this.anim = scene.add.graphics().setDepth(-19);
    this.drawBase();
  }

  private drawBase() {
    const g = this.base;
    g.clear();
    // vertical depth gradient: lighter near the top of the river, deeper below
    const bands = 34;
    for (let i = 0; i < bands; i++) {
      const t = i / (bands - 1);
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(PAL.waterLight),
        Phaser.Display.Color.ValueToColor(PAL.riverNavy),
        100,
        Math.round(Math.pow(t, 0.85) * 100),
      );
      g.fillStyle(
        Phaser.Display.Color.GetColor(color.r, color.g, color.b),
        1,
      );
      g.fillRect(
        this.x,
        this.y + (this.h * i) / bands - 1,
        this.w,
        this.h / bands + 2,
      );
    }
    // deep pools for gentle depth variation
    const pools: [number, number, number][] = [
      [0.18, 0.3, 0.22],
      [0.62, 0.2, 0.16],
      [0.42, 0.78, 0.24],
      [0.86, 0.62, 0.18],
    ];
    for (const [px, py, pr] of pools) {
      const cx = this.x + this.w * px;
      const cy = this.y + this.h * py;
      const r = this.h * pr;
      for (let i = 5; i > 0; i--) {
        g.fillStyle(PAL.riverNavy, 0.05);
        g.fillEllipse(cx, cy, (r * i * 2) / 5, (r * i * 1.4) / 5);
      }
    }
    // slow current lines
    g.lineStyle(2, PAL.aqua, 0.1);
    for (let i = 0; i < 9; i++) {
      const yy = this.y + ((i + 0.5) * this.h) / 9;
      g.beginPath();
      g.moveTo(this.x, yy);
      for (let sx = 0; sx <= this.w; sx += 32) {
        g.lineTo(this.x + sx, yy + Math.sin(sx * 0.02 + i) * 5);
      }
      g.strokePath();
    }
  }

  /** Animated pass; `t` is elapsed seconds. */
  update(t: number) {
    const g = this.anim;
    g.clear();

    // Wave streaks drifting right, mimicking light refraction on the surface.
    for (let row = 0; row < 12; row++) {
      const yy = this.y + ((row + 0.5) * this.h) / 12;
      const phase = t * (14 + row * 1.6);
      for (let i = 0; i < 7; i++) {
        const sx =
          this.x + ((i * this.w) / 7 + phase + row * 37) % this.w;
        const len = 26 + ((row * 7 + i * 13) % 26);
        const a = 0.06 + 0.05 * Math.sin(t * 1.5 + row + i);
        g.lineStyle(2.5, PAL.foam, a);
        g.beginPath();
        g.moveTo(sx, yy);
        g.lineTo(Math.min(sx + len, this.x + this.w), yy - 2);
        g.strokePath();
      }
    }

    // Caustic diamonds — sparse, adds 2.5D shimmer.
    for (let i = 0; i < 30; i++) {
      const sx =
        this.x + ((i * 137) % this.w) + Math.sin(t * 0.8 + i) * 6;
      const sy = this.y + ((i * 311) % this.h) + Math.cos(t * 0.7 + i) * 5;
      const a = 0.05 + 0.05 * (0.5 + 0.5 * Math.sin(t * 2 + i));
      g.fillStyle(PAL.foam, a);
      g.fillEllipse(sx, sy, 16, 4);
    }

    // Expanding ripple rings.
    for (let i = 0; i < 6; i++) {
      const cycle = (t * 0.35 + i / 6) % 1;
      const cx = this.x + ((i * 219) % this.w);
      const cy = this.y + ((i * 421) % this.h);
      g.lineStyle(1.5, PAL.foam, 0.16 * (1 - cycle));
      g.strokeEllipse(cx, cy, 14 + cycle * 44, (14 + cycle * 44) * 0.45);
    }
  }

  destroy() {
    this.base.destroy();
    this.anim.destroy();
  }
}
