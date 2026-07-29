# Plan 001: Restore a green verification gate

> **Executor instructions**: Follow every step and update this plan's row in `plans/README.md` when complete. Do not expand scope.
>
> **Drift check**: `git diff --stat 63ecbca..HEAD -- pc-quote-builder/package.json pc-quote-builder/src/App.jsx pc-quote-builder/src/components/TypeaheadSelect.jsx pc-quote-builder/src/hooks/useCatalog.js .github/workflows/pc-data-cron.yml`

## Status

- **Priority**: P1; **Effort**: S; **Risk**: MED; **Depends on**: none
- **Category**: dx
- **Planned at**: commit `63ecbca`, 2026-07-29

## Why this matters

`npm test` passes, but `npm run lint` fails four errors and the Pages workflow never invokes lint. A green, required gate must precede behavior changes so regressions are caught locally and before deployment.

## Current state

- `pc-quote-builder/package.json` has separate `lint`, `test`, and `build` scripts.
- `src/App.jsx:4` imports unused `buildSelectionChips`.
- `src/components/TypeaheadSelect.jsx:19-26,86-92` and `src/hooks/useCatalog.js:18-45` synchronously call state setters inside effects; the configured React Hooks rule rejects them.
- `.github/workflows/pc-data-cron.yml:39-60` runs `npm test` but not lint.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| Install | `cd pc-quote-builder && npm ci` | exit 0 |
| Lint | `npm run lint` | exit 0, no errors |
| Tests | `npm test` | all tests pass |
| Build | `npm run build` | exit 0 |

## Scope

Modify only `pc-quote-builder/package.json`, `pc-quote-builder/src/App.jsx`, `pc-quote-builder/src/components/TypeaheadSelect.jsx`, `pc-quote-builder/src/hooks/useCatalog.js`, related tests created under `pc-quote-builder/src/`, and `.github/workflows/pc-data-cron.yml`. Do not weaken or disable lint rules, change user-visible behavior, or edit dependency versions (plan 005 owns those).

## Steps

1. Remove the unused `buildSelectionChips` import from `App.jsx`. Verify `npm run lint` reports one fewer error.
2. Refactor the three effect patterns so state is derived during render, set from the initiating event/promise callback, or reset through a keyed component/remount—without suppressing `react-hooks/set-state-in-effect`. Preserve selection text, keyboard highlight reset, and loading behavior. Add/adjust focused tests for each preserved behavior. Verify `npm run lint && npm test` exits 0.
3. Add a `check` package script that runs `lint`, `test`, then `build`; invoke `npm run check` in the workflow after `npm ci` and before dataset work. Verify `npm run check` exits 0.

## Test plan

Follow `src/components/TypeaheadSelect.test.jsx`. Cover selected-label synchronization, Escape/filtered-option highlight behavior, and catalog loading/reload completion if changing their state flow.

## Done criteria

- [ ] `cd pc-quote-builder && npm run check` exits 0.
- [ ] Workflow calls `npm run check` before dataset download.
- [ ] No ESLint disable comments or rule changes were added.

## STOP conditions

Stop if satisfying the rule requires a React-version change, changes the catalog fallback contract, or requires touching files outside scope.

## Maintenance notes

Keep `check` as the required pre-deploy gate. Future React Hooks lint changes must be resolved by preserving behavior, not suppressing the rule.
