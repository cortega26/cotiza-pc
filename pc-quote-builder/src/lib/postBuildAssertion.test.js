/* global process, Buffer */
import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const PUBLIC_DATA_DIR = path.resolve(process.cwd(), "public/data");
const DOCS_DATA_DIR = path.resolve(process.cwd(), "..", "docs", "data");

const REQUIRED_FILES = [
  "cpus.min.json",
  "gpus.min.json",
  "motherboards.min.json",
  "psus.min.json",
  "cases.min.json",
  "ram.min.json",
  "compatibility.min.json",
];

describe("post-build artifact match", () => {
  for (const file of REQUIRED_FILES) {
    it(`${file} existe en docs/data/ y coincide byte a byte con public/data/`, () => {
      const publicPath = path.join(PUBLIC_DATA_DIR, file);
      const docsPath = path.join(DOCS_DATA_DIR, file);

      expect(fs.existsSync(publicPath), `${file} no encontrado en public/data/`).toBe(true);
      expect(fs.existsSync(docsPath), `${file} no encontrado en docs/data/`).toBe(true);

      const publicContent = fs.readFileSync(publicPath);
      const docsContent = fs.readFileSync(docsPath);

      expect(publicContent.equals(docsContent), `${file} difiere entre public/data/ y docs/data/`).toBe(true);
    });
  }

  it("detecta diferencia deliberada (temp fixture)", () => {
    const docsPath = path.join(DOCS_DATA_DIR, "cpus.min.json");
    if (!fs.existsSync(docsPath)) return;
    const altered = Buffer.from("[]");
    const original = fs.readFileSync(docsPath);
    expect(altered.equals(original)).toBe(false);
  });
});
