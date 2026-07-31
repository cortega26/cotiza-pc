/**
 * Report builder: maps the assembled selection through the existing
 * compatibility checks into the versioned finding model.
 *
 * Evidence rules (design §4.3): a check runs only when its component sides
 * are present; a check whose required catalog fields are null emits an
 * `unsupported` evidence-gap finding (severity info, confidence low) instead
 * of fabricating a conclusion. "Missing input never becomes ok". The
 * existing compatibility functions are called directly, never duplicated and
 * never modified; checks with vacuous-ok behavior are guarded at the call
 * site (power TDP and RAM memory-type).
 *
 * Verdict precedence (approved defaults): fail > warning > unknown > ok >
 * incomplete. A fully `ok` verdict requires all six required components
 * (CPU, motherboard, RAM, PSU, case, and a resolved GPU or confirmed
 * integrated graphics). Missing inputs degrade dimensions to unknown;
 * nothing assessable at all degrades the verdict to incomplete.
 *
 * Pure: no Date.now(), no state, no mutation. All timestamps are compared
 * against the caller-supplied evaluatedAt.
 */
import {
  PRICE_STALE_DAYS,
  REQUIRED_COMPONENTS,
  RULES_VERSION,
} from "./contracts";
import {
  checkCpuMoboCompatibility,
  checkGpuCaseCompatibility,
  checkMoboCaseCompatibility,
  checkPsuConnectors,
  checkPsuPowerSufficiency,
  checkRamMoboCompatibility,
} from "../compatibility";
import { normalizeCurrency, parsePrice } from "../money";

const DAY_MS = 86_400_000;
const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 };
const STATUS_RANK = { ok: 0, unknown: 1, warning: 2, fail: 3 };

const COMPONENT_LABELS = Object.freeze({
  cpu: "CPU",
  mobo: "placa madre",
  ram: "memoria RAM",
  gpu: "tarjeta de video",
  psu: "fuente de poder",
  pcCase: "gabinete",
});

const COMPONENT_ACTIONS = Object.freeze({
  cpu: "Agregar el procesador a la cotización.",
  mobo: "Agregar la placa madre a la cotización.",
  ram: "Agregar la memoria RAM a la cotización.",
  gpu: "Agregar la tarjeta de video o confirmar el uso de gráficos integrados.",
  psu: "Agregar la fuente de poder a la cotización.",
  pcCase: "Agregar el gabinete a la cotización.",
});

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

function daysSince(timestamp, evaluatedAt) {
  if (!timestamp) return null;
  const t = Date.parse(timestamp);
  const now = Date.parse(evaluatedAt);
  if (Number.isNaN(t) || Number.isNaN(now)) return null;
  return Math.max(0, Math.floor((now - t) / DAY_MS));
}

function worstStatus(statuses) {
  const present = statuses.filter(Boolean);
  if (present.length === 0) return null;
  return present.reduce((worst, s) => (STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst));
}

/**
 * Evidence quality for a finding: user-confirmed rows lower confidence to
 * medium; all-affected-user-mapped findings record source "user".
 */
function evidenceFor(affectedKeys, userMappedKeys, defaultSource, fieldInferred = false) {
  const mapped = affectedKeys.filter((key) => userMappedKeys.has(key));
  const allMapped = affectedKeys.length > 0 && mapped.length === affectedKeys.length;
  const source = allMapped ? "user" : defaultSource;
  const confidence = mapped.length > 0 || fieldInferred ? "medium" : "high";
  return { source, confidence };
}

/**
 * @typedef {object} ReportContext
 * @property {Record<string, object|undefined>} selection
 * @property {Record<string, string>} gaps
 * @property {boolean} integratedGpu
 * @property {Array<object>} resolutions
 * @property {object} quote input.quote
 * @property {object} catalog input.catalog
 * @property {object} catalogMeta input.catalogMeta
 * @property {string} evaluatedAt input.evaluatedAt
 */

/**
 * Build dimensions, findings, and verdict.
 * @param {ReportContext} context
 * @returns {{ verdict: object, dimensions: object, findings: Array<object> }}
 */
export function buildReport(context) {
  const {
    selection,
    gaps,
    integratedGpu,
    resolutions,
    quote,
    catalog,
    catalogMeta,
    evaluatedAt,
  } = context;

  const userMappedKeys = new Set(
    resolutions
      .filter((resolution) => resolution.state === "user-mapped")
      .map((resolution) => resolution.componentKey)
  );
  const catalogGeneratedAt = catalogMeta?.generatedAt ?? catalog?.meta?.generatedAt ?? null;
  const quotePriceUpdatedAt = quote?.priceUpdatedAt ?? null;
  const currency = normalizeCurrency(quote?.currency);
  const findings = [];
  const rowIdsForKey = (key) =>
    resolutions.filter((resolution) => resolution.componentKey === key).map((resolution) => resolution.rowId);

  const pushFinding = (finding) => {
    findings.push({
      ...finding,
      evidence: {
        sourceFields: finding.evidence.sourceFields,
        source: finding.evidence.source,
        freshness: { catalogGeneratedAt, quotePriceUpdatedAt },
        ruleVersion: RULES_VERSION,
      },
    });
  };

  const unsupportedGap = (id, dimension, affectedKeys, defaultSource, conclusion, explanation, action) => {
    const { source } = evidenceFor(affectedKeys, userMappedKeys, defaultSource);
    pushFinding({
      id,
      dimension,
      severity: "info",
      conclusion,
      affected: affectedKeys,
      decisionType: "unsupported",
      evidence: { sourceFields: [], source },
      confidence: "low",
      explanation,
      action,
    });
  };

  const compatStatuses = [];
  const caseFitStatuses = [];

  // ---- compatibility checks -------------------------------------------------

  if (selection.cpu && selection.mobo) {
    const result = checkCpuMoboCompatibility(selection.cpu, selection.mobo);
    compatStatuses.push(result.status);
    if (result.status === "fail") {
      const { source, confidence } = evidenceFor(["cpu", "mobo"], userMappedKeys, "catalog");
      pushFinding({
        id: "compat-cpu-mobo-socket",
        dimension: "compatibility",
        severity: "critical",
        conclusion: `El socket del CPU (${selection.cpu.socket}) no coincide con el de la placa madre (${selection.mobo.socket}).`,
        affected: ["cpu", "mobo"],
        decisionType: "deterministic",
        evidence: { sourceFields: ["cpu.socket", "mobo.socket"], source },
        confidence,
        explanation: "Un CPU y una placa madre con sockets distintos no pueden instalarse juntos.",
        action: "Reemplazar el CPU o la placa madre por uno compatible.",
      });
    } else if (result.status === "unknown") {
      unsupportedGap(
        "compat-cpu-mobo-socket",
        "compatibility",
        ["cpu", "mobo"],
        "catalog",
        "No se pudo validar la compatibilidad de socket entre CPU y placa madre: faltan datos del catálogo.",
        "Sin los sockets de ambos componentes no se puede confirmar ni descartar la incompatibilidad.",
        "Completar la información del producto o elegir otro componente."
      );
    }
  }

  if (selection.cpu && selection.ram) {
    const cpuMemory = selection.cpu.memoryType;
    const ramType = selection.ram.type;
    if (!cpuMemory || !ramType) {
      compatStatuses.push("unknown");
      unsupportedGap(
        "compat-cpu-ram-memory",
        "compatibility",
        ["cpu", "ram"],
        "catalog",
        "No se pudo verificar el tipo de memoria entre CPU y RAM: faltan datos.",
        "Sin el tipo de memoria de ambos componentes no se puede confirmar la compatibilidad.",
        "Completar la información del producto o elegir otro componente."
      );
    } else if (cpuMemory !== ramType) {
      const { source, confidence } = evidenceFor(["cpu", "ram"], userMappedKeys, "catalog", !selection.cpu.memoryTypeExplicit);
      compatStatuses.push("fail");
      pushFinding({
        id: "compat-cpu-ram-memory",
        dimension: "compatibility",
        severity: "critical",
        conclusion: `El CPU soporta memoria ${cpuMemory} y la RAM es ${ramType}.`,
        affected: ["cpu", "ram"],
        decisionType: "deterministic",
        evidence: { sourceFields: ["cpu.memoryType", "ram.type"], source },
        confidence,
        explanation: "El tipo de memoria debe coincidir con lo que soporta el procesador.",
        action: "Cambiar la RAM o el CPU para que usen el mismo tipo de memoria.",
      });
    } else {
      compatStatuses.push("ok");
    }
  }

  if (selection.ram && selection.mobo) {
    const result = checkRamMoboCompatibility(selection.ram, selection.mobo);
    const memoryFieldsMissing = !selection.ram.type || !selection.mobo.memoryType;
    if (result.status === "ok" && memoryFieldsMissing) {
      compatStatuses.push("unknown");
      unsupportedGap(
        "compat-mobo-ram-memory",
        "compatibility",
        ["ram", "mobo"],
        "catalog",
        "No se pudo verificar el tipo de memoria entre placa madre y RAM: faltan datos.",
        "Sin el tipo de memoria de ambos componentes no se puede confirmar la compatibilidad.",
        "Completar la información del producto o elegir otro componente."
      );
    } else {
      compatStatuses.push(result.status);
      if (result.status === "fail") {
        const { source, confidence } = evidenceFor(["ram", "mobo"], userMappedKeys, "catalog");
        pushFinding({
          id: "compat-mobo-ram-memory",
          dimension: "compatibility",
          severity: "critical",
          conclusion: result.reason || "La RAM no es compatible con la placa madre.",
          affected: ["ram", "mobo"],
          decisionType: "deterministic",
          evidence: {
            sourceFields: ["mobo.memoryType", "ram.type", "mobo.memory_slots", "mobo.max_memory_gb", "mobo.max_memory_speed_mts"],
            source,
          },
          confidence,
          explanation: "La placa madre limita el tipo, la cantidad y la velocidad de la memoria.",
          action: "Elegir una RAM compatible con la placa madre.",
        });
      } else if (result.status === "warning") {
        const { source, confidence } = evidenceFor(["ram", "mobo"], userMappedKeys, "catalog", !selection.mobo.memoryTypeExplicit);
        pushFinding({
          id: "compat-mobo-ram-memory",
          dimension: "compatibility",
          severity: "warning",
          conclusion: result.reason || "La velocidad de la RAM supera el máximo oficial de la placa madre.",
          affected: ["ram", "mobo"],
          decisionType: "deterministic",
          evidence: {
            sourceFields: ["ram.speed_mts", "mobo.max_memory_speed_mts"],
            source,
          },
          confidence,
          explanation: "Puede requerir ajustes manuales o no alcanzar su velocidad anunciada.",
          action: "Revisar la velocidad soportada por la placa madre.",
        });
      }
    }
  }

  // ---- case-fit checks ------------------------------------------------------

  if (selection.mobo && selection.pcCase) {
    const result = checkMoboCaseCompatibility(selection.mobo, selection.pcCase);
    caseFitStatuses.push(result.status);
    if (result.status === "fail") {
      const fieldInferred = (selection.pcCase.formFactorEvidence ?? "unknown") === "unknown";
      const { source, confidence } = evidenceFor(["mobo", "pcCase"], userMappedKeys, "catalog", fieldInferred);
      pushFinding({
        id: "compat-mobo-case-ff",
        dimension: "caseFit",
        severity: "critical",
        conclusion: `El gabinete no soporta el factor de forma de la placa madre (${selection.mobo.formFactor}).`,
        affected: ["mobo", "pcCase"],
        decisionType: "deterministic",
        evidence: { sourceFields: ["mobo.formFactor", "pcCase.formFactors"], source },
        confidence,
        explanation: "La placa madre no cabe físicamente en ese gabinete.",
        action: "Elegir un gabinete que soporte el factor de forma de la placa madre.",
      });
    } else if (result.status === "unknown") {
      unsupportedGap(
        "compat-mobo-case-ff",
        "caseFit",
        ["mobo", "pcCase"],
        "catalog",
        "No se pudo verificar el factor de forma entre placa madre y gabinete: faltan datos.",
        "Sin el factor de forma o los formatos soportados no se puede confirmar el ajuste.",
        "Completar la información del producto o elegir otro componente."
      );
    }
  }

  if (selection.gpu && selection.pcCase) {
    const result = checkGpuCaseCompatibility(selection.gpu, selection.pcCase);
    caseFitStatuses.push(result.status);
    if (result.status === "fail") {
      const { source, confidence } = evidenceFor(["gpu", "pcCase"], userMappedKeys, "catalog");
      pushFinding({
        id: "compat-gpu-case-length",
        dimension: "caseFit",
        severity: "critical",
        conclusion: `La GPU mide ${selection.gpu.length} mm y el gabinete admite hasta ${selection.pcCase.maxGpuLength} mm.`,
        affected: ["gpu", "pcCase"],
        decisionType: "deterministic",
        evidence: { sourceFields: ["gpu.length", "pcCase.maxGpuLength"], source },
        confidence,
        explanation: "La tarjeta de video no cabe físicamente en el gabinete.",
        action: "Elegir una GPU más corta o un gabinete con más espacio.",
      });
    } else if (result.status === "unknown") {
      unsupportedGap(
        "compat-gpu-case-length",
        "caseFit",
        ["gpu", "pcCase"],
        "catalog",
        "No se pudo verificar el largo de la GPU contra el gabinete: faltan datos.",
        "Sin el largo de la GPU o el máximo del gabinete no se puede confirmar el ajuste.",
        "Completar la información del producto o elegir otro componente."
      );
    }
  }

  // ---- power and connectors -------------------------------------------------

  const powerStatuses = [];
  const connectorStatuses = [];

  if (selection.cpu && selection.gpu && selection.psu) {
    const hasTdp = isFiniteNumber(selection.cpu.tdp_w ?? selection.cpu.tdp) &&
      isFiniteNumber(selection.gpu.tdp_w ?? selection.gpu.tdp);
    const hasWattage = isFiniteNumber(selection.psu.wattage_w ?? selection.psu.wattage);
    if (!hasTdp || !hasWattage) {
      powerStatuses.push("unknown");
      const { source } = evidenceFor(["cpu", "gpu", "psu"], userMappedKeys, "catalog");
      pushFinding({
        id: "power-psu-headroom",
        dimension: "power",
        severity: "info",
        conclusion: "No se pudo estimar el consumo: faltan datos de TDP o de la fuente de poder.",
        affected: ["cpu", "gpu", "psu"],
        decisionType: "unsupported",
        evidence: { sourceFields: ["cpu.tdp", "gpu.tdp", "psu.wattage"], source },
        confidence: "low",
        explanation: "Sin el consumo del CPU y la GPU no se puede concluir si la fuente es suficiente.",
        action: "Completar la información del producto o elegir otro componente.",
      });
    } else {
      const result = checkPsuPowerSufficiency(selection.psu, selection.cpu, selection.gpu);
      powerStatuses.push(result.status);
      const { source, confidence } = evidenceFor(["cpu", "gpu", "psu"], userMappedKeys, "catalog");
      const affected = ["cpu", "gpu", "psu"];
      if (result.status === "fail") {
        pushFinding({
          id: "power-psu-headroom",
          dimension: "power",
          severity: "critical",
          conclusion: `La fuente de ${selection.psu.wattage}W queda bajo el consumo estimado de ${result.estimated_load_w}W (se recomienda ${result.recommended_min_psu_w}W).`,
          affected,
          decisionType: "derived",
          evidence: { sourceFields: ["cpu.tdp", "gpu.tdp", "psu.wattage"], source },
          confidence,
          explanation: "Una fuente insuficiente puede apagar el equipo o dañar componentes.",
          action: `Cambiar la fuente por una de al menos ${result.recommended_min_psu_w}W.`,
        });
      } else if (result.status === "warning") {
        pushFinding({
          id: "power-psu-headroom",
          dimension: "power",
          severity: "warning",
          conclusion: `La fuente de ${selection.psu.wattage}W tiene poco margen sobre el consumo estimado de ${result.estimated_load_w}W (se recomienda ${result.recommended_min_psu_w}W).`,
          affected,
          decisionType: "derived",
          evidence: { sourceFields: ["cpu.tdp", "gpu.tdp", "psu.wattage"], source },
          confidence,
          explanation: "El margen es ajustado; cargas puntuales pueden superar la fuente.",
          action: `Considerar una fuente de al menos ${result.recommended_min_psu_w}W.`,
        });
      } else {
        const psuMin = selection.gpu.psuMin ?? selection.gpu.recommended_psu_w ?? selection.gpu.suggested_psu_w;
        const wattage = selection.psu.wattage_w ?? selection.psu.wattage;
        if (isFiniteNumber(psuMin) && isFiniteNumber(wattage) && wattage < psuMin) {
          powerStatuses.push("warning");
          pushFinding({
            id: "power-psu-headroom",
            dimension: "power",
            severity: "warning",
            conclusion: `La GPU sugiere una fuente de ${psuMin}W y la elegida es de ${wattage}W.`,
            affected,
            decisionType: "derived",
            evidence: { sourceFields: ["gpu.psuMin", "psu.wattage"], source },
            confidence,
            explanation: "El fabricante de la GPU recomienda una fuente mayor a la seleccionada.",
            action: `Cambiar la fuente por una de al menos ${psuMin}W.`,
          });
        }
      }
    }
  }

  if (selection.psu && selection.gpu) {
    const result = checkPsuConnectors(selection.psu, selection.gpu);
    connectorStatuses.push(result.status);
    const { source, confidence } = evidenceFor(["psu", "gpu"], userMappedKeys, "catalog");
    if (result.status === "fail") {
      pushFinding({
        id: "power-connectors-pcie",
        dimension: "connectors",
        severity: "critical",
        conclusion: result.reason || "La fuente no tiene los conectores PCIe que pide la GPU.",
        affected: ["psu", "gpu"],
        decisionType: "deterministic",
        evidence: { sourceFields: ["psu.pcie_power_connectors", "gpu.power_connectors"], source },
        confidence,
        explanation: "Sin los conectores adecuados la tarjeta de video no recibe energía.",
        action: "Cambiar la fuente o usar los adaptadores incluidos con la GPU.",
      });
    } else if (result.status === "unknown") {
      pushFinding({
        id: "power-connectors-pcie",
        dimension: "connectors",
        severity: "info",
        conclusion: result.reason || "No se pudo verificar los conectores PCIe de la fuente.",
        affected: ["psu", "gpu"],
        decisionType: "unsupported",
        evidence: { sourceFields: ["psu.pcie_power_connectors", "gpu.power_connectors"], source },
        confidence: "low",
        explanation: "Sin los datos de conectores no se puede confirmar que la GPU reciba energía.",
        action: "Completar la información del producto o elegir otro componente.",
      });
    }
  }

  // ---- completeness ---------------------------------------------------------

  const supportedRows = resolutions.filter((resolution) => resolution.componentKey);
  const unsupportedRows = resolutions.filter((resolution) => resolution.state === "unsupported-category");

  if (unsupportedRows.length > 0) {
    const rowIds = unsupportedRows.map((resolution) => resolution.rowId);
    pushFinding({
      id: "completeness-unsupported-category",
      dimension: "completeness",
      severity: "info",
      conclusion:
        unsupportedRows.length === 1
          ? "La cotización incluye una categoría que v1 no evalúa (por ejemplo, cooler, almacenamiento o monitor)."
          : `La cotización incluye ${unsupportedRows.length} categorías que v1 no evalúa (por ejemplo, cooler, almacenamiento o monitor).`,
      affected: rowIds,
      decisionType: "unsupported",
      evidence: { sourceFields: ["quote.rows[].category"], source: "quote" },
      confidence: "high",
      explanation: "Solo se evalúan CPU, placa madre, RAM, tarjeta de video, fuente y gabinete.",
      action: "Revisar manualmente las categorías fuera de alcance.",
    });
  }

  const requiredMissing = [];
  const requiredUnresolved = [];
  for (const key of REQUIRED_COMPONENTS) {
    if (selection[key]) continue;
    const isGpuSatisfiedByIntegrated = key === "gpu" && integratedGpu;
    if (isGpuSatisfiedByIntegrated) continue;
    const gap = gaps[key];
    if (gap === "ambiguous" || gap === "unmatched" || gap === "duplicate") {
      requiredUnresolved.push(key);
    } else {
      requiredMissing.push(key);
    }
  }

  for (const key of requiredMissing) {
    pushFinding({
      id: "completeness-missing-required",
      dimension: "completeness",
      severity: "critical",
      conclusion: `Falta el componente requerido: ${COMPONENT_LABELS[key]}.`,
      affected: [key],
      decisionType: "deterministic",
      evidence: { sourceFields: ["quote.rows"], source: "rule" },
      confidence: "high",
      explanation:
        key === "gpu"
          ? "Sin tarjeta de video ni confirmación de gráficos integrados no se puede verificar la validez técnica."
          : "Un PC de escritorio para gaming requiere este componente para una verificación técnica completa.",
      action: COMPONENT_ACTIONS[key],
    });
  }

  for (const key of requiredUnresolved) {
    const gap = gaps[key];
    pushFinding({
      id: "completeness-required-resolution-gap",
      dimension: "completeness",
      severity: "warning",
      conclusion: `El componente ${COMPONENT_LABELS[key]} no se pudo identificar con certeza y queda fuera del análisis.`,
      affected: [key, ...rowIdsForKey(key)],
      decisionType: "derived",
      evidence: { sourceFields: ["quote.rows"], source: "rule" },
      confidence: "high",
      explanation:
        gap === "duplicate"
          ? "La cotización tiene más de una fila que resuelve al mismo componente; ninguna se usa sin confirmación."
          : "El texto de la cotización no basta para confirmar el producto; se necesita confirmación del usuario.",
      action: "Confirmar manualmente el producto de la cotización.",
    });
  }

  // ---- price findings -------------------------------------------------------

  const rows = Array.isArray(quote?.rows) ? quote.rows : [];
  const unpricedRowIds = [];
  rows.forEach((row, index) => {
    const hasOffer = parsePrice(row?.offerPrice, currency).status === "valid";
    const hasRegular = parsePrice(row?.regularPrice, currency).status === "valid";
    if (!hasOffer && !hasRegular) unpricedRowIds.push(row?.id ?? `#${index}`);
  });

  if (rows.length > 0 && unpricedRowIds.length > 0) {
    pushFinding({
      id: "price-completeness-rows",
      dimension: "priceCompleteness",
      severity: "warning",
      conclusion:
        unpricedRowIds.length === 1
          ? "Hay una fila sin precio válido."
          : `Hay ${unpricedRowIds.length} de ${rows.length} filas sin precio válido.`,
      affected: unpricedRowIds,
      decisionType: "derived",
      evidence: { sourceFields: ["quote.rows[].offerPrice", "quote.rows[].regularPrice"], source: "quote" },
      confidence: "high",
      explanation: "Los precios incompletos impiden conocer el costo total real de la cotización.",
      action: "Completar los precios o eliminar las filas sin precio.",
    });
  }

  const quotePriceAge = daysSince(quotePriceUpdatedAt, evaluatedAt);
  if (quotePriceAge === null) {
    pushFinding({
      id: "price-freshness-age",
      dimension: "priceFreshness",
      severity: "warning",
      conclusion: "La cotización no indica cuándo se actualizaron los precios.",
      affected: [],
      decisionType: "unsupported",
      evidence: { sourceFields: ["quote.priceUpdatedAt"], source: "quote" },
      confidence: "low",
      explanation: "Sin fecha de actualización no se puede verificar que los precios sigan vigentes.",
      action: "Pedir al vendedor la fecha de los precios.",
    });
  } else if (quotePriceAge > PRICE_STALE_DAYS) {
    pushFinding({
      id: "price-freshness-age",
      dimension: "priceFreshness",
      severity: "warning",
      conclusion: `Los precios tienen ${quotePriceAge} días; se consideran desactualizados después de ${PRICE_STALE_DAYS} días.`,
      affected: [],
      decisionType: "derived",
      evidence: { sourceFields: ["quote.priceUpdatedAt"], source: "quote" },
      confidence: "high",
      explanation: "Un presupuesto basado en precios viejos puede dejar de ser válido al comprar.",
      action: "Solicitar precios actualizados al vendedor.",
    });
  }

  const catalogAge = daysSince(catalogGeneratedAt, evaluatedAt);
  pushFinding({
    id: "price-freshness-catalog",
    dimension: "priceFreshness",
    severity: "info",
    conclusion:
      catalogAge === null
        ? "No se pudo verificar la antigüedad del catálogo de referencia."
        : `El catálogo de referencia tiene ${catalogAge} días.`,
    affected: [],
    decisionType: catalogAge === null ? "unsupported" : "derived",
    evidence: { sourceFields: ["catalogMeta.generatedAt"], source: "catalog" },
    confidence: catalogAge === null ? "low" : "high",
    explanation: "Los datos del catálogo son una referencia separada de la fecha de los precios de la cotización.",
    action: "Ninguna acción requerida: solo referencia.",
  });

  // ---- dimensions -----------------------------------------------------------

  const compatibilityStatus = worstStatus(compatStatuses);
  const caseFitStatus = worstStatus(caseFitStatuses);
  const powerStatus = worstStatus(powerStatuses);
  const connectorsStatus = worstStatus(connectorStatuses);

  let completenessStatus;
  if (supportedRows.length === 0) {
    completenessStatus = null;
  } else if (requiredMissing.length > 0 || requiredUnresolved.length > 0) {
    completenessStatus = "unknown";
  } else {
    completenessStatus = "ok";
  }

  let priceCompletenessStatus = null;
  if (rows.length > 0) {
    priceCompletenessStatus = unpricedRowIds.length > 0 ? "warning" : "ok";
  }

  let priceFreshnessStatus;
  if (quotePriceAge === null) priceFreshnessStatus = "unknown";
  else if (quotePriceAge > PRICE_STALE_DAYS) priceFreshnessStatus = "warning";
  else priceFreshnessStatus = "ok";

  const dimensionStatuses = {
    compatibility: compatibilityStatus,
    completeness: completenessStatus,
    power: powerStatus,
    connectors: connectorsStatus,
    caseFit: caseFitStatus,
    priceFreshness: priceFreshnessStatus,
    priceCompleteness: priceCompletenessStatus,
  };

  const dimensionSummaries = {
    compatibility: {
      ok: "Compatibilidad verificada entre los componentes presentes.",
      warning: "Advertencia de compatibilidad.",
      fail: "Incompatibilidad confirmada.",
      unknown: "No se pudo verificar la compatibilidad por falta de datos.",
      null: "Faltan componentes para verificar compatibilidad.",
    },
    completeness: {
      ok: "Los componentes requeridos están completos.",
      warning: "Faltan componentes requeridos o sin resolver.",
      fail: "Faltan componentes requeridos o sin resolver.",
      unknown: "Faltan componentes requeridos o sin resolver.",
      null: "No hay componentes evaluables.",
    },
    power: {
      ok: "Fuente de poder suficiente para el consumo estimado.",
      warning: "Poco margen en la fuente de poder.",
      fail: "Fuente de poder insuficiente.",
      unknown: "No se pudo estimar el consumo (faltan datos de TDP o de la fuente).",
      null: "Faltan CPU, GPU o fuente para estimar el consumo.",
    },
    connectors: {
      ok: "Conectores PCIe suficientes.",
      warning: "Conectores PCIe por revisar.",
      fail: "Faltan conectores PCIe.",
      unknown: "No se pudo verificar los conectores PCIe.",
      null: "Faltan fuente o GPU para verificar conectores.",
    },
    caseFit: {
      ok: "Sin problemas de espacio ni de factor de forma.",
      warning: "Espacio o factor de forma por revisar.",
      fail: "La GPU no cabe o el factor de forma no es soportado.",
      unknown: "No se pudo verificar el espacio.",
      null: "Faltan componentes para verificar el espacio.",
    },
    priceFreshness: {
      ok: `Precios de la cotización dentro de los ${PRICE_STALE_DAYS} días.`,
      warning: `Precios de la cotización con más de ${PRICE_STALE_DAYS} días.`,
      fail: `Precios de la cotización con más de ${PRICE_STALE_DAYS} días.`,
      unknown: "No se pudo verificar la antigüedad de los precios.",
      null: "Sin precios para evaluar.",
    },
    priceCompleteness: {
      ok: "Todas las filas tienen precio.",
      warning: "Hay filas sin precio.",
      fail: "Hay filas sin precio.",
      unknown: "Hay filas sin precio.",
      null: "No hay filas para evaluar.",
    },
  };

  const dimensions = {};
  for (const [key, status] of Object.entries(dimensionStatuses)) {
    const findingIds = findings
      .filter((f) => f.dimension === key)
      .map((f) => f.id);
    const summary = status === null ? dimensionSummaries[key].null : dimensionSummaries[key][status];
    dimensions[key] = { status, summary, findingIds };
  }

  // ---- verdict --------------------------------------------------------------

  const statuses = Object.values(dimensionStatuses);
  let overall;
  if (statuses.includes("fail")) overall = "fail";
  else if (statuses.includes("warning")) overall = "warning";
  else if (statuses.includes("unknown")) overall = "unknown";
  else if (dimensions.completeness.status === "ok" && statuses.some((s) => s !== null)) overall = "ok";
  else overall = "incomplete";

  const verdictSummaries = {
    fail: "La cotización tiene problemas confirmados que deben corregirse antes de comprar.",
    warning: "La cotización es válida técnicamente, pero tiene advertencias que conviene revisar.",
    unknown: "No se pudo verificar completamente la cotización: falta información o hay componentes sin resolver.",
    ok: "La cotización es técnicamente válida y está completa.",
    incomplete: "No hay suficiente información para evaluar la cotización.",
  };

  const sortedFindings = [...findings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );

  return {
    verdict: { overall, summary: verdictSummaries[overall] },
    dimensions,
    findings: sortedFindings,
  };
}
