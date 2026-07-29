# Plan 011: Isolate downloader tests from repository catalog data

> **Executor instructions**: Make the test suite genuinely non-mutating. Never delete or overwrite the operator's `data/raw` directory. Update the plan index when complete.
>
> **Drift check (run first)**: `git diff --stat fabeb49..HEAD -- scripts/download_pc_datasets.py pc-quote-builder/src/lib/downloadPins.test.js`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: `009-align-runtime-toolchain.md`
- **Category**: tests / dx
- **Planned at**: commit `fabeb49`, 2026-07-29

## Why this matters

`npm test` invokes the downloader's normal path with skip flags, which still writes `data/raw/provenance.json`. Tests can overwrite meaningful local provenance and cannot safely serve as a read-only verification baseline.

## Current state

`downloadPins.test.js:27-35` runs `python ../scripts/download_pc_datasets.py --skip-*`. The script creates production directories at `download_pc_datasets.py:183` and writes provenance at lines 212-223.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| Target tests | `cd pc-quote-builder && npm test -- downloadPins` | all pass |
| Full tests | `cd pc-quote-builder && npm test` | all pass |

## Scope

**In scope**: `scripts/download_pc_datasets.py`, `pc-quote-builder/src/lib/downloadPins.test.js`.

**Out of scope**: source pins, requirements versions, production artifact schemas, live network tests, existing `data/raw` contents.

## Git workflow

- Branch: `advisor/011-isolate-downloader-tests`
- Commit: `011: isolate downloader tests`.
- Do not push unless instructed.

## Steps

1. Add an explicit configurable raw/output root or genuine `--dry-run` seam. Production defaults must remain the repository's `data/raw`.
   **Verify**: `python scripts/download_pc_datasets.py --help` documents the safe seam.
2. Run subprocess tests against a test-created temporary directory and pass absolute script paths without shell interpolation.
   **Verify**: target tests pass and the temporary directory is removed by the test framework.
3. Replace silent early-return passes when Python is unavailable with explicit Vitest skips.
   **Verify**: test output labels skipped tests rather than passing without assertions.
4. Prove non-mutation: hash or timestamp any existing `data/raw/provenance.json`, run the target and full tests, and compare.

## Test plan

Cover print-only behavior, skip/dry-run behavior, missing DBGPU error, and isolated provenance generation. Model subprocess assertions on the current test, but use `execFile`/argument arrays rather than a shell command string.

## Done criteria

- [ ] `npm test -- downloadPins` does not create or modify repository `data/raw`.
- [ ] Full `npm test` passes.
- [ ] Production downloader defaults are unchanged.
- [ ] No live network is used by tests.

## STOP conditions

- Isolation would require changing production source locations or pin semantics.
- The test runner cannot supply a temporary directory safely.

## Maintenance notes

Every future downloader subprocess test must use the isolated root. Treat repository raw data as operator-owned.

## Completion

- **Completed**: 2026-07-29
- **Commit**: (pending commit)
- **Summary**: Added `--raw-dir` argument to `download_pc_datasets.py` allowing test isolation; rewrote `downloadPins.test.js` to use `execFile` with argument arrays, Vitest `skip` for missing Python, and `mkdtempSync` temp directories; confirmed no mutation of `data/raw/` during tests.
