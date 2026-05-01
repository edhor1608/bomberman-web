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

const openMap = parseLegacyMap(
  `
1,1,1,1,1,1,1
1,0,0,0,0,0,1
1,0,0,0,0,0,1
1,0,0,0,0,0,1
1,1,1,1,1,1,1
`,
  "open.map",
);

const rangeMap = parseLegacyMap(
  `
1,1,1,1,1,1,1,1,1
1,0,0,0,0,0,3,0,1
1,0,0,0,0,0,0,0,1
1,1,1,1,1,1,1,1,1
`,
  "range.map",
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

  it("does not trap the player inside a freshly placed bomb", () => {
    let state = reduceGame(createGameState(tinyMap), { type: "start" });
    state = reduceGame(state, { type: "setMovement", vector: { x: 1, y: 0 } });
    state = reduceGame(state, { type: "tick", deltaMs: 180 });
    state = reduceGame(state, { type: "placeBomb" });

    const beforeMove = state.player.position;
    state = reduceGame(state, { type: "setMovement", vector: { x: 0, y: 1 } });
    state = reduceGame(state, { type: "tick", deltaMs: 180 });

    expect(state.bombs[0]?.position).not.toEqual({
      x: Math.floor(beforeMove.x) + 0.5,
      y: Math.floor(beforeMove.y) + 0.5,
    });
    expect(state.player.position.y).toBeGreaterThan(beforeMove.y);
  });

  it("moves AI opponents toward the player", () => {
    const base = reduceGame(createGameState(openMap), { type: "start" });
    const state = {
      ...base,
      player: { ...base.player, position: { x: 1.5, y: 1.5 } },
      enemies: [
        {
          id: "enemy-test",
          position: { x: 5.5, y: 1.5 },
          direction: { x: 0, y: 0 },
          thinkMs: 0,
          alive: true,
        },
      ],
    };

    const ticked = reduceGame(state, { type: "tick", deltaMs: 250 });

    expect(ticked.enemies[0]?.position.x).toBeLessThan(5.5);
  });

  it("loses when an AI opponent reaches the player", () => {
    const base = reduceGame(createGameState(openMap), { type: "start" });
    const state = {
      ...base,
      player: { ...base.player, position: { x: 2.5, y: 2.5 } },
      enemies: [
        {
          id: "enemy-touching",
          position: { x: 2.75, y: 2.5 },
          direction: { x: 0, y: 0 },
          thinkMs: 1000,
          alive: true,
        },
      ],
    };

    const ticked = reduceGame(state, { type: "tick", deltaMs: 16 });

    expect(ticked.phase).toBe("lost");
    expect(ticked.player.alive).toBe(false);
  });

  it("kills AI opponents caught in explosions", () => {
    const base = reduceGame(createGameState(openMap), { type: "start" });
    const state = {
      ...base,
      player: { ...base.player, position: { x: 1.5, y: 1.5 } },
      enemies: [
        {
          id: "enemy-in-blast",
          position: { x: 3.5, y: 2.5 },
          direction: { x: 0, y: 0 },
          thinkMs: 1000,
          alive: true,
        },
      ],
      explosions: [{ id: "test-explosion", cells: [{ x: 3.5, y: 2.5 }], timerMs: 1000 }],
    };

    const ticked = reduceGame(state, { type: "tick", deltaMs: 16 });

    expect(ticked.enemies[0]?.alive).toBe(false);
    expect(ticked.score).toBe(250);
  });

  it("applies different bomb fuses and placement limits per bomb type", () => {
    let state = reduceGame(createGameState(openMap), { type: "start" });
    state = reduceGame(state, { type: "selectBomb", bombType: "quick" });
    state = reduceGame(state, { type: "placeBomb" });

    expect(state.bombs[0]?.type).toBe("quick");
    expect(state.bombs[0]?.timerMs).toBe(900);
    expect(state.bombs[0]?.range).toBe(2);

    state = { ...state, player: { ...state.player, position: { x: 3.5, y: 2.5 } } };
    state = reduceGame(state, { type: "placeBomb" });
    expect(state.bombs).toHaveLength(2);

    const afterLimit = reduceGame(state, { type: "placeBomb" });
    expect(afterLimit.bombs).toHaveLength(2);
  });

  it("gives mega bombs longer reach than standard bombs", () => {
    let standard = reduceGame(createGameState(rangeMap), { type: "start" });
    standard = reduceGame(standard, { type: "placeBomb" });
    standard = reduceGame(standard, { type: "tick", deltaMs: 1900 });

    let mega = reduceGame(createGameState(rangeMap), { type: "start" });
    mega = reduceGame(mega, { type: "selectBomb", bombType: "mega" });
    mega = reduceGame(mega, { type: "placeBomb" });
    mega = reduceGame(mega, { type: "tick", deltaMs: 2500 });

    expect(standard.tiles[1]?.[6]).toBe(3);
    expect(mega.tiles[1]?.[6]).toBe(0);
  });
});
