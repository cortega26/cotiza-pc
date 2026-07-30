import { safeNumber, slug, sortObjectKeys, stableIdSort } from "./normalize.js";

export const SOURCE_TAGS = {
  BUILDCORES: "buildcores",
  DBGPU: "dbgpu",
  PCPART: "pcpart",
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
  const sources = Array.from(new Set(records.map((r) => r.source))).sort();
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
}

export function mergeGpu(records) {
  if (!records.length) return null;
  const sources = Array.from(new Set(records.map((r) => r.source))).sort();
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
}

export function mergeMobo(records) {
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
}

export function mergePsu(records) {
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

export function mergeCase(records) {
  if (!records.length) return null;
  const b = records[0];
  const canonicalId = `case_${slug(`${b.brand} ${b.model}`)}`;
  const { formFactors, evidence } = canonicalizeFormFactors(b.chassis_type);
  return {
    id: canonicalId,
    name: `${b.brand} ${b.model}`.trim(),
    brand: b.brand,
    model: b.model,
    category: "case",
    chassis_type: b.chassis_type || "",
    supported_mobo_form_factors: formFactors,
    form_factor_evidence: evidence,
    max_gpu_length_mm: b.max_gpu_length_mm || null,
    max_cpu_cooler_height_mm: b.max_cpu_cooler_height_mm || null,
    psu_form_factor: b.psu_form_factor || "ATX",
    sources: { pcpart_id: b.id },
    meta: { created_from: [SOURCE_TAGS.PCPART], conflict_flags: [], quality_score: 0.8 },
    normalized_key: b.normalized_key,
  };
}

export function mergeRam(records) {
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
}

export function mergeCooler(records) {
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
}

export function mergeFan(records) {
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
    notes: "Compatibilidad detallada se calcula en frontend (src/lib/compatibility.js); aquí se incluyen rangos y tiers.",
  };
}
