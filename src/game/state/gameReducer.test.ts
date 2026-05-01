import { describe, expect, it } from "vitest";
import { parseLegacyMap } from "../map/legacyMapParser";
import { createGameState } from "./gameState";
import { reduceGame } from "./gameReducer";

const tinyMap = parseLegacyMap(
  `
1,1,1,1,1
1,0,0,3,1
1,0,1,4,1
1,1,1,1,1
`,
  "tiny.map",
);

describe("game reducer", () => {
  it("moves only through passable grid cells", () => {
    const started = reduceGame(createGameState(tinyMap), { type: "start" });
    const moved = reduceGame(started, { type: "move", direction: "right" });
    const blocked = reduceGame(moved, { type: "move", direction: "right" });

    expect(moved.player.position).toEqual({ x: 2, y: 1 });
    expect(blocked.player.position).toEqual({ x: 2, y: 1 });
  });

  it("places a bomb and clears destructible tiles", () => {
    let state = reduceGame(createGameState(tinyMap), { type: "start" });
    state = reduceGame(state, { type: "move", direction: "right" });
    state = reduceGame(state, { type: "placeBomb" });
    state = reduceGame(state, { type: "move", direction: "left" });
    state = reduceGame(state, { type: "move", direction: "down" });
    state = reduceGame(state, { type: "tick", deltaMs: 1900 });

    expect(state.tiles[1]?.[3]).toBe(0);
    expect(state.score).toBe(600);
    expect(state.phase).toBe("won");
  });
});

