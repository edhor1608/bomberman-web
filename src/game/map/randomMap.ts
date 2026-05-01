import type { LegacyMap } from "./legacyMapParser";

const width = 16;
const height = 10;

export function createRandomMap(seed = Date.now()): LegacyMap {
  const random = mulberry32(seed);
  const tiles = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        return 1;
      }

      if (isSpawnSafe(x, y)) {
        return 0;
      }

      if (x % 2 === 0 && y % 2 === 0) {
        return 2;
      }

      return random() < 0.42 ? 3 : 0;
    }),
  );

  // Keep a guaranteed connected starter route so the first seconds are never boxed in.
  for (let x = 1; x <= 6; x += 1) {
    tiles[1][x] = 0;
  }
  for (let y = 1; y <= 5; y += 1) {
    tiles[y][6] = 0;
  }

  tiles[height - 2][width - 2] = 0;
  tiles[height - 2][width - 3] = 0;
  tiles[height - 3][width - 2] = 0;

  return {
    source: `random-${seed}.map`,
    width,
    height,
    tiles,
  };
}

function isSpawnSafe(x: number, y: number): boolean {
  return (x <= 3 && y <= 3) || (x === 4 && y === 1) || (x === 1 && y === 4);
}

function mulberry32(seed: number): () => number {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let next = Math.imul(value ^ (value >>> 15), 1 | value);
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next;
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}
