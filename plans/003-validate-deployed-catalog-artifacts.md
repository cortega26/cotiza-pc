# Plan 003: Validate deployed catalog artifacts before deployment

> **Executor instructions**: Run each verification gate and update the plan index after completion.
>
> **Drift check**: `git diff --stat 63ecbca..HEAD -- .github/workflows/pc-data-cron.yml pc-quote-builder/src/lib/dataLoader.js pc-quote-builder/public/data scripts/build_pc_data.js scripts/sync_processed_to_public_data.js`

## Status

- **Priority**: P1; **Effort**: S; **Risk**: LOW; **Depends on**: plans 001, 002
- **Category**: tests
- **Planned at**: commit `63ecbca`, 2026-07-29

## Why this matters

Runtime requires seven `public/data/*.min.json` resources, but CI tests before download/build/sync and only validates `src/data/catalog.json`. A green scheduled run can therefore deploy bad static data.

## Current state

`dataLoader.js:32-40` loads CPUs, GPUs, motherboards, PSUs, cases, RAM, and compatibility metadata. Workflow lines 43-56 test before `build:pc-data` and `sync:pc-data`; `catalogQuality.test.js:2` imports the fallback catalog.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| Build artifacts | `cd pc-quote-builder && npm run build:pc-data && npm run sync:pc-data` | exit 0 |
| Contract tests | `cd pc-quote-builder && npm test -- catalog` | all pass |
| Full gate | `cd pc-quote-builder && npm run check` | exit 0 |

## Scope

Modify the workflow, create artifact-contract tests under `pc-quote-builder/src/lib/` or a clearly named test folder, and adjust package scripts only if needed. Do not alter generated JSON by hand or weaken required runtime resource names.

## Steps

1. Create a deterministic contract test that reads the seven public artifacts named by `loadAllProcessed`, parses JSON, verifies required top-level arrays/objects and non-empty IDs/names, and verifies compatibility metadata is usable by `buildTierMaps`.
2. Make the test fail with a clear file-specific message for absent/malformed artifacts. Keep tiny fixtures for malformed data rather than modifying production data.
3. In CI, run the contract test after download/build/sync and before Vite build/deployment. Keep the existing unit-test gate before costly downloads.

## Done criteria

- [ ] Removing or corrupting any required artifact makes the new contract test fail.
- [ ] CI runs artifact validation after sync and before Pages upload.
- [ ] `npm run check` and the artifact test exit 0 on a normal build.

## STOP conditions

Stop if the pipeline cannot run reproducibly without untracked raw datasets; report the required fixture/CI strategy instead of adding generated files to tests.

## Maintenance notes

Any new runtime data file must be added both to `dataLoader.js` and this contract test in the same change.
