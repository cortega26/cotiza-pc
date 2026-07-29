/* @vitest-environment jsdom */

import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import App from "./App";

vi.mock("./hooks/useCatalog", () => ({
  useCatalog: () => ({
    catalog: { cpus: [], motherboards: [], ramKits: [], gpus: [], psus: [], pcCases: [] },
    compatMeta: null,
    tierMaps: { cpu: new Map(), gpu: new Map() },
    socketSet: new Set(),
    loading: false,
    error: "",
    fallbackUsed: false,
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("App startup restore", () => {
  it("renders with default quote when localStorage is empty", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("PC Quote Builder")).toBeTruthy());
    expect(screen.getByText("Mi PC actual")).toBeTruthy();
  });

  it("restores saved quotes from localStorage", async () => {
    const savedQuotes = [
      { id: "q1", name: "Build from storage", currency: "CLP", priceUpdatedAt: "", rows: [] },
    ];
    localStorage.setItem("pcqb:quotes:v1", JSON.stringify(savedQuotes));

    render(<App />);
    await waitFor(() => expect(screen.getByText("Build from storage")).toBeTruthy());
  });

  it("falls back to default when localStorage has corrupt data", async () => {
    localStorage.setItem("pcqb:quotes:v1", "{{{corrupt}}");

    render(<App />);
    await waitFor(() => expect(screen.getByText("Mi PC actual")).toBeTruthy());
  });

  it("renders export buttons", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Descargar CSV")).toBeTruthy();
      expect(screen.getByText("Descargar JSON")).toBeTruthy();
      expect(screen.getByText("Importar CSV/JSON")).toBeTruthy();
    });
  });
});
