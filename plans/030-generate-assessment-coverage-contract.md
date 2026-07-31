# Plan 030: Generate the assessment coverage and evidence contract

> **Executor instructions**: Follow this plan step by step. This is a catalog
> pipeline and runtime-contract change: generated artifacts must be produced by
> the pipeline, never hand-edited. Run every artifact verification gate. Stop
> rather than downloading new source data unless the operator explicitly
> authorizes the catalog download pipeline.
>
> **Drift check (run first)**:
> `git diff --stat cef0acd..HEAD -- docs/PRODUCT_VISION.md docs/design/quote-analyzer.md scripts/build_pc_data.js scripts/lib/compiler.js scripts/lib pc-quote-builder/src/lib/catalogMapper.js pc-quote-builder/src/lib/dataLoader.js pc-quote-builder/src/hooks/useCatalog.js pc-quote-builder/src/lib/artifactContract.test.js data/processed pc-quote-builder/public/data`
>
> If Plan 028's finding definitions or the catalog schemas changed, STOP and
> reconcile field requirements before generating coverage.
>
> **Working-tree protection**: run `git status --short` before the drift check.
> At planning time, unrelated uncommitted work existed in
> `src/lib/catalogMapper.js` and its tests. Do not overwrite or absorb it.
> Because this plan overlaps those files, STOP until the owner identifies the
> owning change and the live explicit/inferred semantics are reconciled.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: Plan 028; Plan 035 consumes the manifest for automated
  assurance and later threshold decisions but is not required for report-only
  generation
- **Category**: direction
- **Planned at**: commit `cef0acd`, 2026-07-30

## Why this matters

Current artifact tests prove files are nonempty and contain IDs/names, but they
do not answer whether the data required by an Analyzer conclusion is present,
explicit, inferred, or conflicting. The canonical vision permits a dimension
only when required inputs, coverage, validation, and reliability thresholds are
defined. This plan creates a versioned, generated coverage manifest, preserves
existing per-product provenance at the browser mapping boundary, and exposes the
manifest to future Analyzer UI without presenting it as a consumer score.

## Product-decision record

- The initial manifest is **report-only**. It must not fail a catalog refresh
  solely because coverage is low.
- Coverage is calculated per assessment rule/dimension, not as one catalog
  quality score.
- `explicit`, `inferred`, `conflicting`, `missing`, and `not-applicable` remain
  distinct. They must not be collapsed into a synthetic confidence percentage.
- An owner-approved later amendment may turn specific Chile-gaming v1 thresholds
  into CI gates after Plan 035 supplies automated conformance and real-input
  coverage baselines.
- Low coverage degrades only the affected conclusion to `unknown`; it does not
  invalidate unrelated dimensions or hide products from the Expert Builder.
- This plan does not add a standalone catalog-confidence UI and does not claim
  market price, performance, connectors, or fit where inputs are absent.

## Current state

- `pc-quote-builder/src/lib/artifactContract.test.js:40-61` checks nonempty
  `id`/`name` and usable CPU/GPU tier arrays only.
- `docs/design/quote-analyzer.md:67-77` lists rule-specific fields and known
  gaps, including nullable TDP, fit, wattage, and connector data.
- `scripts/build_pc_data.js:75-105` builds compatibility metadata and writes all
  `.min.json` artifacts from one in-memory merged snapshot.
- `scripts/sync_processed_to_public_data.js:23-43` copies every `.min.json`, so a
  new manifest will sync automatically.
- `scripts/lib/compiler.js:49-143` already retains `sources`,
  `meta.conflict_flags`, `meta.quality_score`, and `normalized_key`.
- `pc-quote-builder/src/lib/catalogMapper.js:74-153` maps assessment fields but
  drops most `sources` and `meta` data:

  ```js
  return {
    id: cpu.id,
    name: cpu.name,
    socket: inferSocket(cpu),
    memoryType,
    memoryTypeExplicit,
    tdp: cpu.tdp_w ?? cpu.tdp ?? null,
  };
  ```

- At plan-writing time, an uncommitted concurrent change was modifying
  motherboard `memoryTypeExplicit`, including whether socket/name inference is
  called explicit. That change is not part of this plan. Coverage must derive
  explicit/inferred status from documented evidence provenance, not blindly
  trust a boolean whose meaning is under concurrent revision.

- `pc-quote-builder/src/lib/dataLoader.js:38-57` knows category files and
  `compatibility.min.json`; no coverage-manifest loader exists.

## Commands you will need

Run npm commands from `pc-quote-builder/`.

| Purpose | Command | Expected on success |
|---|---|---|
| Pure coverage tests | `npx vitest run ../scripts/lib/assessmentCoverage.test.js` | all pass |
| Mapper/loader/hook tests | `npx vitest run src/lib/catalogMapper.test.js src/lib/dataLoader.test.js src/hooks/useCatalog.test.jsx` | all pass |
| Generate current artifacts | `npm run build:pc-data && npm run sync:pc-data` | new manifest generated and synced |
| Artifact contract | `npm run test:artifacts` | all artifact tests pass |
| Required app gate | `npm run check` | exit 0 |
| Post-build parity | `npx vitest run src/lib/postBuildAssertion.test.js` | use only after an authorized production build; otherwise defer and report |
| Diff hygiene | `git diff --check` | exit 0 |

`npm run build:pc-data` uses existing ignored raw inputs. If they are unavailable,
STOP. Do not run `npm run download:pc-data` without explicit authorization.

## Scope

**In scope**:

- `scripts/lib/assessmentCoverage.js` and test.
- `scripts/build_pc_data.js` — generate `assessment-coverage.min.json`.
- `pc-quote-builder/src/lib/catalogMapper.js` and tests — preserve compact
  provenance/evidence already present in downloaded category payloads.
- `pc-quote-builder/src/lib/dataLoader.js` and tests — load the manifest.
- `pc-quote-builder/src/hooks/useCatalog.js` and tests — expose
  `assessmentCoverage` without changing existing category readiness.
- `pc-quote-builder/src/lib/artifactContract.test.js`.
- Generated `data/processed/assessment-coverage.min.json` and synchronized
  `pc-quote-builder/public/data/assessment-coverage.min.json`, produced only by
  the pipeline.
- Workflow/docs comments only if needed to describe the new validated artifact.

**Out of scope**:

- Catalog downloads or source pin changes.
- New product eligibility/ranking, hidden product filtering, or score UI.
- Per-retailer offers or price coverage.
- Analyzer verdict changes; Plan 028 owns report semantics.
- Hard CI thresholds before owner approval and Plan 035 baselines.
- Hand-editing anything in generated directories or `docs/`.

## Git workflow

- Branch: `advisor/030-generate-assessment-coverage-contract`
- Suggested commits: `030: define assessment coverage manifest` and
  `030: preserve runtime evidence metadata`.
- Generated artifacts belong in the same logical commit as their generator and
  contract tests.

## Steps

### Step 1: Define rule requirements as data

Create a pure registry in `assessmentCoverage.js` keyed by the stable finding
IDs from Plan 028. For each rule, declare:

- dimension and decision type;
- component categories involved;
- required fields per category;
- how a field is classified as present, explicit, inferred, conflicting,
  missing, or not applicable;
- whether both sides are required for a deterministic conclusion.

Do not duplicate compatibility formulas or severity. This module measures
assessability only.

**Verify**:
`cd pc-quote-builder && npx vitest run ../scripts/lib/assessmentCoverage.test.js`
→ every Plan 028 v1 rule has exactly one registry entry and unknown rule IDs fail.

### Step 2: Compute a deterministic aggregate manifest

Export `computeAssessmentCoverage(catalog, metadata)`. Produce:

```json
{
  "schemaVersion": "assessment-coverage/v1",
  "generatedAt": "<same catalog snapshot time>",
  "rulesVersion": "<Plan 028 rules version>",
  "categories": {},
  "dimensions": {}
}
```

For each category and dimension, report integer numerator/denominator counts for
the evidence classes. Use deterministic key ordering. Never include a ratio
without its counts, and never label a dimension `supported` until an explicit
owner threshold exists. Reject impossible counts, duplicate IDs, and mismatched
catalog/rules versions.

**Verify**:
focused tests cover complete, sparse, inferred, conflicting, empty,
not-applicable, deterministic-ordering, and invalid-count fixtures.

### Step 3: Generate and synchronize the manifest

Update `scripts/build_pc_data.js` to calculate the manifest from the same merged
arrays and snapshot metadata used for all other artifacts. Add it to `outputs`.
Do not read the just-written JSON back from disk. The sync script should require
no change because it already copies every `.min.json`; add a test only if that
assumption no longer holds.

**Verify**:
`cd pc-quote-builder && npm run build:pc-data && npm run sync:pc-data`
→ both exit 0 and the two manifest files are byte-identical.

### Step 4: Strengthen artifact contracts without hard coverage gates

Update `artifactContract.test.js` to require the manifest, schema/rules/catalog
versions, all v1 dimensions/rules, nonnegative integer counts, numerator ≤
denominator, and deterministic JSON shape. Assert known current gaps are
represented as low/missing coverage, not test failures.

**Verify**:
`cd pc-quote-builder && npm run test:artifacts`
→ all tests pass, including malformed-manifest negative cases.

### Step 5: Preserve compact per-product evidence in runtime mapping

For each normalized component object, add a consistent `evidence` property that
retains only already-fetched values needed by Analyzer explanations:

- source identifiers/source set;
- explicit/inferred flags available for relevant fields;
- conflict flags;
- quality score;
- normalized identity key only if required for candidate generation.

Default missing metadata to empty arrays/objects, never optimistic values. Do
not copy unrelated raw records or increase network payloads; the category JSON
already carries these fields.

**Verify**:
`npx vitest run src/lib/catalogMapper.test.js`
→ evidence survives mapping for all six categories; missing metadata is safe;
inputs remain immutable.

### Step 6: Load the aggregate manifest lazily

Add `loadAssessmentCoverageFile` beside `loadCompatibilityFile`. Update
`useCatalog` to load it when compatibility metadata is requested and expose
`assessmentCoverage`, plus an independent error/readiness state if needed.
Failure to load coverage must not silently imply full support and must not make
catalog categories unusable.

**Verify**:
`npx vitest run src/lib/dataLoader.test.js src/hooks/useCatalog.test.jsx`
→ success, failure, cancellation, rapid reload, fallback, and deduplication pass.

### Step 7: Run full verification and inspect generated scope

Run artifact tests and `npm run check`. Review generated diffs: only the new
manifest should be added; existing category files must not change unless the
same raw inputs and generator legitimately produce a documented deterministic
change. Do not build into `docs/` during iteration.

**Verify**:
`npm run test:artifacts && npm run check && git diff --check`
→ all exit 0.

## Test plan

- Pure tests for every evidence classification and rule registry entry.
- Contract tests for malformed/missing/negative/inconsistent counts.
- Mapper tests for all categories and missing metadata.
- Loader/hook sad paths: network failure, stale request, reload, fallback.
- Regression: no existing compatibility or selection test changes meaning.
- If production build is authorized, run post-build parity afterward.

## Done criteria

- [ ] A deterministic `assessment-coverage/v1` manifest is generated from the
  same snapshot as catalog artifacts.
- [ ] Every Analyzer v1 rule has declared required fields and coverage counts.
- [ ] No unsupported dimension is labeled supported.
- [ ] Runtime component mapping preserves compact evidence metadata.
- [ ] Manifest loading failure is explicit and isolated.
- [ ] `npm run test:artifacts`, `npm run check`, and `git diff --check` pass.
- [ ] Generated files were produced by the pipeline, not hand-edited.
- [ ] No catalog download, ranking, UI score, or hard threshold was introduced.
- [ ] `plans/README.md` is updated.

## STOP conditions

Stop and report if:

- Plan 028 rule IDs/required fields are unavailable or unstable.
- Coverage requires reproducing compatibility formulas.
- Existing raw inputs are missing and regeneration would require a download.
- The current catalog cannot identify explicit versus inferred evidence for a
  claimed dimension; report it as unknown rather than inventing classification.
- The new artifact materially increases all category payloads.
- Someone requests a global catalog score or hard launch gate without approved
  thresholds.
- Existing generated artifacts change unexpectedly.

## Maintenance notes

Whenever an Analyzer rule or catalog schema changes, update the requirement
registry, manifest schema/tests, and consumer together. Maintainers and
automated regression reports should compare counts across refreshes and
investigate sharp regressions, but low coverage alone is not a pipeline failure
until an owner-approved threshold says so.
