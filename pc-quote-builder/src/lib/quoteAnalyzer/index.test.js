import { describe, expect, it } from "vitest";
import {
  caseAtx,
  cpuAmd,
  cpuIntel,
  cpuIntelHigh,
  cpuSparse,
  gpuHigh,
  gpuLow,
  gpuSparse,
  moboLga,
  psu500,
  psu750,
  psuMarginal,
  ramDdr5_1,
} from "../../test/fixtures";
import { parseCsvToQuote } from "../csvParser";
import { RULES_VERSION, SCHEMA_VERSION_OUTPUT } from "./contracts";
import { analyzeQuote } from "./index";

const EVALUATED_AT = "2026-07-31T00:00:00.000Z";
const CATALOG_GENERATED_AT = "2026-07-29T00:00:00.000Z";

const row = (overrides = {}) => ({
  id: "r-1",
  category: "Procesador",
  product: "Intel Core i5-13600K",
  itemId: "cpu-1",
  store: "Tienda",
  offerPrice: "399.990",
  regularPrice: "",
  notes: "",
  ...overrides,
});

function buildInput(overrides = {}) {
  const input = {
    schemaVersion: "quote-analyzer/input/v1",
    evaluatedAt: EVALUATED_AT,
    quote: {
      id: "q-1",
      name: "Cotización de prueba",
      currency: "CLP",
      priceUpdatedAt: EVALUATED_AT,
      rows: [
        row({ id: "r-cpu" }),
        row({ id: "r-mobo", category: "Placa madre", itemId: "mobo-1" }),
        row({ id: "r-ram", category: "RAM", itemId: "ram-1" }),
        row({ id: "r-gpu", category: "Tarjeta de video", itemId: "gpu-1" }),
        row({ id: "r-psu", category: "Fuente de poder", itemId: "psu-1" }),
        row({ id: "r-case", category: "Gabinete", itemId: "case-1" }),
      ],
    },
    userContext: { useCase: "gaming", targetResolution: "1080p", budget: null, usesIntegratedGpu: null },
    catalog: {
      cpus: [cpuIntel, cpuAmd, cpuIntelHigh, cpuSparse],
      motherboards: [moboLga],
      ramKits: [ramDdr5_1],
      gpus: [gpuLow, gpuHigh, gpuSparse],
      psus: [psu750, psuMarginal, psu500],
      pcCases: [caseAtx],
      meta: { generatedAt: CATALOG_GENERATED_AT },
    },
    catalogMeta: { generatedAt: CATALOG_GENERATED_AT, schemaVersion: 2 },
    aliases: null,
  };
  return {
    ...input,
    ...overrides,
    quote: { ...input.quote, ...(overrides.quote || {}), rows: overrides.quote?.rows || input.quote.rows },
  };
}

const findingIds = (output) => output.findings.map((f) => f.id);
const findingsBy = (output) => Object.fromEntries(output.findings.map((f) => [f.id, f]));

const withNormalizedTimestamps = (output) => {
  const clone = structuredClone(output);
  clone.generatedAt = "__GENERATED__";
  for (const finding of clone.findings) {
    finding.evidence.freshness.catalogGeneratedAt = "__CATALOG__";
    finding.evidence.freshness.quotePriceUpdatedAt = "__QUOTE__";
    if (finding.id === "price-freshness-catalog") finding.conclusion = "__AGE__";
  }
  clone.sources.catalogGeneratedAt = "__CATALOG__";
  clone.sources.quotePriceUpdatedAt = "__QUOTE__";
  clone.sources.rulesVersion = "__RULES__";
  return clone;
};

describe("quoteAnalyzer — F1-F7 integration via analyzeQuote", () => {
  it("F1: exact-id valid quote yields verdict ok", () => {
    const output = analyzeQuote(buildInput());
    expect(output.schemaVersion).toBe(SCHEMA_VERSION_OUTPUT);
    expect(output.generatedAt).toBe(EVALUATED_AT);
    expect(output.verdict.overall).toBe("ok");
    expect(output.integratedGpu).toBe(false);
    expect(output.resolution).toEqual({
      "r-cpu": "exact-id",
      "r-mobo": "exact-id",
      "r-ram": "exact-id",
      "r-gpu": "exact-id",
      "r-psu": "exact-id",
      "r-case": "exact-id",
    });
    for (const dimension of ["compatibility", "completeness", "power", "connectors", "caseFit", "priceFreshness", "priceCompleteness"]) {
      expect(output.dimensions[dimension].status).toBe("ok");
      expect(output.dimensions[dimension].summary).toBeTruthy();
      expect(Array.isArray(output.dimensions[dimension].findingIds)).toBe(true);
    }
    expect(findingIds(output)).toEqual(["price-freshness-catalog"]);
    expect(output.sources).toEqual({
      catalogGeneratedAt: CATALOG_GENERATED_AT,
      quotePriceUpdatedAt: EVALUATED_AT,
      rulesVersion: RULES_VERSION,
    });
    for (const finding of output.findings) {
      expect(finding.evidence.freshness.catalogGeneratedAt).toBe(CATALOG_GENERATED_AT);
      expect(finding.evidence.freshness.quotePriceUpdatedAt).toBe(EVALUATED_AT);
      expect(finding.evidence.ruleVersion).toBe(RULES_VERSION);
    }
  });

  it("F2: confirmed incompatible socket pair yields verdict fail", () => {
    const output = analyzeQuote(buildInput({
      quote: {
        rows: [
          row({ id: "r-cpu", itemId: "cpu-2" }),
          row({ id: "r-mobo", category: "Placa madre", itemId: "mobo-1" }),
          row({ id: "r-ram", category: "RAM", itemId: "ram-1" }),
          row({ id: "r-gpu", category: "Tarjeta de video", itemId: "gpu-1" }),
          row({ id: "r-psu", category: "Fuente de poder", itemId: "psu-1" }),
          row({ id: "r-case", category: "Gabinete", itemId: "case-1" }),
        ],
      },
    }));
    expect(output.verdict.overall).toBe("fail");
    expect(output.dimensions.compatibility.status).toBe("fail");
    const finding = findingsBy(output)["compat-cpu-mobo-socket"];
    expect(finding).toBeDefined();
    expect(finding.severity).toBe("critical");
    expect(finding.decisionType).toBe("deterministic");
    expect(finding.confidence).toBe("high");
    expect(finding.evidence.sourceFields).toEqual(["cpu.socket", "mobo.socket"]);
    expect(finding.evidence.source).toBe("catalog");
    expect(finding.action).toMatch(/Reemplazar/);
  });

  it("F3: marginal PSU yields a warning-only verdict", () => {
    const output = analyzeQuote(buildInput({
      quote: {
        rows: [
          row({ id: "r-cpu" }),
          row({ id: "r-mobo", category: "Placa madre", itemId: "mobo-1" }),
          row({ id: "r-ram", category: "RAM", itemId: "ram-1" }),
          row({ id: "r-gpu", category: "Tarjeta de video", itemId: "gpu-2" }),
          row({ id: "r-psu", category: "Fuente de poder", itemId: "psu-3" }),
          row({ id: "r-case", category: "Gabinete", itemId: "case-1" }),
        ],
      },
    }));
    expect(output.verdict.overall).toBe("warning");
    expect(output.dimensions.power.status).toBe("warning");
    expect(output.dimensions.connectors.status).toBe("ok");
    const finding = findingsBy(output)["power-psu-headroom"];
    expect(finding.severity).toBe("warning");
    expect(finding.decisionType).toBe("derived");
    expect(output.findings.filter((f) => f.severity === "critical")).toEqual([]);
  });

  it("F4: sparse TDP records and no price date yield unknown, never ok", () => {
    const output = analyzeQuote(buildInput({
      quote: {
        priceUpdatedAt: undefined,
        rows: [
          row({ id: "r-cpu", itemId: "cpu-4" }),
          row({ id: "r-mobo", category: "Placa madre", itemId: "mobo-1" }),
          row({ id: "r-ram", category: "RAM", itemId: "ram-1" }),
          row({ id: "r-gpu", category: "Tarjeta de video", itemId: "gpu-3" }),
          row({ id: "r-psu", category: "Fuente de poder", itemId: "psu-1" }),
          row({ id: "r-case", category: "Gabinete", itemId: "case-1" }),
        ],
      },
    }));
    expect(output.verdict.overall).toBe("unknown");
    expect(output.dimensions.power.status).toBe("unknown");
    expect(output.dimensions.priceFreshness.status).toBe("unknown");
    const power = findingsBy(output)["power-psu-headroom"];
    expect(power.decisionType).toBe("unsupported");
    expect(power.confidence).toBe("low");
    expect(power.severity).toBe("info");
    const freshness = findingsBy(output)["price-freshness-age"];
    expect(freshness.severity).toBe("warning");
    expect(freshness.decisionType).toBe("unsupported");
    expect(freshness.confidence).toBe("low");
    expect(output.sources.quotePriceUpdatedAt).toBeNull();
  });

  it("F5: ambiguous CPU text stays unresolved and never names a product", () => {
    const output = analyzeQuote(buildInput({
      quote: {
        rows: [
          row({ id: "r-cpu", itemId: "", product: "Intel Core" }),
          row({ id: "r-mobo", category: "Placa madre", itemId: "mobo-1" }),
          row({ id: "r-ram", category: "RAM", itemId: "ram-1" }),
          row({ id: "r-gpu", category: "Tarjeta de video", itemId: "gpu-1" }),
          row({ id: "r-psu", category: "Fuente de poder", itemId: "psu-1" }),
          row({ id: "r-case", category: "Gabinete", itemId: "case-1" }),
        ],
      },
    }));
    expect(output.verdict.overall).toBe("unknown");
    expect(output.resolution["r-cpu"]).toBe("ambiguous");
    expect(output.resolution["r-mobo"]).toBe("exact-id");
    const gap = findingsBy(output)["completeness-required-resolution-gap"];
    expect(gap.affected).toEqual(["cpu", "r-cpu"]);
    expect(output.findings.filter((f) => f.dimension === "compatibility")).toEqual([]);
    const serialized = JSON.stringify(output);
    expect(serialized).not.toContain("i5-13600K");
    expect(serialized).not.toContain("i7-14700K");
  });

  it("F6: stale and partial prices yield warnings but ok technical dimensions", () => {
    const output = analyzeQuote(buildInput({
      quote: {
        priceUpdatedAt: "2026-07-11T00:00:00.000Z",
        rows: [
          row({ id: "r-cpu" }),
          row({ id: "r-mobo", category: "Placa madre", itemId: "mobo-1" }),
          row({ id: "r-ram", category: "RAM", itemId: "ram-1", offerPrice: "" }),
          row({ id: "r-gpu", category: "Tarjeta de video", itemId: "gpu-1", offerPrice: "" }),
          row({ id: "r-psu", category: "Fuente de poder", itemId: "psu-1", offerPrice: "" }),
          row({ id: "r-case", category: "Gabinete", itemId: "case-1" }),
        ],
      },
    }));
    expect(output.verdict.overall).toBe("warning");
    const completeness = findingsBy(output)["price-completeness-rows"];
    expect(completeness.severity).toBe("warning");
    expect(completeness.affected).toEqual(["r-ram", "r-gpu", "r-psu"]);
    const freshness = findingsBy(output)["price-freshness-age"];
    expect(freshness.conclusion).toMatch(/20 días/);
    expect(output.dimensions.compatibility.status).toBe("ok");
    expect(output.dimensions.power.status).toBe("ok");
    expect(output.dimensions.connectors.status).toBe("ok");
    expect(output.dimensions.caseFit.status).toBe("ok");
    expect(output.sources.quotePriceUpdatedAt).toBe("2026-07-11T00:00:00.000Z");
    expect(output.sources.catalogGeneratedAt).toBe(CATALOG_GENERATED_AT);
  });

  it("F7: malformed CSV is rejected by the existing parser before any analysis", () => {
    expect(() => parseCsvToQuote("", {})).toThrow("El CSV está vacío.");
    expect(() => parseCsvToQuote("Tienda,Notas\nTienda X,Y", {})).toThrow(
      "El CSV debe incluir columnas de componente y producto."
    );
  });

  it("tolerates null catalog entries and falls back from catalogMeta to catalog.meta", () => {
    const output = analyzeQuote(buildInput({
      catalog: {
        ...buildInput().catalog,
        cpus: [null, undefined, cpuIntel],
        gpus: [null, gpuLow],
      },
      catalogMeta: { schemaVersion: 2 },
    }));
    expect(output.verdict.overall).toBe("ok");
    expect(output.sources.catalogGeneratedAt).toBe(CATALOG_GENERATED_AT);
    expect(output.resolution["r-cpu"]).toBe("exact-id");
    expect(output.resolution["r-gpu"]).toBe("exact-id");
  });

  it("integrated-graphics confirmation satisfies the GPU requirement even with an unresolved GPU row", () => {
    const output = analyzeQuote(buildInput({
      quote: {
        rows: [
          row({ id: "r-cpu" }),
          row({ id: "r-mobo", category: "Placa madre", itemId: "mobo-1" }),
          row({ id: "r-ram", category: "RAM", itemId: "ram-1" }),
          row({ id: "r-gpu", category: "Tarjeta de video", itemId: "", product: "Tarjeta rara" }),
          row({ id: "r-psu", category: "Fuente de poder", itemId: "psu-1" }),
          row({ id: "r-case", category: "Gabinete", itemId: "case-1" }),
        ],
      },
      userContext: { useCase: "gaming", targetResolution: null, budget: null, usesIntegratedGpu: true },
    }));
    expect(output.integratedGpu).toBe(true);
    expect(output.resolution["r-gpu"]).toBe("unmatched-text");
    expect(output.verdict.overall).toBe("ok");
    expect(findingIds(output)).not.toContain("completeness-missing-required");
  });
});

describe("quoteAnalyzer — determinism and field isolation", () => {
  it("identical deep-cloned input yields deep-equal, byte-identical output and no mutation", () => {
    const first = buildInput();
    const second = structuredClone(first);
    const snapshot = structuredClone(first);
    const out1 = analyzeQuote(first);
    const out2 = analyzeQuote(second);
    expect(out1).toEqual(out2);
    expect(JSON.stringify(out1)).toBe(JSON.stringify(out2));
    expect(first).toEqual(snapshot);
  });

  it("changing only rulesVersion changes only output.sources.rulesVersion", () => {
    const base = analyzeQuote(buildInput());
    const changed = analyzeQuote(buildInput({ rulesVersion: "quote-analyzer/rules/test" }));
    expect(changed.sources.rulesVersion).toBe("quote-analyzer/rules/test");
    expect(withNormalizedTimestamps(changed)).toEqual(withNormalizedTimestamps(base));
  });

  it("changing only the catalog timestamp changes only catalog freshness fields", () => {
    const base = analyzeQuote(buildInput());
    const changed = analyzeQuote(buildInput({
      catalogMeta: { generatedAt: "2026-07-01T00:00:00.000Z", schemaVersion: 2 },
    }));
    expect(changed.sources.catalogGeneratedAt).toBe("2026-07-01T00:00:00.000Z");
    expect(changed.sources.quotePriceUpdatedAt).toBe(EVALUATED_AT);
    expect(findingsBy(changed)["price-freshness-catalog"].conclusion).toMatch(/30 días/);
    expect(withNormalizedTimestamps(changed)).toEqual(withNormalizedTimestamps(base));
  });

  it("changing only the quote price date changes freshness and adds the age warning", () => {
    const base = analyzeQuote(buildInput());
    const changed = analyzeQuote(buildInput({
      quote: { priceUpdatedAt: "2026-07-01T00:00:00.000Z" },
    }));
    expect(changed.sources.quotePriceUpdatedAt).toBe("2026-07-01T00:00:00.000Z");
    expect(changed.sources.catalogGeneratedAt).toBe(CATALOG_GENERATED_AT);
    expect(changed.verdict.overall).toBe("warning");
    expect(changed.dimensions.priceFreshness.status).toBe("warning");
    expect(findingsBy(changed)["price-freshness-age"].conclusion).toMatch(/30 días/);
    for (const dimension of ["compatibility", "completeness", "power", "connectors", "caseFit", "priceCompleteness"]) {
      expect(changed.dimensions[dimension]).toEqual(base.dimensions[dimension]);
    }
    expect(changed.findings.filter((f) => f.id !== "price-freshness-age")).toEqual(
      base.findings.map((f) => ({
        ...f,
        evidence: { ...f.evidence, freshness: { ...f.evidence.freshness, quotePriceUpdatedAt: "2026-07-01T00:00:00.000Z" } },
      }))
    );
  });

  it("changing only evaluatedAt moves generatedAt and age conclusions, nothing else", () => {
    const base = analyzeQuote(buildInput());
    const changed = analyzeQuote(buildInput({ evaluatedAt: "2026-08-05T00:00:00.000Z" }));
    expect(changed.generatedAt).toBe("2026-08-05T00:00:00.000Z");
    expect(findingsBy(changed)["price-freshness-catalog"].conclusion).toMatch(/7 días/);
    expect(withNormalizedTimestamps(changed)).toEqual(withNormalizedTimestamps(base));
  });

  it("changing only a user mapping re-resolves that row and adjusts its findings", () => {
    const rows = [
      row({ id: "r-cpu" }),
      row({ id: "r-mobo", category: "Placa madre", itemId: "mobo-1" }),
      row({ id: "r-ram", category: "RAM", itemId: "ram-1" }),
      row({ id: "r-gpu", category: "Tarjeta de video", itemId: "gpu-2" }),
      row({ id: "r-psu", category: "Fuente de poder", itemId: "", product: "Fuente genérica" }),
      row({ id: "r-case", category: "Gabinete", itemId: "case-1" }),
    ];
    const before = analyzeQuote(buildInput({ quote: { rows } }));
    expect(before.resolution["r-psu"]).toBe("unmatched-text");
    expect(before.verdict.overall).toBe("unknown");
    expect(findingsBy(before)["power-connectors-pcie"]).toBeUndefined();

    const after = analyzeQuote(buildInput({
      quote: { rows },
      explicitMappings: { "r-psu": "psu-2" },
    }));
    expect(after.resolution["r-psu"]).toBe("user-mapped");
    for (const rowId of ["r-cpu", "r-mobo", "r-ram", "r-gpu", "r-case"]) {
      expect(after.resolution[rowId]).toBe(before.resolution[rowId]);
    }
    const connectors = findingsBy(after)["power-connectors-pcie"];
    expect(connectors).toBeDefined();
    expect(connectors.severity).toBe("critical");
    expect(connectors.decisionType).toBe("deterministic");
    expect(connectors.evidence.source).toBe("catalog");
    expect(connectors.confidence).toBe("medium");
  });
});

describe("quoteAnalyzer — performance ceiling", () => {
  it("a 20-row synthetic quote analyzes in well under 100 ms", () => {
    const categories = ["Procesador", "Placa madre", "RAM", "Tarjeta de video", "Fuente de poder", "Gabinete"];
    const itemIds = ["cpu-1", "mobo-1", "ram-1", "gpu-1", "psu-1", "case-1"];
    const rows = Array.from({ length: 20 }, (_, index) => {
      const key = index % 6;
      return row({
        id: `r-${index}`,
        category: categories[key],
        itemId: itemIds[key],
        product: `Producto ${index}`,
        offerPrice: String(100000 + index),
      });
    });
    const input = buildInput({ quote: { rows } });
    const start = performance.now();
    const output = analyzeQuote(input);
    const elapsed = performance.now() - start;
    expect(output.verdict.overall).toBeDefined();
    expect(elapsed).toBeLessThan(100);
  });
});
