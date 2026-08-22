import Phaser from "phaser";
import { PAL, hex } from "./palette";

/** Reusable juice helpers. Every one is a no-op-ish when reducedMotion is on. */

export function popSprite(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  reducedMotion: boolean,
) {
  if (reducedMotion) {
    sprite.destroy();
    return;
  }
  scene.tweens.add({
    targets: sprite,
    scale: 1.7,
    alpha: 0,
    duration: 220,
    ease: "Quad.easeOut",
    onComplete: () => sprite.destroy(),
  });
}

export function floatingScore(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: number = PAL.foam,
) {
  const t = scene.add
    .text(x, y, text, {
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "18px",
      fontStyle: "900",
      color: hex(color),
      stroke: hex(PAL.riverNavy),
      strokeThickness: 4,
    })
    .setOrigin(0.5)
    .setDepth(40);
  scene.tweens.add({
    targets: t,
    y: y - 34,
    alpha: 0,
    duration: 750,
    ease: "Quad.easeOut",
    onComplete: () => t.destroy(),
  });
}

export function sparkleBurst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  reducedMotion: boolean,
  count = 5,
) {
  if (reducedMotion) return;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random();
    const s = scene.add
      .sprite(x, y, "sparkle")
      .setDepth(38)
      .setScale(0.5 + Math.random() * 0.4);
    scene.tweens.add({
      targets: s,
      x: x + Math.cos(a) * 22,
      y: y + Math.sin(a) * 22,
      alpha: 0,
      angle: 180,
      duration: 380,
      onComplete: () => s.destroy(),
    });
  }
}

export function splashAt(
  scene: Phaser.Scene,
  x: number,
  y: number,
  reducedMotion: boolean,
) {
  const s = scene.add.sprite(x, y, "splash").setDepth(40).setScale(0.4);
  scene.tweens.add({
    targets: s,
    scale: reducedMotion ? 1 : 1.8,
    alpha: 0,
    duration: reducedMotion ? 260 : 480,
    onComplete: () => s.destroy(),
  });
}

export function shake(scene: Phaser.Scene, reducedMotion: boolean) {
  if (reducedMotion) return;
  scene.cameras.main.shake(180, 0.008);
}

/** Short-lived bubble that rises and fades — used for manatee/boat trails. */
export function bubbleTrail(
  scene: Phaser.Scene,
  x: number,
  y: number,
  reducedMotion: boolean,
) {
  if (reducedMotion) return;
  const b = scene.add
    .sprite(x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8, "bubble")
    .setDepth(4)
    .setScale(0.4 + Math.random() * 0.6)
    .setAlpha(0.8);
  scene.tweens.add({
    targets: b,
    y: b.y - 12 - Math.random() * 10,
    alpha: 0,
    scale: 0.2,
    duration: 600 + Math.random() * 300,
    onComplete: () => b.destroy(),
  });
}

export function wakePuff(
  scene: Phaser.Scene,
  x: number,
  y: number,
  reducedMotion: boolean,
) {
  if (reducedMotion) return;
  const w = scene.add
    .sprite(x, y, "wake")
    .setDepth(3)
    .setAlpha(0.55)
    .setScale(0.6);
  scene.tweens.add({
    targets: w,
    scale: 1.5,
    alpha: 0,
    duration: 700,
    onComplete: () => w.destroy(),
  });
}
