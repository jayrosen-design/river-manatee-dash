import Phaser from "phaser";
import { GAME_W, HUD_H } from "../constants";
import { bus } from "../eventBus";
import { PAL, hex } from "../art/palette";

/** Branded HUD: rounded navy panels, aqua accents, manatee lives. */
export class UIScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private highText!: Phaser.GameObjects.Text;
  private foodText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private livesContainer!: Phaser.GameObjects.Container;
  private pauseBtn!: Phaser.GameObjects.Container;
  private pauseIcon!: Phaser.GameObjects.Text;
  private paused = false;

  constructor() {
    super({ key: "UIScene", active: false });
  }

  create() {
    const g = this.add.graphics();
    // bar
    g.fillStyle(PAL.hudNavy, 1);
    g.fillRect(0, 0, GAME_W, HUD_H);
    g.fillStyle(PAL.hudNavyLight, 0.5);
    g.fillRect(0, 0, GAME_W, HUD_H / 2);
    g.fillStyle(PAL.hudAccent, 0.55);
    g.fillRect(0, HUD_H - 3, GAME_W, 3);

    const panel = (x: number, w: number) => {
      g.fillStyle(PAL.riverNavy, 0.85);
      g.fillRoundedRect(x, 7, w, HUD_H - 17, 11);
      g.lineStyle(2, PAL.hudAccent, 0.35);
      g.strokeRoundedRect(x, 7, w, HUD_H - 17, 11);
    };
    panel(10, 190);
    panel(214, 270);
    panel(GAME_W - 214, 148);

    const base: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      color: hex(PAL.white),
      fontStyle: "900",
    };

    this.add.text(22, 12, "SCORE", {
      ...base,
      fontSize: "10px",
      color: hex(PAL.hudAccent),
    });
    this.scoreText = this.add.text(22, 23, "0", { ...base, fontSize: "20px" });

    this.add.text(120, 12, "BEST", {
      ...base,
      fontSize: "10px",
      color: hex(PAL.hudAccent),
    });
    this.highText = this.add.text(120, 24, "0", {
      ...base,
      fontSize: "16px",
      color: hex(PAL.lettuceLight),
    });

    this.add
      .text(422, 13, "FOOD LEFT", {
        ...base,
        fontSize: "10px",
        color: hex(PAL.hudAccent),
      })
      .setOrigin(0.5, 0);
    this.foodText = this.add.text(422, 24, "0", { ...base, fontSize: "20px" }).setOrigin(0.5, 0);

    this.add.text(228, 12, "CURRENT COURSE", {
      ...base,
      fontSize: "10px",
      color: hex(PAL.hudAccent),
    });
    this.levelText = this.add.text(228, 27, "1 / 3  SPRING RUN", {
      ...base,
      fontSize: "13px",
      color: hex(PAL.lettuceLight),
    });

    this.add.text(GAME_W - 204, 12, "MANATEES", {
      ...base,
      fontSize: "10px",
      color: hex(PAL.hudAccent),
    });
    this.livesContainer = this.add.container(GAME_W - 196, 34);

    // Pause button
    this.pauseBtn = this.add.container(GAME_W - 40, HUD_H / 2);
    const btnBg = this.add.graphics();
    btnBg.fillStyle(PAL.hudAccent, 0.9);
    btnBg.fillRoundedRect(-19, -17, 38, 34, 11);
    btnBg.lineStyle(2, PAL.white, 0.5);
    btnBg.strokeRoundedRect(-19, -17, 38, 34, 11);
    this.pauseIcon = this.add
      .text(0, 0, "II", {
        ...base,
        fontSize: "16px",
        color: hex(PAL.riverNavy),
      })
      .setOrigin(0.5);
    this.pauseBtn.add([btnBg, this.pauseIcon]);
    this.pauseBtn
      .setSize(38, 34)
      .setInteractive({ useHandCursor: true })
      .on("pointerover", () => this.pauseBtn.setScale(1.08))
      .on("pointerout", () => this.pauseBtn.setScale(1))
      .on("pointerdown", () => {
        this.pauseBtn.setScale(0.94);
        this.paused = !this.paused;
        bus.emit(this.paused ? "cmd_pause" : "cmd_resume");
      })
      .on("pointerup", () => this.pauseBtn.setScale(1));

    bus.on("score", (s) => this.scoreText.setText(s.toLocaleString()));
    bus.on("highScore", (s) => this.highText.setText(s.toLocaleString()));
    bus.on("lettuceRemaining", (n) => this.foodText.setText(String(n)));
    bus.on("levelInfo", ({ index, count, name }) =>
      this.levelText.setText(`${index + 1} / ${count}  ${name.toUpperCase()}`),
    );
    bus.on("lives", (n) => this.renderLives(n));
    bus.on("paused", (p) => {
      this.paused = p;
      this.pauseIcon.setText(p ? "▶" : "II");
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off("score");
      bus.off("highScore");
      bus.off("lettuceRemaining");
      bus.off("levelInfo");
      bus.off("lives");
      bus.off("paused");
    });
  }

  private renderLives(n: number) {
    this.livesContainer.removeAll(true);
    for (let i = 0; i < n; i++) {
      const s = this.add.sprite(i * 26, 0, "manatee").setScale(0.42);
      this.livesContainer.add(s);
    }
  }
}
