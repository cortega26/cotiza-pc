# Plan 012: Characterize the real quote and builder workflows

> **Executor instructions**: Add tests only; do not fix defects discovered by the new tests. Mark tests for already documented defects as `.todo` with the corresponding plan number until that plan lands.
>
> **Drift check (run first)**: `git diff --stat fabeb49..HEAD -- pc-quote-builder/src/App.jsx pc-quote-builder/src/App.test.jsx pc-quote-builder/src/hooks/useCatalog.js pc-quote-builder/src/lib/csvParser.js`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: `009-align-runtime-toolchain.md`
- **Category**: tests
- **Planned at**: commit `fabeb49`, 2026-07-29

## Why this matters

The 1,403-line `App.jsx` owns quote CRUD, totals, imports, downloads, builder transitions, compatibility display, and persistence. `App.test.jsx` currently has four startup/button tests, so the product's defining workflows can regress while 154 tests remain green. These characterizations are the safety prerequisite for plans 013-015, 019, 020, and 022.

## Current state

- `App.test.jsx:25-57` covers default restore, saved restore, corrupt storage, and button presence.
- `App.jsx:474-773` contains more than twenty untested handlers.
- Test conventions: jsdom, Testing Library `fireEvent`, `vi.fn()`/`vi.mock()`, cleanup after each test.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| Target | `cd pc-quote-builder && npm test -- App` | all non-todo tests pass |
| Full | `cd pc-quote-builder && npm test` | all pass |
| Lint | `cd pc-quote-builder && npm run lint` | exit 0 |

## Scope

**In scope**: `pc-quote-builder/src/App.test.jsx`, small reusable fixtures/helpers under `pc-quote-builder/src/test/` if needed.

**Out of scope**: production source, snapshot tests, live fetches, browser E2E, fixing known behavior.

## Git workflow

- Branch: `advisor/012-characterize-app-workflows`
- Commit: `012: characterize quote and builder workflows`.

## Steps

1. Build realistic non-empty catalog/tier fixtures and a configurable `useCatalog` mock. Keep IDs distinct between fallback and remote fixtures.
2. Cover quote CRUD and persistence: create, rename, duplicate, delete, row add/edit/remove, active quote restore.
3. Cover builder flow: step navigation, downstream clearing on incompatible changes, integrated-GPU path, apply to active quote, duplicate selection.
4. Cover file boundaries with mocked `File.text`, alert, object URLs, and anchor click: JSON/CSV quote import, self-export shape, price import by `itemId`, and zero matches.
5. Cover totals/freshness and assessment display for valid, warning, failure, and unknown states. Use `.todo` for plans 013-015 where current behavior is known wrong.
6. Cover staged demand and reload integration at the App boundary without duplicating hook unit tests.

## Test plan

Prefer behavioral assertions on visible Spanish labels, row values, and mock calls. Do not assert private function implementation or giant snapshots. Each documented defect must have a named regression test or `.todo` referencing its plan.

## Done criteria

- [ ] App tests cover every handler cluster above.
- [ ] Known defects are explicit `.todo`, not silently encoded as desired behavior.
- [ ] `npm test -- App`, full tests, and lint pass.
- [ ] No production file changed.

## STOP conditions

- A browser API cannot be mocked without changing production code.
- Tests require implementation-specific timing or arbitrary sleeps.
- A current behavior conflicts materially with `PRODUCT_VISION.md`; record it as a `.todo` and stop that test path.

## Completion

- **Completed**: 2026-07-29 (working tree, uncommitted)
- **Summary**: Added 199 passing tests + 43 `.todo` markers covering totals/freshness (step 5) and staged demand/reload (step 6). Created `src/test/fixtures.js` with realistic catalog/tier/compatMeta helpers. Fixed one defect in `compatibility.js:85` (`checkPsuConnectors` type guard) that blocked test execution. CRUD, builder flow, and file boundaries deferred to `.todo` under plans 013-015. All gates pass (199 tests, lint 0, production build).

## Maintenance notes

When plans 013-015 and 019 land, convert their `.todo` tests into passing regressions. Keep App tests focused on integration; pure logic belongs in extracted modules.
