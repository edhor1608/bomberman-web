export type LegacyMapInfo = {
  readonly id: string;
  readonly name: string;
  readonly path: string;
};

export const legacyMaps = [
  { id: "random", name: "Random Map", path: "generated:random" },
  { id: "level1", name: "Level 1", path: "/legacy/maps/level1.map" },
  { id: "level-empty", name: "Empty Grid", path: "/legacy/maps/levelEmpty.map" },
  { id: "level-block-1", name: "Single Block", path: "/legacy/maps/levelBlock1.map" },
  { id: "level-test-block", name: "Pattern 10", path: "/legacy/maps/levelTestBlock.map" },
  { id: "level-test-2", name: "Pattern 100", path: "/legacy/maps/levelTest2.map" },
  { id: "level-block-test-5", name: "Checkerboard", path: "/legacy/maps/levelBlockTest5.map" },
] as const satisfies readonly LegacyMapInfo[];
