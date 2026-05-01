import { getTileDefinition } from "../map/tileCatalog";
import type { LegacyMap } from "../map/legacyMapParser";
import type { GameState, Position } from "./types";

export function createGameState(map: LegacyMap): GameState {
  const start = findFirstPassableTile(map);
  const totalCrates = map.tiles.flat().filter((tile) => getTileDefinition(tile).destructible).length;
  const enemies = findEnemySpawns(map, start);

  return {
    map,
    tiles: map.tiles.map((row) => [...row]),
    player: { position: start, alive: true },
    input: { x: 0, y: 0 },
    selectedBombType: "standard",
    bombs: [],
    enemies,
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
        return { x: x + 0.5, y: y + 0.5 };
      }
    }
  }

  throw new Error(`${map.source}: map has no passable spawn tile`);
}

function findEnemySpawns(map: LegacyMap, playerStart: Position): readonly GameState["enemies"][number][] {
  const spawns: GameState["enemies"][number][] = [];

  for (let y = map.height - 2; y >= 1; y -= 1) {
    for (let x = map.width - 2; x >= 1; x -= 1) {
      if (spawns.length >= 3) {
        return spawns;
      }

      const position = { x: x + 0.5, y: y + 0.5 };
      const distance = Math.abs(position.x - playerStart.x) + Math.abs(position.y - playerStart.y);
      if (distance < 8 || !getTileDefinition(map.tiles[y]?.[x] ?? -1).passable) {
        continue;
      }

      spawns.push({
        id: `enemy-${spawns.length + 1}`,
        position,
        direction: { x: -1, y: 0 },
        thinkMs: 400 + spawns.length * 250,
        alive: true,
      });
    }
  }

  return spawns;
}
