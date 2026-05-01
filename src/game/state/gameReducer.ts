import { getTileDefinition } from "../map/tileCatalog";
import { createGameState } from "./gameState";
import type { BombType, Direction, Enemy, Explosion, GameInput, GameState, Position } from "./types";

const explosionMs = 520;
const playerSpeed = 4.2;
const enemySpeed = 2.15;
const actorRadius = 0.28;
const bombRadius = 0.34;
const enemyTouchRadius = 0.48;

const bombConfigs = {
  standard: { fuseMs: 1800, range: 3, limit: 1, score: 100 },
  quick: { fuseMs: 900, range: 2, limit: 2, score: 80 },
  mega: { fuseMs: 2400, range: 5, limit: 1, score: 140 },
} as const satisfies Record<BombType, { readonly fuseMs: number; readonly range: number; readonly limit: number; readonly score: number }>;

export function reduceGame(state: GameState, input: GameInput): GameState {
  switch (input.type) {
    case "start":
      return state.phase === "ready" ? { ...state, phase: "playing" } : state;
    case "reset":
      return createGameState(state.map);
    case "move":
      return movePlayerByVector(state, directionToVector(input.direction), 1 / playerSpeed);
    case "setMovement":
      return { ...state, input: normalize(input.vector) };
    case "selectBomb":
      return { ...state, selectedBombType: input.bombType };
    case "placeBomb":
      return placeBomb(state);
    case "tick":
      return tick(state, input.deltaMs);
  }
}

function tick(state: GameState, deltaMs: number): GameState {
  if (state.phase !== "playing") {
    return state;
  }

  let nextState = movePlayerByVector(state, state.input, (deltaMs / 1000) * playerSpeed);
  nextState = {
    ...nextState,
    elapsedMs: nextState.elapsedMs + deltaMs,
    bombs: nextState.bombs.map((bomb) => ({ ...bomb, timerMs: bomb.timerMs - deltaMs })),
    explosions: nextState.explosions
      .map((explosion) => ({ ...explosion, timerMs: explosion.timerMs - deltaMs }))
      .filter((explosion) => explosion.timerMs > 0),
  };

  nextState = updateEnemies(nextState, deltaMs);

  const exploding = nextState.bombs.filter((bomb) => bomb.timerMs <= 0);
  if (exploding.length > 0) {
    nextState = exploding.reduce(applyExplosion, {
      ...nextState,
      bombs: nextState.bombs.filter((bomb) => bomb.timerMs > 0),
    });
  }

  nextState = applyActorDamage(nextState);
  return hasWon(nextState) ? { ...nextState, phase: "won", score: nextState.score + 500 } : nextState;
}

function movePlayerByVector(state: GameState, vector: Position, distance: number): GameState {
  if (state.phase !== "playing" || !state.player.alive || (vector.x === 0 && vector.y === 0)) {
    return state;
  }

  const next = moveWithCollision(state, state.player.position, vector, distance);
  if (samePosition(next, state.player.position)) {
    return state;
  }

  return {
    ...state,
    player: { ...state.player, position: next },
    moves: state.moves + 1,
  };
}

function placeBomb(state: GameState): GameState {
  const config = bombConfigs[state.selectedBombType];
  const activeOfType = state.bombs.filter((bomb) => bomb.type === state.selectedBombType).length;
  const position = snapToCellCenter(state.player.position);

  if (state.phase !== "playing" || activeOfType >= config.limit) {
    return state;
  }

  if (state.bombs.some((bomb) => sameCell(bomb.position, position))) {
    return state;
  }

  return {
    ...state,
    bombs: [
      ...state.bombs,
      {
        id: `bomb-${state.elapsedMs}-${position.x}-${position.y}`,
        type: state.selectedBombType,
        position,
        timerMs: config.fuseMs,
        range: config.range,
      },
    ],
  };
}

function updateEnemies(state: GameState, deltaMs: number): GameState {
  const enemies = state.enemies.map((enemy) => {
    if (!enemy.alive) {
      return enemy;
    }

    const nextThinkMs = enemy.thinkMs - deltaMs;
    const direction = nextThinkMs <= 0 ? chooseEnemyDirection(state, enemy) : enemy.direction;
    const position = moveWithCollision(state, enemy.position, direction, (deltaMs / 1000) * enemySpeed);
    const stuck = samePosition(position, enemy.position);

    return {
      ...enemy,
      position,
      direction: stuck ? chooseEnemyDirection(state, enemy) : direction,
      thinkMs: stuck || nextThinkMs <= 0 ? 450 + ((state.elapsedMs + enemy.id.length * 97) % 700) : nextThinkMs,
    };
  });

  return { ...state, enemies };
}

function chooseEnemyDirection(state: GameState, enemy: Enemy): Position {
  const toPlayer = normalize({
    x: state.player.position.x - enemy.position.x,
    y: state.player.position.y - enemy.position.y,
  });
  const primary = Math.abs(toPlayer.x) > Math.abs(toPlayer.y) ? { x: Math.sign(toPlayer.x), y: 0 } : { x: 0, y: Math.sign(toPlayer.y) };
  const fallbacks = [
    primary,
    { x: -primary.x, y: -primary.y },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
  ];

  return fallbacks.find((direction) => canStandAt(state, add(enemy.position, direction, 0.45), actorRadius)) ?? { x: 0, y: 0 };
}

function applyExplosion(state: GameState, bomb: GameState["bombs"][number]): GameState {
  const cells = getExplosionCells(state, bomb.position, bomb.range);
  const config = bombConfigs[bomb.type];
  let cleared = 0;
  const tiles = state.tiles.map((row, y) =>
    row.map((tile, x) => {
      if (!cells.some((cell) => sameCell(cell, { x: x + 0.5, y: y + 0.5 }))) {
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
    score: state.score + cleared * config.score,
  };
}

function applyActorDamage(state: GameState): GameState {
  const playerInExplosion = state.explosions.some((explosion) => explosion.cells.some((cell) => containsPosition(cell, state.player.position)));
  const enemyTouchedPlayer = state.enemies.some(
    (enemy) => enemy.alive && distance(enemy.position, state.player.position) <= enemyTouchRadius,
  );
  const enemiesKilled = state.enemies.filter(
    (enemy) => enemy.alive && state.explosions.some((explosion) => explosion.cells.some((cell) => containsPosition(cell, enemy.position))),
  ).length;
  const enemies = state.enemies.map((enemy) =>
    state.explosions.some((explosion) => explosion.cells.some((cell) => containsPosition(cell, enemy.position)))
      ? { ...enemy, alive: false }
      : enemy,
  );

  return {
    ...state,
    enemies,
    score: state.score + enemiesKilled * 250,
    player: playerInExplosion || enemyTouchedPlayer ? { ...state.player, alive: false } : state.player,
    phase: playerInExplosion || enemyTouchedPlayer ? "lost" : state.phase,
  };
}

function getExplosionCells(state: GameState, origin: Position, range: number): readonly Position[] {
  const cells: Position[] = [snapToCellCenter(origin)];
  const directions = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
  ] as const satisfies readonly Position[];

  for (const direction of directions) {
    let cursor = snapToCellCenter(origin);
    for (let distanceIndex = 0; distanceIndex < range; distanceIndex += 1) {
      cursor = { x: cursor.x + direction.x, y: cursor.y + direction.y };
      if (!isInside(state, cursor)) {
        break;
      }

      cells.push(cursor);
      const tile = tileAt(state, cursor);
      if (!getTileDefinition(tile).passable) {
        break;
      }
    }
  }

  return cells;
}

function moveWithCollision(state: GameState, position: Position, vector: Position, distanceValue: number): Position {
  const normalized = normalize(vector);
  const nextX = { x: position.x + normalized.x * distanceValue, y: position.y };
  const x = canStandAt(state, nextX, actorRadius) ? nextX.x : position.x;
  const nextY = { x, y: position.y + normalized.y * distanceValue };
  const y = canStandAt(state, nextY, actorRadius) ? nextY.y : position.y;

  return { x, y };
}

function canStandAt(state: GameState, position: Position, radius: number): boolean {
  const checks = [
    { x: position.x - radius, y: position.y - radius },
    { x: position.x + radius, y: position.y - radius },
    { x: position.x - radius, y: position.y + radius },
    { x: position.x + radius, y: position.y + radius },
  ] as const satisfies readonly Position[];

  if (state.bombs.some((bomb) => distance(bomb.position, position) < bombRadius)) {
    return false;
  }

  return checks.every((check) => isInside(state, check) && getTileDefinition(tileAt(state, check)).passable);
}

function directionToVector(direction: Direction): Position {
  switch (direction) {
    case "up":
      return { x: -1, y: -1 };
    case "down":
      return { x: 1, y: 1 };
    case "left":
      return { x: -1, y: 1 };
    case "right":
      return { x: 1, y: -1 };
  }
}

function snapToCellCenter(position: Position): Position {
  return { x: Math.floor(position.x) + 0.5, y: Math.floor(position.y) + 0.5 };
}

function tileAt(state: GameState, position: Position): number {
  return state.tiles[Math.floor(position.y)]?.[Math.floor(position.x)] ?? -1;
}

function isInside(state: GameState, position: Position): boolean {
  return position.x >= 0 && position.y >= 0 && position.x < state.map.width && position.y < state.map.height;
}

function containsPosition(cell: Position, position: Position): boolean {
  return Math.floor(cell.x) === Math.floor(position.x) && Math.floor(cell.y) === Math.floor(position.y);
}

function sameCell(left: Position, right: Position): boolean {
  return Math.floor(left.x) === Math.floor(right.x) && Math.floor(left.y) === Math.floor(right.y);
}

function samePosition(left: Position, right: Position): boolean {
  return left.x === right.x && left.y === right.y;
}

function add(position: Position, vector: Position, amount: number): Position {
  return { x: position.x + vector.x * amount, y: position.y + vector.y * amount };
}

function distance(left: Position, right: Position): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function normalize(vector: Position): Position {
  const length = Math.hypot(vector.x, vector.y);
  return length === 0 ? { x: 0, y: 0 } : { x: vector.x / length, y: vector.y / length };
}

function hasWon(state: GameState): boolean {
  return state.totalCrates > 0 && state.clearedCrates >= state.totalCrates && state.player.alive;
}

