import { safeNumber, slug, legacySlug, sortObjectKeys, stableIdSort } from "./normalize.js";

export const SOURCE_TAGS = {
  BUILDCORES: "buildcores",
  DBGPU: "dbgpu",
  PCPART: "pcpart",
};

const isUsableValue = (value) => {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
};

const sourceList = (records) => Array.from(new Set(records.map((r) => r.source))).sort();

/**
 * Pick the first usable value following the given source precedence, then any
 * remaining record. Missing/empty values never block a later source.
 */
const pickField = (records, order, selector) => {
  for (const source of order) {
    const record = records.find((r) => r.source === source);
    if (!record) continue;
    const value = selector(record);
    if (isUsableValue(value)) return value;
  }
  for (const record of records) {
    const value = selector(record);
    if (isUsableValue(value)) return value;
  }
  return null;
};

const identityRecord = (records, order) =>
  order.map((source) => records.find((r) => r.source === source)).find(Boolean) || records[0];

const evidenceSources = (records, selectors) => {
  const result = {};
  for (const [key, source, selector] of selectors) {
    const record = records.find((r) => r.source === source);
    result[key] = record ? selector(record) : null;
  }
  return result;
};

export const computeTierCpu = (cpu) => {
  const cores = safeNumber(cpu.cores) || 0;
  const boost = safeNumber(cpu.boost_clock_ghz) || 0;
  if (cores >= 12 && boost >= 4.5) return 4;
  if (cores >= 8 && boost >= 4.2) return 3;
  if (cores >= 6) return 2;
  return 1;
};

export const computeTierGpu = (gpu) => {
  const tdp = safeNumber(gpu.tdp_w) || 0;
  const vram = safeNumber(gpu.vram_gb) || 0;
  if (tdp >= 250 || vram >= 12) return 4;
  if (tdp >= 180 || vram >= 10) return 3;
  if (tdp >= 120 || vram >= 8) return 2;
  return 1;
};

export const byNormalizedKey = (list) =>
  list.reduce((acc, item) => {
    if (!item.normalized_key) return acc;
    acc[item.normalized_key] = acc[item.normalized_key] || [];
    acc[item.normalized_key].push(item);
    return acc;
  }, {});

export const mergeGrouped = (items, mergeFn) => {
  const groups = byNormalizedKey(items);
  return Object.keys(groups)
    .sort()
    .map((k) => mergeFn(groups[k]))
    .filter(Boolean);
};

export const range = (list, key) => {
  const nums = list.map((i) => safeNumber(i[key])).filter((v) => v != null);
  if (!nums.length) return null;
  return { min: Math.min(...nums), max: Math.max(...nums) };
};

export function mergeCpu(records) {
  if (!records.length) return null;
  const sources = sourceList(records);
  const field = (selector) =>
    pickField(records, [SOURCE_TAGS.BUILDCORES, SOURCE_TAGS.PCPART], selector);
  const b = identityRecord(records, [SOURCE_TAGS.PCPART, SOURCE_TAGS.BUILDCORES]);
  const canonicalId = `cpu_${slug(`${b.brand} ${b.model}`)}`;
  const legacyCpuId = `cpu_${legacySlug(`${b.brand} ${b.model}`)}`;
  const tdpValues = records.map((r) => r.tdp_w).filter((v) => v != null);
  const conflict_flags = [];
  if (tdpValues.length > 1) {
    const max = Math.max(...tdpValues);
    const min = Math.min(...tdpValues);
    if (Math.abs(max - min) > 5) conflict_flags.push("cpu_tdp_conflict");
  }
  const memorySupport =
    field((r) =>
      Array.isArray(r.memory_support?.types) && r.memory_support.types.length ? r.memory_support : null
    ) || (() => {
      const memoryType = field((r) => r.memory_type);
      return { types: memoryType ? [memoryType] : [] };
    })();
  return {
    id: canonicalId,
    name: `${b.brand} ${b.model}`.trim(),
    brand: b.brand,
    model: b.model,
    category: "cpu",
    socket: field((r) => r.socket) || "",
    tdp_w: field((r) => r.tdp_w),
    cores: field((r) => r.cores),
    threads: field((r) => r.threads),
    base_clock_ghz: field((r) => r.base_clock_ghz),
    boost_clock_ghz: field((r) => r.boost_clock_ghz),
    memory_support: memorySupport,
    sources: evidenceSources(records, [
      ["buildcores_id", SOURCE_TAGS.BUILDCORES, (r) => r.id],
      ["pcpart_id", SOURCE_TAGS.PCPART, (r) => r.id],
    ]),
    legacy_id: legacyCpuId !== canonicalId ? legacyCpuId : undefined,
    meta: {
      created_from: sources,
      conflict_flags,
      quality_score: sources.length > 1 ? 0.9 : 0.8,
    },
    normalized_key: b.normalized_key,
  };
}

export function mergeGpu(records) {
  if (!records.length) return null;
  const sources = sourceList(records);
  const field = (selector) =>
    pickField(records, [SOURCE_TAGS.DBGPU, SOURCE_TAGS.BUILDCORES, SOURCE_TAGS.PCPART], selector);
  const base = identityRecord(records, [SOURCE_TAGS.DBGPU, SOURCE_TAGS.PCPART, SOURCE_TAGS.BUILDCORES]);
  const brand = base.brand || "";
  const gpuModel = base.model || base.chipset || base.normalized_key || "";
  const canonicalId = `gpu_${slug(`${brand} ${gpuModel}`)}`;
  const legacyId = `gpu_${legacySlug(gpuModel)}`;
  const tdpValues = records.map((r) => r.tdp_w).filter((v) => v != null);
  const conflict_flags = [];
  if (tdpValues.length > 1) {
    const max = Math.max(...tdpValues);
    const min = Math.min(...tdpValues);
    if (Math.abs(max - min) > 5) conflict_flags.push("gpu_tdp_conflict");
  }
  const tdp_w = field((r) => r.tdp_w);
  const suggested_psu_w = field((r) => r.suggested_psu_w);
  const hasTdp = typeof tdp_w === "number" && Number.isFinite(tdp_w);
  const vendorPsu =
    typeof suggested_psu_w === "number" && Number.isFinite(suggested_psu_w) ? suggested_psu_w : null;
  const recommendedCalc = hasTdp ? Math.ceil((tdp_w + 75) * 1.3 + 50) : null;
  const recommended_psu_w = hasTdp ? Math.max(vendorPsu || 0, recommendedCalc) : vendorPsu;
  return {
    id: canonicalId,
    name: `${brand} ${base.model || base.chipset}`.trim(),
    brand: brand,
    model: base.model || base.chipset,
    category: "gpu",
    chipset: field((r) => r.chipset) || base.model,
    vram_gb: field((r) => r.vram_gb),
    vram_type: field((r) => r.vram_type) || "",
    tdp_w,
    suggested_psu_w,
    recommended_psu_w,
    board_length_mm: field((r) => r.board_length_mm),
    board_slot_width: field((r) => r.board_slot_width),
    power_connectors: field((r) => r.power_connectors) || "",
    architecture: field((r) => r.architecture) || "",
    sources: evidenceSources(records, [
      ["dbgpu_id", SOURCE_TAGS.DBGPU, (r) => r.id],
      ["buildcores_id", SOURCE_TAGS.BUILDCORES, (r) => r.id],
      ["pcpart_id", SOURCE_TAGS.PCPART, (r) => r.id],
    ]),
    legacy_id: legacyId !== canonicalId ? legacyId : undefined,
    meta: { created_from: sources, conflict_flags, quality_score: sources.length > 1 ? 0.9 : 0.8 },
    normalized_key: base.normalized_key,
  };
}

export function mergeMobo(records) {
  if (!records.length) return null;
  const sources = sourceList(records);
  const field = (selector) =>
    pickField(records, [SOURCE_TAGS.PCPART, SOURCE_TAGS.BUILDCORES], selector);
  const b = identityRecord(records, [SOURCE_TAGS.PCPART, SOURCE_TAGS.BUILDCORES]);
  const canonicalId = `mobo_${slug(`${b.brand} ${b.model}`)}`;
  const legacyMoboId = `mobo_${legacySlug(`${b.brand} ${b.model}`)}`;
  return {
    id: canonicalId,
    name: `${b.brand} ${b.model}`.trim(),
    brand: b.brand,
    model: b.model,
    category: "motherboard",
    socket: field((r) => r.socket) || "",
    chipset: field((r) => r.chipset) || "",
    form_factor: field((r) => r.form_factor) || "",
    memory_type: field((r) => r.memory_type) || "",
    memory_slots: field((r) => r.memory_slots),
    max_memory_gb: field((r) => r.max_memory_gb),
    m2_slots: field((r) => r.m2_slots),
    sata_ports: field((r) => r.sata_ports),
    sources: evidenceSources(records, [
      ["buildcores_id", SOURCE_TAGS.BUILDCORES, (r) => r.id],
      ["pcpart_id", SOURCE_TAGS.PCPART, (r) => r.id],
    ]),
    legacy_id: legacyMoboId !== canonicalId ? legacyMoboId : undefined,
    meta: { created_from: sources, conflict_flags: [], quality_score: sources.length > 1 ? 0.9 : 0.8 },
    normalized_key: b.normalized_key,
  };
}

export function mergePsu(records) {
  if (!records.length) return null;
  const sources = sourceList(records);
  const field = (selector) =>
    pickField(records, [SOURCE_TAGS.PCPART, SOURCE_TAGS.BUILDCORES], selector);
  const b = identityRecord(records, [SOURCE_TAGS.PCPART, SOURCE_TAGS.BUILDCORES]);
  const canonicalId = `psu_${slug(`${b.brand} ${b.model}`)}`;
  const legacyPsuId = `psu_${legacySlug(`${b.brand} ${b.model}`)}`;
  return {
    id: canonicalId,
    name: `${b.brand} ${b.model}`.trim(),
    brand: b.brand,
    model: b.model,
    category: "psu",
    wattage_w: field((r) => r.wattage_w),
    form_factor: field((r) => r.form_factor) || "ATX",
    efficiency_rating: field((r) => r.efficiency_rating) || "",
    pcie_power_connectors: field((r) => r.pcie_power_connectors) || {},
    sources: evidenceSources(records, [
      ["buildcores_id", SOURCE_TAGS.BUILDCORES, (r) => r.id],
      ["pcpart_id", SOURCE_TAGS.PCPART, (r) => r.id],
    ]),
    legacy_id: legacyPsuId !== canonicalId ? legacyPsuId : undefined,
    meta: { created_from: sources, conflict_flags: [], quality_score: sources.length > 1 ? 0.9 : 0.8 },
    normalized_key: b.normalized_key,
  };
}

const FORM_FACTOR_RULES = [
  { pattern: /atx\s*full/i, formFactors: ["E-ATX", "ATX", "Micro ATX", "Mini ITX"] },
  { pattern: /atx\s*mid/i, formFactors: ["ATX", "Micro ATX", "Mini ITX"] },
  { pattern: /atx\s*mini/i, formFactors: ["Micro ATX", "Mini ITX"] },
  { pattern: /atx\s*slim/i, formFactors: ["ATX", "Micro ATX", "Mini ITX"] },
  { pattern: /atx\s*desktop/i, formFactors: ["ATX", "Micro ATX", "Mini ITX"] },
  { pattern: /^atx$/i, formFactors: ["ATX", "Micro ATX", "Mini ITX"] },
  { pattern: /atx\s*tower/i, formFactors: ["ATX", "Micro ATX", "Mini ITX"] },
  { pattern: /microatx.*mini/i, formFactors: ["Micro ATX", "Mini ITX"] },
  { pattern: /microatx.*mid/i, formFactors: ["Micro ATX", "Mini ITX"] },
  { pattern: /microatx/i, formFactors: ["Micro ATX", "Mini ITX"] },
  { pattern: /mini.?itx/i, formFactors: ["Mini ITX"] },
  { pattern: /full.?tower/i, formFactors: ["E-ATX", "ATX", "Micro ATX", "Mini ITX"] },
  { pattern: /mid.?tower/i, formFactors: ["ATX", "Micro ATX", "Mini ITX"] },
  { pattern: /mini.?tower/i, formFactors: ["Micro ATX", "Mini ITX"] },
];

export function canonicalizeFormFactors(chassisType) {
  if (!chassisType) return { formFactors: [], evidence: "unknown" };
  for (const rule of FORM_FACTOR_RULES) {
    if (rule.pattern.test(chassisType)) {
      return { formFactors: rule.formFactors, evidence: "inferred" };
    }
  }
  return { formFactors: [], evidence: "unknown" };
}

const SUPPORTED_FORM_FACTOR_MAP = Object.freeze({
  "E ATX": "E-ATX",
  ATX: "ATX",
  "MICRO ATX": "Micro ATX",
  MICROATX: "Micro ATX",
  "MINI ITX": "Mini ITX",
  MINIITX: "Mini ITX",
});

/** Canonicalize an explicit supported-form-factor list; unknown values drop. */
export function canonicalizeSupportedFormFactors(list) {
  if (!Array.isArray(list) || !list.length) return [];
  const canonical = [];
  for (const value of list) {
    const key = String(value ?? "").trim().toUpperCase().replace(/[-\s]+/g, " ");
    const mapped = SUPPORTED_FORM_FACTOR_MAP[key];
    if (mapped && !canonical.includes(mapped)) canonical.push(mapped);
  }
  return canonical;
}

export function mergeCase(records) {
  if (!records.length) return null;
  const sources = sourceList(records);
  const field = (selector) =>
    pickField(records, [SOURCE_TAGS.PCPART, SOURCE_TAGS.BUILDCORES], selector);
  const b = identityRecord(records, [SOURCE_TAGS.PCPART, SOURCE_TAGS.BUILDCORES]);
  const canonicalId = `case_${slug(`${b.brand} ${b.model}`)}`;
  const legacyCaseId = `case_${legacySlug(`${b.brand} ${b.model}`)}`;
  const explicitFormFactors = records
    .map((record) => canonicalizeSupportedFormFactors(record.supported_mobo_form_factors))
    .find((list) => list.length > 0);
  const inferred = canonicalizeFormFactors(field((r) => r.chassis_type));
  const formFactors = explicitFormFactors || inferred.formFactors;
  const evidence = explicitFormFactors ? "explicit" : inferred.evidence;
  return {
    id: canonicalId,
    name: `${b.brand} ${b.model}`.trim(),
    brand: b.brand,
    model: b.model,
    category: "case",
    chassis_type: field((r) => r.chassis_type) || "",
    supported_mobo_form_factors: formFactors,
    form_factor_evidence: evidence,
    max_gpu_length_mm: field((r) => r.max_gpu_length_mm),
    max_cpu_cooler_height_mm: field((r) => r.max_cpu_cooler_height_mm),
    psu_form_factor: field((r) => r.psu_form_factor) || "ATX",
    legacy_id: legacyCaseId !== canonicalId ? legacyCaseId : undefined,
    sources: evidenceSources(records, [
      ["buildcores_id", SOURCE_TAGS.BUILDCORES, (r) => r.id],
      ["pcpart_id", SOURCE_TAGS.PCPART, (r) => r.id],
    ]),
    meta: { created_from: sources, conflict_flags: [], quality_score: sources.length > 1 ? 0.9 : 0.8 },
    normalized_key: b.normalized_key,
  };
}

export function mergeRam(records) {
  if (!records.length) return null;
  const sources = sourceList(records);
  const field = (selector) =>
    pickField(records, [SOURCE_TAGS.PCPART, SOURCE_TAGS.BUILDCORES], selector);
  const b = identityRecord(records, [SOURCE_TAGS.PCPART, SOURCE_TAGS.BUILDCORES]);
  const canonicalId = `ram_${slug(`${b.brand} ${b.model}`)}`;
  const legacyRamId = `ram_${legacySlug(`${b.brand} ${b.model}`)}`;
  return {
    id: canonicalId,
    name: `${b.brand} ${b.model}`.trim(),
    brand: b.brand,
    model: b.model,
    category: "ram",
    type: field((r) => r.type) || "",
    capacity_gb_total: field((r) => r.capacity_gb_total),
    modules: field((r) => r.modules),
    speed_mts: field((r) => r.speed_mts),
    cas_latency: field((r) => r.cas_latency),
    legacy_id: legacyRamId !== canonicalId ? legacyRamId : undefined,
    sources: {
      ...evidenceSources(records, [
        ["buildcores_id", SOURCE_TAGS.BUILDCORES, (r) => r.id],
        ["pcpart_id", SOURCE_TAGS.PCPART, (r) => r.id],
      ]),
      source_id: b.id,
      source: b.source,
    },
    meta: { created_from: sources, conflict_flags: [], quality_score: sources.length > 1 ? 0.9 : 0.8 },
    normalized_key: b.normalized_key,
  };
}

export function mergeCooler(records) {
  if (!records.length) return null;
  const b = records[0];
  const canonicalId = `cooler_${slug(`${b.brand} ${b.model}`)}`;
  const legacyCoolerId = `cooler_${legacySlug(`${b.brand} ${b.model}`)}`;
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
    legacy_id: legacyCoolerId !== canonicalId ? legacyCoolerId : undefined,
    sources: { pcpart_id: b.id },
    meta: { created_from: [b.source], conflict_flags: [], quality_score: 0.7 },
    normalized_key: b.normalized_key,
  };
}

export function mergeFan(records) {
  if (!records.length) return null;
  const b = records[0];
  const canonicalId = `fan_${slug(`${b.brand} ${b.model}`)}`;
  const legacyFanId = `fan_${legacySlug(`${b.brand} ${b.model}`)}`;
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
    legacy_id: legacyFanId !== canonicalId ? legacyFanId : undefined,
    sources: { pcpart_id: b.id },
    meta: { created_from: [b.source], conflict_flags: [], quality_score: 0.7 },
    normalized_key: b.normalized_key,
  };
}

export function deduplicateIds(items, retries = 5) {
  const seen = new Map();
  const result = [];
  for (const item of items) {
    let id = item.id;
    let suffix = 2;
    while (seen.has(id)) {
      id = `${item.id}_${suffix}`;
      suffix++;
      if (suffix - 2 > retries) break; // safety
    }
    seen.set(id, true);
    result.push(id !== item.id ? { ...item, id } : item);
  }
  return result;
}

export function computeLegacyAliases(...categories) {
  const aliasMap = {};
  const legacyCounts = {};
  for (const items of categories) {
    if (!items) continue;
    for (const item of items) {
      if (!item.legacy_id) continue;
      legacyCounts[item.legacy_id] = (legacyCounts[item.legacy_id] || 0) + 1;
    }
  }
  for (const items of categories) {
    if (!items) continue;
    for (const item of items) {
      if (!item.legacy_id) continue;
      if (legacyCounts[item.legacy_id] === 1) {
        aliasMap[item.legacy_id] = item.id;
      }
    }
  }
  return aliasMap;
}

export function computeCompatibilityMeta({
  mergedCpus,
  mergedGpus,
  mergedMobos,
  mergedPsus,
  mergedCases,
  mergedRam,
  mergedCoolers,
  mergedFans,
  provenance,
  now,
}) {
  const cpuTiers = mergedCpus.map((c) => ({ id: c.id, tier: computeTierCpu(c) })).sort(stableIdSort);
  const gpuTiers = mergedGpus.map((g) => ({ id: g.id, tier: computeTierGpu(g) })).sort(stableIdSort);

  return {
    schemaVersion: 1,
    generatedAt: (now || new Date()).toISOString(),
    provenance: provenance || null,
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
    sockets: sortObjectKeys(
      Object.fromEntries(
        mergedMobos.reduce((acc, m) => {
          if (!m.socket) return acc;
          acc.set(m.socket, { mobos: (acc.get(m.socket)?.mobos || 0) + 1, cpus: 0 });
          return acc;
        }, new Map())
      )
    ),
    form_factors: sortObjectKeys(
      Object.fromEntries(
        mergedCases.reduce((acc, c) => {
          for (const ff of c.supported_mobo_form_factors || []) {
            acc.set(ff, { cases: (acc.get(ff)?.cases || 0) + 1, mobos: 0 });
          }
          return acc;
        }, new Map())
      )
    ),
    tiers: {
      cpu: cpuTiers,
      gpu: gpuTiers,
    },
    aliases: computeLegacyAliases(
      mergedCpus,
      mergedGpus,
      mergedMobos,
      mergedPsus,
      mergedCases,
      mergedRam,
      mergedCoolers,
      mergedFans
    ),
    notes: "Compatibilidad detallada se calcula en frontend (src/lib/compatibility.js); aquí se incluyen rangos y tiers.",
  };
}
