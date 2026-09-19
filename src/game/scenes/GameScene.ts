import Phaser from "phaser";
import {
  COLS,
  FOOD_SCORE,
  HIT_FREEZE_MS,
  HUD_H,
  INVULN_MS,
  JELLY_PENALTY,
  LIVES_START,
  MAZE_H,
  MAZE_W,
  PLAYER_SPEED,
  ROWS,
  SCORE,
  TILE,
  type FoodKind,
} from "../constants";
import { levels } from "../data/levels";
import type { BoatRoute, LevelData } from "../data/types";
import { bus } from "../eventBus";
import { audio } from "../systems/AudioSystem";
import { ScoreSystem } from "../systems/ScoreSystem";
import { PAL } from "../art/palette";
import { WaterRenderer } from "../art/water";
import { drawRopeMaze } from "../art/rope";
import {
  bubbleTrail,
  floatingScore,
  popSprite,
  shake,
  sparkleBurst,
  splashAt,
  wakePuff,
} from "../art/effects";

type Dir = "up" | "down" | "left" | "right";
const DIRS: Record<Dir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

const FOOD_COLOR: Record<FoodKind, number> = {
  lettuce: PAL.lettuce,
  seaweed: PAL.seaweedLight,
  shrimp: PAL.shrimp,
  fish: PAL.fish,
};

interface BoatState {
  route: BoatRoute;
  sprite: Phaser.GameObjects.Sprite;
  wakeTimer: number;
  segIndex: number;
  segT: number;
}

interface JellyState {
  sprite: Phaser.GameObjects.Sprite;
  baseX: number;
  baseY: number;
  drift: number;
  phase: number;
}

export class GameScene extends Phaser.Scene {
  private audio = audio;
  private scoreSys = new ScoreSystem();
  private level: LevelData = levels[0];
  private levelIndex = 0;
  private levelStartScore = 0;

  private mazeOffsetY = HUD_H;

  private water!: WaterRenderer;
  private ropeGfx!: Phaser.GameObjects.Graphics;
  private overlayGfx!: Phaser.GameObjects.Graphics;

  private manatee!: Phaser.GameObjects.Sprite;
  private manateeShadow!: Phaser.GameObjects.Ellipse;
  private foodSprites: Map<string, { sprite: Phaser.GameObjects.Sprite; kind: FoodKind }> =
    new Map();
  private foodTotal = 0;
  private propellerSprites: {
    sprite: Phaser.GameObjects.Sprite;
    c: number;
    r: number;
    radius: number;
  }[] = [];

  private boats: BoatState[] = [];
  private jellies: JellyState[] = [];
  private leaves: Phaser.GameObjects.Sprite[] = [];
  private warning!: Phaser.GameObjects.Sprite;

  // Player tile state
  private pcx = 1;
  private pcy = 1;
  private ptx = 1;
  private pty = 1;
  private moving = false;
  private currentDir: Dir | null = null;
  private bufferedDir: Dir | null = null;
  private swimPhase = 0;

  private lives = LIVES_START;
  private invulnUntil = 0;
  private frozenUntil = 0;
  private waterTime = 0;
  private waterAccum = 0;
  private paused = false;
  private gameOver = false;
  private reducedMotion = false;

  private keys!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
    w: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    s: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
    esc: Phaser.Input.Keyboard.Key;
  };

  constructor() {
    super("GameScene");
  }

  init(data?: { levelIndex?: number; score?: number }) {
    this.levelIndex = Phaser.Math.Clamp(data?.levelIndex ?? 0, 0, levels.length - 1);
    this.level = levels[this.levelIndex];
    this.levelStartScore = data?.score ?? 0;
  }

  create() {
    // Scene instances are reused across scene.restart(), so every piece of
    // run state has to be reset here or a fresh game starts frozen.
    this.gameOver = false;
    this.paused = false;
    this.lives = LIVES_START;
    this.moving = false;
    this.currentDir = null;
    this.bufferedDir = null;
    this.swimPhase = 0;
    this.waterTime = 0;
    this.waterAccum = 0;
    this.frozenUntil = 0;
    this.foodTotal = 0;
    this.foodSprites.clear();
    this.propellerSprites = [];
    this.boats = [];
    this.jellies = [];
    this.leaves = [];
    this.scoreSys.reset();
    this.scoreSys.add(this.levelStartScore);
    bus.emit("paused", false);

    this.audio.unlock();
    this.audio.resume();
    this.reducedMotion =
      typeof window !== "undefined" &&
      window.localStorage.getItem("riverManatee.reducedMotion") === "1";

    this.water = new WaterRenderer(this, 0, this.mazeOffsetY, MAZE_W, MAZE_H);
    this.water.update(0);

    this.ropeGfx = this.add.graphics().setDepth(-10);
    this.overlayGfx = this.add.graphics().setDepth(1);

    this.drawRopes();
    this.spawnEnvironment();
    this.spawnFood();
    this.spawnPropellers();
    this.spawnDebris();
    this.spawnJellyfish();
    this.spawnManatee();
    this.spawnBoats();
    this.showCourseIntro();

    // Grace period so boats patrolling near the spawn can't kill you instantly.
    this.invulnUntil = this.time.now + INVULN_MS;

    this.warning = this.add.sprite(0, 0, "warning").setVisible(false).setDepth(12);

    const kb = this.input.keyboard!;
    // Let Phaser swallow arrows/space so the page doesn't scroll,
    // without any outside listener pre-empting the game input.
    kb.addCapture([
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    ]);
    this.keys = {
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      w: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      esc: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
    };
    this.keys.esc.on("down", () => this.togglePause());

    // Swipe via pointer
    let downX = 0;
    let downY = 0;
    let downT = 0;
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      downX = p.x;
      downY = p.y;
      downT = this.time.now;
      this.audio.unlock();
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
      const dx = p.x - downX;
      const dy = p.y - downY;
      const dt = this.time.now - downT;
      if (dt > 800) return;
      if (Math.abs(dx) < 22 && Math.abs(dy) < 22) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        this.queueDir(dx > 0 ? "right" : "left");
      } else {
        this.queueDir(dy > 0 ? "down" : "up");
      }
    });

    // React -> Phaser commands
    bus.on("cmd_pause", () => this.setPaused(true));
    bus.on("cmd_resume", () => this.setPaused(false));
    bus.on("cmd_restart", () => this.restartLevel());
    bus.on("cmd_nextLevel", () => this.startNextLevel());
    bus.on("cmd_setMuted", (m) => this.audio.setMuted(m));
    bus.on("cmd_setReducedMotion", (v) => {
      this.reducedMotion = v;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("riverManatee.reducedMotion", v ? "1" : "0");
      }
    });
    bus.on("cmd_dir", (d) => this.queueDir(d));

    bus.emit("score", this.scoreSys.score);
    bus.emit("highScore", this.scoreSys.high);
    bus.emit("lives", this.lives);
    bus.emit("lettuceTotal", this.foodTotal);
    bus.emit("lettuceRemaining", this.foodSprites.size);
    bus.emit("levelInfo", {
      index: this.levelIndex,
      count: levels.length,
      name: this.level.name,
      subtitle: this.level.subtitle,
    });
    bus.emit("ready");

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off("cmd_pause");
      bus.off("cmd_resume");
      bus.off("cmd_restart");
      bus.off("cmd_nextLevel");
      bus.off("cmd_setMuted");
      bus.off("cmd_setReducedMotion");
      bus.off("cmd_dir");
    });
  }

  // ----- Drawing -----

  private drawRopes() {
    const decor = drawRopeMaze(this.ropeGfx, this.level.grid, this.mazeOffsetY);
    for (const p of decor.pads) {
      this.add
        .sprite(p.x, p.y, "lilypad")
        .setDepth(-9)
        .setScale(p.scale)
        .setAlpha(0.9)
        .setAngle(((p.x + p.y) % 90) - 45);
    }
    for (const p of decor.posts) {
      const isBuoy = (Math.round(p.x / TILE) + Math.round(p.y / TILE)) % 7 === 0;
      this.add
        .sprite(p.x, p.y, isBuoy ? "buoy" : "post")
        .setDepth(-8)
        .setScale(isBuoy ? 0.85 : 0.95);
    }
  }

  private spawnEnvironment() {
    // shoreline vegetation + rocks (decor only, always inside rope regions)
    for (const rk of this.level.decor.rocks) {
      this.add
        .sprite(rk.c * TILE + TILE / 2, rk.r * TILE + TILE / 2 + this.mazeOffsetY, "rock")
        .setDepth(-7)
        .setScale(0.9);
    }
    for (const rd of this.level.decor.reeds) {
      const x = rd.c * TILE + TILE / 2;
      const y = rd.r * TILE + TILE / 2 + this.mazeOffsetY;
      for (let i = -1; i <= 1; i++) {
        this.add
          .sprite(x + i * 7, y + Math.abs(i) * 3, "seaweed")
          .setDepth(-7)
          .setScale(0.8)
          .setAlpha(0.85);
      }
    }
    // floating leaves drifting across the surface
    for (let i = 0; i < 7; i++) {
      const leaf = this.add
        .sprite(Math.random() * MAZE_W, this.mazeOffsetY + Math.random() * MAZE_H, "leaf")
        .setDepth(0)
        .setAlpha(0.75)
        .setScale(0.7 + Math.random() * 0.5)
        .setAngle(Math.random() * 360);
      this.leaves.push(leaf);
    }
  }

  private spawnFood() {
    for (const f of this.level.foods) {
      const key = `${f.c},${f.r}`;
      const x = f.c * TILE + TILE / 2;
      const y = f.r * TILE + TILE / 2 + this.mazeOffsetY;
      const s = this.add.sprite(x, y, f.kind).setDepth(2);
      if (f.kind !== "lettuce") s.setScale(1.05);
      if (!this.reducedMotion) {
        // gentle float
        this.tweens.add({
          targets: s,
          y: y - 3,
          duration: 1100 + Math.random() * 500,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
          delay: Math.random() * 600,
        });
      }
      this.foodSprites.set(key, { sprite: s, kind: f.kind });
    }
    this.foodTotal = this.foodSprites.size;
  }

  private spawnPropellers() {
    for (const p of this.level.propellers) {
      const x = p.c * TILE + TILE / 2;
      const y = p.r * TILE + TILE / 2 + this.mazeOffsetY;
      const sprite = this.add.sprite(x, y, "propeller").setDepth(3);
      this.propellerSprites.push({
        sprite,
        c: p.c,
        r: p.r,
        radius: p.radiusTiles * TILE,
      });
    }
  }

  private spawnDebris() {
    for (const d of this.level.debrisDecorative) {
      const x = d.c * TILE + TILE / 2;
      const y = d.r * TILE + TILE / 2 + this.mazeOffsetY;
      this.add.sprite(x, y, "debris").setDepth(2).setAlpha(0.95);
    }
  }

  private spawnJellyfish() {
    for (const j of this.level.jellyfish) {
      const x = j.c * TILE + TILE / 2;
      const y = j.r * TILE + TILE / 2 + this.mazeOffsetY;
      const sprite = this.add.sprite(x, y, "jellyfish").setDepth(4);
      this.jellies.push({
        sprite,
        baseX: x,
        baseY: y,
        drift: (j.drift ?? 0) * TILE,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  private spawnManatee() {
    const sp = this.level.playerSpawn;
    this.pcx = this.ptx = sp.c;
    this.pcy = this.pty = sp.r;
    const x = sp.c * TILE + TILE / 2;
    const y = sp.r * TILE + TILE / 2 + this.mazeOffsetY;
    this.manateeShadow = this.add.ellipse(x + 4, y + 12, 34, 15, PAL.riverNavy, 0.34).setDepth(5);
    this.manatee = this.add.sprite(x, y, `manatee-${this.level.characterVariant}`).setDepth(6);
    this.manatee.setOrigin(0.5, 0.5);
    this.manatee.setScale(0.82);
  }

  private showCourseIntro() {
    const panel = this.add.graphics();
    panel.fillStyle(PAL.hudNavy, 0.94);
    panel.fillRoundedRect(-165, -34, 330, 68, 18);
    panel.lineStyle(2, PAL.hudAccent, 0.65);
    panel.strokeRoundedRect(-165, -34, 330, 68, 18);

    const title = this.add
      .text(0, -13, `LEVEL ${this.levelIndex + 1}  •  ${this.level.name.toUpperCase()}`, {
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        fontSize: "20px",
        fontStyle: "900",
        color: "#ffffff",
      })
      .setOrigin(0.5);
    const subtitle = this.add
      .text(0, 14, this.level.subtitle, {
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        fontSize: "12px",
        color: "#8ce7e3",
      })
      .setOrigin(0.5);
    const intro = this.add
      .container(MAZE_W / 2, this.mazeOffsetY + 58, [panel, title, subtitle])
      .setDepth(30);

    this.time.delayedCall(this.reducedMotion ? 900 : 1400, () => {
      if (this.reducedMotion) {
        intro.destroy();
      } else {
        this.tweens.add({
          targets: intro,
          y: intro.y - 16,
          alpha: 0,
          duration: 420,
          ease: "Quad.easeIn",
          onComplete: () => intro.destroy(),
        });
      }
    });
  }

  private spawnBoats() {
    for (const route of this.level.boats) {
      const wp0 = route.waypoints[0];
      const x = wp0.c * TILE + TILE / 2;
      const y = wp0.r * TILE + TILE / 2 + this.mazeOffsetY;
      const sprite = this.add.sprite(x, y, `boat-${route.colorIndex}`).setDepth(5);
      sprite.setOrigin(0.5, 0.5);
      this.boats.push({ route, sprite, wakeTimer: 0, segIndex: 0, segT: 0 });
    }
  }

  // ----- Movement helpers -----

  private isWalkable(c: number, r: number): boolean {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false;
    return this.level.grid[r][c] !== "rope";
  }

  private queueDir(d: Dir) {
    if (!this.moving) {
      const { dx, dy } = DIRS[d];
      if (this.isWalkable(this.pcx + dx, this.pcy + dy)) {
        this.currentDir = d;
        this.startStep();
        return;
      }
    }
    this.bufferedDir = d;
  }

  private startStep() {
    if (!this.currentDir) return;
    const { dx, dy } = DIRS[this.currentDir];
    const ncx = this.pcx + dx;
    const ncy = this.pcy + dy;
    if (!this.isWalkable(ncx, ncy)) {
      this.moving = false;
      return;
    }
    this.ptx = ncx;
    this.pty = ncy;
    this.moving = true;
    this.updateManateeRotation();
  }

  private updateManateeRotation() {
    if (!this.currentDir) return;
    const map: Record<Dir, number> = {
      up: 0,
      right: Math.PI / 2,
      down: Math.PI,
      left: -Math.PI / 2,
    };
    this.manatee.setRotation(map[this.currentDir]);
  }

  // ----- Update loop -----

  update(_t: number, deltaMs: number) {
    if (this.paused || this.gameOver) return;
    const dt = deltaMs / 1000;
    this.waterTime += dt;
    this.waterAccum += dt;
    if (this.waterAccum > (this.reducedMotion ? 0.5 : 0.08)) {
      this.waterAccum = 0;
      this.water.update(this.waterTime);
    }
    this.updateLeaves(dt);

    if (this.time.now < this.frozenUntil) return;

    if (this.keys.up.isDown || this.keys.w.isDown) this.queueDir("up");
    else if (this.keys.down.isDown || this.keys.s.isDown) this.queueDir("down");
    else if (this.keys.left.isDown || this.keys.a.isDown) this.queueDir("left");
    else if (this.keys.right.isDown || this.keys.d.isDown) this.queueDir("right");

    this.updateManatee(dt);
    this.updatePropellers(dt);
    this.updateBoats(dt);
    this.updateJellies();
    this.checkFood();
    this.checkHazards();
  }

  private updateLeaves(dt: number) {
    for (const leaf of this.leaves) {
      leaf.x += dt * 7;
      leaf.y += Math.sin(this.waterTime + leaf.x * 0.01) * dt * 5;
      leaf.angle += dt * 4;
      if (leaf.x > MAZE_W + 12) {
        leaf.x = -12;
        leaf.y = this.mazeOffsetY + Math.random() * MAZE_H;
      }
    }
  }

  private updateManatee(dt: number) {
    this.manateeShadow.setPosition(this.manatee.x + 4, this.manatee.y + 13);
    if (!this.moving || !this.currentDir) {
      if (this.bufferedDir) {
        const { dx, dy } = DIRS[this.bufferedDir];
        if (this.isWalkable(this.pcx + dx, this.pcy + dy)) {
          this.currentDir = this.bufferedDir;
          this.bufferedDir = null;
          this.startStep();
        }
      }
      const idleKey = `manatee-${this.level.characterVariant}`;
      if (this.manatee.texture.key !== idleKey) this.manatee.setTexture(idleKey);
      return;
    }

    const targetX = this.ptx * TILE + TILE / 2;
    const targetY = this.pty * TILE + TILE / 2 + this.mazeOffsetY;
    const step = PLAYER_SPEED * dt;
    const dx = targetX - this.manatee.x;
    const dy = targetY - this.manatee.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= step) {
      this.manatee.x = targetX;
      this.manatee.y = targetY;
      this.pcx = this.ptx;
      this.pcy = this.pty;
      this.moving = false;

      const tryDir = (d: Dir): boolean => {
        const v = DIRS[d];
        if (this.isWalkable(this.pcx + v.dx, this.pcy + v.dy)) {
          this.currentDir = d;
          this.startStep();
          return true;
        }
        return false;
      };
      let advanced = false;
      if (this.bufferedDir) {
        if (tryDir(this.bufferedDir)) {
          this.bufferedDir = null;
          advanced = true;
        }
      }
      if (!advanced && this.currentDir) {
        if (!tryDir(this.currentDir)) this.currentDir = null;
      }
    } else {
      this.manatee.x += (dx / dist) * step;
      this.manatee.y += (dy / dist) * step;

      // swim cycle (tail swing) + bubble trail
      if (!this.reducedMotion) {
        this.swimPhase += dt * 6;
        const frame = Math.floor(this.swimPhase) % 4;
        const base = `manatee-${this.level.characterVariant}`;
        const key = frame === 1 ? `${base}-swim-1` : frame === 3 ? `${base}-swim-2` : base;
        if (this.manatee.texture.key !== key) this.manatee.setTexture(key);
        if (Math.random() < dt * 7) {
          bubbleTrail(this, this.manatee.x, this.manatee.y, false);
        }
      }
    }

    if (this.time.now < this.invulnUntil) {
      const t = Math.floor(this.time.now / (this.reducedMotion ? 250 : 100)) % 2;
      this.manatee.setAlpha(t ? 1 : 0.45);
    } else {
      this.manatee.setAlpha(1);
    }
  }

  private updatePropellers(dt: number) {
    for (const p of this.propellerSprites) {
      p.sprite.rotation += dt * (this.reducedMotion ? 3 : 9);
    }
    this.overlayGfx.clear();
    for (const p of this.propellerSprites) {
      const x = p.c * TILE + TILE / 2;
      const y = p.r * TILE + TILE / 2 + this.mazeOffsetY;
      // swirling water
      this.overlayGfx.fillStyle(PAL.riverNavy, 0.25);
      this.overlayGfx.fillCircle(x, y, p.radius);
      const pulse = this.reducedMotion ? 0.8 : 0.6 + 0.4 * Math.sin(this.waterTime * 5);
      this.overlayGfx.lineStyle(3, PAL.hazard, pulse);
      const segs = 26;
      for (let i = 0; i < segs; i++) {
        if (i % 2) continue;
        const a0 = (i / segs) * Math.PI * 2 + this.waterTime * 0.6;
        const a1 = ((i + 1) / segs) * Math.PI * 2 + this.waterTime * 0.6;
        this.overlayGfx.beginPath();
        this.overlayGfx.arc(x, y, p.radius, a0, a1, false);
        this.overlayGfx.strokePath();
      }
      this.overlayGfx.lineStyle(2, PAL.hazardWarm, 0.5);
      this.overlayGfx.strokeCircle(x, y, p.radius * 0.72);
      const rip = (this.waterTime * 26) % TILE;
      this.overlayGfx.lineStyle(1.5, PAL.foam, 0.35);
      this.overlayGfx.strokeCircle(x, y, 8 + rip);
    }
  }

  private updateJellies() {
    for (const j of this.jellies) {
      const t = this.waterTime + j.phase;
      j.sprite.x = j.baseX + Math.sin(t * 0.7) * j.drift;
      j.sprite.y = j.baseY + Math.sin(t * 1.6) * 4;
      const s = this.reducedMotion ? 1 : 1 + Math.sin(t * 3) * 0.08;
      j.sprite.setScale(s, 1 / s);
    }
  }

  private updateBoats(dt: number) {
    let warnNear = false;
    for (const b of this.boats) {
      const wps = b.route.waypoints;
      const a = wps[b.segIndex];
      const next = wps[(b.segIndex + 1) % wps.length];
      const ax = a.c * TILE + TILE / 2;
      const ay = a.r * TILE + TILE / 2 + this.mazeOffsetY;
      const bx = next.c * TILE + TILE / 2;
      const by = next.r * TILE + TILE / 2 + this.mazeOffsetY;
      const segLen = Math.hypot(bx - ax, by - ay) || 1;
      b.segT += (b.route.speed * dt) / segLen;
      if (b.segT >= 1) {
        b.segT = 0;
        b.segIndex = (b.segIndex + 1) % wps.length;
      }
      const t = b.segT;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      b.sprite.x = x;
      b.sprite.y = y;
      const angle = Math.atan2(by - ay, bx - ax) + Math.PI / 2;
      b.sprite.setRotation(angle);

      b.wakeTimer -= dt;
      if (!this.reducedMotion && b.wakeTimer <= 0) {
        b.wakeTimer = 0.09;
        wakePuff(this, x - ((bx - ax) / segLen) * 26, y - ((by - ay) / segLen) * 26, false);
      }

      if (b.route.warnAtCenterCrossing) {
        const centerY = 8 * TILE + TILE / 2 + this.mazeOffsetY;
        if (Math.abs(y - centerY) < TILE * 2.5) {
          warnNear = true;
          this.warning.setPosition(x, centerY - TILE * 1.2);
          if (!this.warning.visible) {
            this.warning.setVisible(true);
            this.audio.play("warn");
          }
          this.warning.setAlpha(this.reducedMotion ? 1 : 0.6 + 0.4 * Math.sin(this.time.now / 80));
        }
      }
    }
    if (!warnNear && this.warning.visible) this.warning.setVisible(false);
  }

  private checkFood() {
    const px = this.manatee.x;
    const py = this.manatee.y;
    const rad = TILE * 0.45;
    for (const [key, entry] of this.foodSprites) {
      const s = entry.sprite;
      if (Math.hypot(s.x - px, s.y - py) < rad) {
        const value = FOOD_SCORE[entry.kind];
        this.tweens.killTweensOf(s);
        popSprite(this, s, this.reducedMotion);
        sparkleBurst(this, s.x, s.y, this.reducedMotion, entry.kind === "lettuce" ? 4 : 7);
        floatingScore(this, s.x, s.y, `+${value}`, FOOD_COLOR[entry.kind]);
        this.foodSprites.delete(key);
        this.scoreSys.add(value);
        this.audio.play("pickup");
        // happy squish
        if (!this.reducedMotion) {
          this.tweens.add({
            targets: this.manatee,
            scaleX: 0.95,
            scaleY: 0.72,
            duration: 90,
            yoyo: true,
            ease: "Quad.easeOut",
            onComplete: () => this.manatee.setScale(0.82),
          });
        }
        bus.emit("score", this.scoreSys.score);
        bus.emit("lettuceRemaining", this.foodSprites.size);
        if (this.foodSprites.size === 0) {
          this.completeLevel();
          return;
        }
      }
    }
  }

  private checkHazards() {
    if (this.time.now < this.invulnUntil) return;
    const px = this.manatee.x;
    const py = this.manatee.y;
    for (const b of this.boats) {
      const dx = Math.abs(b.sprite.x - px);
      const dy = Math.abs(b.sprite.y - py);
      if (dx < TILE * 0.55 && dy < TILE * 0.9) {
        this.takeHit();
        return;
      }
    }
    for (const p of this.propellerSprites) {
      const cx = p.c * TILE + TILE / 2;
      const cy = p.r * TILE + TILE / 2 + this.mazeOffsetY;
      if (Math.hypot(cx - px, cy - py) < p.radius * 0.7) {
        this.takeHit();
        return;
      }
    }
    // Jellyfish sting: costs points, not a life.
    for (const j of this.jellies) {
      if (Math.hypot(j.sprite.x - px, j.sprite.y - py) < TILE * 0.55) {
        this.stung(j);
        return;
      }
    }
  }

  private stung(j: JellyState) {
    this.audio.play("warn");
    this.invulnUntil = this.time.now + 1200;
    this.scoreSys.add(-JELLY_PENALTY);
    bus.emit("score", this.scoreSys.score);
    floatingScore(this, this.manatee.x, this.manatee.y - 10, `-${JELLY_PENALTY}`, PAL.jellyLight);
    splashAt(this, j.sprite.x, j.sprite.y, this.reducedMotion);
  }

  private takeHit() {
    this.audio.play("splash");
    this.frozenUntil = this.time.now + HIT_FREEZE_MS;
    this.invulnUntil = this.time.now + HIT_FREEZE_MS + INVULN_MS;
    this.lives -= 1;
    bus.emit("lives", Math.max(0, this.lives));
    splashAt(this, this.manatee.x, this.manatee.y, this.reducedMotion);
    shake(this, this.reducedMotion);

    const sp = this.level.playerSpawn;
    this.pcx = this.ptx = sp.c;
    this.pcy = this.pty = sp.r;
    this.manatee.x = sp.c * TILE + TILE / 2;
    this.manatee.y = sp.r * TILE + TILE / 2 + this.mazeOffsetY;
    this.manateeShadow.setPosition(this.manatee.x + 4, this.manatee.y + 13);
    this.manatee.setScale(0.82);
    this.moving = false;
    this.currentDir = null;
    this.bufferedDir = null;
    splashAt(this, this.manatee.x, this.manatee.y, this.reducedMotion);

    if (this.lives <= 0) this.endGame();
  }

  private completeLevel() {
    this.audio.play("complete");
    this.gameOver = true;
    const collected = this.foodTotal;
    const livesRemaining = Math.max(0, this.lives);
    const bonus = SCORE.LEVEL_COMPLETE + livesRemaining * SCORE.LIFE_BONUS;
    this.scoreSys.add(bonus);
    this.scoreSys.commitHigh();
    // celebration
    if (!this.reducedMotion) {
      for (let i = 0; i < 14; i++) {
        this.time.delayedCall(i * 70, () =>
          sparkleBurst(
            this,
            Math.random() * MAZE_W,
            this.mazeOffsetY + Math.random() * MAZE_H,
            false,
            4,
          ),
        );
      }
    }
    bus.emit("score", this.scoreSys.score);
    bus.emit("highScore", this.scoreSys.high);
    bus.emit("levelComplete", {
      score: this.scoreSys.score,
      lettuceCollected: collected,
      livesRemaining,
      completionBonus: bonus,
      highScore: this.scoreSys.high,
      levelIndex: this.levelIndex,
      levelCount: levels.length,
      levelName: this.level.name,
      nextLevelName: levels[this.levelIndex + 1]?.name,
    });
  }

  private endGame() {
    this.audio.play("gameover");
    this.gameOver = true;
    this.scoreSys.commitHigh();
    bus.emit("highScore", this.scoreSys.high);
    const collected = this.foodTotal - this.foodSprites.size;
    bus.emit("gameOver", {
      score: this.scoreSys.score,
      highScore: this.scoreSys.high,
      lettuceCollected: collected,
    });
  }

  private setPaused(p: boolean) {
    this.paused = p;
    if (p) this.audio.suspend();
    else this.audio.resume();
    bus.emit("paused", p);
  }

  private togglePause() {
    this.setPaused(!this.paused);
  }

  private restartLevel() {
    this.audio.resume();
    this.scene.restart({
      levelIndex: this.levelIndex,
      score: this.levelStartScore,
    });
  }

  private startNextLevel() {
    if (this.levelIndex >= levels.length - 1) {
      this.scene.restart({ levelIndex: 0, score: 0 });
      return;
    }
    this.audio.resume();
    this.scene.restart({
      levelIndex: this.levelIndex + 1,
      score: this.scoreSys.score,
    });
  }
}
