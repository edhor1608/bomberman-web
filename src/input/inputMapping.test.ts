import { describe, expect, it } from "vitest";
import { bombTypeByKey, movementFromKeys, screenDirectionVectors } from "./inputMapping";

describe("input mapping", () => {
  it("maps screen-down to the board vector that moves visually down in the fixed 2.5D camera", () => {
    expect(screenDirectionVectors.down).toEqual({ x: 1, y: 1 });
    expect(movementFromKeys(new Set(["ArrowDown"]))).toEqual({ x: 1, y: 1 });
    expect(movementFromKeys(new Set(["KeyS"]))).toEqual({ x: 1, y: 1 });
  });

  it("maps number keys to working bomb types", () => {
    expect(bombTypeByKey.Digit1).toBe("standard");
    expect(bombTypeByKey.Digit2).toBe("quick");
    expect(bombTypeByKey.Digit3).toBe("mega");
  });
});

