
# River Manatee — Implementation Plan

A single polished, playable level built with React + TypeScript + Vite + Phaser 3 + Tailwind. React handles menus/overlays; Phaser owns all gameplay.

## Scope (v1)
One complete rope-maze level with: main menu, How to Play, pause, level-complete, game-over, 3 lives, score + high score (LocalStorage), keyboard + mobile (swipe + on-screen D-pad) controls, sound toggle, reduced-motion toggle, responsive 4:3 stage with shoreline framing.

## Visual direction
Top-down Florida river. Blue-green rippling water, tan ropes with buoys, bright green lettuce, rounded gray manatee, colorful boats, orange/red hazard rings, dark navy HUD, riverbank foliage framing the canvas. Procedurally drawn placeholder art (Phaser Graphics + simple sprites generated at runtime) so assets can be swapped later.

## Architecture

```text
src/
  App.tsx                      # Routes between menu/game/results via state
  main.tsx
  index.css                    # Tailwind
  components/
    MainMenu.tsx               # Title, Play, How to Play, sound, hi-score
    HowToPlay.tsx
    GameContainer.tsx          # Mounts Phaser, bridges events <-> React
    HUDOverlay.tsx             # (Phaser draws HUD; React handles modals only)
    PauseMenu.tsx
    ResultsModal.tsx           # Shared level-complete / game-over
    TouchControls.tsx          # Optional translucent D-pad (mobile)
  game/
    config.ts                  # Phaser.Game config, scale, parent
    eventBus.ts                # mitt-style emitter bridging Phaser<->React
    constants.ts               # tile size, speeds, colors, scoring
    scenes/
      BootScene.ts             # set scale, load tiny boot assets
      PreloadScene.ts          # generate procedural textures
      GameScene.ts             # world, maze, entities, collisions
      UIScene.ts               # in-canvas HUD (score, lives, lettuce, pause btn)
    entities/
      Manatee.ts               # grid movement + input buffering + i-frames
      Boat.ts                  # waypoint patrol + wake + warning
      Propeller.ts             # rotation + ripple + hazard zone
      Collectible.ts           # lettuce
      Debris.ts                # decorative + blocking variants
    data/
      level01.ts               # tile grid + boat routes + propeller spots
      types.ts                 # TileType, LevelData, BoatRoute, etc.
    systems/
      ScoreSystem.ts           # score, hi-score (LocalStorage)
      AudioSystem.ts           # WebAudio-generated SFX + ambience, mute
      InputSystem.ts           # keyboard + swipe + dpad -> direction intents
      MazeSystem.ts            # tile lookup, wall checks, intersections
  assets/                       # placeholder folder for future art/audio
```

## Gameplay systems

**Grid movement & input buffering**
- Tile size ~28–32px. Manatee snaps to grid centers; moves at constant speed between tiles.
- Input system stores `currentDir` and `bufferedDir`. At each tile center, if `bufferedDir` is walkable, apply it; else continue `currentDir` if walkable, otherwise stop.
- Walls = `rope` tiles. Manatee collision box smaller than tile.

**Maze data (level01)**
- ~21×24 grid encoded as string rows mapped to TileType. Loops, multiple routes, safe pockets, boat lanes. 30–50 lettuce placements. Contains `playerSpawn`, 3 `boatSpawn` markers with route ids, 1 `propeller`, scattered `debris`.

**Boats**
- Each follows a predefined waypoint loop along valid corridors at fixed speed. Wake = trailing particle/graphics. Forgiving hitbox (~70% of sprite). One boat crosses a central corridor; triggers a 0.8s warning icon + arrow + SFX before entering.

**Propeller**
- Rotating graphics with concentric ripple. Hazard radius drawn with dashed orange ring (visible without color reliance — uses a striped pattern + ⚠ icon).

**Damage / lives**
- On hazard overlap: freeze 400ms, splash effect, -1 life, respawn at `playerSpawn`, 2s invulnerability with 8Hz alpha flash. During i-frames hazards do nothing.

**Scoring**
- Lettuce 100; level complete +1000; +500 per remaining life. Hi-score in `localStorage` key `riverManatee.highScore`.

**Audio (no external files)**
- AudioSystem uses WebAudio oscillators/noise to synthesize: ambience pad loop, pickup blip, warning beep, splash noise burst, level-complete arpeggio, game-over descending tones, UI click. Gated on first user interaction. Mute persisted in LocalStorage.

**React ↔ Phaser bridge**
- `eventBus` (tiny emitter). Phaser emits `score`, `lives`, `lettuceRemaining`, `levelComplete`, `gameOver`, `paused`. React listens to drive modals. React emits `pause`, `resume`, `restart`, `toMenu`, `setMuted`, `setReducedMotion`.

**HUD**
- Drawn in `UIScene` (in-canvas) so it scales with the 4:3 stage: Score, Hi, Lettuce remaining, Lives (manatee icons), Pause button. Dark navy panel along the top, sized so it never overlaps maze corridors (maze area sits below HUD band in the 4:3 stage).

**Responsive layout**
- Phaser `Scale.FIT` into a 4:3 logical canvas (e.g., 960×720). React wrapper centers it; on wide viewports, CSS-painted shoreline gradient + foliage SVGs flank the canvas. `touch-action: none` on game container; prevent page scroll while focused.

**Accessibility**
- Tailwind menus fully keyboard-navigable with visible focus rings. Reduced-motion toggle disables ripples/wake particles and slows flashes. Hazards use icon + pattern, not color alone. Sound toggle in menu and pause.

## Mobile controls
- Swipe detection on canvas (min 24px) sets buffered direction.
- Toggleable translucent D-pad (`TouchControls.tsx`) overlaying bottom-center; emits direction intents through eventBus.

## Screens & flow
1. **MainMenu** — animated water background (CSS gradient + subtle SVG ripples), title, Play, How to Play, sound toggle, hi-score.
2. **HowToPlay** — modal with controls & objective.
3. **Game** — Phaser scenes running; pause button or Esc opens PauseMenu (Resume, Restart, Main Menu, Sound).
4. **ResultsModal** — used for both Level Complete (with stats, bonus, conservation message) and Game Over (with stats). Buttons: Play Again, Main Menu.

## Dependencies to add
- `phaser` (^3.80)
- `mitt` (tiny event emitter)
No other runtime deps.

## Acceptance verification checklist
- Movement smooth with buffering at intersections.
- Rope walls block reliably (axis-aligned tile checks).
- All lettuce collectible; counter accurate; triggers level complete.
- 3 boats patrol loops; one crosses central corridor with warning.
- Propeller rotates, hazard zone damages.
- Lives decrement once per hit; i-frames prevent stacking.
- Restart fully resets level/boats/lettuce/score.
- Hi-score persists across reload.
- Keyboard, swipe, and D-pad all drive movement.
- Builds & runs via `npm install && npm run dev` with no TS errors.
- Renders well desktop + landscape mobile.

## Out of scope (v1)
Multiple levels, advanced boat AI/pathfinding, finished art, music tracks, leaderboard backend, settings persistence beyond hi-score/mute/reduced-motion.

## Notes
- Current template is TanStack Start, not plain Vite. I'll keep the existing TanStack Start setup and mount the React/Phaser game at `src/routes/index.tsx`, with all game code under `src/game/` and components under `src/components/` as outlined. `npm run dev` already works in this template. If you specifically want a fresh plain Vite scaffold instead, say so and I'll rip out TanStack first.
- Concept image: I don't see an uploaded image in this turn. I'll proceed with the described Florida-river style; if you re-upload it, I'll match palette/composition more closely.
