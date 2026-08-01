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
      const event = createEvent(eventName, {
        ...payload,
        timestamp: payload.timestamp,
        sequence: payload.sequence ?? sequence,
        sessionToken: payload.sessionToken ?? token,
      });
      if (payload.sequence === undefined) {
        sequence += 1;
      }
      try {
        sink(event);
      } catch {
        // Sink failures are isolated so assessment keeps working.
      }
      return event;
    },
  };
}
