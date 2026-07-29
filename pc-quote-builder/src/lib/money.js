export function parsePrice(raw, currency = "CLP") {
  if (raw == null) return { status: "missing", value: null, raw };
  const str = String(raw).trim();
  if (str === "") return { status: "missing", value: null, raw };

  if (!/^-?\d+([.,]\d+)*$/.test(str)) return { status: "invalid", value: null, raw };

  const dots = (str.match(/\./g) || []).length;
  const commas = (str.match(/,/g) || []).length;
  const hasSeparator = dots > 0 || commas > 0;

  if (!hasSeparator) {
    const n = parseInt(str, 10);
    return { status: Number.isNaN(n) ? "invalid" : "valid", value: Number.isNaN(n) ? null : n, raw };
  }

  if (currency === "CLP") {
    const normalized = str.replace(/[.,]/g, "");
    const n = parseInt(normalized, 10);
    return { status: Number.isNaN(n) ? "invalid" : "valid", value: Number.isNaN(n) ? null : n, raw };
  }

  if (dots > 0 && commas > 0) {
    const lastDot = str.lastIndexOf(".");
    const lastComma = str.lastIndexOf(",");
    if (lastDot > lastComma) {
      const normalized = str.replace(/,/g, "");
      const n = parseFloat(normalized);
      return { status: Number.isNaN(n) ? "invalid" : "valid", value: Number.isNaN(n) ? null : n, raw };
    }
    const normalized = str.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(normalized);
    return { status: Number.isNaN(n) ? "invalid" : "valid", value: Number.isNaN(n) ? null : n, raw };
  }

  if (dots > 0) {
    if (dots >= 2) {
      const normalized = str.replace(/\./g, "");
      const n = parseInt(normalized, 10);
      return { status: Number.isNaN(n) ? "invalid" : "valid", value: Number.isNaN(n) ? null : n, raw };
    }
    const n = parseFloat(str);
    return { status: Number.isNaN(n) ? "invalid" : "valid", value: Number.isNaN(n) ? null : n, raw };
  }

  if (commas > 0) {
    if (commas >= 2) {
      const normalized = str.replace(/,/g, "");
      const n = parseInt(normalized, 10);
      return { status: Number.isNaN(n) ? "invalid" : "valid", value: Number.isNaN(n) ? null : n, raw };
    }
    const parts = str.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      const normalized = str.replace(",", ".");
      const n = parseFloat(normalized);
      return { status: Number.isNaN(n) ? "invalid" : "valid", value: Number.isNaN(n) ? null : n, raw };
    }
    const normalized = str.replace(/,/g, "");
    const n = parseInt(normalized, 10);
    return { status: Number.isNaN(n) ? "invalid" : "valid", value: Number.isNaN(n) ? null : n, raw };
  }

  return { status: "invalid", value: null, raw };
}

export function computeTotals(rows, currency = "CLP") {
  let totalOffer = 0;
  let totalRegular = 0;
  let rowsWithPrice = 0;
  let saving = 0;
  let savingRowCount = 0;

  for (const row of rows) {
    const offer = parsePrice(row.offerPrice, currency);
    const regular = parsePrice(row.regularPrice, currency);
    const hasOffer = offer.status === "valid";
    const hasRegular = regular.status === "valid";

    if (hasOffer) totalOffer += offer.value;
    if (hasRegular) totalRegular += regular.value;
    if (hasOffer || hasRegular) rowsWithPrice += 1;
    if (hasOffer && hasRegular) {
      saving += regular.value - offer.value;
      savingRowCount += 1;
    }
  }

  return { totalOffer, totalRegular, saving, rowsWithPrice, savingRowCount };
}

const VALID_CURRENCIES = new Set(Intl.supportedValuesOf("currency"));

export function normalizeCurrency(currency) {
  if (!currency || typeof currency !== "string") return "CLP";
  const upper = currency.toUpperCase().trim();
  if (!/^[A-Z]{3}$/.test(upper)) return "CLP";
  return VALID_CURRENCIES.has(upper) ? upper : "CLP";
}
