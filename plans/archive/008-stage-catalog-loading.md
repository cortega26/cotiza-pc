# Plan 008: Stage catalog loading by builder demand

> **Executor instructions**: This is a performance plan; measure and retain behavior before optimizing. Update the plan index only after all checks pass.
>
> **Drift check**: `git diff --stat 63ecbca..HEAD -- pc-quote-builder/src/hooks/useCatalog.js pc-quote-builder/src/lib/dataLoader.js pc-quote-builder/src/App.jsx pc-quote-builder/src/**/*.test.* pc-quote-builder/public/data`

## Status

- **Priority**: P3; **Effort**: M; **Risk**: MED; **Depends on**: plans 002, 006
- **Category**: perf
- **Planned at**: commit `63ecbca`, 2026-07-29
- **Status**: ✅ Done — superseded by Plan 019 (staged catalog loading with generationRef, categoryStates, pending-promise cache, per-category readiness UI).

## Why this matters

The app fetches and parses all seven catalog files immediately on mount even when a visitor only edits quotes. The files total roughly 8.6 MB uncompressed; the guided builder is optional. Staged loading can improve initial interactions, especially on constrained connections, but must not weaken fallback or compatibility validation.

## Current state

`dataLoader.js:26-42` calls `Promise.all` for all categories and compatibility metadata. `useCatalog.js:18-50` invokes it on mount. `App.jsx:253-310` creates selections/options for every category, while `builderStep` identifies the active step.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| Size baseline | `du -ch pc-quote-builder/public/data/*.min.json | tail -1` | record before/after total |
| Tests | `cd pc-quote-builder && npm test` | all pass |
| Gate | `cd pc-quote-builder && npm run check` | exit 0 |

## Scope

Modify only loader/hook/App loading integrations and tests. Do not alter data files, base URL handling, catalog schema, or use browser caching hacks that prevent explicit reload.

## Steps

1. Add tests that observe fetch calls: initial quote-only render must not require all category files; entering/selecting each builder step must request its category; selecting a part must load every dependency needed to validate that selection. Cover remote failure fallback from plan 002.
2. Refactor `dataLoader` into category-level cached promise loaders plus a compatibility loader. Preserve cache-bust behavior on explicit reload and avoid duplicate concurrent requests.
3. Refactor `useCatalog`/`App` so initial state contains fallback data and progressively fills requested categories. Keep loading/error state meaningful per requested data, prevent stale request races, and never label compatibility as verified until required datasets are loaded.
4. Measure network requests and compressed/uncompressed sizes in browser devtools or a reproducible fetch mock; record the baseline and result in the PR. Do not claim a gain without measurement.

## Done criteria

- [ ] Initial quote-only render does not fetch all seven resources.
- [ ] Each builder flow still presents compatible options and correct warning/unknown states.
- [ ] Explicit catalog reload invalidates every relevant cached category.
- [ ] Tests cover staged success, race/cancellation, and fallback.
- [ ] `npm run check` exits 0.

## STOP conditions

Stop if the app's product requirement is explicitly to preload the catalog for offline interaction, or if staged loading creates a compatibility result that can be mistaken for verified before its source data arrives.

## Maintenance notes

New catalog categories must declare their loading dependencies and corresponding tests. Prefer explicit unknown/pending UI state to speculative compatibility conclusions.
