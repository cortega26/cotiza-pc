export const WORKSPACE_MODES = Object.freeze({
  ANALIZAR: "analizar",
  EXPERTO: "experto",
});

export const DEFAULT_WORKSPACE_MODE = WORKSPACE_MODES.ANALIZAR;

export const WORKSPACE_MODE_ORDER = Object.freeze([
  WORKSPACE_MODES.ANALIZAR,
  WORKSPACE_MODES.EXPERTO,
]);

export const WORKSPACE_MODE_LABELS = Object.freeze({
  [WORKSPACE_MODES.ANALIZAR]: "Analizar cotización",
  [WORKSPACE_MODES.EXPERTO]: "Constructor experto",
});

export function isValidWorkspaceMode(value) {
  return value === WORKSPACE_MODES.ANALIZAR || value === WORKSPACE_MODES.EXPERTO;
}

export function parseWorkspaceMode(searchString = "") {
  const params = new URLSearchParams(searchString);
  const raw = params.get("modo");
  return isValidWorkspaceMode(raw) ? raw : DEFAULT_WORKSPACE_MODE;
}

export function serializeWorkspaceMode(mode, searchString = "") {
  const normalized = isValidWorkspaceMode(mode) ? mode : DEFAULT_WORKSPACE_MODE;
  const params = new URLSearchParams(searchString);
  params.set("modo", normalized);
  const query = params.toString();
  return query ? `?${query}` : "";
}
