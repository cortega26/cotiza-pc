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

export const mapProcessedToCatalog = (processed = {}) => {
  const cpus =
    processed.cpus?.map((cpu) => ({
      id: cpu.id,
      name: cpu.name,
      brand: inferBrand(cpu),
      family: extractCpuFamily(cpu),
      socket: inferSocket(cpu),
      memoryType:
        (cpu.memory_support?.types?.[0] || cpu.memory_type || "").toUpperCase() ||
        inferMemoryTypeBySocket(inferSocket(cpu)),
      tdp: cpu.tdp_w,
      tdp_w: cpu.tdp_w,
      suggestedPsu: cpu.suggested_psu_w,
    })) || [];

  const motherboards =
    processed.mobos?.map((mobo) => ({
      id: mobo.id,
      name: mobo.name,
      socket: mobo.socket,
      formFactor: mobo.form_factor,
      memoryType:
        (mobo.memory_type || "").toUpperCase() ||
        (mobo.name?.toLowerCase().includes("ddr5") ? "DDR5" : mobo.name?.toLowerCase().includes("ddr4") ? "DDR4" : "") ||
        inferMemoryTypeBySocket(mobo.socket),
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
