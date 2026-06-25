import Phaser from "phaser";
import { COLORS, GAME_W, HUD_H } from "../constants";
import { bus } from "../eventBus";

export class UIScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private highText!: Phaser.GameObjects.Text;
  private lettuceText!: Phaser.GameObjects.Text;
  private livesContainer!: Phaser.GameObjects.Container;
  private pauseBtn!: Phaser.GameObjects.Text;
  private paused = false;

  constructor() {
    super({ key: "UIScene", active: false });
  }

  create() {
    // HUD background bar
    const g = this.add.graphics();
    g.fillStyle(COLORS.hudBg, 1);
    g.fillRect(0, 0, GAME_W, HUD_H);
    g.fillStyle(0xffffff, 0.05);
    g.fillRect(0, HUD_H - 2, GAME_W, 2);

    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "18px",
      color: "#ffffff",
      fontStyle: "bold",
    };

    this.scoreText = this.add.text(12, 8, "Score 0", style);
    this.add.text(12, 30, "Hi", { ...style, fontSize: "11px", color: "#8fb4ff" });
    this.highText = this.add.text(28, 28, "0", { ...style, fontSize: "14px", color: "#c8dcff" });

    this.lettuceText = this.add.text(GAME_W / 2, 12, "🥬 0", {
      ...style,
      fontSize: "18px",
    });
    this.lettuceText.setOrigin(0.5, 0);

    this.livesContainer = this.add.container(GAME_W - 130, 14);

    this.pauseBtn = this.add
      .text(GAME_W - 16, 14, "⏸", {
        ...style,
        fontSize: "22px",
        color: "#ffffff",
        backgroundColor: "#1c3760",
        padding: { left: 8, right: 8, top: 2, bottom: 2 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    this.pauseBtn.on("pointerdown", () => {
      this.paused = !this.paused;
      bus.emit(this.paused ? "cmd_pause" : "cmd_resume");
    });

    bus.on("score", (s) => this.scoreText.setText(`Score ${s}`));
    bus.on("highScore", (s) => this.highText.setText(String(s)));
    bus.on("lettuceRemaining", (n) => this.lettuceText.setText(`🥬 ${n}`));
    bus.on("lives", (n) => this.renderLives(n));
    bus.on("paused", (p) => {
      this.paused = p;
      this.pauseBtn.setText(p ? "▶" : "⏸");
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off("score");
      bus.off("highScore");
      bus.off("lettuceRemaining");
      bus.off("lives");
      bus.off("paused");
    });
  }

  private renderLives(n: number) {
    this.livesContainer.removeAll(true);
    for (let i = 0; i < n; i++) {
      const s = this.add.sprite(i * 24, 8, "manatee").setScale(0.55);
      this.livesContainer.add(s);
    }
  }
}
