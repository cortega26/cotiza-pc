import { describe, expect, it } from "vitest";
import {
  escapeCsvField,
  unprotectFormulaField,
  parseCsv,
  parseCsvToQuote,
  parsePriceCsv,
  parsePriceJson,
  buildPriceMap,
} from "./csvParser";

const normalizeRow = (row) => ({
  id: row.id || "generated",
  category: row.category || "",
  product: row.product || "",
  itemId: row.itemId || "",
  store: row.store || "",
  offerPrice: row.offerPrice || "",
  regularPrice: row.regularPrice || "",
  notes: row.notes || "",
});

const normalizeQuote = (quote, fallbackName) => ({
  id: quote.id || "generated",
  name: quote.name || fallbackName,
  currency: (quote.currency || "CLP").toUpperCase(),
  priceUpdatedAt: quote.priceUpdatedAt || "",
  rows: Array.isArray(quote.rows) && quote.rows.length ? quote.rows.map(normalizeRow) : [],
});

describe("escapeCsvField", () => {
  it("returns empty string for null/undefined", () => {
    expect(escapeCsvField(null)).toBe("");
    expect(escapeCsvField(undefined)).toBe("");
  });

  it("passes through simple values unquoted", () => {
    expect(escapeCsvField("simple")).toBe("simple");
    expect(escapeCsvField("123")).toBe("123");
    expect(escapeCsvField("")).toBe("");
  });

  it("wraps values containing comma in quotes", () => {
    expect(escapeCsvField("a,b")).toBe('"a,b"');
  });

  it("wraps values containing quotes and escapes inner quotes", () => {
    expect(escapeCsvField('say "hello"')).toBe('"say ""hello"""');
  });

  it("wraps values containing newlines in quotes", () => {
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("wraps values containing carriage return + newline", () => {
    expect(escapeCsvField("a\r\nb")).toBe('"a\r\nb"');
  });

  it("prefixes = with single quote to prevent formula execution", () => {
    expect(escapeCsvField("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
  });

  it("prefixes + with single quote to prevent formula execution", () => {
    expect(escapeCsvField("+SUM(A1:A10)")).toBe("'+SUM(A1:A10)");
  });

  it("prefixes - with single quote to prevent formula execution", () => {
    expect(escapeCsvField("-1+1")).toBe("'-1+1");
  });

  it("prefixes @ with single quote to prevent formula execution", () => {
    expect(escapeCsvField("@SUM(A1:A10)")).toBe("'@SUM(A1:A10)");
  });

  it("prefixes tab with single quote to prevent formula execution", () => {
    expect(escapeCsvField("\t=cmd")).toBe("'\t=cmd");
  });

  it("does not prefix safe text", () => {
    expect(escapeCsvField("hello")).toBe("hello");
    expect(escapeCsvField("123")).toBe("123");
    expect(escapeCsvField("equals in middle")).toBe("equals in middle");
    expect(escapeCsvField("")).toBe("");
  });

  it("quotes a formula-prefixed value that also contains a comma", () => {
    const result = escapeCsvField("=SUM(A1, A2)");
    // RFC-4180 quoting wraps the entire prefixed value
    expect(result).toBe('"\'=SUM(A1, A2)"');
  });
});

describe("unprotectFormulaField", () => {
  it("strips leading single quote before formula trigger", () => {
    expect(unprotectFormulaField("'=SUM(A1)")).toBe("=SUM(A1)");
    expect(unprotectFormulaField("'+1+1")).toBe("+1+1");
    expect(unprotectFormulaField("'-hello")).toBe("-hello");
    expect(unprotectFormulaField("'@hello")).toBe("@hello");
    expect(unprotectFormulaField("'\t=cmd")).toBe("\t=cmd");
  });

  it("does not strip single quote from normal text", () => {
    expect(unprotectFormulaField("'hello")).toBe("'hello");
    expect(unprotectFormulaField("it's fine")).toBe("it's fine");
  });

  it("does not strip lone single quote", () => {
    expect(unprotectFormulaField("'")).toBe("'");
  });

  it("returns null/undefined as-is", () => {
    expect(unprotectFormulaField(null)).toBe(null);
    expect(unprotectFormulaField(undefined)).toBe(undefined);
  });

  it("round-trips formula-prefixed value through escape + unprotect", () => {
    const original = "=SUM(A1:A10)";
    const exported = escapeCsvField(original);
    const imported = unprotectFormulaField(exported);
    expect(imported).toBe(original);
  });

  it("round-trips safe value unchanged", () => {
    const original = "hello world";
    const exported = escapeCsvField(original);
    const imported = unprotectFormulaField(exported);
    expect(imported).toBe(original);
  });
});

describe("parseCsv", () => {
  it("returns empty result for empty string", () => {
    expect(parseCsv("")).toEqual({ headers: [], rows: [] });
    expect(parseCsv(null)).toEqual({ headers: [], rows: [] });
    expect(parseCsv(undefined)).toEqual({ headers: [], rows: [] });
  });

  it("parses simple CSV with header and rows", () => {
    const result = parseCsv("a,b,c\n1,2,3\n4,5,6");
    expect(result.headers).toEqual(["a", "b", "c"]);
    expect(result.rows).toEqual([
      ["1", "2", "3"],
      ["4", "5", "6"],
    ]);
  });

  it("handles quoted fields with commas inside", () => {
    const result = parseCsv('"a,b",c\n1,2');
    expect(result.headers).toEqual(["a,b", "c"]);
  });

  it("handles quoted fields with newlines inside", () => {
    const result = parseCsv('"a\nb",c\nd,e');
    expect(result.headers).toEqual(["a\nb", "c"]);
    expect(result.rows).toEqual([["d", "e"]]);
  });

  it("handles escaped quotes inside quoted fields", () => {
    const result = parseCsv('"say ""hello""",value');
    expect(result.headers).toEqual(['say "hello"', "value"]);
  });

  it("handles \\r\\n line endings", () => {
    const result = parseCsv("a,b\r\n1,2\r\n3,4");
    expect(result.headers).toEqual(["a", "b"]);
    expect(result.rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("handles \\r line endings", () => {
    const result = parseCsv("a,b\r1,2\r3,4");
    expect(result.headers).toEqual(["a", "b"]);
    expect(result.rows).toEqual([
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("handles mixed \\r\\n and \\n line endings", () => {
    const result = parseCsv("a,b\r\nc,d\ne,f\rg,h");
    expect(result.headers).toEqual(["a", "b"]);
    expect(result.rows).toEqual([
      ["c", "d"],
      ["e", "f"],
      ["g", "h"],
    ]);
  });

  it("skips trailing empty rows", () => {
    const result = parseCsv("a,b\n1,2\n\n");
    expect(result.headers).toEqual(["a", "b"]);
    expect(result.rows).toEqual([["1", "2"]]);
  });

  it("handles trailing empty cells", () => {
    const result = parseCsv("a,b,\n1,2,");
    expect(result.headers).toEqual(["a", "b", ""]);
    expect(result.rows).toEqual([["1", "2", ""]]);
  });

  it("handles only a header row", () => {
    const result = parseCsv("a,b,c");
    expect(result.headers).toEqual(["a", "b", "c"]);
    expect(result.rows).toEqual([]);
  });

  it("handles header with trailing newline and no data rows", () => {
    const result = parseCsv("a,b,c\n");
    expect(result.headers).toEqual(["a", "b", "c"]);
    expect(result.rows).toEqual([]);
  });

  it("parses empty quoted field", () => {
    const result = parseCsv('a,"",b\n1,,3');
    expect(result.headers).toEqual(["a", "", "b"]);
    expect(result.rows).toEqual([["1", "", "3"]]);
  });

  it("handles unclosed quote at end of file", () => {
    const result = parseCsv('a,b\n1,"unclosed');
    expect(result.headers).toEqual(["a", "b"]);
    expect(result.rows).toEqual([["1", "unclosed"]]);
  });

  it("preserves whitespace in unquoted fields (RFC 4180)", () => {
    const result = parseCsv("a, b ,c\n1, 2 ,3");
    expect(result.headers).toEqual(["a", " b ", "c"]);
    expect(result.rows).toEqual([["1", " 2 ", "3"]]);
  });

  it("does not trim whitespace inside quoted fields", () => {
    const result = parseCsv('" a "," b "\n" 1 "," 2 "');
    expect(result.headers).toEqual([" a ", " b "]);
    expect(result.rows).toEqual([[" 1 ", " 2 "]]);
  });

  it("handles row with fewer cells than header", () => {
    const result = parseCsv("a,b,c\n1,2");
    expect(result.headers).toEqual(["a", "b", "c"]);
    expect(result.rows).toEqual([["1", "2"]]);
  });

  it("handles single column CSV", () => {
    const result = parseCsv("a\n1\n2\n3");
    expect(result.headers).toEqual(["a"]);
    expect(result.rows).toEqual([["1"], ["2"], ["3"]]);
  });
});

describe("parseCsvToQuote", () => {
  const helpers = { normalizeRow, normalizeQuote };

  it("parses a minimal valid CSV into a quote", () => {
    const csv = "Componente,Producto\nCPU,Ryzen 5 7600\nGPU,RTX 4060";
    const quote = parseCsvToQuote(csv, helpers);
    expect(quote.name).toBe("Importada CSV");
    expect(quote.currency).toBe("CLP");
    expect(quote.rows).toHaveLength(2);
    expect(quote.rows[0].category).toBe("CPU");
    expect(quote.rows[0].product).toBe("Ryzen 5 7600");
    expect(quote.rows[1].category).toBe("GPU");
    expect(quote.rows[1].product).toBe("RTX 4060");
  });

  it("round-trips a notes field containing comma, quote, and newline", () => {
    const originalNotes = 'nota con, coma y "comillas"\ny salto de línea';
    const csvLine = escapeCsvField("CPU") + "," + escapeCsvField("Ryzen 5") + "," + escapeCsvField(originalNotes);
    const csv = "Componente,Producto,Notas\n" + csvLine;

    const quote = parseCsvToQuote(csv, helpers);
    expect(quote.rows).toHaveLength(1);
    expect(quote.rows[0].notes).toBe(originalNotes);
  });

  it("detects Spanish-accented column names", () => {
    const csv = "Componente,Producto,Tienda,Precio oferta,Precio normal,Notas\nCPU,Ryzen,StoreX,100,200,ok";
    const quote = parseCsvToQuote(csv, helpers);
    expect(quote.rows[0].store).toBe("StoreX");
    expect(quote.rows[0].offerPrice).toBe("100");
    expect(quote.rows[0].regularPrice).toBe("200");
    expect(quote.rows[0].notes).toBe("ok");
  });

  it("skips total lines", () => {
    const csv = "Componente,Producto\nCPU,Ryzen\nTotal oferta,1000";
    const quote = parseCsvToQuote(csv, helpers);
    expect(quote.rows).toHaveLength(1);
  });

  it("throws on empty CSV", () => {
    expect(() => parseCsvToQuote("", helpers)).toThrow("vacío");
  });

  it("throws when required columns are missing", () => {
    const csv = "Something,Other\n1,2";
    expect(() => parseCsvToQuote(csv, helpers)).toThrow("componente");
  });

  it("handles missing optional columns gracefully", () => {
    const csv = "Componente,Producto\nCPU,Ryzen";
    const quote = parseCsvToQuote(csv, helpers);
    expect(quote.rows[0].store).toBe("");
    expect(quote.rows[0].offerPrice).toBe("");
  });

  it("accepts alternate column names", () => {
    const csv = "categoria,item\nCPU,Ryzen";
    const quote = parseCsvToQuote(csv, helpers);
    expect(quote.rows).toHaveLength(1);
    expect(quote.rows[0].category).toBe("CPU");
  });

  it("handles BOM in header row", () => {
    const csv = "\uFEFFComponente,Producto\nCPU,Ryzen";
    const quote = parseCsvToQuote(csv, helpers);
    expect(quote.rows).toHaveLength(1);
    expect(quote.rows[0].category).toBe("CPU");
  });

  it("handles rows with quoted commas in product names", () => {
    const csv = 'Componente,Producto,Precio oferta\nCPU,"Ryzen 5, 7600",100';
    const quote = parseCsvToQuote(csv, helpers);
    expect(quote.rows).toHaveLength(1);
    expect(quote.rows[0].product).toBe("Ryzen 5, 7600");
    expect(quote.rows[0].offerPrice).toBe("100");
  });

  it("trims whitespace from cell values (backward compat)", () => {
    const csv = "Componente,Producto\nCPU , Ryzen 5 ";
    const quote = parseCsvToQuote(csv, helpers);
    expect(quote.rows).toHaveLength(1);
    expect(quote.rows[0].category).toBe("CPU");
    expect(quote.rows[0].product).toBe("Ryzen 5");
  });

  it("reads itemId column when present", () => {
    const csv = "Componente,Producto,itemId\nCPU,Ryzen 5,cpu-001\nGPU,RTX 4060,gpu-002";
    const quote = parseCsvToQuote(csv, helpers);
    expect(quote.rows).toHaveLength(2);
    expect(quote.rows[0].itemId).toBe("cpu-001");
    expect(quote.rows[1].itemId).toBe("gpu-002");
  });

  it("accepts alternate itemId column names", () => {
    const csv = "Componente,Producto,id_producto\nCPU,Ryzen 5,cpu-001";
    const quote = parseCsvToQuote(csv, helpers);
    expect(quote.rows[0].itemId).toBe("cpu-001");
  });

  it("defaults itemId to empty when column is missing (legacy CSV)", () => {
    const csv = "Componente,Producto,Tienda\nCPU,Ryzen 5,StoreX";
    const quote = parseCsvToQuote(csv, helpers);
    expect(quote.rows).toHaveLength(1);
    expect(quote.rows[0].itemId).toBe("");
  });

  it("round-trips formula-protected cells through export and import", () => {
    const dangerousNote = "=SUM(A1:A10)";
    const csvLine = [
      escapeCsvField("CPU"),
      escapeCsvField("Ryzen 5"),
      escapeCsvField(dangerousNote),
    ].join(",");
    const csv = "Componente,Producto,Notas\n" + csvLine;
    const quote = parseCsvToQuote(csv, helpers);
    expect(quote.rows).toHaveLength(1);
    expect(quote.rows[0].notes).toBe(dangerousNote);
  });
});

describe("parsePriceCsv", () => {
  it("parses price CSV into items", () => {
    const csv = "id,offerPrice,regularPrice\nitem1,100,200\nitem2,150,250";
    const items = parsePriceCsv(csv);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ id: "item1", offerPrice: "100", regularPrice: "200", store: "" });
    expect(items[1]).toEqual({ id: "item2", offerPrice: "150", regularPrice: "250", store: "" });
  });

  it("handles many input items", () => {
    const lines = ["id,offerPrice"];
    for (let i = 0; i < 1000; i++) {
      lines.push(`item${i},${i * 10}`);
    }
    const items = parsePriceCsv(lines.join("\n"));
    expect(items).toHaveLength(1000);
    expect(items[500]).toEqual({ id: "item500", offerPrice: "5000", regularPrice: "", store: "" });
  });

  it("preserves first item when duplicate IDs exist", () => {
    const csv = "id,offer\nid1,100\nid1,200\nid1,300";
    const items = parsePriceCsv(csv);
    expect(items).toHaveLength(3);
    expect(items[0].offerPrice).toBe("100");
    expect(items[1].offerPrice).toBe("200");
    expect(items[2].offerPrice).toBe("300");
  });

  it("throws when id column is missing", () => {
    const csv = "name,price\nitem1,100";
    expect(() => parsePriceCsv(csv)).toThrow("id");
  });

  it("handles quoted prices", () => {
    const csv = 'id,"offer","regular"\nitem1,"1,000","2,000"';
    const items = parsePriceCsv(csv);
    expect(items[0].offerPrice).toBe("1,000");
    expect(items[0].regularPrice).toBe("2,000");
  });

  it("handles empty CSV", () => {
    expect(() => parsePriceCsv("")).toThrow("vacío");
  });

  it("trims whitespace around id and prices", () => {
    const csv = "id,offerPrice\n item1 , 100 ";
    const items = parsePriceCsv(csv);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("item1");
    expect(items[0].offerPrice).toBe("100");
  });

  it("handles extra columns beyond id/price", () => {
    const csv = "id,offerPrice,extra,unused\nitem1,100,skip,ignore";
    const items = parsePriceCsv(csv);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("item1");
    expect(items[0].offerPrice).toBe("100");
  });
});

describe("parsePriceJson", () => {
  it("parses an array of items", () => {
    const items = parsePriceJson('[{"id":"i1","offerPrice":"100"}]');
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("i1");
  });

  it("parses object with items array", () => {
    const items = parsePriceJson('{"items":[{"id":"i1"}]}');
    expect(items).toHaveLength(1);
  });

  it("throws for unrecognized format", () => {
    expect(() => parsePriceJson('{"name":"test"}')).toThrow("no reconocido");
  });

  it("handles empty array", () => {
    const items = parsePriceJson("[]");
    expect(items).toEqual([]);
  });

  it("handles object with empty items array", () => {
    const items = parsePriceJson('{"items":[]}');
    expect(items).toEqual([]);
  });
});

describe("buildPriceMap", () => {
  it("builds a Map keyed by id", () => {
    const items = [
      { id: "a", offerPrice: "100" },
      { id: "b", offerPrice: "200" },
    ];
    const map = buildPriceMap(items);
    expect(map.get("a").offerPrice).toBe("100");
    expect(map.get("b").offerPrice).toBe("200");
    expect(map.size).toBe(2);
  });

  it("keeps the first entry when duplicate IDs exist", () => {
    const items = [
      { id: "x", offerPrice: "first" },
      { id: "x", offerPrice: "second" },
    ];
    const map = buildPriceMap(items);
    expect(map.get("x").offerPrice).toBe("first");
    expect(map.size).toBe(1);
  });

  it("skips items without id", () => {
    const items = [
      { id: "a", offerPrice: "100" },
      { noId: true, offerPrice: "200" },
    ];
    const map = buildPriceMap(items);
    expect(map.size).toBe(1);
    expect(map.get("a").offerPrice).toBe("100");
  });

  it("returns empty map for empty input", () => {
    const map = buildPriceMap([]);
    expect(map.size).toBe(0);
  });

  it("handles items with extra unknown fields", () => {
    const items = [{ id: "a", offerPrice: "100", extraField: "extra" }];
    const map = buildPriceMap(items);
    expect(map.get("a").extraField).toBe("extra");
  });

  it("handles all-null/undefined prices", () => {
    const items = [{ id: "a", offerPrice: null, regularPrice: undefined }];
    const map = buildPriceMap(items);
    expect(map.get("a").offerPrice).toBe(null);
    expect(map.get("a").regularPrice).toBe(undefined);
  });

  it("handles numeric price values", () => {
    const items = [{ id: "a", offerPrice: 150 }];
    const map = buildPriceMap(items);
    expect(map.get("a").offerPrice).toBe(150);
  });
});

describe("CSV round-trip", () => {
  it("preserves a notes field with comma, quote, and newline through export-import", () => {
    const originalNotes = 'Nota: "Excelente",\nprecio: $1,500\nrecomendado';

    const csvLine = [
      escapeCsvField("CPU"),
      escapeCsvField("Ryzen 5"),
      escapeCsvField("TiendaX"),
      escapeCsvField("100"),
      escapeCsvField("200"),
      escapeCsvField(originalNotes),
    ].join(",");

    const csv = "Componente,Producto,Tienda,Precio oferta,Precio normal,Notas\n" + csvLine;

    const quote = parseCsvToQuote(csv, { normalizeRow, normalizeQuote });
    expect(quote.rows).toHaveLength(1);
    expect(quote.rows[0].notes).toBe(originalNotes);
    expect(quote.rows[0].category).toBe("CPU");
    expect(quote.rows[0].product).toBe("Ryzen 5");
    expect(quote.rows[0].store).toBe("TiendaX");
    expect(quote.rows[0].offerPrice).toBe("100");
    expect(quote.rows[0].regularPrice).toBe("200");
  });

  it("applies price Map to rows with first-match-wins semantics", () => {
    const items = [
      { id: "cpu1", offerPrice: "150", regularPrice: "200" },
      { id: "cpu1", offerPrice: "140", regularPrice: "190" },
      { id: "gpu1", offerPrice: "300", regularPrice: "350" },
    ];
    const map = buildPriceMap(items);
    const rows = [
      { itemId: "cpu1", offerPrice: "", regularPrice: "" },
      { itemId: "gpu1", offerPrice: "", regularPrice: "" },
    ];

    const applied = rows.map((row) => {
      const match = map.get(row.itemId);
      if (!match) return row;
      return {
        ...row,
        offerPrice: match.offerPrice || row.offerPrice,
        regularPrice: match.regularPrice || row.regularPrice,
      };
    });

    expect(applied[0].offerPrice).toBe("150");
    expect(applied[0].regularPrice).toBe("200");
    expect(applied[1].offerPrice).toBe("300");
    expect(applied[1].regularPrice).toBe("350");
  });
});
