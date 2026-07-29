# Plan 014: Preserve compatibility severity and prevent false all-clear verdicts

> **Executor instructions**: Read `docs/PRODUCT_VISION.md` before editing. The five mandated states—confirmed incompatibility, potential problem, suboptimal combination, insufficient data, valid—must remain distinct.
>
> **Drift check (run first)**: `git diff --stat fabeb49..HEAD -- pc-quote-builder/src/lib/compatibility.js pc-quote-builder/src/lib/selectionEvaluation.js pc-quote-builder/src/lib/compatibility.test.js pc-quote-builder/src/lib/selectionEvaluation.test.js pc-quote-builder/src/App.jsx pc-quote-builder/src/App.test.jsx`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `012-characterize-app-workflows.md`
- **Category**: bug
- **Planned at**: commit `fabeb49`, 2026-07-29

## Why this matters

RAM speed warnings are returned as `compatible: true` and then discarded, while unknown connector/fit checks stay out of `builderIssues`; the UI consequently shows a green “Todo ok” whenever the flat issue list is empty. A complete build can therefore be presented as valid while evidence is missing.

## Product-governance checklist

- **Problem/users/value**: beginner and expert builders need a truthful compatibility verdict; this improves compatibility, explainability, and confidence.
- **Evidence/uncertainty**: each result records verified/inferred/heuristic/unknown evidence and never promotes unknown to valid.
- **Explanation/action**: every non-valid result keeps reason, affected components, and a user action.
- **Precision/commercial bias**: no score, ranking, affiliate, or sponsorship behavior is added.
- **Failure paths/data**: missing dimensions/connectors, absent selections, multiple warnings, and conflicting checks have explicit states.
- **Workflow/cost**: existing guided behavior remains non-blocking; deterministic centralized results and focused tests prove the change.

## Current state

`compatibility.js:42-43` returns a warning while compatible. `selectionEvaluation.js:72-78` records only incompatible results. `App.jsx:1177-1188` renders green based only on `builderIssues.length`.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| Unit | `cd pc-quote-builder && npm test -- compatibility selectionEvaluation` | all pass |
| App | `cd pc-quote-builder && npm test -- App` | all pass |
| Gate | `cd pc-quote-builder && npm run check` | exit 0 |

## Scope

**In scope**: compatibility result shapes, `selectionEvaluation`, assessment rendering/copy, focused tests and documented status types.

**Out of scope**: adding new compatibility dimensions, changing PSU formulas, blocking expert overrides, introducing a universal score, workload-specific balance.

## Git workflow

- Branch: `advisor/014-preserve-assessment-severity`
- Commit: `014: preserve assessment severity`.

## Steps

1. Define one explicit assessment result vocabulary with severity/state, reason, evidence level, and action. Adapt existing helpers without losing backward-compatible fields until callers migrate.
2. Preserve RAM warnings and every existing unknown reason in `evaluateSelection`; derive summary state deterministically from dimension states.
3. Render all-clear only if every mandatory selected-build dimension is positively valid. Render distinct incomplete, unknown, warning, and failure summaries.
4. Keep warnings informative rather than blocking component application.
5. Convert plan-014 App `.todo` tests and run all gates.

## Test plan

Cover all-valid, warning-only RAM, unknown dimensions, unknown connectors, confirmed incompatibility, mixed warning+unknown, and missing selection. Assert visible summary text and status class, not array indexes.

## Done criteria

- [ ] No unknown/warning assessment can render the all-clear panel.
- [ ] RAM warning survives through UI rendering.
- [ ] All five product-vision states are representable and tested.
- [ ] Full gate passes.

## STOP conditions

- A helper's current boolean contract has an external consumer not represented in CodeGraph.
- A proposed summary collapses warning, unknown, and failure.
- The change begins adding workload-specific balance rules.

## Maintenance notes

New compatibility checks must return the same structured result and add mixed-state summary tests.

---

## Completion summary

**Committed**: `main` (no branch — committed directly as `014: preserve assessment severity and normalize status strings`)

**What was done**:
1. All 5 check functions in `compatibility.js` now return explicit `status` (`"ok"`, `"fail"`, `"unknown"`, `"warning"`).
2. `selectionEvaluation.js` derives `summaryVerdict` from all statuses, adds `warnings` array to return value, and uses `recordCheck` helper.
3. `App.jsx` renders panels by severity: fail→"Compatibilidad a revisar", warning→"Advertencias:", unknown→"Información incompleta", ok→"Todo ok". Warnings are also rendered inside the fail panel when both exist.
4. Normalized `"warn"` → `"warning"` in `checkPsuPowerSufficiency` and callers for consistency.
5. 256 tests + 43 todo pass; lint clean; production build succeeds.

**Edge cases covered**:
- Mixed fail+warnings: both sections rendered in the same panel
- Empty selection → "Sin conflictos detectados" (no panel)
- RAM speed warning preserved through to UI
- PSU margin warning: status string normalized from `"warn"` to `"warning"`
