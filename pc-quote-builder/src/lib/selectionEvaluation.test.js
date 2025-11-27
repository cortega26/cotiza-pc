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
    expect(result.issues.some((msg) => msg.toLowerCase().includes("psu"))).toBe(true);
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
});
