import { getTileDefinition } from "../map/tileCatalog";
import type { LegacyMap } from "../map/legacyMapParser";
import type { GameState, Position } from "./types";

export function createGameState(map: LegacyMap): GameState {
  const start = findFirstPassableTile(map);
  const totalCrates = map.tiles.flat().filter((tile) => getTileDefinition(tile).destructible).length;

  return {
    map,
    tiles: map.tiles.map((row) => [...row]),
    player: { position: start, alive: true },
    bombs: [],
    explosions: [],
    phase: "ready",
    score: 0,
    moves: 0,
    elapsedMs: 0,
    clearedCrates: 0,
    totalCrates,
  };
}

function findFirstPassableTile(map: LegacyMap): Position {
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (getTileDefinition(map.tiles[y]?.[x] ?? -1).passable) {
        return { x, y };
      }
    }
  }

  throw new Error(`${map.source}: map has no passable spawn tile`);
}

