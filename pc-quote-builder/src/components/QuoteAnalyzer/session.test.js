import { describe, expect, it } from "vitest";
import {
  analysisSignature,
  coverageNoteFor,
  isAnalyzerContextValid,
  isCatalogReadyForAnalysis,
  requiredResolutionCounts,
  resolutionOutcomeFor,
  validMappingsFor,
} from "./session";
import { cpuIntel, gpuLow } from "../../test/fixtures";
import { buildCatalogIndex } from "../../lib/quoteAnalyzer/resolver";

const catalog = {
  cpus: [cpuIntel],
  motherboards: [],
  ramKits: [],
  gpus: [gpuLow],
  psus: [],
  pcCases: [],
};

describe("isAnalyzerContextValid", () => {
  it("requires a resolution and an explicit integrated-GPU answer", () => {
    expect(isAnalyzerContextValid({ targetResolution: "1080p", usesIntegratedGpu: true })).toBe(true);
    expect(isAnalyzerContextValid({ targetResolution: "1440p", usesIntegratedGpu: false })).toBe(true);
    expect(isAnalyzerContextValid({ targetResolution: "4k", usesIntegratedGpu: false })).toBe(true);
    expect(isAnalyzerContextValid({ targetResolution: "", usesIntegratedGpu: false })).toBe(false);
    expect(isAnalyzerContextValid({ targetResolution: "1080p", usesIntegratedGpu: null })).toBe(false);
    expect(isAnalyzerContextValid({ targetResolution: "720p", usesIntegratedGpu: true })).toBe(false);
    expect(isAnalyzerContextValid(null)).toBe(false);
    expect(isAnalyzerContextValid({})).toBe(false);
  });
});

describe("isCatalogReadyForAnalysis", () => {
  it("requires all six categories loaded or fallback", () => {
    const allLoaded = { cpus: "loaded", motherboards: "loaded", ram: "loaded", gpus: "loaded", psus: "loaded", cases: "loaded" };
    expect(isCatalogReadyForAnalysis(allLoaded)).toBe(true);
    expect(isCatalogReadyForAnalysis({ ...allLoaded, cpus: "fallback" })).toBe(true);
    expect(isCatalogReadyForAnalysis({ ...allLoaded, gpus: "loading" })).toBe(false);
    expect(isCatalogReadyForAnalysis({ ...allLoaded, ram: "empty" })).toBe(false);
    expect(isCatalogReadyForAnalysis({ cpus: "loaded" })).toBe(false);
    expect(isCatalogReadyForAnalysis(null)).toBe(false);
  });
});

describe("validMappingsFor", () => {
  const rows = [
    { id: "r1", category: "Procesador", product: "Intel i5", itemId: "" },
    { id: "r2", category: "Procesador", product: "Intel i7", itemId: "" },
  ];

  it("keeps valid entries and drops stale product or category", () => {
    const mappings = {
      r1: { itemId: "cpu-1", product: "Intel i5", category: "Procesador", componentKey: "cpu" },
    };
    const valid = validMappingsFor(rows, mappings, catalog);
    expect(valid.r1.itemId).toBe("cpu-1");

    const changedProduct = validMappingsFor(
      [{ ...rows[0], product: "Intel i9" }, rows[1]],
      mappings,
      catalog
    );
    expect(changedProduct.r1).toBeUndefined();

    const changedCategory = validMappingsFor(
      [{ ...rows[0], category: "RAM" }, rows[1]],
      mappings,
      catalog
    );
    expect(changedCategory.r1).toBeUndefined();
  });

  it("drops entries whose item no longer exists in the catalog", () => {
    const mappings = {
      r1: { itemId: "vanished", product: "Intel i5", category: "Procesador", componentKey: "cpu" },
    };
    expect(validMappingsFor(rows, mappings, catalog)).toEqual({});
  });

  it("ignores mappings for unknown rows and non-object inputs", () => {
    expect(validMappingsFor(rows, { ghost: { itemId: "cpu-1" } }, catalog)).toEqual({});
    expect(validMappingsFor(rows, null, catalog)).toEqual({});
    expect(validMappingsFor(null, {}, catalog)).toEqual({});
  });

  it("yields the same map with and without a prebuilt catalog index", () => {
    const indexedRows = [
      ...rows,
      { id: "r3", category: "Procesador", product: "Intel Xeon", itemId: "" },
    ];
    const mappings = {
      r1: { itemId: "cpu-1", product: "Intel i5", category: "Procesador", componentKey: "cpu" },
      r2: { itemId: "vanished", product: "Intel i7", category: "Procesador", componentKey: "cpu" },
      r3: { itemId: "cpu-1", product: "Intel Xeon", category: "Procesador", componentKey: "ghost" },
    };
    const index = buildCatalogIndex(catalog);
    const withIndex = validMappingsFor(indexedRows, mappings, catalog, index);
    const withoutIndex = validMappingsFor(indexedRows, mappings, catalog);
    expect(withIndex).toEqual(withoutIndex);
    expect(withIndex.r1.itemId).toBe("cpu-1");
    expect(withIndex.r2).toBeUndefined();
    expect(withIndex.r3).toBeUndefined();
  });

  it("validates indexed mappings against sparse catalog lists", () => {
    const sparseCatalog = { ...catalog, cpus: [null, undefined, cpuIntel] };
    const mappings = {
      r1: { itemId: "cpu-1", product: "Intel i5", category: "Procesador", componentKey: "cpu" },
    };
    expect(validMappingsFor(rows, mappings, sparseCatalog, buildCatalogIndex(sparseCatalog))).toEqual(
      validMappingsFor(rows, mappings, sparseCatalog)
    );
    expect(
      validMappingsFor(rows, mappings, sparseCatalog, buildCatalogIndex(sparseCatalog)).r1.itemId
    ).toBe("cpu-1");
  });
});

describe("analysisSignature", () => {
  const quote = {
    id: "q1",
    currency: "CLP",
    priceUpdatedAt: "2026-07-20T00:00:00.000Z",
    rows: [{ id: "r1", category: "Procesador", product: "Intel i5", itemId: "", offerPrice: "", regularPrice: "" }],
  };
  const context = { targetResolution: "1080p", usesIntegratedGpu: false, assemblyScope: "full", budget: null };
  const base = () => analysisSignature(quote, context, {}, [], "gen-1");

  it("changes when quote id, rows, context, mappings, exclusions, or catalog change", () => {
    const baseSig = base();
    expect(analysisSignature({ ...quote, id: "q2" }, context, {}, [], "gen-1")).not.toBe(baseSig);
    expect(
      analysisSignature({ ...quote, rows: [{ ...quote.rows[0], product: "Intel i7" }] }, context, {}, [], "gen-1")
    ).not.toBe(baseSig);
    expect(analysisSignature(quote, { ...context, targetResolution: "1440p" }, {}, [], "gen-1")).not.toBe(baseSig);
    expect(analysisSignature(quote, context, { r1: { itemId: "cpu-1" } }, [], "gen-1")).not.toBe(baseSig);
    expect(analysisSignature(quote, context, {}, ["r1"], "gen-1")).not.toBe(baseSig);
    expect(analysisSignature(quote, context, {}, [], "gen-2")).not.toBe(baseSig);
    expect(base()).toBe(baseSig);
  });

  it("changes when the quote currency changes", () => {
    expect(analysisSignature({ ...quote, currency: "USD" }, context, {}, [], "gen-1")).not.toBe(base());
  });

  it("changes when the quote price freshness changes", () => {
    expect(
      analysisSignature({ ...quote, priceUpdatedAt: "2026-07-01T00:00:00.000Z" }, context, {}, [], "gen-1")
    ).not.toBe(base());
  });
});

describe("requiredResolutionCounts and resolutionOutcomeFor", () => {
  const resolutions = [
    { rowId: "a", componentKey: "cpu", state: "exact-id" },
    { rowId: "b", componentKey: "mobo", state: "user-mapped" },
    { rowId: "c", componentKey: "ram", state: "ambiguous" },
  ];

  it("counts required components once, never per row", () => {
    const dupes = [
      ...resolutions,
      { rowId: "d", componentKey: "cpu", state: "exact-id" },
    ];
    const counts = requiredResolutionCounts(dupes, false);
    expect(counts).toEqual({ exact: 1, confirmed: 1, remaining: 4 });
  });

  it("treats integrated graphics as satisfying the GPU requirement", () => {
    const counts = requiredResolutionCounts(resolutions, true);
    expect(counts.remaining).toBe(3);
  });

  it("maps counts to outcomes", () => {
    expect(resolutionOutcomeFor(6, 0, 0)).toBe("all-resolved");
    expect(resolutionOutcomeFor(0, 0, 6)).toBe("none");
    expect(resolutionOutcomeFor(2, 1, 3)).toBe("partial");
  });
});

describe("coverageNoteFor", () => {
  const manifest = {
    dimensions: {
      "compat-cpu-mobo-socket": { combinations: { assessable: 10, total: 100 } },
      "power-psu-headroom": { combinations: { assessable: 0, total: 0 } },
    },
  };

  it("returns a note only when the manifest has assessable combinations", () => {
    expect(coverageNoteFor({ id: "compat-cpu-mobo-socket" }, manifest)).toContain("10 de 100");
    expect(coverageNoteFor({ id: "power-psu-headroom" }, manifest)).toBeNull();
    expect(coverageNoteFor({ id: "unknown-finding" }, manifest)).toBeNull();
    expect(coverageNoteFor({ id: "x" }, null)).toBeNull();
  });
});
