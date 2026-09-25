# Plan 041: Retire the unused builder reducer API and keep only the builder helpers

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6cde4b8..HEAD -- pc-quote-builder/src/lib/builderReducer.js pc-quote-builder/src/lib/builderReducer.test.js pc-quote-builder/src/App.jsx pc-quote-builder/src/hooks/usePersistence.js`
> If any in-scope file changed since this plan was written (in particular if
> plan 040 added tests touching these files), compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/040-characterize-app-quote-flows.md (characterization tests must land first)
- **Category**: tech-debt
- **Planned at**: commit `6cde4b8`, 2026-09-25

## Why this matters

`pc-quote-builder/src/lib/builderReducer.js` exports a reducer and five action
creators (`SELECT`, `TOGGLE_INTEGRATED_GPU`, `CLEAR`, `LOAD`, `SET_STEP`) that
production code never imports. `App.jsx` imports only the helpers
(`BUILDER_STEPS`, `EMPTY_BUILDER`, `getNextStep`, `isStepDone`,
`builderComplete`), and the live cascade logic lives inline in
`handleBuilderChange`. This is an artifact of archived Plan 022: its
"extract builder transitions" boundary exists only in tests, so
`builderReducer.test.js` shows green coverage of a state machine the
application does not run, while the production cascade path is only partially
covered. Changing builder behavior today requires editing two code paths that
can drift silently.

After this plan, one name matches one behavior: `builderHelpers.js` contains
only what production uses, and the dead reducer API is gone. This is a
behavior-preserving change; the live cascades stay in `App.jsx` (plan 050
later makes their notices explicit).

## Current state

`pc-quote-builder/src/lib/builderReducer.js:20-48` defines
`SELECT`/`TOGGLE_INTEGRATED_GPU`/`CLEAR`/`LOAD`/`SET_STEP` and
`builderReducer(state, action)`.

Production imports:

- `pc-quote-builder/src/App.jsx:12-18`:
  ```js
  import {
    BUILDER_STEPS,
    EMPTY_BUILDER,
    getNextStep,
    isStepDone,
    builderComplete as isBuilderComplete,
  } from "./lib/builderReducer";
  ```
- `pc-quote-builder/src/hooks/usePersistence.js:4`:
  `import { EMPTY_BUILDER } from "../lib/builderReducer";`
- `pc-quote-builder/src/lib/builderReducer.test.js:3-14` imports the reducer
  and every action creator, then tests them at `:18-80`.

Verified inventory on this commit (advisor ran `rg -ln "builderReducer" pc-quote-builder/src`):
only those four files.

## Commands you will need

| Purpose | Command | Provenance | Expected on success |
|---|---|---|---|
| Install | `npm ci` (in `pc-quote-builder/`) | declared | exit 0 |
| Focused tests | `npm test -- builderReducer` | declared | all pass |
| Full tests | `npm test` | executed | all pass |
| Lint | `npm run lint` | executed | exit 0 |

## Scope

**In scope**:
- `pc-quote-builder/src/lib/builderReducer.js` (rename to `builderHelpers.js`; delete dead API)
- `pc-quote-builder/src/lib/builderReducer.test.js` (rename to `builderHelpers.test.js`; trim to retained helpers)
- `pc-quote-builder/src/App.jsx` (import path only)
- `pc-quote-builder/src/hooks/usePersistence.js` (import path only)

**Out of scope**:
- Moving the inline cascades out of `App.jsx` (plan 050 touches them; a future
  reducer design is a separate decision).
- Anything in `pc-quote-builder/src/components/` or `src/lib/quoteAnalyzer/`.
- Generated artifacts and workflows.

## Git workflow

- Branch: `advisor/041-retire-dead-builder-reducer`
- Commits: `041: <imperative summary>` (e.g. `041: retire unused builder reducer API`).
- Do NOT push or open a PR.

## Steps

### Step 0: Establish a green baseline

From `pc-quote-builder/`: `npm ci`, `npm test`, `npm run lint` — all exit 0.
Confirm plan 040 landed by checking that `npx vitest run src/App.test.jsx --reporter=verbose`
reports 0 todo (or only explicitly documented bug todos). If it still reports
27 todo, STOP — the characterization tests this plan depends on are missing.

### Step 1: Rename the module and delete the dead API

1. `git mv pc-quote-builder/src/lib/builderReducer.js pc-quote-builder/src/lib/builderHelpers.js`
2. In `builderHelpers.js`, delete `SELECT`, `TOGGLE_INTEGRATED_GPU`, `CLEAR`,
   `LOAD`, `SET_STEP`, and the `builderReducer` function. Keep exactly:
   `BUILDER_STEPS`, `EMPTY_BUILDER`, `getNextStep`, `isStepDone`,
   `builderComplete`. Keep the file comment-free per repo style.
3. `git mv pc-quote-builder/src/lib/builderReducer.test.js pc-quote-builder/src/lib/builderHelpers.test.js`
   and trim it to the retained helpers: import from `./builderHelpers`, delete
   the `describe("builderReducer")` block and all action-creation tests, keep
   any `getNextStep`/`isStepDone`/`builderComplete` tests. If none exist for a
   retained helper, add focused tests for it (bounds, null state, integrated-GPU
   handling).
4. Update the two production imports:
   - `App.jsx:18`: `from "./lib/builderReducer"` → `from "./lib/builderHelpers"`.
   - `usePersistence.js:4`: `from "../lib/builderReducer"` → `from "../lib/builderHelpers"`.

**Verify**:
- `rg -n "builderReducer" pc-quote-builder/src` returns no matches.
- `rg -n "TOGGLE_INTEGRATED_GPU|SET_STEP" pc-quote-builder/src` returns no matches.
- `npm test -- builderHelpers` → all pass.
- `npm test` → exit 0 with the same number of passing tests minus the deleted
  reducer cases, and zero failures.

### Step 2: Confirm no behavior change

Run the full suite and lint, then inspect the diff.

**Verify**: `npm run lint` exit 0; `git diff -M --stat 6cde4b8...HEAD` shows the
rename plus only import-path edits in `App.jsx`/`usePersistence.js`.

## Test plan

- The renamed `builderHelpers.test.js` keeps helper coverage and drops
  reducer-only tests.
- Plan 040's App characterization tests are the integration safety net for the
  import-path change (if this plan is executed before 040, STOP).

**Verification**: `npm test` → 0 failures; `npm run lint` → exit 0.

## Done criteria

ALL must hold:

- [ ] `rg -n "builderReducer" pc-quote-builder/src` returns no matches
- [ ] `rg -n "TOGGLE_INTEGRATED_GPU|SET_STEP" pc-quote-builder/src` returns no matches
- [ ] `test -f pc-quote-builder/src/lib/builderHelpers.js` and
      `test -f pc-quote-builder/src/lib/builderHelpers.test.js`
- [ ] `npm test` exits 0
- [ ] `npm run lint` exits 0
- [ ] `git diff --name-only 6cde4b8...HEAD` lists only the two renamed files,
      `App.jsx`, and `usePersistence.js` (planned-at paths: `builderReducer.js`,
      `builderReducer.test.js`, `App.jsx`, `usePersistence.js`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 040 has not landed (App.test.jsx still reports 27 todo).
- Some production file other than `App.jsx`/`usePersistence.js` imports from
  `builderReducer`.
- Any test fails after the rename (report the failure; do not re-add the
  reducer to make it pass).

## Maintenance notes

- The `LOAD` action was a plausible seam for a future Analyzer → Expert
  handoff. It is being removed deliberately: if that direction is approved
  later, reintroduce a reducer together with characterization tests rather than
  keeping unused machinery.
- The inline cascades in `App.jsx:326-368` remain the single owner of builder
  transition behavior; plan 050 adds explicit user notices there.
- Reviewer should scrutinize: only import paths changed in production files;
  no cascade, filtering, or copy change.
