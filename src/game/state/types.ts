import type { LegacyMap } from "../map/legacyMapParser";

export type Direction = "up" | "down" | "left" | "right";
export type Phase = "ready" | "playing" | "won" | "lost";

export type Position = {
  readonly x: number;
  readonly y: number;
};

export type Player = {
  readonly position: Position;
  readonly alive: boolean;
};

export type Bomb = {
  readonly id: string;
  readonly position: Position;
  readonly timerMs: number;
  readonly range: number;
};

export type Explosion = {
  readonly id: string;
  readonly cells: readonly Position[];
  readonly timerMs: number;
};

export type GameState = {
  readonly map: LegacyMap;
  readonly tiles: readonly (readonly number[])[];
  readonly player: Player;
  readonly bombs: readonly Bomb[];
  readonly explosions: readonly Explosion[];
  readonly phase: Phase;
  readonly score: number;
  readonly moves: number;
  readonly elapsedMs: number;
  readonly clearedCrates: number;
  readonly totalCrates: number;
};

export type GameInput =
  | { readonly type: "start" }
  | { readonly type: "move"; readonly direction: Direction }
  | { readonly type: "placeBomb" }
  | { readonly type: "tick"; readonly deltaMs: number }
  | { readonly type: "reset" };

