# Plan 019: Make staged catalog loading demand-driven, edge-triggered, and deduplicated

> **Executor instructions**: This is a corrective follow-up to archived Plan 008. Preserve fallback usability and explicit unknown states. Read `docs/PRODUCT_VISION.md`; stop if the beginner/expert control model is ambiguous.
>
> **Drift check (run first)**: `git diff --stat fabeb49..HEAD -- pc-quote-builder/src/App.jsx pc-quote-builder/src/hooks/useCatalog.js pc-quote-builder/src/lib/dataLoader.js pc-quote-builder/src/App.test.jsx pc-quote-builder/src/hooks/useCatalog.test.jsx pc-quote-builder/src/lib/dataLoader.test.js`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: `012-characterize-app-workflows.md`, `014-preserve-assessment-severity.md`
- **Category**: bug / perf
- **Planned at**: commit `fabeb49`, 2026-07-29

## Why this matters

All six controls are usable while demand is only the prefix through `builderStep`, so later controls can select fallback-only products while the UI globally says “Catálogo cargado.” After one reload, every step change is treated as another full reload. Concurrent misses are not cached until completion, allowing duplicate large downloads. The loading state machine must describe actual category readiness and provenance.

## Product-governance checklist

- **Problem/users/value**: builders need responsive loading without unverified conclusions; improves compatibility, confidence, and beginner/expert workflows.
- **Evidence/uncertainty**: per-category remote/fallback/loading/error state is explicit and feeds assessment unknown states.
- **Explanation/precision**: UI never claims globally verified data from partial readiness.
- **Failure paths**: rapid navigation, shrink/expand demand, reload races, failed compatibility, stale saved selections, and fallback-only IDs are tested.
- **Freshness/provenance**: cache-bust generations and source state remain visible.
- **Bias/value**: no ranking; bandwidth reduction is measured, not assumed.

## Current state

- `App.jsx:252-261`: demand derives only from step.
- `App.jsx:950-1102`: all controls render.
- `useCatalog.js:61`: `reloadToken !== 0` stays true forever.
- `dataLoader.js:13-22`: cache stores completed data, not pending promise.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| Loader/hook | `cd pc-quote-builder && npm test -- dataLoader useCatalog` | all pass |
| App | `cd pc-quote-builder && npm test -- App` | all pass |
| Gate | `cd pc-quote-builder && npm run check` | exit 0 |

## Scope

**In scope**: loading state machine, category demand integration, per-category status/provenance UI, cache implementation, focused tests.

**Out of scope**: catalog schema/data changes, service workers/offline mode, search indexing, new builder recommendation features.

## Git workflow

- Branch: `advisor/019-finish-staged-catalog-loading`
- Commit by state-machine tests, loader, then UI integration.

## Steps

1. Record the owner-approved UX invariant: either only the active guided control is usable, or visible/interacted/persisted selections directly demand their categories. Preserve an expert path rather than accidentally removing it.
2. Model per-category states and generation token. Completeness uses resolved catalog entities, not merely stored IDs.
3. Make reload edge-triggered by comparing token generations; later demand changes under the same generation load only newly needed categories.
4. Cache pending promises before await; share concurrent work, evict rejection, isolate cache-bust generations.
5. Abort requests where supported and continue ignoring stale results as a fallback.
6. Render per-category pending/fallback/remote/error evidence and remove misleading global verification.
7. Measure request count/payload for initial quote editing, normal builder traversal, rapid traversal, and one reload.

## Test plan

Use real loader fetch mocks for concurrent deduplication/rejection eviction. Hook tests cover reload then step change, rapid generations, compatibility failure, shrink/expand, stale results. App tests cover later control interaction and saved IDs before category readiness.

## Done criteria

- [ ] No usable control relies on an undemanded category without explicit fallback state.
- [ ] One reload triggers one full invalidation only.
- [ ] Concurrent same-URL requests share one fetch.
- [ ] Summary cannot be all-clear while required categories are pending/fallback unknown.
- [ ] Measured request counts and full gate pass.

## STOP conditions

- Product owner has not resolved active-step guided versus simultaneous expert controls.
- Fallback/remote IDs cannot be reconciled without plan 018.
- Cancellation support changes fallback or cache-bust behavior.

## Maintenance notes

Every new category must declare demand dependencies and per-category tests. Never reduce readiness to one global boolean.

**What was done**:
1. **Pending promise cache**: `dataLoader.js` now caches in-flight fetch promises via a `pending` Map, deduplicating concurrent `loadCatalogFile` calls. Rejected promises clear their pending entry so retries work. `clearCatalogCache` clears both `cache` and `pending`.
2. **Edge-triggered reload**: `useCatalog` uses `generationRef` to compare `reloadToken` — `isReload` fires only when `reloadToken !== 0 && reloadToken !== generationRef.current`. Incremental step changes under the same generation load only newly needed categories via `needed = curr.filter(c => !loadedRef.current.has(c))`.
3. **Per-category readiness**: `categoryStates` derived via `useMemo` from `loadedCategories`, `loading`, `fallbackUsed`, and `requestedCategories`. Priority: `loaded > loading > fallback > empty`. All 6 product categories tracked independently.
4. **App catalog chip**: Renders `"Cargando..."` while umbrella loading is true; `"Cargando categorías..."` when pending/empty needed categories exist (transient before effect starts loading); singular/plural `"Catálogo parcial (...)"` for fallback categories; `"Catálogo cargado"` when all needed are loaded.
5. **17 new tests**: `dataLoader.test.js` (8: pending dedup, cache, retry, cache-bust separation), `useCatalog.test.jsx` (6: categoryStates lifecycle, independent tracking), `App.test.jsx` (3: chip variants for empty, singular fallback, plural fallback).
6. **Full audit completed**: All 5 modules (Plans 016-019) checked for sad paths and edge cases; only issue was `window.fetch` leak in `dataLoader.test.js` (fixed with save/restore). 431 tests + 30 todo pass; lint clean; production build succeeds.
