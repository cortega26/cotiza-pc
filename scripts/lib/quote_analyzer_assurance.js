/**
 * Quote Analyzer automated assurance harness (Plan 035).
 *
 * Implementation-independent conformance, critical negative controls, and
 * private unlabeled coverage measurement for the quote-analyzer/rules/v1
 * contract. The expected-outcome oracle is authored fixture data; this module
 * imports no production decision function (no compatibility.js, no
 * quoteAnalyzer/report.js). The black-box analyzer is injected by the caller.
 *
 * Privacy invariants:
 * - coverage cases carry no labels, reviewer IDs, or expected outcomes;
 * - reports contain only aggregate counts, rates, and pseudonymous IDs
 *   (conformance/coverage case IDs are opaque synthetic identifiers);
 * - failures are reported as case IDs only; raw input is never echoed.
 *
 * Pure module: no Date.now(), no state, no mutation of inputs. All functions
 * are deterministic for identical inputs.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { RULES_VERSION, SCHEMA_VERSION_INPUT, validateAnalyzerInput } from "../../pc-quote-builder/src/lib/quoteAnalyzer/contracts.js";

export const CONFORMANCE_SCHEMA_VERSION = "quote-analyzer-assurance/conformance-case/v1";
export const CONTROL_SCHEMA_VERSION = "quote-analyzer-assurance/negative-control/v1";
export const COVERAGE_SCHEMA_VERSION = "quote-analyzer-assurance/coverage-case/v1";
export const REPORT_SCHEMA_VERSION = "quote-analyzer-assurance/report/v1";
export const RULES_VERSION_STRING = RULES_VERSION;

export const HAZARD_CLASSES = Object.freeze([
  "incompatible-platform",
  "case-fit-hazard",
  "power-insufficiency",
  "connector-insufficiency",
]);

export const CASE_CLASSES = Object.freeze(["ok", "boundary", "unknown", "fail"]);
export const EXPECTED_STATUSES = Object.freeze(["ok", "warning", "fail", "unknown"]);
export const RECRUITMENT_SOURCES = Object.freeze(["direct"]);

export const IDENTITY_RESOLUTION_THRESHOLD = 0.8;
export const MINIMUM_COVERAGE_CASES = 30;

/** v1 dangerous rules covered by assurance (public contract inventory). */
export const ASSURANCE_RULE_IDS = Object.freeze([
  "compat-cpu-mobo-socket",
  "compat-cpu-ram-memory",
  "compat-mobo-ram-memory",
  "compat-mobo-case-ff",
  "compat-gpu-case-length",
  "power-psu-headroom",
  "power-connectors-pcie",
]);

/**
 * Versioned assurance registry (Plan 035 Step 1).
 *
 * Declares for each v1 rule: dimension, decision type, required facts,
 * boundary kind, hazard class, and mandatory fixture classes. This is the
 * conformance contract: a rule is "supported" only when its obligations are
 * satisfied by the committed fixture suite.
 */
/** Facts used only to declare identity-unresolved rows in a conformance case. */
export const IDENTITY_FACTS = Object.freeze([
  "cpu.product",
  "mobo.product",
  "ram.product",
  "gpu.product",
  "psu.product",
  "case.product",
]);

export const ASSURANCE_RULES = Object.freeze(
  Object.fromEntries(
    [
      {
        id: "compat-cpu-mobo-socket",
        dimension: "compatibility",
        decisionType: "deterministic",
        requiredFacts: ["cpu.socket", "mobo.socket"],
        boundaryKind: "equality",
        hazardClass: "incompatible-platform",
      },
      {
        id: "compat-cpu-ram-memory",
        dimension: "compatibility",
        decisionType: "deterministic",
        requiredFacts: ["cpu.memoryType", "ram.type"],
        boundaryKind: "equality",
        hazardClass: "incompatible-platform",
      },
      {
        id: "compat-mobo-ram-memory",
        dimension: "compatibility",
        decisionType: "deterministic",
        requiredFacts: ["ram.type", "mobo.memoryType"],
        boundaryKind: "numeric",
        boundaryFields: ["ram.speed_mts", "mobo.maxMemorySpeedMts"],
        optionalFacts: ["ram.modules", "mobo.memorySlots", "ram.capacityGbTotal", "mobo.maxMemoryGb"],
        hazardClass: "incompatible-platform",
      },
      {
        id: "compat-mobo-case-ff",
        dimension: "caseFit",
        decisionType: "deterministic",
        requiredFacts: ["mobo.formFactor", "case.formFactors"],
        boundaryKind: "membership",
        hazardClass: "case-fit-hazard",
      },
      {
        id: "compat-gpu-case-length",
        dimension: "caseFit",
        decisionType: "deterministic",
        requiredFacts: ["gpu.lengthMm", "case.maxGpuLengthMm"],
        boundaryKind: "numeric",
        boundaryFields: ["gpu.lengthMm", "case.maxGpuLengthMm"],
        hazardClass: "case-fit-hazard",
      },
      {
        id: "power-psu-headroom",
        dimension: "power",
        decisionType: "derived",
        requiredFacts: ["cpu.tdp", "gpu.tdp", "psu.wattage"],
        boundaryKind: "numeric",
        hazardClass: "power-insufficiency",
      },
      {
        id: "power-connectors-pcie",
        dimension: "connectors",
        decisionType: "deterministic",
        requiredFacts: ["psu.connectorCounts", "gpu.powerConnectors"],
        boundaryKind: "count",
        hazardClass: "connector-insufficiency",
      },
    ].map((rule) => [
      rule.id,
      Object.freeze({
        ...rule,
        allowedFacts: Object.freeze([
          ...new Set([...rule.requiredFacts, ...(rule.boundaryFields || []), ...(rule.optionalFacts || []), ...IDENTITY_FACTS]),
        ]),
        requiredClasses: Object.freeze(["ok", "boundary", "unknown", "fail"]),
      }),
    ])
  )
);

/** Units for every supported fact name (Plan 035 Step 1: required fact names and units). */
export const FACT_UNITS = Object.freeze({
  "cpu.socket": "socket identifier",
  "mobo.socket": "socket identifier",
  "cpu.memoryType": "memory type (DDR4/DDR5)",
  "ram.type": "memory type (DDR4/DDR5)",
  "mobo.memoryType": "memory type (DDR4/DDR5)",
  "ram.speed_mts": "MT/s",
  "mobo.maxMemorySpeedMts": "MT/s",
  "ram.modules": "count",
  "mobo.memorySlots": "count",
  "ram.capacityGbTotal": "GB",
  "mobo.maxMemoryGb": "GB",
  "mobo.formFactor": "form factor string",
  "case.formFactors": "array of form factor strings",
  "gpu.lengthMm": "mm",
  "case.maxGpuLengthMm": "mm",
  "cpu.tdp": "W",
  "gpu.tdp": "W",
  "psu.wattage": "W",
  "psu.connectorCounts": 'connector count map, e.g. { "8_pin": 2, "6+2": 0, "12vhpwr": 1 }',
  "gpu.powerConnectors": 'connector requirement string, e.g. "1x 8-pin", "1x 12vhpwr"',
  ...Object.fromEntries(IDENTITY_FACTS.map((fact) => [fact, "free-text product identifier (identity only)"])),
});

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";

const isIsoDate = (value) => {
  if (!isNonEmptyString(value)) return false;
  if (!/^\d{4}-\d{2}-\d{2}/.test(value.trim())) return false;
  return !Number.isNaN(Date.parse(value));
};

const isIsoDateTime = (value) => {
  if (!isNonEmptyString(value)) return false;
  if (!/^\d{4}-\d{2}-\d{2}/.test(value.trim())) return false;
  return !Number.isNaN(Date.parse(value));
};

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

const getRule = (ruleId) => ASSURANCE_RULES[ruleId] || null;

/**
 * Validate a conformance case against the v1 case schema and the registry.
 * @param {object} c conformance case
 * @returns {Array<string>} validation errors (empty when valid)
 */
export function validateConformanceCase(c) {
  const errors = [];
  if (!isPlainObject(c)) return ["conformance case must be an object"];
  if (c.schemaVersion !== CONFORMANCE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be "${CONFORMANCE_SCHEMA_VERSION}"`);
  }
  if (!isNonEmptyString(c.caseId) || !c.caseId.startsWith("CONF-")) {
    errors.push("caseId must start with CONF-");
  }
  if (c.rulesVersion !== RULES_VERSION_STRING) {
    errors.push(`rulesVersion must be "${RULES_VERSION_STRING}"`);
  }
  const rule = getRule(c.ruleId);
  if (!rule) {
    errors.push(`unknown ruleId ${JSON.stringify(c.ruleId)}`);
  } else {
    if (c.dimension !== rule.dimension) errors.push("dimension does not match the rule registry");
    if (c.decisionType !== rule.decisionType) errors.push("decisionType does not match the rule registry");
    if (c.hazardClass !== rule.hazardClass) {
      errors.push("hazardClass does not match the rule registry");
    }
    if (!isPlainObject(c.facts)) {
      errors.push("facts must be an object");
    } else {
      const unknownFacts = Object.keys(c.facts).filter((fact) => !rule.allowedFacts.includes(fact));
      if (unknownFacts.length > 0) {
        errors.push(`facts contain keys outside the rule contract: ${unknownFacts.join(", ")}`);
      }
      for (const fact of Object.keys(c.facts)) {
        if (!(fact in FACT_UNITS)) errors.push(`fact ${fact} has no declared unit`);
      }
    }
  }
  if (!CASE_CLASSES.includes(c.caseClass)) {
    errors.push(`caseClass must be one of ${CASE_CLASSES.join(", ")}`);
  }
  if (!isPlainObject(c.expected) || !EXPECTED_STATUSES.includes(c.expected.status)) {
    errors.push(`expected.status must be one of ${EXPECTED_STATUSES.join(", ")}`);
  } else {
    const { status, findingIds, dangerous } = c.expected;
    if (!Array.isArray(findingIds) || !findingIds.every(isNonEmptyString)) {
      errors.push("expected.findingIds must be an array of strings");
    }
    if (typeof dangerous !== "boolean") {
      errors.push("expected.dangerous must be a boolean");
    }
    if (c.caseClass === "boundary" && status !== "ok" && status !== "warning") {
      errors.push("boundary cases must expect ok or warning");
    }
    if (c.caseClass === "ok" && status !== "ok") errors.push("ok cases must expect ok");
    if (c.caseClass === "fail" && status !== "fail") errors.push("fail cases must expect fail");
    if (c.caseClass === "unknown" && status !== "unknown") errors.push("unknown cases must expect unknown");
    if (status === "ok" && findingIds.length > 0) errors.push("ok cases must not require finding IDs");
    const identityUnresolved =
      status === "unknown" && rule && !rule.requiredFacts.some((fact) => c.facts?.[fact] !== undefined);
    if ((status === "fail" || status === "warning" || (status === "unknown" && !identityUnresolved)) && !findingIds.includes(c.ruleId)) {
      errors.push(`non-ok cases must require the rule finding ${c.ruleId}`);
    }
    if (dangerous) {
      if (status !== "fail") errors.push("dangerous cases must expect fail");
      if (rule && !rule.hazardClass) errors.push("dangerous cases require a hazard class");
    }
    if (status === "unknown") {
      const ruleForUnknown = getRule(c.ruleId);
      const missingRequired = ruleForUnknown
        ? ruleForUnknown.requiredFacts.some((fact) => c.facts?.[fact] === undefined)
        : true;
      if (!missingRequired) {
        errors.push("unknown cases must omit at least one required fact or declare a conflict");
      }
    } else if (rule) {
      const missingRequired = rule.requiredFacts.filter((fact) => c.facts?.[fact] === undefined);
      if (missingRequired.length > 0) {
        errors.push(`non-unknown cases must declare every required fact; missing: ${missingRequired.join(", ")}`);
      }
    }
  }
  if (!isPlainObject(c.analyzerInput)) {
    errors.push("analyzerInput must be an object");
  } else {
    if (c.analyzerInput.schemaVersion !== SCHEMA_VERSION_INPUT) {
      errors.push(`analyzerInput.schemaVersion must be "${SCHEMA_VERSION_INPUT}"`);
    }
    try {
      validateAnalyzerInput(c.analyzerInput);
    } catch (error) {
      errors.push(`analyzerInput is not a valid input/v1 payload: ${error.message}`);
    }
  }
  if (!Array.isArray(c.sourceRefs) || c.sourceRefs.length === 0) {
    errors.push("sourceRefs must be a non-empty array");
  } else {
    c.sourceRefs.forEach((ref) => {
      if (!isPlainObject(ref)) {
        errors.push("each sourceRef must be an object");
        return;
      }
      if (!isNonEmptyString(ref.kind)) errors.push("sourceRef.kind must be a non-empty string");
      if (!isNonEmptyString(ref.ref)) errors.push("sourceRef.ref must be a non-empty string");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ref.reviewedAt || "")) {
        errors.push("sourceRef.reviewedAt must be a YYYY-MM-DD date");
      }
    });
  }
  return errors;
}

/**
 * Validate a negative control against the v1 control schema.
 * @param {object} control negative control
 * @param {Array<object>} conformanceCases loaded conformance cases
 * @returns {Array<string>} validation errors (empty when valid)
 */
export function validateNegativeControl(control, conformanceCases) {
  const errors = [];
  const caseIds = conformanceCases.map((c) => c.caseId);
  if (!isPlainObject(control)) return ["negative control must be an object"];
  if (control.schemaVersion !== CONTROL_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be "${CONTROL_SCHEMA_VERSION}"`);
  }
  if (!isNonEmptyString(control.controlId) || !control.controlId.startsWith("NEG-")) {
    errors.push("controlId must start with NEG-");
  }
  if (!caseIds.includes(control.conformanceCaseId)) {
    errors.push("conformanceCaseId must reference a loaded conformance case");
  }
  if (control.rulesVersion !== RULES_VERSION_STRING) {
    errors.push(`rulesVersion must be "${RULES_VERSION_STRING}"`);
  }
  if (control.mustRejectAs !== "dangerous-false-negative") {
    errors.push('mustRejectAs must be "dangerous-false-negative"');
  }
  if (!isPlainObject(control.mutatedOutput)) {
    errors.push("mutatedOutput must be an object");
  } else {
    const base = conformanceCases.find((c) => c.caseId === control.conformanceCaseId);
    const rule = base ? getRule(base.ruleId) : null;
    if (base && base.expected.dangerous !== true) {
      errors.push("conformanceCaseId must reference a dangerous fail case");
    }
    if (!isPlainObject(control.mutatedOutput.dimensions)) {
      errors.push("mutatedOutput.dimensions must be an object");
    } else if (rule) {
      const mutatedStatus = control.mutatedOutput.dimensions[rule.dimension]?.status;
      if (mutatedStatus !== undefined && mutatedStatus !== null && !EXPECTED_STATUSES.includes(mutatedStatus)) {
        errors.push(`mutatedOutput must use a known status or omit dimension ${rule.dimension}`);
      } else if (mutatedStatus === "fail") {
        errors.push("mutatedOutput must not be a pass (a fail mutation is not unsafe)");
      }
    }
  }
  return errors;
}

/**
 * Validate a private coverage case (Plan 035 Step 6).
 * Strict top-level keys: no labels, reviewer fields, raw product prose,
 * stores, prices, notes, URLs, or contacts outside the analyzer payload.
 * @param {object} c coverage case
 * @returns {Array<string>} validation errors (empty when valid)
 */
export function validateCoverageCase(c) {
  const errors = [];
  if (!isPlainObject(c)) return ["coverage case must be an object"];
  const allowedKeys = [
    "schemaVersion",
    "caseId",
    "quoteSnapshotAt",
    "elapsedMs",
    "recruitmentSource",
    "sampling",
    "analyzerInput",
  ];
  const unknownKeys = Object.keys(c).filter((key) => !allowedKeys.includes(key));
  if (unknownKeys.length > 0) {
    errors.push(`unexpected coverage-case fields: ${unknownKeys.join(", ")}`);
  }
  if (c.schemaVersion !== COVERAGE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be "${COVERAGE_SCHEMA_VERSION}"`);
  }
  if (!isNonEmptyString(c.caseId) || !c.caseId.startsWith("COVERAGE-")) {
    errors.push("caseId must start with COVERAGE-");
  }
  if (!isIsoDateTime(c.quoteSnapshotAt)) {
    errors.push("quoteSnapshotAt must be a valid ISO 8601 date");
  }
  if (c.elapsedMs !== null && !(isFiniteNumber(c.elapsedMs) && c.elapsedMs >= 0)) {
    errors.push("elapsedMs must be null or a non-negative finite number");
  }
  if (!RECRUITMENT_SOURCES.includes(c.recruitmentSource)) {
    errors.push(`recruitmentSource must be one of ${RECRUITMENT_SOURCES.join(", ")}`);
  }
  if (!isPlainObject(c.sampling)) {
    errors.push("sampling must be an object");
  } else {
    for (const key of ["resolutionTarget", "graphics", "completeness", "budgetBand"]) {
      if (!isNonEmptyString(c.sampling[key])) {
        errors.push(`sampling.${key} must be a non-empty string`);
      }
    }
  }
  if (!isPlainObject(c.analyzerInput)) {
    errors.push("analyzerInput must be an object");
  } else {
    if (c.analyzerInput.schemaVersion !== SCHEMA_VERSION_INPUT) {
      errors.push(`analyzerInput.schemaVersion must be "${SCHEMA_VERSION_INPUT}"`);
    }
    try {
      validateAnalyzerInput(c.analyzerInput);
    } catch (error) {
      errors.push(`analyzerInput is not a valid input/v1 payload: ${error.message}`);
    }
  }
  return errors;
}

/**
 * Read JSON documents from a directory, keyed by case ID.
 * @param {string} dir directory path
 * @returns {Map<string, object>} documents by case ID
 */
export function loadJsonCases(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    throw new Error("assurance directory is not readable");
  }
  const documents = new Map();
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(join(dir, entry.name), "utf8"));
    } catch {
      throw new Error("assurance directory contains an unreadable JSON file");
    }
    if (!isPlainObject(parsed)) throw new Error("assurance directory contains a non-object JSON file");
    const caseId = parsed.caseId ?? parsed.controlId ?? parsed.quoteSnapshotAt;
    if (!isNonEmptyString(caseId)) throw new Error("assurance directory contains a document without an ID");
    if (documents.has(caseId)) throw new Error("assurance directory contains duplicate case IDs");
    documents.set(caseId, parsed);
  }
  return documents;
}

/**
 * Load and validate a conformance suite from a directory.
 * @param {string} dir directory containing CONF-*.json and NEG-*.json files
 * @returns {{ cases: Array<object>, controls: Array<object> }}
 */
export function loadConformanceSuite(dir) {
  const documents = loadJsonCases(dir);
  const cases = [];
  const controls = [];
  for (const [caseId, document] of documents) {
    if (document.schemaVersion === CONFORMANCE_SCHEMA_VERSION) {
      const errors = validateConformanceCase(document);
      if (errors.length > 0) throw new Error(`invalid conformance case ${caseId}: ${errors.join("; ")}`);
      cases.push(document);
    } else if (document.schemaVersion === CONTROL_SCHEMA_VERSION) {
      controls.push(document);
    } else {
      throw new Error(`unexpected schemaVersion in assurance directory (case ${caseId})`);
    }
  }
  const caseIds = cases.map((c) => c.caseId);
  for (const control of controls) {
    const errors = validateNegativeControl(control, cases);
    if (errors.length > 0) {
      throw new Error(`invalid negative control ${control.controlId}: ${errors.join("; ")}`);
    }
  }
  return { cases, controls };
}

/**
 * Load and validate a private coverage corpus from a directory.
 * @param {string} dir private coverage corpus directory
 * @returns {Array<object>} coverage cases
 */
export function loadCoverageCorpus(dir) {
  const documents = loadJsonCases(dir);
  const cases = [];
  for (const [caseId, document] of documents) {
    if (document.schemaVersion !== COVERAGE_SCHEMA_VERSION) {
      throw new Error(`unexpected schemaVersion in coverage corpus (case ${caseId})`);
    }
    const errors = validateCoverageCase(document);
    if (errors.length > 0) throw new Error(`invalid coverage case ${caseId}: ${errors.join("; ")}`);
    cases.push(document);
  }
  return cases;
}

/**
 * Analyze one case through the black-box analyzer and return the report,
 * with deterministic-output verification.
 * @param {object} c conformance case
 * @param {(input: object) => object} analyze black-box analyzer
 * @returns {{ ok: boolean, failures: Array<object>, report?: object, caseId: string }}
 */
export function runConformanceCase(c, analyze) {
  const failures = [];
  const rule = getRule(c.ruleId);
  if (!rule) {
    return { ok: false, failures: [{ kind: "unknown-rule", detail: `ruleId ${JSON.stringify(c.ruleId)} is not in the assurance registry` }], caseId: c.caseId };
  }
  let first;
  let second;
  try {
    first = analyze(c.analyzerInput);
  } catch {
    return { ok: false, failures: [{ kind: "analyzer-crash", detail: "analyzer threw" }], caseId: c.caseId };
  }
  try {
    second = analyze(c.analyzerInput);
  } catch {
    return { ok: false, failures: [{ kind: "analyzer-crash", detail: "analyzer threw on rerun" }], caseId: c.caseId };
  }
  if (JSON.stringify(first) !== JSON.stringify(second)) {
    failures.push({ kind: "non-deterministic", detail: "output differs between identical runs" });
  }
  const dimensionStatus = first?.dimensions?.[rule.dimension]?.status ?? null;
  const actualFindingIds = Array.isArray(first?.findings)
    ? first.findings.map((f) => f.id)
    : [];
  const statusMatches = (expected, actual) =>
    expected === "unknown" ? actual === "unknown" || actual === null : actual === expected;
  if (!statusMatches(c.expected.status, dimensionStatus)) {
    failures.push({
      kind: "status-mismatch",
      detail: `dimension ${rule.dimension} expected ${c.expected.status}, observed ${dimensionStatus}`,
    });
  }
  for (const requiredId of c.expected.findingIds) {
    if (!actualFindingIds.includes(requiredId)) {
      failures.push({ kind: "missing-finding", detail: `required finding ${requiredId} absent` });
    }
  }
  if (c.expected.status === "ok" && actualFindingIds.includes(c.ruleId)) {
    failures.push({ kind: "unexpected-finding", detail: `rule ${c.ruleId} must not appear for an ok case` });
  }
  if (c.expected.dangerous && dimensionStatus === "ok") {
    failures.push({ kind: "dangerous-false-negative", detail: `hazard ${rule.hazardClass} reported ok` });
  }
  return { ok: failures.length === 0, failures, report: first, caseId: c.caseId };
}

/**
 * Classify a mutated output as unsafe relative to its base conformance case.
 * Any non-fail verdict on a critical fail case is a dangerous false negative:
 * the hazard is present but was downgraded, hidden, or left undecided.
 * @param {object} mutatedOutput deliberately unsafe output
 * @param {object} baseCase referenced conformance case
 * @returns {string|null} "dangerous-false-negative" or null
 */
export function classifyMutatedOutput(mutatedOutput, baseCase) {
  if (!isPlainObject(mutatedOutput) || !isPlainObject(mutatedOutput.dimensions)) return null;
  const rule = getRule(baseCase.ruleId);
  if (!rule || baseCase.expected.status !== "fail") return null;
  const status = mutatedOutput.dimensions[rule.dimension]?.status;
  if (status !== "fail") return "dangerous-false-negative";
  return null;
}

/**
 * Evaluate a negative control.
 * @param {object} control negative control
 * @param {object} baseCase referenced conformance case
 * @returns {{ rejected: boolean, classification: string|null }}
 */
export function evaluateNegativeControl(control, baseCase) {
  if (!baseCase) return { rejected: false, classification: null };
  const classification = classifyMutatedOutput(control.mutatedOutput, baseCase);
  return { rejected: classification === control.mustRejectAs, classification };
}

/**
 * Compute per-rule class coverage from the committed conformance cases.
 * @param {Array<object>} cases conformance cases
 * @returns {Record<string, Record<string, number>>} rule → class → count
 */
export function computeRuleCoverage(cases) {
  const coverage = {};
  for (const ruleId of ASSURANCE_RULE_IDS) {
    coverage[ruleId] = { ok: 0, boundary: 0, unknown: 0, fail: 0 };
  }
  for (const c of cases) {
    if (!coverage[c.ruleId]) continue;
    coverage[c.ruleId][c.caseClass] = (coverage[c.ruleId][c.caseClass] || 0) + 1;
  }
  return coverage;
}

/**
 * Evaluate the full conformance suite.
 * @param {Array<object>} cases conformance cases
 * @param {Array<object>} controls negative controls
 * @param {(input: object) => object} analyze black-box analyzer
 * @returns {object} conformance evaluation
 */
export function evaluateConformance(cases, controls, analyze) {
  const results = cases.map((c) => runConformanceCase(c, analyze));
  const casesById = new Map(cases.map((c) => [c.caseId, c]));
  const failuresByCase = new Map();
  let criticalFalseNegativeCount = 0;
  for (const result of results) {
    if (result.ok) continue;
    failuresByCase.set(result.caseId, result.failures);
    if (result.failures.some((f) => f.kind === "dangerous-false-negative")) {
      criticalFalseNegativeCount += 1;
    }
  }
  const rejected = [];
  const missed = [];
  for (const control of controls) {
    const base = casesById.get(control.conformanceCaseId);
    const { rejected: isRejected } = evaluateNegativeControl(control, base);
    if (isRejected) rejected.push(control.controlId);
    else missed.push(control.controlId);
  }
  const ruleCoverage = computeRuleCoverage(cases);
  const missingClasses = [];
  for (const [ruleId, counts] of Object.entries(ruleCoverage)) {
    const obligations = ASSURANCE_RULES[ruleId].requiredClasses;
    for (const cls of obligations) {
      if ((counts[cls] || 0) === 0) missingClasses.push(`${ruleId}:${cls}`);
    }
  }
  const missingEvidenceViolations = results.filter(
    (r) => {
      const base = casesById.get(r.caseId);
      return base && base.caseClass === "unknown" && !r.ok;
    }
  ).length;
  return {
    caseCount: cases.length,
    passed: results.filter((r) => r.ok).length,
    failedCaseIds: [...failuresByCase.keys()].sort(),
    ruleCoverage,
    missingClasses,
    missingEvidenceViolations,
    criticalFalseNegativeCount,
    controlCount: controls.length,
    controlsRejected: rejected.length,
    missedControlIds: missed.sort(),
  };
}

/**
 * Compute coverage metrics from a private unlabeled corpus (Plan 035 Step 6).
 * Observed states are coverage outcomes, never ground truth.
 * @param {Array<object>} cases coverage cases
 * @param {(input: object) => object} analyze black-box analyzer
 * @returns {object} coverage report
 */
export function computeCoverageMetrics(cases, analyze) {
  const RESOLVED_STATES = ["exact-id", "user-mapped"];
  const SUPPORTED_STATES = ["exact-id", "user-mapped", "ambiguous", "unmatched-text"];
  let supportedRows = 0;
  let resolvedRows = 0;
  const dimensionStateCounts = {};
  let evidenceTotal = 0;
  let evidenceAssessed = 0;
  const elapsedTimes = [];
  let analyzedCount = 0;
  for (const c of cases) {
    let report;
    try {
      report = analyze(c.analyzerInput);
    } catch {
      continue;
    }
    analyzedCount += 1;
    const states = Object.values(report?.resolution ?? {});
    for (const state of states) {
      if (SUPPORTED_STATES.includes(state)) supportedRows += 1;
      if (RESOLVED_STATES.includes(state)) resolvedRows += 1;
    }
    for (const [dimension, entry] of Object.entries(report?.dimensions ?? {})) {
      const status = entry?.status ?? null;
      if (status !== null) evidenceAssessed += 1;
      evidenceTotal += 1;
      if (status !== null) {
        dimensionStateCounts[status] = (dimensionStateCounts[status] || 0) + 1;
      }
    }
    if (isFiniteNumber(c.elapsedMs)) elapsedTimes.push(c.elapsedMs);
  }
  const sortedElapsed = [...elapsedTimes].sort((a, b) => a - b);
  const medianElapsed =
    sortedElapsed.length === 0
      ? null
      : sortedElapsed.length % 2 === 1
        ? sortedElapsed[(sortedElapsed.length - 1) / 2]
        : (sortedElapsed[sortedElapsed.length / 2 - 1] + sortedElapsed[sortedElapsed.length / 2]) / 2;
  return {
    caseCount: cases.length,
    analyzedCount,
    identityResolutionRate: supportedRows === 0 ? null : resolvedRows / supportedRows,
    resolvedRows,
    supportedRows,
    dimensionStateCounts,
    evidenceCompletenessRate: evidenceTotal === 0 ? null : evidenceAssessed / evidenceTotal,
    timeToVerdictMsMedian: medianElapsed,
  };
}

/**
 * Evaluate all gates (Plan 035 Step 7). A gate without enough data is
 * unevaluable and therefore failing. Coverage gates only apply when a
 * coverage corpus was explicitly requested: the committed synthetic gate
 * must pass with no corpus at all. Exit policy is the caller's (the CLI
 * suppresses exit failure with --report-only; the report still shows the
 * failing gates).
 * @param {object} conformance evaluateConformance result
 * @param {object} coverage computeCoverageMetrics result
 * @returns {object} gates
 */
export function evaluateGates(conformance, coverage, { corpusRequested = false } = {}) {
  const conformanceGate = {
    applicable: true,
    pass: conformance.caseCount > 0 && conformance.passed === conformance.caseCount && conformance.missingClasses.length === 0,
    expected: conformance.caseCount,
    observed: conformance.passed,
  };
  const controlsGate = {
    applicable: true,
    pass: conformance.controlCount > 0 && conformance.controlsRejected === conformance.controlCount,
    expectedRejected: conformance.controlCount,
    observedRejected: conformance.controlsRejected,
  };
  const missingEvidenceGate = {
    applicable: true,
    pass: conformance.missingEvidenceViolations === 0,
    violations: conformance.missingEvidenceViolations,
  };
  const identityGate = {
    applicable: corpusRequested,
    pass:
      !corpusRequested ||
      (coverage.caseCount >= MINIMUM_COVERAGE_CASES &&
        coverage.identityResolutionRate !== null &&
        coverage.identityResolutionRate >= IDENTITY_RESOLUTION_THRESHOLD),
    rate: coverage.identityResolutionRate,
    threshold: IDENTITY_RESOLUTION_THRESHOLD,
  };
  const minimumCasesGate = {
    applicable: corpusRequested,
    pass: !corpusRequested || coverage.caseCount >= MINIMUM_COVERAGE_CASES,
    count: coverage.caseCount,
    threshold: MINIMUM_COVERAGE_CASES,
  };
  return {
    conformance: conformanceGate,
    criticalNegativeControls: controlsGate,
    missingEvidenceIsUnknown: missingEvidenceGate,
    identityResolution: identityGate,
    minimumCoverageCases: minimumCasesGate,
  };
}

/**
 * Build a full assurance report (quote-analyzer-assurance/report/v1).
 * Contains only aggregates, rates, and pseudonymous IDs.
 * @param {object} options
 * @returns {object} report
 */
export function buildAssuranceReport({ generatedAt, conformance, coverage, gates }) {
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt,
    rulesVersion: RULES_VERSION_STRING,
    conformance: {
      caseCount: conformance.caseCount,
      passed: conformance.passed,
      failedCaseIds: conformance.failedCaseIds,
      ruleCoverage: conformance.ruleCoverage,
      criticalFalseNegativeCount: conformance.criticalFalseNegativeCount,
    },
    negativeControls: {
      caseCount: conformance.controlCount,
      rejected: conformance.controlsRejected,
      missedControlIds: conformance.missedControlIds,
    },
    coverageCorpus: {
      caseCount: coverage.caseCount,
      identityResolutionRate: coverage.identityResolutionRate,
      dimensionStateCounts: coverage.dimensionStateCounts,
      evidenceCompletenessRate: coverage.evidenceCompletenessRate,
      timeToVerdictMsMedian: coverage.timeToVerdictMsMedian,
    },
    gates,
    limitations: [
      "No expert validation",
      "No universal real-world false-negative estimate",
      "No gaming-balance validation",
    ],
  };
}

/**
 * Run the full assurance flow.
 * @param {object} options
 * @param {string} options.conformanceDir committed conformance fixture directory
 * @param {string|null} [options.coverageCorpusDir] private corpus directory (never defaulted)
 * @param {(input: object) => object} options.analyze black-box analyzer
 * @param {string} [options.generatedAt] ISO timestamp for the report
 * @returns {{ report: object, gates: object, pass: boolean }}
 */
export function runAssurance({ conformanceDir, coverageCorpusDir = null, analyze, generatedAt }) {
  const corpusRequested = coverageCorpusDir !== null;
  const { cases, controls } = loadConformanceSuite(conformanceDir);
  const conformance = evaluateConformance(cases, controls, analyze);
  const coverageCases = coverageCorpusDir ? loadCoverageCorpus(coverageCorpusDir) : [];
  const coverage = computeCoverageMetrics(coverageCases, analyze);
  const gates = evaluateGates(conformance, coverage, { corpusRequested });
  const allPass = Object.values(gates).every((gate) => !gate.applicable || gate.pass);
  const report = buildAssuranceReport({ generatedAt, conformance, coverage, gates });
  return { report, gates, pass: allPass };
}

/**
 * Parse the CLI argument list.
 * @param {Array<string>} argv process.argv slice
 * @returns {{ conformanceDir: string|null, coverageCorpusDir: string|null, reportOnly: boolean, out: string|null, generatedAt: string|null, error?: string }}
 */
export function parseCliArgs(argv) {
  const args = {
    conformanceDir: null,
    coverageCorpusDir: null,
    reportOnly: false,
    out: null,
    generatedAt: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--report-only") {
      args.reportOnly = true;
    } else if (arg === "--conformance-dir" || arg === "--coverage-corpus-dir" || arg === "--out" || arg === "--generated-at") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        return { ...args, error: `missing value for ${arg}` };
      }
      index += 1;
      if (arg === "--conformance-dir") args.conformanceDir = value;
      else if (arg === "--coverage-corpus-dir") args.coverageCorpusDir = value;
      else if (arg === "--out") args.out = value;
      else args.generatedAt = value;
    } else if (arg.startsWith("-")) {
      return { ...args, error: `unknown option ${arg}` };
    } else {
      return { ...args, error: `unexpected positional argument ${arg}` };
    }
  }
  if (!args.conformanceDir) {
    return { ...args, error: "--conformance-dir is required" };
  }
  if (args.generatedAt !== null && !isIsoDateTime(args.generatedAt)) {
    return { ...args, error: "--generated-at must be a valid ISO 8601 date" };
  }
  return args;
}

export const USAGE = `Usage: node scripts/quote_analyzer_assurance.js --conformance-dir <dir> [--coverage-corpus-dir <dir>] [--report-only] [--out <file>] [--generated-at <ISO>]`;
