import {
  checkCpuMoboCompatibility,
  checkGpuCaseCompatibility,
  checkMoboCaseCompatibility,
  checkPsuConnectors,
  checkPsuPowerSufficiency,
  checkRamMoboCompatibility,
  estimateCpuGpuBalance,
  estimatePowerEnvelope,
} from "./compatibility";

const isUnknownReason = (reason = "") => {
  const msg = reason.toLowerCase();
  return msg.includes("faltan datos") || msg.includes("no se pudo validar");
};

const memoryMismatch = (cpu, ram) =>
  cpu?.memoryType && ram?.type && cpu.memoryType !== ram.type
    ? `La RAM (${ram.type}) no coincide con lo que soporta el CPU (${cpu.memoryType}).`
    : "";

export function buildSelectionChips(selection) {
  const chips = [];
  if (selection.cpu) {
    chips.push({
      label: "CPU",
      value: `${selection.cpu.socket || "?"}${selection.cpu.memoryType ? ` · ${selection.cpu.memoryType}` : ""}`,
    });
  }
  if (selection.mobo) {
    chips.push({
      label: "Mobo",
      value: `${selection.mobo.socket || "?"}${selection.mobo.memoryType ? ` · ${selection.mobo.memoryType}` : ""}`,
    });
  }
  if (selection.ram) {
    chips.push({ label: "RAM", value: selection.ram.type || "?" });
  }
  return chips;
}

export function evaluateSelection(selection, tierMaps, options = {}) {
  const extraHeadroomW = options.extraHeadroomW ?? 50;

  const power = estimatePowerEnvelope(selection.cpu, selection.gpu, extraHeadroomW);
  const psuStatus = selection.psu
    ? checkPsuPowerSufficiency(selection.psu, selection.cpu, selection.gpu, extraHeadroomW)
    : { status: "unknown", ...power };
  const connectorStatus =
    selection.psu && selection.gpu ? checkPsuConnectors(selection.psu, selection.gpu) : { status: "unknown" };
  const balance = estimateCpuGpuBalance(selection.cpu, selection.gpu);

  const statuses = [];
  const issues = [];

  const pushStatus = (label, ok, unknown = false) => statuses.push({ label, ok, unknown });

  const cpuMobo = checkCpuMoboCompatibility(selection.cpu, selection.mobo);
  if (selection.cpu && selection.mobo) {
    pushStatus("CPU ↔ Mobo", cpuMobo.compatible, isUnknownReason(cpuMobo.reason));
    if (!cpuMobo.compatible && !isUnknownReason(cpuMobo.reason)) issues.push(cpuMobo.reason);
  }

  const ramMobo = checkRamMoboCompatibility(selection.ram, selection.mobo);
  if (selection.ram && selection.mobo) {
    pushStatus("RAM ↔ Mobo", ramMobo.compatible, isUnknownReason(ramMobo.reason));
    if (!ramMobo.compatible && !isUnknownReason(ramMobo.reason)) issues.push(ramMobo.reason);
  }

  const cpuRamIssue = memoryMismatch(selection.cpu, selection.ram);
  if (cpuRamIssue) issues.push(cpuRamIssue);

  const moboCase = checkMoboCaseCompatibility(selection.mobo, selection.pcCase);
  if (selection.mobo && selection.pcCase) {
    pushStatus("Mobo ↔ Case", moboCase.compatible, isUnknownReason(moboCase.reason));
    if (!moboCase.compatible && !isUnknownReason(moboCase.reason)) issues.push(moboCase.reason);
  }

  const gpuCase = checkGpuCaseCompatibility(selection.gpu, selection.pcCase);
  if (selection.gpu && selection.pcCase) {
    pushStatus("GPU ↔ Case", gpuCase.compatible, isUnknownReason(gpuCase.reason));
    if (!gpuCase.compatible && !isUnknownReason(gpuCase.reason)) issues.push(gpuCase.reason);
  }

  if (selection.cpu && selection.gpu && selection.psu) {
    const unknown = psuStatus.status === "unknown";
    pushStatus("PSU potencia", psuStatus.status === "ok", unknown);
    if (psuStatus.status === "fail") {
      issues.push(
        psuStatus.reason ||
          `La fuente queda por debajo de lo recomendado (${psuStatus.recommended_min_psu_w}W sugeridos).`
      );
    }
    if (psuStatus.status === "warn") {
      issues.push(
        `Poco margen en la PSU; sugerido ${psuStatus.recommended_min_psu_w}W para ${psuStatus.estimated_load_w}W estimados.`
      );
    }
  }

  if (selection.psu && selection.gpu) {
    const unknown = connectorStatus.status === "unknown";
    pushStatus("PSU conectores", connectorStatus.status === "ok", unknown);
    if (connectorStatus.status === "fail" && !unknown) issues.push(connectorStatus.reason || "Faltan conectores PCIe");
  }

  if (selection.gpu?.psuMin && selection.psu && selection.psu.wattage < selection.gpu.psuMin) {
    issues.push(`La GPU sugiere ${selection.gpu.psuMin}W y la fuente elegida es de ${selection.psu.wattage}W.`);
  }

  const selectionChips = buildSelectionChips(selection);

  return { power, psuStatus, connectorStatus, balance, statuses, issues, selectionChips, tierMaps };
}
