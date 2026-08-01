/**
 * Assessment coverage and evidence manifest (Plan 030).
 *
 * Measures whether the processed catalog contains the evidence required by
 * each Quote Analyzer v1 rule — nothing more. This module imports no
 * production decision function (no compatibility.js, no quoteAnalyzer
 * verdict code) and duplicates no compatibility formula or severity: it
 * reports assessability only, per rule/dimension and per category/field.
 *
 * Evidence classes (never collapsed into a confidence percentage):
 * - explicit: usable value carried directly from a source;
 * - inferred: usable value derived by the compiler with documented evidence
 *   provenance (e.g. case form factors from chassis type);
 * - conflicting: source values disagree for the field (documented conflict
 *   flag);
 * - missing: no usable value and no documented inference;
 * - notApplicable: the source explicitly marks the field unclassifiable
 *   (e.g. case form-factor evidence "unknown").
 *
 * The manifest is report-only: it never labels a dimension supported and
 * never gates a refresh. Owner-approved thresholds are a later amendment.
 *
 * Pure module: no state, no I/O, no Date.now(). All functions are
 * deterministic for identical inputs; output keys are always sorted.
 */
import { RULES_VERSION } from "../../pc-quote-builder/src/lib/quoteAnalyzer/contracts.js";

export const ASSESSMENT_SCHEMA_VERSION = "assessment-coverage/v1";
export const RULES_VERSION_STRING = RULES_VERSION;

export const EVIDENCE_CLASSES = Object.freeze([
  "explicit",
  "inferred",
  "conflicting",
  "missing",
  "notApplicable",
]);

/** Catalog array key for each component category referenced by rules. */
export const CATEGORY_ARRAY_KEYS = Object.freeze({
  cpu: "cpus",
  mobo: "motherboards",
  ram: "ram",
  gpu: "gpus",
  psu: "psus",
  case: "cases",
});

const zeroCounts = () =>
  Object.fromEntries(EVIDENCE_CLASSES.map((cls) => [cls, 0]));

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isUsableValue = (value) => {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
};

/** Contract-valid evidence list: non-empty array of non-empty strings. */
const isNonEmptyStringArray = (value) =>
  Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);

/**
 * Classify one item's field evidence against the registry classification.
 * @param {object} item processed catalog item
 * @param {object} fieldSpec { name, kind, conflictFlag?, evidenceField? }
 * @returns {string} one of EVIDENCE_CLASSES
 */
export function classifyFieldValue(item, fieldSpec) {
  const { kind, name } = fieldSpec;
  if (kind === "evidence-flagged") {
    const evidence = item?.[fieldSpec.evidenceField];
    if (!isNonEmptyStringArray(item?.[name])) return "missing";
    if (evidence === "inferred") return "inferred";
    if (evidence === "explicit") return "explicit";
    return "notApplicable";
  }
  if (kind === "object-types") {
    const types = item?.[name]?.types;
    if (!isNonEmptyStringArray(types)) return "missing";
    return "explicit";
  }
  const value = item?.[name];
  if (!isUsableValue(value)) return "missing";
  if (kind === "conflict-flagged") {
    const flags = item?.meta?.conflict_flags;
    if (Array.isArray(flags) && flags.includes(fieldSpec.conflictFlag)) return "conflicting";
  }
  return "explicit";
}

/**
 * Per-rule requirement registry, keyed by the stable Plan 028 finding IDs.
 * Mirrors the v1 fact names; the processed-catalog field names are declared
 * per side so the manifest can be computed without inference heuristics.
 */
export const ASSESSMENT_RULES = Object.freeze(
  Object.fromEntries(
    [
      {
        id: "compat-cpu-mobo-socket",
        dimension: "compatibility",
        decisionType: "deterministic",
        sides: [
          { component: "cpu", fields: [{ name: "socket", kind: "direct" }] },
          { component: "mobo", fields: [{ name: "socket", kind: "direct" }] },
        ],
      },
      {
        id: "compat-cpu-ram-memory",
        dimension: "compatibility",
        decisionType: "deterministic",
        sides: [
          { component: "cpu", fields: [{ name: "memory_support", kind: "object-types" }] },
          { component: "ram", fields: [{ name: "type", kind: "direct" }] },
        ],
      },
      {
        id: "compat-mobo-ram-memory",
        dimension: "compatibility",
        decisionType: "deterministic",
        sides: [
          {
            component: "mobo",
            fields: [
              { name: "memory_type", kind: "direct" },
              { name: "max_memory_speed_mts", kind: "direct" },
            ],
          },
          {
            component: "ram",
            fields: [
              { name: "type", kind: "direct" },
              { name: "speed_mts", kind: "direct" },
            ],
          },
        ],
      },
      {
        id: "compat-mobo-case-ff",
        dimension: "caseFit",
        decisionType: "deterministic",
        sides: [
          { component: "mobo", fields: [{ name: "form_factor", kind: "direct" }] },
          {
            component: "case",
            fields: [
              {
                name: "supported_mobo_form_factors",
                kind: "evidence-flagged",
                evidenceField: "form_factor_evidence",
              },
            ],
          },
        ],
      },
      {
        id: "compat-gpu-case-length",
        dimension: "caseFit",
        decisionType: "deterministic",
        sides: [
          { component: "gpu", fields: [{ name: "board_length_mm", kind: "direct" }] },
          { component: "case", fields: [{ name: "max_gpu_length_mm", kind: "direct" }] },
        ],
      },
      {
        id: "power-psu-headroom",
        dimension: "power",
        decisionType: "derived",
        sides: [
          { component: "cpu", fields: [{ name: "tdp_w", kind: "conflict-flagged", conflictFlag: "cpu_tdp_conflict" }] },
          { component: "gpu", fields: [{ name: "tdp_w", kind: "conflict-flagged", conflictFlag: "gpu_tdp_conflict" }] },
          { component: "psu", fields: [{ name: "wattage_w", kind: "direct" }] },
        ],
      },
      {
        id: "power-connectors-pcie",
        dimension: "connectors",
        decisionType: "deterministic",
        sides: [
          { component: "gpu", fields: [{ name: "power_connectors", kind: "direct" }] },
          { component: "psu", fields: [{ name: "pcie_power_connectors", kind: "map" }] },
        ],
      },
    ].map((rule) => [
      rule.id,
      Object.freeze({
        ...rule,
        bothSidesRequired: true,
        sides: Object.freeze(
          rule.sides.map((side) =>
            Object.freeze({ ...side, fields: Object.freeze(side.fields.map((f) => Object.freeze(f))) })
          )
        ),
      }),
    ])
  )
);

export const ASSESSMENT_RULE_IDS = Object.freeze(Object.keys(ASSESSMENT_RULES));

/**
 * Collect per-field evidence counts for one category's items.
 * @param {Array<object>} items processed catalog items
 * @param {object} rule registry rule
 * @param {string} component component key of the side to measure
 * @returns {object} field name → counts
 */
export function computeFieldCounts(items, rule, component) {
  const counts = {};
  const side = rule.sides.find((s) => s.component === component);
  for (const fieldSpec of side.fields) {
    counts[fieldSpec.name] = zeroCounts();
    for (const item of items) {
      const cls = classifyFieldValue(item, fieldSpec);
      counts[fieldSpec.name][cls] += 1;
    }
  }
  return counts;
}

const isSideUsable = (item, side) =>
  side.fields.every((fieldSpec) => {
    const cls = classifyFieldValue(item, fieldSpec);
    return cls === "explicit" || cls === "inferred";
  });

const assertNoDuplicateIds = (items, category) => {
  const seen = new Set();
  for (const item of items) {
    if (!item || !isNonEmptyString(item.id)) {
      throw new Error(`catalog ${category} contains an item without an id`);
    }
    if (seen.has(item.id)) {
      throw new Error(`catalog ${category} contains duplicate id ${item.id}`);
    }
    seen.add(item.id);
  }
};

const specsEqual = (a, b) =>
  a.kind === b.kind && a.conflictFlag === b.conflictFlag && a.evidenceField === b.evidenceField;

/**
 * Flatten the per-rule registry into component → field → spec. Throws when
 * the same component field is declared with conflicting specifications across
 * rules, so a future registry edit can never silently change classification.
 * @param {object} rules registry (defaults to ASSESSMENT_RULES)
 * @returns {object} component key → { fieldName → frozen fieldSpec }
 */
export function buildFieldSpecsByComponent(rules = ASSESSMENT_RULES) {
  const byComponent = {};
  for (const rule of Object.values(rules)) {
    for (const side of rule.sides) {
      for (const fieldSpec of side.fields) {
        const existing = byComponent[side.component]?.[fieldSpec.name];
        if (existing && !specsEqual(existing, fieldSpec)) {
          throw new Error(
            `assessment registry drift: ${side.component}.${fieldSpec.name} is declared with conflicting specifications`
          );
        }
        byComponent[side.component] ??= {};
        byComponent[side.component][fieldSpec.name] = fieldSpec;
      }
    }
  }
  return byComponent;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

const sortKeysDeep = (value) => {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeysDeep(value[key])])
    );
  }
  return value;
};

/**
 * Compute the deterministic aggregate coverage manifest.
 * @param {object} catalog { cpus, motherboards, ram, gpus, psus, cases }
 * @param {object} metadata { generatedAt, rulesVersion }
 * @returns {object} assessment-coverage/v1 manifest
 */
export function computeAssessmentCoverage(catalog, metadata = {}) {
  const safeMetadata = metadata || {};
  const { generatedAt, rulesVersion = RULES_VERSION_STRING } = safeMetadata;
  if (rulesVersion !== RULES_VERSION_STRING) {
    throw new Error(`rulesVersion must be ${RULES_VERSION_STRING}`);
  }
  if (!isNonEmptyString(generatedAt)) {
    throw new Error("generatedAt is required");
  }

  const fieldSpecsByComponent = buildFieldSpecsByComponent();

  const categories = {};
  const dimensions = {};

  for (const [component, arrayKey] of Object.entries(CATEGORY_ARRAY_KEYS)) {
    const items = Array.isArray(catalog?.[arrayKey]) ? catalog[arrayKey] : [];
    assertNoDuplicateIds(items, arrayKey);
    categories[component] = {};
    for (const [fieldName, fieldSpec] of Object.entries(fieldSpecsByComponent[component] || {}).sort()) {
      const counts = zeroCounts();
      for (const item of items) {
        counts[classifyFieldValue(item, fieldSpec)] += 1;
      }
      categories[component][fieldName] = counts;
    }
  }

  for (const ruleId of ASSESSMENT_RULE_IDS) {
    const rule = ASSESSMENT_RULES[ruleId];
    const sideCounts = {};
    let assessable = 1;
    let total = 1;
    for (const side of rule.sides) {
      const items = Array.isArray(catalog?.[CATEGORY_ARRAY_KEYS[side.component]])
        ? catalog[CATEGORY_ARRAY_KEYS[side.component]]
        : [];
      sideCounts[side.component] = computeFieldCounts(items, rule, side.component);
      assessable *= items.filter((item) => isSideUsable(item, side)).length;
      total *= items.length;
    }
    dimensions[ruleId] = {
      dimension: rule.dimension,
      decisionType: rule.decisionType,
      bothSidesRequired: rule.bothSidesRequired,
      sides: sideCounts,
      combinations: { assessable, total },
    };
  }

  return sortKeysDeep({
    schemaVersion: ASSESSMENT_SCHEMA_VERSION,
    generatedAt,
    rulesVersion: RULES_VERSION_STRING,
    categories,
    dimensions,
  });
}

const isNonNegativeInteger = (value) => Number.isInteger(value) && value >= 0;

const sortedKeys = (obj) =>
  Object.keys(obj).every((key, index, keys) => index === 0 || keys[index - 1] <= key);

const exactSortedKeys = (obj, expected) => {
  const actual = Object.keys(obj).sort();
  const want = [...expected].sort();
  return actual.length === want.length && actual.every((key, index) => key === want[index]);
};

/**
 * Validate an assessment-coverage/v1 manifest.
 * @param {object} manifest manifest to validate
 * @returns {Array<string>} validation errors (empty when valid)
 */
export function validateAssessmentCoverage(manifest) {
  const errors = [];
  if (!isPlainObject(manifest)) return ["assessment coverage manifest must be an object"];
  if (manifest.schemaVersion !== ASSESSMENT_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be "${ASSESSMENT_SCHEMA_VERSION}"`);
  }
  if (manifest.rulesVersion !== RULES_VERSION_STRING) {
    errors.push(`rulesVersion must be "${RULES_VERSION_STRING}"`);
  }
  if (!isNonEmptyString(manifest.generatedAt)) {
    errors.push("generatedAt must be a non-empty string");
  }
  if (!isPlainObject(manifest.categories) || !isPlainObject(manifest.dimensions)) {
    errors.push("categories and dimensions must be objects");
  }
  if (manifest.categories && !sortedKeys(manifest.categories)) errors.push("categories keys must be sorted");
  if (manifest.dimensions && !sortedKeys(manifest.dimensions)) errors.push("dimensions keys must be sorted");

  const registryFields = buildFieldSpecsByComponent();

  if (manifest.dimensions) {
    for (const ruleId of Object.keys(manifest.dimensions)) {
      if (!ASSESSMENT_RULES[ruleId]) {
        errors.push(`dimensions contains unknown rule ${ruleId}`);
      }
    }
    for (const ruleId of ASSESSMENT_RULE_IDS) {
      const entry = manifest.dimensions[ruleId];
      if (!entry) {
        errors.push(`dimensions must include rule ${ruleId}`);
        continue;
      }
      const rule = ASSESSMENT_RULES[ruleId];
      if (entry.dimension !== rule.dimension || entry.decisionType !== rule.decisionType) {
        errors.push(`dimensions.${ruleId} metadata does not match the registry`);
      }
      if (entry.bothSidesRequired !== true) errors.push(`dimensions.${ruleId}.bothSidesRequired must be true`);
      if (!isPlainObject(entry.sides)) {
        errors.push(`dimensions.${ruleId}.sides must be an object`);
        continue;
      }
      if (!sortedKeys(entry.sides)) errors.push(`dimensions.${ruleId}.sides keys must be sorted`);
      for (const sideComponent of Object.keys(entry.sides)) {
        if (!rule.sides.some((side) => side.component === sideComponent)) {
          errors.push(`dimensions.${ruleId} contains unknown side ${sideComponent}`);
        }
      }
      const { assessable, total } = entry.combinations || {};
      if (!isNonNegativeInteger(assessable) || !isNonNegativeInteger(total)) {
        errors.push(`dimensions.${ruleId}.combinations must be non-negative integers`);
      } else if (assessable > total) {
        errors.push(`dimensions.${ruleId}.combinations.assessable exceeds total`);
      }
      for (const side of rule.sides) {
        const sideCounts = entry.sides[side.component];
        if (!isPlainObject(sideCounts)) {
          errors.push(`dimensions.${ruleId} must include side ${side.component}`);
          continue;
        }
        if (!exactSortedKeys(sideCounts, side.fields.map((f) => f.name))) {
          errors.push(`dimensions.${ruleId}.${side.component} fields must match the registry exactly and be sorted`);
          continue;
        }
        for (const fieldSpec of side.fields) {
          const counts = sideCounts[fieldSpec.name];
          if (!isPlainObject(counts)) {
            errors.push(`dimensions.${ruleId}.${side.component}.${fieldSpec.name} counts missing`);
            continue;
          }
          if (!exactSortedKeys(counts, EVIDENCE_CLASSES)) {
            errors.push(`dimensions.${ruleId}.${side.component}.${fieldSpec.name} must have exactly the evidence classes, sorted`);
          }
          for (const cls of EVIDENCE_CLASSES) {
            if (!isNonNegativeInteger(counts[cls])) {
              errors.push(`dimensions.${ruleId}.${side.component}.${fieldSpec.name}.${cls} must be a non-negative integer`);
            }
          }
          const categoryCounts = manifest.categories?.[side.component]?.[fieldSpec.name];
          if (categoryCounts && JSON.stringify(categoryCounts) !== JSON.stringify(counts)) {
            errors.push(
              `dimensions.${ruleId}.${side.component}.${fieldSpec.name} disagrees with categories`
            );
          }
        }
      }
    }
  }

  if (manifest.categories) {
    for (const component of Object.keys(manifest.categories)) {
      if (!CATEGORY_ARRAY_KEYS[component]) {
        errors.push(`categories contains unknown component ${component}`);
      }
    }
    for (const [component, arrayKey] of Object.entries(CATEGORY_ARRAY_KEYS)) {
      const counts = manifest.categories[component];
      if (!isPlainObject(counts)) {
        errors.push(`categories must include ${component}`);
        continue;
      }
      const expectedFields = Object.keys(registryFields[component] || {});
      if (!exactSortedKeys(counts, expectedFields)) {
        errors.push(`categories.${component} fields must match the registry exactly and be sorted`);
        continue;
      }
      let sum = null;
      for (const [fieldName, fieldCounts] of Object.entries(counts)) {
        if (!isPlainObject(fieldCounts)) {
          errors.push(`categories.${component}.${fieldName} must be an object`);
          continue;
        }
        if (!exactSortedKeys(fieldCounts, EVIDENCE_CLASSES)) {
          errors.push(`categories.${component}.${fieldName} must have exactly the evidence classes, sorted`);
        }
        let fieldSum = 0;
        for (const cls of EVIDENCE_CLASSES) {
          if (!isNonNegativeInteger(fieldCounts[cls])) {
            errors.push(`categories.${component}.${fieldName}.${cls} must be a non-negative integer`);
          } else {
            fieldSum += fieldCounts[cls];
          }
        }
        if (sum === null) {
          sum = fieldSum;
        } else if (sum !== fieldSum) {
          errors.push(`categories.${component} fields must classify the same item count (${sum} vs ${fieldSum})`);
        }
      }
    }
  }

  return errors;
}

/**
 * Boolean wrapper over validateAssessmentCoverage.
 * @param {unknown} manifest
 * @returns {boolean}
 */
export function isValidAssessmentCoverage(manifest) {
  try {
    return validateAssessmentCoverage(manifest).length === 0;
  } catch {
    return false;
  }
}
