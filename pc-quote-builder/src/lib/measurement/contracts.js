import {
  RULES_VERSION,
  SCHEMA_VERSION_INPUT,
  SCHEMA_VERSION_OUTPUT,
} from "../quoteAnalyzer/contracts.js";

export const MEASUREMENT_SCHEMA_VERSION = "decision-measurement/event/v1";

export const EVENT_NAMES = Object.freeze([
  "product_start",
  "quote_input_completed",
  "identity_confirmation_requested",
  "identity_confirmation_completed",
  "evidence_qualified_verdict_viewed",
  "finding_evidence_opened",
  "decision_action_recorded",
]);

export const VERDICT_STATES = Object.freeze(["ok", "warning", "fail", "unknown", "incomplete"]);
export const DECISION_ACTIONS = Object.freeze(["keep", "change", "reject", "negotiate", "compare", "defer"]);
export const ACQUISITION_CLASSES = Object.freeze([
  "non-branded-organic",
  "branded-organic",
  "direct",
  "referral",
  "unknown",
]);
export const INPUT_METHODS = Object.freeze(["manual", "import-json", "import-csv", "paste-structured"]);
export const CURRENCIES = Object.freeze(["CLP", "USD", "EUR", "other"]);
export const RESOLUTION_OUTCOMES = Object.freeze(["all-resolved", "partial", "none"]);
export const EVIDENCE_SOURCES = Object.freeze(["catalog", "quote", "user", "rule"]);
export const DECISION_TYPES = Object.freeze([
  "deterministic",
  "derived",
  "heuristic",
  "probabilistic",
  "preference-dependent",
  "unsupported",
]);
export const SEVERITIES = Object.freeze(["critical", "warning", "info"]);

export const MAX_ROW_COUNT = 1000;
export const MAX_FINDING_COUNT = 200;
export const MAX_EVIDENCE_ITEMS = 50;
export const MAX_REQUIRED_COMPONENTS = 6;
export const MAX_DURATION_MS = 6 * 60 * 60 * 1000;
export const MAX_TOKEN_LENGTH = 64;

export const FORBIDDEN_RAW_FIELDS = Object.freeze([
  "product",
  "itemId",
  "store",
  "notes",
  "offerPrice",
  "regularPrice",
  "budgetAmount",
  "email",
  "phone",
  "ip",
  "userAgent",
  "fileName",
  "quoteText",
  "contact",
]);

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

const isValidTimestamp = (value) =>
  typeof value === "string" && ISO_8601.test(value) && !Number.isNaN(Date.parse(value));

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const EVENT_SPECS = Object.freeze({
  product_start: {
    fields: {
      acquisitionClass: { kind: "enum", values: ACQUISITION_CLASSES },
      catalogVersion: { kind: "string", max: 64 },
    },
  },
  quote_input_completed: {
    fields: {
      inputMethod: { kind: "enum", values: INPUT_METHODS },
      rowCount: { kind: "int", min: 0, max: MAX_ROW_COUNT },
      missingPriceRowCount: { kind: "int", min: 0, max: MAX_ROW_COUNT },
      currency: { kind: "enum", values: CURRENCIES },
      analyzerInputSchemaVersion: { kind: "version", value: SCHEMA_VERSION_INPUT },
    },
  },
  identity_confirmation_requested: {
    fields: {
      ambiguousRowCount: { kind: "int", min: 0, max: MAX_ROW_COUNT },
      requiredComponentCount: { kind: "int", min: 1, max: MAX_REQUIRED_COMPONENTS },
    },
  },
  identity_confirmation_completed: {
    fields: {
      resolutionOutcome: { kind: "enum", values: RESOLUTION_OUTCOMES },
      resolvedExactCount: { kind: "int", min: 0, max: MAX_REQUIRED_COMPONENTS },
      resolvedConfirmedCount: { kind: "int", min: 0, max: MAX_REQUIRED_COMPONENTS },
      remainingAmbiguousCount: { kind: "int", min: 0, max: MAX_REQUIRED_COMPONENTS },
      rulesVersion: { kind: "version", value: RULES_VERSION },
      catalogVersion: { kind: "string", max: 64 },
    },
  },
  evidence_qualified_verdict_viewed: {
    fields: {
      verdictOverall: { kind: "enum", values: VERDICT_STATES },
      criticalFindingCount: { kind: "int", min: 0, max: MAX_FINDING_COUNT },
      warningFindingCount: { kind: "int", min: 0, max: MAX_FINDING_COUNT },
      unknownFindingCount: { kind: "int", min: 0, max: MAX_FINDING_COUNT },
      qualifiedActivation: { kind: "boolean" },
      timeToVerdictMs: { kind: "int", min: 0, max: MAX_DURATION_MS },
      identityResolutionCoveragePercent: { kind: "int", min: 0, max: 100 },
      rulesVersion: { kind: "version", value: RULES_VERSION },
      catalogVersion: { kind: "string", max: 64 },
      analyzerOutputSchemaVersion: { kind: "version", value: SCHEMA_VERSION_OUTPUT },
    },
  },
  finding_evidence_opened: {
    fields: {
      findingKey: { kind: "string", max: 64 },
      severity: { kind: "enum", values: SEVERITIES },
      decisionType: { kind: "enum", values: DECISION_TYPES },
      evidenceSource: { kind: "enum", values: EVIDENCE_SOURCES },
      evidenceItemCount: { kind: "int", min: 0, max: MAX_EVIDENCE_ITEMS },
      rulesVersion: { kind: "version", value: RULES_VERSION },
    },
  },
  decision_action_recorded: {
    fields: {
      action: { kind: "enum", values: DECISION_ACTIONS },
      verdictOverall: { kind: "enum", values: VERDICT_STATES },
      rulesVersion: { kind: "version", value: RULES_VERSION },
      catalogVersion: { kind: "string", max: 64 },
    },
  },
});

function assertNoForbiddenFields(value, path = "payload") {
  if (!isPlainObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_RAW_FIELDS.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      throw new TypeError(`forbidden raw-data field at ${path}.${key}`);
    }
    assertNoForbiddenFields(child, `${path}.${key}`);
  }
}

function applyFieldRule(key, rule, value, name) {
  if (value === undefined) {
    throw new TypeError(`${name} is missing required field: ${key}`);
  }
  switch (rule.kind) {
    case "enum":
      if (!rule.values.includes(value)) {
        throw new TypeError(`${name}.${key} must be one of: ${rule.values.join(", ")}`);
      }
      return value;
    case "int": {
      if (!Number.isInteger(value)) {
        throw new TypeError(`${name}.${key} must be an integer`);
      }
      return Math.min(rule.max, Math.max(rule.min, value));
    }
    case "boolean":
      if (typeof value !== "boolean") {
        throw new TypeError(`${name}.${key} must be a boolean`);
      }
      return value;
    case "string":
      if (typeof value !== "string" || value.length === 0) {
        throw new TypeError(`${name}.${key} must be a non-empty string`);
      }
      if (value.length > rule.max) {
        throw new TypeError(`${name}.${key} exceeds maximum length ${rule.max}`);
      }
      return value;
    case "version":
      if (value !== rule.value) {
        throw new TypeError(`${name}.${key} must be ${rule.value}`);
      }
      return value;
    default:
      throw new TypeError(`${name}.${key} has an unknown validation rule`);
  }
}

export function createEvent(name, payload = {}) {
  const spec = EVENT_SPECS[name];
  if (!spec) {
    throw new TypeError(`unknown event name: ${name}`);
  }
  if (!isPlainObject(payload)) {
    throw new TypeError(`${name} payload must be a plain object`);
  }
  assertNoForbiddenFields(payload);

  const allowed = new Set([...Object.keys(spec.fields), "timestamp", "sequence", "sessionToken"]);
  for (const key of Object.keys(payload)) {
    if (!allowed.has(key)) {
      throw new TypeError(`unknown field for ${name}: ${key}`);
    }
  }

  const event = { schemaVersion: MEASUREMENT_SCHEMA_VERSION, name };

  const { timestamp, sequence, sessionToken } = payload;
  if (!isValidTimestamp(timestamp)) {
    throw new TypeError(`${name}.timestamp must be an ISO 8601 string`);
  }
  event.timestamp = timestamp;

  if (!Number.isInteger(sequence) || sequence < 0) {
    throw new TypeError(`${name}.sequence must be a non-negative integer`);
  }
  event.sequence = sequence;

  if (typeof sessionToken !== "string" || sessionToken.length === 0) {
    throw new TypeError(`${name}.sessionToken must be a non-empty string`);
  }
  if (sessionToken.length > MAX_TOKEN_LENGTH) {
    throw new TypeError(`${name}.sessionToken exceeds maximum length ${MAX_TOKEN_LENGTH}`);
  }
  event.sessionToken = sessionToken;

  for (const [key, rule] of Object.entries(spec.fields)) {
    event[key] = applyFieldRule(key, rule, payload[key], name);
  }

  if (name === "evidence_qualified_verdict_viewed") {
    if (
      event.qualifiedActivation === true &&
      (event.verdictOverall === "unknown" || event.verdictOverall === "incomplete")
    ) {
      throw new TypeError(
        `${name}.qualifiedActivation cannot be true for an unknown or incomplete verdict`
      );
    }
  }

  return event;
}
