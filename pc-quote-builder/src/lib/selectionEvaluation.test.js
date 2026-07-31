import { describe, expect, it } from "vitest";
import { evaluateSelection } from "./selectionEvaluation";

describe("selectionEvaluation", () => {
  const selection = {
    cpu: { id: "cpu1", socket: "LGA1700", memoryType: "DDR5", tdp: 125 },
    mobo: { id: "m1", socket: "LGA1700", memoryType: "DDR5", formFactor: "ATX" },
    ram: { id: "ram1", type: "DDR5" },
    gpu: { id: "gpu1", tdp: 220, length: 310, psuMin: 750, power_connectors: "2x 8-pin", suggested_psu_w: 750 },
    psu: { id: "psu1", wattage: 650, pcie_power_connectors: { "8_pin": 1 } },
    pcCase: { id: "case1", formFactors: ["ATX"], maxGpuLength: 300 },
  };

  it("captures power, connectors and mechanical issues", () => {
    const result = evaluateSelection(selection, { cpu: new Map(), gpu: new Map() }, { extraHeadroomW: 50 });
    const labels = result.statuses.map((s) => s.label);
    const connectorStatus = result.statuses.find((s) => s.label === "PSU conectores");
    expect(labels).toContain("PSU potencia");
    expect(labels).toContain("PSU conectores");
    expect(connectorStatus?.ok).toBe(false);
    expect(result.issues.some((msg) => msg.toLowerCase().includes("8-pin"))).toBe(true);
    expect(result.warnings.some((msg) => msg.toLowerCase().includes("sugiere"))).toBe(true);
  });

  it("provides selection chips for memory/socket context", () => {
    const result = evaluateSelection(selection, { cpu: new Map(), gpu: new Map() });
    expect(result.selectionChips.find((chip) => chip.label === "CPU")).toBeDefined();
    expect(result.selectionChips.find((chip) => chip.label === "RAM")?.value).toBe("DDR5");
  });

  it("surfaces info when faltan datos impiden validar", () => {
    const missingSocket = {
      cpu: { id: "cpu1", socket: "", memoryType: "DDR5", tdp: 125 },
      mobo: { id: "m1", socket: "LGA1700", memoryType: "DDR5", formFactor: "ATX" },
      ram: { id: "ram1", type: "DDR5" },
      gpu: { id: "gpu1", tdp: 220, length: 310, power_connectors: "2x 8-pin" },
      psu: { id: "psu1", wattage: 850, pcie_power_connectors: { "8_pin": 1 } },
      pcCase: { id: "case1", formFactors: ["ATX"], maxGpuLength: 320 },
    };
    const result = evaluateSelection(missingSocket, { cpu: new Map(), gpu: new Map() });
    expect(result.info.some((msg) => msg.toLowerCase().includes("socket"))).toBe(true);
  });

  it("marks connectors/fit as unknown when falta GPU/PSU/case", () => {
    const onlyGpu = {
      cpu: null,
      mobo: null,
      ram: null,
      gpu: { id: "gpu1", tdp: 220, length: 310 },
      psu: null,
      pcCase: null,
    };
    const res = evaluateSelection(onlyGpu, { cpu: new Map(), gpu: new Map() });
    const labels = res.statuses.map((s) => s.label);
    expect(labels).toContain("GPU ↔ Case");
    expect(labels).toContain("PSU conectores");
    expect(res.info.some((msg) => msg.toLowerCase().includes("conectores")) || res.info.some((msg) => msg.toLowerCase().includes("gabinete"))).toBe(true);
  });

  it("treats missing dimensions as unknown (not a hard incompatibility)", () => {
    const unknownFit = {
      cpu: null,
      mobo: null,
      ram: null,
      gpu: { id: "gpu1", length: 310 },
      psu: null,
      pcCase: { id: "case1", maxGpuLength: null },
    };
    const res = evaluateSelection(unknownFit, { cpu: new Map(), gpu: new Map() });
    const gpuCase = res.statuses.find((s) => s.label === "GPU ↔ Case");
    expect(gpuCase?.unknown).toBe(true);
    expect(res.issues.some((msg) => msg.toLowerCase().includes("no cabe"))).toBe(false);
  });

  it("treats missing PSU connector data as unknown, not a confirmed incompatibility", () => {
    const realCatalogPosture = {
      cpu: { id: "cpu1", socket: "LGA1700", memoryType: "DDR5", tdp: 125 },
      mobo: { id: "m1", socket: "LGA1700", memoryType: "DDR5", formFactor: "ATX" },
      ram: { id: "ram1", type: "DDR5" },
      gpu: { id: "gpu1", tdp: 220, length: 310, psuMin: 750, power_connectors: "2x 8-pin" },
      psu: { id: "psu1", wattage: 850 },
      pcCase: { id: "case1", formFactors: ["ATX"], maxGpuLength: 320 },
    };
    const res = evaluateSelection(realCatalogPosture, { cpu: new Map(), gpu: new Map() });
    const conn = res.statuses.find((s) => s.label === "PSU conectores");
    expect(conn?.unknown).toBe(true);
    expect(conn?.ok).toBe(false);
    expect(res.issues.some((msg) => msg.toLowerCase().includes("8-pin"))).toBe(false);
    expect(res.summaryVerdict).not.toBe("fail");
  });

  it("does not warn CPU↔RAM mismatch when CPU memoryType is inferred", () => {
    const inferredCpu = {
      cpu: { id: "cpu1", memoryType: "DDR5", memoryTypeExplicit: false },
      mobo: null,
      ram: { id: "ram1", type: "DDR4" },
      gpu: null,
      psu: null,
      pcCase: null,
    };
    const res = evaluateSelection(inferredCpu, { cpu: new Map(), gpu: new Map() });
    expect(res.issues.some((msg) => msg.toLowerCase().includes("no coincide") && msg.toLowerCase().includes("cpu"))).toBe(false);
  });

  // ─────[plan 014] Severity preservation ──────────────────────────────────

  it("records RAM speed warning in warnings array", () => {
    const ramFast = {
      cpu: { id: "cpu1", socket: "LGA1700", memoryType: "DDR5", memoryTypeExplicit: true, memory_support: { types: ["DDR5"] }, tdp: 125 },
      mobo: { id: "m1", socket: "LGA1700", memoryType: "DDR5", formFactor: "ATX", max_memory_speed_mts: 5600 },
      ram: { id: "ram1", type: "DDR5", modules: 2, speed_mts: 7200 },
      gpu: null,
      psu: null,
      pcCase: null,
    };
    const res = evaluateSelection(ramFast, { cpu: new Map(), gpu: new Map() });
    const ramMobo = res.statuses.find((s) => s.label === "RAM ↔ Mobo");
    expect(ramMobo?.warn).toBe(true);
    expect(ramMobo?.ok).toBe(true);
    expect(res.warnings.some((msg) => msg.toLowerCase().includes("máximo oficial"))).toBe(true);
    expect(res.summaryVerdict).toBe("warning");
  });

  it("derives summaryVerdict='ok' when all dimensions are valid", () => {
    const validAll = {
      cpu: { id: "cpu1", socket: "LGA1700", memoryType: "DDR5", memoryTypeExplicit: true, memory_support: { types: ["DDR5"] }, tdp: 125 },
      mobo: { id: "m1", socket: "LGA1700", memoryType: "DDR5", formFactor: "ATX" },
      ram: { id: "ram1", type: "DDR5", modules: 2 },
      gpu: { id: "gpu1", tdp: 220, length: 300, power_connectors: "2x 8-pin" },
      psu: { id: "psu1", wattage: 750, pcie_power_connectors: { "8_pin": 2 } },
      pcCase: { id: "case1", formFactors: ["ATX"], maxGpuLength: 320 },
    };
    const res = evaluateSelection(validAll, { cpu: new Map(), gpu: new Map() }, { extraHeadroomW: 50 });
    expect(res.summaryVerdict).toBe("ok");
    expect(res.issues.length).toBe(0);
    expect(res.warnings.length).toBe(0);
  });

  it("derives summaryVerdict='fail' when there is a hard incompatibility", () => {
    const badSocket = {
      cpu: { id: "cpu1", socket: "AM5", memoryType: "DDR5", memoryTypeExplicit: true, memory_support: { types: ["DDR5"] }, tdp: 125 },
      mobo: { id: "m1", socket: "LGA1700", memoryType: "DDR5", formFactor: "ATX" },
      ram: { id: "ram1", type: "DDR5" },
      gpu: { id: "gpu1", tdp: 220, length: 300, power_connectors: "2x 8-pin" },
      psu: { id: "psu1", wattage: 750, pcie_power_connectors: { "8_pin": 2 } },
      pcCase: { id: "case1", formFactors: ["ATX"], maxGpuLength: 320 },
    };
    const res = evaluateSelection(badSocket, { cpu: new Map(), gpu: new Map() });
    expect(res.summaryVerdict).toBe("fail");
    expect(res.issues.length).toBeGreaterThan(0);
  });

  it("derives summaryVerdict='unknown' when dimensions are missing", () => {
    const missingData = {
      cpu: { id: "cpu1", socket: "", memoryType: "DDR5", memoryTypeExplicit: true, memory_support: { types: ["DDR5"] }, tdp: 125 },
      mobo: { id: "m1", socket: "", memoryType: "DDR5", formFactor: "ATX" },
      ram: { id: "ram1", type: "DDR5" },
      gpu: null,
      psu: null,
      pcCase: null,
    };
    const res = evaluateSelection(missingData, { cpu: new Map(), gpu: new Map() });
    expect(res.summaryVerdict).toBe("unknown");
  });

  it("includes summaryVerdict in return value", () => {
    const res = evaluateSelection(selection, { cpu: new Map(), gpu: new Map() });
    expect(["ok", "warning", "unknown", "fail", "incomplete"]).toContain(res.summaryVerdict);
  });
});
