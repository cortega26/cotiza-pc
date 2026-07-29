# Plan 010: Deploy the refreshed catalog through a non-mutating, least-privileged build pipeline

> **Executor instructions**: Follow every step and gate. This workflow publishes production; stop rather than guessing about Pages permissions or artifact paths. Update `plans/README.md` only after a successful workflow run.
>
> **Drift check (run first)**: `git diff --stat fabeb49..HEAD -- pc-quote-builder/package.json pc-quote-builder/vite.config.js pc-quote-builder/src/lib/artifactContract.test.js scripts/sync_processed_to_public_data.js .github/workflows/pc-data-cron.yml README.md AGENTS.md`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `009-align-runtime-toolchain.md`
- **Category**: bug / security / dx
- **Planned at**: commit `fabeb49`, 2026-07-29

## Why this matters

The scheduled workflow currently builds `docs/` before refreshing `public/data`, validates the refreshed source directory, then uploads the pre-refresh site. The required local check also rewrites tracked deployment output, and Pages/OIDC credentials are granted while dependencies and dataset code execute. The resulting pipeline must prove that the validated refreshed files are the exact files uploaded, while keeping ordinary verification non-mutating and build work unprivileged.

## Current state

```yaml
# .github/workflows/pc-data-cron.yml:48-65
- run: npm run check
- run: npm run build:pc-data
- run: npm run sync:pc-data
- run: npm run test:artifacts
```

`npm run check` invokes Vite before the sync. `vite.config.js:8-12` writes to tracked `../docs`; `artifactContract.test.js:7` validates `public/data`; upload uses `docs/`.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| Unit gate | `cd pc-quote-builder && npm run lint && npm test` | exit 0 |
| Disposable build check | command introduced by this plan | exit 0; no tracked diff |
| Artifact contract | `cd pc-quote-builder && npm run test:artifacts` | all pass |
| Workflow syntax | `git diff --check` | exit 0 |

## Scope

**In scope**: `.github/workflows/pc-data-cron.yml`, `pc-quote-builder/package.json`, `pc-quote-builder/vite.config.js`, artifact-contract tests/scripts, `scripts/sync_processed_to_public_data.js` only if needed, README and repository command documentation.

**Out of scope**: catalog normalization, dependency versions, application features, generated JSON hand edits, changing the Pages base path.

## Git workflow

- Suggested branch: `advisor/010-rebuild-and-isolate-pages-deployment`
- Logical commits are allowed for command split and workflow split.
- Do not deploy from a local machine or push without instruction.

## Steps

1. Split build commands into a disposable verification build (ignored output) and an explicit production Pages build to `../docs`. Keep `npm run check` non-mutating while retaining lint, tests, and a real production compile.
   **Verify**: record `git status --short`, run `npm run check`, then compare status → no new tracked changes.
2. Reorder the scheduled build job: install → lint/tests → download → build data → sync → validate `public/data` → production Vite build → validate `docs/data`/manifest → upload.
   **Verify**: a workflow-order test or script asserts the production build occurs after sync and before upload.
3. Split unprivileged build from privileged deployment. The build job gets only `contents: read`; a dependent deploy job receives the built Pages artifact and alone gets `pages: write` and `id-token: write`.
   **Verify**: `rg -n 'pages: write|id-token: write' .github/workflows/pc-data-cron.yml` → permissions occur only on the deploy job.
4. Pin every `actions/*` reference to a reviewed full commit SHA and retain the release tag in a comment.
   **Verify**: a script/regex confirms every `uses:` value ends in a 40-hex SHA before an optional comment.
5. Add a post-build deployed-artifact assertion comparing required `docs/data` resources with their validated `public/data` sources.
   **Verify**: deliberately compare one altered temp fixture and confirm the checker fails; normal checked-in artifacts pass.
6. Update README/agent command descriptions and run the complete local gates. Trigger a manual workflow only when authorized.

## Test plan

- Extend `artifactContract.test.js` or add a workflow-focused Node test without modifying production artifacts.
- Assert required files exist in both source and deployed locations and match byte-for-byte after a production build.
- Assert workflow order and immutable action pins with literal configuration tests.

## Done criteria

- [ ] `npm run check` leaves the tracked worktree unchanged.
- [ ] Production build runs after refreshed data sync.
- [ ] The uploaded artifact is the validated post-refresh output.
- [ ] Build work has no Pages/OIDC write permission.
- [ ] All actions are immutable-SHA pinned.
- [ ] Lint, tests, disposable build, artifact contract, and production build pass.

## STOP conditions

- Pages deployment cannot consume an artifact produced by another job.
- `emptyOutDir: false` is needed to preserve `docs/PRODUCT_VISION.md` but the disposable-build design would delete it.
- A post-build comparison exposes intentional transformations that make byte equality invalid; report the exact transformation.

## Maintenance notes

Any new runtime data resource must be added to both pre-build and post-build contracts. Keep action pins up to date through reviewed dependency PRs.

## Completion

- **Completed**: 2026-07-29
- **Commit**: (pending commit)
- **Summary**: Split `check` into non-mutating disposable build (`build:check`) and production build (`build`); split CI into unprivileged `build` and privileged `deploy` jobs; pinned all `actions/*` to immutable commit SHAs; added post-build `postBuildAssertion.test.js` comparing `docs/data/` with `public/data/` byte-for-byte; updated README and AGENTS.md.
