# Bomberman Web 2.5D Port Plan

## Goal

Port the old Bomberman university project into a web-first 2.5D game that runs from a clean checkout in 2026 while preserving old usable content and behavior wherever practical.

The port must not be a speculative redesign. The old project remains the reference for available assets, data formats, window dimensions, state names, and early gameplay intent. The new implementation should be small, testable, and strict about separating game rules from rendering.

## Final Decisions

- The app is web-first.
- The stack is TypeScript, Vite, React, React Three Fiber, Three.js, Vitest, and pnpm.
- React owns application UI: main menu, pause menu, settings, highscore screens, import/migration screens, and route/screen selection.
- React Three Fiber and Three.js own only 2.5D board rendering.
- Game logic is plain TypeScript. It must not import React, React Three Fiber, Three.js, DOM APIs, browser storage, or asset loaders.
- The game model remains 2D and grid-based.
- Three.js objects are a projection of game state, not the source of truth.
- Existing `.map` files are compatibility fixtures and must load unchanged.
- Existing Java `.hsc` highscore files are migration artifacts. They should be investigated and imported only if the format can be handled safely without restoring the full old Java runtime.

## Non-Goals

- Do not line-by-line port the Java/Slick2D code.
- Do not keep Eclipse as the development workflow.
- Do not require local jars or native LWJGL binaries.
- Do not create game rules inside Three.js objects, meshes, colliders, or scene components.
- Do not introduce multiplayer networking until the local single-player game is complete.
- Do not add procedural map generation before legacy maps render and play correctly.
- Do not redesign the map format before a compatibility parser exists and is tested.
- Do not refactor old source files unless a specific migration task needs it.

## Knowledge From The Old Project

### Repository Shape

The current repo contains five Java source files, one main menu image, one font, six map files, two serialized highscore files, and Eclipse metadata.

Important files:

- `src/ui/Bomberman.java`: old entry point and state setup.
- `src/ui/BasicState.java`: old reusable state that renders a background entity and delegates update/render to EEA.
- `src/ui/MainMenuState.java`: old main menu state.
- `src/parameter/GameParameters.java`: old constants for window size, frame rate, state IDs, image path, border IDs, and border width.
- `src/factories/BorderFactory.java`: old border entity factory.
- `maps/*.map`: legacy comma-separated map files.
- `images/MainMenuBackground.png`: existing menu background.
- `font/fixedsys.ttf`: existing font asset.
- `highscores/*.hsc`: Java serialized highscore files from old package names.

### Old Runtime Facts

- The old app title is `Bomberman`.
- The old window size is `1280 x 800`.
- The old target frame rate is `120`.
- The old main menu state ID is `0`.
- `GAMEPLAY_STATE` is also `0`, which is a bug and must not be repeated.
- The old main menu background path is `/images/MainMenuBackground.png`.
- The old native dependency layout expected `native/windows`, `native/macosx`, or `native/<os.name>`.
- The old app depended on Slick2D, LWJGL 2.9.3, and an EEA engine jar that are not present.

### Old Map Facts

Legacy map files are plain text CSV grids. The visible maps are 16 columns by 10 rows. Values are integers.

Observed values:

- `0`: empty in test and empty maps.
- `1`: used heavily as solid border or block in `level1.map` and block tests.
- `2`: used as an inner ring in `level1.map`.
- `3`: used as a horizontal/filled area in `level1.map`.
- `4`: a single special tile in `level1.map`.
- `10`: used in `levelTestBlock.map`.
- `100`: used in `levelTest2.map`.

The old code in this checkout does not define tile semantics. The new parser must preserve raw numeric tile IDs and map dimensions without guessing. Tile meaning should be assigned in a separate compatibility mapping table that can be revised as more old code or knowledge is recovered.

### Old Border Facts

`BorderFactory` creates invisible, non-passable entities for top, left, right, and bottom borders. This is reusable as a concept, not as code.

Ported behavior:

- The board should have non-passable outer bounds.
- Border collision should be part of pure grid/game logic.
- Renderer should not implement border collision.

Known old bug:

- Bottom border uses `size = new Vector2f(BORDER_WIDTH, WINDOW_HEIGHT)` instead of `new Vector2f(WINDOW_WIDTH, BORDER_WIDTH)`. Do not copy this.

### Old State Facts

The old app used Slick2D state-based game flow and EEA entity manager states. Reuse the concept only:

- Main menu.
- Gameplay.
- Future pause/highscore/settings screens.

Do not reuse duplicate numeric state IDs. Use typed screen names in the web app, for example `menu`, `playing`, `paused`, `highscores`, and `settings`.

### Old Highscore Facts

The `.hsc` files are Java serialization streams. They reference `de.tudarmstadt.informatik.fop.breakout.highscore.HighscoreListe` and `HighscoreEintrag`, not Bomberman package names.

Observed fields in serialized entries:

- `name`: string.
- `blocks`: integer.
- `points`: double.
- `time`: float.

Compatibility approach:

- Treat these files as legacy artifacts.
- Do not make Java serialization the new format.
- New highscore storage should be JSON in browser storage.
- A migration command or importer may be built later if parsing is safe and useful.
- If migration is not reliable, show a clear "legacy highscore import unavailable" state and keep the files as historical fixtures.

## Target Architecture

### Directory Layout

When the web app is introduced, use this structure:

```txt
src/
  app/
    App.tsx
    screens/
      MainMenuScreen.tsx
      GameScreen.tsx
      PauseScreen.tsx
      HighscoresScreen.tsx
      SettingsScreen.tsx
  game/
    map/
      legacyMapParser.ts
      tileCatalog.ts
      legacyMapParser.test.ts
    rules/
      board.ts
      movement.ts
      bombs.ts
      explosions.ts
      scoring.ts
    state/
      gameState.ts
      gameReducer.ts
      gameLoop.ts
  render/
    BoardScene.tsx
    CameraRig.tsx
    TileMesh.tsx
    PlayerMesh.tsx
    BombMesh.tsx
    ExplosionMesh.tsx
  persistence/
    highscores.ts
    legacyHighscoreImport.ts
  assets/
    legacyMaps.ts
```

Keep this boring. Do not add extra layers until a real need exists.

### Dependency Boundaries

Allowed dependencies:

- `src/game/**`: TypeScript standard library only.
- `src/persistence/**`: may use browser storage at the edge, but pure parsing helpers should stay browser-independent.
- `src/render/**`: may import React, React Three Fiber, Three.js, and game types.
- `src/app/**`: may import React, UI components, render components, persistence, and game orchestration.

Forbidden dependencies:

- `src/game/**` must not import from `src/render/**`, `src/app/**`, `three`, `@react-three/fiber`, or `react`.
- `src/game/rules/**` must not read files, fetch assets, or touch local storage.
- Renderer components must not decide whether movement, bombs, collisions, deaths, or scoring are valid.

### State Flow

Use one-directional flow:

```txt
keyboard/gamepad input
  -> input intent
  -> pure game update
  -> game state snapshot
  -> React UI and Three.js render projection
```

Renderer events may emit intents such as `moveUp`, `moveDown`, `placeBomb`, `pause`, or `selectMenuItem`. They must not mutate meshes as game state.

## Compatibility Requirements

### Legacy Map Parser

The first parser must:

- Read comma-separated text.
- Trim trailing newlines.
- Preserve row order.
- Parse every cell as an integer.
- Reject empty files.
- Reject rows with inconsistent column counts.
- Reject non-integer values.
- Return width, height, and `tiles: number[][]`.
- Preserve unknown tile IDs.
- Include filename/source metadata when available.

Required tests:

- Parses every file in `maps/*.map`.
- Confirms each bundled legacy map is 16 x 10.
- Confirms `level1.map` contains tile IDs `0`, `1`, `2`, `3`, and `4`.
- Confirms `levelEmpty.map` contains only `0`.
- Confirms unknown values like `10` and `100` are accepted.
- Confirms malformed CSV rejects with a useful error.

### Tile Catalog

Create a tile catalog separate from the parser.

Initial mapping:

- `0`: empty, passable.
- `1`: legacy solid candidate, non-passable by default.
- `2`: legacy solid candidate, non-passable by default until proven otherwise.
- `3`: legacy block candidate, non-passable by default until proven otherwise.
- `4`: legacy special candidate, non-passable by default until proven otherwise.
- `10`: legacy test block, non-passable by default.
- `100`: legacy test block, non-passable by default.
- unknown: non-passable by default in gameplay, visually distinct in renderer.

Reason: unknown map values should not accidentally become walkable and break old level intent.

### Rendering Compatibility

The first render milestone must show legacy maps as 2.5D boards:

- Orthographic camera.
- Board visible without scrolling at common desktop sizes.
- 16 x 10 grid centered in the playfield.
- Tile height and material vary by tile type.
- Unknown tile IDs render in a debug material until classified.
- Outer boundaries are visually clear.
- The legacy main menu background is reused if it has acceptable quality at web sizes.
- The old `fixedsys.ttf` font can be used for nostalgic numeric/UI accents, but not as the only UI font if readability suffers.

### Gameplay Compatibility

Until more old gameplay code is recovered, use standard Bomberman rules conservatively:

- Player movement is cardinal only.
- Movement is constrained to grid/passability.
- Bomb placement happens on the player's current tile.
- Bomb count is limited.
- Explosion range is grid-based.
- Explosions stop at solid blockers.
- Destroyable blocks can be added only after tile semantics are clarified.
- Scoring starts minimal and explicit.

All rules must be tested in pure TypeScript before renderer polish.

## Visual Direction

Visual thesis: a clean tabletop 2.5D Bomberman board with chunky low-poly geometry, sharp readable silhouettes, restrained lighting, and a small amount of arcade nostalgia from the old assets.

Implementation rules:

- Use an orthographic camera angled down, not a free 3D camera.
- Use real mesh depth for walls, bombs, players, and explosions.
- Keep the board readable before adding effects.
- Use shadows lightly; never let them hide tile identity.
- Use one primary accent color for current interactive state.
- Avoid heavy bloom, excessive particles, and decorative effects until gameplay is solid.
- Do not build a marketing landing page as the first screen. The first screen is the main menu.

Expected first viewport:

- Main menu with `Bomberman` as the dominant title.
- Play action.
- Highscores action.
- Settings action.
- Subtle 2.5D board preview or old background image treatment.

## Implementation Phases

### Phase 0: Preserve Project Knowledge

Deliverables:

- `docs/plans/decisions-log.md` contains ADR 001.
- This plan exists and is kept current.
- Any later architecture decision is appended to `docs/plans/decisions-log.md` immediately.

Acceptance:

- Docs explain why the project is web-first and why Three.js is renderer-only.

### Phase 1: Web Scaffold

Deliverables:

- Add Vite + React + TypeScript project files.
- Use pnpm.
- Add Vitest.
- Add scripts: `dev`, `build`, `test`, and `typecheck`.
- Keep old Java files in place for reference.
- Do not delete legacy assets.

Acceptance:

- `pnpm install` works.
- `pnpm dev` starts a local web app.
- `pnpm build` passes.
- `pnpm test` runs.
- The app opens to a simple main menu screen.

### Phase 2: Legacy Map Compatibility

Deliverables:

- Implement `legacyMapParser`.
- Add tests for all existing map files.
- Add `tileCatalog`.
- Add a simple map selection fixture list.

Acceptance:

- All bundled `.map` files parse in tests.
- Parser preserves unknown tile IDs.
- Malformed map tests fail with specific errors.
- No renderer code is involved in parser tests.

### Phase 3: Static 2.5D Board Rendering

Deliverables:

- Add React Three Fiber scene.
- Render one parsed legacy map as a 2.5D board.
- Add orthographic camera rig.
- Add tile meshes driven by `tileCatalog`.
- Add debug material for unknown tile IDs.

Acceptance:

- `level1.map` renders as a complete 16 x 10 board.
- The board fits the viewport on desktop.
- Unknown values are visible and distinguishable.
- No gameplay logic is inside mesh components.

### Phase 4: Game State Core

Deliverables:

- Define `GameState`, `Board`, `Player`, `Direction`, and `InputIntent` types.
- Implement player spawn rules.
- Implement movement and collision against passability.
- Add reducer or equivalent pure update function.
- Add tests for movement and collision.

Acceptance:

- Player cannot leave the board.
- Player cannot enter non-passable tiles.
- Movement tests use legacy maps as fixtures.
- Renderer receives state snapshots only.

### Phase 5: Input And Play Screen

Deliverables:

- Wire keyboard input to input intents.
- Add play/pause state.
- Render player mesh from game state.
- Keep movement grid-based even if visual interpolation is added.

Acceptance:

- Player moves around passable tiles.
- Pause stops updates.
- Reloading a map resets state cleanly.
- Input code does not import Three.js.

### Phase 6: Bombs And Explosions

Deliverables:

- Implement bomb placement.
- Implement bomb timers.
- Implement grid-based explosion propagation.
- Render bombs and explosions from state.
- Add tests for blockers and range.

Acceptance:

- Bombs appear on grid cells.
- Explosions follow grid rules.
- Explosions stop at non-passable blockers.
- Explosion rendering is purely visual.

### Phase 7: Destruction, Scoring, And Highscores

Deliverables:

- Decide destroyable tile IDs based on old evidence or explicit project choice.
- Implement block destruction only for destroyable tiles.
- Implement score model.
- Implement JSON highscore persistence.
- Add highscore screen.

Acceptance:

- Score behavior is documented.
- Highscores survive reload in browser storage.
- Highscore storage has versioned JSON.
- Legacy `.hsc` files are not used as runtime storage.

### Phase 8: Legacy Highscore Investigation

Deliverables:

- Document Java serialization findings.
- Decide whether best-effort import is worth building.
- If yes, implement isolated importer with tests against existing `.hsc` fixtures.
- If no, document why not.

Acceptance:

- The app never crashes on legacy `.hsc` data.
- Migration behavior is explicit and user-visible if implemented.

### Phase 9: Polish And Packaging

Deliverables:

- Responsive layout.
- Settings for volume, visual quality, and controls.
- Basic audio if assets are available or created later.
- Production build verification.

Acceptance:

- `pnpm build`, `pnpm test`, and `pnpm typecheck` pass.
- Browser smoke test confirms menu, map render, movement, pause, and bomb placement.
- No new architecture decisions are hidden in code without ADR updates.

## Strict Engineering Rules

- Add tests before or with every pure game behavior.
- Keep commits small by phase.
- Prefer deleting uncertainty over abstracting around it.
- Use typed literals and `as const` or `satisfies` for fixed catalogs.
- Do not use `any`.
- Do not add general-purpose ECS, physics, routing, networking, or asset pipelines unless a phase explicitly requires it.
- Do not create class hierarchies for game entities unless plain data becomes insufficient.
- Keep constants close to the feature that uses them unless shared by at least two modules.
- If a module becomes hard to explain, simplify it before adding more behavior.

## Immediate Next Tasks

1. Scaffold the Vite React TypeScript app with pnpm.
2. Add Vitest and baseline scripts.
3. Copy or expose legacy `maps/*.map`, `images/MainMenuBackground.png`, and `font/fixedsys.ttf` to the web asset path without changing the originals.
4. Implement and test `legacyMapParser`.
5. Render `level1.map` in a static React Three Fiber scene.

