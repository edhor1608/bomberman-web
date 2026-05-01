import { getTileDefinition } from "../map/tileCatalog";
import { createGameState } from "./gameState";
import type { BombOwner, BombType, Direction, Enemy, Explosion, GameInput, GameState, Position } from "./types";

const explosionMs = 520;
const playerSpeed = 4.2;
const enemySpeed = 2.15;
const actorRadius = 0.28;
const enemyTouchRadius = 0.48;
const stunMs = 1700;

const bombConfigs = {
  standard: { fuseMs: 1800, range: 3, limit: 1, score: 100, shape: "cross", effect: "damage", destroysBlocks: true },
  quick: { fuseMs: 750, range: 1, limit: 2, score: 0, shape: "radius", effect: "stun", destroysBlocks: false },
  mega: { fuseMs: 2400, range: 5, limit: 1, score: 140, shape: "cross", effect: "damage", destroysBlocks: true },
} as const satisfies Record<
  BombType,
  {
    readonly fuseMs: number;
    readonly range: number;
    readonly limit: number;
    readonly score: number;
    readonly shape: "cross" | "radius";
    readonly effect: "damage" | "stun";
    readonly destroysBlocks: boolean;
  }
>;

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
  const position = getBombPlacement(state);

  if (state.phase !== "playing" || activeOfType >= config.limit) {
    return state;
  }

  if (state.bombs.some((bomb) => sameCell(bomb.position, position))) {
    return state;
  }

  return addBomb(state, state.selectedBombType, position, "player");
}

function getBombPlacement(state: GameState): Position {
  const playerCell = snapToCellCenter(state.player.position);
  const movement = state.input;
  const target = movement.x !== 0 || movement.y !== 0 ? snapToCellCenter(add(playerCell, dominantAxis(movement), 1)) : playerCell;
  const candidates = [target, playerCell] satisfies readonly Position[];

  return candidates.find((candidate) => canPlaceBombAt(state, candidate)) ?? playerCell;
}

function canPlaceBombAt(state: GameState, position: Position): boolean {
  return (
    isInside(state, position) &&
    getTileDefinition(tileAt(state, position)).passable &&
    !state.bombs.some((bomb) => sameCell(bomb.position, position))
  );
}

function updateEnemies(state: GameState, deltaMs: number): GameState {
  let nextState = state;
  const enemies = state.enemies.map((enemy) => {
    if (!enemy.alive) {
      return enemy;
    }

    if (enemy.stunnedMs > 0) {
      return { ...enemy, stunnedMs: Math.max(0, enemy.stunnedMs - deltaMs), bombCooldownMs: Math.max(0, enemy.bombCooldownMs - deltaMs) };
    }

    let nextEnemy = { ...enemy, bombCooldownMs: Math.max(0, enemy.bombCooldownMs - deltaMs) };
    if (nextEnemy.type === "bomber" && nextEnemy.bombCooldownMs <= 0 && distance(nextEnemy.position, nextState.player.position) <= 4.25) {
      const bombPosition = snapToCellCenter(nextEnemy.position);
      const withBomb = addBomb(nextState, "standard", bombPosition, "enemy");
      if (withBomb !== nextState) {
        nextState = withBomb;
        nextEnemy = { ...nextEnemy, bombCooldownMs: 2600 };
      }
    }

    const nextThinkMs = nextEnemy.thinkMs - deltaMs;
    const direction = nextThinkMs <= 0 ? chooseEnemyDirection(nextState, nextEnemy) : nextEnemy.direction;
    const position = moveWithCollision(nextState, nextEnemy.position, direction, (deltaMs / 1000) * enemySpeed);
    const stuck = samePosition(position, nextEnemy.position);

    return {
      ...nextEnemy,
      position,
      direction: stuck ? chooseEnemyDirection(nextState, nextEnemy) : direction,
      thinkMs: stuck || nextThinkMs <= 0 ? 450 + ((nextState.elapsedMs + nextEnemy.id.length * 97) % 700) : nextThinkMs,
    };
  });

  return { ...nextState, enemies };
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
  const config = bombConfigs[bomb.type];
  const cells = getExplosionCells(state, bomb.position, bomb.range, config.shape);
  let cleared = 0;
  const tiles = state.tiles.map((row, y) =>
    row.map((tile, x) => {
      if (!cells.some((cell) => sameCell(cell, { x: x + 0.5, y: y + 0.5 }))) {
        return tile;
      }

      if (config.destroysBlocks && getTileDefinition(tile).destructible) {
        cleared += 1;
        return 0;
      }

      return tile;
    }),
  );

  const explosion: Explosion = {
    id: `explosion-${bomb.id}`,
    effect: config.effect,
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
  const damageExplosions = state.explosions.filter((explosion) => explosion.effect === "damage");
  const stunExplosions = state.explosions.filter((explosion) => explosion.effect === "stun");
  const playerInExplosion = damageExplosions.some((explosion) => explosion.cells.some((cell) => containsPosition(cell, state.player.position)));
  const enemyTouchedPlayer = state.enemies.some(
    (enemy) => enemy.alive && enemy.stunnedMs <= 0 && distance(enemy.position, state.player.position) <= enemyTouchRadius,
  );
  const enemiesKilled = state.enemies.filter(
    (enemy) => enemy.alive && damageExplosions.some((explosion) => explosion.cells.some((cell) => containsPosition(cell, enemy.position))),
  ).length;
  const enemies = state.enemies.map((enemy) => {
    if (damageExplosions.some((explosion) => explosion.cells.some((cell) => containsPosition(cell, enemy.position)))) {
      return { ...enemy, alive: false };
    }

    if (stunExplosions.some((explosion) => explosion.cells.some((cell) => containsPosition(cell, enemy.position)))) {
      return { ...enemy, stunnedMs: Math.max(enemy.stunnedMs, stunMs) };
    }

    return enemy;
  });

  return {
    ...state,
    enemies,
    score: state.score + enemiesKilled * 250,
    player: playerInExplosion || enemyTouchedPlayer ? { ...state.player, alive: false } : state.player,
    phase: playerInExplosion || enemyTouchedPlayer ? "lost" : state.phase,
  };
}

function getExplosionCells(state: GameState, origin: Position, range: number, shape: "cross" | "radius"): readonly Position[] {
  const cells: Position[] = [snapToCellCenter(origin)];
  if (shape === "radius") {
    for (let y = -range; y <= range; y += 1) {
      for (let x = -range; x <= range; x += 1) {
        if (Math.abs(x) + Math.abs(y) > range || (x === 0 && y === 0)) {
          continue;
        }

        const cursor = { x: cells[0].x + x, y: cells[0].y + y };
        if (isInside(state, cursor) && getTileDefinition(tileAt(state, cursor)).passable) {
          cells.push(cursor);
        }
      }
    }

    return cells;
  }

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

function addBomb(state: GameState, type: BombType, position: Position, owner: BombOwner): GameState {
  const config = bombConfigs[type];
  if (!canPlaceBombAt(state, position)) {
    return state;
  }

  return {
    ...state,
    bombs: [
      ...state.bombs,
      {
        id: `${owner}-bomb-${type}-${state.elapsedMs}-${position.x}-${position.y}`,
        type,
        owner,
        position,
        timerMs: config.fuseMs,
        range: config.range,
      },
    ],
  };
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

  return checks.every((check) => isInside(state, check) && getTileDefinition(tileAt(state, check)).passable);
}

function dominantAxis(vector: Position): Position {
  return Math.abs(vector.x) >= Math.abs(vector.y) ? { x: Math.sign(vector.x), y: 0 } : { x: 0, y: Math.sign(vector.y) };
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
