import type { LegacyMap } from "../map/legacyMapParser";

export type Direction = "up" | "down" | "left" | "right";
export type Phase = "ready" | "playing" | "won" | "lost";
export type BombType = "standard" | "quick" | "mega";
export type BombOwner = "player" | "enemy";
export type ExplosionEffect = "damage" | "stun";
export type EnemyType = "chaser" | "bomber";

export type Position = {
  readonly x: number;
  readonly y: number;
};

export type Player = {
  readonly position: Position;
  readonly alive: boolean;
};

export type Enemy = {
  readonly id: string;
  readonly type: EnemyType;
  readonly position: Position;
  readonly direction: Position;
  readonly thinkMs: number;
  readonly stunnedMs: number;
  readonly bombCooldownMs: number;
  readonly alive: boolean;
};

export type Bomb = {
  readonly id: string;
  readonly type: BombType;
  readonly owner: BombOwner;
  readonly position: Position;
  readonly timerMs: number;
  readonly range: number;
};

export type Explosion = {
  readonly id: string;
  readonly effect: ExplosionEffect;
  readonly cells: readonly Position[];
  readonly timerMs: number;
};

export type GameState = {
  readonly map: LegacyMap;
  readonly tiles: readonly (readonly number[])[];
  readonly player: Player;
  readonly input: Position;
  readonly selectedBombType: BombType;
  readonly bombs: readonly Bomb[];
  readonly enemies: readonly Enemy[];
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
  | { readonly type: "setMovement"; readonly vector: Position }
  | { readonly type: "selectBomb"; readonly bombType: BombType }
  | { readonly type: "placeBomb" }
  | { readonly type: "tick"; readonly deltaMs: number }
  | { readonly type: "reset" };
