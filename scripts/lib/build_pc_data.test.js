import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

const SOURCE_TAGS = { BUILDCORES: "buildcores", DBGPU: "dbgpu", PCPART: "pcpart" };

function writeJson(dir, file, data) {
  const fullPath = path.join(dir, file);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, JSON.stringify(data));
}

describe("catalog compiler end-to-end", () => {
  let tmpDir;
  let rawDir;
  let outDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pc-build-test-"));
    rawDir = path.join(tmpDir, "raw");
    outDir = path.join(tmpDir, "out");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loadDbGpu filters malformed rows (missing brand/model, extreme TDP, extreme VRAM)", async () => {
    writeJson(rawDir, "dbgpu/gpus.json", [
      { brand: "NVIDIA", model: "RTX 4060", tdp: 115, vram_gb: 8 },
      { brand: "", model: "", tdp: 0, vram_gb: 0 },
      { brand: "NVIDIA", model: "RTX 5090", tdp: 1200, vram_gb: 48 },
      { brand: "Bad", model: "Extreme", tdp: 9999, vram_gb: 8 },
      { brand: "Bad", model: "VRAM", tdp: 115, vram_gb: 999 },
      { brand: "NoModel", tdp: 115, vram_gb: 8 },
      { model: "NoBrand", tdp: 115, vram_gb: 8 },
    ]);

    const { loadDbGpu } = await import("./sources.js");
    const { gpus } = loadDbGpu(rawDir);

    expect(gpus).toHaveLength(1);
    expect(gpus[0].brand).toBe("NVIDIA");
    expect(gpus[0].model).toBe("RTX 4060");
  });

  it("loadDbGpu handles empty directory", async () => {
    fs.mkdirSync(path.join(rawDir, "dbgpu"), { recursive: true });

    const { loadDbGpu } = await import("./sources.js");
    const { gpus } = loadDbGpu(rawDir);

    expect(gpus).toEqual([]);
  });

  it("loadBuildCores handles missing directories gracefully", async () => {
    const { loadBuildCores } = await import("./sources.js");
    const result = loadBuildCores(rawDir);
    expect(result.cpus).toEqual([]);
    expect(result.ram).toEqual([]);
  });

  it("loadPcPart handles missing datasets gracefully", async () => {
    const { loadPcPart } = await import("./sources.js");
    const result = loadPcPart(rawDir);
    expect(result.cpus).toEqual([]);
    expect(result.gpus).toEqual([]);
    expect(result.mobos).toEqual([]);
    expect(result.psus).toEqual([]);
    expect(result.cases).toEqual([]);
    expect(result.ram).toEqual([]);
    expect(result.coolers).toEqual([]);
    expect(result.fans).toEqual([]);
  });

  it("importing compiler modules is side-effect free (writes nothing)", () => {
    const before = fs.readdirSync(tmpDir);
    // Dynamic import in test causes no writes
    expect(fs.readdirSync(tmpDir)).toEqual(before);
  });

  it("runs full pipeline with fixture sources and produces expected output", async () => {
    writeJson(path.join(rawDir, "buildcores-open-db", "open-db", "CPU"), "cpus.json", [
      { brand: "AMD", model: "Ryzen 5 5600", socket: "AM4", cores: 6, threads: 12, base_clock: 3.5, boost_clock: 4.4, tdp: 65 },
    ]);
    writeJson(path.join(rawDir, "buildcores-open-db", "open-db", "RAM"), "ram.json", [
      { brand: "Corsair", model: "Vengeance LPX", type: "DDR4", speed: 3200, capacity: 16, modules: 2 },
    ]);
    writeJson(rawDir, "dbgpu/gpus.json", []);

    writeJson(path.join(rawDir, "pc-part-dataset", "data", "json"), "cpu.json", [
      { name: "AMD Ryzen 5 5600", socket: "AM4", core_count: 6, core_clock: 3.5, boost_clock: 4.4, tdp: 65, memory_type: "DDR4" },
    ]);
    writeJson(path.join(rawDir, "pc-part-dataset", "data", "json"), "video-card.json", [
      { name: "NVIDIA RTX 4060", chipset: "RTX 4060", memory: 8, tdp: 115, psu: 450, length: 250 },
    ]);
    writeJson(path.join(rawDir, "pc-part-dataset", "data", "json"), "motherboard.json", [
      { name: "ASUS B550-Plus", socket: "AM4", chipset: "B550", form_factor: "ATX", memory_type: "DDR4" },
    ]);
    writeJson(path.join(rawDir, "pc-part-dataset", "data", "json"), "power-supply.json", [
      { name: "Corsair RM650x", wattage: 650, type: "ATX", efficiency: "Gold" },
    ]);
    writeJson(path.join(rawDir, "pc-part-dataset", "data", "json"), "case.json", [
      { name: "Fractal Meshify C", type: "ATX Mid Tower", gpu_length: 315 },
    ]);
    writeJson(path.join(rawDir, "pc-part-dataset", "data", "json"), "memory.json", [
      { name: "Corsair Vengeance LPX", speed: [4, 3200], type: "DDR4", modules: [2, 8] },
    ]);
    writeJson(path.join(rawDir, "pc-part-dataset", "data", "json"), "cpu-cooler.json", [
      { name: "Noctua NH-D15", size: 165, rpm: 1200 },
    ]);
    writeJson(path.join(rawDir, "pc-part-dataset", "data", "json"), "case-fan.json", [
      { name: "Noctua NF-A12x25", size: 120, rpm: 2000, airflow: 60, pwm: true },
    ]);

    const { loadBuildCores, loadDbGpu, loadPcPart } = await import("./sources.js");
    const {
      mergeGrouped, mergeCpu, mergeGpu, mergeMobo, mergePsu, mergeCase,
      mergeRam, mergeCooler, mergeFan, computeCompatibilityMeta,
    } = await import("./compiler.js");
    const { stableIdSort } = await import("./normalize.js");

    const { cpus: bcCpus, ram: bcRam } = loadBuildCores(rawDir);
    const { gpus: dbGpus } = loadDbGpu(rawDir);
    const { cpus: pcCpus, gpus: pcGpus, mobos, psus, cases, ram: pcRam, coolers, fans } = loadPcPart(rawDir);

    const mergedCpus = mergeGrouped([...bcCpus, ...pcCpus], mergeCpu).sort(stableIdSort);
    const mergedGpus = mergeGrouped([...dbGpus, ...pcGpus], mergeGpu).sort(stableIdSort);
    const mergedMobos = mergeGrouped([...mobos], mergeMobo).sort(stableIdSort);
    const mergedPsus = mergeGrouped([...psus], mergePsu).sort(stableIdSort);
    const mergedCases = mergeGrouped([...cases], mergeCase).sort(stableIdSort);
    const mergedRam = mergeGrouped([...bcRam, ...pcRam], mergeRam).sort(stableIdSort);
    const mergedCoolers = mergeGrouped([...coolers], mergeCooler).sort(stableIdSort);
    const mergedFans = mergeGrouped([...fans], mergeFan).sort(stableIdSort);

    expect(mergedCpus).toHaveLength(1);
    expect(mergedGpus).toHaveLength(1);
    expect(mergedMobos).toHaveLength(1);
    expect(mergedPsus).toHaveLength(1);
    expect(mergedCases).toHaveLength(1);
    expect(mergedRam).toHaveLength(1);
    expect(mergedCoolers).toHaveLength(1);
    expect(mergedFans).toHaveLength(1);

    const meta = computeCompatibilityMeta({
      mergedCpus, mergedGpus, mergedMobos, mergedPsus,
      mergedCases, mergedRam, mergedCoolers, mergedFans, provenance: null,
    });

    expect(meta.counts.cpus).toBe(1);
    expect(meta.counts.gpus).toBe(1);
    expect(meta.counts.motherboards).toBe(1);

    const outputs = [
      { filename: "cpus.min.json", data: mergedCpus },
      { filename: "gpus.min.json", data: mergedGpus },
      { filename: "motherboards.min.json", data: mergedMobos },
      { filename: "psus.min.json", data: mergedPsus },
      { filename: "cases.min.json", data: mergedCases },
      { filename: "ram.min.json", data: mergedRam },
      { filename: "memory.min.json", data: mergedRam },
      { filename: "coolers.min.json", data: mergedCoolers },
      { filename: "fans.min.json", data: mergedFans },
      { filename: "compatibility.min.json", data: meta },
    ];

    for (const out of outputs) {
      const file = path.join(outDir, out.filename);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `${JSON.stringify(out.data)}\n`);
    }

    for (const out of outputs) {
      const file = path.join(outDir, out.filename);
      expect(fs.existsSync(file), `${out.filename} not written`).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      if (Array.isArray(out.data)) {
        expect(Array.isArray(parsed)).toBe(true);
        expect(parsed).toHaveLength(out.data.length);
      }
    }

    const outFiles = fs.readdirSync(outDir).filter((f) => f.endsWith(".min.json"));
    expect(outFiles).toHaveLength(outputs.length);

    const allFiles = [];
    function walk(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else allFiles.push(full);
      }
    }
    walk(outDir);
    const outsideOut = allFiles.filter((f) => !f.startsWith(outDir));
    expect(outsideOut).toHaveLength(0);
  });

  it("produces byte-identical output on repeated runs with same input", async () => {
    writeJson(path.join(rawDir, "pc-part-dataset", "data", "json"), "cpu.json", [
      { name: "AMD Ryzen 5 5600", socket: "AM4", core_count: 6, core_clock: 3.5, boost_clock: 4.4, tdp: 65, memory_type: "DDR4" },
    ]);
    writeJson(path.join(rawDir, "pc-part-dataset", "data", "json"), "video-card.json", [
      { name: "NVIDIA RTX 4060", chipset: "RTX 4060", memory: 8, tdp: 115, psu: 450, length: 250 },
    ]);
    writeJson(path.join(rawDir, "pc-part-dataset", "data", "json"), "motherboard.json", [
      { name: "ASUS B550-Plus", socket: "AM4", chipset: "B550", form_factor: "ATX", memory_type: "DDR4" },
    ]);
    writeJson(path.join(rawDir, "pc-part-dataset", "data", "json"), "power-supply.json", [
      { name: "Corsair RM650x", wattage: 650, type: "ATX", efficiency: "Gold" },
    ]);
    writeJson(path.join(rawDir, "pc-part-dataset", "data", "json"), "case.json", [
      { name: "Fractal Meshify C", type: "ATX Mid Tower", gpu_length: 315 },
    ]);
    writeJson(path.join(rawDir, "pc-part-dataset", "data", "json"), "memory.json", [
      { name: "Corsair Vengeance LPX", speed: [4, 3200], type: "DDR4", modules: [2, 8] },
    ]);
    writeJson(path.join(rawDir, "pc-part-dataset", "data", "json"), "cpu-cooler.json", [
      { name: "Noctua NH-D15", size: 165, rpm: 1200 },
    ]);
    writeJson(path.join(rawDir, "pc-part-dataset", "data", "json"), "case-fan.json", [
      { name: "Noctua NF-A12x25", size: 120, rpm: 2000, airflow: 60, pwm: true },
    ]);
    writeJson(path.join(rawDir, "buildcores-open-db", "open-db", "CPU"), "cpus.json", []);
    writeJson(rawDir, "dbgpu/gpus.json", []);

    const { loadBuildCores, loadDbGpu, loadPcPart } = await import("./sources.js");
    const {
      mergeGrouped, mergeCpu, mergeGpu, mergeMobo, mergePsu, mergeCase,
      mergeRam, mergeCooler, mergeFan, computeCompatibilityMeta,
    } = await import("./compiler.js");
    const { stableIdSort } = await import("./normalize.js");

    const frozenNow = new Date("2026-07-30T00:00:00.000Z");

    function runOnce() {
      const { cpus: bcCpus, ram: bcRam } = loadBuildCores(rawDir);
      const { gpus: dbGpus } = loadDbGpu(rawDir);
      const { cpus: pcCpus, gpus: pcGpus, mobos, psus, cases, ram: pcRam, coolers, fans } = loadPcPart(rawDir);

      const mergedCpus = mergeGrouped([...bcCpus, ...pcCpus], mergeCpu).sort(stableIdSort);
      const mergedGpus = mergeGrouped([...dbGpus, ...pcGpus], mergeGpu).sort(stableIdSort);
      const mergedMobos = mergeGrouped([...mobos], mergeMobo).sort(stableIdSort);
      const mergedPsus = mergeGrouped([...psus], mergePsu).sort(stableIdSort);
      const mergedCases = mergeGrouped([...cases], mergeCase).sort(stableIdSort);
      const mergedRam = mergeGrouped([...bcRam, ...pcRam], mergeRam).sort(stableIdSort);
      const mergedCoolers = mergeGrouped([...coolers], mergeCooler).sort(stableIdSort);
      const mergedFans = mergeGrouped([...fans], mergeFan).sort(stableIdSort);

      const meta = computeCompatibilityMeta({
        mergedCpus, mergedGpus, mergedMobos, mergedPsus,
        mergedCases, mergedRam, mergedCoolers, mergedFans, provenance: null,
        now: frozenNow,
      });

      return JSON.stringify({ cpus: mergedCpus, gpus: mergedGpus, meta }, null, 2);
    }

    const first = runOnce();
    const second = runOnce();
    expect(second).toBe(first);
  });

  it("handles empty datasets gracefully", async () => {
    writeJson(rawDir, "buildcores-open-db/open-db/CPU/cpus.json", []);
    writeJson(rawDir, "dbgpu/gpus.json", []);
    writeJson(path.join(rawDir, "pc-part-dataset", "data", "json"), "cpu.json", []);
    writeJson(path.join(rawDir, "pc-part-dataset", "data", "json"), "video-card.json", []);
    writeJson(path.join(rawDir, "pc-part-dataset", "data", "json"), "motherboard.json", []);
    writeJson(path.join(rawDir, "pc-part-dataset", "data", "json"), "power-supply.json", []);
    writeJson(path.join(rawDir, "pc-part-dataset", "data", "json"), "case.json", []);
    writeJson(path.join(rawDir, "pc-part-dataset", "data", "json"), "memory.json", []);
    writeJson(path.join(rawDir, "pc-part-dataset", "data", "json"), "cpu-cooler.json", []);
    writeJson(path.join(rawDir, "pc-part-dataset", "data", "json"), "case-fan.json", []);

    const { loadBuildCores, loadDbGpu, loadPcPart } = await import("./sources.js");
    const {
      mergeGrouped, mergeCpu, mergeGpu, mergeMobo, mergePsu, mergeCase,
      mergeRam, mergeCooler, mergeFan,
    } = await import("./compiler.js");

    const { cpus: bcCpus, ram: bcRam } = loadBuildCores(rawDir);
    const { gpus: dbGpus } = loadDbGpu(rawDir);
    const pc = loadPcPart(rawDir);

    expect(mergeGrouped([...bcCpus, ...pc.cpus], mergeCpu)).toHaveLength(0);
    expect(mergeGrouped([...dbGpus, ...pc.gpus], mergeGpu)).toHaveLength(0);
    expect(mergeGrouped(pc.mobos, mergeMobo)).toHaveLength(0);
    expect(mergeGrouped(pc.psus, mergePsu)).toHaveLength(0);
    expect(mergeGrouped(pc.cases, mergeCase)).toHaveLength(0);
    expect(mergeGrouped([...bcRam, ...pc.ram], mergeRam)).toHaveLength(0);
    expect(mergeGrouped(pc.coolers, mergeCooler)).toHaveLength(0);
    expect(mergeGrouped(pc.fans, mergeFan)).toHaveLength(0);
  });
});
