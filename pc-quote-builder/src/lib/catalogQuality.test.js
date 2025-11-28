import { describe, expect, it } from "vitest";
import catalog from "../data/catalog.json";

describe("catalog quality guardrails", () => {
  it("tiene sockets y tipos de memoria en la mayoría de CPUs", () => {
    const total = catalog.cpus.length;
    const missingSocket = catalog.cpus.filter((cpu) => !cpu.socket).length;
    const missingMemory = catalog.cpus.filter((cpu) => !cpu.memoryType).length;
    expect(missingSocket / total).toBeLessThan(0.2);
    expect(missingMemory / total).toBeLessThan(0.2);
  });

  it("tiene PSU sugerida para GPUs con TDP alto", () => {
    const highTdp = catalog.gpus.filter((gpu) => (gpu.tdp || 0) >= 200);
    const missingPsuMin = highTdp.filter((gpu) => !gpu.psuMin).length;
    expect(missingPsuMin / Math.max(highTdp.length, 1)).toBeLessThan(0.3);
  });
});
