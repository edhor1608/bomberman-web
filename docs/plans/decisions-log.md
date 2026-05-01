# Decisions Log

## ADR 001: Port Bomberman to a web-first stack

### Context

The repository is a roughly ten-year-old university project built around Java, Eclipse metadata, Slick2D, LWJGL 2, and an EEA engine jar. The checkout does not contain the referenced jars or native libraries, so it is not runnable from a clean clone. The repo does contain useful legacy project material: Java source, maps, a background image, font assets, and serialized highscore files.

The goal is to give the project new life in 2026 without discarding old possible usages. Compatibility should focus on preserving user-facing content and data formats where practical, especially maps and recoverable save/highscore data.

### Decision

Bomberman will be modernized as a web-first game. The old Java code will be treated as reference material, and the legacy data files will become compatibility fixtures for importers and tests.

The chosen stack is TypeScript, Vite, React for shell/UI, React Three Fiber and Three.js for the 2.5D board renderer, Vitest for compatibility and game-logic tests, and pnpm as the package manager. The first compatibility target is the existing comma-separated `.map` format.

The game rules must remain 2D and grid-based. Three.js is only the renderer. Collisions, movement, bombs, explosions, map parsing, scoring, and win/loss rules must live in plain TypeScript modules that do not import React, React Three Fiber, Three.js, or browser APIs.

### Rationale

A web-first stack makes the game easiest to run, share, and preserve without requiring old native libraries or a Java desktop setup. TypeScript gives enough structure for game logic and compatibility parsers while keeping the project approachable. Keeping the legacy files as fixtures lets the port preserve old content intentionally instead of rewriting around assumptions.

Three.js is the right renderer for the selected 2.5D target because the game should use real depth, camera angle, lighting, shadows, block height, bomb volume, and explosion presence. React Three Fiber is acceptable because React will already own the menu, pause, settings, and highscore UI, and the scene can still be kept as a rendering adapter over a pure game-state model.

### Consequences

The project should avoid a direct line-by-line Java port. Instead, the implementation should rebuild the game in small web-native slices: project scaffold, asset loading, map parsing, rendering, input, gameplay, then persistence. Legacy highscores may need a best-effort migration path because the current `.hsc` files are Java serialization artifacts from old package names.

Implementation work must not invent game behavior inside renderer components. Renderer code consumes snapshots of game state and emits input intents only.
