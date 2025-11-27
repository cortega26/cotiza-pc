// Funciones de compatibilidad y potencia. Pensadas para usar con los JSON procesados.

const toNumber = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function estimatePowerEnvelope(cpu, gpu, extraHeadroomW = 50) {
  const cpuTdp = toNumber(cpu?.tdp_w ?? cpu?.tdp) || 0;
  const gpuTdp = toNumber(gpu?.tdp_w ?? gpu?.tdp) || 0;
  const estimated_load_w = cpuTdp + gpuTdp + extraHeadroomW;
  const suggestedByGpu = toNumber(gpu?.suggested_psu_w);
  const recommendedRaw = Math.max(estimated_load_w * 1.3 + 50, suggestedByGpu || 0);
  const recommended_min_psu_w = Math.ceil(recommendedRaw / 50) * 50;
  return { estimated_load_w, recommended_min_psu_w };
}

export function checkCpuMoboCompatibility(cpu, mobo) {
  if (!cpu || !mobo) return { compatible: false, reason: "Faltan datos" };
  const socketOk = cpu.socket && mobo.socket && cpu.socket === mobo.socket;
  const memoryOk =
    (mobo.memory_type || mobo.memoryType) && Array.isArray(cpu.memory_support?.types)
      ? cpu.memory_support.types.includes(mobo.memory_type || mobo.memoryType)
      : true;
  if (!socketOk) return { compatible: false, reason: "Socket distinto" };
  if (!memoryOk) return { compatible: false, reason: "Tipo de RAM no coincide" };
  return { compatible: true };
}

export function checkRamMoboCompatibility(ram, mobo) {
  if (!ram || !mobo) return { compatible: false, reason: "Faltan datos" };
  const moboMemory = mobo.memory_type || mobo.memoryType;
  if (ram.type && moboMemory && ram.type !== moboMemory) {
    return { compatible: false, reason: "Tipo de RAM no coincide" };
  }
  if (mobo.memory_slots && ram.modules && ram.modules > mobo.memory_slots) {
    return { compatible: false, reason: "Excede número de slots" };
  }
  if ((mobo.max_memory_gb || mobo.maxMemoryGb) && ram.capacity_gb_total && ram.capacity_gb_total > (mobo.max_memory_gb || mobo.maxMemoryGb)) {
    return { compatible: false, reason: "Excede capacidad máxima" };
  }
  if ((mobo.max_memory_speed_mts || mobo.maxMemorySpeedMts) && ram.speed_mts && ram.speed_mts > (mobo.max_memory_speed_mts || mobo.maxMemorySpeedMts)) {
    return { compatible: true, warning: "RAM sobre el máximo oficial; puede requerir ajuste/XMP" };
  }
  return { compatible: true };
}

export function checkMoboCaseCompatibility(mobo, pcCase) {
  if (!mobo || !pcCase) return { compatible: false, reason: "Faltan datos" };
  const formFactor = mobo.form_factor || mobo.formFactor;
  const supported = pcCase.supported_mobo_form_factors || pcCase.formFactors;
  const ok =
    Array.isArray(supported) &&
    supported.includes(formFactor);
  return ok ? { compatible: true } : { compatible: false, reason: "Factor de forma no soportado" };
}

export function checkGpuCaseCompatibility(gpu, pcCase) {
  if (!gpu || !pcCase) return { compatible: false, reason: "Faltan datos" };
  const gpuLength = gpu.board_length_mm ?? gpu.length;
  const maxLength = pcCase.max_gpu_length_mm ?? pcCase.maxGpuLength;
  if (!gpuLength || !maxLength) return { compatible: false, reason: "Desconocido" };
  const ok = gpuLength <= maxLength;
  return ok ? { compatible: true } : { compatible: false, reason: "La GPU no cabe en el gabinete" };
}

export function checkPsuPowerSufficiency(psu, cpu, gpu, extraHeadroomW = 50) {
  if (!psu || !cpu || !gpu) return { status: "unknown", reason: "Faltan datos" };
  const { estimated_load_w, recommended_min_psu_w } = estimatePowerEnvelope(cpu, gpu, extraHeadroomW);
  const wattage = toNumber(psu.wattage_w ?? psu.wattage);
  if (!wattage) return { status: "unknown", reason: "PSU sin wattage" };
  if (wattage >= recommended_min_psu_w) return { status: "ok", estimated_load_w, recommended_min_psu_w };
  if (wattage >= estimated_load_w)
    return { status: "warn", estimated_load_w, recommended_min_psu_w, reason: "Poco margen" };
  return { status: "fail", estimated_load_w, recommended_min_psu_w, reason: "PSU insuficiente" };
}

export function checkPsuConnectors(psu, gpu) {
  if (!psu || !gpu) return { status: "unknown", reason: "Faltan datos" };
  const connectors = psu.pcie_power_connectors || {};
  const needRaw = (gpu.power_connectors || "").toLowerCase();
  const parseRequired = (pattern) => {
    const match = needRaw.match(pattern);
    if (!match) return 0;
    const count = parseInt(match[1], 10);
    return Number.isFinite(count) ? count : 1;
  };

  const required12 = needRaw.includes("12vhpwr") ? parseRequired(/(\d+)\s*x?\s*12vhpwr/) || 1 : 0;
  if (required12 > 0 && (connectors["12vhpwr"] || 0) < required12) {
    return { status: "fail", reason: "Falta 12VHPWR" };
  }

  const required8 = needRaw.includes("8-pin") ? parseRequired(/(\d+)\s*x?\s*8-pin/) || 1 : 0;
  if (required8 > 0) {
    const count = (connectors["8_pin"] || 0) + (connectors["6+2"] || 0);
    if (count < required8) return { status: "fail", reason: "Faltan 8-pin" };
  }

  return { status: "ok" };
}

// Balance CPU ↔ GPU (tiers simples)
const tierCpu = (cpu) => {
  if (!cpu) return null;
  const cores = toNumber(cpu.cores) || 0;
  const boost = toNumber(cpu.boost_clock_ghz) || 0;
  if (cores >= 12 && boost >= 4.5) return 4;
  if (cores >= 8 && boost >= 4.2) return 3;
  if (cores >= 6) return 2;
  return 1;
};

const tierGpu = (gpu) => {
  if (!gpu) return null;
  const tdp = toNumber(gpu.tdp_w) || 0;
  const vram = toNumber(gpu.vram_gb) || 0;
  if (tdp >= 250 || vram >= 12) return 4;
  if (tdp >= 180 || vram >= 10) return 3;
  if (tdp >= 120 || vram >= 8) return 2;
  return 1;
};

export function estimateCpuGpuBalance(cpu, gpu) {
  const cTier = tierCpu(cpu);
  const gTier = tierGpu(gpu);
  if (!cTier || !gTier) return { balance: "unknown", notes: "Faltan datos" };
  if (cTier <= 1 && gTier >= 3) return { balance: "cpu_limited", notes: "CPU de gama baja con GPU exigente" };
  if (cTier >= 3 && gTier <= 1) return { balance: "gpu_limited", notes: "GPU de gama baja con CPU potente" };
  if (Math.abs(cTier - gTier) <= 1) return { balance: "balanced" };
  if (cTier < gTier) return { balance: "cpu_limited", notes: "CPU un nivel por debajo de la GPU" };
  return { balance: "gpu_limited", notes: "GPU un nivel por debajo de la CPU" };
}
