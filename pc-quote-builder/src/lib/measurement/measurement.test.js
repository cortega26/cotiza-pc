import { describe, expect, it, vi } from "vitest";
import { SCHEMA_VERSION_INPUT, SCHEMA_VERSION_OUTPUT } from "../quoteAnalyzer/contracts.js";
import {
  DECISION_ACTIONS,
  MEASUREMENT_SCHEMA_VERSION,
  createEvent,
} from "./contracts.js";
import { createInMemorySink, createMeasurement } from "./measurement.js";

const TIMESTAMP = "2026-07-31T12:00:00.000Z";

const VERDICT_PAYLOAD = {
  verdictOverall: "warning",
  criticalFindingCount: 1,
  warningFindingCount: 2,
  unknownFindingCount: 0,
  qualifiedActivation: true,
  timeToVerdictMs: 245000,
  identityResolutionCoveragePercent: 100,
  rulesVersion: "quote-analyzer/rules/v1",
  catalogVersion: "snapshot-2026-07-31",
  analyzerOutputSchemaVersion: SCHEMA_VERSION_OUTPUT,
};

describe("measurement adapter", () => {
  it("delivers validated events to an injected in-memory sink in order", () => {
    const memory = createInMemorySink();
    const measurement = createMeasurement({
      sink: memory.sink,
      sessionToken: "tok-fixed",
    });

    measurement.track("product_start", {
      timestamp: TIMESTAMP,
      acquisitionClass: "non-branded-organic",
      catalogVersion: "snapshot-2026-07-31",
    });
    measurement.track("quote_input_completed", {
      timestamp: "2026-07-31T12:05:00.000Z",
      inputMethod: "manual",
      rowCount: 12,
      missingPriceRowCount: 0,
      currency: "CLP",
      analyzerInputSchemaVersion: SCHEMA_VERSION_INPUT,
    });

    expect(memory.events).toHaveLength(2);
    expect(memory.events.map((event) => event.name)).toEqual([
      "product_start",
      "quote_input_completed",
    ]);
    expect(memory.events.map((event) => event.sequence)).toEqual([0, 1]);
    for (const event of memory.events) {
      expect(event.sessionToken).toBe("tok-fixed");
      expect(event.schemaVersion).toBe(MEASUREMENT_SCHEMA_VERSION);
    }
  });

  it("defaults to a no-op sink that never throws and returns the event", () => {
    const measurement = createMeasurement();
    const event = measurement.track("product_start", {
      timestamp: TIMESTAMP,
      acquisitionClass: "direct",
      catalogVersion: "snapshot-2026-07-31",
    });
    expect(event.name).toBe("product_start");
    expect(event.acquisitionClass).toBe("direct");
  });

  it("stamps a per-instance ephemeral session token when none is injected", () => {
    const first = createMeasurement();
    const second = createMeasurement();
    expect(first.sessionToken).toBeTruthy();
    expect(first.sessionToken).not.toBe(second.sessionToken);

    const memory = createInMemorySink();
    const measurement = createMeasurement({ sink: memory.sink });
    measurement.track("product_start", {
      timestamp: TIMESTAMP,
      acquisitionClass: "direct",
      catalogVersion: "s",
    });
    measurement.track("product_start", {
      timestamp: TIMESTAMP,
      acquisitionClass: "direct",
      catalogVersion: "s",
    });
    expect(memory.events[0].sessionToken).toBe(measurement.sessionToken);
    expect(memory.events[1].sessionToken).toBe(measurement.sessionToken);
  });

  it("supports deterministic sequence and session injection", () => {
    const memory = createInMemorySink();
    const measurement = createMeasurement({
      sink: memory.sink,
      sessionToken: "tok-test",
      sequenceStart: 10,
    });
    measurement.track("product_start", {
      timestamp: TIMESTAMP,
      acquisitionClass: "direct",
      catalogVersion: "s",
    });
    expect(memory.events[0].sequence).toBe(10);
  });

  it("never swallows validation errors, even with a broken sink", () => {
    const measurement = createMeasurement({
      sink: () => {
        throw new Error("sink exploded");
      },
    });
    expect(() =>
      measurement.track("product_start", {
        timestamp: TIMESTAMP,
        acquisitionClass: "paid-ads",
        catalogVersion: "s",
      })
    ).toThrow(/acquisitionClass/);
  });

  it("isolates sink failures so assessment keeps working", () => {
    const failing = vi.fn(() => {
      throw new Error("network down");
    });
    const measurement = createMeasurement({ sink: failing });

    const event = measurement.track("decision_action_recorded", {
      timestamp: TIMESTAMP,
      action: "defer",
      verdictOverall: "warning",
      rulesVersion: "quote-analyzer/rules/v1",
      catalogVersion: "s",
    });
    expect(failing).toHaveBeenCalledTimes(1);
    expect(event.action).toBe("defer");
  });

  it("continues delivering to the sink after a sink failure", () => {
    let failures = 1;
    const memory = createInMemorySink();
    const measurement = createMeasurement({
      sink: (event) => {
        if (failures > 0) {
          failures -= 1;
          throw new Error("boom");
        }
        memory.sink(event);
      },
    });
    measurement.track("product_start", {
      timestamp: TIMESTAMP,
      acquisitionClass: "direct",
      catalogVersion: "s",
    });
    measurement.track("product_start", {
      timestamp: TIMESTAMP,
      acquisitionClass: "direct",
      catalogVersion: "s",
    });
    expect(memory.events).toHaveLength(1);
  });

  it("requires a caller-supplied timestamp for deterministic sequencing", () => {
    const measurement = createMeasurement();
    expect(() =>
      measurement.track("product_start", {
        acquisitionClass: "direct",
        catalogVersion: "s",
      })
    ).toThrow(/timestamp/);
  });

  it("rejects null and missing payloads with clean validation errors", () => {
    const measurement = createMeasurement();
    expect(() => measurement.track("product_start", null)).toThrow(/timestamp/);
    expect(() => measurement.track("product_start")).toThrow(/timestamp/);
  });

  it("keeps auto sequences monotonic after caller-supplied sequences", () => {
    const memory = createInMemorySink();
    const measurement = createMeasurement({ sink: memory.sink, sessionToken: "tok" });

    measurement.track("product_start", {
      timestamp: TIMESTAMP,
      sequence: 42,
      acquisitionClass: "direct",
      catalogVersion: "s",
    });
    measurement.track("product_start", {
      timestamp: TIMESTAMP,
      acquisitionClass: "direct",
      catalogVersion: "s",
    });
    measurement.track("product_start", {
      timestamp: TIMESTAMP,
      acquisitionClass: "direct",
      catalogVersion: "s",
    });

    expect(memory.events.map((event) => event.sequence)).toEqual([42, 43, 44]);
  });

  it("auto-sequences nullish caller sequences without duplicating", () => {
    const memory = createInMemorySink();
    const measurement = createMeasurement({ sink: memory.sink, sessionToken: "tok" });

    measurement.track("product_start", {
      timestamp: TIMESTAMP,
      sequence: null,
      acquisitionClass: "direct",
      catalogVersion: "s",
    });
    measurement.track("product_start", {
      timestamp: TIMESTAMP,
      acquisitionClass: "direct",
      catalogVersion: "s",
    });

    expect(memory.events.map((event) => event.sequence)).toEqual([0, 1]);
  });

  it("rejects invalid explicit sequences without corrupting the counter", () => {
    const memory = createInMemorySink();
    const measurement = createMeasurement({ sink: memory.sink, sessionToken: "tok" });

    expect(() =>
      measurement.track("product_start", {
        timestamp: TIMESTAMP,
        sequence: "5",
        acquisitionClass: "direct",
        catalogVersion: "s",
      })
    ).toThrow(/sequence/);
    expect(() =>
      measurement.track("product_start", {
        timestamp: TIMESTAMP,
        sequence: -1,
        acquisitionClass: "direct",
        catalogVersion: "s",
      })
    ).toThrow(/sequence/);

    const event = measurement.track("product_start", {
      timestamp: TIMESTAMP,
      acquisitionClass: "direct",
      catalogVersion: "s",
    });
    expect(event.sequence).toBe(0);
  });

  it("rejects unknown event names through the adapter", () => {
    const measurement = createMeasurement();
    expect(() => measurement.track("page_view", { timestamp: TIMESTAMP })).toThrow(
      /unknown event name/
    );
  });

  it("isolates async sink rejections without unhandled rejections", async () => {
    const rejecting = vi.fn(() => Promise.reject(new Error("async boom")));
    const measurement = createMeasurement({ sink: rejecting });

    const event = measurement.track("product_start", {
      timestamp: TIMESTAMP,
      acquisitionClass: "direct",
      catalogVersion: "s",
    });
    expect(rejecting).toHaveBeenCalledTimes(1);
    expect(event.name).toBe("product_start");

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rejecting).toHaveBeenCalledTimes(1);
  });

  it("lets callers override timestamp, sequence, and session deterministically", () => {
    const memory = createInMemorySink();
    const measurement = createMeasurement({ sink: memory.sink, sessionToken: "tok-default" });
    const payload = {
      timestamp: "2026-07-31T13:00:00.000Z",
      sequence: 42,
      sessionToken: "tok-custom",
      acquisitionClass: "referral",
      catalogVersion: "s",
    };
    const event = measurement.track("product_start", payload);
    expect(event.timestamp).toBe("2026-07-31T13:00:00.000Z");
    expect(event.sequence).toBe(42);
    expect(event.sessionToken).toBe("tok-custom");
    expect(memory.events[0]).toEqual(event);
  });

  it("accepts every event name through the adapter", () => {
    const memory = createInMemorySink();
    const measurement = createMeasurement({ sink: memory.sink, sessionToken: "tok" });

    measurement.track("product_start", {
      timestamp: TIMESTAMP,
      acquisitionClass: "non-branded-organic",
      catalogVersion: "s",
    });
    measurement.track("quote_input_completed", {
      timestamp: TIMESTAMP,
      inputMethod: "import-json",
      rowCount: 8,
      missingPriceRowCount: 1,
      currency: "USD",
      analyzerInputSchemaVersion: SCHEMA_VERSION_INPUT,
    });
    measurement.track("identity_confirmation_requested", {
      timestamp: TIMESTAMP,
      ambiguousRowCount: 1,
      requiredComponentCount: 6,
    });
    measurement.track("identity_confirmation_completed", {
      timestamp: TIMESTAMP,
      resolutionOutcome: "all-resolved",
      resolvedExactCount: 5,
      resolvedConfirmedCount: 1,
      remainingAmbiguousCount: 0,
      rulesVersion: "quote-analyzer/rules/v1",
      catalogVersion: "s",
    });
    measurement.track("evidence_qualified_verdict_viewed", {
      ...VERDICT_PAYLOAD,
      timestamp: TIMESTAMP,
    });
    measurement.track("finding_evidence_opened", {
      timestamp: TIMESTAMP,
      findingKey: "compat-cpu-mobo-socket",
      severity: "critical",
      decisionType: "deterministic",
      evidenceSource: "catalog",
      evidenceItemCount: 2,
      rulesVersion: "quote-analyzer/rules/v1",
    });
    measurement.track("decision_action_recorded", {
      timestamp: TIMESTAMP,
      action: DECISION_ACTIONS[3],
      verdictOverall: "warning",
      rulesVersion: "quote-analyzer/rules/v1",
      catalogVersion: "s",
    });

    expect(memory.events.map((event) => event.name)).toEqual([
      "product_start",
      "quote_input_completed",
      "identity_confirmation_requested",
      "identity_confirmation_completed",
      "evidence_qualified_verdict_viewed",
      "finding_evidence_opened",
      "decision_action_recorded",
    ]);
  });

  it("exposes a pure event constructor through the same module tree", () => {
    const event = createEvent("product_start", {
      timestamp: TIMESTAMP,
      sequence: 0,
      sessionToken: "tok",
      acquisitionClass: "unknown",
      catalogVersion: "s",
    });
    expect(event.schemaVersion).toBe(MEASUREMENT_SCHEMA_VERSION);
  });
});
