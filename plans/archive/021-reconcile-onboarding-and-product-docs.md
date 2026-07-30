# Plan 021: Reconcile contributor, maintenance, product-state, and plan documentation

> **Executor instructions**: Documentation must describe the implemented result of prerequisite plans. Do not add `AGENTS.md` to git; it is intentionally ignored.
>
> **Drift check (run first)**: `git diff --stat fabeb49..HEAD -- README.md CLAUDE.md .gitignore scripts/download_pc_datasets.py scripts/requirements.txt .github/workflows/pc-data-cron.yml plans/README.md plans/archive`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: `009-align-runtime-toolchain.md`, `010-rebuild-and-isolate-pages-deployment.md`, `011-isolate-downloader-tests.md`
- **Category**: docs / dx
- **Planned at**: commit `fabeb49`, 2026-07-29
- **Status**: ✅ Done

> **Completed**: 2026-07-30 by opencode. Created `CONTRIBUTING.md` with commands, catalog pipeline, generated-artifact boundaries, and architecture overview. Updated `CLAUDE.md` and `README.md` to reference `CONTRIBUTING.md` instead of gitignored `AGENTS.md`. Added "Estado actual" section to `README.md` separating shipped capabilities from roadmap. Added completion metadata to archived plans 007 and 008. Verified downloader `--help` exposes pin-refresh procedure; `git diff --check` and local link check pass.

## Why this matters

Tracked README/CLAUDE files link to ignored, untracked `AGENTS.md`; the README mixes shipped behavior with the canonical aspiration; the “every 14 days” cron wording is not an exact elapsed cadence; requirements point to a pin-refresh procedure that `--help` does not show; and archived plans remain in the active table. Fresh clones and future executors cannot reliably reconstruct current commands, capabilities, or maintenance state.

## Current state

- `README.md:38-42` and `CLAUDE.md:1-5` point to `AGENTS.md`; `.gitignore:1` ignores it.
- `README.md:3-30` describes vision dimensions not yet shipped.
- `requirements.txt:1-4` points to downloader help, but argparse exposes no procedure.
- `plans/README.md` lists archived 007/008 as active DONE rows.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| Links | repository-local Markdown link checker or focused script | no broken local links |
| Help | `python scripts/download_pc_datasets.py --help` | pin-refresh procedure visible |
| Diff | `git diff --check` | exit 0 |

## Scope

**In scope**: tracked contributor guide (new `CONTRIBUTING.md` if chosen), README, CLAUDE pointer/content, downloader help/docstring, requirements header, workflow comments, plans index/archive metadata.

**Out of scope**: modifying canonical product vision, changing schedule cadence without owner decision, implementing aspirational features, committing AGENTS.md.

## Git workflow

- Branch: `advisor/021-reconcile-onboarding-and-product-docs`
- Commit: `021: reconcile onboarding and maintenance docs`.

## Steps

1. Add a tracked human-facing contributor/maintenance guide containing safe commands, generated-artifact boundaries, verification, and product-vision link. Make README and CLAUDE resolve in fresh clones without exposing environment-only instructions.
2. Add a clear “Estado actual” section separating shipped quote editing/compatibility from roadmap capabilities; keep the vision link and ambition.
3. Decide with the owner whether the cron should use named calendar dates or another mechanism. Document the actual cadence; do not call a day-of-month step an exact elapsed interval.
4. Expose the pin-refresh procedure in downloader `--help` or the tracked maintenance guide and link the requirements header to it.
5. Reconcile `plans/README.md`: active table contains only TODO/IN PROGRESS/BLOCKED plans; archived 007/008 gain completion metadata if missing; retain resolved/rejected history.
6. Add/run a local-link check and `git diff --check`.

## Test plan

No app tests required unless argparse help code changes. Add a small test that `--help` includes the refresh heading and a script/test for local Markdown links.

## Done criteria

- [ ] Fresh-clone README/CLAUDE links resolve to tracked files.
- [ ] Current versus aspirational capabilities are explicit.
- [ ] Schedule wording matches actual policy.
- [ ] Pin refresh is reachable from `--help`/requirements.
- [ ] Active plan table contains no archived DONE rows.

## STOP conditions

- The owner has not chosen schedule policy.
- A tracked contributor guide would duplicate environment-sensitive instructions that must remain private; include only repository-safe conventions.
- A proposed copy edit weakens the canonical vision.

## Maintenance notes

Update “Estado actual” when capabilities ship. Archive completed plans in the same change that marks them DONE.
