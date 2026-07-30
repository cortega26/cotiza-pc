import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  deburr,
  normalizeKey,
  slug,
  legacySlug,
  safeNumber,
  assert,
  envNumber,
  stableIdSort,
  sortObjectKeys,
} from "./normalize.js";

describe("deburr", () => {
  it("removes accents", () => {
    expect(deburr("café")).toBe("cafe");
    expect(deburr("Mémoire")).toBe("Memoire");
  });

  it("handles empty strings", () => {
    expect(deburr("")).toBe("");
    expect(deburr()).toBe("");
  });

  it("passes through plain ASCII", () => {
    expect(deburr("Intel Core i5")).toBe("Intel Core i5");
  });
});

describe("normalizeKey", () => {
  it("joins brand and model, lowercased, stripped", () => {
    expect(normalizeKey("AMD", "Ryzen 5 5600")).toBe("amd ryzen 5 5600");
  });

  it("collapses whitespace and removes non-alphanumeric except +", () => {
    expect(normalizeKey("MSI", "B550  Tomahawk  ")).toBe("msi b550 tomahawk");
    expect(normalizeKey("Corsair", "Vengeance LPX DDR4-3200")).toBe("corsair vengeance lpx ddr4 3200");
  });

  it("handles empty parts", () => {
    expect(normalizeKey("", "")).toBe("");
    expect(normalizeKey("Intel", "")).toBe("intel");
  });

  it("deburrs before collapsing", () => {
    expect(normalizeKey("Mémoire", "Café")).toBe("memoire cafe");
  });
});

describe("slug", () => {
  it("lowercases and replaces separators with underscore", () => {
    expect(slug("AMD Ryzen 5")).toBe("amd_ryzen_5");
  });

  it("strips leading/trailing underscores", () => {
    expect(slug("!hello!")).toBe("hello");
  });

  it("preserves plus sign in slug", () => {
    expect(slug("Ryzen 5 5600+")).toBe("ryzen_5_5600+");
    expect(slug("RX 6700 XT+")).toBe("rx_6700_xt+");
  });

  it("handles plus-only string", () => {
    expect(slug("+")).toBe("+");
    expect(slug("+++")).toBe("+++");
  });

  it("handles leading plus", () => {
    expect(slug("+Ryzen 5")).toBe("+ryzen_5");
  });

  it("handles empty", () => {
    expect(slug("")).toBe("");
    expect(slug()).toBe("");
  });
});

describe("legacySlug", () => {
  it("lowercases and replaces separators with underscore", () => {
    expect(legacySlug("AMD Ryzen 5")).toBe("amd_ryzen_5");
  });

  it("strips plus sign (unlike slug)", () => {
    expect(legacySlug("Ryzen 5 5600+")).toBe("ryzen_5_5600");
    expect(legacySlug("RX 6700 XT+")).toBe("rx_6700_xt");
  });

  it("strips leading/trailing underscores", () => {
    expect(legacySlug("!hello!")).toBe("hello");
  });

  it("handles empty", () => {
    expect(legacySlug("")).toBe("");
    expect(legacySlug()).toBe("");
  });
});

describe("safeNumber", () => {
  it("parses valid numbers", () => {
    expect(safeNumber("42")).toBe(42);
    expect(safeNumber(3.14)).toBe(3.14);
  });

  it("returns null for NaN/Infinity/undefined; null becomes 0 per existing semantics", () => {
    expect(safeNumber("abc")).toBe(null);
    expect(safeNumber(Infinity)).toBe(null);
    expect(safeNumber(null)).toBe(0);
    expect(safeNumber(undefined)).toBe(null);
  });

  it("returns 0 for empty string (Number('') semantics)", () => {
    expect(safeNumber("")).toBe(0);
  });
});

describe("assert", () => {
  it("throws on falsy", () => {
    expect(() => assert(false, "fail")).toThrow("fail");
    expect(() => assert(0, "zero")).toThrow("zero");
    expect(() => assert(null, "null")).toThrow("null");
  });

  it("passes on truthy", () => {
    expect(() => assert(true, "ok")).not.toThrow();
    expect(() => assert(1, "ok")).not.toThrow();
    expect(() => assert("yes", "ok")).not.toThrow();
  });
});

describe("envNumber", () => {
  const OLD = process.env;

  beforeEach(() => {
    process.env = { ...OLD };
  });

  afterEach(() => {
    process.env = OLD;
  });

  it("returns fallback when env is missing or empty", () => {
    delete process.env.TEST_VAR;
    expect(envNumber("TEST_VAR", 42)).toBe(42);
    process.env.TEST_VAR = "";
    expect(envNumber("TEST_VAR", 42)).toBe(42);
  });

  it("parses valid numbers from env", () => {
    process.env.TEST_VAR = "100";
    expect(envNumber("TEST_VAR", 42)).toBe(100);
  });

  it("falls back for non-finite numbers", () => {
    process.env.TEST_VAR = "notanumber";
    expect(envNumber("TEST_VAR", 42)).toBe(42);
  });
});

describe("stableIdSort", () => {
  it("sorts by id", () => {
    const items = [{ id: "z" }, { id: "a" }, { id: "m" }];
    items.sort(stableIdSort);
    expect(items.map((i) => i.id)).toEqual(["a", "m", "z"]);
  });

  it("handles missing ids", () => {
    const items = [{ id: "b" }, {}, { id: "a" }];
    items.sort(stableIdSort);
    expect(items.map((i) => i.id || "")).toEqual(["", "a", "b"]);
  });
});

describe("sortObjectKeys", () => {
  it("sorts keys lexicographically", () => {
    expect(sortObjectKeys({ z: 1, a: 2, m: 3 })).toEqual({ a: 2, m: 3, z: 1 });
  });

  it("handles null/undefined", () => {
    expect(sortObjectKeys(null)).toEqual({});
    expect(sortObjectKeys(undefined)).toEqual({});
  });
});
