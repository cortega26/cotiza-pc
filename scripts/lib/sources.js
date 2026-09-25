import fs from "fs";
import path from "path";
import { normalizeKey, safeNumber, slug } from "./normalize.js";
import { readCsvFile, readJsonFiles } from "./io.js";

export const SOURCE_TAGS = {
  BUILDCORES: "buildcores",
  DBGPU: "dbgpu",
  PCPART: "pcpart",
};

const BUILD_CORES_CATEGORIES = Object.freeze({
  cpus: "CPU",
  ram: "RAM",
  mobos: "Motherboard",
  pcCases: "PCCase",
  psus: "PSU",
  gpus: "GPU",
});

/**
 * Canonical socket spelling so BuildCores ("LGA 1700") and pc-part ("LGA1700")
 * compare equal. Empty input stays empty; no socket is ever invented.
 */
export function canonicalSocket(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw
    .toUpperCase()
    .replace(/^LGA\s+/, "LGA")
    .replace(/\s+/g, " ");
}

const FORM_FACTOR_CANONICAL = Object.freeze({
  "E ATX": "E-ATX",
  ATX: "ATX",
  "MICRO ATX": "Micro ATX",
  MICROATX: "Micro ATX",
  "MINI ITX": "Mini ITX",
  MINIITX: "Mini ITX",
});

/**
 * Canonical motherboard/case form factor spelling so BuildCores ("Mini-ITX")
 * and pc-part ("Mini ITX") compare equal. Unknown values pass through.
 */
export function canonicalFormFactor(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const key = raw.toUpperCase().replace(/[-\s]+/g, " ");
  return FORM_FACTOR_CANONICAL[key] || raw;
}

export function stripBrandPrefix(name, brand) {
  const trimmed = String(name ?? "").trim();
  const brandText = String(brand ?? "").trim();
  if (!trimmed) return "";
  if (brandText && trimmed.toLowerCase().startsWith(`${brandText.toLowerCase()} `)) {
    return trimmed.slice(brandText.length).trim();
  }
  return trimmed;
}

/**
 * PSU connector map in the shape consumed by the Analyzer (`8_pin`,
 * `12vhpwr`). 12V-2x6 counts as 12VHPWR. Empty stays empty.
 */
export function mapPsuConnectors(item = {}) {
  const source = item.connectors || {};
  const direct = item.pcie_power_connectors || {};
  const eight =
    safeNumber(source.pcie_6_plus_2_pin) ??
    safeNumber(direct["8_pin"]) ??
    safeNumber(direct["6+2"]);
  const twelve =
    (safeNumber(source.pcie_12vhpwr) || 0) +
    (safeNumber(source.pcie_12V_2x6) || 0) +
    (safeNumber(direct["12vhpwr"]) || 0);
  const connectors = {};
  if (eight != null && eight > 0) connectors["8_pin"] = eight;
  if (twelve > 0) connectors["12vhpwr"] = twelve;
  return connectors;
}

/**
 * GPU connector requirement as the string contract consumed by
 * `checkPsuConnectors` ("2x8-pin", "1x12vhpwr"). BuildCores stores an object;
 * dbgpu/pc-part may store a string. Placeholder strings are discarded.
 */
export function mapGpuPowerConnectors(item = {}) {
  if (typeof item.power_connectors === "string") {
    return sanitizeConnectorString(item.power_connectors);
  }
  if (typeof item.power === "string") {
    return sanitizeConnectorString(item.power);
  }
  const connectors = item.power_connectors || {};
  const parts = [];
  const twelve =
    (safeNumber(connectors.pcie_12VHPWR) || 0) +
    (safeNumber(connectors.pcie_12vhpwr) || 0) +
    (safeNumber(connectors.pcie_12V_2x6) || 0);
  const eight = safeNumber(connectors.pcie_8_pin) || 0;
  const six = safeNumber(connectors.pcie_6_pin) || 0;
  if (twelve > 0) parts.push(`${twelve}x12vhpwr`);
  if (eight > 0) parts.push(`${eight}x8-pin`);
  if (six > 0) parts.push(`${six}x6-pin`);
  return parts.join(" ");
}

export function sanitizeConnectorString(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/^(none|null|n\/a|na|unknown|-)$/i.test(text)) return "";
  return text;
}

const buildCoresIdentity = (item) => {
  const metadata = item.metadata || {};
  const brand = String(item.brand || item.manufacturer || metadata.manufacturer || "").trim();
  const rawName = item.model || item.name || metadata.name || "";
  return { brand, model: stripBrandPrefix(rawName, brand) };
};

const buildCoresId = (item, brand, model) =>
  item.id || item.opendb_id || item.slug || slug(`${brand} ${model}`);

const hasIdentity = (record) =>
  Boolean((record.brand || "").trim() && (record.model || "").trim());

const memorySupportFor = (item) => {
  if (item.memory_support && typeof item.memory_support === "object") {
    return item.memory_support;
  }
  const memory = (item.specifications || {}).memory || {};
  const types = Array.isArray(memory.types)
    ? memory.types.map((type) => String(type).toUpperCase()).filter(Boolean)
    : item.memory_type
      ? [String(item.memory_type).toUpperCase()]
      : [];
  return {
    types,
    max_speed_mts: safeNumber(item.memory_speed ?? memory.max_speed_mts),
  };
};

const mapBuildCoresCpu = (item) => {
  const { brand, model } = buildCoresIdentity(item);
  const specs = item.specifications || {};
  const cores = item.cores && typeof item.cores === "object" ? item.cores : null;
  return {
    source: SOURCE_TAGS.BUILDCORES,
    category: "cpu",
    id: buildCoresId(item, brand, model),
    brand,
    model,
    socket: canonicalSocket(item.socket || item.socket_name),
    tdp_w: safeNumber(item.tdp_w ?? item.tdp ?? specs.tdp),
    cores: safeNumber(cores?.total ?? item.cores),
    threads: safeNumber(cores?.threads ?? item.threads),
    base_clock_ghz: safeNumber(item.base_clock_ghz ?? item.base_clock ?? item.clocks?.performance?.base),
    boost_clock_ghz: safeNumber(item.boost_clock_ghz ?? item.boost_clock ?? item.clocks?.performance?.boost),
    memory_support: memorySupportFor(item),
    normalized_key: normalizeKey(brand, model),
  };
};

const mapBuildCoresRam = (item) => {
  const { brand, model } = buildCoresIdentity(item);
  const modules = item.modules && typeof item.modules === "object" ? item.modules : null;
  const capacity = safeNumber(item.capacity_gb_total ?? item.capacity_gb ?? item.capacity);
  return {
    source: SOURCE_TAGS.BUILDCORES,
    category: "ram",
    id: buildCoresId(item, brand, model),
    brand,
    model,
    type: String(item.ram_type || item.memory_type || item.type || "").toUpperCase(),
    speed_mts: safeNumber(item.speed_mts ?? item.speed),
    capacity_gb_total: capacity,
    modules: modules ? safeNumber(modules.quantity) : safeNumber(item.modules),
    cas_latency: safeNumber(item.cas_latency),
    normalized_key: normalizeKey(brand, model),
  };
};

const mapBuildCoresMobo = (item) => {
  const { brand, model } = buildCoresIdentity(item);
  const memory = item.memory || {};
  const storage = item.storage_devices || {};
  const m2 = item.m2_slots;
  return {
    source: SOURCE_TAGS.BUILDCORES,
    category: "motherboard",
    id: buildCoresId(item, brand, model),
    brand,
    model,
    socket: canonicalSocket(item.socket),
    chipset: item.chipset || "",
    form_factor: canonicalFormFactor(item.form_factor),
    memory_type: String(item.memory_type || memory.ram_type || "").toUpperCase(),
    memory_slots: safeNumber(item.memory_slots ?? memory.slots),
    max_memory_gb: safeNumber(item.max_memory_gb ?? memory.max),
    m2_slots: Array.isArray(m2) ? m2.length : safeNumber(m2),
    sata_ports: safeNumber(item.sata_ports ?? storage.sata_6_gb_s),
    normalized_key: normalizeKey(brand, model),
  };
};

const mapBuildCoresPsu = (item) => {
  const { brand, model } = buildCoresIdentity(item);
  return {
    source: SOURCE_TAGS.BUILDCORES,
    category: "psu",
    id: buildCoresId(item, brand, model),
    brand,
    model,
    wattage_w: safeNumber(item.wattage_w ?? item.wattage),
    form_factor: item.form_factor || "ATX",
    efficiency_rating: item.efficiency_rating || item.efficiency || "",
    pcie_power_connectors: mapPsuConnectors(item),
    normalized_key: normalizeKey(brand, model),
  };
};

const mapBuildCoresCase = (item) => {
  const { brand, model } = buildCoresIdentity(item);
  const explicit = item.supported_mobo_form_factors || item.supported_motherboard_form_factors;
  const psuFormFactors = item.supported_power_supply_form_factors;
  return {
    source: SOURCE_TAGS.BUILDCORES,
    category: "case",
    id: buildCoresId(item, brand, model),
    brand,
    model,
    chassis_type: item.chassis_type || item.form_factor || "",
    supported_mobo_form_factors: Array.isArray(explicit) ? explicit : [],
    max_gpu_length_mm: safeNumber(
      item.max_gpu_length_mm ?? item.max_video_card_length ?? item.gpu_length ?? item.gpu_max_length
    ),
    max_cpu_cooler_height_mm: safeNumber(
      item.max_cpu_cooler_height_mm ?? item.max_cpu_cooler_height ?? item.cpu_cooler ?? item.cpu_cooler_height
    ),
    psu_form_factor: item.psu_form_factor || (Array.isArray(psuFormFactors) && psuFormFactors[0]) || "ATX",
    normalized_key: normalizeKey(brand, model),
  };
};

const mapBuildCoresGpu = (item) => {
  const { brand, model } = buildCoresIdentity(item);
  return {
    source: SOURCE_TAGS.BUILDCORES,
    category: "gpu",
    id: buildCoresId(item, brand, model),
    brand,
    model,
    chipset: item.chipset || model,
    vram_gb: safeNumber(item.vram_gb ?? item.memory),
    vram_type: item.vram_type || item.memory_type || "",
    tdp_w: safeNumber(item.tdp_w ?? item.tdp),
    suggested_psu_w: safeNumber(item.suggested_psu_w),
    board_length_mm: safeNumber(item.board_length_mm ?? item.length ?? item.length_mm),
    board_slot_width: safeNumber(item.board_slot_width ?? item.total_slot_width),
    power_connectors: mapGpuPowerConnectors(item),
    architecture: item.architecture || "",
    normalized_key: normalizeKey(brand, model),
  };
};

const isValidCpu = (record) => hasIdentity(record);

const isValidMobo = (record) => hasIdentity(record);

const isValidRam = (record) =>
  hasIdentity(record) && (record.speed_mts == null || record.speed_mts > 0);

const isValidPsu = (record) =>
  hasIdentity(record) && record.wattage_w != null && record.wattage_w > 0 && record.wattage_w < 5000;

const isValidCase = (record) =>
  hasIdentity(record) &&
  (record.max_gpu_length_mm == null ||
    (record.max_gpu_length_mm > 0 && record.max_gpu_length_mm < 1000));

const isValidGpu = (record) => {
  if (!hasIdentity(record)) return false;
  const tdpOk = record.tdp_w == null || (record.tdp_w > 0 && record.tdp_w < 1200);
  const vramOk = record.vram_gb == null || (record.vram_gb > 0 && record.vram_gb < 128);
  const lengthOk =
    record.board_length_mm == null || (record.board_length_mm > 0 && record.board_length_mm < 1000);
  return tdpOk && vramOk && lengthOk;
};

export function loadBuildCores(rawDir) {
  const base = path.join(rawDir, "buildcores-open-db", "open-db");
  const read = (category) => readJsonFiles(path.join(base, BUILD_CORES_CATEGORIES[category]));
  const cpus = read("cpus").map(mapBuildCoresCpu).filter(isValidCpu);
  const ram = read("ram").map(mapBuildCoresRam).filter(isValidRam);
  const mobos = read("mobos").map(mapBuildCoresMobo).filter(isValidMobo);
  const pcCases = read("pcCases").map(mapBuildCoresCase).filter(isValidCase);
  const psus = read("psus").map(mapBuildCoresPsu).filter(isValidPsu);
  const gpus = read("gpus").map(mapBuildCoresGpu).filter(isValidGpu);
  return { cpus, ram, mobos, pcCases, psus, gpus };
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
      power_connectors: sanitizeConnectorString(item.power_connectors || item.power),
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
      socket: canonicalSocket(item.socket || item.socket_type || ""),
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
      power_connectors: mapGpuPowerConnectors(item),
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
      socket: canonicalSocket(item.socket || ""),
      chipset: item.chipset || "",
      form_factor: canonicalFormFactor(item.form_factor || item.type || ""),
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
      pcie_power_connectors: mapPsuConnectors(item),
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
