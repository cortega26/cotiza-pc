import { describe, expect, it } from "vitest";
import { buildTierMaps, mapProcessedToCatalog } from "./catalogMapper";

describe("catalogMapper", () => {
  it("normalizes processed data with inferred fields", () => {
    const mapped = mapProcessedToCatalog({
      cpus: [{ id: "cpu1", name: "Intel Core i5-13600K", memory_support: { types: ["DDR5"] }, tdp_w: 125 }],
      mobos: [{ id: "m1", name: "Z790 DDR5", socket: "LGA1700", memory_type: "ddr5", form_factor: "ATX" }],
      ram: [{ id: "r1", name: "Corsair Vengeance", type: "ddr5", speed_mts: 6000 }],
      gpus: [{ id: "g1", name: "RTX 4070", tdp_w: 200, board_length_mm: 300, recommended_psu_w: 650, power_connectors: "2x 8-pin" }],
      psus: [{ id: "p1", name: "Corsair 750W", wattage_w: 750, pcie_power_connectors: { "8_pin": 2, "6+2": 1 } }],
      cases: [{ id: "c1", name: "NZXT H5", max_gpu_length_mm: 365, supported_mobo_form_factors: ["ATX"] }],
    });

    expect(mapped.cpus[0]).toMatchObject({ brand: "Intel", socket: "LGA1700", memoryType: "DDR5", family: "Core i5", memoryTypeExplicit: true });
    expect(mapped.motherboards[0]).toMatchObject({ memoryType: "DDR5", formFactor: "ATX", memoryTypeExplicit: true });
    expect(mapped.ramKits[0]).toMatchObject({ type: "DDR5", speed: 6000 });
    expect(mapped.gpus[0]).toMatchObject({ psuMin: 650, powerConnectors: "2x 8-pin" });
    expect(mapped.psus[0].pcie_power_connectors["8_pin"]).toBe(2);
    expect(mapped.pcCases[0].formFactors).toContain("ATX");
  });

  it("respects local catalog memoryType fields (no DDR guesswork)", () => {
    const mapped = mapProcessedToCatalog({
      cpus: [{ id: "cpu1", name: "Intel Core i5-12400F", socket: "LGA1700", memoryType: "DDR4", tdp: 65 }],
    });
    expect(mapped.cpus[0]).toMatchObject({ socket: "LGA1700", memoryType: "DDR4", memoryTypeExplicit: true });
  });

  it("accepts UI-shaped keys (motherboards/ramKits/pcCases) as fallback", () => {
    const mapped = mapProcessedToCatalog({
      cpus: [{ id: "cpu1", name: "Intel i5", socket: "LGA1700", memoryType: "DDR4", tdp: 65 }],
      motherboards: [{ id: "m1", name: "B760", socket: "LGA1700", memoryType: "DDR4", formFactor: "ATX" }],
      ramKits: [{ id: "r1", name: "16 GB DDR4", type: "DDR4", speed: 3200 }],
      gpus: [{ id: "g1", name: "RTX 4060", tdp: 115, length: 250, psuMin: 450 }],
      psus: [{ id: "p1", name: "EVGA 550", wattage: 550, pcieCables: 2 }],
      pcCases: [{ id: "c1", name: "Meshify C", maxGpuLength: 315, formFactors: ["ATX"] }],
    });

    expect(mapped.cpus).toHaveLength(1);
    expect(mapped.motherboards).toHaveLength(1);
    expect(mapped.ramKits).toHaveLength(1);
    expect(mapped.gpus).toHaveLength(1);
    expect(mapped.psus).toHaveLength(1);
    expect(mapped.pcCases).toHaveLength(1);
    expect(mapped.motherboards[0]).toMatchObject({ socket: "LGA1700", memoryType: "DDR4", formFactor: "ATX" });
    expect(mapped.ramKits[0]).toMatchObject({ type: "DDR4", speed: 3200 });
  });

  it("maps motherboard memory-limit fields from processed data", () => {
    const mapped = mapProcessedToCatalog({
      mobos: [{ id: "m1", name: "Z790", socket: "LGA1700", memory_type: "DDR5", form_factor: "ATX", memory_slots: 4, max_memory_gb: 128, max_memory_speed_mts: 7200 }],
    });
    expect(mapped.motherboards[0].memory_slots).toBe(4);
    expect(mapped.motherboards[0].max_memory_gb).toBe(128);
    expect(mapped.motherboards[0].max_memory_speed_mts).toBe(7200);
  });

  it("maps motherboard memory-limit fields from camelCase local schema", () => {
    const mapped = mapProcessedToCatalog({
      motherboards: [{ id: "m1", name: "B550", socket: "AM4", memoryType: "DDR4", formFactor: "ATX", memorySlots: 2, maxMemoryGb: 64, maxMemorySpeed: 4400 }],
    });
    expect(mapped.motherboards[0].memory_slots).toBe(2);
    expect(mapped.motherboards[0].max_memory_gb).toBe(64);
    expect(mapped.motherboards[0].max_memory_speed_mts).toBe(4400);
  });

  it("maps RAM compatibility fields from processed data", () => {
    const mapped = mapProcessedToCatalog({
      ram: [{ id: "r1", name: "Corsair Vengeance", type: "DDR5", speed_mts: 6000, modules: 2, capacity_gb_total: 32 }],
    });
    expect(mapped.ramKits[0]).toMatchObject({ modules: 2, capacity_gb_total: 32, speed_mts: 6000, speed: 6000 });
  });

  it("maps RAM compatibility fields from local schema", () => {
    const mapped = mapProcessedToCatalog({
      ramKits: [{ id: "r1", name: "16 GB DDR4", type: "DDR4", speed: 3200 }],
    });
    expect(mapped.ramKits[0]).toMatchObject({ modules: null, capacity_gb_total: null, speed_mts: 3200, speed: 3200 });
  });

  it("builds tier maps from compatibility meta", () => {
    const tiers = buildTierMaps({ tiers: { cpu: [{ id: "c1", tier: 2 }], gpu: [{ id: "g1", tier: 3 }] } });
    expect(tiers.cpu.get("c1")).toBe(2);
    expect(tiers.gpu.get("g1")).toBe(3);
  });

  it("returns empty arrays for empty input", () => {
    const mapped = mapProcessedToCatalog({});
    expect(mapped.cpus).toEqual([]);
    expect(mapped.motherboards).toEqual([]);
    expect(mapped.ramKits).toEqual([]);
    expect(mapped.gpus).toEqual([]);
    expect(mapped.psus).toEqual([]);
    expect(mapped.pcCases).toEqual([]);
  });

  it("returns empty arrays for null input", () => {
    const mapped = mapProcessedToCatalog(null);
    expect(mapped.cpus).toEqual([]);
    expect(mapped.motherboards).toEqual([]);
    expect(mapped.ramKits).toEqual([]);
  });

  it("handles undefined argument", () => {
    const mapped = mapProcessedToCatalog();
    expect(mapped.cpus).toEqual([]);
    expect(mapped.motherboards).toEqual([]);
    expect(mapped.ramKits).toEqual([]);
  });

  it("prioritizes processed keys over UI-shaped keys when both present", () => {
    const mapped = mapProcessedToCatalog({
      mobos: [{ id: "m1", name: "Z790", socket: "LGA1700", memory_type: "DDR5", form_factor: "ATX" }],
      motherboards: [{ id: "m2", name: "B760", socket: "LGA1700", memoryType: "DDR4", formFactor: "mATX" }],
      ram: [{ id: "r1", name: "DDR5 kit", type: "DDR5", speed_mts: 6000 }],
      ramKits: [{ id: "r2", name: "DDR4 kit", type: "DDR4", speed: 3200 }],
      cases: [{ id: "c1", name: "Case A", max_gpu_length_mm: 365, supported_mobo_form_factors: ["ATX"] }],
      pcCases: [{ id: "c2", name: "Case B", maxGpuLength: 315, formFactors: ["ITX"] }],
    });
    expect(mapped.motherboards).toHaveLength(1);
    expect(mapped.motherboards[0].id).toBe("m1");
    expect(mapped.motherboards[0].memoryType).toBe("DDR5");
    expect(mapped.ramKits).toHaveLength(1);
    expect(mapped.ramKits[0].id).toBe("r1");
    expect(mapped.pcCases).toHaveLength(1);
    expect(mapped.pcCases[0].id).toBe("c1");
  });

  it("handles items with partial missing fields without crashing", () => {
    const mapped = mapProcessedToCatalog({
      cpus: [{ id: "cpu1" }],
      mobos: [{ id: "m1" }],
      ram: [{ id: "r1" }],
      gpus: [{ id: "g1" }],
      psus: [{ id: "p1" }],
      cases: [{ id: "c1" }],
    });
    expect(mapped.cpus[0].id).toBe("cpu1");
    expect(mapped.motherboards[0].id).toBe("m1");
    expect(mapped.motherboards[0].memory_slots).toBeNull();
    expect(mapped.motherboards[0].max_memory_gb).toBeNull();
    expect(mapped.motherboards[0].max_memory_speed_mts).toBeNull();
    expect(mapped.ramKits[0].id).toBe("r1");
    expect(mapped.ramKits[0].speed).toBeNull();
    expect(mapped.gpus[0].id).toBe("g1");
    expect(mapped.gpus[0].tdp).toBeNull();
    expect(mapped.psus[0].id).toBe("p1");
    expect(mapped.psus[0].wattage).toBeNull();
    expect(mapped.pcCases[0].id).toBe("c1");
    expect(mapped.pcCases[0].maxGpuLength).toBeNull();
  });
});
