import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKSPACE_MODE,
  WORKSPACE_MODES,
  WORKSPACE_MODE_LABELS,
  WORKSPACE_MODE_ORDER,
  isValidWorkspaceMode,
  parseWorkspaceMode,
  serializeWorkspaceMode,
} from "./workspaceMode";

describe("workspaceMode", () => {
  it("defaults absent or empty query to analizar", () => {
    expect(DEFAULT_WORKSPACE_MODE).toBe("analizar");
    expect(parseWorkspaceMode("")).toBe("analizar");
    expect(parseWorkspaceMode("?")).toBe("analizar");
    expect(parseWorkspaceMode("?foo=bar")).toBe("analizar");
  });

  it("parses explicit analizar and experto modes", () => {
    expect(parseWorkspaceMode("?modo=analizar")).toBe("analizar");
    expect(parseWorkspaceMode("?modo=experto")).toBe("experto");
    expect(parseWorkspaceMode("?x=1&modo=experto&y=2")).toBe("experto");
  });

  it("falls back to the default for invalid or empty mode values", () => {
    expect(parseWorkspaceMode("?modo=inventado")).toBe("analizar");
    expect(parseWorkspaceMode("?modo=")).toBe("analizar");
    expect(parseWorkspaceMode("?modo=Experto")).toBe("analizar");
  });

  it("uses the first occurrence when the modo param repeats", () => {
    expect(parseWorkspaceMode("?modo=analizar&modo=experto")).toBe("analizar");
  });

  it("serializes a mode with a leading question mark", () => {
    expect(serializeWorkspaceMode("analizar", "")).toBe("?modo=analizar");
    expect(serializeWorkspaceMode("experto", "?modo=analizar")).toBe("?modo=experto");
  });

  it("preserves unrelated query parameters", () => {
    expect(serializeWorkspaceMode("analizar", "?page=2&modo=experto")).toBe("?page=2&modo=analizar");
    expect(serializeWorkspaceMode("experto", "?page=2&foo=bar")).toBe("?page=2&foo=bar&modo=experto");
  });

  it("handles a search string without a leading question mark", () => {
    expect(serializeWorkspaceMode("experto", "modo=analizar")).toBe("?modo=experto");
  });

  it("clamps invalid modes to the default when serializing", () => {
    expect(serializeWorkspaceMode("nope", "")).toBe("?modo=analizar");
    expect(serializeWorkspaceMode("", "")).toBe("?modo=analizar");
  });

  it("round-trips parsed and serialized modes", () => {
    for (const mode of ["analizar", "experto"]) {
      expect(parseWorkspaceMode(serializeWorkspaceMode(mode, "?a=b"))).toBe(mode);
    }
  });

  it("validates modes", () => {
    expect(isValidWorkspaceMode("analizar")).toBe(true);
    expect(isValidWorkspaceMode("experto")).toBe(true);
    expect(isValidWorkspaceMode("inventado")).toBe(false);
    expect(isValidWorkspaceMode("")).toBe(false);
    expect(isValidWorkspaceMode(null)).toBe(false);
  });

  it("exposes primary-first labels without Guided Builder copy", () => {
    expect(WORKSPACE_MODE_ORDER).toEqual(["analizar", "experto"]);
    expect(WORKSPACE_MODE_LABELS).toEqual({
      [WORKSPACE_MODES.ANALIZAR]: "Analizar cotización",
      [WORKSPACE_MODES.EXPERTO]: "Constructor experto",
    });
    expect(JSON.stringify(WORKSPACE_MODE_LABELS)).not.toContain("Builder guiado");
    expect(JSON.stringify(WORKSPACE_MODE_LABELS)).not.toContain("Guided");
  });
});
