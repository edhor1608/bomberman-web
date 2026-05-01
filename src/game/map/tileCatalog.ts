export type TileKind = "floor" | "solid" | "crate" | "exit" | "unknown";

export type TileDefinition = {
  readonly id: number;
  readonly kind: TileKind;
  readonly label: string;
  readonly passable: boolean;
  readonly destructible: boolean;
  readonly height: number;
  readonly color: string;
};

export const tileCatalog = {
  0: {
    id: 0,
    kind: "floor",
    label: "Floor",
    passable: true,
    destructible: false,
    height: 0.08,
    color: "#29313f",
  },
  1: {
    id: 1,
    kind: "solid",
    label: "Stone",
    passable: false,
    destructible: false,
    height: 0.95,
    color: "#7b8794",
  },
  2: {
    id: 2,
    kind: "solid",
    label: "Steel",
    passable: false,
    destructible: false,
    height: 0.8,
    color: "#5f6b7a",
  },
  3: {
    id: 3,
    kind: "crate",
    label: "Crate",
    passable: false,
    destructible: true,
    height: 0.68,
    color: "#b0703c",
  },
  4: {
    id: 4,
    kind: "exit",
    label: "Exit",
    passable: true,
    destructible: false,
    height: 0.12,
    color: "#38bdf8",
  },
  10: {
    id: 10,
    kind: "crate",
    label: "Test crate",
    passable: false,
    destructible: true,
    height: 0.68,
    color: "#a16207",
  },
  100: {
    id: 100,
    kind: "crate",
    label: "Heavy crate",
    passable: false,
    destructible: true,
    height: 0.88,
    color: "#854d0e",
  },
} as const satisfies Record<number, TileDefinition>;

export function getTileDefinition(id: number): TileDefinition {
  return (
    tileCatalog[id as keyof typeof tileCatalog] ?? {
      id,
      kind: "unknown",
      label: `Unknown ${id}`,
      passable: false,
      destructible: false,
      height: 0.55,
      color: "#db2777",
    }
  );
}

