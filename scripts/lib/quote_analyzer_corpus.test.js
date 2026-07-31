import { describe, expect, it } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";
import {
  CASE_SCHEMA_VERSION,
  LABEL_SCHEMA_VERSION,
  REPORT_SCHEMA_VERSION,
  GATES,
  USAGE,
  validateCase,
  loadCorpus,
  analyzeCaseRecord,
  assertOutsideRepo,
  parseCliArgs,
  runHarness,
} from "./quote_analyzer_corpus.js";
import {
  normalizeCategory,
  REQUIRED_COMPONENTS,
  SCHEMA_VERSION_INPUT,
} from "../../pc-quote-builder/src/lib/quoteAnalyzer/contracts.js";
import {
  caseAtx,
  cpuAmd,
  cpuIntel,
  cpuSparse,
  gpuLow,
  moboLga,
  psu750,
  ramDdr5_1,
} from "../../pc-quote-builder/src/test/fixtures.js";

const EVALUATED_AT = "2026-08-01T12:00:00.000Z";
const QUOTE_UPDATED_AT = "2026-08-01T00:00:00.000Z";
const CATALOG_GENERATED_AT = "2026-07-30T00:00:00.000Z";
const SNAPSHOT_AT = "2026-08-01T13:00:00.000Z";

const row = (overrides = {}) => ({
  id: "r-x",
  category: "Procesador",
  product: "Intel Core i5-13600K",
  itemId: "cpu-1",
  store: "Tienda",
  offerPrice: "399.990",
  regularPrice: "",
  notes: "",
  ...overrides,
});

const F1_ROWS = [
  row({ id: "r-cpu", category: "Procesador", itemId: "cpu-1", product: "Intel Core i5-13600K" }),
  row({ id: "r-mobo", category: "Placa madre", itemId: "mobo-1", product: "ASUS Z790-P" }),
  row({ id: "r-ram", category: "RAM", itemId: "ram-1", product: "Corsair Vengeance 32GB" }),
  row({ id: "r-gpu", category: "Tarjeta de video", itemId: "gpu-1", product: "NVIDIA GeForce RTX 4060" }),
  row({ id: "r-psu", category: "Fuente de poder", itemId: "psu-1", product: "Corsair RM750x" }),
  row({ id: "r-case", category: "Gabinete", itemId: "case-1", product: "NZXT H510 Flow" }),
];

function buildInput(overrides = {}) {
  const input = {
    schemaVersion: SCHEMA_VERSION_INPUT,
    evaluatedAt: EVALUATED_AT,
    quote: { id: "q-1", name: "Cotización de prueba", currency: "CLP", priceUpdatedAt: QUOTE_UPDATED_AT, rows: F1_ROWS },
    userContext: { useCase: "gaming", targetResolution: "1080p", budget: null, usesIntegratedGpu: null },
    catalog: {
      cpus: [cpuIntel, cpuSparse],
      motherboards: [moboLga],
      ramKits: [ramDdr5_1],
      gpus: [gpuLow],
      psus: [psu750],
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
    catalog: { ...input.catalog, ...(overrides.catalog || {}) },
  };
}

const identityRowsFor = (rows, state = "exact-id") =>
  rows.map((r) => ({ rowId: r.id, confirmedIdentity: state, requiredComponent: normalizeCategory(r.category) }));

const okLabel = (reviewerId, rows) => ({
  schemaVersion: LABEL_SCHEMA_VERSION,
  reviewerId,
  labeledAt: SNAPSHOT_AT,
  rows: identityRowsFor(rows),
  expertFindings: ["compatibility", "power", "connectors", "caseFit"].map((dimension) => ({
    dimension,
    expectedStatus: "ok",
    expectedFindingIds: [],
  })),
  dangerousConfirmedIncompatibility: false,
  topDecisionConcern: "power",
  reviewerConfidence: "high",
  decisionAction: "keep",
});

function buildCase(overrides = {}) {
  const rows = overrides.analyzerInput?.quote?.rows || F1_ROWS;
  const caseId = overrides.caseId ?? "CASE-0001";
  return {
    schemaVersion: CASE_SCHEMA_VERSION,
    caseId,
    quoteSnapshotAt: SNAPSHOT_AT,
    elapsedMs: 1000,
    analyzerInput: buildInput(overrides.analyzerInput || {}),
    labels: [okLabel("R1", rows), okLabel("R2", rows)],
    adjudication: null,
    ...overrides,
    analyzerInput: overrides.analyzerInput ?? buildInput(),
  };
}

function makeCorpusDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qa-corpus-"));
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), typeof content === "string" ? content : JSON.stringify(content));
  }
  return dir;
}

const load = (dir) => {
  const { cases, errors } = loadCorpus(dir);
  return { cases, errors };
};

describe("quoteAnalyzerCorpus — validateCase", () => {
  it("accepts a valid case without mutating it", () => {
    const record = buildCase();
    const snapshot = structuredClone(record);
    expect(validateCase(record)).toBe(record);
    expect(record).toEqual(snapshot);
  });

  it("rejects non-objects and unsupported schemas", () => {
    expect(() => validateCase(null)).toThrow(/objeto/);
    expect(() => validateCase({ schemaVersion: "v0" })).toThrow(/no soportado/);
  });

  it("rejects a dangerous flag without an expected fail finding", () => {
    const record = buildCase({ labels: [okLabel("R1", F1_ROWS)] });
    record.labels[0].dangerousConfirmedIncompatibility = true;
    expect(() => validateCase(record)).toThrow(/peligro confirmado exige/);
  });

  it("rejects duplicate reviewers and unknown row references", () => {
    expect(() => validateCase(buildCase({ labels: [okLabel("R1", F1_ROWS), okLabel("R1", F1_ROWS)] }))).toThrow(
      /duplicada/
    );
    const bad = buildCase();
    bad.labels[0].rows[0].rowId = "r-ghost";
    expect(() => validateCase(bad)).toThrow(/fila inexistente/);
  });

  it("rejects invalid adjudication metadata", () => {
    const record = buildCase({
      adjudication: { resolvedBy: "other", resolvedAt: SNAPSHOT_AT, summary: "x" },
    });
    expect(() => validateCase(record)).toThrow(/resolvedBy/);
  });

  it("rejects cases without any label", () => {
    expect(() => validateCase(buildCase({ labels: [] }))).toThrow(/al menos una etiqueta/);
  });

  it("rejects lax date shapes in quoteSnapshotAt, labeledAt and resolvedAt", () => {
    for (const bad of ["0", "2026", "31-07-2026"]) {
      expect(() => validateCase(buildCase({ quoteSnapshotAt: bad }))).toThrow(/ISO 8601/);
      const labelBad = buildCase();
      labelBad.labels[0].labeledAt = bad;
      expect(() => validateCase(labelBad)).toThrow(/ISO 8601/);
      const adjudBad = buildCase({ adjudication: { resolvedBy: "third", resolvedAt: bad, summary: "x" } });
      expect(() => validateCase(adjudBad)).toThrow(/ISO 8601/);
    }
    expect(() => validateCase(buildCase({ quoteSnapshotAt: undefined }))).not.toThrow();
    expect(() => validateCase(buildCase())).not.toThrow();
  });

  it("rejects negative and non-finite elapsedMs", () => {
    expect(() => validateCase(buildCase({ elapsedMs: -1 }))).toThrow(/no negativo/);
    expect(() => validateCase(buildCase({ elapsedMs: Number.NaN }))).toThrow(/no negativo/);
    expect(() => validateCase(buildCase({ elapsedMs: null }))).not.toThrow();
  });

  it("rejects duplicate dimensions in expertFindings and resolvedFindings", () => {
    const dup = buildCase();
    dup.labels[0].expertFindings.push({ dimension: "power", expectedStatus: "fail", expectedFindingIds: [] });
    expect(() => validateCase(dup)).toThrow(/dimensión duplicada/);
    const adjud = buildCase({
      adjudication: {
        resolvedBy: "third",
        resolvedAt: SNAPSHOT_AT,
        summary: "x",
        resolvedFindings: [
          { dimension: "compatibility", expectedStatus: "fail" },
          { dimension: "compatibility", expectedStatus: "ok" },
        ],
      },
    });
    expect(() => validateCase(adjud)).toThrow(/dimensión duplicada/);
  });

  it("rejects repeated rowIds inside one label", () => {
    const record = buildCase();
    record.labels[0].rows.push(record.labels[0].rows[0]);
    expect(() => validateCase(record)).toThrow(/fila repetida/);
  });
});

describe("quoteAnalyzerCorpus — loadCorpus", () => {
  it("loads valid cases and rejects bad files with content-free errors", () => {
    const dir = makeCorpusDir({
      "001.json": buildCase({ caseId: "CASE-0001" }),
      "002.json": '{"schemaVersion":"quote-analyzer-corpus/case/v0"}',
      "003.json": "NOT JSON",
    });
    const { cases, errors } = load(dir);
    expect(cases.map((c) => c.caseId)).toEqual(["CASE-0001"]);
    expect(errors).toHaveLength(2);
    expect(errors[0].error).toMatch(/no soportado/);
    expect(errors[1].error).toBe("Archivo JSON inválido.");
    expect(JSON.stringify(errors)).not.toContain("NOT JSON");
  });

  it("rejects duplicate case IDs", () => {
    const dir = makeCorpusDir({
      "001.json": buildCase({ caseId: "CASE-0001" }),
      "002.json": buildCase({ caseId: "CASE-0001" }),
    });
    const { cases, errors } = load(dir);
    expect(cases).toHaveLength(1);
    expect(errors.map((e) => e.error)).toEqual(["Caso duplicado en el corpus."]);
  });

  it("does not crash on non-file *.json entries", () => {
    const dir = makeCorpusDir({ "001.json": buildCase({ caseId: "CASE-0001" }) });
    fs.mkdirSync(path.join(dir, "folder.json"));
    const { cases, errors } = load(dir);
    expect(cases.map((c) => c.caseId)).toEqual(["CASE-0001"]);
    expect(errors.map((e) => e.error)).toEqual(["No se pudo leer el archivo JSON."]);
    expect(errors.map((e) => e.caseId)).toEqual(["folder"]);
    expect(() => runHarness({ corpusDir: dir, generatedAt: SNAPSHOT_AT })).not.toThrow();
  });

  it.skipIf(typeof process.getuid === "function" && process.getuid() === 0)(
    "throws a content-free error when the corpus directory is unreadable",
    () => {
      const dir = makeCorpusDir({ "001.json": buildCase({ caseId: "CASE-0001" }) });
      fs.chmodSync(dir, 0o000);
      try {
        expect(() => runHarness({ corpusDir: dir, generatedAt: SNAPSHOT_AT })).toThrow(
          "No se pudo leer el directorio del corpus."
        );
      } finally {
        fs.chmodSync(dir, 0o755);
      }
    }
  );
});

describe("quoteAnalyzerCorpus — runHarness gates", () => {
  it("passes all launch gates on a fully resolved, agreed corpus (exit 0)", () => {
    const dir = makeCorpusDir({
      "001.json": buildCase({ caseId: "CASE-0001", elapsedMs: 1000 }),
      "002.json": buildCase({ caseId: "CASE-0002", elapsedMs: 2000 }),
      "003.json": buildCase({ caseId: "CASE-0003", elapsedMs: 3000 }),
    });
    const { exitCode, report } = runHarness({ corpusDir: dir, generatedAt: SNAPSHOT_AT });
    expect(exitCode).toBe(0);
    expect(report.schemaVersion).toBe(REPORT_SCHEMA_VERSION);
    expect(report.corpus.caseCount).toBe(3);
    expect(report.corpus.rejectedCount).toBe(0);
    expect(report.metrics.identityResolutionRate).toBe(1);
    expect(report.metrics.expertAgreementDeterministic).toBe(1);
    expect(report.metrics.expertAgreementTopConcern).toBe(1);
    expect(report.metrics.dangerousFalseNegativeCount).toBe(0);
    expect(report.metrics.dangerousNearMissCount).toBe(0);
    expect(report.metrics.evidenceCompletenessRate).toBe(1);
    expect(report.metrics.timeToVerdictMsMedian).toBe(2000);
    for (const gate of Object.values(report.gates)) expect(gate.pass).toBe(true);
    expect(report.failingCaseIds.dangerousFalseNegatives).toEqual([]);
  });

  it("fails the identity resolution gate when rows do not resolve (exit 1)", () => {
    const moboClone = { id: "mobo-4", name: "ASUS Z790-P", socket: "LGA1700", formFactor: "ATX", memoryType: "DDR5", memoryTypeExplicit: true };
    const ambiguousRows = F1_ROWS.map((r) =>
      r.id === "r-cpu" || r.id === "r-mobo" ? { ...r, itemId: "" } : r
    );
    const record = buildCase({
      caseId: "CASE-0001",
      analyzerInput: buildInput({
        quote: { rows: ambiguousRows },
        catalog: { motherboards: [moboLga, moboClone] },
      }),
      labels: [
        {
          ...okLabel("R1", ambiguousRows),
          rows: [
            ...identityRowsFor(ambiguousRows.filter((r) => r.id !== "r-cpu" && r.id !== "r-mobo"), "exact-id"),
            identityRowsFor(ambiguousRows.filter((r) => r.id === "r-cpu" || r.id === "r-mobo"), "ambiguous"),
          ].flat(),
        },
      ],
    });
    const dir = makeCorpusDir({ "001.json": record });
    const { exitCode, report } = runHarness({ corpusDir: dir, generatedAt: SNAPSHOT_AT });
    expect(exitCode).toBe(1);
    expect(report.metrics.identityResolutionRate).toBeLessThan(GATES.identityResolution.threshold);
    expect(report.gates.identityResolution.pass).toBe(false);
  });

  it("treats unknown as near-miss, not dangerous false negative", () => {
    const moboNoMemory = { id: "mobo-1", name: "Mobo Sin RAM", socket: "LGA1700", formFactor: "ATX" };
    const record = buildCase({
      caseId: "CASE-0001",
      analyzerInput: buildInput({ catalog: { motherboards: [moboNoMemory] } }),
      labels: [
        {
          ...okLabel("R1", F1_ROWS),
          expertFindings: [
            { dimension: "compatibility", expectedStatus: "fail", expectedFindingIds: ["compat-cpu-mobo-socket"] },
            ...okLabel("R1", F1_ROWS).expertFindings.slice(1),
          ],
          dangerousConfirmedIncompatibility: true,
        },
        {
          ...okLabel("R2", F1_ROWS),
          expertFindings: [
            { dimension: "compatibility", expectedStatus: "fail", expectedFindingIds: ["compat-cpu-mobo-socket"] },
            ...okLabel("R2", F1_ROWS).expertFindings.slice(1),
          ],
          dangerousConfirmedIncompatibility: true,
        },
      ],
    });
    const analyzed = analyzeCaseRecord(record);
    expect(analyzed.output.dimensions.compatibility.status).toBe("unknown");
    expect(["ok", "fail"]).not.toContain(analyzed.output.verdict.overall);

    const dir = makeCorpusDir({ "001.json": record });
    const { exitCode, report } = runHarness({ corpusDir: dir, generatedAt: SNAPSHOT_AT });
    expect(exitCode).toBe(0);
    expect(report.metrics.dangerousFalseNegativeCount).toBe(0);
    expect(report.metrics.dangerousNearMissCount).toBe(1);
    expect(report.metrics.unknownVsOkMatrix["fail->unknown"]).toBe(1);
    expect(report.gates.dangerousFalseNegatives.pass).toBe(true);
  });

  it("records unadjudicated reviewer disagreement and fails the agreement gate", () => {
    const disagree = buildCase({ caseId: "CASE-0001" });
    disagree.labels[1].expertFindings[0] = {
      dimension: "compatibility",
      expectedStatus: "fail",
      expectedFindingIds: ["compat-cpu-mobo-socket"],
    };
    const dir = makeCorpusDir({ "001.json": disagree });
    const { exitCode, report } = runHarness({ corpusDir: dir, generatedAt: SNAPSHOT_AT });
    expect(exitCode).toBe(1);
    expect(report.metrics.expertAgreementDeterministic).toBe(0.75);
    expect(report.gates.expertAgreementDeterministic.pass).toBe(false);
    expect(report.failingCaseIds.disagreementsWithoutAdjudication).toEqual(["CASE-0001"]);
  });

  it("flags a dangerous false negative and fails the gate", () => {
    const record = buildCase({
      caseId: "CASE-0001",
      labels: [
        {
          ...okLabel("R1", F1_ROWS),
          expertFindings: [
            { dimension: "compatibility", expectedStatus: "fail", expectedFindingIds: ["compat-cpu-mobo-socket"] },
            ...okLabel("R1", F1_ROWS).expertFindings.slice(1),
          ],
          dangerousConfirmedIncompatibility: true,
        },
      ],
    });
    const dir = makeCorpusDir({ "001.json": record });
    const { exitCode, report } = runHarness({ corpusDir: dir, generatedAt: SNAPSHOT_AT });
    expect(exitCode).toBe(1);
    expect(report.metrics.dangerousFalseNegativeCount).toBe(1);
    expect(report.gates.dangerousFalseNegatives.pass).toBe(false);
    expect(report.failingCaseIds.dangerousFalseNegatives).toEqual(["CASE-0001"]);
  });

  it("fails the schema rejection gate on malformed cases and honors --report-only", () => {
    const dir = makeCorpusDir({
      "001.json": buildCase({ caseId: "CASE-0001" }),
      "002.json": '{"schemaVersion":"quote-analyzer-corpus/case/v0"}',
      "003.json": "NOT JSON",
    });
    const { exitCode, report } = runHarness({ corpusDir: dir, generatedAt: SNAPSHOT_AT });
    expect(exitCode).toBe(1);
    expect(report.corpus.rejectedCount).toBe(2);
    expect(report.gates.schemaRejection.pass).toBe(false);
    const { exitCode: reportOnlyCode } = runHarness({
      corpusDir: dir,
      reportOnly: true,
      generatedAt: SNAPSHOT_AT,
    });
    expect(reportOnlyCode).toBe(0);
  });

  it("throws on an empty corpus", () => {
    const dir = makeCorpusDir({ "001.json": '{"schemaVersion":"quote-analyzer-corpus/case/v0"}' });
    expect(() => runHarness({ corpusDir: dir, generatedAt: SNAPSHOT_AT })).toThrow(/Corpus vacío/);
  });

  it("contains per-case analyzer failures without killing the run or leaking data", () => {
    const dir = makeCorpusDir({
      "001.json": buildCase({ caseId: "CASE-0001" }),
      "002.json": buildCase({ caseId: "CASE-0002" }),
    });
    const boom = () => {
      throw new Error("producto: GPU SECRETA X, precio: 999.990");
    };
    const { exitCode, report } = runHarness({
      corpusDir: dir,
      generatedAt: SNAPSHOT_AT,
      analyze: (record) => (record.caseId === "CASE-0002" ? boom() : analyzeCaseRecord(record)),
    });
    expect(exitCode).toBe(1);
    expect(report.corpus.rejectedCount).toBe(1);
    expect(report.corpus.rejectedCaseIds).toEqual(["CASE-0002"]);
    expect(report.gates.schemaRejection.pass).toBe(false);
    expect(JSON.stringify(report)).not.toContain("SECRETA");
    expect(JSON.stringify(report)).not.toContain("999.990");
    const { exitCode: reportOnlyCode, report: reportOnlyReport } = runHarness({
      corpusDir: dir,
      reportOnly: true,
      generatedAt: SNAPSHOT_AT,
      analyze: (record) => (record.caseId === "CASE-0002" ? boom() : analyzeCaseRecord(record)),
    });
    expect(reportOnlyCode).toBe(0);
    expect(reportOnlyReport.corpus.caseCount).toBe(2);
  });

  it("pairs per-finding confusion per case, not globally", () => {
    const expectFailOnCompat = (rows) => [
      {
        ...okLabel("R1", rows),
        expertFindings: [
          { dimension: "compatibility", expectedStatus: "fail", expectedFindingIds: ["compat-cpu-mobo-socket"] },
          ...okLabel("R1", rows).expertFindings.slice(1),
        ],
      },
      {
        ...okLabel("R2", rows),
        expertFindings: [
          { dimension: "compatibility", expectedStatus: "fail", expectedFindingIds: ["compat-cpu-mobo-socket"] },
          ...okLabel("R2", rows).expertFindings.slice(1),
        ],
      },
    ];
    const expectOkOnCompat = (rows) => [
      {
        ...okLabel("R1", rows),
        expertFindings: [
          { dimension: "compatibility", expectedStatus: "ok", expectedFindingIds: ["price-freshness-catalog"] },
          ...okLabel("R1", rows).expertFindings.slice(1),
        ],
      },
      {
        ...okLabel("R2", rows),
        expertFindings: [
          { dimension: "compatibility", expectedStatus: "ok", expectedFindingIds: ["price-freshness-catalog"] },
          ...okLabel("R2", rows).expertFindings.slice(1),
        ],
      },
    ];
    const f1Rows = F1_ROWS;
    const f2Rows = F1_ROWS.map((r) => (r.id === "r-cpu" ? { ...r, itemId: "cpu-2", product: "AMD Ryzen 5 7600" } : r));
    const caseA = buildCase({
      caseId: "CASE-0001",
      labels: expectFailOnCompat(f1Rows),
    });
    const caseB = buildCase({
      caseId: "CASE-0002",
      analyzerInput: buildInput({
        quote: { rows: f2Rows },
        catalog: { cpus: [cpuIntel, cpuSparse, cpuAmd] },
      }),
      labels: expectOkOnCompat(f2Rows),
    });
    const dir = makeCorpusDir({ "001.json": caseA, "002.json": caseB });
    const { exitCode, report } = runHarness({ corpusDir: dir, generatedAt: SNAPSHOT_AT });
    expect(exitCode).toBe(0);
    expect(report.metrics.perFindingConfusion["compat-cpu-mobo-socket"]).toEqual({
      expected: 1,
      emitted: 1,
      tp: 0,
      fp: 1,
      fn: 1,
    });
    expect(report.metrics.perFindingConfusion["price-freshness-catalog"]).toEqual({
      expected: 1,
      emitted: 2,
      tp: 1,
      fp: 1,
      fn: 0,
    });
  });

  it("never uses a single reviewer's status as reference and fails the agreement gate", () => {
    const dir = makeCorpusDir({
      "001.json": buildCase({ caseId: "CASE-0001", labels: [okLabel("R1", F1_ROWS)] }),
    });
    const { exitCode, report } = runHarness({ corpusDir: dir, generatedAt: SNAPSHOT_AT });
    expect(exitCode).toBe(1);
    expect(report.metrics.expertAgreementDeterministic).toBeNull();
    expect(report.gates.expertAgreementDeterministic.pass).toBe(false);
    expect(report.metrics.unknownVsOkMatrix).toEqual({});
  });

  it("does not count agreed-unknown dimensions toward the agreement gate", () => {
    const unknownLabels = (rows) => [
      {
        ...okLabel("R1", rows),
        expertFindings: okLabel("R1", rows).expertFindings.map((f) => ({
          ...f,
          expectedStatus: "unknown",
        })),
      },
      {
        ...okLabel("R2", rows),
        expertFindings: okLabel("R2", rows).expertFindings.map((f) => ({
          ...f,
          expectedStatus: "unknown",
        })),
      },
    ];
    const allUnknown = buildCase({ caseId: "CASE-0001", labels: unknownLabels(F1_ROWS) });
    const dir = makeCorpusDir({ "001.json": allUnknown });
    const { exitCode, report } = runHarness({ corpusDir: dir, generatedAt: SNAPSHOT_AT });
    expect(report.metrics.expertAgreementDeterministic).toBeNull();
    expect(report.metrics.unknownVsOkMatrix["unknown->ok"]).toBe(4);
    expect(exitCode).toBe(1);

    const mixed = buildCase({
      caseId: "CASE-0002",
      labels: [
        {
          ...okLabel("R1", F1_ROWS),
          expertFindings: okLabel("R1", F1_ROWS).expertFindings.map((f, index) => ({
            ...f,
            expectedStatus: index <= 1 ? "ok" : "unknown",
          })),
        },
        {
          ...okLabel("R2", F1_ROWS),
          expertFindings: okLabel("R2", F1_ROWS).expertFindings.map((f, index) => ({
            ...f,
            expectedStatus: index === 0 ? "ok" : "unknown",
          })),
        },
      ],
    });
    const mixedDir = makeCorpusDir({ "001.json": mixed });
    const mixedRun = runHarness({ corpusDir: mixedDir, generatedAt: SNAPSHOT_AT });
    expect(mixedRun.report.metrics.expertAgreementDeterministic).toBe(0.5);
  });

  it("rejects a non-ISO generatedAt in runHarness", () => {
    const dir = makeCorpusDir({ "001.json": buildCase({ caseId: "CASE-0001" }) });
    expect(() => runHarness({ corpusDir: dir, generatedAt: "2026" })).toThrow(/ISO 8601/);
  });

  it("redacts raw content by construction", () => {
    const rows = F1_ROWS.map((r) =>
      r.id === "r-gpu"
        ? { ...r, product: "GPU SECRETA X", notes: "secreto@correo.cl", offerPrice: "999.990" }
        : r
    );
    const record = buildCase({ caseId: "CASE-0001", analyzerInput: buildInput({ quote: { rows } }) });
    const dir = makeCorpusDir({
      "001.json": record,
      "002.json": "DUMMYRAWLEAK",
    });
    const { report } = runHarness({ corpusDir: dir, generatedAt: SNAPSHOT_AT });
    const serialized = JSON.stringify(report);
    for (const needle of ["SECRETA", "correo.cl", "999.990", "DUMMYRAWLEAK", "Intel Core i5", "RTX 4060"]) {
      expect(serialized).not.toContain(needle);
    }
  });
});

describe("quoteAnalyzerCorpus — safety and CLI", () => {
  it("assertOutsideRepo rejects repository directories and accepts relative outside paths", () => {
    expect(() => assertOutsideRepo(process.cwd())).toThrow(/dentro del repositorio/);
    expect(() => assertOutsideRepo(path.join(process.cwd(), "plans"))).toThrow(/dentro del repositorio/);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "qa-out-"));
    expect(() => assertOutsideRepo(tmp)).not.toThrow();
    const relative = path.relative(process.cwd(), tmp);
    expect(relative.startsWith("../")).toBe(true);
    expect(() => assertOutsideRepo(relative)).not.toThrow();
  });

  it("parseCliArgs requires --corpus-dir and rejects unknown flags", () => {
    expect(() => parseCliArgs([])).toThrow(/--corpus-dir/);
    expect(() => parseCliArgs(["--bogus"])).toThrow(/Argumento desconocido/);
    expect(() => parseCliArgs(["--corpus-dir"])).toThrow(/Falta el valor/);
    expect(() => parseCliArgs(["--corpus-dir", "--report-only"])).toThrow(/Falta el valor/);
    expect(() => parseCliArgs(["--out"])).toThrow(/Falta el valor/);
    expect(parseCliArgs(["--corpus-dir", "/tmp/x", "--report-only", "--out", "/tmp/r.json"])).toEqual({
      corpusDir: "/tmp/x",
      outPath: "/tmp/r.json",
      reportOnly: true,
      help: false,
      generatedAt: null,
    });
    expect(parseCliArgs(["--help"])).toEqual({
      corpusDir: null,
      outPath: null,
      reportOnly: false,
      help: true,
      generatedAt: null,
    });
    expect(
      parseCliArgs(["--corpus-dir", "/tmp/x", "--generated-at", "2026-08-01T13:00:00.000Z"]).generatedAt
    ).toBe("2026-08-01T13:00:00.000Z");
    expect(() => parseCliArgs(["--corpus-dir", "/tmp/x", "--generated-at", "2026"])).toThrow(/ISO 8601/);
  });

  it("exposes usage text mentioning the mandatory flag", () => {
    expect(USAGE).toContain("--corpus-dir");
    expect(USAGE).toContain("--report-only");
    expect(REQUIRED_COMPONENTS.length).toBe(6);
  });
});
