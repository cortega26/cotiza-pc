import { REQUIRED_COMPONENTS } from "../../lib/quoteAnalyzer/contracts";
import { CATEGORY_LIST_KEYS } from "./labels";

export const ANALYZER_CONTEXT_DEFAULT = Object.freeze({
  targetResolution: "",
  usesIntegratedGpu: null,
  budget: null,
  assemblyScope: "unknown",
});

export const ANALYZER_CATEGORIES = Object.freeze(["cpus", "motherboards", "ram", "gpus", "psus", "cases"]);

export const ANALYZER_CATEGORY_READY_STATES = Object.freeze(["loaded", "fallback"]);

export function isAnalyzerContextValid(context) {
  if (!context || typeof context !== "object") return false;
  const resolution = context.targetResolution;
  const validResolution =
    resolution === "1080p" || resolution === "1440p" || resolution === "4k";
  return validResolution && (context.usesIntegratedGpu === true || context.usesIntegratedGpu === false);
}

export function isCatalogReadyForAnalysis(categoryStates) {
  if (!categoryStates || typeof categoryStates !== "object") return false;
  return ANALYZER_CATEGORIES.every((category) =>
    ANALYZER_CATEGORY_READY_STATES.includes(categoryStates[category])
  );
}

function catalogListFor(componentKey, catalog) {
  if (!catalog || typeof catalog !== "object") return [];
  const list = catalog[CATEGORY_LIST_KEYS[componentKey]];
  return Array.isArray(list) ? list : [];
}

/**
 * A mapping entry is valid only while its row still has the same product and
 * category that were captured when the user confirmed it, and while the mapped
 * catalog item still exists in the current catalog. Stale entries are ignored,
 * never silently applied.
 */
export function validMappingsFor(rows, mappings, catalog) {
  if (!mappings || typeof mappings !== "object") return {};
  if (!Array.isArray(rows)) return {};
  const valid = {};
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const entry = mappings[row.id];
    if (!entry || typeof entry !== "object") continue;
    if (entry.product !== row.product || entry.category !== row.category) continue;
    const list = catalogListFor(entry.componentKey, catalog);
    const exists = list.some((item) => item && String(item.id) === String(entry.itemId));
    if (!exists) continue;
    valid[row.id] = { ...entry };
  }
  return valid;
}

export function analysisSignature(quote, context, mappings, excludedRowIds, catalogSignature) {
  const rows = Array.isArray(quote?.rows) ? quote.rows : [];
  const rowFingerprint = rows.map((row) =>
    row ? [row.id, row.category, row.product, row.itemId, row.offerPrice, row.regularPrice].join("|") : ""
  );
  const mappingFingerprint = Object.keys(mappings || {})
    .sort()
    .map((rowId) => `${rowId}=${mappings[rowId].itemId}`)
    .join(",");
  const excluded = [...(excludedRowIds || [])].sort().join(",");
  return JSON.stringify([
    quote?.id,
    rowFingerprint,
    context?.targetResolution,
    context?.usesIntegratedGpu,
    context?.assemblyScope,
    context?.budget,
    mappingFingerprint,
    excluded,
    quote?.currency,
    quote?.priceUpdatedAt,
    catalogSignature,
  ]);
}

/**
 * Required-component resolution counts for Plan 031 events. Counts are per
 * component key, never per row; an integrated-GPU confirmation satisfies the
 * GPU requirement.
 */
export function requiredResolutionCounts(resolutions, integratedGpu) {
  const stateByKey = new Map();
  for (const resolution of Array.isArray(resolutions) ? resolutions : []) {
    if (resolution?.componentKey) {
      stateByKey.set(resolution.componentKey, resolution.state);
    }
  }
  let exact = 0;
  let confirmed = 0;
  let remaining = 0;
  for (const key of REQUIRED_COMPONENTS) {
    if (key === "gpu" && integratedGpu) continue;
    const state = stateByKey.get(key);
    if (state === "exact-id") exact += 1;
    else if (state === "user-mapped") confirmed += 1;
    else remaining += 1;
  }
  return { exact, confirmed, remaining };
}

export function resolutionOutcomeFor(exact, confirmed, remaining) {
  if (remaining === 0) return "all-resolved";
  if (exact === 0 && confirmed === 0) return "none";
  return "partial";
}

export function coverageNoteFor(finding, manifest) {
  const dimension = manifest?.dimensions?.[finding?.id];
  if (!dimension || typeof dimension !== "object") return null;
  const { assessable, total } = dimension.combinations || {};
  if (!Number.isFinite(assessable) || !Number.isFinite(total) || total === 0) return null;
  return `Cobertura de la regla evaluada sobre ${assessable} de ${total} combinaciones del catálogo.`;
}
