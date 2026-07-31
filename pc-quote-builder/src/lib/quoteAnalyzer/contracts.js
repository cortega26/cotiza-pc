/**
 * Quote Analyzer v1 contracts and rule constants.
 *
 * Pure module: no state, no I/O, no Date.now(). All constants are frozen and
 * every exported validator is side-effect free and never mutates its input.
 * Schema names are preserved from docs/design/quote-analyzer.md §4; the
 * Plan 028 approval record (2026-07-31) is binding for v1 defaults.
 */

export const SCHEMA_VERSION_INPUT = "quote-analyzer/input/v1";
export const SCHEMA_VERSION_OUTPUT = "quote-analyzer/output/v1";
export const RULES_VERSION = "quote-analyzer/rules/v1";

/** The six supported component keys, in builder order. */
export const COMPONENT_KEYS = Object.freeze(["cpu", "mobo", "ram", "gpu", "psu", "pcCase"]);

/** All six categories are required for a fully `ok` technical verdict. */
export const REQUIRED_COMPONENTS = Object.freeze(["cpu", "mobo", "ram", "gpu", "psu", "pcCase"]);

export const RESOLUTION_STATES = Object.freeze([
  "exact-id",
  "user-mapped",
  "ambiguous",
  "unmatched-text",
  "unsupported-category",
]);

export const DIMENSIONS = Object.freeze([
  "compatibility",
  "completeness",
  "power",
  "connectors",
  "caseFit",
  "priceFreshness",
  "priceCompleteness",
]);

export const VERDICT_STATES = Object.freeze(["fail", "warning", "unknown", "ok", "incomplete"]);
export const SEVERITIES = Object.freeze(["critical", "warning", "info"]);
export const DECISION_TYPES = Object.freeze([
  "deterministic",
  "derived",
  "heuristic",
  "probabilistic",
  "preference-dependent",
  "unsupported",
]);
export const CONFIDENCE_LEVELS = Object.freeze(["high", "medium", "low"]);
export const DIMENSION_STATUSES = Object.freeze(["ok", "warning", "fail", "unknown"]);

/** Quote prices become stale after 14 days (approved default; matches builder). */
export const PRICE_STALE_DAYS = 14;

/** Spanish category labels used by the builder/quote import → component key. */
export const CATEGORY_TO_COMPONENT = Object.freeze({
  Procesador: "cpu",
  "Placa madre": "mobo",
  RAM: "ram",
  "Tarjeta de video": "gpu",
  "Fuente de poder": "psu",
  Gabinete: "pcCase",
});

const CATEGORY_LOOKUP = new Map(
  Object.entries(CATEGORY_TO_COMPONENT).map(([label, key]) => [label.toLowerCase(), key])
);

/**
 * Normalize a quote row's Spanish category label into a component key.
 * Returns null when the label is empty or outside the six v1 categories.
 * Never mutates input.
 * @param {unknown} category
 * @returns {string|null}
 */
export function normalizeCategory(category) {
  if (typeof category !== "string") return null;
  return CATEGORY_LOOKUP.get(category.trim().toLowerCase()) ?? null;
}

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isValidIsoDate = (value) => {
  if (typeof value !== "string" || value.trim() === "") return false;
  if (!/^\d{4}-\d{2}-\d{2}/.test(value.trim())) return false;
  return !Number.isNaN(Date.parse(value));
};

const INVALID_INPUT = "Entrada de análisis inválida: se esperaba un objeto.";
const WRONG_SCHEMA =
  `Esquema de entrada no soportado: se esperaba "${SCHEMA_VERSION_INPUT}".`;
const MISSING_EVALUATED_AT = "Falta el campo evaluatedAt (fecha de evaluación).";
const INVALID_EVALUATED_AT = "evaluatedAt debe ser una fecha válida (ISO 8601).";
const MISSING_QUOTE = "Falta la cotización (quote).";
const MISSING_ROWS = "La cotización debe incluir filas (quote.rows).";
const INVALID_ROW = (index) => `Fila de cotización inválida (quote.rows[${index}]).`;
const MISSING_USER_CONTEXT = "Falta el contexto del usuario (userContext).";
const UNSUPPORTED_USE_CASE = 'Caso de uso no soportado en v1: solo "gaming".';
const INVALID_INTEGRATED_GPU =
  "userContext.usesIntegratedGpu debe ser booleano o null.";
const INVALID_CATALOG = "Catálogo inválido: faltan listas de componentes (catalog).";
const MISSING_CATALOG_META = "Faltan metadatos del catálogo (catalogMeta).";
const INVALID_ALIASES = "aliases debe ser un objeto o null.";

/**
 * Validate a quote-analyzer/input/v1 payload.
 * Rejects malformed inputs with stable, user-safe Spanish messages.
 * Never mutates the input. Throws on the first violation.
 * @param {unknown} input
 * @returns {object} the validated input (unchanged reference)
 */
export function validateAnalyzerInput(input) {
  if (!isPlainObject(input)) throw new Error(INVALID_INPUT);
  if (input.schemaVersion !== SCHEMA_VERSION_INPUT) throw new Error(WRONG_SCHEMA);
  if (input.evaluatedAt === undefined || input.evaluatedAt === null || input.evaluatedAt === "") {
    throw new Error(MISSING_EVALUATED_AT);
  }
  if (!isValidIsoDate(input.evaluatedAt)) throw new Error(INVALID_EVALUATED_AT);

  if (!isPlainObject(input.quote)) throw new Error(MISSING_QUOTE);
  if (!Array.isArray(input.quote.rows)) throw new Error(MISSING_ROWS);
  input.quote.rows.forEach((row, index) => {
    if (!isPlainObject(row)) throw new Error(INVALID_ROW(index));
  });

  if (!isPlainObject(input.userContext)) throw new Error(MISSING_USER_CONTEXT);
  if (input.userContext.useCase !== "gaming") throw new Error(UNSUPPORTED_USE_CASE);
  const integrated = input.userContext.usesIntegratedGpu;
  if (integrated !== null && typeof integrated !== "boolean") {
    throw new Error(INVALID_INTEGRATED_GPU);
  }

  if (!isPlainObject(input.catalog)) throw new Error(INVALID_CATALOG);
  for (const key of ["cpus", "motherboards", "ramKits", "gpus", "psus", "pcCases"]) {
    if (!Array.isArray(input.catalog[key])) throw new Error(INVALID_CATALOG);
  }
  if (!isPlainObject(input.catalogMeta)) throw new Error(MISSING_CATALOG_META);

  if (
    input.aliases !== undefined &&
    input.aliases !== null &&
    !isPlainObject(input.aliases)
  ) {
    throw new Error(INVALID_ALIASES);
  }

  return input;
}

/**
 * Boolean wrapper over validateAnalyzerInput.
 * @param {unknown} input
 * @returns {boolean}
 */
export function isValidAnalyzerInput(input) {
  try {
    validateAnalyzerInput(input);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate a resolution state string.
 * @param {unknown} state
 * @returns {boolean}
 */
export function isValidResolutionState(state) {
  return RESOLUTION_STATES.includes(state);
}
