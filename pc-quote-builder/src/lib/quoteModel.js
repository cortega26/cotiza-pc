import { normalizeCurrency } from "./money";

export const createId = () =>
  globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const createEmptyRow = () => ({
  id: createId(),
  category: "",
  product: "",
  itemId: "",
  store: "",
  offerPrice: "",
  regularPrice: "",
  notes: "",
});

export const createEmptyQuote = (name = "Nueva cotización") => ({
  id: createId(),
  name,
  currency: "CLP",
  priceUpdatedAt: "",
  rows: [createEmptyRow()],
});

export const normalizeRow = (row) => ({
  id: row.id || createId(),
  category: row.category || "",
  product: row.product || "",
  itemId: row.itemId || "",
  store: row.store || "",
  offerPrice: row.offerPrice || "",
  regularPrice: row.regularPrice || "",
  notes: row.notes || "",
});

export const normalizeQuote = (quote, fallbackName = "Importada") => ({
  id: quote.id || createId(),
  name: quote.name || fallbackName,
  currency: normalizeCurrency(quote.currency),
  priceUpdatedAt: quote.priceUpdatedAt || "",
  rows:
    Array.isArray(quote.rows) && quote.rows.length
      ? quote.rows.map(normalizeRow)
      : [createEmptyRow()],
});

export const isRowEmpty = (row) =>
  !row.category && !row.product && !row.store && !row.offerPrice && !row.regularPrice && !row.notes;

export const formatDateTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
};

export const buildRowsFromSelection = (selection) => {
  const rows = [];
  if (selection.cpu) {
    rows.push({
      id: createId(),
      category: "Procesador",
      product: selection.cpu.name,
      itemId: selection.cpu.id,
      store: "",
      offerPrice: "",
      regularPrice: "",
      notes: `${selection.cpu.socket} · ${selection.cpu.memoryType} · ${selection.cpu.tdp}W`,
    });
  }
  if (selection.mobo) {
    rows.push({
      id: createId(),
      category: "Placa madre",
      product: selection.mobo.name,
      itemId: selection.mobo.id,
      store: "",
      offerPrice: "",
      regularPrice: "",
      notes: `${selection.mobo.socket} · ${selection.mobo.formFactor} · ${selection.mobo.memoryType}`,
    });
  }
  if (selection.ram) {
    rows.push({
      id: createId(),
      category: "RAM",
      product: selection.ram.name,
      itemId: selection.ram.id,
      store: "",
      offerPrice: "",
      regularPrice: "",
      notes: `${selection.ram.type} · ${selection.ram.speed}MHz`,
    });
  }
  if (selection.gpu) {
    rows.push({
      id: createId(),
      category: "Tarjeta de video",
      product: selection.gpu.name,
      itemId: selection.gpu.id,
      store: "",
      offerPrice: "",
      regularPrice: "",
      notes: `${selection.gpu.tdp}W · ${selection.gpu.length}mm`,
    });
  }
  if (selection.psu) {
    rows.push({
      id: createId(),
      category: "Fuente de poder",
      product: selection.psu.name,
      itemId: selection.psu.id,
      store: "",
      offerPrice: "",
      regularPrice: "",
      notes: `${selection.psu.wattage}W · ${selection.psu.pcieCables}x PCIe`,
    });
  }
  if (selection.pcCase) {
    rows.push({
      id: createId(),
      category: "Gabinete",
      product: selection.pcCase.name,
      itemId: selection.pcCase.id,
      store: "",
      offerPrice: "",
      regularPrice: "",
      notes: `GPU hasta ${selection.pcCase.maxGpuLength}mm · ${selection.pcCase.formFactors.join("/")}`,
    });
  }
  return rows;
};
