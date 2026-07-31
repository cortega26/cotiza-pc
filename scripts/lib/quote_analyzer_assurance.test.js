/**
 * Automated analyzer assurance harness tests (Plan 035).
 *
 * Covers: registry inventory (Step 1), fixture schema validation (Steps 2-3),
 * critical negative controls (Step 4), deterministic property matrices
 * (Step 5), private coverage corpus handling (Step 6), gates (Step 7), CLI
 * behavior, and aggregate-only/redaction invariants.
 */
import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { analyzeQuote } from "../../pc-quote-builder/src/lib/quoteAnalyzer/index.js";
import { DIMENSIONS, RULES_VERSION } from "../../pc-quote-builder/src/lib/quoteAnalyzer/contracts.js";
import {
  ASSURANCE_RULES,
  ASSURANCE_RULE_IDS,
  HAZARD_CLASSES,
  CASE_CLASSES,
  EXPECTED_STATUSES,
  RECRUITMENT_SOURCES,
  IDENTITY_FACTS,
  FACT_UNITS,
  CONFORMANCE_SCHEMA_VERSION,
  CONTROL_SCHEMA_VERSION,
  COVERAGE_SCHEMA_VERSION,
  REPORT_SCHEMA_VERSION,
  IDENTITY_RESOLUTION_THRESHOLD,
  MINIMUM_COVERAGE_CASES,
  validateConformanceCase,
  validateNegativeControl,
  validateCoverageCase,
  loadJsonCases,
  loadConformanceSuite,
  loadCoverageCorpus,
  runConformanceCase,
  classifyMutatedOutput,
  evaluateNegativeControl,
  computeRuleCoverage,
  evaluateConformance,
  computeCoverageMetrics,
  evaluateGates,
  buildAssuranceReport,
  runAssurance,
  parseCliArgs,
  USAGE,
} from "./quote_analyzer_assurance.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const FIXTURE_DIR = fileURLToPath(new URL("../fixtures/quote-analyzer-assurance", import.meta.url));
const REPORT_JS_PATH = fileURLToPath(
  new URL("../../pc-quote-builder/src/lib/quoteAnalyzer/report.js", import.meta.url)
);

const loadFixtureSuite = () => loadConformanceSuite(FIXTURE_DIR);
const caseById = (suite, caseId) => suite.cases.find((c) => c.caseId === caseId);

/** Deterministic clone of a fixture's analyzerInput for matrix runs. */
function inputFrom(caseId) {
  const suite = loadFixtureSuite();
  const c = caseById(suite, caseId);
  return JSON.parse(JSON.stringify(c.analyzerInput));
}

function coverageCase(caseId, analyzerInput) {
  return {
    schemaVersion: COVERAGE_SCHEMA_VERSION,
    caseId,
    quoteSnapshotAt: "2026-07-30T10:00:00.000Z",
    elapsedMs: 12,
    recruitmentSource: "direct",
    sampling: { resolutionTarget: "1080p", graphics: "dedicated", completeness: "complete", budgetBand: "mid" },
    analyzerInput,
  };
}

/** Full-component analyzer input (CPU, GPU, PSU) for coverage and matrix runs. */
function fullInput() {
  return JSON.parse(JSON.stringify(caseById(loadFixtureSuite(), "CONF-PSU-POWER-OK-001").analyzerInput));
}

function withTempDir(run) {
  const dir = mkdtempSync(join(tmpdir(), "assurance-test-"));
  try {
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function writeCases(dir, cases) {
  for (const c of cases) {
    writeFileSync(join(dir, `${c.caseId}.json`), `${JSON.stringify(c, null, 2)}\n`);
  }
}

const FORBIDDEN_REPORT_TERMS = ["Ryzen", "Corsair", "RTX 4070", "B550", "CORSARIO", "/private/", "no listada"];

describe("registry inventory (Plan 035 Step 1)", () => {
  it("covers exactly the seven v1 dangerous rules with stable metadata", () => {
    expect(ASSURANCE_RULE_IDS).toHaveLength(7);
    expect(Object.keys(ASSURANCE_RULES).sort()).toEqual([...ASSURANCE_RULE_IDS].sort());
    for (const ruleId of ASSURANCE_RULE_IDS) {
      const rule = ASSURANCE_RULES[ruleId];
      expect(rule).toBeDefined();
      expect(DIMENSIONS).toContain(rule.dimension);
      expect(["deterministic", "derived"]).toContain(rule.decisionType);
      expect(HAZARD_CLASSES).toContain(rule.hazardClass);
      expect(rule.requiredClasses).toEqual(CASE_CLASSES);
      expect(rule.requiredFacts.length).toBeGreaterThan(0);
    }
  });

  it("declares a unit and an allowed-fact contract for every supported fact", () => {
    for (const rule of Object.values(ASSURANCE_RULES)) {
      for (const fact of rule.allowedFacts) {
        expect(FACT_UNITS[fact], `${rule.id}: fact ${fact} has no unit`).toBeDefined();
      }
      for (const fact of rule.requiredFacts) {
        expect(rule.allowedFacts).toContain(fact);
      }
      for (const identityFact of IDENTITY_FACTS) {
        expect(rule.allowedFacts).toContain(identityFact);
      }
    }
  });

  it("fails when an Analyzer v1 critical rule is missing from the registry", () => {
    const reportSource = readFileSync(REPORT_JS_PATH, "utf8");
    const findingIds = [...reportSource.matchAll(/id: "([^"]+)"/g)].map((m) => m[1]);
    const dangerousIds = findingIds.filter(
      (id) => (id.startsWith("compat-") || id.startsWith("power-")) && !ASSURANCE_RULES[id]
    );
    expect(dangerousIds).toEqual([]);
  });

  it("has no duplicate fact names within a rule", () => {
    for (const rule of Object.values(ASSURANCE_RULES)) {
      expect(new Set(rule.allowedFacts).size).toBe(rule.allowedFacts.length);
      expect(new Set(rule.requiredFacts).size).toBe(rule.requiredFacts.length);
    }
  });
});

describe("conformance-case schema validation", () => {
  const valid = () => {
    const suite = loadFixtureSuite();
    return JSON.parse(JSON.stringify(caseById(suite, "CONF-CPU-SOCKET-OK-001")));
  };

  it("accepts the committed cases", () => {
    for (const c of loadFixtureSuite().cases) {
      expect(validateConformanceCase(c), c.caseId).toEqual([]);
    }
  });

  it("rejects a wrong schema version, ID prefix, and rules version", () => {
    expect(validateConformanceCase({ ...valid(), schemaVersion: "old" }).join(";")).toContain("schemaVersion");
    expect(validateConformanceCase({ ...valid(), caseId: "BAD-1" }).join(";")).toContain("CONF-");
    expect(validateConformanceCase({ ...valid(), rulesVersion: "quote-analyzer/rules/v2" }).join(";")).toContain(
      RULES_VERSION
    );
  });

  it("rejects an unknown rule, unknown fact, and unmapped dimension/decisionType/hazard", () => {
    expect(validateConformanceCase({ ...valid(), ruleId: "fake-rule" }).join(";")).toContain("unknown ruleId");
    const badFact = { ...valid(), facts: { ...valid().facts, "cpu.socketExtra": "AM4" } };
    expect(validateConformanceCase(badFact).join(";")).toContain("outside the rule contract");
    const wrongDimension = { ...valid(), dimension: "power" };
    expect(validateConformanceCase(wrongDimension).join(";")).toContain("dimension does not match");
    const wrongDecision = { ...valid(), decisionType: "derived" };
    expect(validateConformanceCase(wrongDecision).join(";")).toContain("decisionType does not match");
    const wrongHazard = { ...valid(), hazardClass: "power-insufficiency" };
    expect(validateConformanceCase(wrongHazard).join(";")).toContain("hazardClass does not match");
  });

  it("rejects unsupported states and class/status contradictions", () => {
    expect(validateConformanceCase({ ...valid(), expected: { ...valid().expected, status: "perfect" } }).join(";")).toContain(
      "expected.status"
    );
    expect(validateConformanceCase({ ...valid(), caseClass: "meh" }).join(";")).toContain("caseClass");
    expect(
      validateConformanceCase({
        ...valid(),
        caseClass: "boundary",
        expected: { status: "fail", findingIds: ["compat-cpu-mobo-socket"], dangerous: true },
      }).join(";")
    ).toContain("boundary cases must expect ok or warning");
    expect(
      validateConformanceCase({ ...valid(), expected: { status: "ok", findingIds: ["compat-cpu-mobo-socket"], dangerous: false } }).join(";")
    ).toContain("must not require finding IDs");
  });

  it("rejects dangerous expectations that are not fail and fails that are not dangerous-critical", () => {
    const dangerousWarning = {
      ...valid(),
      caseClass: "boundary",
      expected: { status: "warning", findingIds: ["compat-cpu-mobo-socket"], dangerous: true },
    };
    expect(validateConformanceCase(dangerousWarning).join(";")).toContain("dangerous cases must expect fail");
    const failNotDangerous = {
      ...valid(),
      caseClass: "fail",
      expected: { status: "fail", findingIds: [], dangerous: false },
    };
    expect(validateConformanceCase(failNotDangerous).join(";")).toContain("require the rule finding");
  });

  it("enforces evidence presence rules: unknown omits a required fact, others declare all", () => {
    const suite = loadFixtureSuite();
    const unknown = caseById(suite, "CONF-CPU-SOCKET-UNKNOWN-001");
    const completeFacts = {
      ...unknown,
      facts: { ...unknown.facts, "mobo.socket": "AM4" },
    };
    expect(validateConformanceCase(completeFacts).join(";")).toContain("omit at least one required fact");

    const okMissingFact = {
      ...valid(),
      facts: { "cpu.socket": "AM4" },
    };
    expect(validateConformanceCase(okMissingFact).join(";")).toContain("must declare every required fact");
  });

  it("rejects incomplete provenance and malformed analyzer inputs", () => {
    const noRef = { ...valid(), sourceRefs: [] };
    expect(validateConformanceCase(noRef).join(";")).toContain("non-empty");
    const badReviewedAt = {
      ...valid(),
      sourceRefs: [{ kind: "synthetic-boundary", ref: "x", reviewedAt: "2026/07/31" }],
    };
    expect(validateConformanceCase(badReviewedAt).join(";")).toContain("YYYY-MM-DD");
    const badInput = { ...valid(), analyzerInput: { ...valid().analyzerInput, schemaVersion: "wrong" } };
    expect(validateConformanceCase(badInput).join(";")).toContain("analyzerInput is not a valid input/v1 payload");
  });
});

describe("negative-control schema validation", () => {
  const suite = () => loadFixtureSuite();
  const valid = () => {
    const s = suite();
    return s.controls[0];
  };

  it("accepts the committed controls", () => {
    const s = suite();
    for (const control of s.controls) {
      expect(validateNegativeControl(control, s.cases), control.controlId).toEqual([]);
    }
  });

  it("rejects bad IDs, missing references, wrong versions, and wrong rejection kind", () => {
    const s = suite();
    expect(validateNegativeControl({ ...valid(), controlId: "NO-1" }, s.cases).join(";")).toContain("NEG-");
    expect(validateNegativeControl({ ...valid(), conformanceCaseId: "CONF-NOPE" }, s.cases).join(";")).toContain(
      "must reference"
    );
    expect(validateNegativeControl({ ...valid(), rulesVersion: "quote-analyzer/rules/v2" }, s.cases).join(";")).toContain(
      "rulesVersion"
    );
    expect(validateNegativeControl({ ...valid(), mustRejectAs: "unsafe" }, s.cases).join(";")).toContain(
      "dangerous-false-negative"
    );
  });

  it("rejects malformed or non-unsafe mutated outputs", () => {
    const s = suite();
    expect(validateNegativeControl({ ...valid(), mutatedOutput: { status: "ok" } }, s.cases).join(";")).toContain(
      "dimensions"
    );
    const safeMutation = {
      ...valid(),
      mutatedOutput: { dimensions: { compatibility: { status: "fail", severity: "critical" } } },
    };
    expect(validateNegativeControl(safeMutation, s.cases).join(";")).toContain("must not be a pass");
    const unknownStatus = {
      ...valid(),
      mutatedOutput: { dimensions: { compatibility: { status: "banana" } } },
    };
    expect(validateNegativeControl(unknownStatus, s.cases).join(";")).toContain("known status");
  });
});

describe("coverage-case schema validation", () => {
  it("accepts a valid coverage case and rejects banned fields", () => {
    const base = loadFixtureSuite().cases[0].analyzerInput;
    const valid = coverageCase("COVERAGE-VALID", base);
    expect(validateCoverageCase(valid)).toEqual([]);
    for (const bannedKey of ["labels", "reviewerId", "notes", "stores", "prices", "urls", "contacts"]) {
      const bad = { ...valid, [bannedKey]: { anything: true } };
      expect(validateCoverageCase(bad).join(";"), bannedKey).toContain("unexpected coverage-case fields");
    }
  });

  it("rejects missing sampling, unsupported recruitment source, and malformed input", () => {
    const valid = coverageCase("COVERAGE-VALID", loadFixtureSuite().cases[0].analyzerInput);
    const { sampling, ...noSampling } = valid;
    expect(validateCoverageCase(noSampling).join(";")).toContain("sampling");
    expect(validateCoverageCase({ ...valid, recruitmentSource: "crowd" }).join(";")).toContain("recruitmentSource");
    expect(validateCoverageCase({ ...valid, caseId: "C-1" }).join(";")).toContain("COVERAGE-");
    expect(validateCoverageCase({ ...valid, elapsedMs: -5 }).join(";")).toContain("elapsedMs");
  });
});

describe("fixture suite integrity", () => {
  it("loads 44 conformance cases and 7 negative controls from the committed directory", () => {
    const { cases, controls } = loadFixtureSuite();
    expect(cases).toHaveLength(44);
    expect(controls).toHaveLength(7);
  });

  it("covers every required class for every rule", () => {
    const { cases } = loadFixtureSuite();
    const coverage = computeRuleCoverage(cases);
    const missing = [];
    for (const [ruleId, counts] of Object.entries(coverage)) {
      for (const cls of ASSURANCE_RULES[ruleId].requiredClasses) {
        if ((counts[cls] || 0) === 0) missing.push(`${ruleId}:${cls}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("rejects duplicated case IDs in a directory", () => {
    withTempDir((dir) => {
      const c = coverageCase("COVERAGE-1", loadFixtureSuite().cases[0].analyzerInput);
      writeFileSync(join(dir, "a.json"), `${JSON.stringify(c, null, 2)}\n`);
      writeFileSync(join(dir, "b.json"), `${JSON.stringify({ ...c, quoteSnapshotAt: "2026-07-29T10:00:00.000Z" }, null, 2)}\n`);
      expect(() => loadJsonCases(dir)).toThrow("duplicate case IDs");
    });
  });
});

describe("black-box conformance execution (Steps 2-3)", () => {
  it("passes every committed conformance case through the real analyzer", () => {
    const { cases } = loadFixtureSuite();
    const results = cases.map((c) => runConformanceCase(c, analyzeQuote));
    const failures = results.filter((r) => !r.ok);
    expect(failures).toEqual([]);
  });

  it("is deterministic: identical input produces byte-identical output", () => {
    const input = inputFrom("CONF-PSU-POWER-OK-001");
    expect(JSON.stringify(analyzeQuote(input))).toBe(JSON.stringify(analyzeQuote(input)));
  });

  it("is stable under row-order permutation", () => {
    const input = inputFrom("CONF-PSU-POWER-OK-001");
    const reversed = JSON.parse(JSON.stringify(input));
    reversed.quote.rows = [...input.quote.rows].reverse();
    const report = analyzeQuote(input);
    const permuted = analyzeQuote(reversed);
    expect(permuted.verdict).toEqual(report.verdict);
    expect(permuted.dimensions).toEqual(report.dimensions);
  });

  it("fails a fixture with a case-ID-only message and no raw input echo", () => {
    const suite = loadFixtureSuite();
    const mutated = JSON.parse(JSON.stringify(caseById(suite, "CONF-CPU-SOCKET-OK-001")));
    mutated.expected.status = "fail";
    mutated.expected.findingIds = ["compat-cpu-mobo-socket"];
    mutated.expected.dangerous = true;
    const result = runConformanceCase(mutated, analyzeQuote);
    expect(result.ok).toBe(false);
    expect(result.caseId).toBe("CONF-CPU-SOCKET-OK-001");
    const failureText = JSON.stringify(result.failures);
    expect(failureText).toContain("status-mismatch");
    for (const term of FORBIDDEN_REPORT_TERMS) {
      expect(failureText).not.toContain(term);
    }
  });

  it("reports analyzer crashes as conformance failures", () => {
    const suite = loadFixtureSuite();
    const c = caseById(suite, "CONF-CPU-SOCKET-OK-001");
    const result = runConformanceCase(c, () => {
      throw new Error("boom");
    });
    expect(result.ok).toBe(false);
    expect(result.failures[0].kind).toBe("analyzer-crash");
  });

  it("flags non-deterministic analyzers", () => {
    const suite = loadFixtureSuite();
    const c = caseById(suite, "CONF-CPU-SOCKET-OK-001");
    let calls = 0;
    const flaky = (input) => {
      calls += 1;
      return calls === 1 ? analyzeQuote(input) : { ...analyzeQuote(input), verdict: { overall: "ok" } };
    };
    const result = runConformanceCase(c, flaky);
    expect(result.failures.map((f) => f.kind)).toContain("non-deterministic");
  });
});

describe("property matrices (Step 5)", () => {
  it("unequal sockets are never ok, equal sockets are ok", () => {
    const sockets = ["AM4", "AM5", "LGA1700"];
    for (const cpuSocket of sockets) {
      for (const moboSocket of sockets) {
        const input = inputFrom("CONF-CPU-SOCKET-OK-001");
        input.catalog.cpus[0].socket = cpuSocket;
        input.catalog.motherboards[0].socket = moboSocket;
        const status = analyzeQuote(input).dimensions.compatibility.status;
        if (cpuSocket === moboSocket) {
          expect(status, `${cpuSocket}/${moboSocket}`).toBe("ok");
        } else {
          expect(status, `${cpuSocket}/${moboSocket}`).toBe("fail");
        }
      }
    }
  });

  it("GPU length boundary: below, exact, and above fit", () => {
    const expectations = [
      [0, "unknown"],
      [299, "ok"],
      [300, "ok"],
      [301, "fail"],
      [500, "fail"],
    ];
    for (const [lengthMm, expected] of expectations) {
      const input = inputFrom("CONF-GPU-CASE-BOUNDARY-001");
      input.catalog.gpus[0].board_length_mm = lengthMm;
      expect(analyzeQuote(input).dimensions.caseFit.status, `${lengthMm}mm`).toBe(expected);
    }
  });

  it("PSU wattage sweep: fail under load, warning below recommendation, ok at/above it", () => {
    const expectations = [
      [299, "fail"],
      [314, "fail"],
      [315, "warning"],
      [316, "warning"],
      [364, "warning"],
      [499, "warning"],
      [500, "ok"],
      [501, "ok"],
      [650, "ok"],
    ];
    for (const [wattage, expected] of expectations) {
      const input = inputFrom("CONF-PSU-POWER-OK-001");
      input.catalog.psus[0].wattage = wattage;
      expect(analyzeQuote(input).dimensions.power.status, `${wattage}W`).toBe(expected);
    }
  });

  it("deleting evidence never produces ok", () => {
    const socketInput = inputFrom("CONF-CPU-SOCKET-OK-001");
    socketInput.quote.rows[0] = { id: "r-cpu", category: "Procesador", product: "procesador no listado" };
    expect(analyzeQuote(socketInput).dimensions.compatibility.status).not.toBe("ok");

    const powerInput = inputFrom("CONF-PSU-POWER-OK-001");
    powerInput.quote.rows = powerInput.quote.rows.filter((row) => row.category !== "Fuente de poder");
    expect(analyzeQuote(powerInput).dimensions.power.status).not.toBe("ok");
  });
});

describe("negative controls (Step 4)", () => {
  it("classifies every committed control as a dangerous false negative", () => {
    const { cases, controls } = loadFixtureSuite();
    for (const control of controls) {
      const base = caseById({ cases, controls: [] }, control.conformanceCaseId);
      const { rejected, classification } = evaluateNegativeControl(control, base);
      expect(rejected, control.controlId).toBe(true);
      expect(classification).toBe("dangerous-false-negative");
    }
  });

  it("classifies ok, warning, and unknown downgrades as dangerous; a fail mutation is not", () => {
    const suite = loadFixtureSuite();
    const base = caseById(suite, "CONF-CPU-SOCKET-FAIL-001");
    for (const status of ["ok", "warning", "unknown"]) {
      expect(
        classifyMutatedOutput({ dimensions: { compatibility: { status } } }, base),
        status
      ).toBe("dangerous-false-negative");
    }
    expect(classifyMutatedOutput({ dimensions: { compatibility: { status: "fail" } } }, base)).toBeNull();
  });

  it("does not classify mutations against non-fail base cases", () => {
    const suite = loadFixtureSuite();
    const base = caseById(suite, "CONF-CPU-SOCKET-OK-001");
    expect(classifyMutatedOutput({ dimensions: { compatibility: { status: "ok" } } }, base)).toBeNull();
  });

  it("a missed control is a gate failure", () => {
    const suite = loadFixtureSuite();
    const broken = JSON.parse(JSON.stringify(suite.controls[0]));
    const dimension = Object.keys(broken.mutatedOutput.dimensions)[0];
    broken.mutatedOutput.dimensions[dimension].status = "fail";
    const evaluation = evaluateConformance(suite.cases, [broken], analyzeQuote);
    expect(evaluation.controlsRejected).toBe(0);
    expect(evaluation.missedControlIds).toEqual([broken.controlId]);
    const gates = evaluateGates(evaluation, { caseCount: 0 }, { corpusRequested: false });
    expect(gates.criticalNegativeControls.pass).toBe(false);
  });
});

describe("coverage corpus (Step 6)", () => {
  const suiteCases = () => loadFixtureSuite().cases;

  it("loads an empty corpus without error and reports null rates", () => {
    withTempDir((dir) => {
      const cases = loadCoverageCorpus(dir);
      expect(cases).toEqual([]);
      const metrics = computeCoverageMetrics([], analyzeQuote);
      expect(metrics.identityResolutionRate).toBeNull();
      expect(metrics.caseCount).toBe(0);
    });
  });

  it("rejects malformed files, mixed versions, and documents without IDs", () => {
    withTempDir((dir) => {
      writeFileSync(join(dir, "broken.json"), "{ not json");
      expect(() => loadCoverageCorpus(dir)).toThrow("unreadable JSON");
    });
    withTempDir((dir) => {
      const c = coverageCase("COVERAGE-1", fullInput());
      writeCases(dir, [c, { ...c, schemaVersion: "quote-analyzer-assurance/coverage-case/v9" }]);
      expect(() => loadCoverageCorpus(dir)).toThrow("unexpected schemaVersion");
    });
    withTempDir((dir) => {
      writeCases(dir, [{ ...coverageCase("COVERAGE-1", fullInput()), caseId: 42 }]);
      expect(() => loadCoverageCorpus(dir)).toThrow("without an ID");
    });
  });

  it("measures identity resolution over exact-id and unmatched rows", () => {
    withTempDir((dir) => {
      const inputs = [fullInput()];
      const unresolved = JSON.parse(JSON.stringify(fullInput()));
      unresolved.quote.rows[0] = { id: "r-cpu", category: "Procesador", product: "procesador no listado" };
      inputs.push(unresolved);
      const cases = inputs.map((analyzerInput, index) => coverageCase(`COVERAGE-${index + 1}`, analyzerInput));
      writeCases(dir, cases);
      const loaded = loadCoverageCorpus(dir);
      const metrics = computeCoverageMetrics(loaded, analyzeQuote);
      expect(metrics.caseCount).toBe(2);
      expect(metrics.analyzedCount).toBe(2);
      expect(metrics.resolvedRows).toBe(5);
      expect(metrics.supportedRows).toBe(6);
      expect(metrics.identityResolutionRate).toBeCloseTo(5 / 6);
      expect(metrics.dimensionStateCounts).toBeDefined();
    });
  });
});

describe("gates and report (Step 7)", () => {
  const runWithCorpus = (count, reportOnly) =>
    withTempDir((dir) => {
      const inputs = [];
      for (let index = 0; index < count; index += 1) {
        inputs.push(coverageCase(`COVERAGE-${index + 1}`, JSON.parse(JSON.stringify(fullInput()))));
      }
      writeCases(dir, inputs);
      return runAssurance({
        conformanceDir: FIXTURE_DIR,
        coverageCorpusDir: dir,
        analyze: analyzeQuote,
        reportOnly,
        generatedAt: "2026-08-01T00:00:00.000Z",
      });
    });

  it("passes the synthetic gate without any coverage corpus", () => {
    const { pass, gates } = runAssurance({
      conformanceDir: FIXTURE_DIR,
      analyze: analyzeQuote,
      generatedAt: "2026-08-01T00:00:00.000Z",
    });
    expect(pass).toBe(true);
    expect(gates.conformance.pass).toBe(true);
    expect(gates.criticalNegativeControls.pass).toBe(true);
    expect(gates.missingEvidenceIsUnknown.pass).toBe(true);
    expect(gates.identityResolution.applicable).toBe(false);
    expect(gates.minimumCoverageCases.applicable).toBe(false);
  });

  it("fails coverage gates when the corpus is too small, unless report-only", () => {
    const small = runWithCorpus(2, false);
    expect(small.gates.minimumCoverageCases.pass).toBe(false);
    expect(small.gates.identityResolution.pass).toBe(false);
    expect(small.pass).toBe(false);

    const lenient = runWithCorpus(2, true);
    expect(lenient.gates.minimumCoverageCases.pass).toBe(false);
    expect(lenient.pass).toBe(false);
  });

  it("passes every gate with at least 30 resolved coverage cases", () => {
    const { pass, gates } = runWithCorpus(MINIMUM_COVERAGE_CASES, false);
    expect(pass).toBe(true);
    expect(gates.identityResolution.pass).toBe(true);
    expect(gates.identityResolution.rate).toBeGreaterThanOrEqual(IDENTITY_RESOLUTION_THRESHOLD);
    expect(gates.minimumCoverageCases.pass).toBe(true);
  });

  it("builds a report that matches the aggregate-only contract and leaks nothing", () => {
    withTempDir((dir) => {
      writeCases(dir, [coverageCase("COVERAGE-1", JSON.parse(JSON.stringify(fullInput())))]);
      const { report } = runAssurance({
        conformanceDir: FIXTURE_DIR,
        coverageCorpusDir: dir,
        analyze: analyzeQuote,
        generatedAt: "2026-08-01T00:00:00.000Z",
      });
      expect(report.schemaVersion).toBe(REPORT_SCHEMA_VERSION);
      expect(report.rulesVersion).toBe(RULES_VERSION);
      expect(report.conformance.caseCount).toBe(44);
      expect(report.conformance.passed).toBe(44);
      expect(report.conformance.failedCaseIds).toEqual([]);
      expect(report.conformance.criticalFalseNegativeCount).toBe(0);
      expect(report.negativeControls.rejected).toBe(7);
      expect(report.coverageCorpus.caseCount).toBe(1);
      expect(report.gates.conformance.pass).toBe(true);
      expect(Array.isArray(report.limitations)).toBe(true);
      const serialized = JSON.stringify(report);
      for (const term of FORBIDDEN_REPORT_TERMS) {
        expect(serialized).not.toContain(term);
      }
    });
  });

  it("counts missing-evidence violations and fails the unknown gate when an unknown case is not unknown", () => {
    const suite = loadFixtureSuite();
    const broken = JSON.parse(JSON.stringify(caseById(suite, "CONF-CPU-SOCKET-UNKNOWN-001")));
    broken.expected.status = "ok";
    broken.expected.findingIds = [];
    const evaluation = evaluateConformance([broken], [], analyzeQuote);
    expect(evaluation.missingEvidenceViolations).toBe(1);
    const gates = evaluateGates(evaluation, { caseCount: 0 }, { corpusRequested: false });
    expect(gates.missingEvidenceIsUnknown.pass).toBe(false);
  });
});

describe("CLI argument parsing", () => {
  it("requires --conformance-dir and rejects unknown options", () => {
    expect(parseCliArgs([]).error).toContain("--conformance-dir is required");
    expect(parseCliArgs(["--conformance-dir"]).error).toContain("missing value");
    expect(parseCliArgs(["--conformance-dir", "x", "--bogus"]).error).toContain("unknown option");
    expect(parseCliArgs(["--conformance-dir", "x", "positional"]).error).toContain("positional argument");
    expect(
      parseCliArgs(["--conformance-dir", "x", "--generated-at", "yesterday"]).error
    ).toContain("ISO 8601");
  });

  it("parses the supported options", () => {
    const args = parseCliArgs([
      "--conformance-dir",
      FIXTURE_DIR,
      "--coverage-corpus-dir",
      "/private/corpus",
      "--report-only",
      "--out",
      "/tmp/report.json",
      "--generated-at",
      "2026-08-01T00:00:00.000Z",
    ]);
    expect(args.error).toBeUndefined();
    expect(args.conformanceDir).toBe(FIXTURE_DIR);
    expect(args.coverageCorpusDir).toBe("/private/corpus");
    expect(args.reportOnly).toBe(true);
    expect(args.out).toBe("/tmp/report.json");
    expect(args.generatedAt).toBe("2026-08-01T00:00:00.000Z");
  });
});

describe("CLI integration", () => {
  const cliPath = join(ROOT, "scripts", "quote_analyzer_assurance.js");
  const runCli = (args, cwd = ROOT) =>
    spawnSync(process.execPath, [cliPath, ...args], { cwd, encoding: "utf8" });

  it("exits 0 on the synthetic gate and emits an aggregate-only report", () => {
    const result = runCli(["--conformance-dir", FIXTURE_DIR, "--generated-at", "2026-08-01T00:00:00.000Z"]);
    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report.conformance.passed).toBe(44);
    expect(report.gates.conformance.pass).toBe(true);
    expect(report.gates.minimumCoverageCases.applicable).toBe(false);
    for (const term of FORBIDDEN_REPORT_TERMS) {
      expect(result.stdout).not.toContain(term);
    }
  });

  it("exits 2 with usage when --conformance-dir is missing", () => {
    const result = runCli([]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("--conformance-dir is required");
    expect(result.stderr).toContain(USAGE.split("\n")[0]);
  });

  it("exits 2 when the conformance directory is unreadable", () => {
    const result = runCli(["--conformance-dir", join(ROOT, "no-such-dir")]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("not readable");
  });

  it("exits 1 in normal mode and 0 with --report-only on an incomplete corpus", () => {
    withTempDir((dir) => {
      writeCases(dir, [coverageCase("COVERAGE-1", JSON.parse(JSON.stringify(fullInput())))]);
      const strict = runCli(["--conformance-dir", FIXTURE_DIR, "--coverage-corpus-dir", dir]);
      expect(strict.status).toBe(1);
      const lenient = runCli([
        "--conformance-dir",
        FIXTURE_DIR,
        "--coverage-corpus-dir",
        dir,
        "--report-only",
      ]);
      expect(lenient.status).toBe(0);
    });
  });
});
