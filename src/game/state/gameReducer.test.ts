import { describe, expect, it } from "vitest";
import { parseLegacyMap } from "../map/legacyMapParser";
import { createGameState } from "./gameState";
import { reduceGame } from "./gameReducer";

const tinyMap = parseLegacyMap(
  `
1,1,1,1,1
1,0,0,3,1
1,0,0,4,1
1,1,1,1,1
`,
  "tiny.map",
);

describe("game reducer", () => {
  it("moves only through passable grid cells", () => {
    const started = reduceGame(createGameState(tinyMap), { type: "start" });
    const moved = reduceGame(started, { type: "setMovement", vector: { x: 1, y: 0 } });
    const ticked = reduceGame(moved, { type: "tick", deltaMs: 250 });
    const blocked = reduceGame(ticked, { type: "tick", deltaMs: 500 });

    expect(ticked.player.position.x).toBeGreaterThan(2);
    expect(blocked.player.position.x).toBeLessThan(2.72);
  });

  it("places a bomb and clears destructible tiles", () => {
    let state = reduceGame(createGameState(tinyMap), { type: "start" });
    state = reduceGame(state, { type: "placeBomb" });
    state = reduceGame(state, { type: "setMovement", vector: { x: 1, y: 1 } });
    state = reduceGame(state, { type: "tick", deltaMs: 400 });
    state = reduceGame(state, { type: "setMovement", vector: { x: 0, y: 0 } });
    state = reduceGame(state, { type: "tick", deltaMs: 1900 });

    expect(state.tiles[1]?.[3]).toBe(0);
    expect(state.score).toBe(600);
    expect(state.phase).toBe("won");
  });
});
