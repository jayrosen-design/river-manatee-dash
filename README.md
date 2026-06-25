# River Manatee

A polished top-down arcade game built with React, TypeScript, Vite (TanStack Start), and Phaser 3. Swim a friendly Florida manatee through a rope maze, collect floating lettuce, and dodge boats and propellers.

## Run

```bash
npm install
npm run dev
```

Then open the printed local URL.

## Controls

- **Desktop**: Arrow Keys or WASD to swim. `Esc` to pause.
- **Mobile**: Swipe in the direction you want to go, or use the on-screen D-pad.

## Gameplay

- Collect every lettuce to clear the level (100 points each).
- 3 lives. After a hit you respawn at the start with ~2s of invulnerability.
- Watch the warning icon — the blue boat crosses the central corridor.
- Level complete bonus: 1,000 points + 500 per remaining life.
- High score is saved to LocalStorage.

## Architecture

- `src/components/` — React menus, modals, touch controls.
- `src/game/` — Phaser game.
  - `config.ts` — Phaser game factory.
  - `eventBus.ts` — typed Phaser ↔ React event bridge.
  - `data/level01.ts` — tile-grid level definition, boat routes, propeller.
  - `scenes/` — Boot, Preload (procedural textures), Game, UI (HUD).
  - `systems/` — Score (LocalStorage) and Audio (WebAudio SFX, no asset files).

All gameplay (movement, collisions, hazards, scoring) lives in Phaser. React handles only menus and overlays.

## Extending

- Add a level: copy `level01.ts`, tweak walls, lettuce, boats, propellers, then load from `GameScene.create()`.
- Add a boat type: extend `BoatRoute` (e.g. speed bands or warning zones) and adjust handling in `GameScene.updateBoats`.
- Replace placeholder art: swap the procedural textures generated in `PreloadScene` with image assets loaded via `this.load.image(...)`.
