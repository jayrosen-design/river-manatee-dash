import Phaser from "phaser";
import { BOAT_HULLS, BOAT_TRIMS, PAL } from "./palette";

/**
 * Procedural texture factory. Every sprite in the game is generated here so
 * hand-drawn art can later replace a texture by keeping the same key.
 *
 * Convention: characters/vehicles are drawn facing UP (top of the texture is
 * "forward"), because GameScene rotates sprites toward travel direction.
 */

type G = Phaser.GameObjects.Graphics;

function gfx(scene: Phaser.Scene): G {
  return scene.add.graphics().setVisible(false);
}

function done(g: G, key: string, w: number, h: number) {
  if (g.scene.textures.exists(key)) g.scene.textures.remove(key);
  g.generateTexture(key, w, h);
  g.destroy();
}

/** Soft radial-ish blob used for glows/foam: stacked translucent circles. */
function softCircle(g: G, x: number, y: number, r: number, color: number, alpha = 0.5, steps = 6) {
  for (let i = steps; i > 0; i--) {
    g.fillStyle(color, alpha / steps);
    g.fillCircle(x, y, (r * i) / steps);
  }
}

/* ------------------------------------------------------------------ manatee */

function makeManatee(
  scene: Phaser.Scene,
  key: string,
  tailSwing: number,
  colors: { body: number; dark: number; belly: number; blush: number },
) {
  const g = gfx(scene);
  const w = 44;
  const h = 56;
  const cx = w / 2;

  // drop shadow in water
  g.fillStyle(PAL.riverNavy, 0.22);
  g.fillEllipse(cx + 1.5, h / 2 + 4, w * 0.82, h * 0.66);

  // tail fluke (bottom), swings for the swim cycle
  const ty = h - 9;
  g.fillStyle(colors.dark, 1);
  g.beginPath();
  g.moveTo(cx, ty - 6);
  g.lineTo(cx - 15 + tailSwing, ty + 9);
  g.lineTo(cx, ty + 3);
  g.lineTo(cx + 15 + tailSwing, ty + 9);
  g.closePath();
  g.fillPath();

  // body
  g.fillStyle(colors.body, 1);
  g.fillEllipse(cx, h / 2 - 3, w * 0.78, h * 0.8);
  // rounded head bulge
  g.fillCircle(cx, 15, 13);

  // belly / light
  g.fillStyle(colors.belly, 0.85);
  g.fillEllipse(cx, h / 2 + 2, w * 0.5, h * 0.5);

  // flippers
  g.fillStyle(colors.dark, 1);
  g.fillEllipse(cx - 16, h / 2 + 2, 12, 20);
  g.fillEllipse(cx + 16, h / 2 + 2, 12, 20);
  g.fillStyle(colors.body, 1);
  g.fillEllipse(cx - 15.5, h / 2 + 1, 9, 16);
  g.fillEllipse(cx + 15.5, h / 2 + 1, 9, 16);

  // snout
  g.fillStyle(colors.belly, 1);
  g.fillEllipse(cx, 11, 15, 11);
  g.fillStyle(colors.dark, 0.85);
  g.fillEllipse(cx - 3.5, 9, 3, 2.5);
  g.fillEllipse(cx + 3.5, 9, 3, 2.5);
  // whisker dots
  g.fillStyle(colors.dark, 0.5);
  for (let i = -1; i <= 1; i++) {
    g.fillCircle(cx - 5 + i * 0.5, 14 + i, 0.7);
    g.fillCircle(cx + 5 - i * 0.5, 14 + i, 0.7);
  }
  // smile
  g.lineStyle(1.4, colors.dark, 0.9);
  g.beginPath();
  g.arc(cx, 12.5, 4.5, 0.25 * Math.PI, 0.75 * Math.PI, false);
  g.strokePath();

  // eyes
  g.fillStyle(PAL.white, 1);
  g.fillCircle(cx - 7, 19, 3.4);
  g.fillCircle(cx + 7, 19, 3.4);
  g.fillStyle(PAL.ink, 1);
  g.fillCircle(cx - 6.6, 19.4, 2);
  g.fillCircle(cx + 7.4, 19.4, 2);
  g.fillStyle(PAL.white, 0.95);
  g.fillCircle(cx - 7.4, 18.4, 0.9);
  g.fillCircle(cx + 6.6, 18.4, 0.9);

  // blush
  g.fillStyle(colors.blush, 0.35);
  g.fillEllipse(cx - 11, 23, 6, 4);
  g.fillEllipse(cx + 11, 23, 6, 4);

  // top rim light
  // Layered rim light and lower-body shade make the character read as a
  // rounded 3D form while retaining the game's friendly illustrated style.
  g.lineStyle(3, colors.belly, 0.58);
  g.beginPath();
  g.arc(cx, h / 2 - 3, w * 0.36, 1.05 * Math.PI, 1.85 * Math.PI, false);
  g.strokePath();
  g.fillStyle(colors.dark, 0.14);
  g.fillEllipse(cx + 3, h / 2 + 8, w * 0.55, h * 0.28);
  g.fillStyle(PAL.white, 0.22);
  g.fillEllipse(cx - 7, 20, 8, 18);

  // outline
  g.lineStyle(2, colors.dark, 0.9);
  g.strokeEllipse(cx, h / 2 - 3, w * 0.78, h * 0.8);

  done(g, key, w, h + 6);
}

/* -------------------------------------------------------------------- boats */

function makeBoats(scene: Phaser.Scene) {
  BOAT_HULLS.forEach((hull, i) => {
    const g = gfx(scene);
    const w = 40;
    const h = 68;
    const cx = w / 2;

    // water shadow
    g.fillStyle(PAL.riverNavy, 0.25);
    g.fillEllipse(cx + 2, h / 2 + 4, w * 0.85, h * 0.85);

    // hull
    g.fillStyle(hull, 1);
    g.beginPath();
    g.moveTo(cx, 1);
    g.lineTo(w - 4, 18);
    g.lineTo(w - 5, h - 8);
    g.lineTo(5, h - 8);
    g.lineTo(4, 18);
    g.closePath();
    g.fillPath();
    g.lineStyle(2.5, PAL.ink, 0.85);
    g.strokePath();

    // deck / cabin
    g.fillStyle(BOAT_TRIMS[i], 0.95);
    g.fillRoundedRect(9, 20, w - 18, 26, 5);
    g.lineStyle(1.5, PAL.ink, 0.6);
    g.strokeRoundedRect(9, 20, w - 18, 26, 5);
    g.fillStyle(PAL.aqua, 0.9);
    g.fillRoundedRect(12, 23, w - 24, 10, 3);

    // bow highlight stripe
    g.fillStyle(PAL.white, 0.55);
    g.fillTriangle(cx, 4, cx + 9, 19, cx - 9, 19);

    // stern motor
    g.fillStyle(PAL.metal, 1);
    g.fillRoundedRect(cx - 6, h - 10, 12, 11, 3);
    g.fillStyle(PAL.metalLight, 1);
    g.fillRect(cx - 2, h - 4, 4, 6);

    // side rub rail
    g.lineStyle(2, PAL.ink, 0.25);
    g.lineBetween(5, 22, 6, h - 10);
    g.lineBetween(w - 5, 22, w - 6, h - 10);

    done(g, `boat-${i}`, w, h + 4);
  });
}

/* --------------------------------------------------------------------- food */

function foodBase(g: G, s: number) {
  // water ring + shadow shared by all collectibles
  g.fillStyle(PAL.riverNavy, 0.18);
  g.fillEllipse(s / 2 + 1, s / 2 + 4, s * 0.72, s * 0.34);
  g.lineStyle(1.5, PAL.foam, 0.35);
  g.strokeEllipse(s / 2, s / 2 + 2, s * 0.82, s * 0.4);
}

function makeLettuce(scene: Phaser.Scene) {
  const g = gfx(scene);
  const s = 30;
  foodBase(g, s);
  const cx = s / 2;
  const cy = s / 2 - 1;
  g.fillStyle(PAL.lettuceDark, 1);
  g.fillCircle(cx, cy, 11);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    g.fillStyle(PAL.lettuce, 1);
    g.fillCircle(cx + Math.cos(a) * 5.5, cy + Math.sin(a) * 5.5, 5.2);
  }
  g.fillStyle(PAL.lettuceLight, 1);
  g.fillCircle(cx, cy - 0.5, 5);
  g.lineStyle(1.2, PAL.lettuceDark, 0.7);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    g.lineBetween(cx, cy, cx + Math.cos(a) * 8, cy + Math.sin(a) * 8);
  }
  g.fillStyle(PAL.white, 0.55);
  g.fillCircle(cx - 4, cy - 5, 1.8);
  done(g, "lettuce", s, s + 4);
}

function makeSeaweed(scene: Phaser.Scene) {
  const g = gfx(scene);
  const s = 30;
  foodBase(g, s);
  const cx = s / 2;
  for (let i = 0; i < 3; i++) {
    const off = (i - 1) * 6;
    g.lineStyle(4.5, i === 1 ? PAL.seaweed : PAL.seaweedLight, 1);
    g.beginPath();
    g.moveTo(cx + off, s - 6);
    g.lineTo(cx + off + 3, s / 2 - 1);
    g.lineTo(cx + off - 2, 5 + i);
    g.strokePath();
  }
  g.fillStyle(PAL.seaweedLight, 1);
  g.fillEllipse(cx - 7, 9, 6, 4);
  g.fillEllipse(cx + 7, 11, 6, 4);
  g.fillStyle(PAL.white, 0.35);
  g.fillEllipse(cx - 1, 8, 4, 3);
  done(g, "seaweed", s, s + 4);
}

function makeShrimp(scene: Phaser.Scene) {
  const g = gfx(scene);
  const s = 30;
  foodBase(g, s);
  const cx = s / 2;
  const cy = s / 2 - 1;
  // curled body
  g.lineStyle(7, PAL.shrimp, 1);
  g.beginPath();
  g.arc(cx, cy, 7, -0.4 * Math.PI, 1.15 * Math.PI, false);
  g.strokePath();
  g.lineStyle(2, PAL.shrimpDark, 0.85);
  g.beginPath();
  g.arc(cx, cy, 10, -0.35 * Math.PI, 1.1 * Math.PI, false);
  g.strokePath();
  // tail fan
  g.fillStyle(PAL.shrimpDark, 1);
  g.fillTriangle(cx + 3, cy - 9, cx + 11, cy - 12, cx + 9, cy - 4);
  // head + eye
  g.fillStyle(PAL.shrimp, 1);
  g.fillCircle(cx - 5, cy + 7, 4.5);
  g.fillStyle(PAL.ink, 1);
  g.fillCircle(cx - 7, cy + 6, 1.4);
  // antennae
  g.lineStyle(1.2, PAL.shrimpDark, 0.9);
  g.lineBetween(cx - 7, cy + 9, cx - 13, cy + 13);
  g.lineBetween(cx - 6, cy + 10, cx - 11, cy + 15);
  g.fillStyle(PAL.white, 0.5);
  g.fillCircle(cx + 1, cy - 5, 1.7);
  done(g, "shrimp", s, s + 4);
}

function makeFish(scene: Phaser.Scene) {
  const g = gfx(scene);
  const s = 32;
  foodBase(g, s);
  const cx = s / 2;
  const cy = s / 2 - 1;
  g.fillStyle(PAL.fishDark, 1);
  g.fillTriangle(cx + 6, cy, cx + 14, cy - 6, cx + 14, cy + 6);
  g.fillStyle(PAL.fish, 1);
  g.fillEllipse(cx - 1, cy, 20, 12);
  g.fillStyle(PAL.fishDark, 0.9);
  g.fillTriangle(cx - 2, cy - 6, cx + 4, cy - 12, cx + 5, cy - 5);
  g.fillStyle(PAL.white, 0.4);
  g.fillEllipse(cx - 2, cy + 3, 12, 4);
  g.fillStyle(PAL.white, 1);
  g.fillCircle(cx - 7, cy - 2, 2.6);
  g.fillStyle(PAL.ink, 1);
  g.fillCircle(cx - 7.5, cy - 2, 1.4);
  g.lineStyle(1.5, PAL.fishDark, 0.6);
  g.beginPath();
  g.arc(cx - 3, cy, 7, -0.5 * Math.PI, 0.5 * Math.PI, false);
  g.strokePath();
  done(g, "fish", s, s + 4);
}

/* ----------------------------------------------------------------- jellyfish */

function makeJellyfish(scene: Phaser.Scene) {
  const g = gfx(scene);
  const s = 36;
  const cx = s / 2;
  const cy = 15;
  softCircle(g, cx, cy + 2, 17, PAL.jelly, 0.5);
  // tentacles
  g.lineStyle(2.2, PAL.jellyDeep, 0.9);
  for (let i = -2; i <= 2; i++) {
    g.beginPath();
    g.moveTo(cx + i * 4, cy + 7);
    g.lineTo(cx + i * 4 + (i % 2 ? 3 : -3), cy + 15);
    g.lineTo(cx + i * 4 + (i % 2 ? -2 : 2), s + 6);
    g.strokePath();
  }
  // bell
  g.fillStyle(PAL.jelly, 1);
  g.beginPath();
  g.arc(cx, cy, 13, Math.PI, 0, false);
  g.closePath();
  g.fillPath();
  g.fillEllipse(cx, cy, 26, 10);
  g.fillStyle(PAL.jellyLight, 0.9);
  g.beginPath();
  g.arc(cx, cy - 1, 9, Math.PI, 0, false);
  g.closePath();
  g.fillPath();
  g.lineStyle(2, PAL.jellyDeep, 0.9);
  g.beginPath();
  g.arc(cx, cy, 13, Math.PI, 0, false);
  g.strokePath();
  g.fillStyle(PAL.white, 0.8);
  g.fillEllipse(cx - 4, cy - 7, 5, 3);
  // spots (distinct silhouette, not colour-only)
  g.fillStyle(PAL.jellyDeep, 0.5);
  g.fillCircle(cx + 4, cy - 3, 2);
  g.fillCircle(cx - 5, cy - 1, 1.6);
  done(g, "jellyfish", s, s + 10);
}

/* ------------------------------------------------------------- rope hardware */

function makePost(scene: Phaser.Scene) {
  const g = gfx(scene);
  const s = 26;
  const cx = s / 2;
  g.fillStyle(PAL.riverNavy, 0.3);
  g.fillEllipse(cx + 2, cx + 4, 18, 9);
  g.fillStyle(PAL.woodDark, 1);
  g.fillCircle(cx, cx, 9);
  g.fillStyle(PAL.wood, 1);
  g.fillCircle(cx, cx - 1, 8);
  g.fillStyle(PAL.woodLight, 1);
  g.fillCircle(cx, cx - 2, 5.5);
  g.lineStyle(1.4, PAL.woodDark, 0.8);
  g.strokeCircle(cx, cx - 2, 5.5);
  g.strokeCircle(cx, cx - 1, 8);
  g.fillStyle(PAL.white, 0.35);
  g.fillEllipse(cx - 2, cx - 4, 4, 2.5);
  done(g, "post", s, s + 4);
}

function makeBuoy(scene: Phaser.Scene) {
  const g = gfx(scene);
  const s = 24;
  const cx = s / 2;
  g.fillStyle(PAL.riverNavy, 0.3);
  g.fillEllipse(cx + 2, cx + 4, 16, 8);
  g.fillStyle(PAL.hazard, 1);
  g.fillCircle(cx, cx, 8);
  g.fillStyle(PAL.white, 1);
  g.fillRect(cx - 8, cx - 2, 16, 4.5);
  g.lineStyle(1.6, PAL.ink, 0.8);
  g.strokeCircle(cx, cx, 8);
  g.fillStyle(PAL.white, 0.5);
  g.fillCircle(cx - 3, cx - 4, 2);
  done(g, "buoy", s, s + 4);
}

/* ---------------------------------------------------------------- propeller */

function makePropeller(scene: Phaser.Scene) {
  const g = gfx(scene);
  const s = 46;
  const cx = s / 2;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    g.fillStyle(PAL.metal, 1);
    const len = 18;
    g.fillTriangle(
      cx + Math.cos(a) * len,
      cx + Math.sin(a) * len,
      cx + Math.cos(a + 0.55) * 7,
      cx + Math.sin(a + 0.55) * 7,
      cx + Math.cos(a - 0.55) * 7,
      cx + Math.sin(a - 0.55) * 7,
    );
    g.fillStyle(PAL.metalLight, 0.65);
    g.fillTriangle(
      cx + Math.cos(a) * (len - 3),
      cx + Math.sin(a) * (len - 3),
      cx + Math.cos(a + 0.3) * 7,
      cx + Math.sin(a + 0.3) * 7,
      cx + Math.cos(a - 0.05) * 7,
      cx + Math.sin(a - 0.05) * 7,
    );
  }
  g.fillStyle(PAL.metalLight, 1);
  g.fillCircle(cx, cx, 7);
  g.fillStyle(PAL.metal, 1);
  g.fillCircle(cx, cx, 4.5);
  g.lineStyle(2, PAL.ink, 0.85);
  g.strokeCircle(cx, cx, 7);
  done(g, "propeller", s, s);
}

/* ------------------------------------------------------------------ effects */

function makeBubble(scene: Phaser.Scene) {
  const g = gfx(scene);
  const s = 12;
  g.fillStyle(PAL.foam, 0.5);
  g.fillCircle(s / 2, s / 2, 5);
  g.lineStyle(1.2, PAL.white, 0.9);
  g.strokeCircle(s / 2, s / 2, 5);
  g.fillStyle(PAL.white, 0.95);
  g.fillCircle(s / 2 - 1.6, s / 2 - 1.8, 1.4);
  done(g, "bubble", s, s);
}

function makeWake(scene: Phaser.Scene) {
  const g = gfx(scene);
  const s = 26;
  softCircle(g, s / 2, s / 2, 11, PAL.foam, 0.85, 5);
  done(g, "wake", s, s);
}

function makeSplash(scene: Phaser.Scene) {
  const g = gfx(scene);
  const s = 56;
  const cx = s / 2;
  g.lineStyle(3, PAL.white, 0.9);
  g.strokeCircle(cx, cx, 14);
  g.lineStyle(2, PAL.foam, 0.7);
  g.strokeCircle(cx, cx, 22);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.fillStyle(PAL.white, 0.85);
    g.fillCircle(cx + Math.cos(a) * 19, cx + Math.sin(a) * 19, 3);
  }
  done(g, "splash", s, s);
}

function makeSparkle(scene: Phaser.Scene) {
  const g = gfx(scene);
  const s = 22;
  const cx = s / 2;
  g.fillStyle(PAL.white, 0.95);
  g.fillTriangle(cx, 0, cx + 3, cx, cx - 3, cx);
  g.fillTriangle(cx, s, cx + 3, cx, cx - 3, cx);
  g.fillTriangle(0, cx, cx, cx + 3, cx, cx - 3);
  g.fillTriangle(s, cx, cx, cx + 3, cx, cx - 3);
  g.fillStyle(PAL.foam, 1);
  g.fillCircle(cx, cx, 2.6);
  done(g, "sparkle", s, s);
}

function makeWarning(scene: Phaser.Scene) {
  const g = gfx(scene);
  const s = 34;
  g.fillStyle(PAL.ink, 0.35);
  g.fillTriangle(s / 2 + 1, 4, s - 1, s - 2, 1, s - 2);
  g.fillStyle(PAL.hazardWarm, 1);
  g.fillTriangle(s / 2, 2, s - 3, s - 4, 3, s - 4);
  g.lineStyle(2.5, PAL.ink, 0.9);
  g.strokeTriangle(s / 2, 2, s - 3, s - 4, 3, s - 4);
  g.fillStyle(PAL.white, 1);
  g.fillRoundedRect(s / 2 - 2.2, 11, 4.4, 11, 2);
  g.fillCircle(s / 2, s - 9, 2.4);
  done(g, "warning", s, s);
}

function makeLilyPad(scene: Phaser.Scene) {
  const g = gfx(scene);
  const s = 34;
  const cx = s / 2;
  g.fillStyle(PAL.riverNavy, 0.22);
  g.fillEllipse(cx + 2, cx + 3, 28, 26);
  g.fillStyle(PAL.leaf, 1);
  g.slice(cx, cx, 14, 0.28 * Math.PI, 1.9 * Math.PI, false);
  g.fillPath();
  g.fillStyle(PAL.leafLight, 0.6);
  g.slice(cx, cx, 9, 0.35 * Math.PI, 1.8 * Math.PI, false);
  g.fillPath();
  g.lineStyle(1.2, PAL.seaweed, 0.7);
  for (let i = 0; i < 6; i++) {
    const a = 0.4 * Math.PI + (i / 6) * 1.4 * Math.PI;
    g.lineBetween(cx, cx, cx + Math.cos(a) * 13, cx + Math.sin(a) * 13);
  }
  done(g, "lilypad", s, s);
}

function makeLeaf(scene: Phaser.Scene) {
  const g = gfx(scene);
  const s = 18;
  g.fillStyle(PAL.leafLight, 0.95);
  g.fillEllipse(s / 2, s / 2, 15, 8);
  g.lineStyle(1, PAL.seaweed, 0.8);
  g.lineBetween(2, s / 2, s - 2, s / 2);
  done(g, "leaf", s, s);
}

function makeRock(scene: Phaser.Scene) {
  const g = gfx(scene);
  const s = 32;
  g.fillStyle(PAL.riverNavy, 0.25);
  g.fillEllipse(s / 2 + 2, s / 2 + 4, 28, 13);
  g.fillStyle(0x6b7b83, 1);
  g.beginPath();
  g.moveTo(3, s - 7);
  g.lineTo(9, 9);
  g.lineTo(19, 5);
  g.lineTo(s - 3, 13);
  g.lineTo(s - 5, s - 7);
  g.closePath();
  g.fillPath();
  g.fillStyle(0x8b9ba3, 1);
  g.fillTriangle(9, 9, 19, 5, 16, 17);
  g.lineStyle(1.6, 0x44555c, 0.9);
  g.strokePath();
  done(g, "rock", s, s);
}

function makeDebris(scene: Phaser.Scene) {
  const g = gfx(scene);
  const s = 32;
  g.fillStyle(PAL.riverNavy, 0.25);
  g.fillEllipse(s / 2 + 2, s / 2 + 4, 28, 11);
  g.fillStyle(PAL.woodDark, 1);
  g.fillRoundedRect(2, s / 2 - 6, s - 4, 12, 6);
  g.fillStyle(PAL.wood, 1);
  g.fillRoundedRect(3, s / 2 - 6, s - 6, 9, 5);
  g.lineStyle(1.2, PAL.woodDark, 0.9);
  g.lineBetween(6, s / 2 - 2, s - 6, s / 2 - 2);
  g.lineBetween(8, s / 2 + 2, s - 8, s / 2 + 1);
  done(g, "debris", s, s);
}

/* -------------------------------------------------------------------- panel */

function makePanel(scene: Phaser.Scene) {
  const g = gfx(scene);
  const w = 64;
  const h = 40;
  g.fillStyle(PAL.riverNavy, 0.55);
  g.fillRoundedRect(2, 4, w - 4, h - 4, 12);
  g.fillStyle(PAL.hudNavy, 1);
  g.fillRoundedRect(0, 0, w, h - 4, 12);
  g.fillStyle(PAL.hudNavyLight, 0.75);
  g.fillRoundedRect(3, 3, w - 6, (h - 4) / 2, 10);
  g.lineStyle(2, PAL.hudAccent, 0.45);
  g.strokeRoundedRect(1, 1, w - 2, h - 6, 11);
  done(g, "panel", w, h);
}

/* ---------------------------------------------------------------- entry point */

export function buildAllTextures(scene: Phaser.Scene) {
  // Three dimensional character variations, each with a swim cycle.
  const variants = {
    manny: {
      body: PAL.manatee,
      dark: PAL.manateeDark,
      belly: PAL.manateeBelly,
      blush: PAL.manateeBlush,
    },
    coral: {
      body: 0xb7a9a0,
      dark: 0x766862,
      belly: 0xeadbd1,
      blush: 0xf08f83,
    },
    sage: {
      body: 0x91aaa3,
      dark: 0x536e69,
      belly: 0xd5e6dd,
      blush: 0xe6a09b,
    },
  };
  for (const [name, colors] of Object.entries(variants)) {
    makeManatee(scene, `manatee-${name}`, 0, colors);
    makeManatee(scene, `manatee-${name}-swim-1`, -4, colors);
    makeManatee(scene, `manatee-${name}-swim-2`, 4, colors);
  }
  // Kept for HUD icons and backwards-compatible texture lookups.
  makeManatee(scene, "manatee", 0, variants.manny);

  makeBoats(scene);
  makeLettuce(scene);
  makeSeaweed(scene);
  makeShrimp(scene);
  makeFish(scene);
  makeJellyfish(scene);
  makePost(scene);
  makeBuoy(scene);
  makePropeller(scene);
  makeBubble(scene);
  makeWake(scene);
  makeSplash(scene);
  makeSparkle(scene);
  makeWarning(scene);
  makeLilyPad(scene);
  makeLeaf(scene);
  makeRock(scene);
  makeDebris(scene);
  makePanel(scene);
}
