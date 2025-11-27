import { describe, expect, it } from "vitest";
import {
  checkCpuMoboCompatibility,
  checkRamMoboCompatibility,
  checkPsuPowerSufficiency,
  estimateCpuGpuBalance,
  checkGpuCaseCompatibility,
  checkPsuConnectors,
  estimatePowerEnvelope,
} from "./compatibility";

describe("compatibility helpers", () => {
  const cpu = { socket: "LGA1700", memory_support: { types: ["DDR5"] }, tdp_w: 125, cores: 8, boost_clock_ghz: 5.0 };
  const mobo = { socket: "LGA1700", memory_type: "DDR5", form_factor: "ATX", max_gpu_length_mm: 320 };
  const ram = { type: "DDR5", modules: 2, capacity_gb_total: 32 };
  const ramBad = { type: "DDR4" };
  const gpu = { tdp_w: 220, board_length_mm: 310, suggested_psu_w: 750, vram_gb: 12 };
  const gpuLong = { ...gpu, board_length_mm: 400 };
  const psu = { wattage_w: 850, pcie_power_connectors: { "8_pin": 2 } };
  const psuTight = { wattage_w: 650, pcie_power_connectors: { "8_pin": 1 } };

  it("valida CPU ↔ mobo", () => {
    expect(checkCpuMoboCompatibility(cpu, mobo).compatible).toBe(true);
    expect(checkCpuMoboCompatibility({ ...cpu, socket: "AM5" }, mobo).compatible).toBe(false);
  });

  it("valida RAM ↔ mobo", () => {
    expect(checkRamMoboCompatibility(ram, mobo).compatible).toBe(true);
    expect(checkRamMoboCompatibility(ramBad, mobo).compatible).toBe(false);
  });

  it("valida GPU ↔ case", () => {
    expect(checkGpuCaseCompatibility(gpu, { max_gpu_length_mm: 320 }).compatible).toBe(true);
    expect(checkGpuCaseCompatibility(gpuLong, { max_gpu_length_mm: 320 }).compatible).toBe(false);
  });

  it("calcula PSU con margen 30% + 50W", () => {
    const resOk = checkPsuPowerSufficiency(psu, cpu, gpu);
    expect(resOk.status).toBe("ok");
    const resWarn = checkPsuPowerSufficiency(psuTight, cpu, gpu);
    expect(resWarn.status === "warn" || resWarn.status === "fail").toBe(true);
  });

  it("estima balance CPU/GPU por tiers", () => {
    const res = estimateCpuGpuBalance(cpu, gpu);
    expect(["balanced", "cpu_limited", "gpu_limited", "unknown"]).toContain(res.balance);
  });

  it("estima potencia mínima respetando 30% + 50W base", () => {
    const res = estimatePowerEnvelope(cpu, gpu, 50);
    expect(res.estimated_load_w).toBeGreaterThan(0);
    expect(res.recommended_min_psu_w % 50).toBe(0);
    expect(res.recommended_min_psu_w).toBeGreaterThan(res.estimated_load_w);
  });

  it("valida conectores PSU ↔ GPU", () => {
    expect(checkPsuConnectors(psu, { ...gpu, power_connectors: "2x 8-pin" }).status).toBe("ok");
    expect(checkPsuConnectors(psuTight, { ...gpu, power_connectors: "2x 8-pin" }).status).toBe("fail");
  });
});
