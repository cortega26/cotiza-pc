import { describe, expect, it } from "vitest";
import {
  caseAtx,
  caseItx,
  cpuAmd,
  cpuIntel,
  gpuHigh,
  gpuLow,
  gpuSparse,
  cpuSparse,
  moboAm5,
  moboLga,
  psu500,
  psu750,
  psuMarginal,
  ramDdr5_1,
} from "../../test/fixtures";
import { RULES_VERSION } from "./contracts";
import { buildReport } from "./report";

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

const exact = (key, item, rowId) => ({
  state: "exact-id", rowId: rowId ?? `r-${key}`, componentKey: key, item, itemId: item.id,
});
const userMapped = (key, item, rowId) => ({
  state: "user-mapped", rowId: rowId ?? `r-${key}`, componentKey: key, item, itemId: item.id,
});

const fullSelection = () => ({
  cpu: cpuIntel, mobo: moboLga, ram: ramDdr5_1, gpu: gpuLow, psu: psu750, pcCase: caseAtx,
});

function buildContext(overrides = {}) {
  const context = {
    selection: fullSelection(),
    gaps: {},
    integratedGpu: false,
    resolutions: [
      exact("cpu", cpuIntel), exact("mobo", moboLga), exact("ram", ramDdr5_1),
      exact("gpu", gpuLow), exact("psu", psu750), exact("pcCase", caseAtx),
    ],
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
    catalog: {
      cpus: [cpuIntel, cpuAmd], motherboards: [moboLga], ramKits: [ramDdr5_1],
      gpus: [gpuLow, gpuHigh], psus: [psu750], pcCases: [caseAtx],
      meta: { generatedAt: CATALOG_GENERATED_AT },
    },
    catalogMeta: { generatedAt: CATALOG_GENERATED_AT, schemaVersion: 2 },
    evaluatedAt: EVALUATED_AT,
  };
  return {
    ...context,
    ...overrides,
    quote: { ...context.quote, ...(overrides.quote || {}), rows: overrides.quote?.rows || context.quote.rows },
    catalog: { ...context.catalog, ...(overrides.catalog || {}) },
    resolutions: overrides.resolutions || context.resolutions,
  };
}

const findingIds = (report) => report.findings.map((f) => f.id);
const findingsBy = (report) => Object.fromEntries(report.findings.map((f) => [f.id, f]));

describe("quoteAnalyzer report — F1 valid quote", () => {
  it("F1: complete exact-id quote with fresh prices yields verdict ok", () => {
    const report = buildReport(buildContext());
    expect(report.verdict.overall).toBe("ok");
    expect(report.verdict.summary).toMatch(/válida/);
    expect(report.findings).toHaveLength(1);
    expect(findingIds(report)).toEqual(["price-freshness-catalog"]);
    expect(report.dimensions.compatibility.status).toBe("ok");
    expect(report.dimensions.completeness.status).toBe("ok");
    expect(report.dimensions.power.status).toBe("ok");
    expect(report.dimensions.connectors.status).toBe("ok");
    expect(report.dimensions.caseFit.status).toBe("ok");
    expect(report.dimensions.priceFreshness.status).toBe("ok");
    expect(report.dimensions.priceCompleteness.status).toBe("ok");
  });

  it("F1: integrated-graphics confirmation satisfies the GPU requirement", () => {
    const report = buildReport(buildContext({
      selection: { cpu: cpuIntel, mobo: moboLga, ram: ramDdr5_1, psu: psu750, pcCase: caseAtx },
      gaps: { gpu: "missing" },
      integratedGpu: true,
      resolutions: [
        exact("cpu", cpuIntel), exact("mobo", moboLga), exact("ram", ramDdr5_1),
        exact("psu", psu750), exact("pcCase", caseAtx),
      ],
    }));
    expect(report.verdict.overall).toBe("ok");
    expect(findingIds(report)).not.toContain("completeness-missing-required");
  });
});

describe("quoteAnalyzer report — F2 confirmed incompatibility", () => {
  it("F2: AM5 CPU with LGA1700 motherboard yields verdict fail", () => {
    const report = buildReport(buildContext({
      selection: { ...fullSelection(), cpu: cpuAmd },
      resolutions: [
        exact("cpu", cpuAmd), exact("mobo", moboLga), exact("ram", ramDdr5_1),
        exact("gpu", gpuLow), exact("psu", psu750), exact("pcCase", caseAtx),
      ],
    }));
    expect(report.verdict.overall).toBe("fail");
    const finding = findingsBy(report)["compat-cpu-mobo-socket"];
    expect(finding).toBeDefined();
    expect(finding.severity).toBe("critical");
    expect(finding.dimension).toBe("compatibility");
    expect(finding.decisionType).toBe("deterministic");
    expect(finding.confidence).toBe("high");
    expect(finding.affected).toEqual(["cpu", "mobo"]);
    expect(finding.evidence.sourceFields).toEqual(["cpu.socket", "mobo.socket"]);
    expect(finding.evidence.source).toBe("catalog");
    expect(finding.evidence.freshness).toEqual({
      catalogGeneratedAt: CATALOG_GENERATED_AT,
      quotePriceUpdatedAt: EVALUATED_AT,
    });
    expect(finding.evidence.ruleVersion).toBe(RULES_VERSION);
    expect(finding.action).toMatch(/Reemplazar/);
  });
});

describe("quoteAnalyzer report — F3 warning-only", () => {
  it("F3: marginal PSU yields power warning, connectors ok, verdict warning", () => {
    const report = buildReport(buildContext({
      selection: { ...fullSelection(), gpu: gpuHigh, psu: psuMarginal },
      resolutions: [
        exact("cpu", cpuIntel), exact("mobo", moboLga), exact("ram", ramDdr5_1),
        exact("gpu", gpuHigh), exact("psu", psuMarginal), exact("pcCase", caseAtx),
      ],
    }));
    expect(report.verdict.overall).toBe("warning");
    expect(report.verdict.summary).toMatch(/advertencias/);
    const power = findingsBy(report)["power-psu-headroom"];
    expect(power.severity).toBe("warning");
    expect(power.decisionType).toBe("derived");
    expect(power.conclusion).toMatch(/550W/);
    expect(power.conclusion).toMatch(/650W/);
    expect(report.dimensions.power.status).toBe("warning");
    expect(report.dimensions.connectors.status).toBe("ok");
    expect(report.dimensions.compatibility.status).toBe("ok");
  });

  it("F3 alt: 500W single-cable PSU with dual 8-pin GPU fails connectors", () => {
    const report = buildReport(buildContext({
      selection: { ...fullSelection(), gpu: gpuHigh, psu: psu500 },
      resolutions: [
        exact("cpu", cpuIntel), exact("mobo", moboLga), exact("ram", ramDdr5_1),
        exact("gpu", gpuHigh), exact("psu", psu500), exact("pcCase", caseAtx),
      ],
    }));
    expect(findingsBy(report)["power-connectors-pcie"].severity).toBe("critical");
    expect(report.verdict.overall).toBe("fail");
  });

  it("emits at least a warning when GPU psuMin exceeds PSU wattage", () => {
    const gpuHighPsuMin = { ...gpuLow, psuMin: 550 };
    const report = buildReport(buildContext({
      selection: { ...fullSelection(), gpu: gpuHighPsuMin, psu: psu500 },
      resolutions: [
        exact("cpu", cpuIntel), exact("mobo", moboLga), exact("ram", ramDdr5_1),
        exact("gpu", gpuHighPsuMin), exact("psu", psu500), exact("pcCase", caseAtx),
      ],
    }));
    const power = findingsBy(report)["power-psu-headroom"];
    expect(power.severity).toBe("warning");
    expect(power.conclusion).toMatch(/sugiere una fuente de 550W/);
    expect(report.dimensions.power.status).toBe("warning");
  });
});

describe("quoteAnalyzer report — F4 insufficient evidence", () => {
  it("F4: sparse TDP and absent price date yield verdict unknown", () => {
    const report = buildReport(buildContext({
      selection: { ...fullSelection(), cpu: cpuSparse, gpu: gpuSparse },
      resolutions: [
        exact("cpu", cpuSparse), exact("mobo", moboLga), exact("ram", ramDdr5_1),
        exact("gpu", gpuSparse), exact("psu", psu750), exact("pcCase", caseAtx),
      ],
      quote: { ...buildContext().quote, priceUpdatedAt: "" },
    }));
    expect(report.verdict.overall).toBe("unknown");
    expect(report.dimensions.power.status).toBe("unknown");
    const power = findingsBy(report)["power-psu-headroom"];
    expect(power.decisionType).toBe("unsupported");
    expect(power.confidence).toBe("low");
    expect(power.severity).toBe("info");
    expect(power.conclusion).toMatch(/TDP/);
    const freshness = findingsBy(report)["price-freshness-age"];
    expect(freshness.severity).toBe("warning");
    expect(freshness.decisionType).toBe("unsupported");
    expect(freshness.confidence).toBe("low");
    expect(report.dimensions.priceFreshness.status).toBe("unknown");
  });

  it("does not treat a missing TDP as zero watts", () => {
    const report = buildReport(buildContext({
      selection: { ...fullSelection(), cpu: cpuSparse, gpu: gpuSparse },
      resolutions: [
        exact("cpu", cpuSparse), exact("mobo", moboLga), exact("ram", ramDdr5_1),
        exact("gpu", gpuSparse), exact("psu", psu750), exact("pcCase", caseAtx),
      ],
    }));
    expect(report.dimensions.power.status).toBe("unknown");
    expect(report.verdict.overall).toBe("unknown");
  });

  it("treats an unverifiable RAM memory type as unknown, never ok", () => {
    const ramNoType = { ...ramDdr5_1, type: "" };
    const report = buildReport(buildContext({
      selection: { ...fullSelection(), ram: ramNoType },
      resolutions: [
        exact("cpu", cpuIntel), exact("mobo", moboLga), exact("ram", ramNoType),
        exact("gpu", gpuLow), exact("psu", psu750), exact("pcCase", caseAtx),
      ],
    }));
    const compat = findingsBy(report)["compat-mobo-ram-memory"];
    expect(compat.decisionType).toBe("unsupported");
    expect(compat.confidence).toBe("low");
    expect(report.dimensions.compatibility.status).toBe("unknown");
    expect(report.verdict.overall).toBe("unknown");
  });
});

describe("quoteAnalyzer report — F5 ambiguous identity", () => {
  it("F5: ambiguous CPU row yields resolution-gap warning and verdict unknown", () => {
    const report = buildReport(buildContext({
      selection: {},
      gaps: { cpu: "ambiguous", mobo: "missing", ram: "missing", gpu: "missing", psu: "missing", pcCase: "missing" },
      resolutions: [{ state: "ambiguous", rowId: "r-cpu", componentKey: "cpu", candidates: [] }],
      quote: {
        ...buildContext().quote,
        rows: [row({ id: "r-cpu", itemId: "", product: "Intel Core" })],
      },
    }));
    expect(report.verdict.overall).toBe("unknown");
    expect(findingsBy(report)["completeness-required-resolution-gap"]).toBeDefined();
    expect(findingsBy(report)["compat-cpu-mobo-socket"]).toBeUndefined();
    expect(findingsBy(report)["power-psu-headroom"]).toBeUndefined();
    expect(report.resolutions).toBeUndefined();
  });

  it("never emits a compatibility claim for an unresolved CPU", () => {
    const report = buildReport(buildContext({
      selection: {},
      gaps: { cpu: "ambiguous", mobo: "missing", ram: "missing", gpu: "missing", psu: "missing", pcCase: "missing" },
      resolutions: [{ state: "ambiguous", rowId: "r-cpu", componentKey: "cpu", candidates: [] }],
      quote: { ...buildContext().quote, rows: [row({ id: "r-cpu", itemId: "", product: "Intel Core" })] },
    }));
    const compatFindings = report.findings.filter((f) => f.dimension === "compatibility");
    expect(compatFindings).toEqual([]);
  });
});

describe("quoteAnalyzer report — F6 stale and partial prices", () => {
  it("F6: old price date and missing prices yield warnings but ok technical dimensions", () => {
    const quoteRows = [
      row({ id: "r-cpu", offerPrice: "" }),
      row({ id: "r-mobo", category: "Placa madre", itemId: "mobo-1", offerPrice: "" }),
      row({ id: "r-ram", category: "RAM", itemId: "ram-1", offerPrice: "99.990" }),
      row({ id: "r-gpu", category: "Tarjeta de video", itemId: "gpu-1", offerPrice: "" }),
      row({ id: "r-psu", category: "Fuente de poder", itemId: "psu-1", offerPrice: "" }),
      row({ id: "r-case", category: "Gabinete", itemId: "case-1", offerPrice: "" }),
    ];
    const report = buildReport(buildContext({
      quote: {
        ...buildContext().quote,
        priceUpdatedAt: "2026-07-11T00:00:00.000Z",
        rows: quoteRows,
      },
    }));
    expect(report.verdict.overall).toBe("warning");
    const completeness = findingsBy(report)["price-completeness-rows"];
    expect(completeness.severity).toBe("warning");
    expect(completeness.affected).toEqual(["r-cpu", "r-mobo", "r-gpu", "r-psu", "r-case"]);
    expect(completeness.conclusion).toMatch(/5 de 6/);
    const freshness = findingsBy(report)["price-freshness-age"];
    expect(freshness.severity).toBe("warning");
    expect(freshness.conclusion).toMatch(/20 días/);
    expect(report.dimensions.priceCompleteness.status).toBe("warning");
    expect(report.dimensions.priceFreshness.status).toBe("warning");
    expect(report.dimensions.compatibility.status).toBe("ok");
    expect(report.dimensions.power.status).toBe("ok");
    expect(report.dimensions.caseFit.status).toBe("ok");
  });

  it("keeps price dimensions ok when prices are fresh and complete", () => {
    const report = buildReport(buildContext());
    expect(report.dimensions.priceFreshness.status).toBe("ok");
    expect(report.dimensions.priceCompleteness.status).toBe("ok");
    expect(report.verdict.overall).toBe("ok");
  });
});

describe("quoteAnalyzer report — completeness and verdict precedence", () => {
  it("missing RAM blocks the ok verdict with unknown, never fail", () => {
    const report = buildReport(buildContext({
      selection: { cpu: cpuIntel, mobo: moboLga, gpu: gpuLow, psu: psu750, pcCase: caseAtx },
      gaps: { ram: "missing" },
      resolutions: [
        exact("cpu", cpuIntel), exact("mobo", moboLga),
        exact("gpu", gpuLow), exact("psu", psu750), exact("pcCase", caseAtx),
      ],
    }));
    expect(report.verdict.overall).toBe("unknown");
    expect(report.dimensions.completeness.status).toBe("unknown");
    const missing = findingsBy(report)["completeness-missing-required"];
    expect(missing.severity).toBe("critical");
    expect(missing.affected).toEqual(["ram"]);
    expect(missing.decisionType).toBe("deterministic");
    expect(missing.evidence.source).toBe("rule");
  });

  it("duplicate resolved rows keep the category unresolved", () => {
    const report = buildReport(buildContext({
      selection: { mobo: moboLga, ram: ramDdr5_1, gpu: gpuLow, psu: psu750, pcCase: caseAtx },
      gaps: { cpu: "duplicate" },
      resolutions: [
        exact("cpu", cpuIntel, "r-cpu-a"), exact("cpu", cpuAmd, "r-cpu-b"),
        exact("mobo", moboLga), exact("ram", ramDdr5_1),
        exact("gpu", gpuLow), exact("psu", psu750), exact("pcCase", caseAtx),
      ],
    }));
    expect(report.verdict.overall).toBe("unknown");
    const gap = findingsBy(report)["completeness-required-resolution-gap"];
    expect(gap.affected).toEqual(["cpu", "r-cpu-a", "r-cpu-b"]);
  });

  it("an empty quote yields incomplete, not ok", () => {
    const report = buildReport(buildContext({
      selection: {},
      gaps: { cpu: "missing", mobo: "missing", ram: "missing", gpu: "missing", psu: "missing", pcCase: "missing" },
      resolutions: [],
      quote: { ...buildContext().quote, rows: [] },
    }));
    expect(report.verdict.overall).toBe("incomplete");
    expect(report.dimensions.completeness.status).toBeNull();
    expect(report.dimensions.compatibility.status).toBeNull();
  });

  it("unsupported categories are listed as out of scope and never assessed", () => {
    const report = buildReport(buildContext({
      selection: {},
      gaps: { cpu: "missing", mobo: "missing", ram: "missing", gpu: "missing", psu: "missing", pcCase: "missing" },
      resolutions: [{ state: "unsupported-category", rowId: "r-monitor", componentKey: null }],
      quote: {
        ...buildContext().quote,
        rows: [row({ id: "r-monitor", category: "Monitor", itemId: "", offerPrice: "199.990" })],
      },
    }));
    const unsupported = findingsBy(report)["completeness-unsupported-category"];
    expect(unsupported.severity).toBe("info");
    expect(unsupported.affected).toEqual(["r-monitor"]);
    expect(unsupported.evidence.source).toBe("quote");
    expect(report.dimensions.completeness.status).toBeNull();
    expect(report.verdict.overall).toBe("incomplete");
  });

  it("a monitor-only quote never yields ok", () => {
    const report = buildReport(buildContext({
      selection: {},
      gaps: { cpu: "missing", mobo: "missing", ram: "missing", gpu: "missing", psu: "missing", pcCase: "missing" },
      resolutions: [{ state: "unsupported-category", rowId: "r-monitor", componentKey: null }],
      quote: {
        ...buildContext().quote,
        rows: [row({ id: "r-monitor", category: "Monitor", itemId: "", offerPrice: "199.990" })],
      },
    }));
    expect(report.verdict.overall).toBe("incomplete");
  });

  it("precedence: fail beats warning beats unknown beats ok", () => {
    const failReport = buildReport(buildContext({
      selection: { ...fullSelection(), cpu: cpuAmd },
      resolutions: [
        exact("cpu", cpuAmd), exact("mobo", moboLga), exact("ram", ramDdr5_1),
        exact("gpu", gpuLow), exact("psu", psu750), exact("pcCase", caseAtx),
      ],
      quote: { ...buildContext().quote, priceUpdatedAt: "2026-07-01T00:00:00.000Z" },
    }));
    expect(failReport.verdict.overall).toBe("fail");
    const warnReport = buildReport(buildContext({
      selection: { ...fullSelection(), gpu: gpuHigh, psu: psuMarginal },
      resolutions: [
        exact("cpu", cpuIntel), exact("mobo", moboLga), exact("ram", ramDdr5_1),
        exact("gpu", gpuHigh), exact("psu", psuMarginal), exact("pcCase", caseAtx),
      ],
      quote: { ...buildContext().quote, priceUpdatedAt: "2026-07-01T00:00:00.000Z" },
    }));
    expect(warnReport.verdict.overall).toBe("warning");
    const unknownReport = buildReport(buildContext({
      selection: { ...fullSelection(), cpu: cpuSparse, gpu: gpuSparse },
      resolutions: [
        exact("cpu", cpuSparse), exact("mobo", moboLga), exact("ram", ramDdr5_1),
        exact("gpu", gpuSparse), exact("psu", psu750), exact("pcCase", caseAtx),
      ],
    }));
    expect(unknownReport.verdict.overall).toBe("unknown");
  });
});

describe("quoteAnalyzer report — evidence, confidence, ordering", () => {
  it("records source user and medium confidence for user-mapped components", () => {
    const report = buildReport(buildContext({
      selection: { ...fullSelection(), cpu: cpuAmd },
      resolutions: [
        userMapped("cpu", cpuAmd), exact("mobo", moboLga), exact("ram", ramDdr5_1),
        exact("gpu", gpuLow), exact("psu", psu750), exact("pcCase", caseAtx),
      ],
    }));
    const finding = findingsBy(report)["compat-cpu-mobo-socket"];
    expect(finding.severity).toBe("critical");
    expect(finding.evidence.source).toBe("catalog");
    expect(finding.confidence).toBe("medium");
  });

  it("records source user when every affected component is user-mapped", () => {
    const ramDdr4 = { ...ramDdr5_1, type: "DDR4" };
    const report = buildReport(buildContext({
      selection: { ...fullSelection(), cpu: cpuIntel, ram: ramDdr4 },
      resolutions: [
        userMapped("cpu", cpuIntel), exact("mobo", moboLga), userMapped("ram", ramDdr4),
        exact("gpu", gpuLow), exact("psu", psu750), exact("pcCase", caseAtx),
      ],
    }));
    const finding = findingsBy(report)["compat-cpu-ram-memory"];
    expect(finding.decisionType).toBe("deterministic");
    expect(finding.evidence.source).toBe("user");
    expect(finding.confidence).toBe("medium");
  });

  it("lowers confidence to medium for inferred CPU memory type", () => {
    const cpuInferred = { ...cpuIntel, memoryTypeExplicit: false };
    const ramDdr4 = { ...ramDdr5_1, type: "DDR4" };
    const report = buildReport(buildContext({
      selection: { ...fullSelection(), cpu: cpuInferred, ram: ramDdr4 },
      resolutions: [
        exact("cpu", cpuInferred), exact("mobo", moboLga), exact("ram", ramDdr4),
        exact("gpu", gpuLow), exact("psu", psu750), exact("pcCase", caseAtx),
      ],
    }));
    const finding = findingsBy(report)["compat-cpu-ram-memory"];
    expect(finding.severity).toBe("critical");
    expect(finding.evidence.source).toBe("catalog");
    expect(finding.confidence).toBe("medium");
  });

  it("lowers confidence to medium when case form-factor evidence is unknown", () => {
    const caseUnknownEvidence = { ...caseItx, formFactorEvidence: "unknown" };
    const report = buildReport(buildContext({
      selection: { ...fullSelection(), mobo: moboAm5, pcCase: caseUnknownEvidence },
      resolutions: [
        exact("cpu", cpuIntel), exact("mobo", moboAm5), exact("ram", ramDdr5_1),
        exact("gpu", gpuLow), exact("psu", psu750), exact("pcCase", caseUnknownEvidence),
      ],
    }));
    const finding = findingsBy(report)["compat-mobo-case-ff"];
    expect(finding.severity).toBe("critical");
    expect(finding.confidence).toBe("medium");
  });

  it("sorts findings by severity then stable id", () => {
    const report = buildReport(buildContext({
      selection: { ...fullSelection(), cpu: cpuAmd },
      resolutions: [
        exact("cpu", cpuAmd), exact("mobo", moboLga), exact("ram", ramDdr5_1),
        exact("gpu", gpuLow), exact("psu", psu750), exact("pcCase", caseAtx),
      ],
      quote: {
        ...buildContext().quote,
        priceUpdatedAt: "2026-07-01T00:00:00.000Z",
        rows: [row({ id: "r-cpu", offerPrice: "" }), ...buildContext().quote.rows.slice(1)],
      },
    }));
    const severities = report.findings.map((f) => f.severity);
    const order = { critical: 0, warning: 1, info: 2 };
    for (let i = 1; i < severities.length; i += 1) {
      expect(order[severities[i - 1]]).toBeLessThanOrEqual(order[severities[i]]);
    }
    const sameSeverity = report.findings.filter((f) => f.severity === "warning");
    expect(sameSeverity.map((f) => f.id)).toEqual([...sameSeverity.map((f) => f.id)].sort());
  });

  it("emits no finding without full evidence, freshness, rule version, and action", () => {
    const report = buildReport(buildContext({
      selection: { ...fullSelection(), cpu: cpuAmd },
      resolutions: [
        exact("cpu", cpuAmd), exact("mobo", moboLga), exact("ram", ramDdr5_1),
        exact("gpu", gpuLow), exact("psu", psu750), exact("pcCase", caseAtx),
      ],
    }));
    for (const finding of report.findings) {
      expect(finding.id).toBeTruthy();
      expect(finding.dimension).toBeTruthy();
      expect(finding.severity).toBeTruthy();
      expect(finding.conclusion).toBeTruthy();
      expect(Array.isArray(finding.affected)).toBe(true);
      expect(finding.decisionType).toBeTruthy();
      expect(Array.isArray(finding.evidence.sourceFields)).toBe(true);
      expect(finding.evidence.source).toBeTruthy();
      expect(finding.evidence.freshness.catalogGeneratedAt).toBe(CATALOG_GENERATED_AT);
      expect(finding.evidence.freshness.quotePriceUpdatedAt).toBeTruthy();
      expect(finding.evidence.ruleVersion).toBe(RULES_VERSION);
      expect(finding.confidence).toBeTruthy();
      expect(finding.explanation).toBeTruthy();
      expect(finding.action).toBeTruthy();
    }
  });

  it("missing RAM/mobo memory type never renders compatibility as ok", () => {
    const moboNoMemory = { ...moboLga, memoryType: null, memoryTypeExplicit: false };
    const report = buildReport(buildContext({
      selection: { ...fullSelection(), mobo: moboNoMemory },
      resolutions: [
        exact("cpu", cpuIntel), exact("mobo", moboNoMemory), exact("ram", ramDdr5_1),
        exact("gpu", gpuLow), exact("psu", psu750), exact("pcCase", caseAtx),
      ],
    }));
    expect(report.dimensions.compatibility.status).toBe("unknown");
    const finding = findingsBy(report)["compat-mobo-ram-memory"];
    expect(finding).toBeDefined();
    expect(finding.decisionType).toBe("unsupported");
    expect(finding.severity).toBe("info");
    expect(report.verdict.overall).toBe("unknown");
  });

  it("is deterministic: identical inputs yield deep-equal and byte-identical output", () => {
    const context = buildContext();
    const first = buildReport(context);
    const second = buildReport(context);
    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("does not mutate its inputs", () => {
    const context = buildContext();
    const frozen = { ...context, selection: { ...context.selection }, resolutions: context.resolutions.map((r) => ({ ...r })) };
    buildReport(frozen);
    expect(context.selection.cpu).toBe(cpuIntel);
    expect(context.quote.rows[0].offerPrice).toBe("399.990");
    expect(context.resolutions[0].state).toBe("exact-id");
  });
});
