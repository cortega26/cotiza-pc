# Plan 018: Guarantee unique catalog IDs without orphaning saved quotes

> **Executor instructions**: Catalog IDs are persisted in quote `itemId` and price files. Do not change the ID algorithm until a backward-compatible alias/migration contract is designed and tested.
>
> **Drift check (run first)**: `git diff --stat fabeb49..HEAD -- scripts/build_pc_data.js scripts/lib pc-quote-builder/src/lib/artifactContract.test.js pc-quote-builder/src/lib/catalogMapper.js pc-quote-builder/src/App.jsx pc-quote-builder/src/**/*.test.* data/processed pc-quote-builder/public/data docs/data`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: `015-harden-quote-interchange.md`, `016-extract-catalog-compiler.md`
- **Category**: bug / migration
- **Planned at**: commit `fabeb49`, 2026-07-29

## Why this matters

Current artifacts contain 86 duplicate GPU IDs, six duplicate motherboard IDs, and one duplicate each for cases and RAM. Typeaheads use IDs as React keys, selections use `.find()`, tier maps overwrite by ID, and price imports match by `itemId`; collisions make products unselectable or silently resolve to another product. Fix risk is high because existing saved/exported quotes persist these IDs.

## Product-governance checklist

- **Problem/users/value**: every selected/priced component must identify one product; improves correctness, price matching, provenance, and confidence.
- **Evidence/uncertainty**: canonical identity records source IDs and collision resolution; ambiguous legacy aliases are surfaced, not guessed.
- **Explanation/precision**: migrations report resolved/unresolved IDs; no product ranking or false identity confidence.
- **Failure paths**: cross-brand same models, punctuation-only distinctions, source merges/splits, legacy collisions, and duplicate source rows are tested.
- **Freshness/provenance**: aliases retain source/version context.
- **Beginner/expert/value**: selection remains stable for both; deterministic contracts prevent recurrence.

## Current state

`mergeGpu` builds IDs from model/chipset without brand (`build_pc_data.js:476-477`). Other IDs use a slug that removes punctuation distinctions. `artifactContract.test.js` checks non-empty IDs but not uniqueness.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| Compiler | `cd pc-quote-builder && npm test -- catalogCompiler` | all pass |
| Artifact | `cd pc-quote-builder && npm run test:artifacts` | uniqueness passes |
| App/import | `cd pc-quote-builder && npm test -- App csvParser catalogMapper` | all pass |
| Pipeline/gate | project pipeline commands, then `npm run check` | exit 0 |

## Scope

**In scope**: canonical ID algorithm, source aliases/migration metadata, uniqueness contracts, quote/price resolution of legacy aliases, regenerated artifacts and focused docs/tests.

**Out of scope**: fuzzy product matching, deleting ambiguous saved rows, retailer SKUs, changing quote local IDs, unrelated normalization.

## Git workflow

- Branch: `advisor/018-guarantee-catalog-id-uniqueness`
- Use separate commits for contracts, migration logic, then regenerated artifacts.

## Steps

1. Add failing per-category uniqueness contracts and collision fixtures matching current GPU/motherboard punctuation/brand examples.
2. Define a versioned canonical identity including category, brand, normalized distinguishing model fields, and deterministic collision suffix only where needed.
3. Produce a legacy-alias map. A legacy ID mapping to one new ID resolves automatically; one-to-many collisions remain explicitly ambiguous and retain quote text rather than choosing silently.
4. Update catalog selection, tier lookup, and price import paths to use canonical IDs plus safe legacy aliases.
5. Regenerate artifacts and verify no duplicate IDs in every array and tier list.
6. Add import/localStorage migration tests and a documented compatibility note.

## Test plan

Cover same model across brands, `+`/punctuation variants, repeated exact source rows, merged multi-source identity, deterministic re-run, unique/ambiguous legacy alias, stale saved quote, and price file with legacy/new IDs.

## Completion record

- **Completed**: 2026-07-30 (commit pending push to main)
- **Summary**: `slug()` preserves `+`; `mergeGpu` includes brand in ID; all merge functions emit `legacy_id` for backward-compatible alias map; `deduplicateIds()` appends `_N` suffix to remaining collisions; `computeLegacyAliases()` builds 1:1 old→new mapping from `legacy_id` fields; alias map embedded in `compatibility.min.json.aliases`; frontend `resolveCatalogId()` resolves IDs in `selection` memo, `handleBuilderChange`, and `handleImportPrices`; price map enlarged with both old and new IDs for bidirectional matching.
- **Gate**: 415 tests pass, 0 lint, build ok, artifact contracts intact.

## Done criteria

- [ ] Every deployed category and tier list has unique IDs.
- [ ] Selecting any current collision resolves the intended product.
- [ ] Unambiguous saved IDs migrate; ambiguous IDs never silently choose.
- [ ] Pipeline output is deterministic and all gates pass.

## STOP conditions

- Product identity cannot be made stable from available fields.
- More than a tolerable documented share of persisted IDs is ambiguous and needs owner policy.
- The migration would silently rewrite quote products or prices.

## Maintenance notes

Treat canonical IDs as a versioned public contract. Future normalization changes require collision and alias tests before artifact regeneration.
