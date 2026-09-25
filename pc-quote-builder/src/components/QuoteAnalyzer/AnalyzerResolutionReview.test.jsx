/* @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import AnalyzerResolutionReview from "./AnalyzerResolutionReview";

afterEach(() => cleanup());

const catalog = {
  cpus: [
    { id: "cpu-1", name: "Intel Core i5-13600K" },
    { id: "cpu-2", name: "AMD Ryzen 5 7600" },
  ],
  motherboards: [{ id: "mobo-1", name: "ASUS Z790-P" }],
  ram: [{ id: "ram-1", name: "Corsair 32GB DDR5" }],
  gpus: [{ id: "gpu-1", name: "NVIDIA GeForce RTX 4060" }],
  psus: [{ id: "psu-1", name: "Corsair RM750" }],
  pcCases: [{ id: "case-1", name: "Fractal Design North" }],
};

const ROWS = [
  { id: "r-exact", product: "Intel Core i5-13600K", category: "Procesador", itemId: "cpu-1" },
  { id: "r-amb", product: "RX 7800 XT", category: "Tarjeta de video", itemId: "" },
  { id: "r-unmatched", product: "Gabinete XYZ", category: "Gabinete", itemId: "" },
  { id: "r-unsupported", product: "Audífonos", category: "Periféricos", itemId: "" },
];

const RESOLUTIONS = [
  {
    rowId: "r-exact",
    state: "exact-id",
    componentKey: "cpu",
    item: { id: "cpu-1", name: "Intel Core i5-13600K" },
  },
  {
    rowId: "r-amb",
    state: "ambiguous",
    componentKey: "gpu",
    candidates: [
      { id: "gpu-1", name: "NVIDIA GeForce RTX 4060" },
      { id: "gpu-2", name: "AMD Radeon RX 7800 XT" },
    ],
  },
  { rowId: "r-unmatched", state: "unmatched-text", componentKey: null, candidates: [] },
  { rowId: "r-unsupported", state: "unsupported-category", componentKey: null },
];

function renderReview(overrides = {}) {
  const props = {
    rows: ROWS,
    resolutions: RESOLUTIONS,
    catalog,
    onSetMapping: vi.fn(),
    onClearMapping: vi.fn(),
    excludedRowIds: [],
    onToggleExcluded: vi.fn(),
    onConfirm: vi.fn(),
    integratedGpu: false,
    ...overrides,
  };
  render(<AnalyzerResolutionReview {...props} />);
  return props;
}

describe("AnalyzerResolutionReview", () => {
  it("shows resolution progress and per-row states", () => {
    renderReview();
    expect(screen.getByText(/Componentes requeridos resueltos: 1\/6/)).toBeTruthy();
    expect(screen.getByText(/Identificado por ID/)).toBeTruthy();
    expect(screen.getByText(/Necesita confirmación/)).toBeTruthy();
    expect(screen.getByText(/Sin coincidencia/)).toBeTruthy();
    expect(screen.getByText(/Fuera de alcance/)).toBeTruthy();
  });

  it("notes the integrated-GPU coverage", () => {
    renderReview({ integratedGpu: true });
    expect(screen.getByText(/GPU cubierta por gráficos integrados/)).toBeTruthy();
  });

  it("confirms a candidate from the ambiguous list", () => {
    const props = renderReview();
    fireEvent.click(screen.getAllByRole("button", { name: "Usar este" })[0]);
    expect(props.onSetMapping).toHaveBeenCalledWith("r-amb", "gpu-1", "gpu");
  });

  it("manual search maps an unmatched row through the typeahead", () => {
    const props = renderReview();
    fireEvent.change(screen.getByLabelText("Categoría a buscar"), { target: { value: "pcCase" } });
    const combobox = screen.getByPlaceholderText("Busca Gabinete");
    fireEvent.change(combobox, { target: { value: "Fractal" } });
    fireEvent.keyDown(combobox, { key: "ArrowDown" });
    fireEvent.keyDown(combobox, { key: "Enter" });
    expect(props.onSetMapping).toHaveBeenCalledWith("r-unmatched", "case-1", "pcCase");
  });

  it("clears a user mapping", () => {
    const props = renderReview({
      resolutions: [
        ...RESOLUTIONS,
        {
          rowId: "r-mapped",
          state: "user-mapped",
          componentKey: "psu",
          item: { id: "psu-1", name: "Corsair RM750" },
        },
      ],
      rows: [...ROWS, { id: "r-mapped", product: "RM750", category: "Fuente de poder", itemId: "" }],
    });
    fireEvent.click(screen.getByRole("button", { name: "Quitar confirmación" }));
    expect(props.onClearMapping).toHaveBeenCalledWith("r-mapped");
  });

  it("excludes and re-includes a row", () => {
    const props = renderReview({ excludedRowIds: ["r-exact"] });
    expect(screen.getByText("Excluida")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Incluir de nuevo" }));
    expect(props.onToggleExcluded).toHaveBeenCalledWith("r-exact");
  });

  it("warns about duplicate resolved components", () => {
    renderReview({
      resolutions: [
        ...RESOLUTIONS,
        {
          rowId: "r-exact2",
          state: "exact-id",
          componentKey: "cpu",
          item: { id: "cpu-2", name: "AMD Ryzen 5 7600" },
        },
      ],
      rows: [...ROWS, { id: "r-exact2", product: "Ryzen 5 7600", category: "Procesador", itemId: "cpu-2" }],
    });
    expect(screen.getByText(/Múltiples filas para el mismo componente/)).toBeTruthy();
    expect(screen.getByText(/CPU tiene más de una fila resuelta/)).toBeTruthy();
  });

  it("confirms and advances to the verdict", () => {
    const props = renderReview();
    fireEvent.click(screen.getByRole("button", { name: "Continuar al veredicto" }));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });
});
