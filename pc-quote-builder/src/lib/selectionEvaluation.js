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
  return msg.includes("faltan datos") || msg.includes("no se pudo validar") || msg.includes("desconocido");
};

const resolveStatus = (result) => {
  if (result.status) return result.status;
  if (!result.compatible) return isUnknownReason(result.reason) ? "unknown" : "fail";
  return "ok";
};

const memoryMismatch = (cpu, ram) => {
  if (!cpu?.memoryTypeExplicit) return "";
  return cpu?.memoryType && ram?.type && cpu.memoryType !== ram.type
    ? `La RAM (${ram.type}) no coincide con lo que soporta el CPU (${cpu.memoryType}).`
    : "";
};

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
  const warnings = [];
  const info = [];

  const pushStatus = (label, ok, unknown = false, warn = false) => statuses.push({ label, ok, unknown, warn });
  const recordInfo = (reason) => reason && info.push(reason);

  const recordCheck = (label, result) => {
    const st = resolveStatus(result);
    pushStatus(label, st === "ok" || st === "warning", st === "unknown", st === "warning");
    if (st === "fail") issues.push(result.reason || "Fallo de compatibilidad");
    else if (st === "warning") warnings.push(result.reason || "Advertencia");
    else if (st === "unknown") recordInfo(result.reason || "No se pudo verificar");
  };

  const cpuMobo = checkCpuMoboCompatibility(selection.cpu, selection.mobo);
  if (selection.cpu && selection.mobo) {
    recordCheck("CPU ↔ Mobo", cpuMobo);
  }

  const ramMobo = checkRamMoboCompatibility(selection.ram, selection.mobo);
  if (selection.ram && selection.mobo) {
    recordCheck("RAM ↔ Mobo", ramMobo);
  }

  if (selection.cpu && selection.ram && !selection.mobo) {
    const cpuRamIssue = memoryMismatch(selection.cpu, selection.ram);
    if (cpuRamIssue) {
      warnings.push(cpuRamIssue);
      pushStatus("CPU ↔ RAM (sin mobo)", false, false, true);
    }
  }

  const moboCase = checkMoboCaseCompatibility(selection.mobo, selection.pcCase);
  if (selection.mobo && selection.pcCase) {
    recordCheck("Mobo ↔ Case", moboCase);
  }

  const gpuCase = checkGpuCaseCompatibility(selection.gpu, selection.pcCase);
  if (selection.gpu || selection.pcCase) {
    const hasBoth = Boolean(selection.gpu && selection.pcCase);
    const gpuCaseStatus = hasBoth ? resolveStatus(gpuCase) : "unknown";
    pushStatus("GPU ↔ Case", hasBoth && gpuCaseStatus !== "fail", !hasBoth || gpuCaseStatus === "unknown", hasBoth && gpuCaseStatus === "warning");
    if (hasBoth) {
      if (gpuCaseStatus === "fail") issues.push(gpuCase.reason || "La GPU no cabe en el gabinete");
      else if (gpuCaseStatus === "unknown") recordInfo(gpuCase.reason || "No se pudo verificar");
    }
    if (!hasBoth) {
      recordInfo("No se pudo validar fit GPU↔gabinete: falta GPU o gabinete.");
    }
  }

  if (selection.cpu && selection.gpu && selection.psu) {
    const unknown = psuStatus.status === "unknown";
    pushStatus("PSU potencia", psuStatus.status === "ok", unknown, psuStatus.status === "warning");
    if (psuStatus.status === "fail") {
      issues.push(
        psuStatus.reason ||
          `La fuente queda por debajo de lo recomendado (${psuStatus.recommended_min_psu_w}W sugeridos).`
      );
    }
    if (psuStatus.status === "warning") {
      warnings.push(
        `Poco margen en la PSU; sugerido ${psuStatus.recommended_min_psu_w}W para ${psuStatus.estimated_load_w}W estimados.`
      );
    }
  }

  if (selection.psu || selection.gpu) {
    const unknown = connectorStatus.status === "unknown";
    const hasBoth = Boolean(selection.psu && selection.gpu);
    const connOk = hasBoth && connectorStatus.status === "ok";
    const connWarn = hasBoth && connectorStatus.status === "warning";
    pushStatus("PSU conectores", connOk, unknown || !hasBoth, connWarn);
    if (connectorStatus.status === "fail" && !unknown) issues.push(connectorStatus.reason || "Faltan conectores PCIe");
    if (!hasBoth) recordInfo("No se pudo validar conectores PSU↔GPU: falta PSU o GPU.");
    if (unknown && connectorStatus.reason) recordInfo(connectorStatus.reason);
  }

  if (selection.gpu?.psuMin && selection.psu && selection.psu.wattage < selection.gpu.psuMin) {
    warnings.push(`La GPU sugiere ${selection.gpu.psuMin}W y la fuente elegida es de ${selection.psu.wattage}W.`);
  }

  const hasFail = statuses.some((s) => !s.ok && !s.unknown && !s.warn);
  const hasWarn = statuses.some((s) => s.warn);
  const hasUnknown = statuses.some((s) => s.unknown);
  const allOk = statuses.length > 0 && statuses.every((s) => s.ok && !s.warn && !s.unknown);

  let summaryVerdict;
  if (hasFail) summaryVerdict = "fail";
  else if (hasWarn) summaryVerdict = "warning";
  else if (hasUnknown) summaryVerdict = "unknown";
  else if (allOk) summaryVerdict = "ok";
  else summaryVerdict = "incomplete";

  const selectionChips = buildSelectionChips(selection);

  return { power, psuStatus, connectorStatus, balance, statuses, issues, warnings, info, selectionChips, tierMaps, summaryVerdict };
}
