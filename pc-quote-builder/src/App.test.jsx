/* @vitest-environment jsdom */

import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
import App from "./App";
import {
  buildDefaultCatalog, buildRichCatalog, buildRichTierMaps, buildDefaultTierMaps, buildCompatMeta,
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
  };
}

afterEach(() => {
  cleanup();
  mockUseCatalog.mockReset();
  localStorage.clear();
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
      ...mockOverrides,
    });
    render(<App />);
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
      expect(screen.getByText(/CPU:/)).toBeTruthy();
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
    await waitFor(() => expect(screen.getByText("USD")).toBeTruthy());
    const radioInput = screen.getByRole("radio", { name: "USD" });
    fireEvent.click(radioInput);
    await waitFor(() => {
      const input = screen.getByLabelText("Moneda personalizada");
      expect(input.value).toBe("USD");
    });
  });
});

// ─────Quote CRUD and persistence — future work ──────────────────────────

describe("Quote CRUD and persistence", () => {
  it.todo("adds a new quote and switches to it");
  it.todo("duplicates the active quote with fresh IDs");
  it.todo("deletes the active quote and switches to the remaining one");
  it.todo("shows alert and does not delete the last quote");
  it.todo("persists quotes to localStorage on name change");
  it.todo("persists activeQuoteId to localStorage");
  it.todo("restores activeQuoteId from localStorage when valid");
  it.todo("handles empty quotes array gracefully");
  it.todo("normalizes quotes with missing fields on load");
  it.todo("persists updated quote rows to localStorage");
});

// ─────[plan 014] Builder flow — future work ──────────────────────────────

describe("[plan 014] Builder flow", () => {
  it.todo("navigates forward through steps [plan 014]");
  it.todo("navigates backward through steps [plan 014]");
  it.todo("clicking stepper chip jumps to that step [plan 014]");
  it.todo("filters motherboards by selected CPU socket [plan 014]");
  it.todo("filter RAM by selected motherboard memory type [plan 014]");
  it.todo("filter RAM by selected CPU memory type (explicit) [plan 014]");
  it.todo("filters cases by motherboard form factor [plan 014]");
  it.todo("filters cases by GPU length [plan 014]");
  it.todo("filters PSU by minimum wattage recommendation [plan 014]");
  it.todo("deselects incompatible mobo when CPU socket changes [plan 014]");
  it.todo("deselects incompatible case when mobo form factor changes [plan 014]");
  it.todo("deselects case when GPU length exceeds max [plan 014]");
  it.todo("integrated GPU toggle clears GPU selection [plan 014]");
  it.todo("integrated GPU toggle advances step when on GPU step [plan 014]");
  it.todo("clearing builder resets builder state and steps [plan 014]");
  it.todo("clearing builder does NOT reset cpuBrand/cpuFamily [plan 014]");
  it.todo("CPU brand and family filters are applied to Typeahead options [plan 014]");
  it.todo("apply builder to quote inserts selection rows [plan 014]");
  it.todo("duplicate builder selection creates new quote [plan 014]");
  it.todo("apply builder empty selection shows alert [plan 014]");
});

// ─────[plan 015] File boundaries — future work ──────────────────────────

describe("[plan 015] File boundaries — import and export", () => {
  it.todo("downloads CSV with correct headers and data rows [plan 015]");
  it.todo("downloads CSV with totals lines [plan 015]");
  it.todo("downloads JSON with quote data and totals [plan 015]");
  it.todo("imports a valid CSV file [plan 015]");
  it.todo("imports a valid JSON file with quotes array [plan 015]");
  it.todo("imports a valid JSON file with single quote object [plan 015]");
  it.todo("imports prices from CSV by itemId [plan 015]");
  it.todo("imports prices from JSON by itemId [plan 015]");
  it.todo("shows alert on successful import [plan 015]");
  it.todo("shows alert on import error [plan 015]");
  it.todo("triggers file input on import button click [plan 015]");
  it.todo("triggers price import file input [plan 015]");
  it.todo("handles empty CSV with error [plan 015]");
});
