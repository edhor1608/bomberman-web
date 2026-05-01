import { useCallback, useEffect, useMemo, useState } from "react";
import "./index.css";
import { legacyMaps, type LegacyMapInfo } from "./assets/legacyMaps";
import { parseLegacyMap, type LegacyMap } from "./game/map/legacyMapParser";
import { createRandomMap } from "./game/map/randomMap";
import { createGameState } from "./game/state/gameState";
import { reduceGame } from "./game/state/gameReducer";
import type { BombType, GameInput, GameState, Position } from "./game/state/types";
import { readHighscores, saveHighscore, type HighscoreEntry } from "./persistence/highscores";
import { BoardScene } from "./render/BoardScene";

type Screen = "menu" | "playing" | "highscores";

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [selectedMapId, setSelectedMapId] = useState<string>(legacyMaps[0].id);
  const [loadedMap, setLoadedMap] = useState<LegacyMap | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [highscores, setHighscores] = useState<readonly HighscoreEntry[]>(() => readHighscores());

  const selectedMap = useMemo(
    () => legacyMaps.find((map) => map.id === selectedMapId) ?? legacyMaps[0],
    [selectedMapId],
  );

  useEffect(() => {
    let cancelled = false;

    if (selectedMap.path === "generated:random") {
      Promise.resolve().then(() => {
        if (!cancelled) {
          const map = createRandomMap();
          setLoadedMap(map);
          setGameState(createGameState(map));
        }
      });
      return undefined;
    }

    fetch(selectedMap.path)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load ${selectedMap.path}`);
        }

        return response.text();
      })
      .then((text) => {
        if (!cancelled) {
          const map = parseLegacyMap(text, selectedMap.path);
          setLoadedMap(map);
          setGameState(createGameState(map));
        }
      })
      .catch((error: unknown) => {
        console.error(error);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMap]);

  const dispatch = useCallback(
    (input: GameInput) => {
      setGameState((current) => {
        if (current === null) {
          return current;
        }

        const next = reduceGame(current, input);
        if (current.phase !== "won" && next.phase === "won") {
          setHighscores(
            saveHighscore({
              mapId: selectedMap.id,
              mapName: selectedMap.name,
              score: next.score,
              moves: next.moves,
              elapsedMs: next.elapsedMs,
            }),
          );
        }

        return next;
      });
    },
    [selectedMap],
  );

  useEffect(() => {
    if (screen !== "playing") {
      return undefined;
    }

    const pressed = new Set<string>();
    const updateMovement = () => {
      dispatch({ type: "setMovement", vector: movementFromKeys(pressed) });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        dispatch({ type: "placeBomb" });
        return;
      }

      const bombType = bombTypeByKey[event.code];
      if (bombType !== undefined) {
        dispatch({ type: "selectBomb", bombType });
        return;
      }

      if (event.code === "Escape") {
        setScreen("menu");
        return;
      }

      if (movementKeys.has(event.code)) {
        event.preventDefault();
        pressed.add(event.code);
        updateMovement();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (movementKeys.has(event.code)) {
        pressed.delete(event.code);
        updateMovement();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      dispatch({ type: "setMovement", vector: { x: 0, y: 0 } });
    };
  }, [dispatch, screen]);

  const startGame = () => {
    if (selectedMap.path === "generated:random") {
      const map = createRandomMap();
      setLoadedMap(map);
      setGameState(reduceGame(createGameState(map), { type: "start" }));
    } else {
      dispatch({ type: "reset" });
      dispatch({ type: "start" });
    }
    setScreen("playing");
  };

  return (
    <main className="app">
      {screen === "menu" ? (
        <MainMenu
          selectedMap={selectedMap}
          selectedMapId={selectedMapId}
          onMapChange={setSelectedMapId}
          onStart={startGame}
          onHighscores={() => setScreen("highscores")}
          mapReady={loadedMap !== null}
        />
      ) : null}
      {screen === "playing" && gameState !== null ? (
        <GameScreen state={gameState} dispatch={dispatch} onExit={() => setScreen("menu")} />
      ) : null}
      {screen === "highscores" ? <HighscoresScreen highscores={highscores} onBack={() => setScreen("menu")} /> : null}
    </main>
  );
}

function MainMenu({
  selectedMap,
  selectedMapId,
  onMapChange,
  onStart,
  onHighscores,
  mapReady,
}: {
  readonly selectedMap: LegacyMapInfo;
  readonly selectedMapId: string;
  readonly onMapChange: (id: string) => void;
  readonly onStart: () => void;
  readonly onHighscores: () => void;
  readonly mapReady: boolean;
}) {
  return (
    <section className="menu-screen">
      <div className="menu-art" aria-hidden="true" />
      <div className="menu-panel">
        <p className="eyebrow">Legacy maps. Modern board.</p>
        <h1>Bomberman</h1>
        <label className="field">
          <span>Map</span>
          <select value={selectedMapId} onChange={(event) => onMapChange(event.target.value)}>
            {legacyMaps.map((map) => (
              <option key={map.id} value={map.id}>
                {map.name}
              </option>
            ))}
          </select>
        </label>
        <div className="menu-actions">
          <button type="button" onClick={onStart} disabled={!mapReady}>
            Play {selectedMap.name}
          </button>
          <button type="button" className="secondary" onClick={onHighscores}>
            Highscores
          </button>
        </div>
      </div>
    </section>
  );
}

function GameScreen({
  state,
  dispatch,
  onExit,
}: {
  readonly state: GameState;
  readonly dispatch: (input: GameInput) => void;
  readonly onExit: () => void;
}) {
  const restart = () => {
    dispatch({ type: "reset" });
    dispatch({ type: "start" });
  };

  return (
    <section className="game-screen">
      <header className="hud">
        <div>
          <strong>{state.map.source.split("/").at(-1)}</strong>
          <span>{state.phase === "won" ? "Cleared" : state.phase === "lost" ? "Lost" : "Playing"}</span>
        </div>
        <div>
          <strong>{state.score}</strong>
          <span>Score</span>
        </div>
        <div>
          <strong>
            {state.enemies.filter((enemy) => enemy.alive).length}
          </strong>
          <span>AI</span>
        </div>
        <div>
          <strong>{state.selectedBombType}</strong>
          <span>Bomb</span>
        </div>
        <button type="button" className="secondary" onClick={onExit}>
          Menu
        </button>
      </header>
      <div className="board-wrap">
        <BoardScene state={state} dispatch={dispatch} />
        {state.phase === "won" || state.phase === "lost" ? (
          <div className="result">
            <h2>{state.phase === "won" ? "Map cleared" : "You were caught in the blast"}</h2>
            <button type="button" onClick={restart}>
              Reset
            </button>
          </div>
        ) : null}
      </div>
      <footer className="controls">
        <button type="button" onPointerDown={() => move(dispatch, screenDirectionVectors.up)} onPointerUp={() => stop(dispatch)} onPointerCancel={() => stop(dispatch)} onPointerLeave={() => stop(dispatch)}>
          Up
        </button>
        <button type="button" onPointerDown={() => move(dispatch, screenDirectionVectors.left)} onPointerUp={() => stop(dispatch)} onPointerCancel={() => stop(dispatch)} onPointerLeave={() => stop(dispatch)}>
          Left
        </button>
        <button type="button" onClick={() => dispatch({ type: "placeBomb" })}>
          Bomb
        </button>
        <button type="button" onPointerDown={() => move(dispatch, screenDirectionVectors.right)} onPointerUp={() => stop(dispatch)} onPointerCancel={() => stop(dispatch)} onPointerLeave={() => stop(dispatch)}>
          Right
        </button>
        <button type="button" onPointerDown={() => move(dispatch, screenDirectionVectors.down)} onPointerUp={() => stop(dispatch)} onPointerCancel={() => stop(dispatch)} onPointerLeave={() => stop(dispatch)}>
          Down
        </button>
        <select value={state.selectedBombType} onChange={(event) => dispatch({ type: "selectBomb", bombType: event.target.value as BombType })}>
          <option value="standard">Standard</option>
          <option value="quick">Quick</option>
          <option value="mega">Mega</option>
        </select>
      </footer>
    </section>
  );
}

function move(dispatch: (input: GameInput) => void, vector: Position) {
  dispatch({ type: "setMovement", vector });
}

const movementKeys = new Set(["ArrowUp", "KeyW", "ArrowDown", "KeyS", "ArrowLeft", "KeyA", "ArrowRight", "KeyD"]);

const screenDirectionVectors = {
  up: { x: -1, y: -1 },
  down: { x: 1, y: 1 },
  left: { x: -1, y: 1 },
  right: { x: 1, y: -1 },
} as const satisfies Record<string, Position>;

const bombTypeByKey: Partial<Record<string, BombType>> = {
  Digit1: "standard",
  Digit2: "quick",
  Digit3: "mega",
};

function movementFromKeys(keys: ReadonlySet<string>): Position {
  const vector = { x: 0, y: 0 };

  if (keys.has("ArrowUp") || keys.has("KeyW")) {
    vector.x += screenDirectionVectors.up.x;
    vector.y += screenDirectionVectors.up.y;
  }
  if (keys.has("ArrowDown") || keys.has("KeyS")) {
    vector.x += screenDirectionVectors.down.x;
    vector.y += screenDirectionVectors.down.y;
  }
  if (keys.has("ArrowLeft") || keys.has("KeyA")) {
    vector.x += screenDirectionVectors.left.x;
    vector.y += screenDirectionVectors.left.y;
  }
  if (keys.has("ArrowRight") || keys.has("KeyD")) {
    vector.x += screenDirectionVectors.right.x;
    vector.y += screenDirectionVectors.right.y;
  }

  return vector;
}

function stop(dispatch: (input: GameInput) => void) {
  dispatch({ type: "setMovement", vector: { x: 0, y: 0 } });
}

function HighscoresScreen({ highscores, onBack }: { readonly highscores: readonly HighscoreEntry[]; readonly onBack: () => void }) {
  return (
    <section className="simple-screen">
      <h1>Highscores</h1>
      {highscores.length > 0 ? (
        <ol className="scores">
          {highscores.map((entry) => (
            <li key={entry.id}>
              <span>{entry.mapName}</span>
              <strong>{entry.score}</strong>
              <small>{Math.round(entry.elapsedMs / 1000)}s</small>
            </li>
          ))}
        </ol>
      ) : (
        <p>No cleared maps yet.</p>
      )}
      <button type="button" onClick={onBack}>
        Back
      </button>
    </section>
  );
}
