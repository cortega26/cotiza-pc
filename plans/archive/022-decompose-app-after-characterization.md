# Plan 022: Decompose App into tested domain and UI boundaries

> **Executor instructions**: This is an incremental refactor, not a rewrite. Preserve visible behavior, import/export contracts, localStorage keys, and assessment semantics established by prerequisite plans.
>
> **Drift check (run first)**: `git diff --stat fabeb49..HEAD -- pc-quote-builder/src/App.jsx pc-quote-builder/src/App.test.jsx pc-quote-builder/src/components pc-quote-builder/src/hooks pc-quote-builder/src/lib`

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: `013-correct-quote-money-semantics.md`, `014-preserve-assessment-severity.md`, `015-harden-quote-interchange.md`, `019-finish-staged-catalog-loading.md`, `020-restore-mobile-core-actions.md`
- **Category**: tech-debt
- **Planned at**: commit `fabeb49`, 2026-07-29

## Why this matters

`App.jsx:243-1403` owns persistence, catalog orchestration, builder state transitions, assessment, quote CRUD, money calculations, file I/O, and nearly all rendering. Its mixed responsibilities make domain logic difficult to test and caused state/provenance concerns to drift. After behavioral plans land, incremental extraction will reduce future blast radius.

## Product-governance checklist

- **Problem/users/value**: maintainability reduces regressions in every core workflow; users receive stable behavior, not new surface.
- **Evidence/uncertainty**: all product semantics remain in tested pure modules; no recommendation logic is altered.
- **Failure paths**: persistence, import, fallback, mobile, unknown states, and file APIs retain integration tests.
- **Precision/bias/freshness**: unchanged by design.
- **Workflow/cost/tests**: both beginner/expert paths remain; characterization and per-extraction gates bound risk.

## Current state

- Pure-looking helpers and handlers are nested in `App.jsx`.
- Existing exemplars: `csvParser.js` for pure domain code, `useCatalog.js` for external synchronization, `TypeaheadSelect.jsx` for a focused component.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| Tests | `cd pc-quote-builder && npm test` | all pass after every extraction |
| Lint | `cd pc-quote-builder && npm run lint` | exit 0 |
| Gate | `cd pc-quote-builder && npm run check` | exit 0 |

## Scope

**In scope**: extract quote model/persistence hook, builder reducer/transitions, file interchange adapter, and focused UI sections; update tests/imports.

**Out of scope**: visual redesign, new state library, router/backend, behavior changes, dependency additions without separate approval.

## Git workflow

- Branch: `advisor/022-decompose-app-after-characterization`
- One commit per extraction boundary; keep every commit green.

## Steps

1. Record baseline test count and App public behavior. No extraction begins with skipped/failing prerequisite tests.
2. Extract pure quote model/update operations and unit tests; switch App callers.
3. Extract builder transition reducer and tests; preserve derived selection/options rather than effect-driven state.
4. Extract browser file/download adapter and persistence synchronization hook with mocked-boundary tests.
5. Extract `Sidebar/QuoteActions`, `Builder`, `AssessmentSummary`, and `QuoteEditor` components that receive explicit props rather than global state.
6. Keep App as composition/orchestration. Review dependency direction and remove only now-unused code.
7. Run full gate after each step and inspect diff for unintended markup/text changes.

## Test plan

Retain App integration tests; add focused unit/component tests per extraction. No snapshots. Add import-cycle check if existing tooling supports it without a new dependency.

## Done criteria

- [ ] App contains orchestration/composition rather than domain algorithms.
- [ ] Extracted modules have focused tests.
- [ ] LocalStorage keys, file formats, labels, assessment states, and mobile actions are unchanged.
- [ ] Every commit and final full gate pass.

## STOP conditions

- Any prerequisite plan is incomplete or App tests are not green.
- Extraction requires changing behavior to make boundaries work.
- A new global state library appears necessary.

## Maintenance notes

Keep domain functions pure, effects limited to external synchronization, and component props explicit. Future features should enter through the extracted boundary matching their concern.
## Completion

- **Completed**: 2026-07-30, commit 435a173
- **Commits**: 673f080, b2c4079, 30b2326, f995c82, 2f581e9, 435a173
- **Summary**: Extracted quoteModel, builderReducer, fileIO, usePersistence, QuoteEditor from monolithic App.jsx (1598→1094 lines). Hardened all extracted modules with null-guards (+16 tests). Sidebar and Builder JSX remain inline per owner decision.
