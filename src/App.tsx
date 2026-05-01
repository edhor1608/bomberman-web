import { useCallback, useEffect, useMemo, useState } from "react";
import "./index.css";
import { legacyMaps, type LegacyMapInfo } from "./assets/legacyMaps";
import { parseLegacyMap, type LegacyMap } from "./game/map/legacyMapParser";
import { createGameState } from "./game/state/gameState";
import { reduceGame } from "./game/state/gameReducer";
import type { Direction, GameInput, GameState } from "./game/state/types";
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

    const onKeyDown = (event: KeyboardEvent) => {
      const directionByKey: Partial<Record<string, Direction>> = {
        ArrowUp: "up",
        KeyW: "up",
        ArrowDown: "down",
        KeyS: "down",
        ArrowLeft: "left",
        KeyA: "left",
        ArrowRight: "right",
        KeyD: "right",
      };

      if (event.code === "Space") {
        event.preventDefault();
        dispatch({ type: "placeBomb" });
        return;
      }

      if (event.code === "Escape") {
        setScreen("menu");
        return;
      }

      const direction = directionByKey[event.code];
      if (direction !== undefined) {
        event.preventDefault();
        dispatch({ type: "move", direction });
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch, screen]);

  const startGame = () => {
    dispatch({ type: "reset" });
    dispatch({ type: "start" });
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
            {state.clearedCrates}/{state.totalCrates}
          </strong>
          <span>Crates</span>
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
        <button type="button" onClick={() => dispatch({ type: "move", direction: "up" })}>
          Up
        </button>
        <button type="button" onClick={() => dispatch({ type: "move", direction: "left" })}>
          Left
        </button>
        <button type="button" onClick={() => dispatch({ type: "placeBomb" })}>
          Bomb
        </button>
        <button type="button" onClick={() => dispatch({ type: "move", direction: "right" })}>
          Right
        </button>
        <button type="button" onClick={() => dispatch({ type: "move", direction: "down" })}>
          Down
        </button>
      </footer>
    </section>
  );
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
