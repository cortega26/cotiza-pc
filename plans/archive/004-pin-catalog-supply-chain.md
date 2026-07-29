# Plan 004: Pin and verify scheduled catalog supply-chain inputs

> **Executor instructions**: Execute exactly as written; do not publish or rotate unrelated credentials. Update the plan index when complete.
>
> **Drift check**: `git diff --stat 63ecbca..HEAD -- scripts/download_pc_datasets.py .github/workflows/pc-data-cron.yml requirements*`

## Status

- **Priority**: P1; **Effort**: M; **Risk**: MED; **Depends on**: `003-validate-deployed-catalog-artifacts.md`
- **Category**: security
- **Planned at**: commit `63ecbca`, 2026-07-29
- **Completed at**: commit `c4004d4`, 2026-07-29

### Completion summary

- Added `PINNED_BUILDCORES_SHA` and `PINNED_PCPART_SHA` constants in `download_pc_datasets.py` with real commit SHAs (`b4a2a3bd`, `c52a04ca`)
- `clone_pinned()` fetches exact SHA, checks out, and verifies HEAD matches
- Replaced on-demand `pip install dbgpu` with a hard failure and actionable error message
- Added hash-locked `scripts/requirements.txt` (generated with `pip-compile --generate-hashes`)
- CI workflow creates a venv and installs with `--require-hashes`
- Added `--print-pins` flag for provenance output
- Added test file `src/lib/downloadPins.test.js` (3 cases: print-pins format, skip flags, missing dbgpu)

## Why this matters

The scheduled workflow has Pages write and OIDC permissions, then executes code from two moving Git default branches and installs/imports an unpinned PyPI package. Pinning turns updates into reviewed, reproducible changes and prevents silent upstream drift from publishing artifacts.

## Current state

`download_pc_datasets.py:58,63-67` clones/pulls mutable branches; lines 100-106 install `dbgpu` on demand; lines 143-145 call both repository updates and DBGPU export. The workflow grants permissions at lines 8-11 and runs the script at line 48.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| Python environment | `python -m venv .venv && .venv/bin/pip install --require-hashes -r requirements.txt` | exit 0 |
| Downloader help | `.venv/bin/python scripts/download_pc_datasets.py --help` | exit 0; no download |
| Artifact contract | run plan 003 contract command | all pass after controlled run |

## Scope

Modify only the downloader, a new hash-locked Python requirements file, workflow, and tests/docs strictly needed to explain the deliberate update process. Do not run `--force`, delete `data/raw`, embed secrets, or broaden workflow permissions.

## Steps

1. Record immutable reviewed commit SHAs for BuildCores and PC Part Dataset in named constants/config. Clone/fetch the exact SHA, verify `rev-parse HEAD` equals it, and make the script fail in CI on mismatch. Replace pull-on-every-run with checkout of the pinned commit.
2. Add a Python requirements file pinning `dbgpu` and every resolved dependency with hashes. Change the workflow to create/use a venv and install it before running the downloader. Remove the downloader's on-demand `pip install --user` path; fail with an actionable message if `dbgpu` is unavailable.
3. Add a documented/manual pin-refresh procedure: update SHA/version+hashes in one reviewed change, run pipeline and artifact contract test, inspect provenance, then merge. Ensure provenance still records source SHA/version.
4. Reduce workflow permissions to the minimum compatible with Pages deployment; keep no write token available before deployment if GitHub Actions permission scoping supports it.

## Test plan

Add Python tests or a subprocess-level dry-run seam verifying a mismatched checkout fails before processing and that configured pins are used. Follow existing CLI style in `download_pc_datasets.py`; do not use live network in unit tests.

## Done criteria

- [ ] No mutable branch pull or unpinned pip install remains in production path.
- [ ] Requirements installation uses hashes and a venv in CI.
- [ ] A SHA mismatch fails before data is generated.
- [ ] Plan 003 artifact contract passes with pinned inputs.

## STOP conditions

Stop if an upstream source cannot be checked out by SHA, `dbgpu` cannot be hash-locked for the selected Python version, or Pages deployment needs permissions broader than documented. Report exact platform constraint.

## Maintenance notes

Pins intentionally trade automatic freshness for reviewability. Refresh them through a PR and keep artifact validation mandatory.
