import { describe, expect, it } from "vitest";
import { getTileDefinition } from "./tileCatalog";
import { createRandomMap } from "./randomMap";

describe("createRandomMap", () => {
  it("keeps the initial movement area open", () => {
    const map = createRandomMap(42);
    const openCells = [
      [1, 1],
      [2, 1],
      [3, 1],
      [1, 2],
      [2, 2],
      [1, 3],
      [4, 1],
      [5, 1],
      [6, 1],
      [6, 2],
    ] as const;

    for (const [x, y] of openCells) {
      expect(getTileDefinition(map.tiles[y]?.[x] ?? -1).passable).toBe(true);
    }
  });
});

