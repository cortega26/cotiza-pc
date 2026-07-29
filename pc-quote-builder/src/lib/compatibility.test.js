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

  it("valida RAM ↔ mobo — demasiados módulos", () => {
    const mobo2Slot = { ...mobo, memory_slots: 2 };
    const ram4Sticks = { ...ram, modules: 4 };
    expect(checkRamMoboCompatibility(ram4Sticks, mobo2Slot).compatible).toBe(false);
    expect(checkRamMoboCompatibility(ram4Sticks, mobo2Slot).reason).toContain("Excede");
  });

  it("valida RAM ↔ mobo — capacidad excede el límite", () => {
    const mobo64Gb = { ...mobo, max_memory_gb: 64 };
    const ram128Gb = { ...ram, capacity_gb_total: 128 };
    expect(checkRamMoboCompatibility(ram128Gb, mobo64Gb).compatible).toBe(false);
    expect(checkRamMoboCompatibility(ram128Gb, mobo64Gb).reason).toContain("Excede");
  });

  it("valida RAM ↔ mobo — velocidad sobre el máximo oficial (compatible con warning)", () => {
    const mobo5600 = { ...mobo, max_memory_speed_mts: 5600 };
    const ram7200 = { ...ram, speed_mts: 7200 };
    const res = checkRamMoboCompatibility(ram7200, mobo5600);
    expect(res.compatible).toBe(true);
    expect(res.status).toBe("warning");
  });

  it("valida RAM ↔ mobo — salta chequeo de slots si faltan datos en RAM o mobo", () => {
    const moboConSlots = { ...mobo, memory_slots: 2 };
    const ramSinModules = { type: "DDR5", capacity_gb_total: 32 };
    expect(checkRamMoboCompatibility(ramSinModules, moboConSlots).compatible).toBe(true);
    const moboSinSlots = { ...mobo };
    const ramConModules = { ...ram, modules: 4 };
    expect(checkRamMoboCompatibility(ramConModules, moboSinSlots).compatible).toBe(true);
  });

  it("valida RAM ↔ mobo — salta chequeo de capacidad si faltan datos", () => {
    const moboConMax = { ...mobo, max_memory_gb: 64 };
    const ramSinCap = { type: "DDR5", modules: 2 };
    expect(checkRamMoboCompatibility(ramSinCap, moboConMax).compatible).toBe(true);
    const moboSinMax = { ...mobo };
    const ramConCap = { ...ram, capacity_gb_total: 128 };
    expect(checkRamMoboCompatibility(ramConCap, moboSinMax).compatible).toBe(true);
  });

  it("valida RAM ↔ mobo — salta chequeo de velocidad si faltan datos", () => {
    const moboConSpeed = { ...mobo, max_memory_speed_mts: 5600 };
    const ramSinSpeed = { type: "DDR5", modules: 2, capacity_gb_total: 32 };
    expect(checkRamMoboCompatibility(ramSinSpeed, moboConSpeed).compatible).toBe(true);
    const moboSinSpeed = { ...mobo };
    const ramConSpeed = { ...ram, speed_mts: 7200 };
    expect(checkRamMoboCompatibility(ramConSpeed, moboSinSpeed).compatible).toBe(true);
  });

  it("valida RAM ↔ mobo — acepta camelCase en campos de límite de mobo", () => {
    const moboCamel = { ...mobo, maxMemoryGb: 64, maxMemorySpeedMts: 5600 };
    const ramSobrante = { type: "DDR5", modules: 2, capacity_gb_total: 128, speed_mts: 7200 };
    const resCap = checkRamMoboCompatibility(ramSobrante, moboCamel);
    expect(resCap.compatible).toBe(false);
    expect(resCap.reason).toContain("Excede");
  });

  it("valida GPU ↔ case", () => {
    expect(checkGpuCaseCompatibility(gpu, { max_gpu_length_mm: 320 }).compatible).toBe(true);
    expect(checkGpuCaseCompatibility(gpuLong, { max_gpu_length_mm: 320 }).compatible).toBe(false);
  });

  it("calcula PSU con margen 30% + 50W", () => {
    const resOk = checkPsuPowerSufficiency(psu, cpu, gpu);
    expect(resOk.status).toBe("ok");
    const resWarn = checkPsuPowerSufficiency(psuTight, cpu, gpu);
    expect(resWarn.status).toBe("warning");
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
