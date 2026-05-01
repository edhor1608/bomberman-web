export type HighscoreEntry = {
  readonly id: string;
  readonly mapId: string;
  readonly mapName: string;
  readonly score: number;
  readonly moves: number;
  readonly elapsedMs: number;
  readonly createdAt: string;
};

const storageKey = "bomberman-web.highscores.v1";

export function readHighscores(): readonly HighscoreEntry[] {
  const raw = window.localStorage.getItem(storageKey);
  if (raw === null) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isHighscoreEntry).sort((a, b) => b.score - a.score || a.elapsedMs - b.elapsedMs);
  } catch {
    return [];
  }
}

export function saveHighscore(entry: Omit<HighscoreEntry, "id" | "createdAt">): readonly HighscoreEntry[] {
  const next = [
    ...readHighscores(),
    {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    },
  ]
    .sort((a, b) => b.score - a.score || a.elapsedMs - b.elapsedMs)
    .slice(0, 20);

  window.localStorage.setItem(storageKey, JSON.stringify(next));
  return next;
}

function isHighscoreEntry(value: unknown): value is HighscoreEntry {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.mapId === "string" &&
    typeof entry.mapName === "string" &&
    typeof entry.score === "number" &&
    typeof entry.moves === "number" &&
    typeof entry.elapsedMs === "number" &&
    typeof entry.createdAt === "string"
  );
}

