const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function unprotectFormulaField(value) {
  if (!value || typeof value !== "string") return value;
  if (
    value.startsWith("'") &&
    value.length > 1 &&
    FORMULA_TRIGGER.test(value[1])
  ) {
    return value.slice(1);
  }
  return value;
}

export const escapeCsvField = (value) => {
  if (value == null) return "";
  let str = String(value);
  if (FORMULA_TRIGGER.test(str)) {
    str = "'" + str;
  }
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const parseCsv = (text, options = {}) => {
  const delimiter = options.delimiter ?? ",";
  const hasHeaders = options.hasHeaders ?? true;
  if (!text) return { headers: [], rows: [], lineNumbers: [] };

  const rows = [];
  const rowLines = [];
  let current = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;
  let line = 1;
  let currentRowLine = 1;
  let rowStarted = false;

  const startRowIfNeeded = () => {
    if (!rowStarted) {
      currentRowLine = line;
      rowStarted = true;
    }
  };
  const pushRow = () => {
    startRowIfNeeded();
    current.push(cell);
    rows.push(current);
    rowLines.push(currentRowLine);
    current = [];
    cell = "";
    rowStarted = false;
  };

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
        if (ch === '\n') line += 1;
        cell += ch;
        i += 1;
      }
    } else {
      if (ch === '"') {
        startRowIfNeeded();
        inQuotes = true;
        i += 1;
      } else if (ch === delimiter) {
        startRowIfNeeded();
        current.push(cell);
        cell = "";
        i += 1;
      } else if (ch === '\n') {
        pushRow();
        i += 1;
        line += 1;
      } else if (ch === '\r') {
        pushRow();
        if (i + 1 < text.length && text[i + 1] === '\n') {
          i += 2;
        } else {
          i += 1;
        }
        line += 1;
      } else {
        startRowIfNeeded();
        cell += ch;
        i += 1;
      }
    }
  }

  if (inQuotes || cell !== "" || current.length > 0) {
    pushRow();
  }

  if (rows.length === 0) return { headers: [], rows: [], lineNumbers: [] };

  const headers = hasHeaders ? rows[0] : [];
  const dataRows = [];
  const dataLineNumbers = [];
  for (let r = hasHeaders ? 1 : 0; r < rows.length; r += 1) {
    if (rows[r].length > 1 || rows[r][0] !== "") {
      dataRows.push(rows[r]);
      dataLineNumbers.push(rowLines[r]);
    }
  }
  return { headers, rows: dataRows, lineNumbers: dataLineNumbers };
};

export const normalizeHeader = (val) =>
  val
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

export const findColumnIndex = (headers, candidates) => {
  const normalized = headers.map(normalizeHeader);
  const normalizedCandidates = candidates.map(normalizeHeader);
  return normalized.findIndex((h) => normalizedCandidates.includes(h));
};

const trimCell = (cell) => unprotectFormulaField((cell || "").trim());

export const parseCsvToQuote = (text, { normalizeRow, normalizeQuote }) => {
  const { headers: rawHeaders, rows } = parseCsv(text);
  if (!rawHeaders || rawHeaders.length === 0) {
    throw new Error("El CSV está vacío.");
  }

  const idxCategory = findColumnIndex(rawHeaders, ["componente", "categoria"]);
  const idxProduct = findColumnIndex(rawHeaders, ["producto", "item", "modelo"]);
  const idxItemId = findColumnIndex(rawHeaders, ["itemid", "id_producto", "catalog_id"]);
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
        itemId: idxItemId !== -1 ? trimCell(cells[idxItemId]) : "",
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
