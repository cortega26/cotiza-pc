import { describe, expect, it } from "vitest";
import {
  CATEGORY_TO_COMPONENT,
  COMPONENT_KEYS,
  CONFIDENCE_LEVELS,
  DECISION_TYPES,
  DIMENSIONS,
  DIMENSION_STATUSES,
  PRICE_STALE_DAYS,
  REQUIRED_COMPONENTS,
  RESOLUTION_STATES,
  RULES_VERSION,
  SCHEMA_VERSION_INPUT,
  SCHEMA_VERSION_OUTPUT,
  SEVERITIES,
  VERDICT_STATES,
  isValidAnalyzerInput,
  isValidResolutionState,
  normalizeCategory,
  validateAnalyzerInput,
} from "./contracts";
import {
  caseAtx,
  cpuIntel,
  gpuLow,
  moboLga,
  psu750,
  ramDdr5_1,
} from "../../test/fixtures";

export function buildAnalyzerInput(overrides = {}) {
  const input = {
    schemaVersion: SCHEMA_VERSION_INPUT,
    evaluatedAt: "2026-07-31T00:00:00.000Z",
    quote: {
      id: "q-1",
      name: "Cotización de prueba",
      currency: "CLP",
      priceUpdatedAt: "2026-07-31T00:00:00.000Z",
      rows: [
        {
          id: "r-cpu",
          category: "Procesador",
          product: cpuIntel.name,
          itemId: cpuIntel.id,
          store: "Tienda",
          offerPrice: "399.990",
          regularPrice: "429.990",
          notes: "",
        },
        {
          id: "r-mobo",
          category: "Placa madre",
          product: moboLga.name,
          itemId: moboLga.id,
          store: "Tienda",
          offerPrice: "249.990",
          regularPrice: "",
          notes: "",
        },
      ],
    },
    userContext: {
      useCase: "gaming",
      targetResolution: "1080p",
      budget: { amount: 1500000, currency: "CLP" },
      usesIntegratedGpu: null,
    },
    catalog: {
      cpus: [cpuIntel],
      motherboards: [moboLga],
      ramKits: [ramDdr5_1],
      gpus: [gpuLow],
      psus: [psu750],
      pcCases: [caseAtx],
      meta: { generatedAt: "2026-07-29T00:00:00.000Z" },
    },
    catalogMeta: { generatedAt: "2026-07-29T00:00:00.000Z", schemaVersion: 2 },
    aliases: null,
  };
  return { ...input, quote: { ...input.quote, rows: input.quote.rows.map((r) => ({ ...r })) }, ...overrides };
}

describe("quoteAnalyzer contracts", () => {
  it("freezes schema constants", () => {
    expect(Object.isFrozen(CATEGORY_TO_COMPONENT)).toBe(true);
    for (const list of [
      COMPONENT_KEYS,
      REQUIRED_COMPONENTS,
      RESOLUTION_STATES,
      DIMENSIONS,
      VERDICT_STATES,
      SEVERITIES,
      DECISION_TYPES,
      CONFIDENCE_LEVELS,
      DIMENSION_STATUSES,
    ]) {
      expect(Object.isFrozen(list)).toBe(true);
    }
  });

  it("defines the approved v1 vocabulary", () => {
    expect(REQUIRED_COMPONENTS).toEqual(["cpu", "mobo", "ram", "gpu", "psu", "pcCase"]);
    expect(RESOLUTION_STATES).toEqual([
      "exact-id",
      "user-mapped",
      "ambiguous",
      "unmatched-text",
      "unsupported-category",
    ]);
    expect(VERDICT_STATES).toEqual(["fail", "warning", "unknown", "ok", "incomplete"]);
    expect(DIMENSIONS).toEqual([
      "compatibility",
      "completeness",
      "power",
      "connectors",
      "caseFit",
      "priceFreshness",
      "priceCompleteness",
    ]);
    expect(SCHEMA_VERSION_INPUT).toBe("quote-analyzer/input/v1");
    expect(SCHEMA_VERSION_OUTPUT).toBe("quote-analyzer/output/v1");
    expect(RULES_VERSION).toBe("quote-analyzer/rules/v1");
    expect(PRICE_STALE_DAYS).toBe(14);
  });

  it("normalizes supported Spanish category labels", () => {
    expect(normalizeCategory("Procesador")).toBe("cpu");
    expect(normalizeCategory("Placa madre")).toBe("mobo");
    expect(normalizeCategory("RAM")).toBe("ram");
    expect(normalizeCategory("Tarjeta de video")).toBe("gpu");
    expect(normalizeCategory("Fuente de poder")).toBe("psu");
    expect(normalizeCategory("Gabinete")).toBe("pcCase");
    expect(normalizeCategory("  procesador ")).toBe("cpu");
    expect(normalizeCategory("Cooler")).toBeNull();
    expect(normalizeCategory("")).toBeNull();
    expect(normalizeCategory(null)).toBeNull();
    expect(normalizeCategory(42)).toBeNull();
  });

  it("accepts a valid v1 input and returns it unchanged", () => {
    const input = buildAnalyzerInput();
    expect(isValidAnalyzerInput(input)).toBe(true);
    expect(validateAnalyzerInput(input)).toBe(input);
  });

  it("accepts valid integrated-gpu confirmation and null aliases", () => {
    const input = buildAnalyzerInput({
      userContext: { ...buildAnalyzerInput().userContext, usesIntegratedGpu: true },
    });
    expect(isValidAnalyzerInput(input)).toBe(true);
  });

  it("accepts a date-only ISO evaluatedAt and rejects non-date strings", () => {
    expect(isValidAnalyzerInput(buildAnalyzerInput({ evaluatedAt: "2026-07-31" }))).toBe(true);
    expect(isValidAnalyzerInput(buildAnalyzerInput({ evaluatedAt: "0" }))).toBe(false);
    expect(isValidAnalyzerInput(buildAnalyzerInput({ evaluatedAt: "2026" }))).toBe(false);
    expect(isValidAnalyzerInput(buildAnalyzerInput({ evaluatedAt: "31-07-2026" }))).toBe(false);
  });

  it("rejects an undefined usesIntegratedGpu (contract: boolean or null)", () => {
    const input = buildAnalyzerInput();
    delete input.userContext.usesIntegratedGpu;
    expect(isValidAnalyzerInput(input)).toBe(false);
    expect(() => validateAnalyzerInput(input)).toThrow("usesIntegratedGpu");
  });

  it.each([
    ["non-object input", () => null, "input"],
    ["wrong schema", () => buildAnalyzerInput({ schemaVersion: "quote-analyzer/input/v2" }), "schema"],
    ["missing evaluatedAt", () => {
      const i = buildAnalyzerInput();
      delete i.evaluatedAt;
      return i;
    }, "evaluatedAt"],
    ["invalid evaluatedAt", () => buildAnalyzerInput({ evaluatedAt: "no-es-una-fecha" }), "evaluatedAt"],
    ["missing quote", () => {
      const i = buildAnalyzerInput();
      delete i.quote;
      return i;
    }, "quote"],
    ["missing rows", () => buildAnalyzerInput({ quote: { id: "q", rows: null } }), "rows"],
    ["malformed row", () => buildAnalyzerInput({ quote: { id: "q", rows: ["fila inválida"] } }), "rows[0]"],
    ["missing userContext", () => {
      const i = buildAnalyzerInput();
      delete i.userContext;
      return i;
    }, "userContext"],
    ["unsupported use case", () => buildAnalyzerInput({ userContext: { ...buildAnalyzerInput().userContext, useCase: "office" } }), "gaming"],
    ["invalid usesIntegratedGpu", () => buildAnalyzerInput({ userContext: { ...buildAnalyzerInput().userContext, usesIntegratedGpu: "si" } }), "usesIntegratedGpu"],
    ["missing catalog arrays", () => buildAnalyzerInput({ catalog: { cpus: [], gpus: [] } }), "catalog"],
    ["missing catalogMeta", () => {
      const i = buildAnalyzerInput();
      delete i.catalogMeta;
      return i;
    }, "catalogMeta"],
    ["invalid aliases", () => buildAnalyzerInput({ aliases: "no" }), "aliases"],
  ])("rejects %s", (_name, factory) => {
    const input = factory();
    expect(isValidAnalyzerInput(input)).toBe(false);
    expect(() => validateAnalyzerInput(input)).toThrow();
  });

  it("rejects with stable Spanish messages", () => {
    expect(() => validateAnalyzerInput(null)).toThrow("Entrada de análisis inválida");
    const wrongSchema = buildAnalyzerInput({ schemaVersion: "quote-analyzer/input/v2" });
    expect(() => validateAnalyzerInput(wrongSchema)).toThrow('se esperaba "quote-analyzer/input/v1"');
    const noDate = buildAnalyzerInput();
    delete noDate.evaluatedAt;
    expect(() => validateAnalyzerInput(noDate)).toThrow("evaluatedAt");
    const office = buildAnalyzerInput({ userContext: { ...buildAnalyzerInput().userContext, useCase: "office" } });
    expect(() => validateAnalyzerInput(office)).toThrow('solo "gaming"');
  });

  it("validates resolution states", () => {
    for (const state of RESOLUTION_STATES) expect(isValidResolutionState(state)).toBe(true);
    expect(isValidResolutionState("fabricado")).toBe(false);
  });

  it("does not mutate a deeply frozen input", () => {
    const input = buildAnalyzerInput();
    const deepFreeze = (value) => {
      if (value && typeof value === "object") {
        Object.freeze(value);
        for (const key of Object.keys(value)) deepFreeze(value[key]);
      }
      return value;
    };
    deepFreeze(input);
    expect(() => validateAnalyzerInput(input)).not.toThrow();
    expect(input.quote.rows[0].itemId).toBe(cpuIntel.id);
  });
});
