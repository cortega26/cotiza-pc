export const ANALYZER_DIMENSION_ORDER = Object.freeze([
  "compatibility",
  "completeness",
  "power",
  "connectors",
  "caseFit",
  "priceFreshness",
  "priceCompleteness",
]);

export const ANALYZER_DIMENSION_LABELS = Object.freeze({
  compatibility: "Compatibilidad",
  completeness: "Completitud",
  power: "Energía",
  connectors: "Conectores",
  caseFit: "Ajuste de gabinete",
  priceFreshness: "Actualización de precios",
  priceCompleteness: "Precios completos",
});

export const SEVERITY_LABELS = Object.freeze({
  critical: "Crítico",
  warning: "Advertencia",
  info: "Informativo",
});

export const VERDICT_LABELS = Object.freeze({
  fail: "Problemas confirmados",
  warning: "Advertencias",
  unknown: "No se pudo verificar",
  ok: "Técnicamente válida",
  incomplete: "Información insuficiente",
});

export const RESOLUTION_LABELS = Object.freeze({
  "exact-id": "Identificado por ID",
  "user-mapped": "Confirmado por ti",
  ambiguous: "Necesita confirmación",
  "unmatched-text": "Sin coincidencia",
  "unsupported-category": "Fuera de alcance",
});

export const DECISION_TYPE_LABELS = Object.freeze({
  deterministic: "Determinístico",
  derived: "Derivado",
  heuristic: "Heurístico",
  probabilistic: "Probabilístico",
  "preference-dependent": "Depende de preferencias",
  unsupported: "No soportado",
});

export const COMPONENT_LABELS = Object.freeze({
  cpu: "CPU",
  mobo: "Placa madre",
  ram: "RAM",
  gpu: "Tarjeta de video",
  psu: "Fuente de poder",
  pcCase: "Gabinete",
});

export const COMPONENT_CATEGORY_LABELS = Object.freeze({
  cpu: "Procesador",
  mobo: "Placa madre",
  ram: "RAM",
  gpu: "Tarjeta de video",
  psu: "Fuente de poder",
  pcCase: "Gabinete",
});

export const CATEGORY_LIST_KEYS = Object.freeze({
  cpu: "cpus",
  mobo: "motherboards",
  ram: "ramKits",
  gpu: "gpus",
  psu: "psus",
  pcCase: "pcCases",
});

export const DECISION_ACTION_LABELS = Object.freeze({
  keep: "Mantener",
  change: "Cambiar",
  reject: "Rechazar",
  negotiate: "Negociar",
  compare: "Comparar",
  defer: "Diferir",
});

export const RESOLUTION_OPTIONS = Object.freeze([
  { value: "1080p", label: "1080p (Full HD)" },
  { value: "1440p", label: "1440p (QHD)" },
  { value: "4k", label: "4K (UHD)" },
]);

export const SCOPE_OPTIONS = Object.freeze([
  { value: "full", label: "Equipo completo" },
  { value: "upgrade", label: "Actualización de piezas" },
  { value: "unknown", label: "Sin definir" },
]);
