# Plan 023: Profile and stabilize catalog typeahead rendering

> **Executor instructions**: Measure before optimizing. If profiling does not meet the threshold below, stop and record “no implementation needed” rather than adding indexing or dependencies.
>
> **Drift check (run first)**: `git diff --stat fabeb49..HEAD -- pc-quote-builder/src/components/TypeaheadSelect.jsx pc-quote-builder/src/components/TypeaheadSelect.test.jsx pc-quote-builder/src/App.jsx pc-quote-builder/src/components`

## Status

- **Priority**: P3
- **Effort**: S-M
- **Risk**: LOW
- **Depends on**: `022-decompose-app-after-characterization.md`
- **Category**: perf
- **Planned at**: commit `fabeb49`, 2026-07-29
- **Status**: DONE — profiling recorded; simple stabilization landed; no indexing/virtualization added
- **Completed**: 2026-07-30 (uncommitted working tree)

## Profiling evidence (recorded 2026-07-30, headless Chromium, full catalog, Vite dev)

Threshold defined before changes: 50 ms per repeated keystroke on the reference device, or a clearly dominant typeahead render in React Profiler.

| Methodology | Baseline (before) | After stabilization |
|---|---|---|
| Python-timed keystroke incl. 50 ms wait (flawed — wait inside span) | avg 71.1 / max 90.3 ms | avg 61.2 / max 65.8 ms |
| Python-timed keystroke, no wait (incl. protocol + 10 ms type delay) | — | 17–21 ms |
| `requestAnimationFrame` frame times during burst typing | — | avg 14.3 ms, max 16.7 ms, 0/14 frames > 50 ms, ~70 FPS |

Verdict: keystroke-to-render latency never exceeds one frame (~17 ms). Below the 50 ms threshold. Per step 4, ID/search maps are **not** justified; no new dependency or virtualization added.

## Changes landed (step-3 stabilization)

- `TypeaheadSelect.jsx`: label cache keyed by option object; `filtered` useMemo replaced `.filter().slice()` with an early-exit loop that stops at `maxItems`.
- `App.jsx`: memoized `cpuOptionsForStep` (brand/family filter) and `psuOptionsForStep` (wattage filter) so unrelated quote-row edits no longer recreate these arrays and invalidate each TypeaheadSelect's internal `useMemo`s.

## Sad-path hardening (review pass)

- `labelCache` guards `getOptionLabel` results (`|| ""`): options without a `name` no longer crash the component at mount (App passes `(opt) => opt.name`; the mapper copies raw names without guarantee).
- `optionById` preserves the previous `options.find` first-wins semantics for duplicate ids instead of last-wins `Map.set`.
- `maxItems` is clamped to `>= 0` so a negative value cannot produce an unbounded list.
- App's name label callback hoisted to module-level `getNameLabel` so `labelCache` is not invalidated by unrelated re-renders.
- Implemented the four `[plan 014]` TODO tests covering the memoized CPU brand/family and PSU wattage filter paths.

## Verification

- `npm run test`: 547 passed, 30 todo
- `npm run lint`: clean
- `npm run build:check`: success

## Why this matters

Each typeahead linearly finds/filters thousands of options, while inline callbacks change identity on every parent render and invalidate `useMemo`. The recomputation path is certain, but user-visible latency has not been measured; this plan deliberately avoids speculative indexing or virtualization.

## Current state

`TypeaheadSelect.jsx:20-34` uses `find` and `filter`; App passes inline label/render callbacks around lines 1025-1095. Current artifacts contain thousands of motherboards, cases, GPUs, and RAM kits.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| Tests | `cd pc-quote-builder && npm test -- TypeaheadSelect App` | all pass |
| Gate | `cd pc-quote-builder && npm run check` | exit 0 |
| Profile | reproducible React/browser profiling script or documented trace | before/after timings recorded |

## Scope

**In scope**: profiling harness/notes, stable callback/option identities, local memoization or precomputed ID/search maps if justified, tests.

**Out of scope**: new search dependency, virtualization, catalog schema changes, UX redesign.

## Git workflow

- Branch: `advisor/023-profile-and-stabilize-typeahead`
- Commit only if the implementation threshold is met.

## Steps

1. Profile typing and unrelated quote-row edits with representative full catalog sizes. Define implementation threshold before changing code: repeated commits or keystrokes over 50 ms on the agreed reference device, or a clearly dominant typeahead render in React Profiler.
2. If below threshold, document results in the plan/index and stop with no source change.
3. If above threshold, hoist stable default label/render functions, avoid recreating filtered CPU options, and memoize isolated builder controls.
4. Re-profile. Add ID/search maps only if the simple stabilization remains above threshold.
5. Run tests/gate and record before/after evidence.

## Test plan

Preserve keyboard, mouse, filtering, external value synchronization, maxItems, empty lists, and accessibility roles. Add render-count tests only if robust and behavior-focused.

## Done criteria

- [x] Baseline and threshold are recorded.
- [x] Either no source change is justified, or measured latency materially improves.
- [x] No new dependency or premature virtualization.
- [x] Existing tests and full gate pass.

## STOP conditions

- No reproducible latency is observed.
- Optimization requires changing filtering semantics or accessibility.
- Catalog-loading changes from plan 019 are not complete.

## Maintenance notes

Re-profile when catalog sizes change materially. Prefer stable inputs and pure precomputation over state/effect synchronization.
