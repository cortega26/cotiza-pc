// Funciones de compatibilidad y potencia. Pensadas para usar con los JSON procesados.

const toNumber = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Estima consumo y PSU mínima. Devuelve `null` en vez de inventar números
 * cuando falta el TDP del CPU o de la GPU; en ese caso solo puede caer al
 * `suggested_psu_w` del fabricante.
 */
export function estimatePowerEnvelope(cpu, gpu, extraHeadroomW = 50) {
  const cpuTdp = toNumber(cpu?.tdp_w ?? cpu?.tdp);
  const gpuTdp = toNumber(gpu?.tdp_w ?? gpu?.tdp);
  const suggestedByGpu = toNumber(gpu?.suggested_psu_w);
  const hasTdp = cpuTdp !== null && gpuTdp !== null;
  const estimated_load_w = hasTdp ? cpuTdp + gpuTdp + extraHeadroomW : null;
  const computedRaw = hasTdp ? estimated_load_w * 1.3 + 50 : null;
  const recommendedRaw = hasTdp ? Math.max(computedRaw, suggestedByGpu || 0) : suggestedByGpu;
  const recommended_min_psu_w =
    recommendedRaw == null ? null : Math.ceil(recommendedRaw / 50) * 50;
  return { estimated_load_w, recommended_min_psu_w };
}

export function checkCpuMoboCompatibility(cpu, mobo) {
  if (!cpu || !mobo) return { compatible: false, status: "unknown", reason: "Faltan datos" };
  if (!cpu.socket || !mobo.socket) {
    return { compatible: false, status: "unknown", reason: "No se pudo validar compatibilidad de socket; faltan datos" };
  }
  const socketOk = cpu.socket === mobo.socket;
  const memoryOk =
    (mobo.memory_type || mobo.memoryType) && Array.isArray(cpu.memory_support?.types)
      ? cpu.memory_support.types.includes(mobo.memory_type || mobo.memoryType)
      : true;
  if (!socketOk) return { compatible: false, status: "fail", reason: "Socket distinto" };
  if (!memoryOk) return { compatible: false, status: "fail", reason: "Tipo de RAM no coincide" };
  return { compatible: true, status: "ok" };
}

export function checkRamMoboCompatibility(ram, mobo) {
  if (!ram || !mobo) return { compatible: false, status: "unknown", reason: "Faltan datos" };
  const moboMemory = mobo.memory_type || mobo.memoryType;
  if (ram.type && moboMemory && ram.type !== moboMemory) {
    return { compatible: false, status: "fail", reason: "Tipo de RAM no coincide" };
  }
  if (mobo.memory_slots && ram.modules && ram.modules > mobo.memory_slots) {
    return { compatible: false, status: "fail", reason: "Excede número de slots" };
  }
  if ((mobo.max_memory_gb || mobo.maxMemoryGb) && ram.capacity_gb_total && ram.capacity_gb_total > (mobo.max_memory_gb || mobo.maxMemoryGb)) {
    return { compatible: false, status: "fail", reason: "Excede capacidad máxima" };
  }
  if ((mobo.max_memory_speed_mts || mobo.maxMemorySpeedMts) && ram.speed_mts && ram.speed_mts > (mobo.max_memory_speed_mts || mobo.maxMemorySpeedMts)) {
    return { compatible: true, status: "warning", reason: "RAM sobre el máximo oficial; puede requerir ajuste/XMP" };
  }
  return { compatible: true, status: "ok" };
}

export function checkMoboCaseCompatibility(mobo, pcCase) {
  if (!mobo || !pcCase) return { compatible: false, status: "unknown", reason: "Faltan datos" };
  const formFactor = mobo.form_factor || mobo.formFactor;
  const supported = pcCase.supported_mobo_form_factors || pcCase.formFactors;
  if (!formFactor || !Array.isArray(supported) || supported.length === 0) {
    return { compatible: false, status: "unknown", reason: "Faltan datos" };
  }
  const ok =
    Array.isArray(supported) &&
    supported.includes(formFactor);
  return ok ? { compatible: true, status: "ok" } : { compatible: false, status: "fail", reason: "Factor de forma no soportado" };
}

export function checkGpuCaseCompatibility(gpu, pcCase) {
  if (!gpu || !pcCase) return { compatible: false, status: "unknown", reason: "Faltan datos" };
  const gpuLength = gpu.board_length_mm ?? gpu.length;
  const maxLength = pcCase.max_gpu_length_mm ?? pcCase.maxGpuLength;
  if (!gpuLength || !maxLength) return { compatible: false, status: "unknown", reason: "Faltan datos" };
  const ok = gpuLength <= maxLength;
  return ok ? { compatible: true, status: "ok" } : { compatible: false, status: "fail", reason: "La GPU no cabe en el gabinete" };
}

export function checkPsuPowerSufficiency(psu, cpu, gpu, extraHeadroomW = 50) {
  if (!psu || !cpu || !gpu) return { status: "unknown", reason: "Faltan datos" };
  const { estimated_load_w, recommended_min_psu_w } = estimatePowerEnvelope(cpu, gpu, extraHeadroomW);
  const wattage = toNumber(psu.wattage_w ?? psu.wattage);
  if (!wattage) return { status: "unknown", reason: "PSU sin wattage" };
  if (estimated_load_w == null) {
    return { status: "unknown", reason: "Faltan datos de consumo (TDP) para estimar la fuente" };
  }
  if (wattage >= recommended_min_psu_w) return { status: "ok", estimated_load_w, recommended_min_psu_w };
  if (wattage >= estimated_load_w)
    return { status: "warning", estimated_load_w, recommended_min_psu_w, reason: "Poco margen" };
  return { status: "fail", estimated_load_w, recommended_min_psu_w, reason: "PSU insuficiente" };
}

/**
 * Verifica los cables PCIe de la PSU contra el requerimiento de la GPU.
 * Reconoce 12VHPWR/16-pin, 8-pin y 6-pin; un token no reconocido queda
 * como `unknown` y nunca como `ok`.
 */
export function checkPsuConnectors(psu, gpu) {
  if (!psu || !gpu) return { status: "unknown", reason: "Faltan datos" };
  const connectors = psu.pcie_power_connectors || {};
  const knownConnectorData = Object.keys(connectors).length > 0;
  const needRaw = (typeof gpu.power_connectors === "string" ? gpu.power_connectors : "").toLowerCase();
  if (!knownConnectorData) return { status: "unknown", reason: "PSU sin datos de conectores" };
  if (!needRaw) return { status: "unknown", reason: "GPU sin datos de conectores" };

  const stripRequirement = (text, pattern) => {
    let required = 0;
    const rest = text.replace(pattern, (_match, count) => {
      const parsed = parseInt(count, 10);
      required += Number.isFinite(parsed) ? parsed : 1;
      return " ";
    });
    return { required, rest };
  };

  const twelve = stripRequirement(needRaw, /(\d+)?\s*x?\s*(?:12vhpwr|16-pin)/g);
  const eight = stripRequirement(twelve.rest, /(\d+)?\s*x?\s*8-pin/g);
  const six = stripRequirement(eight.rest, /(\d+)?\s*x?\s*6-pin/g);

  if (twelve.required > 0 && (connectors["12vhpwr"] || 0) < twelve.required) {
    return { status: "fail", reason: "Falta 12VHPWR/16-pin" };
  }

  const pciePool = (connectors["8_pin"] || 0) + (connectors["6+2"] || 0);
  if (eight.required + six.required > pciePool) {
    return { status: "fail", reason: "Faltan cables PCIe" };
  }

  const residue = six.rest.replace(/[\s,;/|+]+/g, "");
  if (residue) {
    return { status: "unknown", reason: `Conectores de GPU no reconocidos: ${residue}` };
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
