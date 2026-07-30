import fs from "fs";
import path from "path";
import { normalizeKey, safeNumber, slug } from "./normalize.js";
import { readCsvFile, readJsonFiles } from "./io.js";

export const SOURCE_TAGS = {
  BUILDCORES: "buildcores",
  DBGPU: "dbgpu",
  PCPART: "pcpart",
};

export function loadBuildCores(rawDir) {
  const base = path.join(rawDir, "buildcores-open-db", "open-db");
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
}

export function loadDbGpu(rawDir) {
  const dir = path.join(rawDir, "dbgpu");
  const json = readJsonFiles(dir);
  const csvFiles = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith(".csv"))
    : [];
  for (const csv of csvFiles) {
    json.push(...readCsvFile(path.join(dir, csv)));
  }
  const gpus = json
    .map((item) => ({
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
    }))
    .filter((g) => {
      const hasIdentity = Boolean((g.brand || "").trim() && (g.model || "").trim());
      const tdpOk = g.tdp_w == null || (g.tdp_w > 0 && g.tdp_w < 1200);
      const vramOk = g.vram_gb == null || (g.vram_gb > 0 && g.vram_gb < 128);
      return hasIdentity && tdpOk && vramOk;
    });
  return { gpus };
}

export function loadPcPart(rawDir) {
  const base = path.join(rawDir, "pc-part-dataset", "data", "json");
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
    return {
      source: SOURCE_TAGS.PCPART,
      category: "case",
      id: slug(item.name || ""),
      brand,
      model,
      chassis_type: item.type || "",
      supported_mobo_form_factors: item.type ? item.type.replace(/Tower/i, "").trim() : "",
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
      type: "air",
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
}
