import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import { getTileDefinition } from "../game/map/tileCatalog";
import type { BombType, EnemyType, ExplosionEffect, GameInput, GameState, Position } from "../game/state/types";

type BoardSceneProps = {
  readonly state: GameState;
  readonly dispatch: (input: GameInput) => void;
};

export function BoardScene({ state, dispatch }: BoardSceneProps) {
  return (
    <Canvas shadows className="board-canvas">
      <color attach="background" args={["#111827"]} />
      <OrthographicCamera makeDefault position={[7.5, 10, 11]} zoom={48} />
      <ambientLight intensity={0.75} />
      <directionalLight castShadow position={[5, 10, 6]} intensity={1.8} shadow-mapSize={[1024, 1024]} />
      <GameTicker dispatch={dispatch} />
      <Board state={state} />
      <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} />
    </Canvas>
  );
}

function GameTicker({ dispatch }: { readonly dispatch: (input: GameInput) => void }) {
  useFrame((_, delta) => {
    dispatch({ type: "tick", deltaMs: Math.min(delta * 1000, 80) });
  });

  return null;
}

function Board({ state }: { readonly state: GameState }) {
  const offsetX = -(state.map.width - 1) / 2;
  const offsetZ = -(state.map.height - 1) / 2;

  return (
    <group position={[offsetX, 0, offsetZ]}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[(state.map.width - 1) / 2, -0.06, (state.map.height - 1) / 2]}>
        <planeGeometry args={[state.map.width + 1.2, state.map.height + 1.2]} />
        <meshStandardMaterial color="#172033" />
      </mesh>
      {state.tiles.map((row, y) =>
        row.map((tile, x) => <TileMesh key={`${x}-${y}-${tile}`} position={{ x: x + 0.5, y: y + 0.5 }} tile={tile} />),
      )}
      {state.bombs.map((bomb) => (
        <BombMesh key={bomb.id} position={bomb.position} type={bomb.type} />
      ))}
      {state.explosions.flatMap((explosion) =>
        explosion.cells.map((cell) => <ExplosionMesh key={`${explosion.id}-${cell.x}-${cell.y}`} position={cell} effect={explosion.effect} />),
      )}
      {state.enemies
        .filter((enemy) => enemy.alive)
        .map((enemy) => (
          <EnemyMesh key={enemy.id} position={enemy.position} type={enemy.type} stunned={enemy.stunnedMs > 0} />
        ))}
      <PlayerMesh position={state.player.position} alive={state.player.alive} />
    </group>
  );
}

function TileMesh({ position, tile }: { readonly position: Position; readonly tile: number }) {
  const definition = getTileDefinition(tile);
  const height = definition.height;

  return (
    <group position={[position.x, 0, position.y]}>
      <mesh receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[0.98, 0.08, 0.98]} />
        <meshStandardMaterial color="#263244" roughness={0.9} />
      </mesh>
      {definition.kind !== "floor" && definition.kind !== "exit" ? (
        <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
          <boxGeometry args={[0.82, height, 0.82]} />
          <meshStandardMaterial color={definition.color} roughness={0.72} metalness={definition.kind === "solid" ? 0.12 : 0} />
        </mesh>
      ) : null}
      {definition.kind === "exit" ? (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.33, 32]} />
          <meshStandardMaterial color={definition.color} emissive={definition.color} emissiveIntensity={0.45} />
        </mesh>
      ) : null}
    </group>
  );
}

function PlayerMesh({ position, alive }: { readonly position: Position; readonly alive: boolean }) {
  const color = alive ? "#f8fafc" : "#991b1b";

  return (
    <group position={[position.x, 0.25, position.y]}>
      <mesh castShadow position={[0, 0.25, 0]}>
        <capsuleGeometry args={[0.22, 0.38, 8, 16]} />
        <meshStandardMaterial color={color} roughness={0.45} />
      </mesh>
      <mesh castShadow position={[0.15, 0.72, -0.12]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color="#f59e0b" />
      </mesh>
    </group>
  );
}

function BombMesh({ position, type }: { readonly position: Position; readonly type: BombType }) {
  const colorByType = {
    standard: "#080808",
    quick: "#2563eb",
    mega: "#7f1d1d",
  } as const satisfies Record<BombType, string>;
  const scaleByType = {
    standard: [1, 1, 1],
    quick: [0.78, 0.78, 0.78],
    mega: [1.25, 1.25, 1.25],
  } as const satisfies Record<BombType, readonly [number, number, number]>;

  return (
    <mesh castShadow position={[position.x, 0.34, position.y]} scale={scaleByType[type]}>
      <sphereGeometry args={[0.28, 24, 24]} />
      <meshStandardMaterial color={colorByType[type]} roughness={0.28} metalness={0.35} />
    </mesh>
  );
}

function EnemyMesh({ position, type, stunned }: { readonly position: Position; readonly type: EnemyType; readonly stunned: boolean }) {
  const color = stunned ? "#60a5fa" : type === "bomber" ? "#f97316" : "#dc2626";

  return (
    <mesh castShadow position={[position.x, 0.32, position.y]}>
      {type === "bomber" ? <dodecahedronGeometry args={[0.34, 0]} /> : <boxGeometry args={[0.48, 0.56, 0.48]} />}
      <meshStandardMaterial color={color} roughness={0.5} />
    </mesh>
  );
}

function ExplosionMesh({ position, effect }: { readonly position: Position; readonly effect: ExplosionEffect }) {
  const material = useMemo(
    () =>
      effect === "stun"
        ? { color: "#60a5fa", emissive: "#2563eb", emissiveIntensity: 1.3 }
        : { color: "#fb923c", emissive: "#f97316", emissiveIntensity: 1.4 },
    [effect],
  );

  return (
    <mesh position={[position.x, 0.16, position.y]}>
      {effect === "stun" ? <cylinderGeometry args={[0.44, 0.44, 0.12, 24]} /> : <boxGeometry args={[0.88, 0.18, 0.88]} />}
      <meshStandardMaterial {...material} transparent opacity={0.82} />
    </mesh>
  );
}
