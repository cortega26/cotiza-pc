import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SOURCE_FILES = ["contracts.js", "measurement.js", "index.js"];
const FORBIDDEN_CALLS = [
  "fetch(",
  "sendBeacon",
  "XMLHttpRequest",
  "WebSocket",
  "document.cookie",
  "localStorage",
  "sessionStorage",
  "navigator.",
];

describe("measurement source static guarantees", () => {
  for (const file of SOURCE_FILES) {
    const source = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
    for (const token of FORBIDDEN_CALLS) {
      it(`${file} never calls ${token}`, () => {
        expect(source).not.toContain(token);
      });
    }
  }
});
