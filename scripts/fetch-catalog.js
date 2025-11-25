#!/usr/bin/env node
/**
 * Fetch/normalize catalog data (specs only, sin precios) para el builder.
 * Pensado para correr en CI/cron (GitHub Actions). No se expone en el frontend.
 *
 * Flujo:
 *  - define proveedores de datos (CSV/HTML/APIs permitidas)
 *  - los normaliza a un esquema común
 *  - valida rangos y campos requeridos
 *  - escribe catalog/catalog.json + catalog/catalog.meta.json
 *
 * NOTA: No llames a sitios sin permiso. Ajusta SOURCES con endpoints permitidos.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ---- Configuración ----------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_DIR = path.resolve(__dirname, "..", "catalog");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "catalog.json");
const META_FILE = path.join(OUTPUT_DIR, "catalog.meta.json");
const SOURCES = {
  cpus: [
    // Ejemplo: feed privado/curado en repo (debes llenarlo tú)
    { type: "file", path: path.join(OUTPUT_DIR, "sources", "cpus.json") },
    // { type: "json", url: "https://tu-endpoint/cpus.json" },
  ],
  gpus: [
    { type: "file", path: path.join(OUTPUT_DIR, "sources", "gpus.json") },
    // { type: "json", url: "https://tu-endpoint/gpus.json" },
  ],
  psus: [{ type: "file", path: path.join(OUTPUT_DIR, "sources", "psus.json") }],
  cases: [{ type: "file", path: path.join(OUTPUT_DIR, "sources", "cases.json") }],
  ram: [{ type: "file", path: path.join(OUTPUT_DIR, "sources", "ram.json") }],
};

// ---- Esquema mínimo ---------------------------------------------------------------
const normalize = {
  cpu: (item) => ({
    id: item.id || item.sku || slug(item.model),
    name: item.name || item.model,
    socket: item.socket,
    memoryType: (item.memoryType || "").toUpperCase(),
    tdp: numberOrNull(item.tdp),
    notes: item.notes || "",
  }),
  gpu: (item) => ({
    id: item.id || item.sku || slug(item.model),
    name: item.name || item.model,
    length: numberOrNull(item.length) || null,
    tdp: numberOrNull(item.tdp) || null,
    psuMin: numberOrNull(item.psuMin) || null,
  }),
  psu: (item) => ({
    id: item.id || slug(item.model),
    name: item.name || item.model,
    wattage: numberOrNull(item.wattage),
    pcieCables: numberOrNull(item.pcieCables) || null,
    rating: item.rating || "",
  }),
  case: (item) => ({
    id: item.id || slug(item.model),
    name: item.name || item.model,
    formFactors: item.formFactors || [],
    maxGpuLength: numberOrNull(item.maxGpuLength),
    coolerHeight: numberOrNull(item.coolerHeight) || null,
  }),
  ram: (item) => ({
    id: item.id || slug(item.model),
    name: item.name || item.model,
    type: (item.type || "").toUpperCase(),
    speed: numberOrNull(item.speed) || null,
  }),
};

// ---- Utilidades -------------------------------------------------------------------
function slug(str = "") {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function numberOrNull(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "user-agent": "pcqb-catalog/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} al obtener ${url}`);
  return res.json();
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  if (!raw.trim()) return null;
  return JSON.parse(raw);
}

async function gather(kind) {
  const providers = SOURCES[kind] || [];
  const items = [];
  for (const provider of providers) {
    if (provider.type === "json") {
      const data = await fetchJson(provider.url);
      if (Array.isArray(data)) items.push(...data);
      else if (Array.isArray(data.items)) items.push(...data.items);
    }
    if (provider.type === "file") {
      const data = readJsonIfExists(provider.path);
      if (Array.isArray(data)) items.push(...data);
      else if (data && Array.isArray(data.items)) items.push(...data.items);
    }
    // Otros tipos (csv/html) se pueden añadir aquí.
    await delay(1500); // cortesía
  }
  return items;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function validateList(list, requiredFields) {
  return list.filter((item) => requiredFields.every((f) => item[f]));
}

async function main() {
  const started = Date.now();
  const [cpusRaw, gpusRaw, psusRaw, casesRaw, ramRaw] = await Promise.all([
    gather("cpus"),
    gather("gpus"),
    gather("psus"),
    gather("cases"),
    gather("ram"),
  ]);

  const catalog = {
    cpus: validateList(cpusRaw.map(normalize.cpu), ["id", "name", "socket"]),
    gpus: validateList(gpusRaw.map(normalize.gpu), ["id", "name"]),
    psus: validateList(psusRaw.map(normalize.psu), ["id", "name", "wattage"]),
    pcCases: validateList(casesRaw.map(normalize.case), ["id", "name"]),
    ramKits: validateList(ramRaw.map(normalize.ram), ["id", "name", "type"]),
  };

  const meta = {
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    counts: {
      cpus: catalog.cpus.length,
      gpus: catalog.gpus.length,
      psus: catalog.psus.length,
      pcCases: catalog.pcCases.length,
      ramKits: catalog.ramKits.length,
    },
    sources: SOURCES,
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(catalog, null, 2));
  fs.writeFileSync(META_FILE, JSON.stringify(meta, null, 2));
  console.log(`Catalogo generado en ${OUTPUT_FILE}`);
  console.log(meta);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
