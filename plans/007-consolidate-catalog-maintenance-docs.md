# Plan 007: Consolidate catalog maintenance and onboarding

> **Executor instructions**: Make one canonical workflow, but do not remove an artifact until its consumers are proven absent. Update the plan index on completion.
>
> **Drift check**: `git diff --stat 63ecbca..HEAD -- README.md pc-quote-builder/README.md pc-quote-builder/package.json scripts/fetch-catalog.js scripts/build_pc_data.js scripts/sync_processed_to_public_data.js package-lock.json`

## Status

- **Priority**: P2; **Effort**: M; **Risk**: MED; **Depends on**: `003-validate-deployed-catalog-artifacts.md`
- **Category**: tech-debt/docs
- **Planned at**: commit `63ecbca`, 2026-07-29

## Why this matters

The repository presents two catalog commands with different outputs. `fetch:catalog` writes `catalog/catalog.json`, while the application deploys processed artifacts from `public/data`; running the former does not refresh the site. The root README also tells users to run npm commands where no manifest exists and links to missing paths; the root lockfile has no corresponding package manifest.

## Current state

`pc-quote-builder/package.json:11` exposes `fetch:catalog`; `scripts/fetch-catalog.js:21-23` writes `catalog/` files. `useCatalog.js:26` loads processed public data. Root `README.md:10-12` runs npm from root, while scripts are in `pc-quote-builder/package.json`; both READMEs link to nonexistent `docs/user-personas.md`, and root README references `PSU_HEURISTICS.md` outside its actual app directory. Root `package-lock.json` is an empty independent lockfile.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| Find consumers | `rg -n "fetch:catalog|catalog/catalog.json|catalog.meta.json" . -g '!node_modules/**'` | no unaccounted consumers before removal |
| Gate | `cd pc-quote-builder && npm run check` | exit 0 |
| Status | `git status --short` | only scoped intended files |

## Scope

Modify only the named docs/scripts/package metadata and root lockfile. Do not delete catalog data or change the deploy pipeline format. Do not add a root npm workspace unless a real shared package is introduced (it is not part of this plan).

## Steps

1. Use the consumer search to decide one canonical catalog pipeline: the existing download → `build:pc-data` → `sync:pc-data` route. If no external tracked consumer needs `fetch:catalog`, remove that script and retire `scripts/fetch-catalog.js`; otherwise mark it deprecated with an explicit non-deployment warning and a migration path. STOP if a consumer outside the repository is required but cannot be confirmed.
2. Make the root README canonical. Include prerequisites, `cd pc-quote-builder`, `npm ci`, `npm run check`, development/build commands, catalog pipeline commands, output (`docs/`), and scheduled workflow. Correct links or remove unsupported references. Avoid duplicated full READMEs; make the nested README point to root or contain only app-specific details.
3. Remove the orphaned root `package-lock.json` after confirming no root `package.json` and no CI command uses it. Do not generate a replacement lockfile.

## Done criteria

- [ ] Each documented command succeeds from its documented directory.
- [ ] There is exactly one documented deployment catalog pipeline.
- [ ] No README links to nonexistent files.
- [ ] Root no longer has a lockfile without a package manifest.
- [ ] `npm run check` exits 0.

## STOP conditions

Stop if `fetch:catalog` has a documented external consumer, `catalog/` is a published interface, or the missing personas document is required content not recoverable from repository history.

## Maintenance notes

When adding scripts, document their working directory and whether they affect deployed artifacts. Keep generated output instructions separate from source-of-truth data instructions.
