import { describe, expect, it } from "vitest";
import { parseQuotePaste, QUOTE_PASTE_LIMITS } from "./quotePasteParser";

const pick = (row) => ({
  category: row.category,
  product: row.product,
  itemId: row.itemId,
  store: row.store,
  offerPrice: row.offerPrice,
  regularPrice: row.regularPrice,
  notes: row.notes,
  lineNo: row.lineNo,
});

describe("parseQuotePaste", () => {
  it("rejects empty and whitespace-only input", () => {
    expect(() => parseQuotePaste("")).toThrow(/vacío/);
    expect(() => parseQuotePaste("   \n\t ")).toThrow(/vacío/);
    expect(() => parseQuotePaste(null)).toThrow(/no es válido/);
    expect(() => parseQuotePaste(123)).toThrow(/no es válido/);
  });

  it("parses TSV with headers from the existing vocabulary", () => {
    const text = [
      "Componente\tProducto\tItem ID\tTienda\tOferta\tNormal\tNotas",
      "CPU\tIntel Core i5-12400\tcpu-12400\tStore A\t150000\t160000\tnota 1",
      "GPU\tRTX 4060\tgpu-4060\tStore B\t250000\t270000\tnota 2",
    ].join("\n");
    const { rows, headers, delimiter, hasHeaders } = parseQuotePaste(text);
    expect(delimiter).toBe("\t");
    expect(hasHeaders).toBe(true);
    expect(headers).toEqual(["Componente", "Producto", "Item ID", "Tienda", "Oferta", "Normal", "Notas"]);
    expect(rows).toHaveLength(2);
    expect(pick(rows[0])).toEqual({
      category: "CPU",
      product: "Intel Core i5-12400",
      itemId: "cpu-12400",
      store: "Store A",
      offerPrice: "150000",
      regularPrice: "160000",
      notes: "nota 1",
      lineNo: 2,
    });
    expect(pick(rows[1])).toEqual({
      category: "GPU",
      product: "RTX 4060",
      itemId: "gpu-4060",
      store: "Store B",
      offerPrice: "250000",
      regularPrice: "270000",
      notes: "nota 2",
      lineNo: 3,
    });
  });

  it("parses quoted CSV with commas inside cells", () => {
    const text = 'Producto,Componente,Precio\n"RTX 4060, 8GB",GPU,250000\n"Intel Core i5, 13th",CPU,150000';
    const { rows, delimiter, hasHeaders } = parseQuotePaste(text);
    expect(delimiter).toBe(",");
    expect(hasHeaders).toBe(true);
    expect(rows.map((r) => r.product)).toEqual(["RTX 4060, 8GB", "Intel Core i5, 13th"]);
    expect(rows.map((r) => r.category)).toEqual(["GPU", "CPU"]);
    expect(rows.map((r) => r.offerPrice)).toEqual(["250000", "150000"]);
  });

  it("parses semicolon-delimited text", () => {
    const text = "Producto;Componente\nRTX 4060;GPU\nRyzen 5 7600;CPU";
    const { rows, delimiter, hasHeaders } = parseQuotePaste(text);
    expect(delimiter).toBe(";");
    expect(hasHeaders).toBe(true);
    expect(rows.map((r) => r.product)).toEqual(["RTX 4060", "Ryzen 5 7600"]);
    expect(rows.map((r) => r.category)).toEqual(["GPU", "CPU"]);
  });

  it("prefers tab when both tabs and commas appear", () => {
    const text = "Producto\tPrecio\nRTX 4060, 8GB\t250000";
    const { delimiter } = parseQuotePaste(text);
    expect(delimiter).toBe("\t");
  });

  it("creates headerless product-text rows with blank category", () => {
    const text = "RTX 4060\nRyzen 5 7600\nIntel Core i5-12400";
    const { rows, headers, hasHeaders, delimiter } = parseQuotePaste(text);
    expect(hasHeaders).toBe(false);
    expect(headers).toEqual([]);
    expect(delimiter).toBe(",");
    expect(rows).toHaveLength(3);
    expect(pick(rows[0])).toEqual({
      category: "",
      product: "RTX 4060",
      itemId: "",
      store: "",
      offerPrice: "",
      regularPrice: "",
      notes: "",
      lineNo: 1,
    });
    expect(rows.map((r) => r.lineNo)).toEqual([1, 2, 3]);
  });

  it("treats a headerless multi-column line as product text from the first cell", () => {
    const text = "RTX 4060\t250000\nRyzen 5 7600\t150000";
    const { rows, hasHeaders, delimiter } = parseQuotePaste(text);
    expect(hasHeaders).toBe(false);
    expect(delimiter).toBe("\t");
    expect(rows.map((r) => r.product)).toEqual(["RTX 4060", "Ryzen 5 7600"]);
    expect(rows.map((r) => r.offerPrice)).toEqual(["", ""]);
  });

  it("treats unrecognized headers as data instead of eating the first row", () => {
    const text = "Part,Price\nRTX 4060,250000";
    const { rows, hasHeaders } = parseQuotePaste(text);
    expect(hasHeaders).toBe(false);
    expect(rows.map((r) => r.product)).toEqual(["Part", "RTX 4060"]);
  });

  it("handles CRLF line endings and tracks line numbers", () => {
    const text = "RTX 4060\r\nRyzen 5 7600\r\n";
    const { rows, hasHeaders } = parseQuotePaste(text);
    expect(hasHeaders).toBe(false);
    expect(rows.map((r) => r.product)).toEqual(["RTX 4060", "Ryzen 5 7600"]);
    expect(rows.map((r) => r.lineNo)).toEqual([1, 2]);
  });

  it("treats a CRLF 'Producto' header line as a header", () => {
    const text = "Producto\r\nRTX 4060\r\nRyzen 5 7600\r\n";
    const { rows, hasHeaders } = parseQuotePaste(text);
    expect(hasHeaders).toBe(true);
    expect(rows.map((r) => r.product)).toEqual(["RTX 4060", "Ryzen 5 7600"]);
    expect(rows.map((r) => r.lineNo)).toEqual([2, 3]);
  });

  it("skips blank and total lines", () => {
    const text = "Producto,Componente,Oferta\n\nTotal: 400000\nRTX 4060,GPU,250000\n,\nRyzen 5 7600,CPU,150000\nTotal general: 400000";
    const { rows } = parseQuotePaste(text);
    expect(rows.map((r) => r.product)).toEqual(["RTX 4060", "Ryzen 5 7600"]);
  });

  it("unprotects apostrophe-prefixed formula-like cells", () => {
    const text = "Producto,Componente\n'=1+1,CPU\n=2+2,GPU";
    const { rows } = parseQuotePaste(text);
    expect(rows[0].product).toBe("=1+1");
    expect(rows[1].product).toBe("=2+2");
  });

  it("never infers category or itemId from product text", () => {
    const text = "Intel Core i5-12400\nRTX 4060 8GB";
    const { rows } = parseQuotePaste(text);
    expect(rows.every((r) => r.category === "")).toBe(true);
    expect(rows.every((r) => r.itemId === "")).toBe(true);
  });

  it("passes through an explicit item id column but never invents one", () => {
    const text = "Producto,ID\nRTX 4060,gpu-4060\nRyzen 5 7600,";
    const { rows } = parseQuotePaste(text);
    expect(rows[0].itemId).toBe("gpu-4060");
    expect(rows[1].itemId).toBe("");
  });

  it("maps accent-insensitive and alias headers", () => {
    const text = "Producto;Componente\nRTX 4060;Tarjeta de video";
    const { rows, hasHeaders } = parseQuotePaste(text);
    expect(hasHeaders).toBe(true);
    expect(rows[0].category).toBe("Tarjeta de video");
  });

  it("rejects input longer than the bound", () => {
    const text = "RTX 4060\n" + "x".repeat(QUOTE_PASTE_LIMITS.MAX_INPUT_LENGTH);
    expect(() => parseQuotePaste(text)).toThrow(/demasiado largo/);
  });

  it("rejects more rows than the bound", () => {
    const lines = Array.from({ length: QUOTE_PASTE_LIMITS.MAX_ROWS + 1 }, (_, i) => `Producto ${i}`);
    expect(() => parseQuotePaste(lines.join("\n"))).toThrow(/demasiadas líneas/);
  });

  it("rejects cells longer than the bound", () => {
    const long = "y".repeat(QUOTE_PASTE_LIMITS.MAX_CELL_LENGTH + 1);
    expect(() => parseQuotePaste(`Producto\n${long}`)).toThrow(/largo máximo/);
  });

  it("survives malformed quoted input without crashing", () => {
    const text = 'Producto,Componente\n"RTX 4060,GPU\nRyzen 5 7600,CPU';
    const { rows } = parseQuotePaste(text);
    expect(rows).toHaveLength(1);
    expect(rows[0].product).toBe("RTX 4060,GPU\nRyzen 5 7600,CPU");
  });

  it("returns normalized rows with unique ids", () => {
    const { rows } = parseQuotePaste("RTX 4060\nRyzen 5 7600");
    expect(rows[0].id).toBeTruthy();
    expect(rows[1].id).toBeTruthy();
    expect(rows[0].id).not.toBe(rows[1].id);
  });

  it("does not expose the raw clipboard text in the result", () => {
    const { rows } = parseQuotePaste("Producto\nRTX 4060");
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain("Producto");
  });
});
