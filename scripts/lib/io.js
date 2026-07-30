import fs from "fs";
import path from "path";

export const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

export const readJsonFiles = (dir) => {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const items = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, file), "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) items.push(...parsed);
      else items.push(parsed);
    } catch (err) {
      console.warn(`No se pudo leer JSON: ${file}`, err.message);
    }
  }
  return items;
};

export const readCsvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, "utf8");

  const parseCsv = (input) => {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < input.length; i++) {
      const ch = input[i];

      if (inQuotes) {
        if (ch === "\"") {
          if (input[i + 1] === "\"") {
            field += "\"";
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
        continue;
      }

      if (ch === "\"") {
        inQuotes = true;
        continue;
      }
      if (ch === ",") {
        row.push(field);
        field = "";
        continue;
      }
      if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        continue;
      }
      if (ch === "\r") continue;

      field += ch;
    }

    row.push(field);
    const hasAny = row.some((c) => String(c || "").trim() !== "");
    if (hasAny) rows.push(row);
    return rows;
  };

  const rows = parseCsv(text);
  if (!rows.length) return [];

  const header = (rows.shift() || []).map((h) => String(h || "").trim());
  if (!header.length) return [];

  return rows
    .filter((r) => Array.isArray(r) && r.some((c) => String(c || "").trim() !== ""))
    .map((cells) => {
      const obj = {};
      header.forEach((h, idx) => (obj[h] = String(cells[idx] ?? "").trim()));
      return obj;
    });
};
