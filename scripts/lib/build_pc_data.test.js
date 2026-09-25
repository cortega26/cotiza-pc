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

  it("maps nested BuildCores open-db records for every ingested category", async () => {
    writeJson(path.join(rawDir, "buildcores-open-db", "open-db", "CPU"), "cpu.json", {
      opendb_id: "bc-cpu-1",
      metadata: { name: "AMD Ryzen 5 5600", manufacturer: "AMD" },
      socket: "AM5",
      specifications: { memory: { types: ["DDR5"] }, tdp: 65 },
      cores: { total: 6, threads: 12 },
      clocks: { performance: { base: 3.5, boost: 4.4 } },
    });
    writeJson(path.join(rawDir, "buildcores-open-db", "open-db", "Motherboard"), "mobo.json", {
      opendb_id: "bc-mobo-1",
      metadata: { name: "ASUS B760M-AYW WIFI D4", manufacturer: "ASUS" },
      socket: "LGA 1700",
      form_factor: "Micro ATX",
      memory: { ram_type: "DDR4", slots: 2, max: 64 },
      m2_slots: [{}, {}],
      storage_devices: { sata_6_gb_s: 4 },
    });
    writeJson(path.join(rawDir, "buildcores-open-db", "open-db", "PCCase"), "case.json", {
      opendb_id: "bc-case-1",
      metadata: { name: "Fractal Design Meshify C ATX Mid Tower Black", manufacturer: "Fractal Design" },
      form_factor: "ATX Mid Tower",
      supported_motherboard_form_factors: ["ATX", "Micro ATX", "Mini-ITX"],
      max_video_card_length: 315,
      max_cpu_cooler_height: 170,
    });
    writeJson(path.join(rawDir, "buildcores-open-db", "open-db", "PSU"), "psu.json", {
      opendb_id: "bc-psu-1",
      metadata: { name: "Corsair RM750x", manufacturer: "Corsair" },
      wattage: 750,
      form_factor: "ATX",
      efficiency_rating: "80+ Gold",
      connectors: { pcie_6_plus_2_pin: 4, pcie_12vhpwr: 1 },
    });
    writeJson(path.join(rawDir, "buildcores-open-db", "open-db", "GPU"), "gpu.json", {
      opendb_id: "bc-gpu-1",
      metadata: { name: "ASUS ROG Strix RTX 4070", manufacturer: "ASUS" },
      chipset: "RTX 4070",
      memory: 12,
      memory_type: "GDDR6X",
      tdp: 200,
      length: 300,
      power_connectors: { pcie_8_pin: 1, pcie_12V_2x6: 1 },
    });
    writeJson(path.join(rawDir, "buildcores-open-db", "open-db", "RAM"), "ram.json", {
      opendb_id: "bc-ram-1",
      metadata: { name: "Corsair Vengeance LPX DDR4-3200 16GB (2x8GB)", manufacturer: "Corsair" },
      ram_type: "DDR4",
      speed: 3200,
      capacity: 16,
      modules: { quantity: 2, capacity_gb: 8 },
    });

    const { loadBuildCores, canonicalSocket, mapPsuConnectors, mapGpuPowerConnectors } =
      await import("./sources.js");
    const result = loadBuildCores(rawDir);

    expect(canonicalSocket("LGA 1700")).toBe("LGA1700");
    expect(canonicalSocket("AM4")).toBe("AM4");
    expect(canonicalSocket("")).toBe("");

    expect(result.cpus[0].brand).toBe("AMD");
    expect(result.cpus[0].model).toBe("Ryzen 5 5600");
    expect(result.cpus[0].socket).toBe("AM5");
    expect(result.cpus[0].memory_support.types).toEqual(["DDR5"]);
    expect(result.cpus[0].tdp_w).toBe(65);
    expect(result.cpus[0].cores).toBe(6);
    expect(result.cpus[0].boost_clock_ghz).toBe(4.4);

    expect(result.mobos[0].socket).toBe("LGA1700");
    expect(result.mobos[0].memory_type).toBe("DDR4");
    expect(result.mobos[0].memory_slots).toBe(2);
    expect(result.mobos[0].max_memory_gb).toBe(64);
    expect(result.mobos[0].m2_slots).toBe(2);
    expect(result.mobos[0].sata_ports).toBe(4);

    expect(result.pcCases[0].max_gpu_length_mm).toBe(315);
    expect(result.pcCases[0].supported_mobo_form_factors).toEqual(["ATX", "Micro ATX", "Mini-ITX"]);

    expect(result.psus[0].wattage_w).toBe(750);
    expect(mapPsuConnectors({ connectors: { pcie_6_plus_2_pin: 4, pcie_12vhpwr: 1 } })).toEqual({
      "8_pin": 4,
      "12vhpwr": 1,
    });
    expect(mapPsuConnectors({ pcie_power_connectors: { "8_pin": 2 } })).toEqual({ "8_pin": 2 });

    expect(result.gpus[0].board_length_mm).toBe(300);
    expect(result.gpus[0].vram_gb).toBe(12);
    expect(result.gpus[0].tdp_w).toBe(200);
    expect(mapGpuPowerConnectors({ power_connectors: { pcie_8_pin: 1, pcie_12V_2x6: 1 } })).toBe(
      "1x12vhpwr 1x8-pin"
    );
    expect(mapGpuPowerConnectors({ power_connectors: "None" })).toBe("");
    expect(mapGpuPowerConnectors({ power_connectors: "1x8-pin" })).toBe("1x8-pin");

    expect(result.ram[0].type).toBe("DDR4");
    expect(result.ram[0].speed_mts).toBe(3200);
    expect(result.ram[0].capacity_gb_total).toBe(16);
    expect(result.ram[0].modules).toBe(2);
  });

  it("still accepts flat legacy BuildCores fixtures", async () => {
    writeJson(path.join(rawDir, "buildcores-open-db", "open-db", "CPU"), "cpu.json", [
      {
        brand: "AMD",
        model: "Ryzen 5 5600",
        socket: "AM4",
        cores: 6,
        threads: 12,
        base_clock: 3.5,
        boost_clock: 4.4,
        tdp: 65,
      },
    ]);

    const { loadBuildCores } = await import("./sources.js");
    const { cpus } = loadBuildCores(rawDir);

    expect(cpus).toHaveLength(1);
    expect(cpus[0].socket).toBe("AM4");
    expect(cpus[0].tdp_w).toBe(65);
    expect(cpus[0].normalized_key).toBe("amd ryzen 5 5600");
  });
});
