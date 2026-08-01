/**
 * Assessment coverage manifest tests (Plan 030).
 *
 * Covers: the rule registry (Step 1), deterministic aggregate computation
 * (Step 2): complete, sparse, inferred, conflicting, empty, not-applicable,
 * deterministic-ordering, invalid-count, and duplicate-ID fixtures.
 */
import { describe, it, expect } from "vitest";
import {
  ASSESSMENT_SCHEMA_VERSION,
  ASSESSMENT_RULES,
  ASSESSMENT_RULE_IDS,
  EVIDENCE_CLASSES,
  CATEGORY_ARRAY_KEYS,
  RULES_VERSION_STRING,
  buildFieldSpecsByComponent,
  classifyFieldValue,
  computeFieldCounts,
  computeAssessmentCoverage,
  validateAssessmentCoverage,
  isValidAssessmentCoverage,
} from "./assessmentCoverage.js";
import { ASSURANCE_RULE_IDS } from "./quote_analyzer_assurance.js";
import { RULES_VERSION } from "../../pc-quote-builder/src/lib/quoteAnalyzer/contracts.js";

const generatedAt = "2026-08-01T00:00:00.000Z";

const emptyCatalog = {
  cpus: [],
  motherboards: [],
  ram: [],
  gpus: [],
  psus: [],
  cases: [],
};

const makeItem = (overrides = {}) => ({
  id: "item-1",
  meta: { created_from: ["pcpart"], conflict_flags: [], quality_score: 0.8 },
  ...overrides,
});

const catalogWith = (category, items) => ({ ...emptyCatalog, [category]: items });

describe("rule registry (Plan 030 Step 1)", () => {
  it("has exactly one entry per Plan 028 v1 rule and matches the assurance inventory", () => {
    expect(ASSESSMENT_RULE_IDS.length).toBeGreaterThan(0);
    expect([...ASSESSMENT_RULE_IDS].sort()).toEqual([...ASSURANCE_RULE_IDS].sort());
    for (const ruleId of ASSESSMENT_RULE_IDS) {
      const rule = ASSESSMENT_RULES[ruleId];
      expect(rule).toBeDefined();
      expect(rule.bothSidesRequired).toBe(true);
      expect(rule.sides.length).toBeGreaterThan(0);
      for (const side of rule.sides) {
        expect(CATEGORY_ARRAY_KEYS[side.component]).toBeDefined();
        expect(side.fields.length).toBeGreaterThan(0);
        for (const field of side.fields) {
          expect(["direct", "conflict-flagged", "evidence-flagged", "object-types", "map"]).toContain(field.kind);
        }
      }
    }
  });

  it("rejects unknown rule IDs (no registry entry)", () => {
    expect(ASSESSMENT_RULES["compat-something-new"]).toBeUndefined();
  });
});

describe("evidence classification", () => {
  it("classifies direct fields: explicit when usable, missing otherwise", () => {
    const spec = { name: "socket", kind: "direct" };
    expect(classifyFieldValue(makeItem({ socket: "AM4" }), spec)).toBe("explicit");
    expect(classifyFieldValue(makeItem({ socket: "" }), spec)).toBe("missing");
    expect(classifyFieldValue(makeItem({ socket: null }), spec)).toBe("missing");
    expect(classifyFieldValue(makeItem({}), spec)).toBe("missing");
    expect(classifyFieldValue(makeItem({ socket: "AM4" }), spec)).toBe("explicit");
    expect(classifyFieldValue(makeItem({ socket: ["AM4"] }), spec)).toBe("missing");
    expect(classifyFieldValue(makeItem({ socket: { name: "AM4" } }), spec)).toBe("missing");
    expect(classifyFieldValue(makeItem({ socket: 0 }), spec)).toBe("explicit");
  });

  it("classifies conflict-flagged fields as conflicting on a documented flag", () => {
    const spec = { name: "tdp_w", kind: "conflict-flagged", conflictFlag: "cpu_tdp_conflict" };
    expect(classifyFieldValue(makeItem({ tdp_w: 65 }), spec)).toBe("explicit");
    expect(
      classifyFieldValue(makeItem({ tdp_w: 65, meta: { conflict_flags: ["cpu_tdp_conflict"] } }), spec)
    ).toBe("conflicting");
    expect(
      classifyFieldValue(makeItem({ tdp_w: 65, meta: { conflict_flags: ["gpu_tdp_conflict"] } }), spec)
    ).toBe("explicit");
  });

  it("classifies evidence-flagged fields as explicit, inferred, or not-applicable from documented evidence", () => {
    const spec = {
      name: "supported_mobo_form_factors",
      kind: "evidence-flagged",
      evidenceField: "form_factor_evidence",
    };
    expect(
      classifyFieldValue(
        makeItem({ supported_mobo_form_factors: ["ATX"], form_factor_evidence: "inferred" }),
        spec
      )
    ).toBe("inferred");
    expect(
      classifyFieldValue(
        makeItem({ supported_mobo_form_factors: ["ATX"], form_factor_evidence: "explicit" }),
        spec
      )
    ).toBe("explicit");
    expect(
      classifyFieldValue(
        makeItem({ supported_mobo_form_factors: ["ATX"], form_factor_evidence: "unknown" }),
        spec
      )
    ).toBe("notApplicable");
    expect(classifyFieldValue(makeItem({ supported_mobo_form_factors: [] }), spec)).toBe("missing");
    expect(
      classifyFieldValue(
        makeItem({ supported_mobo_form_factors: "ATX", form_factor_evidence: "inferred" }),
        spec
      )
    ).toBe("missing");
    expect(
      classifyFieldValue(
        makeItem({ supported_mobo_form_factors: [""], form_factor_evidence: "inferred" }),
        spec
      )
    ).toBe("missing");
  });

  it("classifies object-types fields by the inner array and map fields by non-empty objects", () => {
    const typesSpec = { name: "memory_support", kind: "object-types" };
    expect(classifyFieldValue(makeItem({ memory_support: { types: ["DDR4"] } }), typesSpec)).toBe("explicit");
    expect(classifyFieldValue(makeItem({ memory_support: { types: [] } }), typesSpec)).toBe("missing");
    expect(classifyFieldValue(makeItem({ memory_support: { types: "DDR4" } }), typesSpec)).toBe("missing");
    expect(classifyFieldValue(makeItem({ memory_support: { types: [123] } }), typesSpec)).toBe("missing");
    expect(classifyFieldValue(makeItem({ memory_support: { types: [""] } }), typesSpec)).toBe("missing");
    expect(classifyFieldValue(makeItem({ memory_support: {} }), typesSpec)).toBe("missing");
    expect(classifyFieldValue(makeItem({}), typesSpec)).toBe("missing");

    const mapSpec = { name: "pcie_power_connectors", kind: "map" };
    expect(classifyFieldValue(makeItem({ pcie_power_connectors: { "8_pin": 2 } }), mapSpec)).toBe("explicit");
    expect(classifyFieldValue(makeItem({ pcie_power_connectors: {} }), mapSpec)).toBe("missing");
    expect(classifyFieldValue(makeItem({ pcie_power_connectors: null }), mapSpec)).toBe("missing");
    expect(classifyFieldValue(makeItem({ pcie_power_connectors: ["8_pin"] }), mapSpec)).toBe("missing");
  });

  it("classifies conflict-flagged fields as missing when the value shape is malformed", () => {
    const spec = { name: "tdp_w", kind: "conflict-flagged", conflictFlag: "cpu_tdp_conflict" };
    expect(
      classifyFieldValue(
        makeItem({ tdp_w: [65], meta: { conflict_flags: ["cpu_tdp_conflict"] } }),
        spec
      )
    ).toBe("missing");
    expect(classifyFieldValue(makeItem({ tdp_w: [65] }), spec)).toBe("missing");
  });
});

describe("computeAssessmentCoverage (Plan 030 Step 2)", () => {
  it("computes explicit counts on a complete catalog", () => {
    const catalog = {
      ...emptyCatalog,
      cpus: [makeItem({ id: "c1", socket: "AM4", tdp_w: 65, memory_support: { types: ["DDR4"] } })],
      motherboards: [makeItem({ id: "m1", socket: "AM4", form_factor: "ATX", memory_type: "DDR4" })],
      ram: [makeItem({ id: "r1", type: "DDR4", speed_mts: 3600 })],
      gpus: [makeItem({ id: "g1", tdp_w: 200, board_length_mm: 300, power_connectors: "1x 8-pin" })],
      psus: [makeItem({ id: "p1", wattage_w: 650, pcie_power_connectors: { "8_pin": 2 } })],
      cases: [
        makeItem({ id: "k1", supported_mobo_form_factors: ["ATX"], form_factor_evidence: "inferred", max_gpu_length_mm: 350 }),
      ],
    };
    const manifest = computeAssessmentCoverage(catalog, { generatedAt });
    expect(validateAssessmentCoverage(manifest)).toEqual([]);
    expect(manifest.schemaVersion).toBe(ASSESSMENT_SCHEMA_VERSION);
    expect(manifest.rulesVersion).toBe(RULES_VERSION);
    expect(manifest.generatedAt).toBe(generatedAt);

    const socket = manifest.dimensions["compat-cpu-mobo-socket"];
    expect(socket.sides.cpu.socket.explicit).toBe(1);
    expect(socket.sides.mobo.socket.explicit).toBe(1);
    expect(socket.combinations).toEqual({ assessable: 1, total: 1 });

    const power = manifest.dimensions["power-psu-headroom"];
    expect(power.sides.cpu.tdp_w.explicit).toBe(1);
    expect(power.sides.gpu.tdp_w.explicit).toBe(1);
    expect(power.sides.psu.wattage_w.explicit).toBe(1);
    expect(power.combinations).toEqual({ assessable: 1, total: 1 });

    expect(manifest.categories.cpu.socket.explicit).toBe(1);
    expect(manifest.categories.ram.type.explicit).toBe(1);
  });

  it("counts sparse evidence as missing without failing", () => {
    const catalog = {
      ...emptyCatalog,
      cpus: [
        makeItem({ id: "c1", socket: "", tdp_w: null }),
        makeItem({ id: "c2", socket: "AM4", tdp_w: 65 }),
      ],
      motherboards: [makeItem({ id: "m1", socket: "" })],
    };
    const manifest = computeAssessmentCoverage(catalog, { generatedAt });
    expect(validateAssessmentCoverage(manifest)).toEqual([]);
    const socket = manifest.dimensions["compat-cpu-mobo-socket"];
    expect(socket.sides.cpu.socket).toEqual({
      explicit: 1,
      inferred: 0,
      conflicting: 0,
      missing: 1,
      notApplicable: 0,
    });
    expect(socket.sides.mobo.socket.missing).toBe(1);
    expect(socket.combinations).toEqual({ assessable: 0, total: 2 });
  });

  it("counts conflicting TDP as conflicting and excludes it from assessable combinations", () => {
    const catalog = {
      ...emptyCatalog,
      cpus: [
        makeItem({ id: "c1", tdp_w: 65, meta: { conflict_flags: ["cpu_tdp_conflict"] } }),
        makeItem({ id: "c2", tdp_w: 105 }),
      ],
      gpus: [makeItem({ id: "g1", tdp_w: 200 })],
      psus: [makeItem({ id: "p1", wattage_w: 650 })],
    };
    const manifest = computeAssessmentCoverage(catalog, { generatedAt });
    const power = manifest.dimensions["power-psu-headroom"];
    expect(power.sides.cpu.tdp_w.conflicting).toBe(1);
    expect(power.sides.cpu.tdp_w.explicit).toBe(1);
    expect(power.combinations).toEqual({ assessable: 1, total: 2 });
  });

  it("counts not-applicable case form factors from unknown evidence", () => {
    const catalog = {
      ...emptyCatalog,
      motherboards: [makeItem({ id: "m1", form_factor: "ATX" })],
      cases: [
        makeItem({ id: "k1", supported_mobo_form_factors: ["ATX"], form_factor_evidence: "inferred" }),
        makeItem({ id: "k2", supported_mobo_form_factors: ["ATX"], form_factor_evidence: "explicit" }),
        makeItem({ id: "k3", supported_mobo_form_factors: ["ATX"], form_factor_evidence: "unknown" }),
        makeItem({ id: "k4", supported_mobo_form_factors: [], form_factor_evidence: "unknown" }),
      ],
    };
    const manifest = computeAssessmentCoverage(catalog, { generatedAt });
    const fit = manifest.dimensions["compat-mobo-case-ff"];
    expect(fit.sides.case.supported_mobo_form_factors).toEqual({
      explicit: 1,
      inferred: 1,
      conflicting: 0,
      missing: 1,
      notApplicable: 1,
    });
    expect(fit.combinations).toEqual({ assessable: 2, total: 4 });
  });

  it("supports an empty catalog and an empty dimension", () => {
    const manifest = computeAssessmentCoverage(emptyCatalog, { generatedAt });
    expect(validateAssessmentCoverage(manifest)).toEqual([]);
    for (const ruleId of ASSESSMENT_RULE_IDS) {
      expect(manifest.dimensions[ruleId].combinations).toEqual({ assessable: 0, total: 0 });
    }
  });

  it("is deterministic: identical inputs produce identical byte output", () => {
    const catalog = {
      ...emptyCatalog,
      cpus: [makeItem({ id: "c1", socket: "AM4" })],
      motherboards: [makeItem({ id: "m1", socket: "AM4" })],
    };
    const first = computeAssessmentCoverage(catalog, { generatedAt });
    const second = computeAssessmentCoverage(catalog, { generatedAt });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    const expectedOrder = [...Object.keys(first.categories)].sort();
    expect(Object.keys(first.categories)).toEqual(expectedOrder);
  });

  it("computeFieldCounts returns sorted keys for standalone use", () => {
    const rule = ASSESSMENT_RULES["compat-mobo-ram-memory"];
    const counts = computeFieldCounts(
      [makeItem({ id: "m1", memory_type: "DDR4" })],
      rule,
      "mobo"
    );
    const fields = Object.keys(counts);
    expect(fields).toEqual([...fields].sort());
    const classes = Object.keys(counts.max_memory_speed_mts);
    expect(classes).toEqual([...classes].sort());
    expect(counts.max_memory_speed_mts.explicit).toBe(0);
  });

  it("rejects duplicate IDs, missing ids, and mismatched rules versions", () => {
    expect(() =>
      computeAssessmentCoverage({ ...emptyCatalog, cpus: [makeItem({ id: "c1" }), makeItem({ id: "c1" })] }, { generatedAt })
    ).toThrow("duplicate id");
    expect(() =>
      computeAssessmentCoverage({ ...emptyCatalog, cpus: [makeItem({ id: "" })] }, { generatedAt })
    ).toThrow("without an id");
    expect(() =>
      computeAssessmentCoverage(emptyCatalog, { generatedAt, rulesVersion: "quote-analyzer/rules/v2" })
    ).toThrow("rulesVersion");
    expect(() => computeAssessmentCoverage(emptyCatalog, {})).toThrow("generatedAt");
    expect(() => computeAssessmentCoverage(emptyCatalog, null)).toThrow("generatedAt");
  });

  it("buildFieldSpecsByComponent detects registry drift for the same field", () => {
    const consistent = buildFieldSpecsByComponent();
    expect(consistent.cpu.socket.kind).toBe("direct");
    expect(consistent.gpu.tdp_w.kind).toBe("conflict-flagged");
    expect(() =>
      buildFieldSpecsByComponent({
        r1: { sides: [{ component: "cpu", fields: [{ name: "socket", kind: "direct" }] }] },
        r2: { sides: [{ component: "cpu", fields: [{ name: "socket", kind: "map" }] }] },
      })
    ).toThrow("registry drift");
  });

  it("multi-field sides require every field on the side to be usable", () => {
    const catalog = {
      ...emptyCatalog,
      motherboards: [
        makeItem({ id: "m1", memory_type: "DDR4" }),
        makeItem({ id: "m2", memory_type: "DDR4", max_memory_speed_mts: 5200 }),
      ],
      ram: [makeItem({ id: "r1", type: "DDR4", speed_mts: 3600 })],
    };
    const manifest = computeAssessmentCoverage(catalog, { generatedAt });
    const ramRule = manifest.dimensions["compat-mobo-ram-memory"];
    expect(ramRule.sides.mobo.max_memory_speed_mts).toEqual({
      explicit: 1,
      inferred: 0,
      conflicting: 0,
      missing: 1,
      notApplicable: 0,
    });
    expect(ramRule.combinations).toEqual({ assessable: 1, total: 2 });
  });
});

describe("validateAssessmentCoverage", () => {
  const validManifest = () => computeAssessmentCoverage(emptyCatalog, { generatedAt });

  it("accepts a computed manifest and rejects garbage input", () => {
    expect(validateAssessmentCoverage(validManifest())).toEqual([]);
    expect(validateAssessmentCoverage(null).join(";")).toContain("object");
    expect(validateAssessmentCoverage({ ...validManifest(), schemaVersion: "old" }).join(";")).toContain(
      "schemaVersion"
    );
    expect(validateAssessmentCoverage({ ...validManifest(), rulesVersion: "v9" }).join(";")).toContain(
      "rulesVersion"
    );
  });

  it("rejects impossible, negative, and non-integer counts", () => {
    const manifest = validManifest();
    manifest.dimensions["compat-cpu-mobo-socket"].combinations = { assessable: 2, total: 1 };
    expect(validateAssessmentCoverage(manifest).join(";")).toContain("exceeds total");

    const junkCombinations = validManifest();
    junkCombinations.dimensions["compat-cpu-mobo-socket"].combinations = {
      assessable: 0,
      total: 0,
      extra: true,
    };
    expect(validateAssessmentCoverage(junkCombinations).join(";")).toContain("exactly assessable and total");

    const negative = validManifest();
    negative.categories.cpu.socket.explicit = -1;
    expect(validateAssessmentCoverage(negative).join(";")).toContain("non-negative");

    const fractional = validManifest();
    fractional.categories.ram.type.missing = 1.5;
    expect(validateAssessmentCoverage(fractional).join(";")).toContain("non-negative");
  });

  it("rejects missing rules, unknown dimensions, and unsorted keys", () => {
    const missing = validManifest();
    delete missing.dimensions["compat-gpu-case-length"];
    expect(validateAssessmentCoverage(missing).join(";")).toContain("compat-gpu-case-length");

    const unknown = validManifest();
    unknown.dimensions["compat-something-new"] = unknown.dimensions["compat-cpu-mobo-socket"];
    expect(validateAssessmentCoverage(unknown).join(";")).toContain("unknown rule");

    const extraSide = validManifest();
    extraSide.dimensions["compat-cpu-mobo-socket"].sides.ram = { type: { explicit: 0 } };
    expect(validateAssessmentCoverage(extraSide).join(";")).toContain("unknown side");

    const unsorted = validManifest();
    const swapped = {};
    const keys = Object.keys(unsorted.dimensions);
    for (let i = 1; i < keys.length; i += 1) {
      swapped[keys[i]] = unsorted.dimensions[keys[i]];
    }
    swapped[keys[0]] = unsorted.dimensions[keys[0]];
    unsorted.dimensions = swapped;
    expect(validateAssessmentCoverage(unsorted).join(";")).toContain("sorted");
  });

  it("rejects unknown category components and fields outside the registry", () => {
    const extraComponent = validManifest();
    extraComponent.categories.coolers = {};
    expect(validateAssessmentCoverage(extraComponent).join(";")).toContain("unknown component");

    const extraField = validManifest();
    extraField.categories.cpu.boost_ghz = { explicit: 0, inferred: 0, conflicting: 0, missing: 0, notApplicable: 0 };
    expect(validateAssessmentCoverage(extraField).join(";")).toContain("match the registry");

    const missingField = validManifest();
    delete missingField.categories.cpu.tdp_w;
    expect(validateAssessmentCoverage(missingField).join(";")).toContain("match the registry");

    const extraClass = validManifest();
    extraClass.categories.cpu.socket.ambiguous = 0;
    expect(validateAssessmentCoverage(extraClass).join(";")).toContain("evidence classes");
  });

  it("rejects per-field sums that disagree within a category (classification must be exhaustive)", () => {
    const manifest = validManifest();
    manifest.categories.cpu.socket.missing += 3;
    const errors = validateAssessmentCoverage(manifest).join(";");
    expect(errors).toContain("same item count");
  });

  it("rejects dimension side counts that disagree with the categories section", () => {
    const manifest = validManifest();
    manifest.dimensions["compat-cpu-mobo-socket"].sides.cpu.socket.explicit += 1;
    expect(validateAssessmentCoverage(manifest).join(";")).toContain("disagrees with categories");
  });

  it("isValidAssessmentCoverage wraps validation as a boolean", () => {
    expect(isValidAssessmentCoverage(validManifest())).toBe(true);
    expect(isValidAssessmentCoverage({ schemaVersion: "wrong" })).toBe(false);
    expect(isValidAssessmentCoverage(null)).toBe(false);
  });

  it("every evidence class is present and integer in real computed output", () => {
    const manifest = validManifest();
    for (const categoryCounts of Object.values(manifest.categories)) {
      for (const counts of Object.values(categoryCounts)) {
        for (const cls of EVIDENCE_CLASSES) {
          expect(Number.isInteger(counts[cls]), `${cls}`).toBe(true);
        }
      }
    }
  });
});
