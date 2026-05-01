# Bomberman Web

A web-first 2.5D port of an old university Bomberman project.

The goal is preservation through modernization: keep the identity, old maps, and straightforward grid gameplay, but replace the dead Java/Slick2D/LWJGL 2 stack with a clean browser app.

## What Works

- Loads the original `.map` files from the legacy project.
- Generates playable random maps with an open starter route.
- Renders maps as a 2.5D Three.js board.
- Moves the player continuously across the board with camera-relative input.
- Includes three working bomb types: standard cross damage, quick round stun pulse, and mega long cross damage.
- Explodes bombs on grid lines.
- Clears destructible legacy block tiles.
- Spawns AI opponents with different behavior: chasers pursue the player, bombers can place bombs.
- Tracks score and persisted highscores in browser storage.
- Includes keyboard and on-screen controls.

## Stack

- TypeScript
- Vite
- React
- React Three Fiber
- Three.js
- Vitest
- pnpm

## Commands

```sh
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm build
```

## Controls

- Arrow keys or WASD: camera-relative movement
- Space: place bomb
- 1: standard cross bomb
- 2: quick round stun bomb
- 3: mega long cross bomb
- Escape: return to menu

Touch and mouse users can use the on-screen controls.

## Legacy Compatibility

Legacy files live under `public/legacy`.

- `public/legacy/maps/*.map` are parsed unchanged.
- `public/legacy/images/MainMenuBackground.png` is reused for the main menu.
- `public/legacy/font/fixedsys.ttf` is reused for arcade-style display text.
- `public/legacy/highscores/*.hsc` are preserved as artifacts, but not used as runtime storage.

The old Java highscore files are Java serialization streams from old package names. New highscores use versioned JSON in browser storage instead.

## Architecture Rule

Game rules are pure TypeScript and grid-based. React Three Fiber and Three.js only render state snapshots. Renderer code must not decide movement, collisions, bombs, scoring, or win/loss rules.
