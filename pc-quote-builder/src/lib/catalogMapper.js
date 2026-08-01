import { extractCpuFamily, inferBrand, inferMemoryTypeBySocket, inferSocket } from "./catalogHelpers";

const normalizeRamType = (ram) => {
  let type = ram.type || "";
  if (!type && Array.isArray(ram.speed)) {
    const gen = ram.speed[0];
    if (gen) type = `DDR${gen}`;
  }
  if (!type && typeof ram.speed === "string" && /ddr\d/i.test(ram.speed)) {
    const match = ram.speed.match(/ddr(\d)/i);
    if (match) type = `DDR${match[1]}`;
  }
  return type.toUpperCase();
};

const normalizeMemoryType = (raw) => String(raw || "").trim().toUpperCase();

const resolveCpuMemoryType = (cpu) => {
  // Prefer explicit data from processed datasets, but also respect local catalog.json fields.
  const types = Array.isArray(cpu?.memory_support?.types) ? cpu.memory_support.types.map(normalizeMemoryType).filter(Boolean) : [];
  const unique = Array.from(new Set(types));
  if (unique.length === 1) return { memoryType: unique[0], memoryTypeExplicit: true };
  if (unique.length > 1) return { memoryType: "", memoryTypeExplicit: false }; // ambiguous (DDR4/DDR5)

  const explicit = normalizeMemoryType(cpu?.memory_type || cpu?.memoryType);
  if (explicit) return { memoryType: explicit, memoryTypeExplicit: true };

  return { memoryType: normalizeMemoryType(inferMemoryTypeBySocket(inferSocket(cpu))), memoryTypeExplicit: false };
};

const CANONICAL_FORM_FACTORS = new Set(["E-ATX", "ATX", "Micro ATX", "Mini ITX"]);

const LEGACY_FORM_FACTOR_MAP = {
  "ATX Desktop": ["ATX", "Micro ATX", "Mini ITX"],
  "ATX Full": ["E-ATX", "ATX", "Micro ATX", "Mini ITX"],
  "ATX Mid": ["ATX", "Micro ATX", "Mini ITX"],
  "ATX Mini": ["Micro ATX", "Mini ITX"],
  "ATX Test Bench": ["ATX", "Micro ATX", "Mini ITX"],
  HTPC: ["Micro ATX", "Mini ITX"],
  "MicroATX Desktop": ["Micro ATX", "Mini ITX"],
  "MicroATX Mid": ["Micro ATX", "Mini ITX"],
  "MicroATX Mini": ["Micro ATX", "Mini ITX"],
  "MicroATX Slim": ["Micro ATX", "Mini ITX"],
  "Mini ITX": ["Mini ITX"],
  "Mini ITX Desktop": ["Mini ITX"],
  "Mini ITX Test Bench": ["Mini ITX"],
};

function normalizeCaseFormFactors(pcCase) {
  const raw = pcCase.supported_mobo_form_factors ?? pcCase.formFactors ?? [];
  if (raw.every((f) => CANONICAL_FORM_FACTORS.has(f))) return raw;
  const mapped = raw.flatMap((f) => LEGACY_FORM_FACTOR_MAP[f] ?? f);
  return [...new Set(mapped)];
}

const normalizeMotherboardsKey = (src) => {
  if (src.mobos) return src.mobos;
  if (src.motherboards) return src.motherboards;
  return [];
};

const normalizeRamKey = (src) => {
  if (src.ram) return src.ram;
  if (src.ramKits) return src.ramKits;
  return [];
};

const normalizeCasesKey = (src) => {
  if (src.cases) return src.cases;
  if (src.pcCases) return src.pcCases;
  return [];
};

/**
 * Compact evidence provenance for a normalized component. Defaults are empty
 * collections or null, never optimistic values.
 */
const buildEvidence = (item) => ({
  sources: item?.sources || {},
  conflicts: item?.meta?.conflict_flags || [],
  qualityScore: item?.meta?.quality_score ?? null,
});

export const mapProcessedToCatalog = (processed) => {
  const data = processed || {};
  const cpus =
    data.cpus?.map((cpu) => {
      const { memoryType, memoryTypeExplicit } = resolveCpuMemoryType(cpu);
      return {
        id: cpu.id,
        name: cpu.name,
        brand: inferBrand(cpu),
        family: extractCpuFamily(cpu),
        socket: inferSocket(cpu),
        memoryType,
        memoryTypeExplicit,
        tdp: cpu.tdp_w ?? cpu.tdp ?? null,
        tdp_w: cpu.tdp_w ?? cpu.tdp ?? null,
        suggestedPsu: cpu.suggested_psu_w ?? cpu.suggestedPsu ?? null,
        evidence: buildEvidence(cpu),
      };
    }) || [];

  const motherboards =
    normalizeMotherboardsKey(data).map((mobo) => {
      const nameMemoryType = mobo.name?.toLowerCase().includes("ddr5")
        ? "DDR5"
        : mobo.name?.toLowerCase().includes("ddr4")
          ? "DDR4"
          : mobo.name?.toLowerCase().includes("ddr3")
            ? "DDR3"
            : mobo.name?.toLowerCase().includes("ddr2")
              ? "DDR2"
              : "";
      const memoryType =
        normalizeMemoryType(mobo.memory_type || mobo.memoryType) ||
        nameMemoryType ||
        inferMemoryTypeBySocket(mobo.socket);
      return {
        id: mobo.id,
        name: mobo.name,
        socket: mobo.socket,
        formFactor: mobo.form_factor || mobo.formFactor,
        memoryType,
        memoryTypeExplicit: Boolean(memoryType),
        memory_slots: mobo.memory_slots ?? mobo.memorySlots ?? null,
        max_memory_gb: mobo.max_memory_gb ?? mobo.maxMemoryGb ?? null,
        max_memory_speed_mts: mobo.max_memory_speed_mts ?? mobo.maxMemorySpeedMts ?? mobo.maxMemorySpeed ?? null,
        evidence: buildEvidence(mobo),
      };
    }) || [];

  const ramKits =
    normalizeRamKey(data).map((ram) => ({
      id: ram.id,
      name: ram.name,
      type: normalizeRamType(ram),
      speed: ram.speed_mts ?? ram.speed ?? null,
      modules: ram.modules ?? null,
      capacity_gb_total: ram.capacity_gb_total ?? ram.capacityGbTotal ?? null,
      speed_mts: ram.speed_mts ?? ram.speed ?? null,
      evidence: buildEvidence(ram),
    })) || [];

  const gpus =
    data.gpus?.map((gpu) => ({
      id: gpu.id,
      name: gpu.name,
      tdp: gpu.tdp_w ?? gpu.tdp ?? null,
      tdp_w: gpu.tdp_w ?? gpu.tdp ?? null,
      length: gpu.board_length_mm ?? gpu.length ?? null,
      psuMin: gpu.recommended_psu_w ?? gpu.suggested_psu_w ?? gpu.psuMin ?? null,
      powerConnectors: gpu.power_connectors ?? gpu.powerConnectors ?? null,
      power_connectors: gpu.power_connectors ?? gpu.powerConnectors ?? null,
      evidence: buildEvidence(gpu),
    })) || [];

  const psus =
    data.psus?.map((psu) => ({
      id: psu.id,
      name: psu.name,
      wattage: psu.wattage_w ?? psu.wattage ?? null,
      wattage_w: psu.wattage_w ?? psu.wattage ?? null,
      pcieCables: psu.pcie_power_connectors?.["8_pin"] ?? psu.pcieCables ?? null,
      pcie_power_connectors: psu.pcie_power_connectors ?? psu.pciePowerConnectors ?? {},
      evidence: buildEvidence(psu),
    })) || [];

  const pcCases =
    normalizeCasesKey(data).map((pcCase) => ({
      id: pcCase.id,
      name: pcCase.name,
      chassisType: pcCase.chassis_type ?? pcCase.chassisType ?? "",
      maxGpuLength: pcCase.max_gpu_length_mm ?? pcCase.maxGpuLength ?? null,
      coolerHeight: pcCase.max_cpu_cooler_height_mm ?? pcCase.coolerHeight ?? null,
      formFactors: normalizeCaseFormFactors(pcCase),
      formFactorEvidence: pcCase.form_factor_evidence ?? pcCase.formFactorEvidence ?? "unknown",
      evidence: buildEvidence(pcCase),
    })) || [];

  return { cpus, motherboards, ramKits, gpus, psus, pcCases, meta: data.compat || null };
};

export const resolveCatalogId = (oldId, aliases) => {
  if (!aliases) return oldId;
  return aliases[oldId] ?? oldId;
};

export const buildTierMaps = (compatMeta) => {
  const cpu = new Map();
  const gpu = new Map();
  (compatMeta?.tiers?.cpu || []).forEach((tier) => cpu.set(tier.id, tier.tier));
  (compatMeta?.tiers?.gpu || []).forEach((tier) => gpu.set(tier.id, tier.tier));
  return { cpu, gpu };
};
