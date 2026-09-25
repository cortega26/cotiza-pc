import { resolveRow } from "./quoteAnalyzer/resolver";

export const COVERAGE_CASE_SCHEMA_VERSION = "quote-analyzer-assurance/coverage-case/v1";

const CATALOG_LISTS = Object.freeze([
  "cpus",
  "motherboards",
  "ramKits",
  "gpus",
  "psus",
  "pcCases",
]);

const SAMPLING_DEFAULTS = Object.freeze({
  resolutionTarget: "unknown",
  graphics: "unknown",
  completeness: "unknown",
  budgetBand: "unknown",
});

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const identifierKey = (value) => {
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

const samplingString = (value, fallback) =>
  typeof value === "string" && value.trim() !== "" ? value : fallback;

const aliasTarget = (aliases, id) => {
  if (!isPlainObject(aliases) || !Object.hasOwn(aliases, id)) return null;
  return identifierKey(aliases[id]);
};

function minimizeCatalog(catalog, referencedIds) {
  return Object.fromEntries(
    CATALOG_LISTS.map((listKey) => {
      const items = Array.isArray(catalog?.[listKey]) ? catalog[listKey] : [];
      return [
        listKey,
        items
          .filter((item) => {
            const id = identifierKey(item?.id);
            return id !== null && referencedIds.has(id);
          })
          .map((item) => ({ ...item })),
      ];
    })
  );
}

export function buildCoverageCase(
  analyzerInput,
  { caseId, sampledAt, sampling } = {}
) {
  const input = isPlainObject(analyzerInput) ? analyzerInput : {};
  const sourceRows = Array.isArray(input.quote?.rows) ? input.quote.rows : [];
  const sourceCatalog = isPlainObject(input.catalog) ? input.catalog : {};
  const sourceAliases = isPlainObject(input.aliases) ? input.aliases : null;
  const sourceExplicitMappings = isPlainObject(input.explicitMappings)
    ? input.explicitMappings
    : null;
  const directlyReferencedIds = new Set();
  const rows = [];
  const explicitMappingEntries = [];

  for (const row of sourceRows) {
    const itemIdKey = identifierKey(row?.itemId);
    if (!isPlainObject(row) || itemIdKey === null) continue;

    const newId = `r-${rows.length + 1}`;
    rows.push({ id: newId, category: row.category, itemId: row.itemId });
    directlyReferencedIds.add(itemIdKey);

    const resolution = resolveRow(row, sourceCatalog, {
      aliases: sourceAliases,
      explicitMappings: sourceExplicitMappings,
    });
    if (resolution?.state !== "user-mapped") continue;

    const mappedId = sourceExplicitMappings?.[row.id];
    const mappedIdKey = identifierKey(mappedId);
    if (mappedIdKey === null) continue;
    explicitMappingEntries.push([newId, mappedId]);
    directlyReferencedIds.add(mappedIdKey);
  }

  const referencedIds = new Set(directlyReferencedIds);
  for (const id of directlyReferencedIds) {
    const target = aliasTarget(sourceAliases, id);
    if (target !== null) referencedIds.add(target);
  }

  const retainedAliases = isPlainObject(sourceAliases)
    ? Object.entries(sourceAliases).filter(
        ([key, value]) =>
          directlyReferencedIds.has(identifierKey(key) || "") ||
          directlyReferencedIds.has(identifierKey(value) || "")
      )
    : [];

  const sourceSampling = isPlainObject(sampling) ? sampling : {};
  const samplingOutput = Object.fromEntries(
    Object.entries(SAMPLING_DEFAULTS).map(([key, fallback]) => [
      key,
      samplingString(sourceSampling[key], fallback),
    ])
  );

  return {
    schemaVersion: COVERAGE_CASE_SCHEMA_VERSION,
    caseId,
    quoteSnapshotAt: sampledAt,
    elapsedMs: null,
    recruitmentSource: "direct",
    sampling: samplingOutput,
    analyzerInput: {
      schemaVersion: input.schemaVersion,
      evaluatedAt: input.evaluatedAt,
      quote: { rows },
      userContext: {
        useCase: input.userContext?.useCase,
        usesIntegratedGpu: input.userContext?.usesIntegratedGpu,
      },
      catalog: minimizeCatalog(sourceCatalog, referencedIds),
      catalogMeta: input.catalogMeta,
      aliases: retainedAliases.length > 0 ? Object.fromEntries(retainedAliases) : null,
      explicitMappings:
        explicitMappingEntries.length > 0
          ? Object.fromEntries(explicitMappingEntries)
          : null,
    },
  };
}

export function summarizeCoverageCase(coverageCase) {
  const rows = Array.isArray(coverageCase?.analyzerInput?.quote?.rows)
    ? coverageCase.analyzerInput.quote.rows
    : [];
  const categories = [];

  for (const row of rows) {
    if (typeof row?.category !== "string" || row.category.trim() === "") continue;
    if (!categories.includes(row.category)) categories.push(row.category);
  }

  return { componentCount: rows.length, categories };
}
