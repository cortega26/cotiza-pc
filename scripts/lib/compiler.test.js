import { describe, expect, it } from "vitest";
import {
  computeTierCpu,
  computeTierGpu,
  byNormalizedKey,
  mergeGrouped,
  range,
  mergeCpu,
  mergeGpu,
  mergeMobo,
  mergePsu,
  mergeCase,
  mergeRam,
  mergeCooler,
  mergeFan,
  computeCompatibilityMeta,
  canonicalizeFormFactors,
  SOURCE_TAGS,
} from "./compiler.js";

describe("computeTierCpu", () => {
  it("returns 4 for high-core-count CPUs with high boost", () => {
    expect(computeTierCpu({ cores: 12, boost_clock_ghz: 4.5 })).toBe(4);
    expect(computeTierCpu({ cores: 16, boost_clock_ghz: 5.0 })).toBe(4);
  });

  it("returns 3 for 8+ cores with boost >= 4.2", () => {
    expect(computeTierCpu({ cores: 8, boost_clock_ghz: 4.2 })).toBe(3);
    expect(computeTierCpu({ cores: 10, boost_clock_ghz: 4.0 })).toBe(2);
  });

  it("returns 2 for 6+ cores", () => {
    expect(computeTierCpu({ cores: 6, boost_clock_ghz: 4.0 })).toBe(2);
  });

  it("returns 1 for low-end CPUs", () => {
    expect(computeTierCpu({ cores: 4, boost_clock_ghz: 3.5 })).toBe(1);
    expect(computeTierCpu({ cores: 0, boost_clock_ghz: 0 })).toBe(1);
  });

  it("handles missing fields gracefully", () => {
    expect(computeTierCpu({})).toBe(1);
  });
});

describe("computeTierGpu", () => {
  it("returns 4 for high TDP or VRAM", () => {
    expect(computeTierGpu({ tdp_w: 250, vram_gb: 8 })).toBe(4);
    expect(computeTierGpu({ tdp_w: 200, vram_gb: 12 })).toBe(4);
  });

  it("returns 3 for mid-high GPUs", () => {
    expect(computeTierGpu({ tdp_w: 180, vram_gb: 8 })).toBe(3);
    expect(computeTierGpu({ tdp_w: 150, vram_gb: 10 })).toBe(3);
  });

  it("returns 2 for mid-range", () => {
    expect(computeTierGpu({ tdp_w: 120, vram_gb: 6 })).toBe(2);
    expect(computeTierGpu({ tdp_w: 100, vram_gb: 8 })).toBe(2);
  });

  it("returns 1 for entry-level", () => {
    expect(computeTierGpu({ tdp_w: 75, vram_gb: 4 })).toBe(1);
    expect(computeTierGpu({})).toBe(1);
  });
});

describe("byNormalizedKey", () => {
  it("groups items by normalized_key", () => {
    const items = [
      { normalized_key: "a", id: 1 },
      { normalized_key: "b", id: 2 },
      { normalized_key: "a", id: 3 },
    ];
    const grouped = byNormalizedKey(items);
    expect(Object.keys(grouped).sort()).toEqual(["a", "b"]);
    expect(grouped.a).toHaveLength(2);
    expect(grouped.b).toHaveLength(1);
  });

  it("skips items without normalized_key", () => {
    const items = [{ id: 1 }, { normalized_key: "a", id: 2 }];
    const grouped = byNormalizedKey(items);
    expect(Object.keys(grouped)).toEqual(["a"]);
  });

  it("returns empty object for empty list", () => {
    expect(byNormalizedKey([])).toEqual({});
  });
});

describe("mergeGrouped", () => {
  const dummyMerge = (records) => (records.length ? { id: records[0].id, count: records.length } : null);

  it("groups and merges items", () => {
    const items = [
      { id: "x", normalized_key: "a" },
      { id: "y", normalized_key: "b" },
      { id: "z", normalized_key: "a" },
    ];
    const result = mergeGrouped(items, dummyMerge);
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.id === "x")?.count).toBe(2);
    expect(result.find((r) => r.id === "y")?.count).toBe(1);
  });

  it("filters out nulls from merge", () => {
    const maybeNull = (records) => (records.length ? { id: records[0].id } : null);
    expect(mergeGrouped([{ id: "a", normalized_key: "k" }], maybeNull)).toHaveLength(1);
    expect(mergeGrouped([], maybeNull)).toHaveLength(0);
  });
});

describe("range", () => {
  it("computes min/max of numeric fields", () => {
    const items = [{ v: 10 }, { v: 20 }, { v: 5 }, { v: 15 }];
    expect(range(items, "v")).toEqual({ min: 5, max: 20 });
  });

  it("ignores undefined values; safeNumber(null) returns 0 per existing semantics", () => {
    const items = [{ v: 10 }, { v: null }, {}, { v: 30 }];
    expect(range(items, "v")).toEqual({ min: 0, max: 30 });
  });

  it("returns null for empty list or no values", () => {
    expect(range([], "v")).toBe(null);
    expect(range([{}, {}], "v")).toBe(null);
  });
});

describe("mergeCpu", () => {
  const bcCpu = {
    source: "buildcores",
    category: "cpu",
    id: "bc-1",
    brand: "AMD",
    model: "Ryzen 5 5600",
    socket: "AM4",
    tdp_w: 65,
    cores: 6,
    threads: 12,
    base_clock_ghz: 3.5,
    boost_clock_ghz: 4.4,
    memory_support: { types: ["DDR4"], max_speed_mts: 3200 },
    normalized_key: "amd ryzen 5 5600",
  };

  const pcCpu = {
    source: "pcpart",
    category: "cpu",
    id: "pc-1",
    brand: "AMD",
    model: "Ryzen 5 5600",
    socket: "AM4",
    tdp_w: 65,
    cores: 6,
    threads: 12,
    base_clock_ghz: 3.5,
    boost_clock_ghz: 4.4,
    memory_type: "DDR4",
    normalized_key: "amd ryzen 5 5600",
  };

  it("merges single source", () => {
    const result = mergeCpu([pcCpu]);
    expect(result).not.toBeNull();
    expect(result.id).toMatch(/^cpu_/);
    expect(result.name).toBe("AMD Ryzen 5 5600");
    expect(result.cores).toBe(6);
  });

  it("prefers buildcores over pcpart (first source wins in pick)", () => {
    const bcAlt = { ...bcCpu, tdp_w: 70 };
    const result = mergeCpu([bcAlt, pcCpu]);
    expect(result.cores).toBe(6);
  });

  it("flags tdp conflict when difference > 5W", () => {
    const bcAlt = { ...bcCpu, tdp_w: 100 };
    const result = mergeCpu([bcAlt, pcCpu]);
    expect(result.meta.conflict_flags).toContain("cpu_tdp_conflict");
  });

  it("does not flag tdp conflict when difference <= 5W", () => {
    const bcAlt = { ...bcCpu, tdp_w: 68 };
    const result = mergeCpu([bcAlt, pcCpu]);
    expect(result.meta.conflict_flags).toEqual([]);
  });

  it("sets quality_score 0.9 for multi-source", () => {
    const result = mergeCpu([bcCpu, pcCpu]);
    expect(result.meta.quality_score).toBe(0.9);
  });

  it("sets quality_score 0.8 for single source", () => {
    const result = mergeCpu([pcCpu]);
    expect(result.meta.quality_score).toBe(0.8);
  });

  it("returns null for empty records", () => {
    expect(mergeCpu([])).toBe(null);
  });
});

describe("mergeGpu", () => {
  const dbGpu = {
    source: "dbgpu",
    category: "gpu",
    id: "db-1",
    brand: "NVIDIA",
    model: "RTX 4060",
    chipset: "RTX 4060",
    vram_gb: 8,
    tdp_w: 115,
    suggested_psu_w: 450,
    board_length_mm: 250,
    normalized_key: "nvidia rtx 4060",
  };

  const pcGpu = {
    source: "pcpart",
    category: "gpu",
    id: "pc-1",
    brand: "NVIDIA",
    model: "RTX 4060",
    chipset: "RTX 4060",
    vram_gb: 8,
    tdp_w: 115,
    suggested_psu_w: 450,
    board_length_mm: 250,
    normalized_key: "nvidia rtx 4060",
  };

  it("merges single source", () => {
    const result = mergeGpu([pcGpu]);
    expect(result).not.toBeNull();
    expect(result.id).toMatch(/^gpu_/);
  });

  it("prefers dbgpu over pcpart when both exist", () => {
    const dbAlt = { ...dbGpu, vram_gb: 12 };
    const result = mergeGpu([dbAlt, pcGpu]);
    expect(result.vram_gb).toBe(12);
  });

  it("computes recommended_psu_w", () => {
    const result = mergeGpu([dbGpu]);
    expect(result.recommended_psu_w).toBeGreaterThan(0);
  });

  it("flags gpu_tdp_conflict", () => {
    const dbAlt = { ...dbGpu, tdp_w: 200 };
    const result = mergeGpu([dbAlt, pcGpu]);
    expect(result.meta.conflict_flags).toContain("gpu_tdp_conflict");
  });

  it("returns null for empty", () => {
    expect(mergeGpu([])).toBe(null);
  });
});

describe("mergeMobo", () => {
  it("produces a canonical motherboard record", () => {
    const result = mergeMobo([
      { source: "pcpart", brand: "ASUS", model: "B550", socket: "AM4", form_factor: "ATX", memory_type: "DDR4", memory_slots: 4, normalized_key: "asus b550" },
    ]);
    expect(result.id).toMatch(/^mobo_/);
    expect(result.category).toBe("motherboard");
    expect(result.socket).toBe("AM4");
    expect(result.meta.created_from).toEqual(["pcpart"]);
  });

  it("returns null for empty", () => {
    expect(mergeMobo([])).toBe(null);
  });
});

describe("mergePsu", () => {
  it("produces a canonical PSU record", () => {
    const result = mergePsu([
      { source: "pcpart", brand: "Corsair", model: "RM650x", wattage_w: 650, form_factor: "ATX", normalized_key: "corsair rm650x" },
    ]);
    expect(result.id).toMatch(/^psu_/);
    expect(result.wattage_w).toBe(650);
    expect(result.form_factor).toBe("ATX");
  });
});

describe("canonicalizeFormFactors", () => {
  it("maps ATX Mid Tower to ATX + smaller", () => {
    const { formFactors, evidence } = canonicalizeFormFactors("ATX Mid Tower");
    expect(formFactors).toContain("ATX");
    expect(formFactors).toContain("Micro ATX");
    expect(formFactors).toContain("Mini ITX");
    expect(evidence).toBe("inferred");
  });

  it("maps ATX Full Tower to E-ATX + all smaller", () => {
    const { formFactors } = canonicalizeFormFactors("ATX Full Tower");
    expect(formFactors).toEqual(["E-ATX", "ATX", "Micro ATX", "Mini ITX"]);
  });

  it("maps MicroATX to Micro ATX + Mini ITX", () => {
    const { formFactors } = canonicalizeFormFactors("MicroATX Mini Tower");
    expect(formFactors).toEqual(["Micro ATX", "Mini ITX"]);
  });

  it("maps Mini ITX to Mini ITX only", () => {
    const { formFactors } = canonicalizeFormFactors("Mini ITX Tower");
    expect(formFactors).toEqual(["Mini ITX"]);
  });

  it("returns unknown for unrecognized chassis types", () => {
    const { formFactors, evidence } = canonicalizeFormFactors("HTPC Slim");
    expect(formFactors).toEqual([]);
    expect(evidence).toBe("unknown");
  });

  it("returns unknown for empty/null/undefined", () => {
    expect(canonicalizeFormFactors("").evidence).toBe("unknown");
    expect(canonicalizeFormFactors(null).evidence).toBe("unknown");
    expect(canonicalizeFormFactors(undefined).evidence).toBe("unknown");
  });

  it("maps ATX Slim to ATX + smaller", () => {
    const { formFactors } = canonicalizeFormFactors("ATX Slim");
    expect(formFactors).toContain("ATX");
  });

  it("maps ATX Desktop to ATX + smaller", () => {
    const { formFactors } = canonicalizeFormFactors("ATX Desktop");
    expect(formFactors).toContain("ATX");
  });
});

describe("mergeCase", () => {
  it("canonicalizes form factors from chassis_type", () => {
    const result = mergeCase([
      { source: "pcpart", brand: "Fractal", model: "Meshify C", chassis_type: "ATX Mid Tower", max_gpu_length_mm: 315, normalized_key: "fractal meshify c" },
    ]);
    expect(result.id).toMatch(/^case_/);
    expect(result.chassis_type).toBe("ATX Mid Tower");
    expect(result.supported_mobo_form_factors).toContain("ATX");
    expect(result.form_factor_evidence).toBe("inferred");
  });

  it("returns null for empty", () => {
    expect(mergeCase([])).toBe(null);
  });

  it("handles missing chassis_type gracefully", () => {
    const result = mergeCase([
      { source: "pcpart", brand: "Corsair", model: "4000D", max_gpu_length_mm: 360, normalized_key: "corsair 4000d" },
    ]);
    expect(result.chassis_type).toBe("");
    expect(result.supported_mobo_form_factors).toEqual([]);
    expect(result.form_factor_evidence).toBe("unknown");
  });

  it("handles null chassis_type gracefully", () => {
    const result = mergeCase([
      { source: "pcpart", brand: "NZXT", model: "H510", chassis_type: null, normalized_key: "nzxt h510" },
    ]);
    expect(result.chassis_type).toBe("");
    expect(result.supported_mobo_form_factors).toEqual([]);
    expect(result.form_factor_evidence).toBe("unknown");
  });
});

describe("mergeRam", () => {
  it("produces a canonical RAM record", () => {
    const result = mergeRam([
      { source: "pcpart", brand: "Corsair", model: "Vengeance LPX", type: "DDR4", speed_mts: 3200, normalized_key: "corsair vengeance lpx" },
    ]);
    expect(result.id).toMatch(/^ram_/);
    expect(result.type).toBe("DDR4");
    expect(result.speed_mts).toBe(3200);
  });
});

describe("mergeCooler", () => {
  it("produces a canonical cooler record", () => {
    const result = mergeCooler([
      { source: "pcpart", brand: "Noctua", model: "NH-D15", fan_rpm: 1200, size_mm: 165, normalized_key: "noctua nh d15" },
    ]);
    expect(result.id).toMatch(/^cooler_/);
    expect(result.type).toBe("air");
  });
});

describe("mergeFan", () => {
  it("produces a canonical fan record with pwm boolean", () => {
    const result = mergeFan([
      { source: "pcpart", brand: "Noctua", model: "NF-A12x25", size_mm: 120, rpm: 2000, pwm: 1, normalized_key: "noctua nf a12x25" },
    ]);
    expect(result.id).toMatch(/^fan_/);
    expect(result.pwm).toBe(true);
  });
});

describe("computeCompatibilityMeta", () => {
  const makeItem = (id, overrides = {}) => ({
    id,
    tdp_w: 65,
    boost_clock_ghz: 4.0,
    cores: 6,
    vram_gb: 8,
    board_length_mm: 250,
    speed_mts: 3200,
    wattage_w: 650,
    size_mm: 120,
    ...overrides,
  });

  it("produces expected shape with counts and ranges", () => {
    const meta = computeCompatibilityMeta({
      mergedCpus: [makeItem("cpu_a", { tdp_w: 65 }), makeItem("cpu_b", { tdp_w: 125 })],
      mergedGpus: [makeItem("gpu_a", { tdp_w: 115, board_length_mm: 250, vram_gb: 8 })],
      mergedMobos: [{ id: "mobo_a", socket: "AM4" }],
      mergedPsus: [makeItem("psu_a", { wattage_w: 650 })],
      mergedCases: [{ id: "case_a", supported_mobo_form_factors: ["ATX"] }],
      mergedRam: [makeItem("ram_a", { speed_mts: 3200 })],
      mergedCoolers: [makeItem("cooler_a", { size_mm: 160 })],
      mergedFans: [makeItem("fan_a", { size_mm: 120 })],
      provenance: null,
    });

    expect(meta.schemaVersion).toBe(1);
    expect(meta.counts.cpus).toBe(2);
    expect(meta.counts.gpus).toBe(1);
    expect(meta.ranges.cpu_tdp_w).toEqual({ min: 65, max: 125 });
    expect(meta.ranges.gpu_tdp_w).toEqual({ min: 115, max: 115 });
    expect(Array.isArray(meta.tiers.cpu)).toBe(true);
    expect(meta.tiers.cpu).toHaveLength(2);
    expect(meta.tiers.gpu).toHaveLength(1);
    expect(meta.sockets).toEqual({ AM4: { mobos: 1, cpus: 0 } });
    expect(meta.form_factors).toEqual({ ATX: { cases: 1, mobos: 0 } });
  });

  it("propagates provenance through to output", () => {
    const provenance = { source: "test", updatedAt: "2026-07-30" };
    const meta = computeCompatibilityMeta({
      mergedCpus: [makeItem("cpu_a")],
      mergedGpus: [],
      mergedMobos: [],
      mergedPsus: [],
      mergedCases: [],
      mergedRam: [],
      mergedCoolers: [],
      mergedFans: [],
      provenance,
    });
    expect(meta.provenance).toEqual(provenance);
  });

  it("sets provenance to null when not provided", () => {
    const meta = computeCompatibilityMeta({
      mergedCpus: [],
      mergedGpus: [],
      mergedMobos: [],
      mergedPsus: [],
      mergedCases: [],
      mergedRam: [],
      mergedCoolers: [],
      mergedFans: [],
    });
    expect(meta.provenance).toBe(null);
  });

  it("handles empty datasets", () => {
    const meta = computeCompatibilityMeta({
      mergedCpus: [],
      mergedGpus: [],
      mergedMobos: [],
      mergedPsus: [],
      mergedCases: [],
      mergedRam: [],
      mergedCoolers: [],
      mergedFans: [],
      provenance: null,
    });

    expect(meta.counts.cpus).toBe(0);
    expect(meta.ranges.cpu_tdp_w).toBe(null);
    expect(meta.tiers.cpu).toEqual([]);
    expect(meta.sockets).toEqual({});
    expect(meta.form_factors).toEqual({});
  });
});
