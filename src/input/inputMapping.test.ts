import { describe, expect, it } from "vitest";
import { bombTypeByKey, movementFromKeys, screenDirectionVectors } from "./inputMapping";

describe("input mapping", () => {
  it("maps screen-down to the board vector that moves visually down in the fixed 2.5D camera", () => {
    expect(screenDirectionVectors.down.x).toBeCloseTo(0.3383236550709802);
    expect(screenDirectionVectors.down.y).toBeCloseTo(0.4962080274374376);
    expect(movementFromKeys(new Set(["ArrowDown"]))).toEqual(screenDirectionVectors.down);
    expect(movementFromKeys(new Set(["KeyS"]))).toEqual(screenDirectionVectors.down);
  });

  it("keeps screen axes as opposing pairs for predictable key combinations", () => {
    expect(screenDirectionVectors.up.x).toBeCloseTo(-screenDirectionVectors.down.x);
    expect(screenDirectionVectors.up.y).toBeCloseTo(-screenDirectionVectors.down.y);
    expect(screenDirectionVectors.left.x).toBeCloseTo(-screenDirectionVectors.right.x);
    expect(screenDirectionVectors.left.y).toBeCloseTo(-screenDirectionVectors.right.y);
  });

  it("maps number keys to working bomb types", () => {
    expect(bombTypeByKey.Digit1).toBe("standard");
    expect(bombTypeByKey.Digit2).toBe("quick");
    expect(bombTypeByKey.Digit3).toBe("mega");
  });
});
