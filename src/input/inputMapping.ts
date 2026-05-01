import type { BombType, Position } from "../game/state/types";

export const movementKeys = new Set(["ArrowUp", "KeyW", "ArrowDown", "KeyS", "ArrowLeft", "KeyA", "ArrowRight", "KeyD"]);

export const screenDirectionVectors = {
  up: { x: -1, y: -1 },
  down: { x: 1, y: 1 },
  left: { x: -1, y: 1 },
  right: { x: 1, y: -1 },
} as const satisfies Record<string, Position>;

export const bombTypeByKey: Partial<Record<string, BombType>> = {
  Digit1: "standard",
  Digit2: "quick",
  Digit3: "mega",
};

export function movementFromKeys(keys: ReadonlySet<string>): Position {
  const vector = { x: 0, y: 0 };

  if (keys.has("ArrowUp") || keys.has("KeyW")) {
    vector.x += screenDirectionVectors.up.x;
    vector.y += screenDirectionVectors.up.y;
  }
  if (keys.has("ArrowDown") || keys.has("KeyS")) {
    vector.x += screenDirectionVectors.down.x;
    vector.y += screenDirectionVectors.down.y;
  }
  if (keys.has("ArrowLeft") || keys.has("KeyA")) {
    vector.x += screenDirectionVectors.left.x;
    vector.y += screenDirectionVectors.left.y;
  }
  if (keys.has("ArrowRight") || keys.has("KeyD")) {
    vector.x += screenDirectionVectors.right.x;
    vector.y += screenDirectionVectors.right.y;
  }

  return vector;
}

