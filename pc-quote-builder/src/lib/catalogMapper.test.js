import { describe, expect, it } from "vitest";
import { buildTierMaps, mapProcessedToCatalog, resolveCatalogId } from "./catalogMapper";

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

  it("marks socket-inferred memory type as explicit for single-type sockets", () => {
    const mapped = mapProcessedToCatalog({
      mobos: [
        { id: "m1", name: "B650M", socket: "AM5", form_factor: "ATX" },
        { id: "m2", name: "B550", socket: "AM4", form_factor: "ATX" },
        { id: "m3", name: "H510M", socket: "LGA1200", form_factor: "Micro-ATX" },
      ],
    });
    expect(mapped.motherboards[0]).toMatchObject({ memoryType: "DDR5", memoryTypeExplicit: true });
    expect(mapped.motherboards[1]).toMatchObject({ memoryType: "DDR4", memoryTypeExplicit: true });
    expect(mapped.motherboards[2]).toMatchObject({ memoryType: "DDR4", memoryTypeExplicit: true });
  });

  it("marks name-inferred memory type as explicit (DDR2/DDR3/DDR4/DDR5)", () => {
    const mapped = mapProcessedToCatalog({
      mobos: [
        { id: "m1", name: "ASUS ROG STRIX Z790-A DDR5", socket: "LGA1700" },
        { id: "m2", name: "MSI PRO B760M-P DDR4", socket: "LGA1700" },
        { id: "m3", name: "Gigabyte GA-970A-DS3P DDR3", socket: "AM3" },
        { id: "m4", name: "ASRock 760GM DDR2", socket: "AM2" },
      ],
    });
    expect(mapped.motherboards[0]).toMatchObject({ memoryType: "DDR5", memoryTypeExplicit: true });
    expect(mapped.motherboards[1]).toMatchObject({ memoryType: "DDR4", memoryTypeExplicit: true });
    expect(mapped.motherboards[2]).toMatchObject({ memoryType: "DDR3", memoryTypeExplicit: true });
    expect(mapped.motherboards[3]).toMatchObject({ memoryType: "DDR2", memoryTypeExplicit: true });
  });

  it("keeps memory type unknown for dual-type sockets without name evidence", () => {
    const mapped = mapProcessedToCatalog({
      mobos: [{ id: "m1", name: "ASUS PRIME Z690-P", socket: "LGA1700", form_factor: "ATX" }],
    });
    expect(mapped.motherboards[0]).toMatchObject({ memoryType: "", memoryTypeExplicit: false });
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

  it("normaliza form factors canónicos del pipeline nuevo", () => {
    const mapped = mapProcessedToCatalog({
      cases: [{ id: "c1", name: "Case A", supported_mobo_form_factors: ["ATX", "Micro ATX", "Mini ITX"] }],
    });
    expect(mapped.pcCases[0].formFactors).toEqual(["ATX", "Micro ATX", "Mini ITX"]);
  });

  it("normaliza form factors legacy del pipeline anterior (ATX Mid → ATX/mATX/ITX)", () => {
    const mapped = mapProcessedToCatalog({
      cases: [{ id: "c1", name: "Case A", supported_mobo_form_factors: ["ATX Mid"] }],
    });
    expect(mapped.pcCases[0].formFactors).toEqual(["ATX", "Micro ATX", "Mini ITX"]);
  });

  it("normaliza MicroATX Mid legacy", () => {
    const mapped = mapProcessedToCatalog({
      cases: [{ id: "c1", name: "Case B", supported_mobo_form_factors: ["MicroATX Mid"] }],
    });
    expect(mapped.pcCases[0].formFactors).toEqual(["Micro ATX", "Mini ITX"]);
  });

  it("normaliza ATX Test Bench legacy", () => {
    const mapped = mapProcessedToCatalog({
      cases: [{ id: "c1", name: "Case C", supported_mobo_form_factors: ["ATX Test Bench"] }],
    });
    expect(mapped.pcCases[0].formFactors).toEqual(["ATX", "Micro ATX", "Mini ITX"]);
  });

  it("normaliza Mini ITX Desktop legacy", () => {
    const mapped = mapProcessedToCatalog({
      cases: [{ id: "c1", name: "Case D", supported_mobo_form_factors: ["Mini ITX Desktop"] }],
    });
    expect(mapped.pcCases[0].formFactors).toEqual(["Mini ITX"]);
  });

  it("normaliza HTPC legacy", () => {
    const mapped = mapProcessedToCatalog({
      cases: [{ id: "c1", name: "Case E", supported_mobo_form_factors: ["HTPC"] }],
    });
    expect(mapped.pcCases[0].formFactors).toEqual(["Micro ATX", "Mini ITX"]);
  });

  it("deja vacío si el legacy no tiene mapeo", () => {
    const mapped = mapProcessedToCatalog({
      cases: [{ id: "c1", name: "Case F", supported_mobo_form_factors: ["UnknownType"] }],
    });
    expect(mapped.pcCases[0].formFactors).toEqual(["UnknownType"]);
  });

  it("normaliza usando fallback UI-shaped formFactors cuando no hay supported_mobo_form_factors", () => {
    const mapped = mapProcessedToCatalog({
      pcCases: [{ id: "c1", name: "Case G", formFactors: ["ATX", "Micro ATX"] }],
    });
    expect(mapped.pcCases[0].formFactors).toEqual(["ATX", "Micro ATX"]);
  });

  it("prioriza caso nuevo sobre UI-shaped cuando ambos existen", () => {
    const mapped = mapProcessedToCatalog({
      cases: [{ id: "c1", name: "Case New", supported_mobo_form_factors: ["ATX Full"] }],
      pcCases: [{ id: "c2", name: "Case Old", formFactors: ["ITX"] }],
    });
    expect(mapped.pcCases).toHaveLength(1);
    expect(mapped.pcCases[0].id).toBe("c1");
    expect(mapped.pcCases[0].formFactors).toEqual(["E-ATX", "ATX", "Micro ATX", "Mini ITX"]);
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

  it("preserva evidencia compacta (sources/conflicts/qualityScore) en todas las categorías", () => {
    const mapped = mapProcessedToCatalog({
      cpus: [{ id: "cpu1", name: "Intel Core i5-13600K", memory_support: { types: ["DDR5"] }, tdp_w: 125, sources: { "buildcores-open-db": ["spec"] } }],
      mobos: [{ id: "m1", name: "Z790", socket: "LGA1700", memory_type: "DDR5", form_factor: "ATX", meta: { conflict_flags: ["memory_speed"], quality_score: 0.7 } }],
      ram: [{ id: "r1", name: "Corsair", type: "ddr5", speed_mts: 6000, meta: { conflict_flags: ["speed"] } }],
      gpus: [{ id: "g1", name: "RTX 4070", tdp_w: 200, meta: { quality_score: 0.9 } }],
      psus: [{ id: "p1", name: "Corsair 750", wattage_w: 750, sources: { dbgpu: ["spec"] } }],
      cases: [{ id: "c1", name: "NZXT H5", max_gpu_length_mm: 365, form_factor_evidence: "explicit", meta: { quality_score: 0.8 } }],
    });

    expect(mapped.cpus[0].evidence).toEqual({ sources: { "buildcores-open-db": ["spec"] }, conflicts: [], qualityScore: null });
    expect(mapped.motherboards[0].evidence).toEqual({ sources: {}, conflicts: ["memory_speed"], qualityScore: 0.7 });
    expect(mapped.ramKits[0].evidence).toEqual({ sources: {}, conflicts: ["speed"], qualityScore: null });
    expect(mapped.gpus[0].evidence).toEqual({ sources: {}, conflicts: [], qualityScore: 0.9 });
    expect(mapped.psus[0].evidence).toEqual({ sources: { dbgpu: ["spec"] }, conflicts: [], qualityScore: null });
    expect(mapped.pcCases[0].evidence).toEqual({ sources: {}, conflicts: [], qualityScore: 0.8 });
  });

  it("defaults evidencia ausente a vacíos/null, nunca valores optimistas", () => {
    const mapped = mapProcessedToCatalog({
      cpus: [{ id: "cpu1", name: "Intel i5" }],
      gpus: [{ id: "g1", name: "RTX 4060" }],
      cases: [{ id: "c1", name: "NZXT H5" }],
    });
    expect(mapped.cpus[0].evidence).toEqual({ sources: {}, conflicts: [], qualityScore: null });
    expect(mapped.gpus[0].evidence).toEqual({ sources: {}, conflicts: [], qualityScore: null });
    expect(mapped.pcCases[0].evidence).toEqual({ sources: {}, conflicts: [], qualityScore: null });
  });

  it("nunca pasa formas corruptas de evidencia (sources string, conflicts string, qualityScore string)", () => {
    const mapped = mapProcessedToCatalog({
      cpus: [
        {
          id: "cpu1",
          name: "Intel i5",
          sources: "pcpart",
          meta: { conflict_flags: "cpu_tdp_conflict", quality_score: "0.5" },
        },
      ],
      gpus: [{ id: "g1", name: "RTX 4060", sources: ["dbgpu"] }],
    });
    expect(mapped.cpus[0].evidence).toEqual({ sources: {}, conflicts: [], qualityScore: null });
    expect(mapped.gpus[0].evidence).toEqual({ sources: {}, conflicts: [], qualityScore: null });
  });

  it("no muta los items de entrada al construir evidencia", () => {
    const input = {
      cpus: [{ id: "cpu1", name: "Intel i5", sources: { x: ["y"] }, meta: { conflict_flags: ["a"], quality_score: 0.5 } }],
      cases: [{ id: "c1", name: "NZXT", form_factor_evidence: "explicit" }],
    };
    Object.freeze(input);
    Object.freeze(input.cpus);
    Object.freeze(input.cpus[0]);
    Object.freeze(input.cpus[0].meta);
    Object.freeze(input.cpus[0].sources);
    Object.freeze(input.cases);
    Object.freeze(input.cases[0]);

    const mapped = mapProcessedToCatalog(input);
    expect(mapped.cpus[0].evidence).toEqual({ sources: { x: ["y"] }, conflicts: ["a"], qualityScore: 0.5 });
    expect(mapped.pcCases[0].formFactorEvidence).toBe("explicit");
  });
});

describe("resolveCatalogId", () => {
  it("returns resolved id from aliases", () => {
    const aliases = { "cpu_old": "cpu_new" };
    expect(resolveCatalogId("cpu_old", aliases)).toBe("cpu_new");
  });

  it("returns original id when no alias found", () => {
    expect(resolveCatalogId("cpu_unknown", { "cpu_old": "cpu_new" })).toBe("cpu_unknown");
  });

  it("returns original id when aliases is null or undefined", () => {
    expect(resolveCatalogId("cpu_old", null)).toBe("cpu_old");
    expect(resolveCatalogId("cpu_old", undefined)).toBe("cpu_old");
  });

  it("returns original id when aliases is empty", () => {
    expect(resolveCatalogId("cpu_old", {})).toBe("cpu_old");
  });

  it("handles empty string oldId", () => {
    const aliases = { "cpu_old": "cpu_new" };
    expect(resolveCatalogId("", aliases)).toBe("");
  });

  it("resolves alias even when alias value is empty string", () => {
    const aliases = { "cpu_old": "" };
    expect(resolveCatalogId("cpu_old", aliases)).toBe("");
  });
});
