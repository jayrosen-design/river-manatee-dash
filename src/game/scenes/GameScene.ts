import Phaser from "phaser";
import {
  COLORS,
  COLS,
  HUD_H,
  MAZE_H,
  MAZE_W,
  PLAYER_SPEED,
  ROWS,
  SCORE,
  TILE,
  INVULN_MS,
  HIT_FREEZE_MS,
  LIVES_START,
} from "../constants";
import { level01 } from "../data/level01";
import type { BoatRoute } from "../data/types";
import { bus } from "../eventBus";
import { AudioSystem } from "../systems/AudioSystem";
import { ScoreSystem } from "../systems/ScoreSystem";

type Dir = "up" | "down" | "left" | "right";
const DIRS: Record<Dir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

interface BoatState {
  route: BoatRoute;
  sprite: Phaser.GameObjects.Sprite;
  wakeTimer: number;
  segIndex: number; // current segment start waypoint index
  segT: number; // progress along segment [0..1]
}

export class GameScene extends Phaser.Scene {
  private audio = new AudioSystem();
  private scoreSys = new ScoreSystem();

  private mazeOffsetY = HUD_H;

  private waterGfx!: Phaser.GameObjects.Graphics;
  private ropeGfx!: Phaser.GameObjects.Graphics;
  private overlayGfx!: Phaser.GameObjects.Graphics;
  private wakeGfx!: Phaser.GameObjects.Graphics;

  private manatee!: Phaser.GameObjects.Sprite;
  private lettuceSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private lettuceTotal = 0;
  private propellerSprites: {
    sprite: Phaser.GameObjects.Sprite;
    c: number;
    r: number;
    radius: number;
  }[] = [];

  private boats: BoatState[] = [];
  private warning!: Phaser.GameObjects.Sprite;

  // Player tile state
  private pcx = 1;
  private pcy = 1;
  private ptx = 1;
  private pty = 1;
  private moving = false;
  private currentDir: Dir | null = null;
  private bufferedDir: Dir | null = null;

  private lives = LIVES_START;
  private invulnUntil = 0;
  private frozenUntil = 0;
  private waterTime = 0;
  private paused = false;
  private gameOver = false;
  private reducedMotion = false;

  // Input
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

  create() {
    this.audio.unlock();
    this.reducedMotion =
      typeof window !== "undefined" &&
      window.localStorage.getItem("riverManatee.reducedMotion") === "1";

    this.waterGfx = this.add.graphics();
    this.wakeGfx = this.add.graphics();
    this.ropeGfx = this.add.graphics();
    this.overlayGfx = this.add.graphics();

    this.drawWater();
    this.drawRopes();
    this.spawnLettuce();
    this.spawnPropellers();
    this.spawnDebris();
    this.spawnManatee();
    this.spawnBoats();

    this.warning = this.add
      .sprite(0, 0, "warning")
      .setVisible(false)
      .setDepth(10);

    // Input
    const kb = this.input.keyboard!;
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
    bus.on("cmd_setMuted", (m) => this.audio.setMuted(m));
    bus.on("cmd_setReducedMotion", (v) => {
      this.reducedMotion = v;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "riverManatee.reducedMotion",
          v ? "1" : "0",
        );
      }
    });
    bus.on("cmd_dir", (d) => this.queueDir(d));

    // Emit initial state
    bus.emit("score", this.scoreSys.score);
    bus.emit("highScore", this.scoreSys.high);
    bus.emit("lives", this.lives);
    bus.emit("lettuceTotal", this.lettuceTotal);
    bus.emit("lettuceRemaining", this.lettuceSprites.size);
    bus.emit("ready");

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      bus.off("cmd_pause");
      bus.off("cmd_resume");
      bus.off("cmd_restart");
      bus.off("cmd_setMuted");
      bus.off("cmd_setReducedMotion");
      bus.off("cmd_dir");
    });
  }

  // ----- Drawing -----

  private drawWater() {
    this.waterGfx.clear();
    this.waterGfx.fillStyle(COLORS.waterDeep, 1);
    this.waterGfx.fillRect(0, this.mazeOffsetY, MAZE_W, MAZE_H);
    // Subtle vertical bands of lighter water
    for (let x = 0; x < MAZE_W; x += 4) {
      const a =
        0.05 +
        0.05 * Math.sin((x + this.waterTime * 30) * 0.04);
      this.waterGfx.fillStyle(COLORS.waterLight, a);
      this.waterGfx.fillRect(x, this.mazeOffsetY, 2, MAZE_H);
    }
  }

  private drawRopes() {
    this.ropeGfx.clear();
    const g = this.ropeGfx;
    // Draw connected rope strands between adjacent rope tiles + buoys at each
    g.lineStyle(4, COLORS.ropeShadow, 1);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (level01.grid[r][c] !== "rope") continue;
        const x = c * TILE + TILE / 2;
        const y = r * TILE + TILE / 2 + this.mazeOffsetY;
        // connect right
        if (c + 1 < COLS && level01.grid[r][c + 1] === "rope") {
          g.lineBetween(x, y, x + TILE, y);
        }
        // connect down
        if (r + 1 < ROWS && level01.grid[r + 1][c] === "rope") {
          g.lineBetween(x, y, x, y + TILE);
        }
      }
    }
    g.lineStyle(2, COLORS.rope, 1);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (level01.grid[r][c] !== "rope") continue;
        const x = c * TILE + TILE / 2;
        const y = r * TILE + TILE / 2 + this.mazeOffsetY;
        if (c + 1 < COLS && level01.grid[r][c + 1] === "rope") {
          g.lineBetween(x, y, x + TILE, y);
        }
        if (r + 1 < ROWS && level01.grid[r + 1][c] === "rope") {
          g.lineBetween(x, y, x, y + TILE);
        }
      }
    }
    // Buoys
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (level01.grid[r][c] !== "rope") continue;
        // Only draw a buoy at "corners" or every other tile to reduce clutter
        const x = c * TILE + TILE / 2;
        const y = r * TILE + TILE / 2 + this.mazeOffsetY;
        const isBorder =
          r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1;
        const everyN = isBorder ? 3 : 2;
        if ((c + r) % everyN !== 0) continue;
        g.fillStyle(COLORS.buoy, 1);
        g.fillCircle(x, y, 5);
        g.lineStyle(1.5, 0x222222, 1);
        g.strokeCircle(x, y, 5);
      }
    }
  }

  // ----- Spawning -----

  private spawnLettuce() {
    for (const w of level01.lettuce) {
      const key = `${w.c},${w.r}`;
      const x = w.c * TILE + TILE / 2;
      const y = w.r * TILE + TILE / 2 + this.mazeOffsetY;
      const s = this.add.sprite(x, y, "lettuce").setDepth(2);
      this.lettuceSprites.set(key, s);
    }
    this.lettuceTotal = this.lettuceSprites.size;
  }

  private spawnPropellers() {
    for (const p of level01.propellers) {
      const x = p.c * TILE + TILE / 2;
      const y = p.r * TILE + TILE / 2 + this.mazeOffsetY;
      const sprite = this.add.sprite(x, y, "propeller").setDepth(3);
      this.propellerSprites.push({
        sprite,
        c: p.c,
        r: p.r,
        radius: p.radiusTiles * TILE,
      });
      // visible hazard ring (dashed via overlay)
    }
  }

  private spawnDebris() {
    for (const d of level01.debrisDecorative) {
      const x = d.c * TILE + TILE / 2;
      const y = d.r * TILE + TILE / 2 + this.mazeOffsetY;
      this.add.sprite(x, y, "debris").setDepth(2).setAlpha(0.9);
    }
  }

  private spawnManatee() {
    const sp = level01.playerSpawn;
    this.pcx = this.ptx = sp.c;
    this.pcy = this.pty = sp.r;
    const x = sp.c * TILE + TILE / 2;
    const y = sp.r * TILE + TILE / 2 + this.mazeOffsetY;
    this.manatee = this.add.sprite(x, y, "manatee").setDepth(5);
    this.manatee.setOrigin(0.5, 0.5);
  }

  private spawnBoats() {
    for (const route of level01.boats) {
      const wp0 = route.waypoints[0];
      const x = wp0.c * TILE + TILE / 2;
      const y = wp0.r * TILE + TILE / 2 + this.mazeOffsetY;
      const sprite = this.add
        .sprite(x, y, `boat-${route.colorIndex}`)
        .setDepth(4);
      sprite.setOrigin(0.5, 0.5);
      this.boats.push({
        route,
        sprite,
        wakeTimer: 0,
        segIndex: 0,
        segT: 0,
      });
    }
  }

  // ----- Movement helpers -----

  private isWalkable(c: number, r: number): boolean {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false;
    return level01.grid[r][c] !== "rope";
  }

  private queueDir(d: Dir) {
    // If at tile center & immediate direction is walkable, apply now
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
    if (this.waterTime % 0.15 < dt) this.drawWater();

    if (this.time.now < this.frozenUntil) return;

    // Read keyboard
    if (this.keys.up.isDown || this.keys.w.isDown) this.queueDir("up");
    else if (this.keys.down.isDown || this.keys.s.isDown) this.queueDir("down");
    else if (this.keys.left.isDown || this.keys.a.isDown) this.queueDir("left");
    else if (this.keys.right.isDown || this.keys.d.isDown)
      this.queueDir("right");

    this.updateManatee(dt);
    this.updatePropellers(dt);
    this.updateBoats(dt);
    this.checkLettuce();
    this.checkHazards();
  }

  private updateManatee(dt: number) {
    if (!this.moving || !this.currentDir) {
      // try to start from buffered
      if (this.bufferedDir) {
        const { dx, dy } = DIRS[this.bufferedDir];
        if (this.isWalkable(this.pcx + dx, this.pcy + dy)) {
          this.currentDir = this.bufferedDir;
          this.bufferedDir = null;
          this.startStep();
        }
      }
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

      // Choose next dir: buffered first, then continue current
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
        if (!tryDir(this.currentDir)) {
          this.currentDir = null;
        }
      }
    } else {
      this.manatee.x += (dx / dist) * step;
      this.manatee.y += (dy / dist) * step;
      // wake every ~120ms
      if (!this.reducedMotion && Math.random() < dt * 6) {
        this.spawnWake(this.manatee.x, this.manatee.y, 0.25, 6);
      }
    }

    // Invulnerability flash
    if (this.time.now < this.invulnUntil) {
      const t = Math.floor(this.time.now / 100) % 2;
      this.manatee.setAlpha(t ? 1 : 0.4);
    } else {
      this.manatee.setAlpha(1);
    }
  }

  private updatePropellers(dt: number) {
    for (const p of this.propellerSprites) {
      p.sprite.rotation += dt * 8;
    }
    // ripple ring
    this.overlayGfx.clear();
    for (const p of this.propellerSprites) {
      const x = p.c * TILE + TILE / 2;
      const y = p.r * TILE + TILE / 2 + this.mazeOffsetY;
      this.overlayGfx.lineStyle(2, COLORS.hazard, 0.85);
      // dashed circle approximation
      const segs = 24;
      for (let i = 0; i < segs; i++) {
        if (i % 2) continue;
        const a0 = (i / segs) * Math.PI * 2;
        const a1 = ((i + 1) / segs) * Math.PI * 2;
        this.overlayGfx.beginPath();
        this.overlayGfx.arc(x, y, p.radius, a0, a1, false);
        this.overlayGfx.strokePath();
      }
      // expanding ripple
      const rip = (this.waterTime * 30) % TILE;
      this.overlayGfx.lineStyle(1, 0xffffff, 0.4);
      this.overlayGfx.strokeCircle(x, y, 8 + rip);
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
      // Orient bow (top of sprite) toward direction of travel
      const angle = Math.atan2(by - ay, bx - ax) + Math.PI / 2;
      b.sprite.setRotation(angle);

      // wake trail
      b.wakeTimer -= dt;
      if (!this.reducedMotion && b.wakeTimer <= 0) {
        b.wakeTimer = 0.06;
        this.spawnWake(x - (bx - ax) / segLen * 22, y - (by - ay) / segLen * 22, 0.5, 10);
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
          this.warning.setAlpha(0.6 + 0.4 * Math.sin(this.time.now / 80));
        }
      }
    }
    if (!warnNear && this.warning.visible) this.warning.setVisible(false);

    // Fade wake graphics over time
    this.wakeGfx.setAlpha(Math.max(0, this.wakeGfx.alpha - dt * 0.8));
    if (this.wakeGfx.alpha < 0.05) {
      this.wakeGfx.clear();
      this.wakeGfx.setAlpha(1);
    }
  }

  private spawnWake(x: number, y: number, alpha: number, r: number) {
    this.wakeGfx.fillStyle(0xffffff, alpha);
    this.wakeGfx.fillCircle(x, y, r);
  }

  private checkLettuce() {
    const px = this.manatee.x;
    const py = this.manatee.y;
    const rad = TILE * 0.45;
    for (const [key, s] of this.lettuceSprites) {
      if (Math.hypot(s.x - px, s.y - py) < rad) {
        s.destroy();
        this.lettuceSprites.delete(key);
        this.scoreSys.add(SCORE.LETTUCE);
        this.audio.play("pickup");
        bus.emit("score", this.scoreSys.score);
        bus.emit("lettuceRemaining", this.lettuceSprites.size);
        if (this.lettuceSprites.size === 0) {
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
    // Boats — forgiving box
    for (const b of this.boats) {
      const dx = Math.abs(b.sprite.x - px);
      const dy = Math.abs(b.sprite.y - py);
      if (dx < TILE * 0.55 && dy < TILE * 0.9) {
        this.takeHit();
        return;
      }
    }
    // Propeller
    for (const p of this.propellerSprites) {
      const cx = p.c * TILE + TILE / 2;
      const cy = p.r * TILE + TILE / 2 + this.mazeOffsetY;
      if (Math.hypot(cx - px, cy - py) < p.radius * 0.7) {
        this.takeHit();
        return;
      }
    }
  }

  private takeHit() {
    this.audio.play("splash");
    this.frozenUntil = this.time.now + HIT_FREEZE_MS;
    this.invulnUntil = this.time.now + HIT_FREEZE_MS + INVULN_MS;
    this.lives -= 1;
    bus.emit("lives", Math.max(0, this.lives));
    // Respawn
    const sp = level01.playerSpawn;
    this.pcx = this.ptx = sp.c;
    this.pcy = this.pty = sp.r;
    this.manatee.x = sp.c * TILE + TILE / 2;
    this.manatee.y = sp.r * TILE + TILE / 2 + this.mazeOffsetY;
    this.moving = false;
    this.currentDir = null;
    this.bufferedDir = null;
    // Splash effect
    const splash = this.add.sprite(this.manatee.x, this.manatee.y, "splash").setDepth(20);
    this.tweens.add({
      targets: splash,
      scale: 2,
      alpha: 0,
      duration: 500,
      onComplete: () => splash.destroy(),
    });
    if (this.lives < 0) {
      this.endGame();
    }
  }

  private completeLevel() {
    this.audio.play("complete");
    this.gameOver = true;
    const lettuceCollected = this.lettuceTotal;
    const livesRemaining = Math.max(0, this.lives);
    const bonus = SCORE.LEVEL_COMPLETE + livesRemaining * SCORE.LIFE_BONUS;
    this.scoreSys.add(bonus);
    this.scoreSys.commitHigh();
    bus.emit("score", this.scoreSys.score);
    bus.emit("highScore", this.scoreSys.high);
    bus.emit("levelComplete", {
      score: this.scoreSys.score,
      lettuceCollected,
      livesRemaining,
      completionBonus: bonus,
    });
  }

  private endGame() {
    this.audio.play("gameover");
    this.gameOver = true;
    this.scoreSys.commitHigh();
    bus.emit("highScore", this.scoreSys.high);
    const collected = this.lettuceTotal - this.lettuceSprites.size;
    bus.emit("gameOver", {
      score: this.scoreSys.score,
      highScore: this.scoreSys.high,
      lettuceCollected: collected,
    });
  }

  private setPaused(p: boolean) {
    this.paused = p;
    bus.emit("paused", p);
  }

  private togglePause() {
    this.setPaused(!this.paused);
  }

  private restartLevel() {
    // Clean reset: restart scene
    this.scene.restart();
  }
}

