import { describe, expect, it } from "vitest";
import {
  RULES_VERSION,
  SCHEMA_VERSION_INPUT,
  SCHEMA_VERSION_OUTPUT,
} from "../quoteAnalyzer/contracts.js";
import {
  ACQUISITION_CLASSES,
  CURRENCIES,
  DECISION_ACTIONS,
  DECISION_TYPES,
  EVIDENCE_SOURCES,
  EVENT_NAMES,
  FORBIDDEN_RAW_FIELDS,
  INPUT_METHODS,
  MAX_DURATION_MS,
  MAX_ROW_COUNT,
  MEASUREMENT_SCHEMA_VERSION,
  RESOLUTION_OUTCOMES,
  SEVERITIES,
  VERDICT_STATES,
  createEvent,
} from "./contracts.js";

const TIMESTAMP = "2026-07-31T12:00:00.000Z";
const CATALOG_VERSION = "snapshot-2026-07-31";

const VALID_PAYLOADS = {
  product_start: {
    acquisitionClass: "non-branded-organic",
    catalogVersion: CATALOG_VERSION,
  },
  quote_input_completed: {
    inputMethod: "manual",
    rowCount: 12,
    missingPriceRowCount: 2,
    currency: "CLP",
    analyzerInputSchemaVersion: SCHEMA_VERSION_INPUT,
  },
  identity_confirmation_requested: {
    ambiguousRowCount: 2,
    requiredComponentCount: 6,
  },
  identity_confirmation_completed: {
    resolutionOutcome: "all-resolved",
    resolvedExactCount: 5,
    resolvedConfirmedCount: 1,
    remainingAmbiguousCount: 0,
    rulesVersion: RULES_VERSION,
    catalogVersion: CATALOG_VERSION,
  },
  evidence_qualified_verdict_viewed: {
    verdictOverall: "warning",
    criticalFindingCount: 1,
    warningFindingCount: 2,
    unknownFindingCount: 0,
    qualifiedActivation: true,
    timeToVerdictMs: 245000,
    identityResolutionCoveragePercent: 100,
    rulesVersion: RULES_VERSION,
    catalogVersion: CATALOG_VERSION,
    analyzerOutputSchemaVersion: SCHEMA_VERSION_OUTPUT,
  },
  finding_evidence_opened: {
    findingKey: "compat-cpu-mobo-socket",
    severity: "critical",
    decisionType: "deterministic",
    evidenceSource: "catalog",
    evidenceItemCount: 2,
    rulesVersion: RULES_VERSION,
  },
  decision_action_recorded: {
    action: "change",
    verdictOverall: "warning",
    rulesVersion: RULES_VERSION,
    catalogVersion: CATALOG_VERSION,
  },
};

function validEvent(name, overrides = {}) {
  return createEvent(name, {
    timestamp: TIMESTAMP,
    sequence: 0,
    sessionToken: "tok-test-123",
    ...VALID_PAYLOADS[name],
    ...overrides,
  });
}

describe("measurement contracts", () => {
  it("exposes the frozen v1 schema version", () => {
    expect(MEASUREMENT_SCHEMA_VERSION).toBe("decision-measurement/event/v1");
  });

  it("keeps analyzer version references in lockstep with Plan 028", () => {
    expect(EVENT_NAMES).toContain("evidence_qualified_verdict_viewed");
    expect(RULES_VERSION).toBe("quote-analyzer/rules/v1");
    expect(SCHEMA_VERSION_INPUT).toBe("quote-analyzer/input/v1");
    expect(SCHEMA_VERSION_OUTPUT).toBe("quote-analyzer/output/v1");
  });

  it("builds a valid event for every event name", () => {
    expect(EVENT_NAMES).toHaveLength(7);
    for (const name of EVENT_NAMES) {
      const event = validEvent(name);
      expect(event).toEqual({
        schemaVersion: MEASUREMENT_SCHEMA_VERSION,
        name,
        timestamp: TIMESTAMP,
        sequence: 0,
        sessionToken: "tok-test-123",
        ...VALID_PAYLOADS[name],
      });
      expect(event).toEqual({ ...event });
    }
  });

  it("rejects an unknown event name", () => {
    expect(() => createEvent("page_view", {})).toThrow(/unknown event name/);
  });

  it("rejects a non-object payload", () => {
    expect(() => createEvent("product_start", "nope")).toThrow(/plain object/);
  });

  it("rejects unknown keys for every event", () => {
    for (const name of EVENT_NAMES) {
      expect(() => validEvent(name, { extra: "x" })).toThrow(/unknown field/);
    }
  });

  it("rejects attempts to override schemaVersion or name", () => {
    expect(() =>
      validEvent("product_start", { schemaVersion: "fake/v2" })
    ).toThrow(/unknown field/);
    expect(() => validEvent("product_start", { name: "other" })).toThrow(/unknown field/);
  });

  it("requires a caller-supplied timestamp and validates its format", () => {
    expect(() =>
      createEvent("product_start", {
        sequence: 0,
        sessionToken: "tok",
        ...VALID_PAYLOADS.product_start,
      })
    ).toThrow(/timestamp/);
    for (const bad of ["2026-07-31", "not-a-date", "2026-13-45T99:00:00Z", 12345, null]) {
      expect(() => validEvent("product_start", { timestamp: bad })).toThrow(/timestamp/);
    }
    for (const good of [
      "2026-07-31T12:00:00Z",
      "2026-07-31T12:00:00.123Z",
      "2026-07-31T09:00:00-03:00",
      "2026-07-31T12:00:00.000+00:00",
    ]) {
      expect(validEvent("product_start", { timestamp: good }).timestamp).toBe(good);
    }
  });

  it("requires a non-negative integer sequence", () => {
    expect(() => validEvent("product_start", { sequence: -1 })).toThrow(/sequence/);
    expect(() => validEvent("product_start", { sequence: 1.5 })).toThrow(/sequence/);
    expect(() => validEvent("product_start", { sequence: "0" })).toThrow(/sequence/);
    expect(validEvent("product_start", { sequence: 7 }).sequence).toBe(7);
  });

  it("requires a bounded session token", () => {
    expect(() => validEvent("product_start", { sessionToken: "" })).toThrow(/sessionToken/);
    expect(() =>
      validEvent("product_start", { sessionToken: "x".repeat(65) })
    ).toThrow(/sessionToken/);
  });

  it("rejects invalid enums", () => {
    expect(() => validEvent("product_start", { acquisitionClass: "paid-ads" })).toThrow(
      /acquisitionClass/
    );
    expect(() => validEvent("quote_input_completed", { inputMethod: "voice" })).toThrow(
      /inputMethod/
    );
    expect(() => validEvent("quote_input_completed", { currency: "JPY" })).toThrow(/currency/);
    expect(() =>
      validEvent("identity_confirmation_completed", { resolutionOutcome: "skipped" })
    ).toThrow(/resolutionOutcome/);
    expect(() =>
      validEvent("evidence_qualified_verdict_viewed", { verdictOverall: "great" })
    ).toThrow(/verdictOverall/);
    expect(() => validEvent("finding_evidence_opened", { severity: "fatal" })).toThrow(
      /severity/
    );
    expect(() =>
      validEvent("finding_evidence_opened", { evidenceSource: "retailer" })
    ).toThrow(/evidenceSource/);
    expect(() =>
      validEvent("finding_evidence_opened", { decisionType: "astrology" })
    ).toThrow(/decisionType/);
    expect(() => validEvent("decision_action_recorded", { action: "haggle" })).toThrow(/action/);
  });

  it("rejects missing required fields", () => {
    for (const name of EVENT_NAMES) {
      for (const key of Object.keys(VALID_PAYLOADS[name])) {
        const payload = { ...VALID_PAYLOADS[name] };
        delete payload[key];
        expect(() =>
          createEvent(name, {
            timestamp: TIMESTAMP,
            sequence: 0,
            sessionToken: "tok",
            ...payload,
          })
        ).toThrow(new RegExp(`missing required field: ${key}`));
      }
    }
  });

  it("rejects non-integer counts", () => {
    expect(() => validEvent("quote_input_completed", { rowCount: 12.5 })).toThrow(/integer/);
    expect(() =>
      validEvent("evidence_qualified_verdict_viewed", { timeToVerdictMs: 100.5 })
    ).toThrow(/integer/);
  });

  it("clamps oversized counts and durations to the documented maximums", () => {
    const event = validEvent("quote_input_completed", { rowCount: 5000 });
    expect(event.rowCount).toBe(MAX_ROW_COUNT);

    const verdict = validEvent("evidence_qualified_verdict_viewed", {
      timeToVerdictMs: 99999999999,
    });
    expect(verdict.timeToVerdictMs).toBe(MAX_DURATION_MS);

    const clamped = validEvent("evidence_qualified_verdict_viewed", {
      identityResolutionCoveragePercent: 130,
    });
    expect(clamped.identityResolutionCoveragePercent).toBe(100);
  });

  it("clamps negative counts up to their minimum", () => {
    const event = validEvent("quote_input_completed", { missingPriceRowCount: -3 });
    expect(event.missingPriceRowCount).toBe(0);
    const confirmation = validEvent("identity_confirmation_completed", {
      remainingAmbiguousCount: -1,
    });
    expect(confirmation.remainingAmbiguousCount).toBe(0);
  });

  it("rejects non-boolean qualifiedActivation", () => {
    expect(() =>
      validEvent("evidence_qualified_verdict_viewed", { qualifiedActivation: "yes" })
    ).toThrow(/boolean/);
  });

  it("never qualifies an unknown or incomplete verdict", () => {
    for (const state of ["unknown", "incomplete"]) {
      expect(() =>
        validEvent("evidence_qualified_verdict_viewed", {
          verdictOverall: state,
          qualifiedActivation: true,
        })
      ).toThrow(/qualifiedActivation/);
      const event = validEvent("evidence_qualified_verdict_viewed", {
        verdictOverall: state,
        qualifiedActivation: false,
      });
      expect(event.qualifiedActivation).toBe(false);
    }
  });

  it("accepts a qualified verdict for ok, warning, and fail states", () => {
    for (const state of ["ok", "warning", "fail"]) {
      const event = validEvent("evidence_qualified_verdict_viewed", {
        verdictOverall: state,
        qualifiedActivation: true,
      });
      expect(event.verdictOverall).toBe(state);
      expect(event.qualifiedActivation).toBe(true);
    }
  });

  it("rejects wrong analyzer or rules versions", () => {
    expect(() =>
      validEvent("quote_input_completed", { analyzerInputSchemaVersion: "quote-analyzer/input/v0" })
    ).toThrow(/analyzerInputSchemaVersion/);
    expect(() =>
      validEvent("decision_action_recorded", { rulesVersion: "quote-analyzer/rules/v2" })
    ).toThrow(/rulesVersion/);
    expect(() =>
      validEvent("evidence_qualified_verdict_viewed", {
        analyzerOutputSchemaVersion: "quote-analyzer/output/v0",
      })
    ).toThrow(/analyzerOutputSchemaVersion/);
  });

  it("rejects every forbidden raw-data field by name", () => {
    for (const forbidden of FORBIDDEN_RAW_FIELDS) {
      expect(() => validEvent("product_start", { [forbidden]: "x" })).toThrow(
        /forbidden raw-data field/
      );
    }
  });

  it("rejects forbidden raw-data fields nested inside objects", () => {
    expect(() =>
      validEvent("product_start", { analysis: { product: "GeForce RTX" } })
    ).toThrow(/forbidden raw-data field/);
    expect(() =>
      validEvent("quote_input_completed", { row: { itemId: "123" } })
    ).toThrow(/forbidden raw-data field/);
  });

  it("rejects forbidden substrings inside allowed-looking key names", () => {
    expect(() => validEvent("product_start", { productNames: "a,b" })).toThrow(
      /forbidden raw-data field/
    );
    expect(() => validEvent("product_start", { storeName: "X" })).toThrow(
      /forbidden raw-data field/
    );
  });

  it("exposes frozen enum registries for instrumentation", () => {
    expect(VERDICT_STATES).toEqual(["ok", "warning", "fail", "unknown", "incomplete"]);
    expect(DECISION_ACTIONS).toEqual(["keep", "change", "reject", "negotiate", "compare", "defer"]);
    expect(ACQUISITION_CLASSES).toContain("non-branded-organic");
    expect(INPUT_METHODS).toContain("paste-structured");
    expect(CURRENCIES).toContain("other");
    expect(RESOLUTION_OUTCOMES).toEqual(["all-resolved", "partial", "none"]);
    expect(EVIDENCE_SOURCES).toEqual(["catalog", "quote", "user", "rule"]);
    expect(SEVERITIES).toEqual(["critical", "warning", "info"]);
    expect(DECISION_TYPES).toContain("deterministic");
  });

  it("returns fresh plain serializable objects", () => {
    const event = validEvent("decision_action_recorded");
    expect(Object.getPrototypeOf(event)).toBe(Object.prototype);
    expect(JSON.parse(JSON.stringify(event))).toEqual(event);
  });
});
