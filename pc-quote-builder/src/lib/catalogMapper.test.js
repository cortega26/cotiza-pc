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

    expect(mapped.cpus[0]).toMatchObject({ brand: "Intel", socket: "LGA1700", memoryType: "DDR5", family: "Core i5" });
    expect(mapped.motherboards[0]).toMatchObject({ memoryType: "DDR5", formFactor: "ATX" });
    expect(mapped.ramKits[0]).toMatchObject({ type: "DDR5", speed: 6000 });
    expect(mapped.gpus[0]).toMatchObject({ psuMin: 650, powerConnectors: "2x 8-pin" });
    expect(mapped.psus[0].pcie_power_connectors["8_pin"]).toBe(2);
    expect(mapped.pcCases[0].formFactors).toContain("ATX");
  });

  it("builds tier maps from compatibility meta", () => {
    const tiers = buildTierMaps({ tiers: { cpu: [{ id: "c1", tier: 2 }], gpu: [{ id: "g1", tier: 3 }] } });
    expect(tiers.cpu.get("c1")).toBe(2);
    expect(tiers.gpu.get("g1")).toBe(3);
  });
});
