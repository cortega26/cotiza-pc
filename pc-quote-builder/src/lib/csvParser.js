export const escapeCsvField = (value) => {
  if (value == null) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const parseCsv = (text) => {
  if (!text) return { headers: [], rows: [] };

  const rows = [];
  let current = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          cell += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        cell += ch;
        i += 1;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i += 1;
      } else if (ch === ',') {
        current.push(cell);
        cell = "";
        i += 1;
      } else if (ch === '\n') {
        current.push(cell);
        rows.push(current);
        current = [];
        cell = "";
        i += 1;
      } else if (ch === '\r') {
        current.push(cell);
        rows.push(current);
        current = [];
        cell = "";
        if (i + 1 < text.length && text[i + 1] === '\n') {
          i += 2;
        } else {
          i += 1;
        }
      } else {
        cell += ch;
        i += 1;
      }
    }
  }

  if (inQuotes || cell !== "" || current.length > 0) {
    current.push(cell);
    rows.push(current);
  }

  if (rows.length === 0) return { headers: [], rows: [] };

  return {
    headers: rows[0],
    rows: rows.slice(1).filter((r) => r.length > 1 || r[0] !== ""),
  };
};

const normalizeHeader = (val) =>
  val
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

const findColumnIndex = (headers, candidates) => {
  const normalized = headers.map(normalizeHeader);
  const normalizedCandidates = candidates.map(normalizeHeader);
  return normalized.findIndex((h) => normalizedCandidates.includes(h));
};

const trimCell = (cell) => (cell || "").trim();

export const parseCsvToQuote = (text, { normalizeRow, normalizeQuote }) => {
  const { headers: rawHeaders, rows } = parseCsv(text);
  if (!rawHeaders || rawHeaders.length === 0) {
    throw new Error("El CSV está vacío.");
  }

  const idxCategory = findColumnIndex(rawHeaders, ["componente", "categoria"]);
  const idxProduct = findColumnIndex(rawHeaders, ["producto", "item", "modelo"]);
  const idxStore = findColumnIndex(rawHeaders, ["tienda", "store"]);
  const idxOffer = findColumnIndex(rawHeaders, ["preciooferta", "oferta"]);
  const idxNormal = findColumnIndex(rawHeaders, ["precionormal", "normal"]);
  const idxNotes = findColumnIndex(rawHeaders, ["notas", "comentarios", "notes"]);

  if (idxCategory === -1 || idxProduct === -1) {
    throw new Error("El CSV debe incluir columnas de componente y producto.");
  }

  const result = [];
  for (const cells of rows) {
    const firstCell = trimCell(cells[0]).toLowerCase();
    if (firstCell.startsWith("total")) continue;

    result.push(
      normalizeRow({
        category: trimCell(cells[idxCategory]),
        product: trimCell(cells[idxProduct]),
        store: idxStore !== -1 ? trimCell(cells[idxStore]) : "",
        offerPrice: idxOffer !== -1 ? trimCell(cells[idxOffer]) : "",
        regularPrice: idxNormal !== -1 ? trimCell(cells[idxNormal]) : "",
        notes: idxNotes !== -1 ? trimCell(cells[idxNotes]) : "",
      })
    );
  }

  return normalizeQuote(
    {
      name: "Importada CSV",
      currency: "CLP",
      rows: result,
    },
    "Importada CSV"
  );
};

export const parsePriceCsv = (text) => {
  const { headers: rawHeaders, rows } = parseCsv(text);
  if (!rawHeaders || rawHeaders.length === 0) {
    throw new Error("El CSV está vacío.");
  }

  const headers = rawHeaders.map((h) => h.toLowerCase());

  const idxId = headers.findIndex((h) => h.includes("id"));
  const idxOffer = headers.findIndex((h) => h.includes("offer") || h.includes("oferta"));
  const idxNormal = headers.findIndex((h) => h.includes("regular") || h.includes("normal"));
  const idxStore = headers.findIndex((h) => h.includes("store") || h.includes("tienda"));

  if (idxId === -1) throw new Error("El CSV debe tener columna id");

  return rows.map((cells) => ({
    id: cells[idxId] ? cells[idxId].trim() : "",
    offerPrice: idxOffer !== -1 ? trimCell(cells[idxOffer]) : "",
    regularPrice: idxNormal !== -1 ? trimCell(cells[idxNormal]) : "",
    store: idxStore !== -1 ? trimCell(cells[idxStore]) : "",
  }));
};

export const parsePriceJson = (content) => {
  const data = JSON.parse(content);
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  throw new Error("Formato JSON no reconocido para precios");
};

export const buildPriceMap = (items) => {
  const map = new Map();
  for (const item of items) {
    if (item.id && !map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  return map;
};
