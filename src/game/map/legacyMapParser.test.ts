import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseLegacyMap } from "./legacyMapParser";

const mapsDir = join(process.cwd(), "public", "legacy", "maps");

describe("parseLegacyMap", () => {
  it("parses every bundled legacy map", () => {
    for (const file of readdirSync(mapsDir).filter((name) => name.endsWith(".map"))) {
      const map = parseLegacyMap(readFileSync(join(mapsDir, file), "utf8"), file);
      expect(map.width).toBe(16);
      expect(map.height).toBe(10);
    }
  });

  it("preserves known and unknown legacy tile ids", () => {
    const level1 = parseLegacyMap(readFileSync(join(mapsDir, "level1.map"), "utf8"), "level1.map");
    expect(new Set(level1.tiles.flat())).toEqual(new Set([0, 1, 2, 3, 4]));

    const levelTest2 = parseLegacyMap(readFileSync(join(mapsDir, "levelTest2.map"), "utf8"), "levelTest2.map");
    expect(new Set(levelTest2.tiles.flat()).has(100)).toBe(true);
  });

  it("rejects malformed maps", () => {
    expect(() => parseLegacyMap("0,1\n0", "bad.map")).toThrow("row 2 has 1 columns");
    expect(() => parseLegacyMap("0,x", "bad.map")).toThrow("cell 1:2 is not an integer");
  });
});

