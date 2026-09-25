import { describe, expect, it } from "vitest";
import {
  COVERAGE_SCHEMA_VERSION,
  validateCoverageCase,
} from "../../../scripts/lib/quote_analyzer_assurance.js";
import {
  SCHEMA_VERSION_INPUT,
  validateAnalyzerInput,
} from "./quoteAnalyzer/contracts";
import { resolveRows } from "./quoteAnalyzer/resolver";
import {
  COVERAGE_CASE_SCHEMA_VERSION,
  buildCoverageCase,
  summarizeCoverageCase,
} from "./coverageCase";
import {
  buildCompatMeta,
  buildRichCatalog,
  cpuIntel,
  gpuHigh,
  ramDdr5_1,
} from "../test/fixtures";

const SAMPLED_AT = "2026-09-25T12:00:00.000Z";
const CASE_ID = "COVERAGE-contract-test";

function makeAnalyzerInput() {
  return {
    schemaVersion: SCHEMA_VERSION_INPUT,
    evaluatedAt: SAMPLED_AT,
    quote: {
      id: "private-quote-id",
      name: "Cotización privada",
      currency: "CLP",
      priceUpdatedAt: "2026-09-20T12:00:00.000Z",
      rows: [
        {
          id: "private-cpu-row-id",
          category: "Procesador",
          product: cpuIntel.name,
          itemId: "cpu-old-id",
          store: "Tienda privada",
          offerPrice: 280000,
          regularPrice: 300000,
          notes: "Nota privada",
        },
        {
          id: "private-gpu-row-id",
          category: "Tarjeta de video",
          product: gpuHigh.name,
          itemId: "gpu-stale-id",
          store: "Otra tienda privada",
          offerPrice: 550000,
          regularPrice: 600000,
          notes: "Otra nota privada",
        },
        {
          id: "private-text-row-id",
          category: "RAM",
          product: ramDdr5_1.name,
          store: "Tienda privada",
          offerPrice: 90000,
          notes: "Texto libre privado",
        },
      ],
    },
    userContext: {
      useCase: "gaming",
      targetResolution: "1440p",
      budget: { amount: 1200000, currency: "CLP" },
      usesIntegratedGpu: false,
      assemblyScope: "completa",
    },
    catalog: buildRichCatalog(),
    catalogMeta: buildCompatMeta(),
    aliases: {
      "cpu-old-id": cpuIntel.id,
      "unrelated-id": ramDdr5_1.id,
    },
    explicitMappings: {
      "private-gpu-row-id": gpuHigh.id,
    },
    rulesVersion: "quote-analyzer/rules/v1",
  };
}

function makeEmptyItemIdConfirmedInput() {
  const input = makeAnalyzerInput();
  const rowId = "private-confirmed-row-id";
  return {
    ...input,
    quote: {
      ...input.quote,
      rows: [
        {
          id: rowId,
          category: "Tarjeta de video",
          product: "NVIDIA GeForce RTX 4070",
          itemId: "",
          store: "Tienda privada confirmada",
          offerPrice: 550000,
          regularPrice: 600000,
          notes: "Nota privada confirmada",
        },
      ],
    },
    explicitMappings: { [rowId]: gpuHigh.id },
  };
}

function makeCase(input = makeAnalyzerInput(), sampling) {
  return buildCoverageCase(input, {
    caseId: CASE_ID,
    sampledAt: SAMPLED_AT,
    sampling,
  });
}

describe("buildCoverageCase", () => {
  it("passes the production coverage-case validator without errors", () => {
    const coverageCase = makeCase();

    expect(validateCoverageCase(coverageCase)).toEqual([]);
    expect(coverageCase.schemaVersion).toBe(COVERAGE_SCHEMA_VERSION);
    expect(COVERAGE_CASE_SCHEMA_VERSION).toBe(COVERAGE_SCHEMA_VERSION);
  });

  it("produces an analyzer input accepted by the production validator", () => {
    const coverageCase = makeCase();

    expect(() => validateAnalyzerInput(coverageCase.analyzerInput)).not.toThrow();
  });

  it("emits exactly the seven allow-listed top-level keys", () => {
    expect(Object.keys(makeCase())).toEqual([
      "schemaVersion",
      "caseId",
      "quoteSnapshotAt",
      "elapsedMs",
      "recruitmentSource",
      "sampling",
      "analyzerInput",
    ]);
  });

  it("keeps only pseudonymous row keys in every retained row", () => {
    const rows = makeCase().analyzerInput.quote.rows;
    const allowedRowKeys = new Set(["id", "category", "itemId"]);

    for (const row of rows) {
      expect(new Set(Object.keys(row))).toEqual(allowedRowKeys);
    }
  });

  it("drops rows with neither itemId nor explicit confirmation and renumbers retained rows", () => {
    const input = makeAnalyzerInput();
    const coverageCase = makeCase(input);

    expect(input.explicitMappings).not.toHaveProperty("private-text-row-id");
    expect(coverageCase.analyzerInput.quote.rows.map((row) => row.id)).toEqual([
      "r-1",
      "r-2",
    ]);
    const serialized = JSON.stringify(coverageCase);
    for (const row of input.quote.rows) {
      expect(serialized).not.toContain(row.id);
    }
  });

  it("retains an empty-itemId row only through its explicit confirmation", () => {
    const input = makeEmptyItemIdConfirmedInput();
    const coverageCase = makeCase(input);
    const rows = coverageCase.analyzerInput.quote.rows;
    const serialized = JSON.stringify(coverageCase);

    expect(validateCoverageCase(coverageCase)).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      id: "r-1",
      category: "Tarjeta de video",
      itemId: "",
    });
    expect(coverageCase.analyzerInput.explicitMappings).toEqual({
      "r-1": gpuHigh.id,
    });
    expect(
      coverageCase.analyzerInput.catalog.gpus.some((item) => item.id === gpuHigh.id)
    ).toBe(true);
    for (const privateValue of [
      input.quote.rows[0].id,
      input.quote.rows[0].product,
      input.quote.rows[0].store,
      input.quote.rows[0].notes,
      input.quote.name,
    ]) {
      expect(serialized).not.toContain(privateValue);
    }
  });

  it("preserves user-mapped resolution parity for an empty-itemId confirmation", () => {
    const input = makeEmptyItemIdConfirmedInput();
    const coverageCase = makeCase(input);
    const fullResolution = resolveRows(input.quote.rows, input.catalog, {
      aliases: input.aliases,
      explicitMappings: input.explicitMappings,
    }).resolutions;
    const minimizedResolution = resolveRows(
      coverageCase.analyzerInput.quote.rows,
      coverageCase.analyzerInput.catalog,
      {
        aliases: coverageCase.analyzerInput.aliases,
        explicitMappings: coverageCase.analyzerInput.explicitMappings,
      }
    ).resolutions;

    expect(fullResolution).toHaveLength(1);
    expect(minimizedResolution).toHaveLength(1);
    expect(minimizedResolution[0]).toMatchObject({
      rowId: "r-1",
      state: fullResolution[0].state,
      componentKey: fullResolution[0].componentKey,
      itemId: fullResolution[0].itemId,
    });
    expect(minimizedResolution[0].state).toBe("user-mapped");
    expect(minimizedResolution[0].componentKey).toBe("gpu");
  });

  it("keeps only required catalog items and all six catalog arrays", () => {
    const { catalog } = makeCase().analyzerInput;

    expect(Object.keys(catalog)).toEqual([
      "cpus",
      "motherboards",
      "ramKits",
      "gpus",
      "psus",
      "pcCases",
    ]);
    expect(catalog.cpus.map((item) => item.id)).toEqual([cpuIntel.id]);
    expect(catalog.motherboards).toEqual([]);
    expect(catalog.ramKits).toEqual([]);
    expect(catalog.gpus.map((item) => item.id)).toEqual([gpuHigh.id]);
    expect(catalog.psus).toEqual([]);
    expect(catalog.pcCases).toEqual([]);
  });

  it("uses the fixed v1 metadata and preserves supplied sampling strings", () => {
    const sampling = {
      resolutionTarget: "1440p",
      graphics: "dedicated",
      completeness: "complete",
      budgetBand: "high",
    };
    const coverageCase = makeCase(makeAnalyzerInput(), sampling);

    expect(coverageCase.elapsedMs).toBeNull();
    expect(coverageCase.recruitmentSource).toBe("direct");
    expect(coverageCase.sampling).toEqual(sampling);
  });

  it("does not mutate the analyzer input", () => {
    const input = makeAnalyzerInput();
    const snapshot = JSON.parse(JSON.stringify(input));

    makeCase(input);

    expect(input).toEqual(snapshot);
  });

  it("produces a valid empty case when there are no retained rows", () => {
    const input = makeAnalyzerInput();
    const coverageCase = makeCase({
      ...input,
      quote: { ...input.quote, rows: [] },
    });
    const catalog = coverageCase.analyzerInput.catalog;

    expect(Object.values(catalog).every((items) => items.length === 0)).toBe(true);
    expect(validateCoverageCase(coverageCase)).toEqual([]);
  });

  it("preserves exact-id and user-mapped outcomes while anonymizing row ids", () => {
    const input = makeAnalyzerInput();
    const coverageCase = makeCase(input);
    const retainedIds = new Set(["private-cpu-row-id", "private-gpu-row-id"]);
    const fullResolutions = resolveRows(input.quote.rows, input.catalog, {
      aliases: input.aliases,
      explicitMappings: input.explicitMappings,
    }).resolutions.filter((resolution) => retainedIds.has(resolution.rowId));
    const minimizedResolutions = resolveRows(
      coverageCase.analyzerInput.quote.rows,
      coverageCase.analyzerInput.catalog,
      {
        aliases: coverageCase.analyzerInput.aliases,
        explicitMappings: coverageCase.analyzerInput.explicitMappings,
      }
    ).resolutions;

    expect(minimizedResolutions.map(({ state, componentKey }) => ({ state, componentKey }))).toEqual(
      fullResolutions.map(({ state, componentKey }) => ({ state, componentKey }))
    );
    expect(coverageCase.analyzerInput.aliases).toEqual({
      "cpu-old-id": cpuIntel.id,
    });
    expect(coverageCase.analyzerInput.explicitMappings).toEqual({
      "r-2": gpuHigh.id,
    });
    expect(summarizeCoverageCase(coverageCase)).toEqual({
      componentCount: 2,
      categories: ["Procesador", "Tarjeta de video"],
    });
  });
});
