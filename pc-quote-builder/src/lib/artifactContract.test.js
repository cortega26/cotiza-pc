/* global process */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { buildTierMaps } from "./catalogMapper";
import { RULES_VERSION } from "./quoteAnalyzer/contracts";
import {
  ASSESSMENT_SCHEMA_VERSION,
  ASSESSMENT_RULE_IDS,
  EVIDENCE_CLASSES,
  validateAssessmentCoverage,
} from "../../../scripts/lib/assessmentCoverage.js";

const DATA_DIR = path.resolve(process.cwd(), "public/data");
const read = (file) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));

const ARRAY_FILES = [
  "cpus.min.json",
  "gpus.min.json",
  "motherboards.min.json",
  "psus.min.json",
  "cases.min.json",
  "ram.min.json",
];

const OBJECT_FILES = ["compatibility.min.json", "assessment-coverage.min.json"];
const ALL_REQUIRED = [...ARRAY_FILES, ...OBJECT_FILES];

describe("deployed artifact contract", () => {
  for (const file of ALL_REQUIRED) {
    it(`${file} existe y es JSON válido`, () => {
      const fullPath = path.join(DATA_DIR, file);
      expect(fs.existsSync(fullPath), `${file} no encontrado en ${DATA_DIR}`).toBe(true);
      const raw = fs.readFileSync(fullPath, "utf-8");
      expect(() => JSON.parse(raw), `${file} no es JSON válido`).not.toThrow();
    });
  }

  for (const file of ARRAY_FILES) {
    it(`${file} es un array no vacío`, () => {
      const data = read(file);
      expect(Array.isArray(data), `${file} debe ser un array, pero es ${typeof data}`).toBe(true);
      expect(data.length, `${file} está vacío`).toBeGreaterThan(0);
    });
  }

  for (const file of ARRAY_FILES) {
    it(`${file}: todos los items tienen id y name no vacíos`, () => {
      const data = read(file);
      const emptyId = data.find((item) => !item?.id);
      const emptyName = data.find((item) => !item?.name);
      expect(emptyId, `${file}: item sin id`).toBeUndefined();
      expect(emptyName, `${file}: item sin name`).toBeUndefined();
    });
  }

  it("compatibility.min.json es un objeto con tiers usables por buildTierMaps", () => {
    const compat = read("compatibility.min.json");
    expect(typeof compat).toBe("object");
    expect(compat).not.toBeNull();
    expect(Array.isArray(compat.tiers?.cpu)).toBe(true);
    expect(Array.isArray(compat.tiers?.gpu)).toBe(true);
    expect(compat.tiers.cpu.length).toBeGreaterThan(0);
    expect(compat.tiers.gpu.length).toBeGreaterThan(0);
    const maps = buildTierMaps(compat);
    expect(maps.cpu.size).toBeGreaterThan(0);
    expect(maps.gpu.size).toBeGreaterThan(0);
  });

  it("assessment-coverage.min.json es un manifest válido del contrato", () => {
    const manifest = read("assessment-coverage.min.json");
    expect(manifest.schemaVersion).toBe(ASSESSMENT_SCHEMA_VERSION);
    expect(manifest.rulesVersion).toBe(RULES_VERSION);
    expect(typeof manifest.generatedAt).toBe("string");
    expect(manifest.generatedAt.length).toBeGreaterThan(0);
    expect(validateAssessmentCoverage(manifest)).toEqual([]);
  });

  it("assessment-coverage.min.json comparte el instante de snapshot con compatibility", () => {
    const manifest = read("assessment-coverage.min.json");
    const compat = read("compatibility.min.json");
    expect(manifest.generatedAt).toBe(compat.generatedAt);
  });

  it("assessment-coverage.min.json cubre toda regla v1 con conteos no negativos y assessable <= total", () => {
    const manifest = read("assessment-coverage.min.json");
    for (const ruleId of ASSESSMENT_RULE_IDS) {
      const entry = manifest.dimensions[ruleId];
      expect(entry, ruleId).toBeDefined();
      expect(entry.bothSidesRequired).toBe(true);
      const { assessable, total } = entry.combinations;
      expect(Number.isInteger(assessable), ruleId).toBe(true);
      expect(Number.isInteger(total), ruleId).toBe(true);
      expect(assessable).toBeGreaterThanOrEqual(0);
      expect(assessable).toBeLessThanOrEqual(total);
    }
    for (const categoryCounts of Object.values(manifest.categories)) {
      for (const counts of Object.values(categoryCounts)) {
        for (const cls of EVIDENCE_CLASSES) {
          expect(Number.isInteger(counts[cls]), cls).toBe(true);
          expect(counts[cls], cls).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("assessment-coverage.min.json documenta las brechas como estructura, sin fijar conteos", () => {
    const manifest = read("assessment-coverage.min.json");
    const documentedGaps = [
      ["cpu", "socket"],
      ["cpu", "memory_support"],
      ["mobo", "max_memory_speed_mts"],
      ["case", "max_gpu_length_mm"],
      ["psu", "pcie_power_connectors"],
    ];
    for (const [category, field] of documentedGaps) {
      const counts = manifest.categories[category]?.[field];
      expect(counts, `${category}.${field} should be documented in the manifest`).toBeDefined();
    }
    for (const categoryCounts of Object.values(manifest.categories)) {
      const fieldSums = Object.values(categoryCounts).map((counts) =>
        EVIDENCE_CLASSES.reduce((sum, cls) => sum + counts[cls], 0)
      );
      expect(
        fieldSums.every((sum) => sum === fieldSums[0]),
        `all fields of a category must classify the same items: ${JSON.stringify(fieldSums)}`
      ).toBe(true);
    }
  });
});

describe("artifact contract — malformed data detection", () => {
  it("detects JSON inválido", () => {
    const raw = "{cpus: broken";
    expect(() => JSON.parse(raw)).toThrow();
  });

  it("detects objeto donde se espera array", () => {
    const data = { id: "not-an-array" };
    expect(Array.isArray(data)).toBe(false);
  });

  it("detects array vacío", () => {
    expect([].length).toBe(0);
  });

  it("detects items sin id", () => {
    const items = [{ name: "no-id" }];
    const bad = items.find((item) => !item?.id);
    expect(bad).toBeDefined();
  });

  it("detects items sin name", () => {
    const items = [{ id: "no-name" }];
    const bad = items.find((item) => !item?.name);
    expect(bad).toBeDefined();
  });

  it("detects compat sin tiers", () => {
    const compat = {};
    expect(Array.isArray(compat.tiers?.cpu)).toBe(false);
  });
});