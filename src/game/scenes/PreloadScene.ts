import Phaser from "phaser";
import { COLORS, TILE } from "../constants";

// Generates all procedural textures used by the game.
// Using GameObjects + generateTexture so we have crisp top-down placeholder art.
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload() {
    this.makeManatee();
    this.makeBoats();
    this.makeLettuce();
    this.makePropeller();
    this.makeBuoy();
    this.makeDebris();
    this.makeSplash();
    this.makeWarning();
  }

  create() {
    this.scene.start("GameScene");
    this.scene.launch("UIScene");
  }

  private g() {
    return this.add.graphics().setVisible(false);
  }

  private makeManatee() {
    const g = this.g();
    const w = 28;
    const h = 36;
    // Body
    g.fillStyle(COLORS.manatee, 1);
    g.fillEllipse(w / 2, h / 2, w, h);
    // Belly highlight
    g.fillStyle(COLORS.manateeBelly, 1);
    g.fillEllipse(w / 2, h / 2 + 3, w * 0.65, h * 0.55);
    // Outline shadow
    g.lineStyle(2, COLORS.manateeDark, 1);
    g.strokeEllipse(w / 2, h / 2, w, h);
    // Tail flukes (top of sprite = forward, swimming up)
    g.fillStyle(COLORS.manateeDark, 1);
    g.fillTriangle(w / 2 - 6, h - 2, w / 2 + 6, h - 2, w / 2, h + 6);
    // Eyes
    g.fillStyle(0x222222, 1);
    g.fillCircle(w / 2 - 5, 8, 1.5);
    g.fillCircle(w / 2 + 5, 8, 1.5);
    g.generateTexture("manatee", w, h + 8);
    g.destroy();
  }

  private makeBoats() {
    COLORS.boatHull.forEach((color, i) => {
      const g = this.g();
      const w = 30;
      const h = 56;
      // Hull
      g.fillStyle(color, 1);
      g.beginPath();
      g.moveTo(w / 2, 0); // bow
      g.lineTo(w - 2, 12);
      g.lineTo(w - 2, h - 4);
      g.lineTo(2, h - 4);
      g.lineTo(2, 12);
      g.closePath();
      g.fillPath();
      g.lineStyle(2, 0x222222, 1);
      g.strokePath();
      // Deck
      g.fillStyle(0xffffff, 0.85);
      g.fillRect(7, 18, w - 14, 18);
      g.lineStyle(1, 0x222222, 1);
      g.strokeRect(7, 18, w - 14, 18);
      // Motor at stern
      g.fillStyle(0x333333, 1);
      g.fillRect(w / 2 - 4, h - 6, 8, 8);
      g.generateTexture(`boat-${i}`, w, h + 4);
      g.destroy();
    });
  }

  private makeLettuce() {
    const g = this.g();
    const s = 24;
    g.fillStyle(COLORS.lettuceDark, 1);
    g.fillCircle(s / 2, s / 2, s / 2);
    g.fillStyle(COLORS.lettuce, 1);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.fillCircle(
        s / 2 + Math.cos(a) * 5,
        s / 2 + Math.sin(a) * 5,
        4.5,
      );
    }
    g.fillStyle(0xa6e879, 1);
    g.fillCircle(s / 2, s / 2, 4);
    g.generateTexture("lettuce", s, s);
    g.destroy();
  }

  private makePropeller() {
    const g = this.g();
    const s = 40;
    g.fillStyle(COLORS.propeller, 1);
    g.fillCircle(s / 2, s / 2, 6);
    // 3 blades
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      g.fillStyle(0x9aa1ac, 1);
      // emulate rotation by using triangles around center
      const cx = s / 2;
      const cy = s / 2;
      const len = 16;
      const w = 6;
      const p1x = cx + Math.cos(a) * len;
      const p1y = cy + Math.sin(a) * len;
      const p2x = cx + Math.cos(a + 0.4) * w;
      const p2y = cy + Math.sin(a + 0.4) * w;
      const p3x = cx + Math.cos(a - 0.4) * w;
      const p3y = cy + Math.sin(a - 0.4) * w;
      g.fillTriangle(p1x, p1y, p2x, p2y, p3x, p3y);
    }
    g.lineStyle(2, 0x222222, 1);
    g.strokeCircle(s / 2, s / 2, 6);
    g.generateTexture("propeller", s, s);
    g.destroy();
  }

  private makeBuoy() {
    const g = this.g();
    const s = TILE;
    g.fillStyle(COLORS.buoy, 1);
    g.fillCircle(s / 2, s / 2, 8);
    g.fillStyle(0xffffff, 1);
    g.fillRect(s / 2 - 8, s / 2 - 2, 16, 4);
    g.lineStyle(2, 0x222222, 1);
    g.strokeCircle(s / 2, s / 2, 8);
    g.generateTexture("buoy", s, s);
    g.destroy();
  }

  private makeDebris() {
    const g = this.g();
    const s = 28;
    g.fillStyle(COLORS.debris, 1);
    g.fillEllipse(s / 2, s / 2, s, s * 0.55);
    g.lineStyle(2, 0x3a2a14, 1);
    g.strokeEllipse(s / 2, s / 2, s, s * 0.55);
    // grain
    g.lineStyle(1, 0x3a2a14, 1);
    g.beginPath();
    g.moveTo(4, s / 2);
    g.lineTo(s - 4, s / 2);
    g.strokePath();
    g.generateTexture("debris", s, s);
    g.destroy();
  }

  private makeSplash() {
    const g = this.g();
    const s = 40;
    g.fillStyle(0xffffff, 0.85);
    g.fillCircle(s / 2, s / 2, 8);
    g.lineStyle(2, 0xffffff, 0.8);
    g.strokeCircle(s / 2, s / 2, 16);
    g.generateTexture("splash", s, s);
    g.destroy();
  }

  private makeWarning() {
    const g = this.g();
    const s = 28;
    g.fillStyle(COLORS.hazardWarn, 1);
    g.fillTriangle(s / 2, 2, s - 2, s - 2, 2, s - 2);
    g.lineStyle(2, 0x222222, 1);
    g.strokeTriangle(s / 2, 2, s - 2, s - 2, 2, s - 2);
    g.fillStyle(0xffffff, 1);
    g.fillRect(s / 2 - 2, 8, 4, 10);
    g.fillRect(s / 2 - 2, s - 9, 4, 4);
    g.generateTexture("warning", s, s);
    g.destroy();
  }
}
