/**
 * Quote Analyzer v1 public entry point.
 *
 * analyzeQuote validates a quote-analyzer/input/v1 payload, resolves every
 * quote row conservatively (only exact-id and user-mapped rows produce
 * component evidence), assembles the normalized selection, and builds the
 * versioned output report.
 *
 * Pure function: no Date.now(), no module-level state, no mutation of the
 * input; output.generatedAt copies input.evaluatedAt verbatim (design §4.4).
 * The output is a fresh serializable object that references no input field
 * by identity.
 */
import { RULES_VERSION, SCHEMA_VERSION_OUTPUT, validateAnalyzerInput } from "./contracts";
import { resolveRows } from "./resolver";
import { assembleSelection } from "./assemble";
import { buildReport } from "./report";

/**
 * Analyze a quote-analyzer/input/v1 payload into a quote-analyzer/output/v1
 * report. Throws on malformed input with stable user-safe Spanish messages.
 * @param {object} input quote-analyzer/input/v1 payload
 * @returns {object} quote-analyzer/output/v1 report
 */
export function analyzeQuote(input) {
  validateAnalyzerInput(input);
  const { quote, catalog, catalogMeta, evaluatedAt, userContext } = input;
  const { resolutions, map } = resolveRows(quote.rows, catalog, {
    aliases: input.aliases ?? null,
    explicitMappings: input.explicitMappings ?? null,
  });
  const { selection, gaps, integratedGpu } = assembleSelection(resolutions, userContext);
  const report = buildReport({
    selection,
    gaps,
    integratedGpu,
    resolutions,
    quote,
    catalog,
    catalogMeta,
    evaluatedAt,
  });
  return {
    schemaVersion: SCHEMA_VERSION_OUTPUT,
    generatedAt: evaluatedAt,
    verdict: report.verdict,
    dimensions: report.dimensions,
    findings: report.findings,
    resolution: map,
    integratedGpu,
    sources: {
      catalogGeneratedAt: catalogMeta?.generatedAt ?? catalog?.meta?.generatedAt ?? null,
      quotePriceUpdatedAt: quote?.priceUpdatedAt ?? null,
      rulesVersion: input.rulesVersion ?? RULES_VERSION,
    },
  };
}
