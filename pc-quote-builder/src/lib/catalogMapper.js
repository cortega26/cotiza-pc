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

export const mapProcessedToCatalog = (processed = {}) => {
  const cpus =
    processed.cpus?.map((cpu) => {
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
      };
    }) || [];

  const motherboards =
    processed.mobos?.map((mobo) => ({
      id: mobo.id,
      name: mobo.name,
      socket: mobo.socket,
      formFactor: mobo.form_factor || mobo.formFactor,
      memoryType:
        normalizeMemoryType(mobo.memory_type || mobo.memoryType) ||
        (mobo.name?.toLowerCase().includes("ddr5") ? "DDR5" : mobo.name?.toLowerCase().includes("ddr4") ? "DDR4" : "") ||
        inferMemoryTypeBySocket(mobo.socket),
      memoryTypeExplicit: Boolean(normalizeMemoryType(mobo.memory_type || mobo.memoryType)),
    })) || [];

  const ramKits =
    processed.ram?.map((ram) => ({
      id: ram.id,
      name: ram.name,
      type: normalizeRamType(ram),
      speed: ram.speed_mts,
    })) || [];

  const gpus =
    processed.gpus?.map((gpu) => ({
      id: gpu.id,
      name: gpu.name,
      tdp: gpu.tdp_w,
      tdp_w: gpu.tdp_w,
      length: gpu.board_length_mm,
      psuMin: gpu.recommended_psu_w || gpu.suggested_psu_w,
      powerConnectors: gpu.power_connectors,
      power_connectors: gpu.power_connectors,
    })) || [];

  const psus =
    processed.psus?.map((psu) => ({
      id: psu.id,
      name: psu.name,
      wattage: psu.wattage_w,
      wattage_w: psu.wattage_w,
      pcieCables: psu.pcie_power_connectors?.["8_pin"] || null,
      pcie_power_connectors: psu.pcie_power_connectors || {},
    })) || [];

  const pcCases =
    processed.cases?.map((pcCase) => ({
      id: pcCase.id,
      name: pcCase.name,
      maxGpuLength: pcCase.max_gpu_length_mm,
      coolerHeight: pcCase.max_cpu_cooler_height_mm,
      formFactors: pcCase.supported_mobo_form_factors || [],
    })) || [];

  return { cpus, motherboards, ramKits, gpus, psus, pcCases, meta: processed.compat || null };
};

export const buildTierMaps = (compatMeta) => {
  const cpu = new Map();
  const gpu = new Map();
  (compatMeta?.tiers?.cpu || []).forEach((tier) => cpu.set(tier.id, tier.tier));
  (compatMeta?.tiers?.gpu || []).forEach((tier) => gpu.set(tier.id, tier.tier));
  return { cpu, gpu };
};
