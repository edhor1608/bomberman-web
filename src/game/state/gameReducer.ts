import { getTileDefinition } from "../map/tileCatalog";
import { createGameState } from "./gameState";
import type { Direction, Explosion, GameInput, GameState, Position } from "./types";

const bombFuseMs = 1800;
const explosionMs = 520;
const bombRange = 3;

export function reduceGame(state: GameState, input: GameInput): GameState {
  switch (input.type) {
    case "start":
      return state.phase === "ready" ? { ...state, phase: "playing" } : state;
    case "reset":
      return createGameState(state.map);
    case "move":
      return movePlayer(state, input.direction);
    case "placeBomb":
      return placeBomb(state);
    case "tick":
      return tick(state, input.deltaMs);
  }
}

function movePlayer(state: GameState, direction: Direction): GameState {
  if (state.phase !== "playing" || !state.player.alive) {
    return state;
  }

  const next = nextPosition(state.player.position, direction);
  if (!canEnter(state, next)) {
    return state;
  }

  const nextState = {
    ...state,
    player: { ...state.player, position: next },
    moves: state.moves + 1,
  };

  return hasWon(nextState) ? { ...nextState, phase: "won", score: nextState.score + 500 } : nextState;
}

function placeBomb(state: GameState): GameState {
  if (state.phase !== "playing" || state.bombs.length >= 1) {
    return state;
  }

  if (state.bombs.some((bomb) => samePosition(bomb.position, state.player.position))) {
    return state;
  }

  return {
    ...state,
    bombs: [
      ...state.bombs,
      {
        id: `bomb-${state.elapsedMs}-${state.player.position.x}-${state.player.position.y}`,
        position: state.player.position,
        timerMs: bombFuseMs,
        range: bombRange,
      },
    ],
  };
}

function tick(state: GameState, deltaMs: number): GameState {
  if (state.phase !== "playing") {
    return state;
  }

  let nextState: GameState = {
    ...state,
    elapsedMs: state.elapsedMs + deltaMs,
    bombs: state.bombs.map((bomb) => ({ ...bomb, timerMs: bomb.timerMs - deltaMs })),
    explosions: state.explosions
      .map((explosion) => ({ ...explosion, timerMs: explosion.timerMs - deltaMs }))
      .filter((explosion) => explosion.timerMs > 0),
  };

  const exploding = nextState.bombs.filter((bomb) => bomb.timerMs <= 0);
  if (exploding.length > 0) {
    nextState = exploding.reduce(applyExplosion, {
      ...nextState,
      bombs: nextState.bombs.filter((bomb) => bomb.timerMs > 0),
    });
  }

  if (nextState.explosions.some((explosion) => explosion.cells.some((cell) => samePosition(cell, nextState.player.position)))) {
    nextState = { ...nextState, player: { ...nextState.player, alive: false }, phase: "lost" };
  }

  return hasWon(nextState) ? { ...nextState, phase: "won", score: nextState.score + 500 } : nextState;
}

function applyExplosion(state: GameState, bomb: GameState["bombs"][number]): GameState {
  const cells = getExplosionCells(state, bomb.position, bomb.range);
  let cleared = 0;
  const tiles = state.tiles.map((row, y) =>
    row.map((tile, x) => {
      if (!cells.some((cell) => cell.x === x && cell.y === y)) {
        return tile;
      }

      if (getTileDefinition(tile).destructible) {
        cleared += 1;
        return 0;
      }

      return tile;
    }),
  );

  const explosion: Explosion = {
    id: `explosion-${bomb.id}`,
    cells,
    timerMs: explosionMs,
  };

  return {
    ...state,
    tiles,
    explosions: [...state.explosions, explosion],
    clearedCrates: state.clearedCrates + cleared,
    score: state.score + cleared * 100,
  };
}

function getExplosionCells(state: GameState, origin: Position, range: number): readonly Position[] {
  const cells: Position[] = [origin];
  const directions = ["up", "down", "left", "right"] as const satisfies readonly Direction[];

  for (const direction of directions) {
    let cursor = origin;
    for (let distance = 0; distance < range; distance += 1) {
      cursor = nextPosition(cursor, direction);
      if (!isInside(state, cursor)) {
        break;
      }

      cells.push(cursor);
      const tile = getTileDefinition(state.tiles[cursor.y]?.[cursor.x] ?? -1);
      if (!tile.passable) {
        break;
      }
    }
  }

  return cells;
}

function nextPosition(position: Position, direction: Direction): Position {
  switch (direction) {
    case "up":
      return { x: position.x, y: position.y - 1 };
    case "down":
      return { x: position.x, y: position.y + 1 };
    case "left":
      return { x: position.x - 1, y: position.y };
    case "right":
      return { x: position.x + 1, y: position.y };
  }
}

function canEnter(state: GameState, position: Position): boolean {
  if (!isInside(state, position)) {
    return false;
  }

  if (state.bombs.some((bomb) => samePosition(bomb.position, position))) {
    return false;
  }

  return getTileDefinition(state.tiles[position.y]?.[position.x] ?? -1).passable;
}

function isInside(state: GameState, position: Position): boolean {
  return position.x >= 0 && position.y >= 0 && position.x < state.map.width && position.y < state.map.height;
}

function samePosition(left: Position, right: Position): boolean {
  return left.x === right.x && left.y === right.y;
}

function hasWon(state: GameState): boolean {
  return state.totalCrates > 0 && state.clearedCrates >= state.totalCrates && state.player.alive;
}

