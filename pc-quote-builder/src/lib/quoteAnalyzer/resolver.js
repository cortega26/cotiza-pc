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
 * @returns {{ state: string, rowId: string, componentKey: string|null, item?: object, itemId?: string, candidates?: Array<object> }|null}
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

  // Resolution order follows the design state table: exact-id, then
  // user-mapped, then advisory text candidates.
  if (row.itemId !== undefined && row.itemId !== null && row.itemId !== "") {
    const resolvedId = resolveCatalogId(row.itemId, aliases);
    const item = list.find((candidate) => candidate && String(candidate.id) === String(resolvedId));
    if (item) {
      return { state: "exact-id", rowId, componentKey, item, itemId: item.id };
    }
  }

  const mappingId =
    explicitMappings && rowId ? explicitMappings[rowId] : undefined;
  if (mappingId !== undefined && mappingId !== null) {
    const resolvedMappingId = resolveCatalogId(mappingId, aliases);
    const mapped = list.find((item) => item && String(item.id) === String(resolvedMappingId));
    if (mapped) {
      return { state: "user-mapped", rowId, componentKey, item: mapped, itemId: mapped.id };
    }
    // Invalid mapping falls through; it must never fabricate evidence.
  }

  const candidates = findCandidates(row.product, list);
  if (candidates.length > 0) {
    return { state: "ambiguous", rowId, componentKey, candidates };
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
