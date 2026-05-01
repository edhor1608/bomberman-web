import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

describe("App", () => {
  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      configurable: true,
    });
  });

  it("renders the menu and opens the working highscores screen", async () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Bomberman" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Play Random Map" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Highscores" }));

    expect(screen.getByRole("heading", { name: "Highscores" })).toBeInTheDocument();
    expect(screen.getByText("No cleared maps yet.")).toBeInTheDocument();
  });
});
