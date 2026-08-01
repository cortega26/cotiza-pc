import { createEvent } from "./contracts.js";

const noopSink = () => {};

function generateEphemeralToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `tok-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function createInMemorySink() {
  const events = [];
  return {
    events,
    sink: (event) => events.push(event),
  };
}

export function createMeasurement({ sink = noopSink, sessionToken, sequenceStart = 0 } = {}) {
  const start = Number.isInteger(sequenceStart) && sequenceStart >= 0 ? sequenceStart : 0;
  const token = sessionToken || generateEphemeralToken();
  let sequence = start;

  return {
    sessionToken: token,
    track(eventName, payload = {}) {
      const input = payload == null ? {} : payload;
      const autoSequence = input.sequence == null;
      const eventSequence = autoSequence ? sequence : input.sequence;
      if (autoSequence) {
        sequence += 1;
      } else if (Number.isInteger(input.sequence) && input.sequence >= 0) {
        sequence = Math.max(sequence, input.sequence + 1);
      }
      const event = createEvent(eventName, {
        ...input,
        timestamp: input.timestamp,
        sequence: eventSequence,
        sessionToken: input.sessionToken ?? token,
      });
      try {
        const result = sink(event);
        if (result !== null && typeof result === "object" && typeof result.catch === "function") {
          result.catch(() => {});
        }
      } catch {
        // Sink failures are isolated so assessment keeps working.
      }
      return event;
    },
  };
}
