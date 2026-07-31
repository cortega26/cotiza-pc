/**
 * Offline corpus harness for the Quote Analyzer (Plan 029).
 *
 * Pure module: no module-level state, no network, no mutation of inputs.
 * Reads a private corpus directory supplied by the operator, validates every
 * case against the versioned corpus/label schemas, runs the exported pure
 * analyzeQuote on each case, and emits aggregate counts/rates plus
 * pseudonymous failing case IDs ONLY.
 *
 * Redaction by construction: the report builder consumes a whitelist of
 * fields (caseId, verdict, counts, rates). Raw quote text, product names,
 * notes, prices, contacts, and full rows never reach the serialized report
 * or error messages.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { analyzeQuote } from "../../pc-quote-builder/src/lib/quoteAnalyzer/index.js";
import {
  normalizeCategory,
  REQUIRED_COMPONENTS,
  validateAnalyzerInput,
} from "../../pc-quote-builder/src/lib/quoteAnalyzer/contracts.js";

export const CASE_SCHEMA_VERSION = "quote-analyzer-corpus/case/v1";
export const LABEL_SCHEMA_VERSION = "quote-analyzer-corpus/label/v1";
export const REPORT_SCHEMA_VERSION = "quote-analyzer-corpus/report/v1";

export const GATES = Object.freeze({
  identityResolution: { threshold: 0.8 },
  expertAgreementDeterministic: { threshold: 0.95 },
  expertAgreementTopConcern: { threshold: 0.8 },
  dangerousFalseNegatives: { threshold: 0 },
  schemaRejection: { threshold: 0 },
});

const IDENTITY_STATES = Object.freeze(["exact-id", "user-mapped", "ambiguous", "unmatched", "out-of-scope"]);
const EXPERT_DIMENSIONS = Object.freeze(["compatibility", "power", "connectors", "caseFit"]);
const DIMENSION_STATUSES = Object.freeze(["ok", "warning", "fail", "unknown"]);
const CONCERN_VALUES = Object.freeze(["power", "cooling", "price", "connectivity", "space", "other"]);
const ACTION_VALUES = Object.freeze(["keep", "change", "reject", "negotiate", "compare", "defer"]);
const CONFIDENCE_VALUES = Object.freeze(["high", "medium", "low"]);

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const unique = (values) => [...new Set(values)];

const isValidIsoDate = (value) => {
  if (typeof value !== "string" || value.trim() === "") return false;
  if (!/^\d{4}-\d{2}-\d{2}/.test(value.trim())) return false;
  return !Number.isNaN(Date.parse(value));
};

/** Static, content-free error messages (never echo raw case data). */
const err = (caseId, message) => new Error(`${message} (caso ${caseId})`);

/**
 * Validate one corpus case record against the versioned schemas.
 * Never includes raw content in thrown messages. Does not mutate input.
 * @param {unknown} record
 */
export function validateCase(record) {
  if (!isPlainObject(record)) throw new Error("Caso inválido: se esperaba un objeto.");
  if (record.schemaVersion !== CASE_SCHEMA_VERSION) {
    throw new Error(`Esquema de caso no soportado: se esperaba "${CASE_SCHEMA_VERSION}".`);
  }
  const caseId = record.caseId;
  if (typeof caseId !== "string" || caseId.trim() === "") {
    throw new Error("Caso inválido: falta caseId.");
  }
  if (!isPlainObject(record.analyzerInput)) {
    throw err(caseId, "Caso inválido: falta analyzerInput.");
  }
  validateAnalyzerInput(record.analyzerInput);

  if (record.quoteSnapshotAt !== undefined && record.quoteSnapshotAt !== null) {
    if (!isValidIsoDate(record.quoteSnapshotAt)) {
      throw err(caseId, "Caso inválido: quoteSnapshotAt debe ser una fecha ISO 8601.");
    }
  }
  if (record.elapsedMs !== undefined && record.elapsedMs !== null) {
    if (
      typeof record.elapsedMs !== "number" ||
      !Number.isFinite(record.elapsedMs) ||
      record.elapsedMs < 0
    ) {
      throw err(caseId, "Caso inválido: elapsedMs debe ser un número no negativo.");
    }
  }

  if (!Array.isArray(record.labels)) throw err(caseId, "Caso inválido: falta labels.");
  if (record.labels.length === 0) {
    throw err(caseId, "Caso inválido: se requiere al menos una etiqueta.");
  }
  const rowIds = new Set((record.analyzerInput.quote?.rows || []).map((r) => r?.id));
  const reviewerIds = new Set();
  for (const label of record.labels) {
    validateLabel(label, caseId, rowIds);
    if (reviewerIds.has(label.reviewerId)) {
      throw err(caseId, `Etiqueta duplicada del revisor ${label.reviewerId}.`);
    }
    reviewerIds.add(label.reviewerId);
  }
  if (record.adjudication !== undefined && record.adjudication !== null) {
    validateAdjudication(record.adjudication, caseId);
  }
  return record;
}

function validateLabel(label, caseId, rowIds) {
  if (!isPlainObject(label)) throw err(caseId, "Etiqueta inválida: se esperaba un objeto.");
  if (label.schemaVersion !== LABEL_SCHEMA_VERSION) {
    throw err(caseId, `Esquema de etiqueta no soportado: se esperaba "${LABEL_SCHEMA_VERSION}".`);
  }
  if (typeof label.reviewerId !== "string" || label.reviewerId.trim() === "") {
    throw err(caseId, "Etiqueta inválida: falta reviewerId.");
  }
  if (label.labeledAt !== undefined && label.labeledAt !== null && !isValidIsoDate(label.labeledAt)) {
    throw err(caseId, "Etiqueta inválida: labeledAt debe ser una fecha ISO 8601.");
  }
  if (!Array.isArray(label.rows)) throw err(caseId, "Etiqueta inválida: falta rows.");
  const seenRowIds = new Set();
  for (const row of label.rows) {
    if (!isPlainObject(row) || typeof row.rowId !== "string" || !rowIds.has(row.rowId)) {
      throw err(caseId, "Etiqueta inválida: rows referencia una fila inexistente.");
    }
    if (seenRowIds.has(row.rowId)) {
      throw err(caseId, "Etiqueta inválida: fila repetida en rows.");
    }
    seenRowIds.add(row.rowId);
    if (!IDENTITY_STATES.includes(row.confirmedIdentity)) {
      throw err(caseId, `Etiqueta inválida: confirmedIdentity desconocido (${String(row.confirmedIdentity)}).`);
    }
    if (row.requiredComponent !== null && !REQUIRED_COMPONENTS.includes(row.requiredComponent)) {
      throw err(caseId, "Etiqueta inválida: requiredComponent fuera de alcance.");
    }
  }
  if (!Array.isArray(label.expertFindings)) throw err(caseId, "Etiqueta inválida: falta expertFindings.");
  const findingDimensions = new Set();
  for (const finding of label.expertFindings) {
    if (!isPlainObject(finding) || !EXPERT_DIMENSIONS.includes(finding.dimension)) {
      throw err(caseId, "Etiqueta inválida: dimensión fuera de las permitidas.");
    }
    if (findingDimensions.has(finding.dimension)) {
      throw err(caseId, "Etiqueta inválida: dimensión duplicada en expertFindings.");
    }
    findingDimensions.add(finding.dimension);
    if (!DIMENSION_STATUSES.includes(finding.expectedStatus)) {
      throw err(caseId, "Etiqueta inválida: expectedStatus desconocido.");
    }
    if (!Array.isArray(finding.expectedFindingIds) || finding.expectedFindingIds.some((id) => typeof id !== "string")) {
      throw err(caseId, "Etiqueta inválida: expectedFindingIds debe ser una lista de strings.");
    }
  }
  if (typeof label.dangerousConfirmedIncompatibility !== "boolean") {
    throw err(caseId, "Etiqueta inválida: dangerousConfirmedIncompatibility debe ser booleano.");
  }
  if (
    label.dangerousConfirmedIncompatibility &&
    !label.expertFindings.some((finding) => finding.expectedStatus === "fail")
  ) {
    throw err(caseId, "Etiqueta inválida: peligro confirmado exige un hallazgo esperado fail.");
  }
  if (label.topDecisionConcern !== null && !CONCERN_VALUES.includes(label.topDecisionConcern)) {
    throw err(caseId, "Etiqueta inválida: topDecisionConcern fuera de los valores permitidos.");
  }
  if (!CONFIDENCE_VALUES.includes(label.reviewerConfidence)) {
    throw err(caseId, "Etiqueta inválida: reviewerConfidence desconocido.");
  }
  if (label.decisionAction !== null && !ACTION_VALUES.includes(label.decisionAction)) {
    throw err(caseId, "Etiqueta inválida: decisionAction fuera de los valores permitidos.");
  }
}

function validateAdjudication(adjudication, caseId) {
  if (!isPlainObject(adjudication)) throw err(caseId, "Adjudicación inválida: se esperaba un objeto.");
  if (!["third", "consensus"].includes(adjudication.resolvedBy)) {
    throw err(caseId, "Adjudicación inválida: resolvedBy debe ser third o consensus.");
  }
  if (typeof adjudication.resolvedAt !== "string" || !isValidIsoDate(adjudication.resolvedAt)) {
    throw err(caseId, "Adjudicación inválida: resolvedAt debe ser una fecha ISO 8601.");
  }
  if (typeof adjudication.summary !== "string") throw err(caseId, "Adjudicación inválida: falta summary.");
  if (adjudication.resolvedDangerous !== undefined && typeof adjudication.resolvedDangerous !== "boolean") {
    throw err(caseId, "Adjudicación inválida: resolvedDangerous debe ser booleano.");
  }
  if (adjudication.resolvedFindings !== undefined) {
    if (!Array.isArray(adjudication.resolvedFindings)) {
      throw err(caseId, "Adjudicación inválida: resolvedFindings debe ser una lista.");
    }
    const resolvedDimensions = new Set();
    for (const finding of adjudication.resolvedFindings) {
      if (!isPlainObject(finding) || !EXPERT_DIMENSIONS.includes(finding.dimension)) {
        throw err(caseId, "Adjudicación inválida: dimensión fuera de las permitidas.");
      }
      if (resolvedDimensions.has(finding.dimension)) {
        throw err(caseId, "Adjudicación inválida: dimensión duplicada en resolvedFindings.");
      }
      resolvedDimensions.add(finding.dimension);
      if (!DIMENSION_STATUSES.includes(finding.expectedStatus)) {
        throw err(caseId, "Adjudicación inválida: expectedStatus desconocido.");
      }
    }
  }
}

/**
 * Load and validate every top-level *.json file in a corpus directory.
 * Returns valid cases plus content-free rejection errors. Never throws for
 * individual bad files.
 * @param {string} dir
 * @returns {{ cases: Array<object>, errors: Array<{ caseId: string, error: string }> }}
 */
export function loadCorpus(dir) {
  const cases = [];
  const errors = [];
  const seen = new Set();
  let files;
  try {
    files = fs
      .readdirSync(dir)
      .filter((name) => name.endsWith(".json"))
      .sort();
  } catch {
    throw new Error("No se pudo leer el directorio del corpus.");
  }
  for (const file of files) {
    let raw;
    try {
      raw = fs.readFileSync(path.join(dir, file), "utf8");
    } catch {
      errors.push({ caseId: file.replace(/\.json$/, ""), error: "No se pudo leer el archivo JSON." });
      continue;
    }
    let record;
    try {
      record = JSON.parse(raw);
    } catch {
      errors.push({ caseId: file.replace(/\.json$/, ""), error: "Archivo JSON inválido." });
      continue;
    }
    try {
      validateCase(record);
    } catch (error) {
      errors.push({ caseId: record?.caseId ?? file.replace(/\.json$/, ""), error: error.message });
      continue;
    }
    if (seen.has(record.caseId)) {
      errors.push({ caseId: record.caseId, error: "Caso duplicado en el corpus." });
      continue;
    }
    seen.add(record.caseId);
    cases.push(record);
  }
  return { cases, errors };
}

/**
 * Run the pure analyzer over one validated case.
 * @param {object} record validated corpus case
 * @returns {{ caseId: string, output: object, resolvedCount: number, requiredCount: number }}
 */
export function analyzeCaseRecord(record) {
  const output = analyzeQuote(record.analyzerInput);
  const rows = record.analyzerInput.quote?.rows || [];
  const resolvedByRow = output.resolution || {};
  let resolvedCount = 0;
  for (const key of REQUIRED_COMPONENTS) {
    if (key === "gpu" && output.integratedGpu === true) {
      resolvedCount += 1;
      continue;
    }
    const resolved = rows.some(
      (row) =>
        normalizeCategory(row?.category) === key &&
        ["exact-id", "user-mapped"].includes(resolvedByRow[row?.id])
    );
    if (resolved) resolvedCount += 1;
  }
  return { caseId: record.caseId, output, resolvedCount, requiredCount: REQUIRED_COMPONENTS.length };
}

/**
 * Reference label per dimension: shared reviewer status only when at least
 * two reviewers agree; adjudicated value when present; otherwise null
 * (unresolved disagreement or single-label dimension). A single reviewer's
 * status alone never becomes the reference.
 * Dangerous flag is any-reviewer-true unless adjudication overrides it.
 * Never mutates labels.
 * @param {object} record
 * @returns {{ byDimension: object, dangerous: boolean|null, flaggedDimensions: Array<string> }}
 */
function referenceFor(record) {
  const labels = record.labels || [];
  const byDimension = {};
  for (const dimension of EXPERT_DIMENSIONS) {
    const findings = labels
      .flatMap((label) => label.expertFindings || [])
      .filter((finding) => finding.dimension === dimension)
      .map((finding) => finding.expectedStatus);
    byDimension[dimension] =
      findings.length >= 2 && unique(findings).length === 1 ? findings[0] : null;
  }
  const resolvedFindings = record.adjudication?.resolvedFindings || [];
  for (const finding of resolvedFindings) {
    byDimension[finding.dimension] = finding.expectedStatus;
  }
  const resolvedDangerous =
    record.adjudication?.resolvedDangerous !== undefined ? record.adjudication.resolvedDangerous : null;
  const dangerous = resolvedDangerous ?? (labels.some((label) => label.dangerousConfirmedIncompatibility) || null);
  const flaggedDimensions = unique(
    labels
      .flatMap((label) => label.expertFindings || [])
      .filter((finding) => finding.expectedStatus === "fail")
      .map((finding) => finding.dimension)
  );
  return { byDimension, dangerous, flaggedDimensions };
}

/**
 * Compute aggregate metrics over analyzed cases. Pure and deterministic.
 * @param {Array<object>} cases validated corpus records
 * @param {Array<object>} analyzed analyzeCaseRecord outputs (parallel to cases)
 * @param {Array<object>} errors load/rejection errors
 * @returns {object} raw metrics consumed by buildReport
 */
export function computeMetrics(cases, analyzed, errors) {
  const byId = new Map(analyzed.map((entry) => [entry.caseId, entry]));

  let resolvedTotal = 0;
  let requiredTotal = 0;
  const perCaseResolution = [];
  for (const entry of analyzed) {
    resolvedTotal += entry.resolvedCount;
    requiredTotal += entry.requiredCount;
    perCaseResolution.push({
      caseId: entry.caseId,
      resolvedCount: entry.resolvedCount,
      requiredCount: entry.requiredCount,
      verdict: entry.output.verdict.overall,
    });
  }

  let agreementPairs = 0;
  let agreementAgree = 0;
  let concernPairs = 0;
  let concernAgree = 0;
  const disagreementCases = [];
  const dangerousFNCases = [];
  const dangerousNearMissCases = [];
  const unknownVsOk = {};
  const perFinding = { expected: {}, emitted: {}, tp: {}, fp: {}, fn: {} };
  let evidenceTotal = 0;
  let evidenceComplete = 0;
  const elapsedTimes = [];

  for (const record of cases) {
    const entry = byId.get(record.caseId);
    if (entry === undefined) continue;
    const reference = referenceFor(record);
    const output = entry.output;

    for (const dimension of EXPERT_DIMENSIONS) {
      const expert = reference.byDimension[dimension];
      const analyzer = output.dimensions[dimension]?.status ?? null;

      const statuses = (record.labels || [])
        .filter((label) => label.expertFindings?.some((f) => f.dimension === dimension))
        .map((label) => label.expertFindings.find((f) => f.dimension === dimension).expectedStatus);
      if (statuses.length >= 2) {
        if (unique(statuses).length === 1 && statuses[0] === "unknown") {
          // Agreed "unknown" is consensus about uncertainty, not a
          // deterministic conclusion; it neither helps nor hurts the gate.
        } else {
          agreementPairs += 1;
          if (unique(statuses).length === 1) agreementAgree += 1;
          else if (record.adjudication === null) disagreementCases.push(record.caseId);
        }
      }

      if (expert === null || analyzer === null) continue;

      const pair = `${expert}->${analyzer}`;
      unknownVsOk[pair] = (unknownVsOk[pair] || 0) + 1;
    }

    const concerns = (record.labels || [])
      .map((label) => label.topDecisionConcern)
      .filter((concern) => concern !== null);
    if (concerns.length >= 2) {
      concernPairs += 1;
      if (unique(concerns).length === 1) concernAgree += 1;
    }

    if (reference.dangerous) {
      const failsFlagged = reference.flaggedDimensions.some(
        (dimension) => output.dimensions[dimension]?.status === "fail"
      );
      if (output.verdict.overall === "ok" || output.verdict.overall === "incomplete") {
        if (failsFlagged) dangerousNearMissCases.push(record.caseId);
        else dangerousFNCases.push(record.caseId);
      } else if (!failsFlagged) {
        dangerousNearMissCases.push(record.caseId);
      }
    }

    const expectedIds = unique(
      (record.labels || [])
        .flatMap((label) => label.expertFindings || [])
        .filter((finding) => {
          if (finding.expectedStatus === "unknown") return false;
          return reference.byDimension[finding.dimension] === finding.expectedStatus;
        })
        .flatMap((finding) => finding.expectedFindingIds)
    );
    const emittedIds = unique(output.findings.map((finding) => finding.id));
    const expectedSet = new Set(expectedIds);
    const emittedSet = new Set(emittedIds);
    for (const id of expectedIds) perFinding.expected[id] = (perFinding.expected[id] || 0) + 1;
    for (const id of emittedIds) perFinding.emitted[id] = (perFinding.emitted[id] || 0) + 1;
    for (const id of unique([...expectedIds, ...emittedIds])) {
      const isExpected = expectedSet.has(id);
      const isEmitted = emittedSet.has(id);
      if (isExpected && isEmitted) perFinding.tp[id] = (perFinding.tp[id] || 0) + 1;
      else if (isExpected) perFinding.fn[id] = (perFinding.fn[id] || 0) + 1;
      else if (isEmitted) perFinding.fp[id] = (perFinding.fp[id] || 0) + 1;
    }
    for (const finding of output.findings) {
      const complete =
        Array.isArray(finding.evidence?.sourceFields) &&
        typeof finding.evidence?.source === "string" &&
        isPlainObject(finding.evidence?.freshness) &&
        typeof finding.evidence?.ruleVersion === "string" &&
        ["high", "medium", "low"].includes(finding.confidence) &&
        typeof finding.explanation === "string" &&
        typeof finding.action === "string";
      evidenceTotal += 1;
      if (complete) evidenceComplete += 1;
    }

    if (typeof record.elapsedMs === "number" && Number.isFinite(record.elapsedMs)) {
      elapsedTimes.push(record.elapsedMs);
    }
  }

  const resolutionRate = requiredTotal > 0 ? resolvedTotal / requiredTotal : null;
  const deterministicAgreement = agreementPairs > 0 ? agreementAgree / agreementPairs : null;
  const concernAgreement = concernPairs > 0 ? concernAgree / concernPairs : null;
  const evidenceCompleteness = evidenceTotal > 0 ? evidenceComplete / evidenceTotal : null;
  const sortedElapsed = [...elapsedTimes].sort((a, b) => a - b);
  const timeToVerdictMsMedian =
    sortedElapsed.length > 0
      ? sortedElapsed[Math.floor(sortedElapsed.length / 2)]
      : null;

  const perFindingConfusion = {};
  for (const id of unique([...Object.keys(perFinding.expected), ...Object.keys(perFinding.emitted)])) {
    perFindingConfusion[id] = {
      expected: perFinding.expected[id] || 0,
      emitted: perFinding.emitted[id] || 0,
      tp: perFinding.tp[id] || 0,
      fp: perFinding.fp[id] || 0,
      fn: perFinding.fn[id] || 0,
    };
  }

  return {
    caseCount: cases.length,
    rejectedCount: errors.length,
    rejectedCaseIds: unique(errors.map((error) => error.caseId)),
    resolutionRate,
    perCaseResolution,
    deterministicAgreement,
    agreementPairs,
    concernAgreement,
    concernPairs,
    disagreementCases: unique(disagreementCases),
    dangerousFNCases: unique(dangerousFNCases),
    dangerousNearMissCases: unique(dangerousNearMissCases),
    unknownVsOk,
    perFindingConfusion,
    evidenceCompleteness,
    timeToVerdictMsMedian,
  };
}

const gate = (pass, rate, threshold, assessable) => ({ pass, rate, threshold, assessable });

/**
 * Build the redacted aggregate report (whitelist fields only).
 * @param {object} metrics computeMetrics output
 * @param {object} options { generatedAt, corpusDir }
 * @returns {object} quote-analyzer-corpus/report/v1 payload
 */
export function buildReport(metrics, { generatedAt, corpusDir }) {
  const assessable = metrics.caseCount > 0;
  const gates = {
    identityResolution: gate(
      metrics.resolutionRate !== null && metrics.resolutionRate >= GATES.identityResolution.threshold,
      metrics.resolutionRate,
      GATES.identityResolution.threshold,
      assessable
    ),
    expertAgreementDeterministic: gate(
      metrics.deterministicAgreement !== null && metrics.deterministicAgreement >= GATES.expertAgreementDeterministic.threshold,
      metrics.deterministicAgreement,
      GATES.expertAgreementDeterministic.threshold,
      assessable
    ),
    expertAgreementTopConcern: gate(
      metrics.concernAgreement !== null && metrics.concernAgreement >= GATES.expertAgreementTopConcern.threshold,
      metrics.concernAgreement,
      GATES.expertAgreementTopConcern.threshold,
      assessable
    ),
    dangerousFalseNegatives: gate(
      metrics.dangerousFNCases.length === 0,
      metrics.dangerousFNCases.length,
      GATES.dangerousFalseNegatives.threshold,
      assessable
    ),
    schemaRejection: gate(
      metrics.rejectedCount === 0,
      metrics.rejectedCount,
      GATES.schemaRejection.threshold,
      true
    ),
  };

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt,
    corpus: {
      caseCount: metrics.caseCount,
      rejectedCount: metrics.rejectedCount,
      rejectedCaseIds: metrics.rejectedCaseIds,
    },
    metrics: {
      identityResolutionRate: metrics.resolutionRate,
      expertAgreementDeterministic: metrics.deterministicAgreement,
      expertAgreementPairs: metrics.agreementPairs,
      expertAgreementTopConcern: metrics.concernAgreement,
      expertAgreementTopConcernPairs: metrics.concernPairs,
      dangerousFalseNegativeCount: metrics.dangerousFNCases.length,
      dangerousNearMissCount: metrics.dangerousNearMissCases.length,
      evidenceCompletenessRate: metrics.evidenceCompleteness,
      timeToVerdictMsMedian: metrics.timeToVerdictMsMedian,
      unknownVsOkMatrix: metrics.unknownVsOk,
      perFindingConfusion: metrics.perFindingConfusion,
    },
    gates,
    cases: metrics.perCaseResolution,
    failingCaseIds: {
      dangerousFalseNegatives: metrics.dangerousFNCases,
      dangerousNearMisses: metrics.dangerousNearMissCases,
      disagreementsWithoutAdjudication: metrics.disagreementCases,
    },
    corpusDir,
  };
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * Reject corpus directories that live inside the repository. The harness
 * must never default to, or read, a repository directory. Accepts relative
 * paths (resolved against the current working directory).
 * @param {string} dir corpus path
 */
export function assertOutsideRepo(dir) {
  const resolved = path.resolve(dir);
  const relative = path.relative(REPO_ROOT, resolved);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) {
    throw new Error("Directorio de corpus inválido: no puede estar dentro del repositorio.");
  }
}

/**
 * Parse CLI arguments. --corpus-dir is mandatory; there is no default path.
 * Flag values that are missing or look like another flag are rejected.
 * @param {Array<string>} argv process.argv.slice(2)
 * @returns {{ corpusDir: string, outPath: string|null, reportOnly: boolean, help: boolean, generatedAt: string|null }}
 */
export function parseCliArgs(argv) {
  const args = { corpusDir: null, outPath: null, reportOnly: false, help: false, generatedAt: null };
  const takeValue = (flag, value) => {
    if (value === undefined || value === null || value.startsWith("--")) {
      throw new Error(`Falta el valor de ${flag}.`);
    }
    return value;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--corpus-dir") {
      args.corpusDir = takeValue("--corpus-dir", argv[i + 1]);
      i += 1;
    } else if (arg === "--out") {
      args.outPath = takeValue("--out", argv[i + 1]);
      i += 1;
    } else if (arg === "--generated-at") {
      const value = takeValue("--generated-at", argv[i + 1]);
      if (!isValidIsoDate(value)) {
        throw new Error("--generated-at debe ser una fecha ISO 8601.");
      }
      args.generatedAt = value;
      i += 1;
    } else if (arg === "--report-only") {
      args.reportOnly = true;
    } else {
      throw new Error(`Argumento desconocido: ${arg}`);
    }
  }
  if (args.help) return args;
  if (!args.corpusDir) {
    throw new Error(
      "Falta --corpus-dir. El harness nunca usa un directorio por defecto; indique la carpeta privada del corpus."
    );
  }
  return args;
}

export const USAGE = `Uso: node scripts/quote_analyzer_corpus.js --corpus-dir <directorio privado> [--out <archivo>] [--report-only] [--generated-at <ISO 8601>]

  --corpus-dir    directorio privado con los casos JSON del corpus (obligatorio;
                  nunca se usa un directorio del repositorio)
  --out           archivo de salida del reporte agregado (por defecto: stdout)
  --report-only   no falla al terminar aunque los umbrales de lanzamiento fallen
  --generated-at  fecha ISO 8601 fija para el reporte (por defecto: ahora)`;

/**
 * Run the harness end to end.
 * @param {object} options { corpusDir, reportOnly, generatedAt, analyze? }
 *   analyze: optional per-case runner override (defaults to analyzeCaseRecord)
 * @returns {{ exitCode: number, report: object }}
 */
export function runHarness({ corpusDir, reportOnly = false, generatedAt, analyze = analyzeCaseRecord }) {
  if (!isValidIsoDate(generatedAt)) {
    throw new Error("generatedAt debe ser una fecha ISO 8601.");
  }
  const resolvedDir = path.resolve(corpusDir);
  assertOutsideRepo(resolvedDir);
  if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
    throw new Error(`Directorio de corpus inválido: ${resolvedDir}`);
  }
  const { cases, errors } = loadCorpus(resolvedDir);
  if (cases.length === 0) {
    throw new Error(`Corpus vacío: no se encontraron casos válidos en ${resolvedDir}.`);
  }
  const analyzed = [];
  for (const record of cases) {
    try {
      analyzed.push(analyze(record));
    } catch {
      errors.push({
        caseId: record.caseId,
        error: "Fallo interno del analizador para este caso.",
      });
    }
  }
  const metrics = computeMetrics(cases, analyzed, errors);
  const report = buildReport(metrics, { generatedAt, corpusDir: resolvedDir });
  const gatesFailed = Object.values(report.gates).some((g) => g.assessable && !g.pass);
  return { exitCode: gatesFailed && !reportOnly ? 1 : 0, report };
}
