/**
 * Conservative row resolution for the Quote Analyzer.
 *
 * Free text alone never resolves to a product: `exact-id` (after
 * `resolveCatalogId` aliases) and `user-mapped` (explicit per-analysis
 * confirmation) are the only states that produce component evidence.
 * Candidate generation is advisory only; no ambiguous row may reach assembly.
 * Pure: never mutates rows, catalog, aliases, or explicit mappings.
 */
import { normalizeCategory } from "./contracts";
import { resolveCatalogId } from "../catalogMapper";

const CATALOG_LISTS = Object.freeze({
  cpu: "cpus",
  mobo: "motherboards",
  ram: "ramKits",
  gpu: "gpus",
  psu: "psus",
  pcCase: "pcCases",
});

/** Advisory UI bound; candidate lists beyond this are truncated but never lose the manual search. */
export const MAX_CANDIDATES = 20;

/**
 * Catalog items for a component key. Never throws on malformed catalogs.
 * @param {string} componentKey
 * @param {object|null|undefined} catalog
 * @returns {Array<object>}
 */
function catalogListFor(componentKey, catalog) {
  if (!catalog || typeof catalog !== "object") return [];
  const list = catalog[CATALOG_LISTS[componentKey]];
  return Array.isArray(list) ? list : [];
}

/**
 * Build per-component id -> item maps once per catalog snapshot.
 * @param {object|null|undefined} catalog
 * @returns {{ byId: Record<string, Map<string, object>> }}
 */
export function buildCatalogIndex(catalog) {
  const byId = {};
  for (const key of Object.keys(CATALOG_LISTS)) {
    const map = new Map();
    for (const item of catalogListFor(key, catalog)) {
      if (item && item.id !== undefined && item.id !== null) {
        map.set(String(item.id), item);
      }
    }
    byId[key] = map;
  }
  return { byId };
}

/**
 * Candidate matching with the typeahead's normalized token-inclusion rule:
 * every whitespace-separated token of the product text must be included in
 * the lowercased item label. Advisory only.
 * @param {unknown} productText
 * @param {Array<object>} items
 * @returns {Array<object>}
 */
export function findCandidates(productText, items) {
  if (typeof productText !== "string" || !Array.isArray(items)) return [];
  const tokens = productText.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  return items.filter((item) => {
    const label = String(item?.name || "").toLowerCase();
    return tokens.every((token) => label.includes(token));
  });
}

/**
 * Resolve one quote row to a resolution state.
 *
 * @param {object|null|undefined} row normalized quote row
 * @param {object} catalog catalog snapshot { cpus, motherboards, ramKits, gpus, psus, pcCases }
 * @param {object} [options]
 * @param {object|null} [options.aliases] { [oldId]: newId } from catalog metadata
 * @param {object|null} [options.explicitMappings] { [rowId]: catalogItemId } per-analysis user confirmations
 * @param {{ byId: Record<string, Map<string, object>> }} [options.index] prebuilt catalog id index
 * @returns {{ state: string, rowId: string, componentKey: string|null, item?: object, itemId?: string, candidates?: Array<object>, candidateCount?: number, candidatesTruncated?: boolean }|null}
 */
export function resolveRow(row, catalog, options = {}) {
  if (!row || typeof row !== "object") return null;
  const rowId = row.id ?? "";
  const componentKey = normalizeCategory(row.category);
  const aliases = options.aliases || null;
  const explicitMappings = options.explicitMappings || null;

  if (!componentKey) {
    const isEmpty = !row.itemId && !row.product;
    if (isEmpty) return null;
    return { state: "unsupported-category", rowId, componentKey: null };
  }

  const list = catalogListFor(componentKey, catalog);
  const byId = options.index?.byId?.[componentKey];
  const findById = (id) =>
    byId ? byId.get(String(id)) : list.find((candidate) => candidate && String(candidate.id) === String(id));

  // Resolution order follows the design state table: exact-id, then
  // user-mapped, then advisory text candidates.
  if (row.itemId !== undefined && row.itemId !== null && row.itemId !== "") {
    const resolvedId = resolveCatalogId(row.itemId, aliases);
    const item = findById(resolvedId);
    if (item) {
      return { state: "exact-id", rowId, componentKey, item, itemId: item.id };
    }
  }

  const mappingId =
    explicitMappings && rowId ? explicitMappings[rowId] : undefined;
  if (mappingId !== undefined && mappingId !== null) {
    const resolvedMappingId = resolveCatalogId(mappingId, aliases);
    const mapped = findById(resolvedMappingId);
    if (mapped) {
      return { state: "user-mapped", rowId, componentKey, item: mapped, itemId: mapped.id };
    }
    // Invalid mapping falls through; it must never fabricate evidence.
  }

  const allCandidates = findCandidates(row.product, list);
  if (allCandidates.length > 0) {
    return {
      state: "ambiguous",
      rowId,
      componentKey,
      candidates: allCandidates.slice(0, MAX_CANDIDATES),
      candidateCount: allCandidates.length,
      candidatesTruncated: allCandidates.length > MAX_CANDIDATES,
    };
  }
  return { state: "unmatched-text", rowId, componentKey };
}

/**
 * Resolve every non-empty quote row.
 * @param {Array<object>} rows
 * @param {object} catalog
 * @param {object} [options]
 * @returns {{ resolutions: Array<object>, map: Record<string, string> }}
 */
export function resolveRows(rows, catalog, options = {}) {
  const resolutions = [];
  const map = {};
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const result = resolveRow(row, catalog, options);
    if (!result) continue;
    resolutions.push(result);
    if (result.rowId) {
      map[result.rowId] = result.state;
    }
  }
  return { resolutions, map };
}
