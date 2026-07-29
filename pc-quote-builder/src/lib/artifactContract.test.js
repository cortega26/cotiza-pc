/* global process */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { buildTierMaps } from "./catalogMapper";

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

const OBJECT_FILES = ["compatibility.min.json"];
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