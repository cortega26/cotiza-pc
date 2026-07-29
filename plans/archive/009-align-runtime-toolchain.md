# Plan 009: Align and enforce the supported runtime and lint toolchain

> **Executor instructions**: Follow this plan step by step. Run every verification command. Stop on any STOP condition; do not improvise. When complete, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat fabeb49..HEAD -- README.md pc-quote-builder/package.json pc-quote-builder/package-lock.json pc-quote-builder/eslint.config.js .github/workflows/pc-data-cron.yml`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: migration / dx
- **Planned at**: commit `fabeb49`, 2026-07-29

## Why this matters

The README accepts every Node 22 release, but the installed Vite/ESLint versions require later Node 22 minors. ESLint is major 10 while the directly consumed `@eslint/js` recommended config is major 9, and CI floats Python on `"3.x"` although the hash lock was generated with Python 3.13. A single enforced runtime contract prevents setup failures and silent CI drift.

## Current state

- `README.md:48-52` says Node `>=22` and Python `>=3.10`.
- `pc-quote-builder/package.json:23-35` has `@eslint/js ^9.39.1` with `eslint ^10.8.0`.
- `.github/workflows/pc-data-cron.yml:29-37` uses Node 22 and floating Python `"3.x"`.
- Match the existing npm-only workflow and flat ESLint configuration; do not add another package manager.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| Install | `cd pc-quote-builder && npm ci` | exit 0 |
| Versions | `node --version && python --version` | versions satisfy the declared contract |
| Gate | `cd pc-quote-builder && npm run check` | exit 0 |

## Scope

**In scope**: `README.md`, `pc-quote-builder/package.json`, `pc-quote-builder/package-lock.json`, `pc-quote-builder/eslint.config.js` only if new rules require a justified source-neutral config change, one version-manager file at repo root, `.github/workflows/pc-data-cron.yml`.

**Out of scope**: application behavior, catalog dependencies, unrelated package upgrades, formatters, pre-commit frameworks.

## Git workflow

- Suggested branch: `advisor/009-align-runtime-toolchain`
- Use one focused commit, e.g. `009: align runtime and lint toolchain`.
- Do not push unless instructed.

## Steps

1. Choose and document one Node 22 minor satisfying the strictest installed engine; add `engines`, `packageManager`, and one common version-manager file. Pin the same exact Node minor in CI.
   **Verify**: `npm pkg get engines packageManager` → both are non-empty and consistent with README/CI.
2. Upgrade `@eslint/js` to major 10 without upgrading unrelated packages. Review newly surfaced lint errors individually; do not disable the recommended rules wholesale.
   **Verify**: `npm ls eslint @eslint/js` → both resolve to major 10; `npm run lint` exits 0.
3. Pin CI Python to 3.13, matching `scripts/requirements.txt`, and document a repository-local virtual environment using `python -m pip`.
   **Verify**: `rg -n '3\\.13|venv|python -m pip' README.md .github/workflows/pc-data-cron.yml` → the contract appears in both.
4. Run the full gate.
   **Verify**: `npm run check` → lint, 154+ tests, and build pass.

## Test plan

No new application tests are required. The lockfile must change only as needed for `@eslint/js`; inspect `git diff -- pc-quote-builder/package-lock.json`.

## Done criteria

- [ ] Node, npm, and Python contracts agree across manifest, CI, version file, and README.
- [ ] `npm ls eslint @eslint/js` shows matching major 10.
- [ ] `npm run check` exits 0.
- [ ] No unrelated dependency version changed.

## STOP conditions

- A matching `@eslint/js` major is incompatible with installed ESLint.
- Python 3.13 cannot install the hash-locked requirements on CI's target architecture.
- The change requires upgrading React, Vite, Vitest, or catalog packages.

## Completion

- **Completed**: 2026-07-29
- **Commit**: (pending commit — staged changes not yet committed)
- **Summary**: Pinned Node to 22.13 via `.node-version`, `engines`, and CI; pinned Python to 3.13 in CI; upgraded `@eslint/js` from 9.x to 10.0.1 to match ESLint 10; documented updated prerequisites in README. All gates pass (lint 0, 154 tests, build).

## Maintenance notes

Keep the runtime version file, CI setup actions, README, `engines`, and Python lock-generation version synchronized in future dependency updates.
