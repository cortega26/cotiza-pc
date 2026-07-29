import { describe, expect, it } from "vitest";
import { parsePrice, computeTotals, normalizeCurrency } from "./money";

describe("parsePrice", () => {
  it("parses plain integer", () => {
    expect(parsePrice("1234567")).toEqual({ status: "valid", value: 1234567, raw: "1234567" });
  });

  it("parses CLP-style dotted thousands as integer", () => {
    expect(parsePrice("1.234.567", "CLP")).toEqual({ status: "valid", value: 1234567, raw: "1.234.567" });
  });

  it("parses CLP-style with single dot as integer", () => {
    expect(parsePrice("1.000", "CLP")).toEqual({ status: "valid", value: 1000, raw: "1.000" });
  });

  it("parses CLP-style with comma as integer", () => {
    expect(parsePrice("1,234", "CLP")).toEqual({ status: "valid", value: 1234, raw: "1,234" });
  });

  it("parses USD-style with comma thousands and dot decimal", () => {
    expect(parsePrice("1,234.56", "USD")).toEqual({ status: "valid", value: 1234.56, raw: "1,234.56" });
  });

  it("parses EUR-style with dot thousands and comma decimal", () => {
    expect(parsePrice("1.234,56", "EUR")).toEqual({ status: "valid", value: 1234.56, raw: "1.234,56" });
  });

  it("parses plain decimal with dot", () => {
    expect(parsePrice("1234.56", "USD")).toEqual({ status: "valid", value: 1234.56, raw: "1234.56" });
  });

  it("parses zero", () => {
    expect(parsePrice("0")).toEqual({ status: "valid", value: 0, raw: "0" });
  });

  it("returns missing for empty string", () => {
    expect(parsePrice("")).toEqual({ status: "missing", value: null, raw: "" });
  });

  it("returns missing for null", () => {
    expect(parsePrice(null)).toEqual({ status: "missing", value: null, raw: null });
  });

  it("returns missing for undefined", () => {
    expect(parsePrice(undefined)).toEqual({ status: "missing", value: null, raw: undefined });
  });

  it("returns invalid for non-numeric text", () => {
    const result = parsePrice("abc");
    expect(result.status).toBe("invalid");
    expect(result.value).toBeNull();
  });

  it("returns invalid for mixed text and numbers", () => {
    const result = parsePrice("12a34");
    expect(result.status).toBe("invalid");
  });

  it("returns valid for '0'", () => {
    expect(parsePrice("0")).toEqual({ status: "valid", value: 0, raw: "0" });
  });

  it("trims whitespace", () => {
    expect(parsePrice("  50000  ")).toEqual({ status: "valid", value: 50000, raw: "  50000  " });
  });

  it("handles CLP with both separators (comma as thousands)", () => {
    expect(parsePrice("12,500", "CLP")).toEqual({ status: "valid", value: 12500, raw: "12,500" });
  });

  it("handles multiple commas (thousands separators) in CLP", () => {
    expect(parsePrice("12,500,000", "CLP")).toEqual({ status: "valid", value: 12500000, raw: "12,500,000" });
  });
});

describe("parsePrice — partial / edge", () => {
  it("treats single comma with 2 trailing digits as decimal (EUR heuristic)", () => {
    expect(parsePrice("99,50", "USD")).toEqual({ status: "valid", value: 99.5, raw: "99,50" });
  });

  it("treats single comma with 3+ trailing digits as thousands", () => {
    expect(parsePrice("1,500", "USD")).toEqual({ status: "valid", value: 1500, raw: "1,500" });
  });
});

describe("computeTotals", () => {
  function row(offer, regular) {
    return { offerPrice: offer, regularPrice: regular };
  }

  it("returns zeros for empty rows", () => {
    const result = computeTotals([]);
    expect(result).toEqual({ totalOffer: 0, totalRegular: 0, saving: 0, rowsWithPrice: 0, savingRowCount: 0 });
  });

  it("sums offer and regular prices", () => {
    const result = computeTotals([row("50000", "55000"), row("200000", "220000")]);
    expect(result.totalOffer).toBe(250000);
    expect(result.totalRegular).toBe(275000);
    expect(result.saving).toBe(25000);
    expect(result.rowsWithPrice).toBe(2);
  });

  it("computes saving only from rows with both prices", () => {
    const result = computeTotals([row("50000", "55000"), row("1000", "")]);
    expect(result.totalOffer).toBe(51000);
    expect(result.totalRegular).toBe(55000);
    expect(result.saving).toBe(5000);
    expect(result.rowsWithPrice).toBe(2);
    expect(result.savingRowCount).toBe(1);
  });

  it("handles offer-only rows without false saving", () => {
    const result = computeTotals([row("50000", "")]);
    expect(result.saving).toBe(0);
    expect(result.rowsWithPrice).toBe(1);
  });

  it("handles regular-only rows without false saving", () => {
    const result = computeTotals([row("", "55000")]);
    expect(result.saving).toBe(0);
    expect(result.rowsWithPrice).toBe(1);
  });

  it("parses CLP-formatted prices", () => {
    const result = computeTotals([row("1.000.000", "1.200.000"), row("500.000", "550.000")], "CLP");
    expect(result.totalOffer).toBe(1500000);
    expect(result.totalRegular).toBe(1750000);
  });

  it("parses USD-formatted prices", () => {
    const result = computeTotals([row("1,000.50", "1,200.00"), row("500.25", "550.00")], "USD");
    expect(result.totalOffer).toBe(1500.75);
    expect(result.totalRegular).toBe(1750);
  });

  it("ignores rows with invalid prices", () => {
    const result = computeTotals([row("abc", "def"), row("50000", "55000")]);
    expect(result.totalOffer).toBe(50000);
    expect(result.totalRegular).toBe(55000);
    expect(result.rowsWithPrice).toBe(1);
  });

  it("handles negative saving when offer exceeds regular", () => {
    const result = computeTotals([row("100000", "80000")]);
    expect(result.saving).toBe(-20000);
  });
});

describe("normalizeCurrency", () => {
  it("returns CLP for null", () => {
    expect(normalizeCurrency(null)).toBe("CLP");
  });

  it("returns CLP for empty string", () => {
    expect(normalizeCurrency("")).toBe("CLP");
  });

  it("returns CLP for invalid code", () => {
    expect(normalizeCurrency("XYZ")).toBe("CLP");
  });

  it("returns CLP for partial input", () => {
    expect(normalizeCurrency("G")).toBe("CLP");
  });

  it("validates and returns CLP for 'clp'", () => {
    expect(normalizeCurrency("clp")).toBe("CLP");
  });

  it("validates and returns USD for 'usd'", () => {
    expect(normalizeCurrency("usd")).toBe("USD");
  });

  it("validates and returns EUR for 'eur'", () => {
    expect(normalizeCurrency("eur")).toBe("EUR");
  });
});
