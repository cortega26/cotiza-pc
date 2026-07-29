export const cpuIntel = {
  id: "cpu-1", name: "Intel Core i5-13600K", brand: "Intel", family: "Core i5",
  socket: "LGA1700", memoryType: "DDR5", memoryTypeExplicit: true, tdp: 125, tdp_w: 125,
};
export const cpuAmd = {
  id: "cpu-2", name: "AMD Ryzen 5 7600", brand: "AMD", family: "Ryzen 5",
  socket: "AM5", memoryType: "DDR5", memoryTypeExplicit: true, tdp: 65, tdp_w: 65,
};
export const cpuIntelHigh = {
  id: "cpu-3", name: "Intel Core i7-14700K", brand: "Intel", family: "Core i7",
  socket: "LGA1700", memoryType: "DDR5", memoryTypeExplicit: true, tdp: 125, tdp_w: 125,
};

export const moboLga = {
  id: "mobo-1", name: "ASUS Z790-P", socket: "LGA1700", formFactor: "ATX",
  memoryType: "DDR5", memoryTypeExplicit: true,
};
export const moboAm5 = {
  id: "mobo-2", name: "Gigabyte B650M", socket: "AM5", formFactor: "Micro-ATX",
  memoryType: "DDR5", memoryTypeExplicit: true,
};
export const moboLgaAlt = {
  id: "mobo-3", name: "MSI PRO Z690-A", socket: "LGA1700", formFactor: "ATX",
  memoryType: "DDR5", memoryTypeExplicit: true,
};

export const ramDdr5_1 = { id: "ram-1", name: "Corsair Vengeance 32GB", type: "DDR5", speed: 5600, speed_mts: 5600 };
export const ramDdr5_2 = { id: "ram-2", name: "G.Skill Trident Z5 16GB", type: "DDR5", speed: 6000, speed_mts: 6000 };

export const gpuLow = {
  id: "gpu-1", name: "NVIDIA GeForce RTX 4060", tdp: 115, tdp_w: 115,
  length: 240, psuMin: 450, power_connectors: "1x 8-pin",
};
export const gpuHigh = {
  id: "gpu-2", name: "AMD Radeon RX 7800 XT", tdp: 263, tdp_w: 263,
  length: 290, psuMin: 650, power_connectors: "2x 8-pin",
};

export const psu750 = {
  id: "psu-1", name: "Corsair RM750x", wattage: 750, wattage_w: 750,
  pcieCables: 2, pcie_power_connectors: { "8_pin": 2 },
};
export const psu500 = {
  id: "psu-2", name: "EVGA 500W", wattage: 500, wattage_w: 500,
  pcieCables: 1, pcie_power_connectors: { "8_pin": 1 },
};

export const caseAtx = {
  id: "case-1", name: "NZXT H510 Flow", maxGpuLength: 350, formFactors: ["ATX", "Micro-ATX"],
};
export const caseItx = {
  id: "case-2", name: "Cooler Master NR200", maxGpuLength: 330, formFactors: ["Mini-ITX"],
};

export function buildDefaultCatalog() {
  return { cpus: [], motherboards: [], ramKits: [], gpus: [], psus: [], pcCases: [] };
}

export function buildRichCatalog() {
  return {
    cpus: [cpuIntel, cpuAmd, cpuIntelHigh],
    motherboards: [moboLga, moboAm5, moboLgaAlt],
    ramKits: [ramDdr5_1, ramDdr5_2],
    gpus: [gpuLow, gpuHigh],
    psus: [psu750, psu500],
    pcCases: [caseAtx, caseItx],
    meta: { generatedAt: "2026-07-29T00:00:00.000Z" },
  };
}

export function buildDefaultTierMaps() {
  return { cpu: new Map(), gpu: new Map() };
}

export function buildRichTierMaps() {
  return {
    cpu: new Map([["cpu-1", "A"], ["cpu-2", "B"], ["cpu-3", "S"]]),
    gpu: new Map([["gpu-1", "C"], ["gpu-2", "A"]]),
  };
}

export function buildCompatMeta() {
  return {
    generatedAt: "2026-07-29T00:00:00.000Z",
    schemaVersion: 2,
    tiers: {
      cpu: [
        { id: "cpu-1", tier: "A" }, { id: "cpu-2", tier: "B" }, { id: "cpu-3", tier: "S" },
      ],
      gpu: [
        { id: "gpu-1", tier: "C" }, { id: "gpu-2", tier: "A" },
      ],
    },
    provenance: {
      sources: {
        buildcores: { sha: "abcd1234abcd1234abcd1234abcd1234abcd1234" },
        pcpart: { sha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef" },
        dbgpu: { version: "1.2.3" },
      },
    },
  };
}
