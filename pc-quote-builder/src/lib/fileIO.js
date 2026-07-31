export const slugify = (text) =>
  (text || "cotizacion")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export const freshIds = (obj) => ({
  ...obj,
  id: undefined,
  rows: Array.isArray(obj.rows)
    ? obj.rows.map((r) => {
        const { id: _omit, ...rest } = r;
        return rest;
      })
    : obj.rows,
});

export const buildQuotesFromJson = (data, normalizeQuote) => {
  if (Array.isArray(data)) {
    return data.map((q, idx) => normalizeQuote(freshIds(q), q.name || `Importada ${idx + 1}`));
  }
  if (data && Array.isArray(data.quotes)) {
    return data.quotes.map((q, idx) => normalizeQuote(freshIds(q), q.name || `Importada ${idx + 1}`));
  }
  if (data && data.rows) {
    return [normalizeQuote(freshIds(data), data.name || "Importada JSON")];
  }
  throw new Error("Formato JSON no reconocido.");
};

export const exportCSV = (quote, totals, escapeCsvField) => {
  const t = totals || {};
  const header = ["Componente", "Producto", "itemId", "Tienda", "Precio oferta", "Precio normal", "Notas"];
  const lines = [
    header.map(escapeCsvField).join(","),
    ...quote.rows.map((row) =>
      [row.category, row.product, row.itemId, row.store, row.offerPrice, row.regularPrice, row.notes]
        .map(escapeCsvField)
        .join(",")
    ),
    "",
    `Total oferta,${t.totalOffer || 0}`,
    `Total normal,${t.totalRegular || 0}`,
    `Ahorro,${t.saving || 0}`,
  ];
  return lines.join("\n");
};

export const exportJSON = (quote, totals) => ({
  ...quote,
  totals: totals || {},
  generatedAt: new Date().toISOString(),
});

export const downloadFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
