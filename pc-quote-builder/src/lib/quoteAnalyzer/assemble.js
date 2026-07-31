/**
 * Assemble the builder-shaped selection from resolved rows.
 *
 * Only `exact-id` and `user-mapped` rows produce selection items. Duplicate
 * resolved rows for one category make the category unresolved (never choose
 * by row order). Component-resolution gaps are expressed per component key.
 * Pure: never mutates resolutions, catalog, or user context.
 */
import { COMPONENT_KEYS } from "./contracts";

/**
 * @typedef {object} Assembly
 * @property {Record<string, object|undefined>} selection { cpu?, mobo?, ram?, gpu?, psu?, pcCase? }
 * @property {Record<string, string>} gaps per-component gap: "missing" | "ambiguous" | "unmatched" | "duplicate"
 * @property {boolean} integratedGpu true when no GPU row resolved and the user confirmed integrated graphics
 */

/**
 * Assemble resolutions into a normalized selection.
 * @param {Array<object>} resolutions resolveRows output
 * @param {object} userContext input.userContext
 * @returns {Assembly}
 */
export function assembleSelection(resolutions, userContext) {
  const selection = {};
  const resolvedPerKey = new Map();
  const gapCandidates = new Map();
  for (const key of COMPONENT_KEYS) {
    resolvedPerKey.set(key, []);
    gapCandidates.set(key, []);
  }

  for (const resolution of resolutions) {
    const key = resolution.componentKey;
    if (!key) continue;
    if (resolution.state === "exact-id" || resolution.state === "user-mapped") {
      resolvedPerKey.get(key).push(resolution);
    } else {
      gapCandidates.get(key).push(resolution);
    }
  }

  const gaps = {};
  for (const key of COMPONENT_KEYS) {
    const resolved = resolvedPerKey.get(key);
    if (resolved.length === 1) {
      selection[key] = resolved[0].item;
    } else if (resolved.length > 1) {
      gaps[key] = "duplicate";
    } else {
      const states = gapCandidates.get(key).map((r) => r.state);
      if (states.includes("ambiguous")) gaps[key] = "ambiguous";
      else if (states.includes("unmatched-text")) gaps[key] = "unmatched";
      else gaps[key] = "missing";
    }
  }

  const integratedGpu = !selection.gpu && userContext?.usesIntegratedGpu === true;
  return { selection, gaps, integratedGpu };
}
