export type LegacyMap = {
  readonly source: string;
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly (readonly number[])[];
};

export function parseLegacyMap(text: string, source = "unknown.map"): LegacyMap {
  const rows = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(",").map((cell) => cell.trim()));

  if (rows.length === 0 || rows[0]?.length === 0 || rows[0]?.[0] === "") {
    throw new Error(`${source}: map is empty`);
  }

  const width = rows[0].length;
  const tiles = rows.map((row, rowIndex) => {
    if (row.length !== width) {
      throw new Error(`${source}: row ${rowIndex + 1} has ${row.length} columns, expected ${width}`);
    }

    return row.map((cell, columnIndex) => {
      if (!/^-?\d+$/.test(cell)) {
        throw new Error(`${source}: cell ${rowIndex + 1}:${columnIndex + 1} is not an integer`);
      }

      return Number(cell);
    });
  });

  return {
    source,
    width,
    height: tiles.length,
    tiles,
  };
}

