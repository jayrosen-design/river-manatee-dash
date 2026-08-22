import Phaser from "phaser";
import { buildAllTextures } from "../art/textureFactory";

// Generates all procedural textures used by the game.
// Texture keys are stable so hand-drawn art can replace them later.
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload() {
    buildAllTextures(this);
  }

  create() {
    this.scene.start("GameScene");
    this.scene.launch("UIScene");
  }
}
