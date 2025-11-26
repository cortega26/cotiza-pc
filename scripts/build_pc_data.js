#!/usr/bin/env node
/**
 * build_pc_data.js
 * Pipeline offline para unificar datos de componentes de PC desde fuentes locales.
 * - Lee datos crudos en data/raw/ (buildcores-open-db, dbgpu, pc-part-dataset).
 * - Normaliza y hace matching por normalized_key.
 * - Aplica precedencia de atributos y marca conflictos.
 * - Escribe JSON minimizados en data/processed/*.min.json.
 *
 * No realiza scraping ni llamadas de red. Asume que los archivos ya existen localmente.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const RAW_DIR = path.join(ROOT, "data", "raw");
const PROCESSED_DIR = path.join(ROOT, "data", "processed");

const SOURCE_TAGS = {
  BUILDCORES: "buildcores",
  DBGPU: "dbgpu",
  PCPART: "pcpart",
};

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

ensureDir(PROCESSED_DIR);

// ---------- Utilidades de normalización ----------
const deburr = (str = "") =>
  str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const normalizeKey = (brand = "", model = "") => {
  const key = `${brand} ${model}`.trim().toLowerCase();
  return deburr(key)
    .replace(/[^a-z0-9+]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const slug = (str = "") =>
  deburr(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

const safeNumber = (val) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
};

const computeTierCpu = (cpu) => {
  const cores = safeNumber(cpu.cores) || 0;
  const boost = safeNumber(cpu.boost_clock_ghz) || 0;
  if (cores >= 12 && boost >= 4.5) return 4;
  if (cores >= 8 && boost >= 4.2) return 3;
  if (cores >= 6) return 2;
  return 1;
};

const computeTierGpu = (gpu) => {
  const tdp = safeNumber(gpu.tdp_w) || 0;
  const vram = safeNumber(gpu.vram_gb) || 0;
  if (tdp >= 250 || vram >= 12) return 4;
  if (tdp >= 180 || vram >= 10) return 3;
  if (tdp >= 120 || vram >= 8) return 2;
  return 1;
};
const readJsonFiles = (dir) => {
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

const readCsvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const header = lines.shift().split(",").map((h) => h.trim());
  return lines.map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    const obj = {};
    header.forEach((h, idx) => (obj[h] = cells[idx]));
    return obj;
  });
};

// ---------- Loaders por fuente ----------
const loadBuildCores = () => {
  const base = path.join(RAW_DIR, "buildcores-open-db", "open-db");
  const cpuDir = path.join(base, "CPU");
  const ramDir = path.join(base, "RAM");
  const cpus = readJsonFiles(cpuDir).map((item) => ({
    source: SOURCE_TAGS.BUILDCORES,
    category: "cpu",
    id: item.id || item.slug || slug(item.name || item.model || ""),
    brand: item.brand || item.manufacturer || "",
    model: item.model || item.name || "",
    socket: item.socket || item.socket_name || "",
    tdp_w: safeNumber(item.tdp || item.tdp_w),
    cores: safeNumber(item.cores),
    threads: safeNumber(item.threads),
    base_clock_ghz: safeNumber(item.base_clock_ghz || item.base_clock),
    boost_clock_ghz: safeNumber(item.boost_clock_ghz || item.boost_clock),
    memory_support: item.memory_support || {
      types: item.memory_type ? [item.memory_type] : [],
      max_speed_mts: safeNumber(item.memory_speed),
    },
    normalized_key: normalizeKey(item.brand || "", item.model || item.name || ""),
  }));
  const ram = readJsonFiles(ramDir).map((item) => ({
    source: SOURCE_TAGS.BUILDCORES,
    category: "ram",
    id: item.id || slug(item.name || item.model || ""),
    brand: item.brand || item.manufacturer || "",
    model: item.model || item.name || "",
    type: (item.type || item.memory_type || "").toUpperCase(),
    speed_mts: safeNumber(item.speed_mts || item.speed),
    capacity_gb_total: safeNumber(item.capacity_gb || item.capacity),
    modules: safeNumber(item.modules),
    normalized_key: normalizeKey(item.brand || "", item.model || item.name || ""),
  }));
  return { cpus, ram };
};

const loadDbGpu = () => {
  const dir = path.join(RAW_DIR, "dbgpu");
  const json = readJsonFiles(dir);
  const csvFiles = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith(".csv"))
    : [];
  for (const csv of csvFiles) {
    json.push(...readCsvFile(path.join(dir, csv)));
  }
  const gpus = json.map((item) => ({
    source: SOURCE_TAGS.DBGPU,
    category: "gpu",
    id: item.id || slug(item.name || item.model || item.gpu_name || ""),
    brand: item.brand || item.manufacturer || "",
    model: item.model || item.name || item.gpu_name || "",
    chipset: item.chipset || item.gpu_name || "",
    vram_gb: safeNumber(item.vram_gb || item.vram || item.memory_size_gb),
    vram_type: item.vram_type || item.memory_type || "",
    tdp_w: safeNumber(item.tdp_w || item.tdp || item.thermal_design_power_w),
    suggested_psu_w: safeNumber(item.suggested_psu_w),
    board_length_mm: safeNumber(item.board_length_mm || item.length_mm),
    board_slot_width: safeNumber(item.board_slot_width),
    power_connectors: item.power_connectors || item.power || "",
    architecture: item.architecture || "",
    normalized_key: normalizeKey(item.brand || "", item.chipset || item.model || item.gpu_name || ""),
  }));
  return { gpus };
};

const loadPcPart = () => {
  const base = path.join(RAW_DIR, "pc-part-dataset", "data", "json");
  const read = (file) => {
    const full = path.join(base, file);
    if (!fs.existsSync(full)) return [];
    try {
      const raw = fs.readFileSync(full, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn("No se pudo leer", file, err.message);
      return [];
    }
  };
  const extractBrandModel = (name = "") => {
    const parts = name.trim().split(/\s+/);
    const brand = parts[0] || "";
    const model = parts.slice(1).join(" ") || name;
    return { brand, model };
  };

  const cpus = read("cpu.json").map((item) => {
    const { brand, model } = extractBrandModel(item.name || "");
    return {
      source: SOURCE_TAGS.PCPART,
      category: "cpu",
      id: slug(item.name || ""),
      brand,
      model,
      socket: item.socket || item.socket_type || "",
      tdp_w: safeNumber(item.tdp),
      cores: safeNumber(item.core_count),
      threads: safeNumber(item.core_count ? item.core_count * 2 : null),
      base_clock_ghz: safeNumber(item.core_clock),
      boost_clock_ghz: safeNumber(item.boost_clock),
      memory_type: (item.memory_type || "").toUpperCase(),
      normalized_key: normalizeKey(brand, model),
    };
  });

  const gpus = read("video-card.json").map((item) => {
    const { brand, model } = extractBrandModel(item.name || "");
    return {
      source: SOURCE_TAGS.PCPART,
      category: "gpu",
      id: slug(item.name || ""),
      brand,
      model,
      chipset: item.chipset || model,
      vram_gb: safeNumber(item.memory || item.memory_size_gb),
      vram_type: item.memory_type || "",
      tdp_w: safeNumber(item.tdp),
      suggested_psu_w: safeNumber(item.psu || item.suggested_psu_w),
      board_length_mm: safeNumber(item.length),
      board_slot_width: safeNumber(item.slot_width),
      power_connectors: item.power_connectors || "",
      normalized_key: normalizeKey(brand, model),
    };
  });

  const mobos = read("motherboard.json").map((item) => {
    const { brand, model } = extractBrandModel(item.name || "");
    return {
      source: SOURCE_TAGS.PCPART,
      category: "motherboard",
      id: slug(item.name || ""),
      brand,
      model,
      socket: item.socket || "",
      chipset: item.chipset || "",
      form_factor: item.form_factor || item.type || "",
      memory_type: (item.memory_type || "").toUpperCase(),
      memory_slots: safeNumber(item.memory_slots),
      max_memory_gb: safeNumber(item.max_memory),
      normalized_key: normalizeKey(brand, model),
    };
  });

  const psus = read("power-supply.json").map((item) => {
    const { brand, model } = extractBrandModel(item.name || "");
    return {
      source: SOURCE_TAGS.PCPART,
      category: "psu",
      id: slug(item.name || ""),
      brand,
      model,
      wattage_w: safeNumber(item.wattage),
      form_factor: item.type || "ATX",
      efficiency_rating: item.efficiency || "",
      pcie_power_connectors: {},
      normalized_key: normalizeKey(brand, model),
    };
  });

  const cases = read("case.json").map((item) => {
    const { brand, model } = extractBrandModel(item.name || "");
    const formFactors = [];
    if (item.type) formFactors.push(item.type.replace(/Tower/i, "").trim() || item.type);
    return {
      source: SOURCE_TAGS.PCPART,
      category: "case",
      id: slug(item.name || ""),
      brand,
      model,
      supported_mobo_form_factors: formFactors,
      max_gpu_length_mm: safeNumber(item.max_gpu_length_mm || item.gpu_length || item.gpu_max_length),
      max_cpu_cooler_height_mm: safeNumber(item.max_cpu_cooler_height_mm || item.cpu_cooler || item.cpu_cooler_height),
      psu_form_factor: item.psu_form_factor || "ATX",
      normalized_key: normalizeKey(brand, model),
    };
  });

  const coolers = read("cpu-cooler.json").map((item) => {
    const { brand, model } = extractBrandModel(item.name || "");
    return {
      source: SOURCE_TAGS.PCPART,
      category: "cooler",
      id: slug(item.name || ""),
      brand,
      model,
      type: "air", // dataset es principalmente aire; líquido no se distingue aquí
      fan_rpm: safeNumber(item.rpm),
      noise_level_db: safeNumber(item.noise_level),
      size_mm: safeNumber(item.size),
      normalized_key: normalizeKey(brand, model),
    };
  });

  const fans = read("case-fan.json").map((item) => {
    const { brand, model } = extractBrandModel(item.name || "");
    const airflow = Array.isArray(item.airflow) ? safeNumber(item.airflow[item.airflow.length - 1]) : safeNumber(item.airflow);
    const noise = Array.isArray(item.noise_level) ? safeNumber(item.noise_level[item.noise_level.length - 1]) : safeNumber(item.noise_level);
    return {
      source: SOURCE_TAGS.PCPART,
      category: "fan",
      id: slug(item.name || ""),
      brand,
      model,
      size_mm: safeNumber(item.size),
      rpm: Array.isArray(item.rpm) ? safeNumber(item.rpm[item.rpm.length - 1]) : safeNumber(item.rpm),
      airflow_cfm: airflow,
      noise_level_db: noise,
      pwm: Boolean(item.pwm),
      normalized_key: normalizeKey(brand, model),
    };
  });

  const ram = read("memory.json").map((item) => {
    const { brand, model } = extractBrandModel(item.name || "");
    const type = Array.isArray(item.speed) && item.speed.length === 2 ? `DDR${String(item.speed[0])}` : "";
    const speed_mts = Array.isArray(item.speed) && item.speed.length === 2 ? safeNumber(item.speed[1]) : safeNumber(item.speed);
    const modules = Array.isArray(item.modules) ? safeNumber(item.modules[0]) : safeNumber(item.modules);
    const capacity_each = Array.isArray(item.modules) ? safeNumber(item.modules[1]) : null;
    const capacity_gb_total = modules && capacity_each ? modules * capacity_each : safeNumber(item.capacity_gb_total || item.capacity_gb);
    return {
      source: SOURCE_TAGS.PCPART,
      category: "ram",
      id: slug(item.name || ""),
      brand,
      model,
      type: type || (item.type || item.memory_type || "").toUpperCase(),
      capacity_gb_total,
      modules,
      speed_mts,
      cas_latency: safeNumber(item.cas_latency || item.first_word_latency || item.cl),
      normalized_key: normalizeKey(brand, model),
    };
  });
  return { cpus, gpus, mobos, psus, cases, ram, coolers, fans };
};

// ---------- Merge helpers ----------
const mergeCpu = (records) => {
  if (!records.length) return null;
  const sources = records.map((r) => r.source);
  const pick = (fn) => {
    const buildcores = records.find((r) => r.source === SOURCE_TAGS.BUILDCORES);
    const pcpart = records.find((r) => r.source === SOURCE_TAGS.PCPART);
    return fn({ buildcores, pcpart });
  };
  const b = pick(({ buildcores, pcpart }) => buildcores || pcpart || records[0]);
  const canonicalId = `cpu_${slug(`${b.brand} ${b.model}`)}`;
  const tdpValues = records.map((r) => r.tdp_w).filter((v) => v != null);
  const conflict_flags = [];
  if (tdpValues.length > 1) {
    const max = Math.max(...tdpValues);
    const min = Math.min(...tdpValues);
    if (Math.abs(max - min) > 5) conflict_flags.push("cpu_tdp_conflict");
  }
  return {
    id: canonicalId,
    name: `${b.brand} ${b.model}`.trim(),
    brand: b.brand,
    model: b.model,
    category: "cpu",
    socket: pick(({ buildcores, pcpart }) => buildcores?.socket || pcpart?.socket || ""),
    tdp_w: pick(({ buildcores, pcpart }) => buildcores?.tdp_w ?? pcpart?.tdp_w ?? null),
    cores: pick(({ buildcores, pcpart }) => buildcores?.cores ?? pcpart?.cores ?? null),
    threads: pick(({ buildcores, pcpart }) => buildcores?.threads ?? pcpart?.threads ?? null),
    base_clock_ghz: pick(({ buildcores, pcpart }) => buildcores?.base_clock_ghz ?? pcpart?.base_clock_ghz ?? null),
    boost_clock_ghz: pick(({ buildcores, pcpart }) => buildcores?.boost_clock_ghz ?? pcpart?.boost_clock_ghz ?? null),
    memory_support: pick(({ buildcores, pcpart }) => buildcores?.memory_support || { types: pcpart?.memory_type ? [pcpart.memory_type] : [] }),
    sources: {
      buildcores_id: records.find((r) => r.source === SOURCE_TAGS.BUILDCORES)?.id || null,
      pcpart_id: records.find((r) => r.source === SOURCE_TAGS.PCPART)?.id || null,
    },
    meta: {
      created_from: sources,
      conflict_flags,
      quality_score: sources.length > 1 ? 0.9 : 0.8,
    },
    normalized_key: b.normalized_key,
  };
};

const mergeGpu = (records) => {
  if (!records.length) return null;
  const sources = records.map((r) => r.source);
  const pick = (fn) => {
    const dbgpu = records.find((r) => r.source === SOURCE_TAGS.DBGPU);
    const pcpart = records.find((r) => r.source === SOURCE_TAGS.PCPART);
    return fn({ dbgpu, pcpart });
  };
  const base = pick(({ dbgpu, pcpart }) => dbgpu || pcpart || records[0]);
  const canonicalId = `gpu_${slug(base.model || base.chipset || base.normalized_key)}`;
  const tdpValues = records.map((r) => r.tdp_w).filter((v) => v != null);
  const conflict_flags = [];
  if (tdpValues.length > 1) {
    const max = Math.max(...tdpValues);
    const min = Math.min(...tdpValues);
    if (Math.abs(max - min) > 5) conflict_flags.push("gpu_tdp_conflict");
  }
  return {
    id: canonicalId,
    name: `${base.brand} ${base.model || base.chipset}`.trim(),
    brand: base.brand,
    model: base.model || base.chipset,
    category: "gpu",
    chipset: pick(({ dbgpu, pcpart }) => dbgpu?.chipset || pcpart?.chipset || base.model),
    vram_gb: pick(({ dbgpu, pcpart }) => dbgpu?.vram_gb ?? pcpart?.vram_gb ?? null),
    vram_type: pick(({ dbgpu, pcpart }) => dbgpu?.vram_type || pcpart?.vram_type || ""),
    tdp_w: pick(({ dbgpu, pcpart }) => dbgpu?.tdp_w ?? pcpart?.tdp_w ?? null),
    suggested_psu_w: pick(({ dbgpu, pcpart }) => dbgpu?.suggested_psu_w ?? pcpart?.suggested_psu_w ?? null),
    recommended_psu_w: (() => {
      const tdp = pick(({ dbgpu, pcpart }) => dbgpu?.tdp_w ?? pcpart?.tdp_w ?? 0) || 0;
      const suggested = pick(({ dbgpu, pcpart }) => dbgpu?.suggested_psu_w ?? pcpart?.suggested_psu_w ?? 0) || 0;
      const calc = Math.ceil((tdp + 75) * 1.3 + 50);
      return Math.max(suggested, calc);
    })(),
    board_length_mm: pick(({ dbgpu, pcpart }) => dbgpu?.board_length_mm ?? pcpart?.board_length_mm ?? null),
    board_slot_width: pick(({ dbgpu, pcpart }) => dbgpu?.board_slot_width ?? pcpart?.board_slot_width ?? null),
    power_connectors: pick(({ dbgpu, pcpart }) => dbgpu?.power_connectors || pcpart?.power_connectors || ""),
    architecture: pick(({ dbgpu }) => dbgpu?.architecture || ""),
    sources: {
      dbgpu_id: records.find((r) => r.source === SOURCE_TAGS.DBGPU)?.id || null,
      pcpart_id: records.find((r) => r.source === SOURCE_TAGS.PCPART)?.id || null,
    },
    meta: { created_from: sources, conflict_flags, quality_score: sources.length > 1 ? 0.9 : 0.8 },
    normalized_key: base.normalized_key,
  };
};

const mergeMobo = (records) => {
  if (!records.length) return null;
  const b = records[0];
  const canonicalId = `mobo_${slug(`${b.brand} ${b.model}`)}`;
  return {
    id: canonicalId,
    name: `${b.brand} ${b.model}`.trim(),
    brand: b.brand,
    model: b.model,
    category: "motherboard",
    socket: b.socket,
    chipset: b.chipset || "",
    form_factor: b.form_factor || "",
    memory_type: b.memory_type || "",
    memory_slots: b.memory_slots || null,
    max_memory_gb: b.max_memory_gb || null,
    m2_slots: b.m2_slots || null,
    sata_ports: b.sata_ports || null,
    sources: { pcpart_id: b.id },
    meta: { created_from: [SOURCE_TAGS.PCPART], conflict_flags: [], quality_score: 0.8 },
    normalized_key: b.normalized_key,
  };
};

const mergePsu = (records) => {
  if (!records.length) return null;
  const b = records[0];
  const canonicalId = `psu_${slug(`${b.brand} ${b.model}`)}`;
  return {
    id: canonicalId,
    name: `${b.brand} ${b.model}`.trim(),
    brand: b.brand,
    model: b.model,
    category: "psu",
    wattage_w: b.wattage_w || null,
    form_factor: b.form_factor || "ATX",
    efficiency_rating: b.efficiency_rating || "",
    pcie_power_connectors: b.pcie_power_connectors || {},
    sources: { pcpart_id: b.id },
    meta: { created_from: [SOURCE_TAGS.PCPART], conflict_flags: [], quality_score: 0.8 },
    normalized_key: b.normalized_key,
  };
};

const mergeCase = (records) => {
  if (!records.length) return null;
  const b = records[0];
  const canonicalId = `case_${slug(`${b.brand} ${b.model}`)}`;
  return {
    id: canonicalId,
    name: `${b.brand} ${b.model}`.trim(),
    brand: b.brand,
    model: b.model,
    category: "case",
    supported_mobo_form_factors: b.supported_mobo_form_factors || [],
    max_gpu_length_mm: b.max_gpu_length_mm || null,
    max_cpu_cooler_height_mm: b.max_cpu_cooler_height_mm || null,
    psu_form_factor: b.psu_form_factor || "ATX",
    sources: { pcpart_id: b.id },
    meta: { created_from: [SOURCE_TAGS.PCPART], conflict_flags: [], quality_score: 0.8 },
    normalized_key: b.normalized_key,
  };
};

const mergeRam = (records) => {
  if (!records.length) return null;
  const b = records[0];
  const canonicalId = `ram_${slug(`${b.brand} ${b.model}`)}`;
  return {
    id: canonicalId,
    name: `${b.brand} ${b.model}`.trim(),
    brand: b.brand,
    model: b.model,
    category: "ram",
    type: b.type || "",
    capacity_gb_total: b.capacity_gb_total || null,
    modules: b.modules || null,
    speed_mts: b.speed_mts || null,
    cas_latency: b.cas_latency || null,
    sources: { source_id: b.id, source: b.source },
    meta: { created_from: [b.source], conflict_flags: [], quality_score: 0.8 },
    normalized_key: b.normalized_key,
  };
};

const mergeCooler = (records) => {
  if (!records.length) return null;
  const b = records[0];
  const canonicalId = `cooler_${slug(`${b.brand} ${b.model}`)}`;
  return {
    id: canonicalId,
    name: `${b.brand} ${b.model}`.trim(),
    brand: b.brand,
    model: b.model,
    category: "cooler",
    type: b.type || "air",
    fan_rpm: b.fan_rpm || null,
    noise_level_db: b.noise_level_db || null,
    size_mm: b.size_mm || null,
    sources: { pcpart_id: b.id },
    meta: { created_from: [b.source], conflict_flags: [], quality_score: 0.7 },
    normalized_key: b.normalized_key,
  };
};

const mergeFan = (records) => {
  if (!records.length) return null;
  const b = records[0];
  const canonicalId = `fan_${slug(`${b.brand} ${b.model}`)}`;
  return {
    id: canonicalId,
    name: `${b.brand} ${b.model}`.trim(),
    brand: b.brand,
    model: b.model,
    category: "fan",
    size_mm: b.size_mm || null,
    rpm: b.rpm || null,
    airflow_cfm: b.airflow_cfm || null,
    noise_level_db: b.noise_level_db || null,
    pwm: Boolean(b.pwm),
    sources: { pcpart_id: b.id },
    meta: { created_from: [b.source], conflict_flags: [], quality_score: 0.7 },
    normalized_key: b.normalized_key,
  };
};

// ---------- Pipeline principal ----------
const byNormalizedKey = (list) =>
  list.reduce((acc, item) => {
    if (!item.normalized_key) return acc;
    acc[item.normalized_key] = acc[item.normalized_key] || [];
    acc[item.normalized_key].push(item);
    return acc;
  }, {});

function build() {
  const { cpus: bcCpus, ram: bcRam } = loadBuildCores();
  const { gpus: dbGpus } = loadDbGpu();
  const { cpus: pcCpus, gpus: pcGpus, mobos, psus, cases, ram: pcRam, coolers, fans } = loadPcPart();

  const mergedCpus = Object.values(byNormalizedKey([...bcCpus, ...pcCpus])).map(mergeCpu).filter(Boolean);
  const mergedGpus = Object.values(byNormalizedKey([...dbGpus, ...pcGpus])).map(mergeGpu).filter(Boolean);
  const mergedMobos = Object.values(byNormalizedKey([...mobos])).map(mergeMobo).filter(Boolean);
  const mergedPsus = Object.values(byNormalizedKey([...psus])).map(mergePsu).filter(Boolean);
  const mergedCases = Object.values(byNormalizedKey([...cases])).map(mergeCase).filter(Boolean);
  const mergedRam = Object.values(byNormalizedKey([...bcRam, ...pcRam])).map(mergeRam).filter(Boolean);
  const mergedCoolers = Object.values(byNormalizedKey([...coolers])).map(mergeCooler).filter(Boolean);
  const mergedFans = Object.values(byNormalizedKey([...fans])).map(mergeFan).filter(Boolean);

  const cpuTiers = mergedCpus.map((c) => ({ id: c.id, tier: computeTierCpu(c) }));
  const gpuTiers = mergedGpus.map((g) => ({ id: g.id, tier: computeTierGpu(g) }));

  const range = (list, key) => {
    const nums = list.map((i) => safeNumber(i[key])).filter((v) => v != null);
    if (!nums.length) return null;
    return { min: Math.min(...nums), max: Math.max(...nums) };
  };

  const compatibilityMeta = {
    generatedAt: new Date().toISOString(),
    counts: {
      cpus: mergedCpus.length,
      gpus: mergedGpus.length,
      motherboards: mergedMobos.length,
      psus: mergedPsus.length,
      cases: mergedCases.length,
      ram: mergedRam.length,
      coolers: mergedCoolers.length,
      fans: mergedFans.length,
    },
    ranges: {
      cpu_tdp_w: range(mergedCpus, "tdp_w"),
      gpu_tdp_w: range(mergedGpus, "tdp_w"),
      gpu_length_mm: range(mergedGpus, "board_length_mm"),
      ram_speed_mts: range(mergedRam, "speed_mts"),
      psu_wattage_w: range(mergedPsus, "wattage_w"),
      cooler_size_mm: range(mergedCoolers, "size_mm"),
      fan_size_mm: range(mergedFans, "size_mm"),
    },
    sockets: Object.fromEntries(
      mergedMobos.reduce((acc, m) => {
        if (!m.socket) return acc;
        acc.set(m.socket, { mobos: (acc.get(m.socket)?.mobos || 0) + 1, cpus: 0 });
        return acc;
      }, new Map())
    ),
    form_factors: Object.fromEntries(
      mergedCases.reduce((acc, c) => {
        for (const ff of c.supported_mobo_form_factors || []) {
          acc.set(ff, { cases: (acc.get(ff)?.cases || 0) + 1, mobos: 0 });
        }
        return acc;
      }, new Map())
    ),
    tiers: {
      cpu: cpuTiers,
      gpu: gpuTiers,
    },
    notes: "Compatibilidad detallada se calcula en frontend (src/lib/compatibility.js); aquí se incluyen rangos y tiers.",
  };

  const outputs = [
    { filename: "cpus.min.json", data: mergedCpus },
    { filename: "gpus.min.json", data: mergedGpus },
    { filename: "motherboards.min.json", data: mergedMobos },
    { filename: "psus.min.json", data: mergedPsus },
    { filename: "cases.min.json", data: mergedCases },
    { filename: "ram.min.json", data: mergedRam },
    { filename: "memory.min.json", data: mergedRam },
    { filename: "coolers.min.json", data: mergedCoolers },
    { filename: "fans.min.json", data: mergedFans },
    { filename: "compatibility.min.json", data: compatibilityMeta },
  ];

  for (const out of outputs) {
    const file = path.join(PROCESSED_DIR, out.filename);
    fs.writeFileSync(file, JSON.stringify(out.data, null, 2));
    const count = Array.isArray(out.data) ? out.data.length : 1;
    console.log(`Escrito ${file} (${count} items)`);
  }

  console.log("Resumen:");
  console.table({
    cpus: mergedCpus.length,
    gpus: mergedGpus.length,
    mobos: mergedMobos.length,
    psus: mergedPsus.length,
    cases: mergedCases.length,
    ram: mergedRam.length,
  });
}

build();
