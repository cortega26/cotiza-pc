/* @vitest-environment jsdom */

import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import App from "./App";
import { createInMemorySink, createMeasurement } from "./lib/measurement/measurement";
import {
  buildDefaultCatalog, buildRichCatalog, buildRichTierMaps, buildDefaultTierMaps, buildCompatMeta, gpuSparse,
} from "./test/fixtures";

const { mockUseCatalog } = vi.hoisted(() => ({ mockUseCatalog: vi.fn() }));

vi.mock("./hooks/useCatalog", () => ({
  useCatalog: (...args) => mockUseCatalog(...args),
}));

function defaultMock() {
  return {
    catalog: buildDefaultCatalog(),
    compatMeta: null,
    tierMaps: buildDefaultTierMaps(),
    socketSet: new Set(),
    loading: false,
    error: "",
    fallbackUsed: false,
    categoryStates: { cpus: "loaded", motherboards: "loaded", ram: "loaded", gpus: "loaded", psus: "loaded", cases: "loaded" },
    assessmentCoverage: null,
    assessmentCoverageFailed: false,
    compatFailed: false,
  };
}

afterEach(() => {
  cleanup();
  mockUseCatalog.mockReset();
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});

beforeEach(() => {
  mockUseCatalog.mockReturnValue(defaultMock());
});

function makeQuote(overrides = {}) {
  return {
    id: "test-quote-1",
    name: "Test Quote",
    currency: "CLP",
    priceUpdatedAt: new Date().toISOString(),
    rows: [
      { id: "row-1", category: "CPU", product: "Intel i5", itemId: "", store: "Store A", offerPrice: "50000", regularPrice: "55000", notes: "" },
      { id: "row-2", category: "GPU", product: "RTX 4060", itemId: "", store: "Store B", offerPrice: "200000", regularPrice: "220000", notes: "" },
    ],
    ...overrides,
  };
}

function localStorageWithQuote(overrides = {}) {
  localStorage.setItem("pcqb:quotes:v1", JSON.stringify([makeQuote(overrides)]));
  localStorage.setItem("pcqb:activeQuoteId:v1", "test-quote-1");
}

async function renderApp() {
  render(<App />);
  await waitFor(() => expect(screen.getByText("Mi PC actual")).toBeTruthy());
}

async function switchToExpert() {
  fireEvent.click(screen.getByRole("button", { name: "Constructor experto" }));
}

// ───── Existing startup tests ────────────────────────────────────────────

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

// ─────[plan 012] Totals and row price aggregation ────────────────────────

describe("Totals and row price aggregation", () => {
  async function renderWithQuote(data) {
    localStorageWithQuote(data);
    render(<App />);
    await waitFor(() => expect(screen.getByText("Test Quote")).toBeTruthy());
  }

  it("calculates totals from row prices correctly", async () => {
    await renderWithQuote();
    const valueEls = screen.getAllByText(/^\$[\d.]+$/);
    const values = valueEls.map((el) => el.textContent);
    expect(values).toContain("$250.000");
    expect(values).toContain("$275.000");
  });

  it("shows zero totals when no prices set", async () => {
    await renderWithQuote({
      rows: [{ id: "row-1", category: "", product: "", itemId: "", store: "", offerPrice: "", regularPrice: "", notes: "" }],
      priceUpdatedAt: "",
    });
    const zeroEls = screen.getAllByText("$0");
    expect(zeroEls.length).toBeGreaterThanOrEqual(3);
  });

  it("correctly counts rowsWithPrice", async () => {
    await renderWithQuote({
      rows: [
        { id: "row-1", category: "CPU", product: "Intel", itemId: "", store: "", offerPrice: "1000", regularPrice: "", notes: "" },
        { id: "row-2", category: "GPU", product: "NVIDIA", itemId: "", store: "", offerPrice: "", regularPrice: "", notes: "" },
      ],
    });
    expect(screen.getByText("1/2")).toBeTruthy();
  });

  it("computes saving as regular minus offer", async () => {
    await renderWithQuote();
    const values = screen.getAllByText(/^\$[\d.]+$/).map((el) => el.textContent);
    expect(values).toContain("$25.000");
  });

  it("handles missing store totals gracefully when no prices exist", async () => {
    await renderWithQuote({
      rows: [{ id: "row-1", category: "", product: "", itemId: "", store: "", offerPrice: "", regularPrice: "", notes: "" }],
      priceUpdatedAt: "",
    });
    expect(screen.getByText("Aún no hay precios por tienda.")).toBeTruthy();
  });

  it("groups store totals by store name", async () => {
    await renderWithQuote();
    expect(screen.getByText("Store A")).toBeTruthy();
    expect(screen.getByText("Store B")).toBeTruthy();
  });

  it("formats currency using active quote currency", async () => {
    await renderWithQuote({ currency: "USD" });
    const values = screen.getAllByText(/^US\$/).map((el) => el.textContent);
    expect(values.some((v) => v.includes("250.000"))).toBe(true);
  });

  it("shows negative saving when offer price exceeds regular price", async () => {
    await renderWithQuote({
      rows: [
        { id: "r1", category: "CPU", product: "Intel", itemId: "", store: "X", offerPrice: "100000", regularPrice: "80000", notes: "" },
      ],
    });
    const saving = screen.getByText("$-20.000");
    expect(saving).toBeTruthy();
  });

  it("groups rows with same store into a single store total", async () => {
    await renderWithQuote({
      rows: [
        { id: "r1", category: "CPU", product: "Intel", itemId: "", store: "MegaStore", offerPrice: "10000", regularPrice: "12000", notes: "" },
        { id: "r2", category: "GPU", product: "NVIDIA", itemId: "", store: "MegaStore", offerPrice: "20000", regularPrice: "25000", notes: "" },
      ],
    });
    const storePills = screen.getAllByText("MegaStore");
    expect(storePills.length).toBe(1);
  });

  it("normalizes whitespace-only store name to 'Sin tienda'", async () => {
    await renderWithQuote({
      rows: [
        { id: "r1", category: "CPU", product: "Intel", itemId: "", store: "   ", offerPrice: "10000", regularPrice: "", notes: "" },
      ],
    });
    expect(screen.getByText("Sin tienda")).toBeTruthy();
  });
});

// ─────[plan 012] Price freshness and status indicators ───────────────────

describe("Price freshness and status indicators", () => {
  async function renderWithQuote(data) {
    localStorageWithQuote(data);
    render(<App />);
    await waitFor(() => expect(screen.getByText("Test Quote")).toBeTruthy());
  }

  it("shows 'Sin precios cargados' when no prices exist", async () => {
    await renderWithQuote({
      rows: [{ id: "row-1", category: "", product: "", itemId: "", store: "", offerPrice: "", regularPrice: "", notes: "" }],
      priceUpdatedAt: "",
    });
    expect(screen.getByText("Sin precios cargados")).toBeTruthy();
  });

  it("shows 'Faltan precios' when some rows have prices but not all", async () => {
    await renderWithQuote({
      rows: [
        { id: "row-1", category: "CPU", product: "Intel", itemId: "", store: "", offerPrice: "1000", regularPrice: "1200", notes: "" },
        { id: "row-2", category: "GPU", product: "NVIDIA", itemId: "", store: "", offerPrice: "", regularPrice: "", notes: "" },
      ],
    });
    expect(screen.getByText("Faltan precios")).toBeTruthy();
  });

  it("shows 'Precios al día' when all rows have recent prices", async () => {
    await renderWithQuote();
    expect(screen.getByText("Precios al día")).toBeTruthy();
  });

  it("shows 'Precios posiblemente desactualizados' when prices are stale", async () => {
    const staleDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
    await renderWithQuote({ priceUpdatedAt: staleDate });
    expect(screen.getByText("Precios posiblemente desactualizados")).toBeTruthy();
  });

  it("shows formatted updatedAt when priceUpdatedAt is set", async () => {
    await renderWithQuote();
    expect(screen.getByText(/Actualizado:/)).toBeTruthy();
  });

  it("shows 'Sin precios cargados' in the toolbar when no rows have prices", async () => {
    await renderWithQuote({
      rows: [{ id: "row-1", category: "", product: "", itemId: "", store: "", offerPrice: "", regularPrice: "", notes: "" }],
      priceUpdatedAt: "",
    });
    expect(screen.getByText("Sin precios cargados; agrega manualmente o importa por id.")).toBeTruthy();
  });

  it("shows toolbar info when all items have prices", async () => {
    await renderWithQuote();
    expect(screen.getByText("Todos los ítems tienen precio.")).toBeTruthy();
  });

  it("shows toolbar info when some items lack prices", async () => {
    await renderWithQuote({
      rows: [
        { id: "row-1", category: "CPU", product: "Intel", itemId: "", store: "", offerPrice: "1000", regularPrice: "1200", notes: "" },
        { id: "row-2", category: "GPU", product: "NVIDIA", itemId: "", store: "", offerPrice: "", regularPrice: "", notes: "" },
      ],
    });
    expect(screen.getByText("Faltan precios en algunos ítems.")).toBeTruthy();
  });

  it("treats invalid priceUpdatedAt as stale", async () => {
    await renderWithQuote({ priceUpdatedAt: "not-a-date" });
    expect(screen.getByText("Precios posiblemente desactualizados")).toBeTruthy();
  });

  it("shows 'Precios al día' when priceUpdatedAt is in the future", async () => {
    const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    await renderWithQuote({ priceUpdatedAt: futureDate });
    expect(screen.getByText("Precios al día")).toBeTruthy();
  });

  it("shows 'Precios al día' just under 14 day boundary (not stale)", async () => {
    const justUnder14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000 + 60000).toISOString();
    await renderWithQuote({ priceUpdatedAt: justUnder14 });
    expect(screen.getByText("Precios al día")).toBeTruthy();
  });
});

// ─────[plan 012] Builder assessment and compatibility display ────────────

describe("Builder assessment and compatibility display", () => {
  function renderWithBuilder(builderState, mockOverrides = {}) {
    localStorage.setItem("pcqb:builder:v1", JSON.stringify(builderState));
    mockUseCatalog.mockReturnValue({
      catalog: buildRichCatalog(),
      compatMeta: null,
      tierMaps: buildDefaultTierMaps(),
      socketSet: new Set(),
      loading: false,
      error: "",
      fallbackUsed: false,
      categoryStates: { cpus: "loaded", motherboards: "loaded", ram: "loaded", gpus: "loaded", psus: "loaded", cases: "loaded" },
      ...mockOverrides,
    });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Constructor experto" }));
  }

  it("shows builder summary metrics when builder state has selections", async () => {
    renderWithBuilder({
      cpuId: "cpu-1", moboId: "mobo-1", ramId: "ram-1", gpuId: "gpu-1", psuId: "psu-1", caseId: "case-1",
      useIntegratedGpu: false,
    }, { tierMaps: buildRichTierMaps(), compatMeta: buildCompatMeta() });
    await waitFor(() => {
      expect(screen.getByText("Consumo estimado")).toBeTruthy();
      expect(screen.getByText("PSU sugerida")).toBeTruthy();
      expect(screen.getByText("Margen actual")).toBeTruthy();
      expect(screen.getByText("Tier CPU")).toBeTruthy();
      expect(screen.getByText("Tier GPU")).toBeTruthy();
    });
  });

  it("shows CPU tier when CPU selection has a tier", async () => {
    renderWithBuilder({
      cpuId: "cpu-1", moboId: "", ramId: "", gpuId: "", psuId: "", caseId: "",
      useIntegratedGpu: false,
    }, { tierMaps: buildRichTierMaps() });
    await waitFor(() => {
      expect(screen.getByText("A")).toBeTruthy();
    });
  });

  it("shows compatibility issues panel when issues exist", async () => {
    renderWithBuilder({
      cpuId: "cpu-1", moboId: "mobo-2", ramId: "", gpuId: "", psuId: "", caseId: "",
      useIntegratedGpu: false,
    });
    await waitFor(() => {
      expect(screen.getByText("Compatibilidad a revisar:")).toBeTruthy();
    });
  });

  it("shows 'Todo ok' panel when builder is complete without issues", async () => {
    renderWithBuilder({
      cpuId: "cpu-1", moboId: "mobo-1", ramId: "ram-1", gpuId: "gpu-1", psuId: "psu-1", caseId: "case-1",
      useIntegratedGpu: false,
    });
    await waitFor(() => {
      expect(screen.getByText("Todo ok: sockets, RAM y potencia están alineados.")).toBeTruthy();
    });
  });

  it("shows 'Build completo' status pill when all steps are done", async () => {
    renderWithBuilder({
      cpuId: "cpu-1", moboId: "mobo-1", ramId: "ram-1", gpuId: "gpu-1", psuId: "psu-1", caseId: "case-1",
      useIntegratedGpu: false,
    });
    await waitFor(() => {
      expect(screen.getByText("Build completo")).toBeTruthy();
    });
  });

  it("shows 'Paso a paso' when builder is incomplete", async () => {
    renderWithBuilder({
      cpuId: "cpu-1", moboId: "", ramId: "", gpuId: "", psuId: "", caseId: "",
      useIntegratedGpu: false,
    });
    await waitFor(() => {
      expect(screen.getByText("Paso a paso")).toBeTruthy();
    });
  });

  it("shows selection chips when components are selected", async () => {
    renderWithBuilder({
      cpuId: "cpu-1", moboId: "", ramId: "", gpuId: "", psuId: "", caseId: "",
      useIntegratedGpu: false,
    });
    await waitFor(() => {
      expect(screen.getAllByText(/CPU:/).length).toBeGreaterThan(0);
    });
  });

  it("shows PSU requirement hint from GPU when GPU has psuMin", async () => {
    renderWithBuilder({
      cpuId: "", moboId: "", ramId: "", gpuId: "gpu-1", psuId: "", caseId: "",
      useIntegratedGpu: false,
    });
    await waitFor(() => {
      expect(screen.getByText(/La GPU sugiere/)).toBeTruthy();
    });
  });

  it("shows 'Build completo' with integrated GPU only (no dedicated GPU)", async () => {
    renderWithBuilder({
      cpuId: "cpu-1", moboId: "mobo-1", ramId: "ram-1", gpuId: "", psuId: "psu-1", caseId: "case-1",
      useIntegratedGpu: true,
    });
    await waitFor(() => {
      expect(screen.getByText("Build completo")).toBeTruthy();
      expect(screen.getByText("GPU integrada (sin dedicada)")).toBeTruthy();
    });
  });

  it("shows 'Paso a paso' when GPU step is empty and integrated GPU is off", async () => {
    renderWithBuilder({
      cpuId: "cpu-1", moboId: "mobo-1", ramId: "ram-1", gpuId: "", psuId: "psu-1", caseId: "case-1",
      useIntegratedGpu: false,
    });
    await waitFor(() => {
      expect(screen.getByText("Paso a paso")).toBeTruthy();
    });
  });

  // ─────[plan 014] Severity-based rendering ───────────────────────────────

  it("shows both issues and warnings in the fail panel when both exist", async () => {
    renderWithBuilder({
      cpuId: "cpu-1", moboId: "mobo-1", ramId: "ram-1",
      gpuId: "gpu-2", psuId: "psu-2", caseId: "case-1",
      useIntegratedGpu: false,
    });
    await waitFor(() => {
      // gpu-2 has psuMin:650, psu-2 has wattage:500 → warning
      // psu-2 has only 1x 8-pin, gpu-2 needs 2x 8-pin → fail
      expect(screen.getByText("Compatibilidad a revisar:")).toBeTruthy();
      expect(screen.getByText("Advertencias:")).toBeTruthy();
      expect(screen.getByText(/sugiere 650W y/)).toBeTruthy();
    });
  });

  it("does not show 'Todo ok' when builder has warnings", async () => {
    renderWithBuilder({
      cpuId: "cpu-1", moboId: "mobo-1", ramId: "ram-1",
      gpuId: "gpu-2", psuId: "psu-2", caseId: "case-1",
      useIntegratedGpu: false,
    });
    await waitFor(() => {
      // gpu-2 has psuMin:650, psu-2 has wattage:500 → psuMin warning
      expect(screen.queryByText("Todo ok: sockets, RAM y potencia están alineados.")).toBeNull();
      // There will be both fails (connectors) and warnings (psuMin) — at minimum no "Todo ok"
      expect(screen.getByText("Compatibilidad a revisar:")).toBeTruthy();
    });
  });

  it("shows 'Sin conflictos detectados' when no components are selected", async () => {
    renderWithBuilder({
      cpuId: "", moboId: "", ramId: "", gpuId: "", psuId: "", caseId: "",
      useIntegratedGpu: false,
    });
    // No selection → no statuses → summaryVerdict "incomplete" → shows muted "Sin conflictos detectados"
    await waitFor(() => {
      expect(screen.getByText("Sin conflictos detectados")).toBeTruthy();
    });
  });

  it("shows issue count in the muted line when there are failures", async () => {
    renderWithBuilder({
      cpuId: "cpu-1", moboId: "mobo-1", ramId: "ram-1",
      gpuId: "gpu-2", psuId: "psu-2", caseId: "case-1",
      useIntegratedGpu: false,
    });
    await waitFor(() => {
      expect(screen.getByText(/puntos a revisar/)).toBeTruthy();
    });
  });
});

// ─────[plan 012] Staged catalog demand and reload ────────────────────────

describe("Staged catalog demand and reload", () => {
  function renderWithCatalog(overrides = {}) {
    mockUseCatalog.mockReturnValue({
      catalog: buildRichCatalog(),
      compatMeta: buildCompatMeta(),
      tierMaps: buildRichTierMaps(),
      socketSet: new Set(),
      loading: false,
      error: "",
      fallbackUsed: false,
      categoryStates: { cpus: "loaded", motherboards: "loaded", ram: "loaded", gpus: "loaded", psus: "loaded", cases: "loaded" },
      ...overrides,
    });
    render(<App />);
  }

  it("shows catalog meta when compatMeta is provided", async () => {
    renderWithCatalog();
    await waitFor(() => {
      expect(screen.getByText(/Actualizado:/)).toBeTruthy();
    });
  });

  it("shows schema version when compatMeta has schemaVersion", async () => {
    renderWithCatalog();
    await waitFor(() => {
      expect(screen.getByText(/Schema: v2/)).toBeTruthy();
    });
  });

  it("shows source provenance chips", async () => {
    renderWithCatalog();
    await waitFor(() => {
      expect(screen.getByText(/Fuentes:/)).toBeTruthy();
    });
  });

  it("shows catalog error in sidebar", async () => {
    renderWithCatalog({
      compatMeta: null,
      tierMaps: buildDefaultTierMaps(),
      catalog: buildDefaultCatalog(),
      error: "Error de conexión",
      fallbackUsed: false,
    });
    await waitFor(() => {
      const hints = screen.getAllByText(/Error de conexión/);
      expect(hints.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows fallback warning when fallbackUsed is true", async () => {
    renderWithCatalog({
      compatMeta: null,
      tierMaps: buildDefaultTierMaps(),
      catalog: buildDefaultCatalog(),
      error: "Network error",
      fallbackUsed: true,
    });
    await waitFor(() => {
      const warning = screen.getByText((content, element) =>
        element.tagName === "STRONG" && content.includes("Usando catálogo local")
      );
      expect(warning).toBeTruthy();
    });
  });

  it("shows the compatibility-failure hint without catalog fallback warnings", async () => {
    renderWithCatalog({ compatFailed: true });
    await waitFor(() => {
      expect(
        screen.getByText("No se pudo cargar la compatibilidad del catálogo; se usan datos locales.")
      ).toBeTruthy();
    });
    expect(screen.queryByText(/Usando catálogo local/)).toBeNull();
    expect(screen.getByText("Catálogo cargado")).toBeTruthy();
  });

  it("reload button is disabled while catalog is loading", async () => {
    renderWithCatalog({
      loading: true,
    });
    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /cargando catálogo/i });
      expect(btn.hasAttribute("disabled")).toBe(true);
    });
  });

  it("shows 'Catálogo cargado' when not loading and no error", async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Catálogo cargado")).toBeTruthy();
    });
  });

  it("shows 'Cargando categorías...' when a needed category is not yet loaded (empty state)", async () => {
    mockUseCatalog.mockReturnValue({
      catalog: buildDefaultCatalog(),
      compatMeta: null,
      tierMaps: buildDefaultTierMaps(),
      socketSet: new Set(),
      loading: false,
      error: "",
      fallbackUsed: false,
      categoryStates: { cpus: "empty", motherboards: "empty", ram: "empty", gpus: "empty", psus: "empty", cases: "empty" },
    });
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Cargando categorías...")).toBeTruthy();
    });
  });

  it("shows singular 'Catálogo parcial' when one needed category is fallback", async () => {
    mockUseCatalog.mockReturnValue({
      catalog: buildDefaultCatalog(),
      compatMeta: null,
      tierMaps: buildDefaultTierMaps(),
      socketSet: new Set(),
      loading: false,
      error: "CPU fail",
      fallbackUsed: true,
      categoryStates: { cpus: "fallback", motherboards: "loaded", ram: "loaded", gpus: "loaded", psus: "loaded", cases: "loaded" },
    });
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText("Catálogo parcial (cpus fallback)")).toBeTruthy();
    });
  });

  it("shows plural 'Catálogo parcial' when multiple needed categories are fallback", async () => {
    mockUseCatalog.mockReturnValue({
      catalog: buildDefaultCatalog(),
      compatMeta: null,
      tierMaps: buildDefaultTierMaps(),
      socketSet: new Set(),
      loading: false,
      error: "Multiple errors",
      fallbackUsed: true,
      categoryStates: { cpus: "fallback", motherboards: "fallback", ram: "empty", gpus: "empty", psus: "empty", cases: "empty" },
    });
    render(<App />);
    // Advance to step 1 so both cpus and motherboards are needed
    switchToExpert();
    fireEvent.click(screen.getByText("Siguiente →"));
    await waitFor(() => {
      expect(screen.getByText("Catálogo parcial (2 categorías fallback)")).toBeTruthy();
    });
  });
});

// ─────[plan 012] Row operations ──────────────────────────────────────────

describe("Row operations", () => {
  it("adds a new row via the 'Agregar componente' button", async () => {
    await renderApp();
    fireEvent.click(screen.getByText("+ Agregar componente"));
    await waitFor(() => {
      expect(screen.getAllByPlaceholderText("Modelo exacto").length).toBe(2);
    });
  });

  it("removes a row via the ✕ button", async () => {
    localStorageWithQuote();
    render(<App />);
    await waitFor(() => expect(screen.getByText("Test Quote")).toBeTruthy());
    const removeBtns = screen.getAllByTitle("Eliminar fila");
    fireEvent.click(removeBtns[0]);
    await waitFor(() => {
      expect(screen.getAllByPlaceholderText("Modelo exacto").length).toBe(1);
    });
  });

  it("updates row text field on user input", async () => {
    await renderApp();
    const productInput = screen.getByPlaceholderText("Modelo exacto");
    fireEvent.change(productInput, { target: { value: "AMD Ryzen 7 7800X3D" } });
    await waitFor(() => {
      expect(productInput.value).toBe("AMD Ryzen 7 7800X3D");
    });
  });

  it("strips non-numeric characters from price input (keeps digits, dots, commas)", async () => {
    await renderApp();
    const priceInputs = screen.getAllByPlaceholderText("0");
    const offerInput = priceInputs[0];
    fireEvent.change(offerInput, { target: { value: "abc12,500.99" } });
    await waitFor(() => {
      expect(offerInput.value).toBe("12,500.99");
    });
  });

  it("sanitizes price input on regularPrice field", async () => {
    await renderApp();
    const priceInputs = screen.getAllByPlaceholderText("0");
    const regularInput = priceInputs[1];
    fireEvent.change(regularInput, { target: { value: "abc15.000def" } });
    await waitFor(() => {
      expect(regularInput.value).toBe("15.000");
    });
  });

  it("clears price input when only non-numeric characters are entered", async () => {
    await renderApp();
    const priceInputs = screen.getAllByPlaceholderText("0");
    const offerInput = priceInputs[0];
    fireEvent.change(offerInput, { target: { value: "abcxyz!@#" } });
    await waitFor(() => {
      expect(offerInput.value).toBe("");
    });
  });

  it("preserves multiple commas in price input (no comma-to-dot conversion)", async () => {
    await renderApp();
    const priceInputs = screen.getAllByPlaceholderText("0");
    const offerInput = priceInputs[0];
    fireEvent.change(offerInput, { target: { value: "12,500,99" } });
    await waitFor(() => {
      expect(offerInput.value).toBe("12,500,99");
    });
  });
});

// ─────[plan 013] Currency input and draft behavior ──────────────────────

describe("Currency input and draft behavior", () => {
  it("shows the saved currency in the custom input field", async () => {
    localStorageWithQuote({ currency: "USD" });
    render(<App />);
    await waitFor(() => {
      const input = screen.getByLabelText("Moneda personalizada");
      expect(input.value).toBe("USD");
    });
  });

  it("does not crash when typing a partial currency code", async () => {
    const { container } = render(<App />);
    await waitFor(() => expect(screen.getByText("Catálogo cargado")).toBeTruthy());
    const input = screen.getByLabelText("Moneda personalizada");
    fireEvent.change(input, { target: { value: "G" } });
    expect(container.querySelector(".totals")).toBeTruthy();
  });

  it("shows CLP by default in the currency input", async () => {
    render(<App />);
    await waitFor(() => {
      const input = screen.getByLabelText("Moneda personalizada");
      expect(input.value).toBe("CLP");
    });
  });

  it("updates currency input on preset click", async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByRole("radio", { name: "USD" })).toBeTruthy());
    const radioInput = screen.getByRole("radio", { name: "USD" });
    fireEvent.click(radioInput);
    await waitFor(() => {
      const input = screen.getByLabelText("Moneda personalizada");
      expect(input.value).toBe("USD");
    });
  });
});

// ─────Quote CRUD and persistence ─────────────────────────────────────────

describe("Quote CRUD and persistence", () => {
  function storedQuotes() {
    return JSON.parse(localStorage.getItem("pcqb:quotes:v1"));
  }

  function storedActiveId() {
    return localStorage.getItem("pcqb:activeQuoteId:v1");
  }

  function activeTab() {
    return document.querySelector(".quote-tab.active");
  }

  it("adds a new quote and switches to it", async () => {
    localStorageWithQuote();
    render(<App />);
    await waitFor(() => expect(screen.getByText("Test Quote")).toBeTruthy());

    fireEvent.click(screen.getByText("+ Nueva cotización"));

    await waitFor(() => expect(activeTab().textContent).toBe("Cotización 2"));
    expect(screen.getByLabelText("Nombre de la cotización").value).toBe("Cotización 2");
    const quotes = storedQuotes();
    expect(quotes).toHaveLength(2);
    expect(quotes[1].name).toBe("Cotización 2");
    expect(storedActiveId()).toBe(quotes[1].id);
  });

  it("duplicates the active quote with fresh row IDs", async () => {
    localStorageWithQuote();
    render(<App />);
    await waitFor(() => expect(screen.getByText("Test Quote")).toBeTruthy());

    fireEvent.click(screen.getByText("⧉ Duplicar actual"));

    await waitFor(() => expect(activeTab().textContent).toBe("Test Quote (copia)"));
    const quotes = storedQuotes();
    expect(quotes).toHaveLength(2);
    const clone = quotes[1];
    expect(clone.id).not.toBe("test-quote-1");
    expect(clone.rows).toHaveLength(2);
    clone.rows.forEach((row) => {
      expect(row.id).toBeTruthy();
      expect(["row-1", "row-2"]).not.toContain(row.id);
    });
    expect(clone.rows.map((row) => row.product)).toEqual(["Intel i5", "RTX 4060"]);
    expect(storedActiveId()).toBe(clone.id);
  });

  it("deletes the active quote and switches to the remaining one", async () => {
    localStorage.setItem(
      "pcqb:quotes:v1",
      JSON.stringify([
        makeQuote({ id: "q-first", name: "First Build", rows: [] }),
        makeQuote({ id: "q-second", name: "Second Build", rows: [] }),
      ])
    );
    localStorage.setItem("pcqb:activeQuoteId:v1", "q-second");
    render(<App />);
    await waitFor(() => expect(screen.getByLabelText("Nombre de la cotización").value).toBe("Second Build"));

    fireEvent.click(screen.getByText("🗑 Eliminar actual"));

    await waitFor(() => expect(screen.queryByText("Second Build")).toBeNull());
    expect(screen.getByLabelText("Nombre de la cotización").value).toBe("First Build");
    const quotes = storedQuotes();
    expect(quotes).toHaveLength(1);
    expect(quotes[0].id).toBe("q-first");
    expect(storedActiveId()).toBe("q-first");
  });

  it("keeps the last quote protected by a disabled delete button", async () => {
    localStorageWithQuote();
    render(<App />);
    await waitFor(() => expect(screen.getByText("Test Quote")).toBeTruthy());

    const deleteBtn = screen.getByText("🗑 Eliminar actual");
    expect(deleteBtn.disabled).toBe(true);

    fireEvent.click(deleteBtn);

    expect(storedQuotes()).toHaveLength(1);
    expect(screen.getByText("Test Quote")).toBeTruthy();
    expect(storedActiveId()).toBe("test-quote-1");
  });

  it.todo("shows alert and does not delete the last quote (bug: alert branch is unreachable because the delete button is disabled when only one quote exists)");

  it("persists the quote name change to pcqb:quotes:v1", async () => {
    localStorageWithQuote();
    render(<App />);
    await waitFor(() => expect(screen.getByText("Test Quote")).toBeTruthy());

    fireEvent.change(screen.getByLabelText("Nombre de la cotización"), { target: { value: "Renamed Build" } });

    await waitFor(() => expect(storedQuotes()[0].name).toBe("Renamed Build"));
  });

  it("persists activeQuoteId to pcqb:activeQuoteId:v1", async () => {
    localStorage.setItem(
      "pcqb:quotes:v1",
      JSON.stringify([
        makeQuote({ id: "q-a", name: "Build A", rows: [] }),
        makeQuote({ id: "q-b", name: "Build B", rows: [] }),
      ])
    );
    localStorage.setItem("pcqb:activeQuoteId:v1", "q-a");
    render(<App />);
    await waitFor(() => expect(screen.getByLabelText("Nombre de la cotización").value).toBe("Build A"));

    fireEvent.click(screen.getByText("Build B"));

    await waitFor(() => expect(storedActiveId()).toBe("q-b"));
    expect(screen.getByLabelText("Nombre de la cotización").value).toBe("Build B");
  });

  it("restores activeQuoteId from localStorage when valid", async () => {
    localStorage.setItem(
      "pcqb:quotes:v1",
      JSON.stringify([
        makeQuote({ id: "q-a", name: "Build A", rows: [] }),
        makeQuote({ id: "q-b", name: "Build B", rows: [] }),
      ])
    );
    localStorage.setItem("pcqb:activeQuoteId:v1", "q-b");
    render(<App />);

    await waitFor(() => expect(screen.getByLabelText("Nombre de la cotización").value).toBe("Build B"));
    expect(activeTab().textContent).toBe("Build B");
  });

  it("handles empty quotes array gracefully", async () => {
    localStorage.setItem("pcqb:quotes:v1", "[]");
    render(<App />);

    await waitFor(() => expect(screen.getByText("Mi PC actual")).toBeTruthy());
    expect(screen.getByLabelText("Nombre de la cotización").value).toBe("Mi PC actual");
    const quotes = storedQuotes();
    expect(quotes).toHaveLength(1);
    expect(quotes[0].rows).toHaveLength(1);
    expect(storedActiveId()).toBe(quotes[0].id);
  });

  it("normalizes quotes with missing fields on load", async () => {
    localStorage.setItem(
      "pcqb:quotes:v1",
      JSON.stringify([{ id: "legacy-1", name: "Legacy", rows: [{ product: "Old CPU" }] }])
    );
    localStorage.setItem("pcqb:activeQuoteId:v1", "legacy-1");
    render(<App />);

    await waitFor(() => expect(screen.getByLabelText("Nombre de la cotización").value).toBe("Legacy"));
    expect(screen.getByPlaceholderText("Modelo exacto").value).toBe("Old CPU");
    expect(screen.getByPlaceholderText("Tarjeta de video, RAM…").value).toBe("");
    expect(screen.getByLabelText("Moneda personalizada").value).toBe("CLP");

    const quotes = storedQuotes();
    expect(quotes[0].currency).toBe("CLP");
    expect(quotes[0].priceUpdatedAt).toBe("");
    expect(quotes[0].rows[0].id).toBeTruthy();
    expect(quotes[0].rows[0].category).toBe("");
    expect(quotes[0].rows[0].notes).toBe("");
  });

  it("persists updated quote rows to localStorage", async () => {
    localStorageWithQuote();
    render(<App />);
    await waitFor(() => expect(screen.getByText("Test Quote")).toBeTruthy());

    fireEvent.change(screen.getAllByPlaceholderText("Modelo exacto")[0], { target: { value: "Ryzen 9 7950X" } });

    await waitFor(() => expect(storedQuotes()[0].rows[0].product).toBe("Ryzen 9 7950X"));
    expect(storedQuotes()[0].rows[0].category).toBe("CPU");
  });
});

// ─────[plan 014] Builder flow ────────────────────────────────────────────

describe("[plan 014] Builder flow", () => {
  function renderWithBuilder(builderState, mockOverrides = {}) {
    localStorage.setItem("pcqb:builder:v1", JSON.stringify(builderState));
    mockUseCatalog.mockReturnValue({
      catalog: buildRichCatalog(),
      compatMeta: null,
      tierMaps: buildDefaultTierMaps(),
      socketSet: new Set(),
      loading: false,
      error: "",
      fallbackUsed: false,
      categoryStates: { cpus: "loaded", motherboards: "loaded", ram: "loaded", gpus: "loaded", psus: "loaded", cases: "loaded" },
      ...mockOverrides,
    });
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Constructor experto" }));
  }

  function activeStepName() {
    return document.querySelector(".step-chip.active")?.textContent || "";
  }

  function storedBuilder() {
    return JSON.parse(localStorage.getItem("pcqb:builder:v1"));
  }

  function openOptions(label) {
    const input = screen.getByLabelText(label);
    fireEvent.focus(input);
    return within(screen.getByRole("listbox")).getAllByRole("option");
  }

  it("navigates forward through steps [plan 014]", async () => {
    renderWithBuilder({
      cpuId: "", moboId: "", ramId: "", gpuId: "", psuId: "", caseId: "",
      useIntegratedGpu: false,
    });
    const next = screen.getByText("Siguiente →");
    expect(activeStepName()).toContain("CPU");

    fireEvent.click(next);
    expect(activeStepName()).toContain("Placa madre");
    fireEvent.click(next);
    expect(activeStepName()).toContain("RAM");
    fireEvent.click(next);
    expect(activeStepName()).toContain("GPU");
    fireEvent.click(next);
    expect(activeStepName()).toContain("Fuente");
    fireEvent.click(next);
    expect(activeStepName()).toContain("Gabinete");
    expect(next.disabled).toBe(true);
  });

  it("navigates backward through steps [plan 014]", async () => {
    renderWithBuilder({
      cpuId: "", moboId: "", ramId: "", gpuId: "", psuId: "", caseId: "",
      useIntegratedGpu: false,
    });
    const next = screen.getByText("Siguiente →");
    const prev = screen.getByText("← Anterior");
    expect(prev.disabled).toBe(true);

    fireEvent.click(next);
    fireEvent.click(next);
    expect(activeStepName()).toContain("RAM");

    fireEvent.click(prev);
    expect(activeStepName()).toContain("Placa madre");
    fireEvent.click(prev);
    expect(activeStepName()).toContain("CPU");
    expect(prev.disabled).toBe(true);
  });

  it("clicking stepper chip jumps to that step [plan 014]", async () => {
    renderWithBuilder({
      cpuId: "", moboId: "", ramId: "", gpuId: "", psuId: "", caseId: "",
      useIntegratedGpu: false,
    });
    const chips = Array.from(document.querySelectorAll(".step-chip"));

    fireEvent.click(chips.find((chip) => chip.textContent.includes("Gabinete")));

    expect(activeStepName()).toContain("Gabinete");
    expect(document.querySelector(".builder-choice.active")?.textContent).toContain("Gabinete");

    fireEvent.click(chips.find((chip) => chip.textContent.includes("Fuente")));
    expect(activeStepName()).toContain("Fuente");
  });

  it("filters motherboards by selected CPU socket [plan 014]", async () => {
    renderWithBuilder({
      cpuId: "cpu-1", moboId: "", ramId: "", gpuId: "", psuId: "", caseId: "",
      useIntegratedGpu: false,
    });

    const options = openOptions("Placa madre");
    expect(options).toHaveLength(2);
    options.forEach((opt) => expect(opt.textContent).toContain("LGA1700"));
  });
  it("filters RAM by selected motherboard memory type", async () => {
    const catalog = buildRichCatalog();
    catalog.ramKits = [
      ...catalog.ramKits,
      { id: "ram-4", name: "Kingston Fury 32GB", type: "DDR4", speed: 3200 },
    ];
    renderWithBuilder(
      {
        cpuId: "cpu-2", moboId: "mobo-2", ramId: "", gpuId: "", psuId: "", caseId: "",
        useIntegratedGpu: false,
      },
      { catalog }
    );
    const ramInput = await screen.findByLabelText("RAM");
    fireEvent.focus(ramInput);

    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options).toHaveLength(2);
    options.forEach((opt) => expect(opt.textContent).toContain("DDR5"));
  });
  it("filter RAM by selected CPU memory type (explicit) [plan 014]", async () => {
    const catalog = buildRichCatalog();
    catalog.ramKits = [
      ...catalog.ramKits,
      { id: "ram-4", name: "Kingston Fury 32GB", type: "DDR4", speed: 3200 },
    ];
    renderWithBuilder(
      {
        cpuId: "cpu-1", moboId: "", ramId: "", gpuId: "", psuId: "", caseId: "",
        useIntegratedGpu: false,
      },
      { catalog }
    );

    const options = openOptions("RAM");
    expect(options).toHaveLength(2);
    options.forEach((opt) => expect(opt.textContent).toContain("DDR5"));
  });

  it("filters cases by motherboard form factor [plan 014]", async () => {
    renderWithBuilder({
      cpuId: "cpu-1", moboId: "mobo-1", ramId: "", gpuId: "", psuId: "", caseId: "",
      useIntegratedGpu: false,
    });

    const options = openOptions("Gabinete");
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain("NZXT H510 Flow");
  });

  it("filters cases by GPU length [plan 014]", async () => {
    const catalog = buildRichCatalog();
    catalog.pcCases = [
      ...catalog.pcCases,
      { id: "case-3", name: "Tiny Cube", maxGpuLength: 200, formFactors: ["ATX"] },
    ];
    renderWithBuilder(
      {
        cpuId: "", moboId: "", ramId: "", gpuId: "gpu-2", psuId: "", caseId: "",
        useIntegratedGpu: false,
      },
      { catalog }
    );

    const options = openOptions("Gabinete");
    expect(options).toHaveLength(2);
    expect(options.map((opt) => opt.textContent)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("NZXT H510 Flow"),
        expect.stringContaining("Cooler Master NR200"),
      ])
    );
    expect(options.some((opt) => opt.textContent.includes("Tiny Cube"))).toBe(false);
  });
  it("filters PSU by minimum wattage recommendation", async () => {
    renderWithBuilder({
      cpuId: "cpu-1", moboId: "mobo-1", ramId: "ram-1", gpuId: "gpu-2", psuId: "", caseId: "case-1",
      useIntegratedGpu: false,
    });
    const psuInput = await screen.findByLabelText("Fuente");
    fireEvent.focus(psuInput);

    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain("Corsair RM750x");
  });

  it("shows all PSUs when no GPU demands extra wattage", async () => {
    renderWithBuilder({
      cpuId: "cpu-1", moboId: "mobo-1", ramId: "ram-1", gpuId: "gpu-1", psuId: "", caseId: "case-1",
      useIntegratedGpu: false,
    });
    const psuInput = await screen.findByLabelText("Fuente");
    fireEvent.focus(psuInput);

    expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(2);
  });

  it("shows 'Sin datos de consumo' and keeps low-wattage PSUs when the GPU TDP is missing", async () => {
    const catalog = buildRichCatalog();
    catalog.gpus = [...catalog.gpus, gpuSparse];
    catalog.psus = [
      ...catalog.psus,
      { id: "psu-4", name: "Genérica 150W", wattage: 150, wattage_w: 150, pcie_power_connectors: { "8_pin": 1 } },
    ];
    renderWithBuilder({
      cpuId: "cpu-1", moboId: "mobo-1", ramId: "ram-1", gpuId: "gpu-3", psuId: "", caseId: "case-1",
      useIntegratedGpu: false,
    }, { catalog });

    await waitFor(() => {
      expect(screen.getByText("Sin datos de consumo")).toBeTruthy();
    });

    const psuInput = await screen.findByLabelText("Fuente");
    fireEvent.focus(psuInput);
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options.some((opt) => opt.textContent.includes("Genérica 150W"))).toBe(true);
  });

  it("deselects incompatible mobo when CPU socket changes [plan 014]", async () => {
    renderWithBuilder({
      cpuId: "cpu-1", moboId: "mobo-1", ramId: "", gpuId: "", psuId: "", caseId: "",
      useIntegratedGpu: false,
    });
    expect(screen.getByLabelText("Placa madre").value).toBe("ASUS Z790-P");

    fireEvent.change(screen.getByLabelText("CPU"), { target: { value: "AMD Ryzen 5 7600" } });
    const option = within(screen.getByRole("listbox")).getAllByRole("option")[0];
    expect(option.textContent).toContain("AMD Ryzen 5 7600");
    fireEvent.click(option);

    await waitFor(() => expect(screen.getByLabelText("CPU").value).toBe("AMD Ryzen 5 7600"));
    expect(screen.getByLabelText("Placa madre").value).toBe("");
    expect(screen.queryByText(/Mobo:/)).toBeNull();
    expect(storedBuilder().cpuId).toBe("cpu-2");
    expect(storedBuilder().moboId).toBe("");
  });

  it("deselects incompatible case when mobo form factor changes [plan 014]", async () => {
    renderWithBuilder({
      cpuId: "", moboId: "", ramId: "", gpuId: "", psuId: "", caseId: "case-2",
      useIntegratedGpu: false,
    });
    expect(screen.getByLabelText("Gabinete").value).toBe("Cooler Master NR200");

    fireEvent.change(screen.getByLabelText("Placa madre"), { target: { value: "ASUS" } });
    const option = within(screen.getByRole("listbox")).getAllByRole("option")[0];
    expect(option.textContent).toContain("ASUS Z790-P");
    fireEvent.click(option);

    await waitFor(() => expect(screen.getByLabelText("Gabinete").value).toBe(""));
    expect(storedBuilder().moboId).toBe("mobo-1");
    expect(storedBuilder().caseId).toBe("");
    expect(screen.getByText(/Mobo:/)).toBeTruthy();
  });

  it("deselects case when GPU length exceeds max [plan 014]", async () => {
    const catalog = buildRichCatalog();
    catalog.pcCases = catalog.pcCases.map((c) => (c.id === "case-2" ? { ...c, maxGpuLength: 200 } : c));
    renderWithBuilder(
      {
        cpuId: "", moboId: "", ramId: "", gpuId: "", psuId: "", caseId: "case-2",
        useIntegratedGpu: false,
      },
      { catalog }
    );
    expect(screen.getByLabelText("Gabinete").value).toBe("Cooler Master NR200");

    fireEvent.change(screen.getByLabelText("GPU"), { target: { value: "RTX 4060" } });
    const option = within(screen.getByRole("listbox")).getAllByRole("option")[0];
    expect(option.textContent).toContain("RTX 4060");
    fireEvent.click(option);

    await waitFor(() => expect(screen.getByLabelText("Gabinete").value).toBe(""));
    expect(storedBuilder().gpuId).toBe("gpu-1");
    expect(storedBuilder().caseId).toBe("");
  });

  it("integrated GPU toggle clears GPU selection [plan 014]", async () => {
    renderWithBuilder({
      cpuId: "cpu-1", moboId: "mobo-1", ramId: "ram-1", gpuId: "gpu-1", psuId: "", caseId: "",
      useIntegratedGpu: false,
    });
    expect(screen.getByLabelText("GPU").value).toBe("NVIDIA GeForce RTX 4060");

    fireEvent.click(screen.getByLabelText("Usar GPU integrada del procesador"));

    await waitFor(() => expect(storedBuilder().gpuId).toBe(""));
    expect(storedBuilder().useIntegratedGpu).toBe(true);
    expect(screen.queryByLabelText("GPU")).toBeNull();
    expect(screen.getByText("GPU integrada (sin dedicada)")).toBeTruthy();
  });

  it("integrated GPU toggle advances step when on GPU step [plan 014]", async () => {
    renderWithBuilder({
      cpuId: "", moboId: "", ramId: "", gpuId: "", psuId: "", caseId: "",
      useIntegratedGpu: false,
    });
    const next = screen.getByText("Siguiente →");
    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.click(next);
    expect(activeStepName()).toContain("GPU");

    fireEvent.click(screen.getByLabelText("Usar GPU integrada del procesador"));

    await waitFor(() => expect(activeStepName()).toContain("Fuente"));
  });

  it("clearing builder resets builder state and steps [plan 014]", async () => {
    renderWithBuilder({
      cpuId: "cpu-1", moboId: "mobo-1", ramId: "ram-1", gpuId: "gpu-1", psuId: "psu-1", caseId: "case-1",
      useIntegratedGpu: false,
    });
    const chips = Array.from(document.querySelectorAll(".step-chip"));
    fireEvent.click(chips.find((chip) => chip.textContent.includes("Gabinete")));
    expect(activeStepName()).toContain("Gabinete");
    expect(screen.getByText(/CPU: LGA1700/)).toBeTruthy();

    fireEvent.click(screen.getByText("Limpiar selección"));

    await waitFor(() => expect(storedBuilder().caseId).toBe(""));
    expect(activeStepName()).toContain("CPU");
    expect(screen.getByLabelText("CPU").value).toBe("");
    expect(screen.getByLabelText("Placa madre").value).toBe("");
    expect(screen.getByLabelText("RAM").value).toBe("");
    expect(screen.getByLabelText("GPU").value).toBe("");
    expect(screen.getByLabelText("Fuente").value).toBe("");
    expect(screen.getByLabelText("Gabinete").value).toBe("");
    expect(screen.queryByText(/CPU: LGA1700/)).toBeNull();
    expect(screen.getByText("← Anterior").disabled).toBe(true);
  });

  it("clearing builder does NOT reset cpuBrand/cpuFamily [plan 014]", async () => {
    renderWithBuilder({
      cpuId: "", moboId: "", ramId: "", gpuId: "", psuId: "", caseId: "",
      useIntegratedGpu: false,
    });
    fireEvent.change(screen.getByLabelText("CPU"), { target: { value: "AMD Ryzen 5 7600" } });
    const option = within(screen.getByRole("listbox")).getAllByRole("option")[0];
    fireEvent.click(option);
    await waitFor(() => expect(screen.getByLabelText("Marca CPU").value).toBe("AMD"));
    expect(screen.getByLabelText("Línea").value).toBe("Ryzen 5");

    fireEvent.click(screen.getByText("Limpiar selección"));

    await waitFor(() => expect(screen.getByLabelText("CPU").value).toBe(""));
    expect(screen.getByLabelText("Marca CPU").value).toBe("AMD");
    expect(screen.getByLabelText("Línea").value).toBe("Ryzen 5");
  });
  it("applies CPU brand and family filters to typeahead options", async () => {
    renderWithBuilder({
      cpuId: "", moboId: "", ramId: "", gpuId: "", psuId: "", caseId: "",
      useIntegratedGpu: false,
    });
    const brandSelect = await screen.findByLabelText("Marca CPU");
    fireEvent.change(brandSelect, { target: { value: "AMD" } });

    const cpuInput = screen.getByLabelText("CPU");
    fireEvent.focus(cpuInput);

    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain("AMD Ryzen 5 7600");
  });

  it("applies the family filter on top of the brand filter", async () => {
    renderWithBuilder({
      cpuId: "", moboId: "", ramId: "", gpuId: "", psuId: "", caseId: "",
      useIntegratedGpu: false,
    });
    const brandSelect = await screen.findByLabelText("Marca CPU");
    fireEvent.change(brandSelect, { target: { value: "Intel" } });
    const familySelect = screen.getByLabelText("Línea");
    fireEvent.change(familySelect, { target: { value: "Core i7" } });

    const cpuInput = screen.getByLabelText("CPU");
    fireEvent.focus(cpuInput);

    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain("Intel Core i7-14700K");
  });

  it("apply builder to quote inserts selection rows [plan 014]", async () => {
    localStorageWithQuote({ rows: [] });
    renderWithBuilder({
      cpuId: "cpu-1", moboId: "mobo-1", ramId: "ram-1", gpuId: "gpu-1", psuId: "psu-1", caseId: "case-1",
      useIntegratedGpu: false,
    });
    expect(screen.getAllByPlaceholderText("Modelo exacto")).toHaveLength(1);

    fireEvent.click(screen.getByText("Aplicar selección a la cotización"));

    await waitFor(() => expect(screen.getAllByPlaceholderText("Modelo exacto")).toHaveLength(6));
    const quotes = JSON.parse(localStorage.getItem("pcqb:quotes:v1"));
    const active = quotes.find((q) => q.id === "test-quote-1");
    expect(active.rows.map((row) => row.itemId)).toEqual([
      "cpu-1", "mobo-1", "ram-1", "gpu-1", "psu-1", "case-1",
    ]);
    expect(active.rows.map((row) => row.product)).toEqual([
      "Intel Core i5-13600K", "ASUS Z790-P", "Corsair Vengeance 32GB",
      "NVIDIA GeForce RTX 4060", "Corsair RM750x", "NZXT H510 Flow",
    ]);
    expect(active.rows.map((row) => row.category)).toEqual([
      "Procesador", "Placa madre", "RAM", "Tarjeta de video", "Fuente de poder", "Gabinete",
    ]);
  });

  it("duplicate builder selection creates new quote [plan 014]", async () => {
    renderWithBuilder({
      cpuId: "cpu-1", moboId: "", ramId: "", gpuId: "", psuId: "", caseId: "",
      useIntegratedGpu: false,
    });

    fireEvent.click(screen.getByText("⧉ Duplicar selección como nueva cotización"));

    await waitFor(() => expect(document.querySelector(".quote-tab.active").textContent).toBe("Mi PC actual variante"));
    expect(screen.getByLabelText("Nombre de la cotización").value).toBe("Mi PC actual variante");
    const quotes = JSON.parse(localStorage.getItem("pcqb:quotes:v1"));
    expect(quotes).toHaveLength(2);
    const created = quotes[1];
    expect(created.priceUpdatedAt).toBe("");
    expect(created.rows).toHaveLength(1);
    expect(created.rows[0].itemId).toBe("cpu-1");
    expect(created.rows[0].product).toBe("Intel Core i5-13600K");
    expect(screen.getAllByPlaceholderText("Modelo exacto")).toHaveLength(1);
  });

  it("apply builder empty selection shows alert [plan 014]", async () => {
    localStorageWithQuote({ rows: [] });
    renderWithBuilder({
      cpuId: "", moboId: "", ramId: "", gpuId: "", psuId: "", caseId: "",
      useIntegratedGpu: false,
    });
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    fireEvent.click(screen.getByText("Aplicar selección a la cotización"));

    expect(alertSpy).toHaveBeenCalledWith("Selecciona al menos un componente en el builder.");
    const quotes = JSON.parse(localStorage.getItem("pcqb:quotes:v1"));
    expect(quotes[0].rows).toHaveLength(1);
    expect(quotes[0].rows[0].product).toBe("");
    alertSpy.mockRestore();
  });
});

// ─────[plan 015] File boundaries — future work ──────────────────────────

describe("[plan 015] File boundaries — import and export", () => {
  async function renderWithQuote() {
    localStorageWithQuote();
    render(<App />);
    await waitFor(() => expect(screen.getByText("Test Quote")).toBeTruthy());
  }

  function findFileInput() {
    return screen.getAllByTestId("import-file-input")[0];
  }

  function findPriceInput() {
    return screen.getAllByTestId("import-price-input")[0];
  }

  async function importFile(content, fileName = "test.csv") {
    const input = findFileInput();
    const file = new File([content], fileName, { type: "text/csv" });
    file.text = vi.fn().mockResolvedValue(content);
    await fireEvent.change(input, { target: { files: [file] } });
  }

  it("imports a valid CSV file and shows success alert [plan 015]", async () => {
    await renderWithQuote();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const csv = "Componente,Producto\nCPU,Ryzen 5\nGPU,RTX 4060";
    await importFile(csv, "build.csv");
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/éxito/i));
    });
    alertSpy.mockRestore();
  });

  it("imports a valid JSON file with single quote object and shows success [plan 015]", async () => {
    await renderWithQuote();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const json = JSON.stringify({ name: "JSON Import", rows: [{ category: "CPU", product: "Ryzen" }] });
    await importFile(json, "build.json");
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/éxito/i));
    });
    alertSpy.mockRestore();
  });

  it("imports a valid JSON file with quotes array [plan 015]", async () => {
    await renderWithQuote();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const json = JSON.stringify([{ name: "Import A", rows: [{ category: "CPU", product: "Ryzen" }] }]);
    await importFile(json, "builds.json");
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/éxito/i));
    });
    alertSpy.mockRestore();
  });

  it("shows error alert on invalid file content [plan 015]", async () => {
    await renderWithQuote();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    await importFile("not really csv", "bad.csv");
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/no se pudo importar/i));
    });
    alertSpy.mockRestore();
  });

  it("handles empty CSV with error [plan 015]", async () => {
    await renderWithQuote();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    await importFile("", "empty.csv");
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/no se pudo importar/i));
    });
    alertSpy.mockRestore();
  });

  it("rejects an empty JSON array import with error [plan 044]", async () => {
    await renderWithQuote();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    await importFile("[]", "empty.json");
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/no se pudo importar/i));
    });
    expect(alertSpy).not.toHaveBeenCalledWith(expect.stringMatching(/éxito/i));
    expect(JSON.parse(localStorage.getItem("pcqb:quotes:v1"))).toHaveLength(1);
    alertSpy.mockRestore();
  });

  it("rejects an empty quotes object import with error [plan 044]", async () => {
    await renderWithQuote();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    await importFile(JSON.stringify({ quotes: [] }), "empty-quotes.json");
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/no se pudo importar/i));
    });
    expect(alertSpy).not.toHaveBeenCalledWith(expect.stringMatching(/éxito/i));
    expect(JSON.parse(localStorage.getItem("pcqb:quotes:v1"))).toHaveLength(1);
    alertSpy.mockRestore();
  });

  it("triggers file input on import button click [plan 015]", async () => {
    await renderWithQuote();
    const clickSpy = vi.spyOn(findFileInput(), "click");
    fireEvent.click(screen.getByText("Importar CSV/JSON"));
    expect(clickSpy).toHaveBeenCalledOnce();
    clickSpy.mockRestore();
  });

  it("triggers price import file input [plan 015]", async () => {
    await renderWithQuote();
    const input = findPriceInput();
    const clickSpy = vi.spyOn(input, "click");
    fireEvent.click(screen.getByText("Importar precios (por id)"));
    expect(clickSpy).toHaveBeenCalledOnce();
    clickSpy.mockRestore();
  });

  it("imports prices from CSV by itemId [plan 015]", async () => {
    const quoteRows = [
      { id: "r1", category: "CPU", product: "Intel i5", itemId: "cpu-001", store: "Store A", offerPrice: "", regularPrice: "", notes: "" },
      { id: "r2", category: "GPU", product: "RTX 4060", itemId: "gpu-002", store: "Store B", offerPrice: "", regularPrice: "", notes: "" },
    ];
    localStorageWithQuote({ rows: quoteRows });
    render(<App />);
    await waitFor(() => expect(screen.getByText("Test Quote")).toBeTruthy());
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const csv = "id,offerPrice,regularPrice\ncpu-001,30000,35000\ngpu-002,180000,200000";
    const input = findPriceInput();
    const file = new File([csv], "prices.csv", { type: "text/csv" });
    file.text = vi.fn().mockResolvedValue(csv);
    await fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/precios importados/i));
    });
    alertSpy.mockRestore();
  });

  it("imports prices from JSON by itemId [plan 015]", async () => {
    const quoteRows = [
      { id: "r1", category: "CPU", product: "Intel i5", itemId: "cpu-001", store: "Store A", offerPrice: "", regularPrice: "", notes: "" },
    ];
    localStorageWithQuote({ rows: quoteRows });
    render(<App />);
    await waitFor(() => expect(screen.getByText("Test Quote")).toBeTruthy());
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const json = JSON.stringify([{ id: "cpu-001", offerPrice: "30000", regularPrice: "35000" }]);
    const input = findPriceInput();
    const file = new File([json], "prices.json", { type: "application/json" });
    file.text = vi.fn().mockResolvedValue(json);
    await fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/precios importados/i));
    });
    alertSpy.mockRestore();
  });

  describe("mobile drawer [plan 020]", () => {
    it("renders a mobile menu trigger button", async () => {
      localStorageWithQuote();
      render(<App />);
      await waitFor(() => expect(screen.getByText("Test Quote")).toBeTruthy());
      expect(screen.getByLabelText("Abrir menú lateral")).toBeTruthy();
    });

    it("opens drawer on trigger click and shows sidebar content", async () => {
      localStorageWithQuote();
      render(<App />);
      await waitFor(() => expect(screen.getByText("Test Quote")).toBeTruthy());
      const trigger = screen.getByLabelText("Abrir menú lateral");
      fireEvent.click(trigger);
      const dialog = await screen.findByRole("dialog", { name: /menú lateral/i });
      await waitFor(() => {
        expect(within(dialog).getByText("Descargar CSV")).toBeTruthy();
        expect(within(dialog).getByText("+ Nueva cotización")).toBeTruthy();
      });
    });

    it("closes drawer on Escape key", async () => {
      localStorageWithQuote();
      render(<App />);
      await waitFor(() => expect(screen.getByText("Test Quote")).toBeTruthy());
      fireEvent.click(screen.getByLabelText("Abrir menú lateral"));
      await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
    });

    it("closes drawer on backdrop click", async () => {
      localStorageWithQuote();
      render(<App />);
      await waitFor(() => expect(screen.getByText("Test Quote")).toBeTruthy());
      fireEvent.click(screen.getByLabelText("Abrir menú lateral"));
      await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
      const backdrop = document.querySelector(".mobile-drawer-backdrop");
      expect(backdrop).toBeTruthy();
      fireEvent.click(backdrop);
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
    });

    it("returns focus to trigger after closing drawer", async () => {
      localStorageWithQuote();
      render(<App />);
      await waitFor(() => expect(screen.getByText("Test Quote")).toBeTruthy());
      const trigger = screen.getByLabelText("Abrir menú lateral");
      fireEvent.click(trigger);
      await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
      await waitFor(() => {
        expect(document.activeElement).toBe(trigger);
      });
    });

    it("toggles drawer closed on second trigger click", async () => {
      localStorageWithQuote();
      render(<App />);
      await waitFor(() => expect(screen.getByText("Test Quote")).toBeTruthy());
      const trigger = screen.getByLabelText("Abrir menú lateral");
      fireEvent.click(trigger);
      await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
      fireEvent.click(trigger);
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
    });

    it("locks body scroll when drawer is open", async () => {
      localStorageWithQuote();
      render(<App />);
      await waitFor(() => expect(screen.getByText("Test Quote")).toBeTruthy());
      expect(document.body.style.overflow).toBe("");
      fireEvent.click(screen.getByLabelText("Abrir menú lateral"));
      await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
      expect(document.body.style.overflow).toBe("hidden");
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
      await waitFor(() => {
        expect(document.body.style.overflow).toBe("");
      });
    });

    it("closes drawer on resize above breakpoint", async () => {
      localStorageWithQuote();
      render(<App />);
      await waitFor(() => expect(screen.getByText("Test Quote")).toBeTruthy());
      fireEvent.click(screen.getByLabelText("Abrir menú lateral"));
      await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
      window.innerWidth = 901;
      fireEvent(window, new Event("resize"));
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
    });

    it("does not render duplicate HTML IDs for price import input", async () => {
      localStorageWithQuote();
      render(<App />);
      await waitFor(() => expect(screen.getByText("Test Quote")).toBeTruthy());
      const inputs = document.querySelectorAll('input[type="file"]');
      const ids = Array.from(inputs).map((el) => el.id).filter(Boolean);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it("opens price import trigger via ref in drawer", async () => {
      localStorageWithQuote();
      render(<App />);
      await waitFor(() => expect(screen.getByText("Test Quote")).toBeTruthy());
      fireEvent.click(screen.getByLabelText("Abrir menú lateral"));
      await waitFor(() => expect(screen.getByRole("dialog")).toBeTruthy());
      const drawer = screen.getByRole("dialog");
      const importPriceBtn = within(drawer).getByText("Importar precios (por id)");
      expect(importPriceBtn).toBeTruthy();
    });
  });
});

// ─────[plan 032] Workspace navigation ────────────────────────────────────

describe("[plan 032] Workspace navigation", () => {
  function analyzerHidden() {
    return document.querySelector(".analyzer-workspace")?.classList.contains("hidden") ?? true;
  }

  function builderHidden() {
    return document.querySelector(".builder-section")?.classList.contains("hidden") ?? true;
  }

  it("defaults to the Analyzer workspace", async () => {
    localStorageWithQuote();
    render(<App />);
    await waitFor(() => expect(screen.getByText("Cotización a evaluar")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Analizar cotización" }).getAttribute("aria-pressed")).toBe("true");
    expect(builderHidden()).toBe(true);
    expect(analyzerHidden()).toBe(false);
  });

  it("switches to the Expert Builder and back", async () => {
    localStorageWithQuote();
    render(<App />);
    await waitFor(() => expect(screen.getByText("Cotización a evaluar")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Constructor experto" }));
    await waitFor(() => expect(screen.getByText("Selecciona piezas compatibles paso a paso")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Constructor experto" }).getAttribute("aria-pressed")).toBe("true");
    expect(builderHidden()).toBe(false);
    expect(analyzerHidden()).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Analizar cotización" }));
    await waitFor(() => expect(screen.getByText("Cotización a evaluar")).toBeTruthy());
    expect(builderHidden()).toBe(true);
    expect(analyzerHidden()).toBe(false);
  });

  it("restores the mode from the URL query on load", async () => {
    localStorageWithQuote();
    window.history.replaceState({}, "", "/?modo=experto");
    render(<App />);
    await waitFor(() => expect(screen.getByText("Selecciona piezas compatibles paso a paso")).toBeTruthy());
    expect(builderHidden()).toBe(false);
    expect(analyzerHidden()).toBe(true);
  });

  it("falls back to the Analyzer for an invalid mode", async () => {
    localStorageWithQuote();
    window.history.replaceState({}, "", "/?modo=banana");
    render(<App />);
    await waitFor(() => expect(screen.getByText("Cotización a evaluar")).toBeTruthy());
    expect(analyzerHidden()).toBe(false);
  });

  it("pushes the mode into the URL and honors back/forward", async () => {
    localStorageWithQuote();
    render(<App />);
    await waitFor(() => expect(screen.getByText("Cotización a evaluar")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Constructor experto" }));
    await waitFor(() => expect(window.location.search).toContain("modo=experto"));

    window.history.back();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Analizar cotización" }).getAttribute("aria-pressed")).toBe("true")
    );
    expect(screen.getByText("Cotización a evaluar")).toBeTruthy();
  });

  it("keeps Analyzer context when toggling workspaces", async () => {
    localStorageWithQuote();
    render(<App />);
    await waitFor(() => expect(screen.getByText("Cotización a evaluar")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Resolución objetivo"), { target: { value: "1440p" } });

    fireEvent.click(screen.getByRole("button", { name: "Constructor experto" }));
    await waitFor(() => expect(screen.getByText("Selecciona piezas compatibles paso a paso")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Analizar cotización" }));
    await waitFor(() => expect(screen.getByText("Cotización a evaluar")).toBeTruthy());
    expect(screen.getByLabelText("Resolución objetivo").value).toBe("1440p");
  });
});

// ─────[plan 032] Analyzer workspace in App ───────────────────────────────

describe("[plan 032] Analyzer workspace", () => {
  function quoteWithExactIds(overrides = {}) {
    return {
      id: "analyzer-quote-1",
      name: "Quote Analyzable",
      currency: "CLP",
      priceUpdatedAt: "2026-07-29T00:00:00.000Z",
      rows: [
        { id: "a-row-cpu", category: "Procesador", product: "Intel Core i5-13600K", itemId: "cpu-1", offerPrice: "280000", regularPrice: "290000" },
        { id: "a-row-mobo", category: "Placa madre", product: "ASUS Z790-P", itemId: "mobo-1", offerPrice: "180000", regularPrice: "190000" },
        { id: "a-row-ram", category: "RAM", product: "Corsair Vengeance 32GB", itemId: "ram-1", offerPrice: "90000", regularPrice: "95000" },
        { id: "a-row-gpu", category: "Tarjeta de video", product: "AMD Radeon RX 7800 XT", itemId: "gpu-2", offerPrice: "550000", regularPrice: "580000" },
        { id: "a-row-psu", category: "Fuente de poder", product: "Corsair RM750x", itemId: "psu-1", offerPrice: "120000", regularPrice: "125000" },
        { id: "a-row-case", category: "Gabinete", product: "NZXT H510 Flow", itemId: "case-1", offerPrice: "80000", regularPrice: "85000" },
      ],
      ...overrides,
    };
  }

  function renderWithRichCatalog(extra = {}, catalogOverrides = {}) {
    localStorage.setItem("pcqb:quotes:v1", JSON.stringify([quoteWithExactIds()]));
    localStorage.setItem("pcqb:activeQuoteId:v1", "analyzer-quote-1");
    mockUseCatalog.mockReturnValue({
      catalog: buildRichCatalog(),
      compatMeta: buildCompatMeta(),
      tierMaps: buildRichTierMaps(),
      socketSet: new Set(),
      loading: false,
      error: "",
      fallbackUsed: false,
      categoryStates: { cpus: "loaded", motherboards: "loaded", ram: "loaded", gpus: "loaded", psus: "loaded", cases: "loaded" },
      assessmentCoverage: null,
      assessmentCoverageFailed: false,
      ...catalogOverrides,
    });
    return render(<App {...extra} />);
  }

  async function completeContextAndAnalyze() {
    fireEvent.change(screen.getByLabelText("Resolución objetivo"), { target: { value: "1080p" } });
    fireEvent.click(screen.getByLabelText("Usaré una GPU dedicada (o la incluyo en la cotización)"));
    fireEvent.click(screen.getByRole("button", { name: "Analizar cotización activa" }));
  }

  it("runs the full analysis flow inside the App", async () => {
    renderWithRichCatalog();
    await waitFor(() => expect(screen.getByText("Quote Analyzable")).toBeTruthy());
    await completeContextAndAnalyze();

    await waitFor(() => expect(screen.getByText(/Componentes requeridos resueltos: 6\/6/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Continuar al veredicto" }));
    await waitFor(() => expect(screen.getByText(/Veredicto/)).toBeTruthy());
  });

  it("shows the coverage-unavailable hint in the verdict", async () => {
    renderWithRichCatalog({}, { assessmentCoverageFailed: true });
    await waitFor(() => expect(screen.getByText("Quote Analyzable")).toBeTruthy());
    await completeContextAndAnalyze();
    await waitFor(() => expect(screen.getByText(/Componentes requeridos resueltos: 6\/6/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Continuar al veredicto" }));
    await waitFor(() =>
      expect(
        screen.getByText(/La cobertura de reglas del catálogo no está disponible/)
      ).toBeTruthy()
    );
    expect(screen.getByText(/Veredicto/)).toBeTruthy();
  });

  it("invalidates the analysis when Expert edits change the quote", async () => {
    renderWithRichCatalog();
    await waitFor(() => expect(screen.getByText("Quote Analyzable")).toBeTruthy());
    await completeContextAndAnalyze();
    await waitFor(() => expect(screen.getByText(/Componentes requeridos resueltos: 6\/6/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Continuar al veredicto" }));
    await waitFor(() => expect(screen.getByText(/Veredicto/)).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Constructor experto" }));
    await waitFor(() => expect(screen.getByText("Selecciona piezas compatibles paso a paso")).toBeTruthy());
    const productInput = screen.getAllByPlaceholderText("Modelo exacto")[0];
    fireEvent.change(productInput, { target: { value: "Intel Core i5-13600KF" } });

    fireEvent.click(screen.getByRole("button", { name: "Analizar cotización" }));
    await waitFor(() => expect(screen.getByText(/La cotización o el contexto cambiaron/)).toBeTruthy());
  });

  it("emits product_start once and input events per analysis", async () => {
    const sink = createInMemorySink();
    const measurement = createMeasurement({ sink: sink.sink, sessionToken: "app-test-session", sequenceStart: 0 });
    renderWithRichCatalog({ measurement });
    await waitFor(() => expect(screen.getByText("Quote Analyzable")).toBeTruthy());
    await completeContextAndAnalyze();
    await waitFor(() => expect(screen.getByText(/Componentes requeridos resueltos: 6\/6/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Continuar al veredicto" }));
    await waitFor(() => expect(screen.getByText(/Veredicto/)).toBeTruthy());

    const starts = sink.events.filter((e) => e.name === "product_start");
    const inputs = sink.events.filter((e) => e.name === "quote_input_completed");
    expect(starts).toHaveLength(1);
    expect(inputs).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Constructor experto" }));
    await waitFor(() => expect(screen.getByText("Selecciona piezas compatibles paso a paso")).toBeTruthy());
    fireEvent.change(screen.getAllByPlaceholderText("Modelo exacto")[0], { target: { value: "Intel Core i5-13600KF" } });
    fireEvent.click(screen.getByRole("button", { name: "Analizar cotización" }));
    await waitFor(() => expect(screen.getByText(/La cotización o el contexto cambiaron/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Re-analizar ahora" }));
    await waitFor(() => expect(screen.getByText(/Componentes requeridos resueltos: 6\/6/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Continuar al veredicto" }));
    await waitFor(() => expect(screen.getByText(/Veredicto/)).toBeTruthy());

    expect(sink.events.filter((e) => e.name === "product_start")).toHaveLength(1);
    expect(sink.events.filter((e) => e.name === "quote_input_completed")).toHaveLength(2);
  });
});
