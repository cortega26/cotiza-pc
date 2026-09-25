# Plan 040: Characterize App quote CRUD, builder cascades, and export boundaries with real tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6cde4b8..HEAD -- pc-quote-builder/src/App.test.jsx pc-quote-builder/src/lib/fileIO.test.js`
> If either file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (test-only; no production code)
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `6cde4b8`, 2026-09-25

## Why this matters

`App.jsx` is the highest-churn file in the repository (20 commits in 180 days,
1,174 lines) and its core quote-lifecycle and builder-cascade behavior is
declared but never executed: `App.test.jsx` contains **25 `it.todo`** plus
**2 callback-less `it("...")`** calls that Vitest reports as todo, so the suite
shows `27 todo` while CI stays green. Two of those pending tests cover the only
integration path for `handleBuilderChange`'s destructive cascade behavior. The
repository's own reducer tests provide false confidence while the production
cascade path is only partially covered. Separately, `fileIO.test.js` injects a
locally defined CSV escaper instead of the real `escapeCsvField`, so the
formula-injection protection added by Plan 015 is never exercised end-to-end
through `exportCSV`.

This plan converts the pending tests into real characterization tests and fixes
the export-boundary test double. It is deliberately test-only: if a test
reveals a production bug, STOP and report it (fixes are owned by plans 041,
044, and 038/039).

## Current state

`pc-quote-builder/src/App.test.jsx` (1,285 lines). Harness facts the new tests
must use:

- `useCatalog` is mocked via `vi.mock("./hooks/useCatalog")` with a
  `defaultMock()` (`:11-30`); `mockUseCatalog.mockReturnValue(...)` can be
  changed per test to simulate loading/fallback states.
- `makeQuote()` (`:43-55`) and `localStorageWithQuote()` (`:57-60`) seed
  quotes; `afterEach` clears `localStorage` and resets history.
- `renderApp()` (`:62-65`) waits for "Mi PC actual"; `switchToExpert()`
  (`:67-69`) clicks "Constructor experto".
- Catalog fixtures come from `./test/fixtures` (`buildRichCatalog`,
  `buildRichTierMaps`, `buildCompatMeta`, …).

Pending declarations:

- Quote CRUD/persistence `it.todo` at `:717-726` (add/duplicate/delete/last
  quote/name persistence/active id restore/empty array/normalization/row
  persistence).
- Builder flow `it.todo` at `:749-752`, `:773-775`, `:801-806`, `:842-843`
  (step navigation, socket filter, case filters, cascades, integrated GPU,
  clear, duplicate selection, empty apply).
- Callback-less `it("...")` at `:800` and `:841`:
  ```js
  it("deselects incompatible mobo when CPU socket changes [plan 014]");
  it("apply builder to quote inserts selection rows [plan 014]");
  ```
- Implementations under test: `App.jsx:384-414` (quote CRUD),
  `:503-525` (apply/duplicate selection), `:326-368` (builder cascades),
  `:615-620` (quote tabs).

`pc-quote-builder/src/lib/fileIO.test.js:92-97`:

```js
describe("exportCSV", () => {
  const esc = (v) => {
    if (v == null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
```

That helper lacks the formula-prefix escaping implemented by the real
`escapeCsvField` (`pc-quote-builder/src/lib/csvParser.js:15-25`).

Repo conventions: Testing Library `fireEvent`; `vi.fn()`/`vi.mock()` for mocks;
assert behavior and persisted data, not just success alerts. Model new tests on
the existing passing tests in `App.test.jsx` (e.g. "filters RAM by selected
motherboard memory type" at `:753`) and the `describe("Row operations")` block.

## Commands you will need

| Purpose | Command | Provenance | Expected on success |
|---|---|---|---|
| Install | `npm ci` (in `pc-quote-builder/`) | declared | exit 0 |
| Full tests | `npm test` | executed | all pass, `0 todo` in `App.test.jsx` |
| Focused tests | `npm test -- App` | declared | all pass |
| FileIO tests | `npm test -- fileIO` | declared | all pass |
| Lint | `npm run lint` | executed | exit 0 |

**Provenance**: `executed` = run by the advisor during recon; `declared` = read
from `package.json`, not run.

## Scope

**In scope**:
- `pc-quote-builder/src/App.test.jsx`
- `pc-quote-builder/src/lib/fileIO.test.js`

**Out of scope** (do NOT touch, even if a test reveals a problem):
- Every production file, including `App.jsx`, `fileIO.js`, `csvParser.js`,
  `usePersistence.js`, `builderReducer.js`. If a test exposes a bug, record it
  in your report with the failing expectation and STOP — do not fix it here.
  Known owner plans: persistence hardening = 044; reducer dead code = 041;
  power/connector = 038; quote quality = 039.
- `pc-quote-builder/src/components/**` — component tests already exist.
- Adding new test utilities/fixtures unless strictly necessary; prefer the
  existing `makeQuote`/`buildRichCatalog` helpers.

## Git workflow

- Branch: `advisor/040-characterize-app-quote-flows`
- Commits: `040: <imperative summary>` (e.g. `040: characterize quote CRUD and builder cascades`).
- Do NOT push or open a PR.

## Steps

### Step 0: Establish the todo baseline

From `pc-quote-builder/`:

1. `npm ci` and `npm test` — exit 0.
2. Run:
   ```sh
   npx vitest run src/App.test.jsx --reporter=verbose
   ```
   Confirm the summary reports `27 todo` and 93 passing tests.
3. If the numbers differ, STOP — the file has drifted.

### Step 1: Fix the two callback-less tests and the export boundary double

1. Implement `it("deselects incompatible mobo when CPU socket changes [plan 014]")`
   (`:800`) and `it("apply builder to quote inserts selection rows [plan 014]")`
   (`:841`) as real tests, following the patterns in the same `describe`
   blocks.
2. In `fileIO.test.js`, import `escapeCsvField` from `./csvParser` and use it
   in the `exportCSV` describe instead of the local `esc`. Add a case where a
   row's `notes` cell starts with `=`, and assert the exported CSV contains the
   escaped/neutralized cell exactly as `escapeCsvField` produces it.
3. Add an end-to-end assertion for `handleDownloadCSV` if the existing App
   tests already mock `downloadFile` or can capture a Blob without new
   infrastructure; otherwise keep the unit-level assertion and note the App
   path as covered by `fileIO` unit coverage only.

**Verify**: `npm test -- fileIO` → all pass; the two App tests appear as real
tests (not todo) in the verbose reporter.

### Step 2: Implement the quote CRUD and persistence todos

Convert `App.test.jsx:717-726` into real tests. Required cases (assert both the
rendered state and `localStorage` where persistence is the point):

1. adds a new quote and switches to it
2. duplicates the active quote with fresh row IDs (row IDs differ from source)
3. deletes the active quote and switches to the remaining one
4. shows an alert and does not delete the last quote (`window.alert` spy)
5. persists the quote name change to `pcqb:quotes:v1`
6. persists `activeQuoteId` to `pcqb:activeQuoteId:v1`
7. restores `activeQuoteId` from storage when valid
8. handles an empty stored `quotes` array gracefully
9. normalizes a stored quote with missing fields on load
10. persists updated quote rows to storage

If any case cannot be characterized without production changes, leave it as
`it.todo` with a one-line comment naming the blocker, count it in the summary,
and continue. Do not invent behavior.

**Verify**: `npm test -- App` → all pass; `rg -c "it\.todo" src/App.test.jsx`
decreases accordingly.

### Step 3: Implement the builder-flow todos

Convert the todos at `:749-752`, `:773-775`, `:801-806`, `:842-843` into real
tests, using `buildRichCatalog()` fixtures and the existing
`switchToExpert()` helper:

- forward/backward step navigation and stepper-chip jump
- motherboard filtering by selected CPU socket
- RAM filtering by CPU memory type (explicit)
- case filtering by motherboard form factor
- case filtering by GPU length
- case deselect when motherboard form factor changes (cascade)
- case deselect when GPU length exceeds max (cascade)
- integrated GPU toggle clears GPU selection and advances the step
- clearing the builder resets state and steps but keeps `cpuBrand`/`cpuFamily`
- duplicate builder selection creates a new quote
- apply with an empty selection shows an alert

Cascades must assert that the removed ID disappears from both the visible
selection and the stored builder/quote state, not only that a field is empty.

**Verify**: `npm test -- App` → all pass; verbose reporter shows zero todo in
the `[plan 014] Builder flow` describe.

### Step 4: Report, don't fix

If any new test fails:
1. Re-check the test against `App.jsx` behavior before assuming a bug.
2. If it is a genuine production bug, revert that test to `it.todo("… (bug: …)")`
   with the observed behavior in the title, keep the test file green, and list
   every such finding in your final report with the exact reproduction.
3. Do not modify production code.

**Verify**: `npm test` → exit 0 with no failing tests.

## Test plan

This plan *is* a test plan; the deliverables are the converted tests above.

Structural patterns to copy:
- Quote CRUD: mirror the existing `describe("Row operations")` style
  (`fireEvent.click` + `waitFor` + localStorage read).
- Builder: mirror "filters RAM by selected motherboard memory type"
  (`App.test.jsx:753`).
- Export: mirror `fileIO.test.js:187-204` (`downloadFile` behavior).

**Verification**: `npm test` → all pass; the App suite reports `0 todo`;
`npm run lint` → exit 0.

## Done criteria

ALL must hold:

- [ ] `npm test` exits 0
- [ ] `npx vitest run src/App.test.jsx --reporter=verbose` reports `0 todo`
      (or reports only the explicitly retained `it.todo("… (bug: …)")` cases,
      each listed in the final report)
- [ ] `rg -n '^\s*it\("[^"]+"\);\s*$' pc-quote-builder/src/App.test.jsx` returns
      no matches (no callback-less `it()`)
- [ ] `rg -n "escapeCsvField" pc-quote-builder/src/lib/fileIO.test.js` shows the
      real escaper is imported and used
- [ ] `git diff --name-only 6cde4b8...HEAD` lists only
      `pc-quote-builder/src/App.test.jsx` and
      `pc-quote-builder/src/lib/fileIO.test.js`
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The baseline shows anything other than 93 passed / 27 todo in
  `App.test.jsx`.
- A test requires touching production code to pass (report the bug instead).
- Existing fixtures cannot express a case without new shared helpers that would
  change `src/test/fixtures.js` (out of scope).
- The suite becomes flaky (same test failing intermittently) — report the test
  name and the timing pattern instead of adding retries.

## Maintenance notes

- These are characterization tests: they pin *current* behavior, including
  behavior later plans will intentionally change (e.g. plan 038 changes PSU
  status copy, plan 044 changes persistence fallback). When a later plan
  changes behavior, update the corresponding characterization test in the same
  change — that is the point of the suite.
- Keep the two callback-less `it()` forms from reappearing; the lint gate does
  not catch them and Vitest silently treats them as todo.
- **Deferred**: moving `App.jsx` rendering into prop-driven components is the
  remainder of archived Plan 022 and is not authorized here.
- **Completion (2026-09-25)**: implemented `e3c9e53`, reviewed and merged as
  `5d13de7`. 26 of 27 pending tests became real characterization tests
  (`App.test.jsx` 121 passing / 1 todo); the export test now uses the real
  `escapeCsvField` with a formula-prefix case. The single retained todo is
  honest, not skipped work: `App.jsx` disables the delete button when only one
  quote exists, so `handleDeleteQuote`'s `window.alert` branch is unreachable
  without a production change; the reachable guard (disabled button, click is
  a no-op, storage unchanged) is characterized. No production file was
  touched.
