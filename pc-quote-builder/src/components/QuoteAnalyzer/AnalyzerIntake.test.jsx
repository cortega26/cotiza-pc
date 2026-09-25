/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import AnalyzerIntake from "./AnalyzerIntake";

afterEach(() => cleanup());

const QUOTE = {
  name: "Mi build",
  rows: [{ id: "r1" }, { id: "r2" }],
  priceUpdatedAt: "2026-07-29T00:00:00.000Z",
};

const READY_STATES = {
  cpus: "loaded",
  motherboards: "loaded",
  ram: "loaded",
  gpus: "loaded",
  psus: "loaded",
  cases: "loaded",
};

function renderIntake(overrides = {}) {
  const props = {
    quote: QUOTE,
    catalogReady: true,
    categoryStates: READY_STATES,
    catalogLoading: false,
    catalogError: "",
    fallbackUsed: false,
    contextValid: true,
    onAnalyze: vi.fn(),
    onImportFile: vi.fn(),
    onApplyPasteRows: vi.fn(),
    ...overrides,
  };
  render(<AnalyzerIntake {...props} />);
  return props;
}

describe("AnalyzerIntake", () => {
  it("shows the active quote summary and analyze button", () => {
    renderIntake();
    expect(screen.getByText(/Mi build/)).toBeTruthy();
    expect(screen.getByText(/2 fila/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Analizar cotización activa" })).toBeTruthy();
  });

  it("starts analysis on click when ready", () => {
    const props = renderIntake();
    fireEvent.click(screen.getByRole("button", { name: "Analizar cotización activa" }));
    expect(props.onAnalyze).toHaveBeenCalledTimes(1);
  });

  it("blocks analysis and explains when the catalog is not ready", () => {
    const props = renderIntake({
      catalogReady: false,
      categoryStates: { ...READY_STATES, gpus: "loading" },
    });
    expect(screen.getByRole("button", { name: "Analizar cotización activa" }).disabled).toBe(true);
    expect(screen.getByText(/no se entrega un veredicto cualificado/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Analizar cotización activa" }));
    expect(props.onAnalyze).not.toHaveBeenCalled();
  });

  it("blocks analysis and explains when the context is incomplete", () => {
    const props = renderIntake({ contextValid: false });
    expect(screen.getByRole("button", { name: "Analizar cotización activa" }).disabled).toBe(true);
    expect(screen.getByText(/Completa el contexto de compra/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Analizar cotización activa" }));
    expect(props.onAnalyze).not.toHaveBeenCalled();
  });

  it("shows per-category loading and fallback states", () => {
    renderIntake({
      catalogReady: false,
      catalogLoading: true,
      categoryStates: { ...READY_STATES, ram: "loading", psus: "fallback" },
    });
    expect(screen.getByText(/RAM: Cargando/)).toBeTruthy();
    expect(screen.getByText(/Fuente de poder: Respaldo local/)).toBeTruthy();
    expect(screen.getByText("Cargando el catálogo de referencia...")).toBeTruthy();
  });

  it("reviews pasted lines and applies them", () => {
    const props = renderIntake();
    const textarea = screen.getByLabelText("Texto estructurado para pegar");
    fireEvent.change(textarea, { target: { value: "RTX 4060\nRyzen 5 7600" } });
    fireEvent.click(screen.getByRole("button", { name: "Revisar líneas" }));
    expect(screen.getByText(/Líneas detectadas \(2\)/)).toBeTruthy();
    expect(screen.getByText("RTX 4060")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Usar estas filas en la cotización" }));
    expect(props.onApplyPasteRows).toHaveBeenCalledTimes(1);
    const applied = props.onApplyPasteRows.mock.calls[0][0];
    expect(applied.map((row) => row.product)).toEqual(["RTX 4060", "Ryzen 5 7600"]);
  });

  it("shows an error for pastes with no data rows", () => {
    const props = renderIntake();
    fireEvent.change(screen.getByLabelText("Texto estructurado para pegar"), {
      target: { value: "Producto\n" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revisar líneas" }));
    expect(screen.getByText(/no se detectaron líneas de datos/i)).toBeTruthy();
    expect(props.onApplyPasteRows).not.toHaveBeenCalled();
  });

  it("imports a file and reports failures", async () => {
    const props = renderIntake({
      onImportFile: vi.fn().mockRejectedValue(new Error("archivo inválido")),
    });
    const input = screen.getByTestId("analyzer-import-input");
    fireEvent.change(input, { target: { files: [new File(["x"], "q.csv")] } });
    await screen.findByText("archivo inválido");
    expect(props.onImportFile).toHaveBeenCalledTimes(1);
  });

  it("shows fallback and error notices for the catalog", () => {
    renderIntake({
      fallbackUsed: true,
      catalogError: "fallo de red",
    });
    expect(screen.getByText(/se usa el respaldo local/)).toBeTruthy();
  });
});
