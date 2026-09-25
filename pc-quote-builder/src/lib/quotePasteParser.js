import { findColumnIndex, parseCsv, unprotectFormulaField } from "./csvParser";
import { normalizeRow } from "./quoteModel";

export const QUOTE_PASTE_LIMITS = Object.freeze({
  MAX_INPUT_LENGTH: 200000,
  MAX_ROWS: 200,
  MAX_CELL_LENGTH: 500,
});

export const PASTE_HEADER_CANDIDATES = Object.freeze({
  category: ["componente", "categoria", "tipo"],
  product: ["producto", "item", "modelo"],
  itemId: ["itemid", "id_producto", "catalog_id", "id"],
  store: ["tienda", "store"],
  offerPrice: ["preciooferta", "oferta", "precio"],
  regularPrice: ["precionormal", "normal"],
  notes: ["notas", "comentarios", "notes"],
});

const trimCell = (cell) => unprotectFormulaField((cell || "").trim());

function countUnquoted(line, delimiter) {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
    } else if (!inQuotes && ch === delimiter) {
      count += 1;
    }
  }
  return count;
}

function detectDelimiter(firstLine) {
  const candidates = ["\t", ";", ","];
  let best = ",";
  let bestCount = 0;
  for (const candidate of candidates) {
    const count = countUnquoted(firstLine, candidate);
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

function looksLikeHeaders(cells) {
  return (
    findColumnIndex(cells, PASTE_HEADER_CANDIDATES.product) !== -1 ||
    findColumnIndex(cells, PASTE_HEADER_CANDIDATES.category) !== -1
  );
}

function buildRowFromColumns(cells, columns, lineNo) {
  const source = {
    category: columns.category !== -1 ? trimCell(cells[columns.category]) : "",
    product: columns.product !== -1 ? trimCell(cells[columns.product]) : "",
    itemId: columns.itemId !== -1 ? trimCell(cells[columns.itemId]) : "",
    store: columns.store !== -1 ? trimCell(cells[columns.store]) : "",
    offerPrice: columns.offerPrice !== -1 ? trimCell(cells[columns.offerPrice]) : "",
    regularPrice: columns.regularPrice !== -1 ? trimCell(cells[columns.regularPrice]) : "",
    notes: columns.notes !== -1 ? trimCell(cells[columns.notes]) : "",
  };
  return { ...normalizeRow(source), lineNo };
}

function buildHeaderlessRow(cells, lineNo) {
  return { ...normalizeRow({ product: trimCell(cells[0]) }), lineNo };
}

function assertCellLengths(cells) {
  for (const cell of cells) {
    if (cell.length > QUOTE_PASTE_LIMITS.MAX_CELL_LENGTH) {
      throw new Error(
        `Una celda supera el largo máximo (${QUOTE_PASTE_LIMITS.MAX_CELL_LENGTH} caracteres).`
      );
    }
  }
}

export function parseQuotePaste(text) {
  if (typeof text !== "string") {
    throw new Error("El texto pegado no es válido.");
  }
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("El texto pegado está vacío.");
  }
  if (trimmed.length > QUOTE_PASTE_LIMITS.MAX_INPUT_LENGTH) {
    throw new Error(
      `El texto pegado es demasiado largo (máx. ${QUOTE_PASTE_LIMITS.MAX_INPUT_LENGTH} caracteres).`
    );
  }

  const firstLine = trimmed.split(/\r?\n/, 1)[0] || "";
  const delimiter = detectDelimiter(firstLine);
  const firstLineCells = parseCsv(firstLine, { delimiter, hasHeaders: true }).headers;
  const hasHeaders = looksLikeHeaders(firstLineCells);

  const { headers, rows, lineNumbers } = parseCsv(trimmed, { delimiter, hasHeaders });

  if (rows.length > QUOTE_PASTE_LIMITS.MAX_ROWS) {
    throw new Error(`El texto pegado tiene demasiadas líneas (máx. ${QUOTE_PASTE_LIMITS.MAX_ROWS}).`);
  }

  const columns = {
    category: -1,
    product: -1,
    itemId: -1,
    store: -1,
    offerPrice: -1,
    regularPrice: -1,
    notes: -1,
  };
  if (hasHeaders) {
    for (const key of Object.keys(columns)) {
      columns[key] = findColumnIndex(headers, PASTE_HEADER_CANDIDATES[key]);
    }
  }

  const result = [];
  rows.forEach((cells, index) => {
    assertCellLengths(cells);
    if (cells.every((cell) => !trimCell(cell))) return;
    if (trimCell(cells[0]).toLowerCase().startsWith("total")) return;
    result.push(
      hasHeaders
        ? buildRowFromColumns(cells, columns, lineNumbers[index])
        : buildHeaderlessRow(cells, lineNumbers[index])
    );
  });

  return { rows: result, headers: hasHeaders ? headers : [], delimiter, hasHeaders };
}
