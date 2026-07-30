import { describe, expect, it } from "vitest";
import {
  createId,
  createEmptyRow,
  createEmptyQuote,
  normalizeRow,
  normalizeQuote,
  isRowEmpty,
  formatDateTime,
  buildRowsFromSelection,
} from "./quoteModel";

describe("createId", () => {
  it("returns a non-empty string", () => {
    const id = createId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("returns unique values on successive calls", () => {
    const a = createId();
    const b = createId();
    expect(a).not.toBe(b);
  });
});

describe("createEmptyRow", () => {
  it("returns a row with all default fields", () => {
    const row = createEmptyRow();
    expect(row).toHaveProperty("id");
    expect(row.category).toBe("");
    expect(row.product).toBe("");
    expect(row.itemId).toBe("");
    expect(row.store).toBe("");
    expect(row.offerPrice).toBe("");
    expect(row.regularPrice).toBe("");
    expect(row.notes).toBe("");
  });
});

describe("createEmptyQuote", () => {
  it("returns a quote with given name", () => {
    const q = createEmptyQuote("Test Quote");
    expect(q.name).toBe("Test Quote");
    expect(q.currency).toBe("CLP");
    expect(q.rows).toHaveLength(1);
  });

  it("uses default name when not provided", () => {
    const q = createEmptyQuote();
    expect(q.name).toBe("Nueva cotización");
  });
});

describe("normalizeRow", () => {
  it("fills missing fields with defaults", () => {
    const row = normalizeRow({ id: "r1", category: "CPU" });
    expect(row.id).toBe("r1");
    expect(row.category).toBe("CPU");
    expect(row.product).toBe("");
    expect(row.store).toBe("");
  });

  it("generates an id when missing", () => {
    const row = normalizeRow({});
    expect(row.id).toBeTruthy();
  });
});

describe("normalizeQuote", () => {
  it("normalizes a minimal quote", () => {
    const q = normalizeQuote({ name: "My Quote", currency: "CLP" });
    expect(q.name).toBe("My Quote");
    expect(q.currency).toBe("CLP");
    expect(q.rows).toHaveLength(1);
  });

  it("uses fallback name when name is missing", () => {
    const q = normalizeQuote({});
    expect(q.name).toBe("Importada");
  });

  it("maps rows through normalizeRow", () => {
    const q = normalizeQuote({ rows: [{ id: "r1" }] });
    expect(q.rows).toHaveLength(1);
    expect(q.rows[0].id).toBe("r1");
  });

  it("creates an empty row when rows is empty array", () => {
    const q = normalizeQuote({ rows: [] });
    expect(q.rows).toHaveLength(1);
  });

  it("uses normalizeCurrency on currency", () => {
    const q = normalizeQuote({ currency: "usd" });
    expect(q.currency).toBe("USD");
  });
});

describe("isRowEmpty", () => {
  it("returns true for default row", () => {
    expect(isRowEmpty(createEmptyRow())).toBe(true);
  });

  it("returns false when category is set", () => {
    expect(isRowEmpty({ category: "CPU" })).toBe(false);
    expect(isRowEmpty({ category: "CPU", product: "Ryzen" })).toBe(false);
  });
});

describe("formatDateTime", () => {
  it("formats a valid date string", () => {
    const result = formatDateTime("2026-07-29T12:00:00Z");
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
  });

  it("returns empty string for null", () => {
    expect(formatDateTime(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(formatDateTime(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(formatDateTime("")).toBe("");
  });

  it("returns empty string for invalid date", () => {
    expect(formatDateTime("not-a-date")).toBe("");
  });
});

describe("buildRowsFromSelection", () => {
  it("returns empty array for empty selection", () => {
    expect(buildRowsFromSelection({})).toEqual([]);
  });

  it("builds a row for CPU", () => {
    const selection = {
      cpu: { id: "cpu-1", name: "Ryzen 5", socket: "AM5", memoryType: "DDR5", tdp: 65 },
    };
    const rows = buildRowsFromSelection(selection);
    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe("Procesador");
    expect(rows[0].itemId).toBe("cpu-1");
  });

  it("builds rows for all selection types", () => {
    const selection = {
      cpu: { id: "c", name: "CPU", socket: "S", memoryType: "DDR5", tdp: 65 },
      mobo: { id: "m", name: "Mobo", socket: "S", formFactor: "ATX", memoryType: "DDR5" },
      ram: { id: "r", name: "RAM", type: "DDR5", speed: 5600 },
      gpu: { id: "g", name: "GPU", tdp: 200, length: 300 },
      psu: { id: "p", name: "PSU", wattage: 750, pcieCables: 3 },
      pcCase: { id: "c1", name: "Case", maxGpuLength: 350, formFactors: ["ATX"] },
    };
    const rows = buildRowsFromSelection(selection);
    expect(rows).toHaveLength(6);
    expect(rows.map((r) => r.category)).toEqual([
      "Procesador", "Placa madre", "RAM", "Tarjeta de video", "Fuente de poder", "Gabinete",
    ]);
  });

  it("generates unique IDs for each row", () => {
    const selection = {
      cpu: { id: "c", name: "CPU", socket: "S", memoryType: "DDR5", tdp: 65 },
      gpu: { id: "g", name: "GPU", tdp: 200, length: 300 },
    };
    const rows = buildRowsFromSelection(selection);
    expect(rows[0].id).not.toBe(rows[1].id);
  });
});
