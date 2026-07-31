/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { slugify, freshIds, buildQuotesFromJson, exportCSV, exportJSON, downloadFile } from "./fileIO";

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Mi PC Actual")).toBe("mi-pc-actual");
  });

  it("strips accents", () => {
    expect(slugify("Mi Cotización Éxito")).toBe("mi-cotizacion-exito");
  });

  it("replaces non-alphanumeric runs with hyphens", () => {
    expect(slugify("PC #1 (Ryzen)")).toBe("pc-1-ryzen");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("--hello--")).toBe("hello");
  });

  it("falls back to cotizacion for falsy input", () => {
    expect(slugify(null)).toBe("cotizacion");
    expect(slugify(undefined)).toBe("cotizacion");
    expect(slugify("")).toBe("cotizacion");
  });
});

describe("freshIds", () => {
  it("removes id from the object", () => {
    const result = freshIds({ id: "abc", name: "test", rows: [] });
    expect(result.id).toBeUndefined();
    expect(result.name).toBe("test");
  });

  it("removes id from each row", () => {
    const result = freshIds({
      id: "x",
      rows: [
        { id: "r1", product: "A" },
        { id: "r2", product: "B" },
      ],
    });
    expect(result.rows[0].id).toBeUndefined();
    expect(result.rows[0].product).toBe("A");
    expect(result.rows[1].id).toBeUndefined();
  });

  it("handles non-array rows", () => {
    const result = freshIds({ id: "x", rows: null });
    expect(result.rows).toBeNull();
  });

  it("handles missing rows", () => {
    const result = freshIds({ id: "x" });
    expect(result.rows).toBeUndefined();
  });
});

describe("buildQuotesFromJson", () => {
  const normalizeQuote = (q, name) => ({ ...q, name, normalized: true });

  it("handles an array of quotes", () => {
    const result = buildQuotesFromJson([{ id: "a", rows: [] }, { id: "b", rows: [] }], normalizeQuote);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Importada 1");
    expect(result[0].normalized).toBe(true);
    expect(result[0].id).toBeUndefined();
  });

  it("handles { quotes: [...] } format", () => {
    const result = buildQuotesFromJson({ quotes: [{ id: "a", rows: [] }] }, normalizeQuote);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Importada 1");
  });

  it("handles a single quote object with rows", () => {
    const result = buildQuotesFromJson({ id: "a", rows: [{ product: "CPU" }] }, normalizeQuote);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Importada JSON");
  });

  it("throws for unrecognized format", () => {
    expect(() => buildQuotesFromJson({ foo: "bar" }, normalizeQuote)).toThrow("Formato JSON no reconocido");
  });

  it("throws for null", () => {
    expect(() => buildQuotesFromJson(null, normalizeQuote)).toThrow("Formato JSON no reconocido");
  });
});

describe("exportCSV", () => {
  const esc = (v) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const quote = {
    name: "Test",
    rows: [
      { category: "CPU", product: "Ryzen 5", itemId: "cpu1", store: "Store", offerPrice: 100, regularPrice: 120, notes: "" },
      { category: "GPU", product: "RTX 4060", itemId: "gpu1", store: "Store", offerPrice: 300, regularPrice: 350, notes: "Good" },
    ],
  };

  const totals = { totalOffer: 400, totalRegular: 470, saving: 70 };

  it("includes header row", () => {
    const csv = exportCSV(quote, totals, esc);
    expect(csv).toMatch(/^Componente,Producto,itemId/);
  });

  it("includes data rows", () => {
    const csv = exportCSV(quote, totals, esc);
    expect(csv).toContain("CPU,Ryzen 5,cpu1");
    expect(csv).toContain("GPU,RTX 4060,gpu1");
  });

  it("includes totals at the end", () => {
    const csv = exportCSV(quote, totals, esc);
    const lines = csv.split("\n");
    expect(lines[lines.length - 3]).toBe("Total oferta,400");
    expect(lines[lines.length - 2]).toBe("Total normal,470");
    expect(lines[lines.length - 1]).toBe("Ahorro,70");
  });

  it("escapes fields containing quotes or commas", () => {
    const q = { ...quote, rows: [{ category: 'CPU, AMD', product: 'Ryzen "5"', itemId: '', store: '', offerPrice: '', regularPrice: '', notes: '' }] };
    const csv = exportCSV(q, totals, esc);
    expect(csv).toContain('"CPU, AMD"');
    expect(csv).toContain('"Ryzen ""5"""');
  });

  it("handles null totals without crashing", () => {
    const csv = exportCSV(quote, null, esc);
    expect(csv).toContain("Total oferta,0");
  });

  it("handles undefined totals without crashing", () => {
    const csv = exportCSV(quote, undefined, esc);
    expect(csv).toContain("Total oferta,0");
  });
});

describe("exportJSON", () => {
  it("includes totals and generatedAt", () => {
    const quote = { id: "q1", name: "Test", rows: [] };
    const totals = { totalOffer: 500 };
    const result = exportJSON(quote, totals);
    expect(result.id).toBe("q1");
    expect(result.totals).toEqual(totals);
    expect(result.generatedAt).toBeDefined();
    expect(typeof result.generatedAt).toBe("string");
  });

  it("does not mutate the original quote", () => {
    const quote = { id: "q1", rows: [] };
    const totals = {};
    exportJSON(quote, totals);
    expect(quote.generatedAt).toBeUndefined();
  });

  it("handles null totals without crashing", () => {
    const result = exportJSON({ id: "q1", name: "T", rows: [] }, null);
    expect(result.totals).toEqual({});
    expect(result.generatedAt).toBeDefined();
  });

  it("handles undefined totals without crashing", () => {
    const result = exportJSON({ id: "q1", name: "T", rows: [] }, undefined);
    expect(result.totals).toEqual({});
  });
});

describe("downloadFile", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a link and triggers click", () => {
    const click = vi.fn();
    vi.spyOn(document, "createElement").mockReturnValue({
      href: "",
      download: "",
      click,
    });
    vi.spyOn(document.body, "appendChild").mockReturnValue(null);
    vi.spyOn(document.body, "removeChild").mockReturnValue(null);

    downloadFile("content", "test.csv", "text/csv");

    expect(document.createElement).toHaveBeenCalledWith("a");
    expect(document.body.appendChild).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(document.body.removeChild).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });
});
