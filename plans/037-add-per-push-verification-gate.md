# Plan 037: Add a per-push verification gate, clear toolchain advisories, and wire the Plan 035 assurance CLI

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6cde4b8..HEAD -- .github/workflows/ pc-quote-builder/package.json pc-quote-builder/package-lock.json README.md CONTRIBUTING.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S-M
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `6cde4b8`, 2026-09-25

## Why this matters

The only CI workflow in this repository is the scheduled catalog pipeline
(`schedule` + `workflow_dispatch`, no `push`/`pull_request` triggers). A
regression merged to the default branch is therefore unverified for up to 14
days, and artifact-contract checks run only inside that scheduled job. Two
`high`-severity advisories currently sit in the dev/build toolchain with fixes
already inside the manifest's ranges. Finally, the Plan 035 analyzer assurance
CLI — the deterministic conformance gate the product vision now relies on —
exists but is referenced nowhere in `package.json`, `README.md`,
`CONTRIBUTING.md`, `scripts/verify.sh`, or CI, so it is invisible and
unenforced.

After this plan: every push and PR runs the full app gate plus artifact
contracts plus the assurance conformance suite; the advisories are cleared by
a lockfile refresh; CI caches dependencies; and the assurance command is
discoverable in the contributor docs and in the scheduled pipeline.

## Current state

- `.github/workflows/pc-data-cron.yml:1-8` — the only workflow:
  ```yaml
  on:
    schedule:
      - cron: "0 3 */14 * *" # cada 14 días a las 03:00 UTC
    workflow_dispatch: {}
  ```
  Its build job steps at `:26-29` have no `cache:` on `setup-node`, and `:44-46`
  run only `npm run lint && npm test`.
- `pc-quote-builder/package.json:10-24` — scripts today:
  ```json
  "lint": "eslint .",
  "check": "npm run lint && npm test && npm run build:check",
  "test": "vitest run --exclude src/lib/postBuildAssertion.test.js",
  "test:artifacts": "vitest run src/lib/artifactContract.test.js",
  "test:contract": "vitest run src/lib/artifactContract.test.js src/lib/postBuildAssertion.test.js"
  ```
  There is no assurance script.
- `scripts/quote_analyzer_assurance.js` — Plan 035 CLI. The invocation recorded
  in `plans/archive/035-automate-analyzer-assurance.md:81`:
  ```
  node ../scripts/quote_analyzer_assurance.js --conformance-dir ../scripts/fixtures/quote-analyzer-assurance --out /tmp/cotiza-pc-assurance.json
  ```
  It exits 0 only when the synthetic conformance gates pass. The fixture
  directory `scripts/fixtures/quote-analyzer-assurance/` exists and committed
  conformance cases are present (e.g. `CONF-CPU-RAM-OK-001.json`).
- Verified baseline on this commit (advisor ran both):
  - `npm run lint` → exit 0, 2 `react-hooks/exhaustive-deps` warnings
  - `npm test` → 39 files / 942 passed / 27 todo, exit 0
- `npm audit` (advisor ran, read-only) → 2 high, 2 moderate, 0 critical:
  - `brace-expansion` `GHSA-rgw5-rvv9-x895` via `eslint@10.8.0 → minimatch`
  - `nanoid` `GHSA-2v37-7h3g-55p8` via `vite@8.1.5 → postcss`
  - moderate `vitest`/`@vitest/mocker` `GHSA-82fw-gwwq-j7x9` (test-only)
  - `npm audit --omit=dev` → 0 vulnerabilities (runtime tree clean)

## Commands you will need

| Purpose | Command | Provenance | Expected on success |
|---|---|---|---|
| Install | `npm ci` (in `pc-quote-builder/`) | declared | exit 0 |
| Lint | `npm run lint` | executed | exit 0 |
| Tests | `npm test` | executed | all pass (39 files) |
| Artifact contract | `npm run test:artifacts` | declared | all pass |
| Assurance (synthetic) | `npm run test:assurance` (added in Step 3) | declared | exit 0, `"pass": true` in JSON |
| Full gate | `npm run check` | declared | exit 0 |
| Audit | `npm audit --audit-level=high` | executed | exit 0 (only moderates remain) |

**Provenance**: `executed` = the advisor ran it during recon and saw it work;
`declared` = read from a manifest/CI file but not run. This repo's lockfile is
committed; run `npm ci` before any command.

## Scope

**In scope** (the only files you should modify):
- `.github/workflows/verify.yml` (create)
- `.github/workflows/pc-data-cron.yml`
- `pc-quote-builder/package.json`
- `pc-quote-builder/package-lock.json` (lockfile refresh only)
- `README.md` (verification table row)
- `CONTRIBUTING.md` (command table row)

**Out of scope** (do NOT touch, even if related):
- Any source or test file under `pc-quote-builder/src/` or `scripts/` — the two
  lint warnings and the unlinted `scripts/` tree are plan 046's job.
- `pc-quote-builder/vite.config.js`, `postBuildAssertion.test.js`.
- Generated data under `data/processed/`, `pc-quote-builder/public/data/`,
  `docs/`.
- Any dependency manifest range change. This plan refreshes the lockfile
  within existing ranges only.

## Git workflow

- Branch: `advisor/037-add-per-push-verification-gate`
- Commit per step or logical unit; message style observed in `git log`:
  `037: <imperative summary>` (e.g. `037: add per-push verification workflow`).
- Do NOT push or open a PR.

## Steps

### Step 0: Establish a green baseline

Run `npm ci`, then `npm run lint`, `npm test`, `npm run test:artifacts` from
`pc-quote-builder/`.

- All must pass before you change anything. If `test:artifacts` fails on the
  unmodified checkout, STOP: the baseline is broken and this plan cannot
  distinguish your regressions from pre-existing ones.
- Record the exact output of each command in your final report.

### Step 1: Clear the high advisories with an in-range lockfile refresh

From `pc-quote-builder/`:

1. Run `npm update`.
2. Run `npm audit --audit-level=high`. Expected exit 0 with only the moderate
   `vitest` advisory remaining (`npm audit` will still list it).
3. Run `npm audit --omit=dev`. Expected `found 0 vulnerabilities`.
4. Confirm `git diff -- pc-quote-builder/package.json` is empty (no manifest
   range changed). If `npm update` edited `package.json`, revert that edit and
   STOP — report which package and why the range needed to widen.

**Verify**: `npm audit --audit-level=high` exits 0; `npm run check` exits 0.

### Step 2: Add dependency caching to the scheduled workflow

Edit `.github/workflows/pc-data-cron.yml`:

- In the `Setup Node` step (`actions/setup-node@…`), add:
  ```yaml
  with:
    node-version: "22.13"
    cache: npm
    cache-dependency-path: pc-quote-builder/package-lock.json
  ```
- Change the `Lint and test` step command from `npm run lint && npm test` to
  `npm run lint && npm test && npm run test:assurance` (the script is added in
  Step 3; do Step 3 first if you prefer, but keep the workflow consistently
  runnable — do not commit a workflow that references a missing script).

Do not add `pull_request` triggers or permissions to this workflow; the new
`verify.yml` handles per-push CI.

**Verify**: `rg -n "cache: npm|test:assurance" .github/workflows/pc-data-cron.yml`
returns both lines.

### Step 3: Add the assurance script and a per-push verification workflow

1. In `pc-quote-builder/package.json`, add to `scripts` (keep JSON valid, no
   trailing comma):
   ```json
   "test:assurance": "node ../scripts/quote_analyzer_assurance.js --conformance-dir ../scripts/fixtures/quote-analyzer-assurance --out /tmp/cotiza-pc-assurance.json"
   ```
2. Run it on the unmodified code: `npm run test:assurance`. Expected exit 0 and
   a JSON report with `"gates"` where `conformance.applicable === true` and
   `pass === true`. If it exits non-zero or `pass` is false, STOP and report the
   full JSON — the conformance baseline is failing and this plan must not mask
   it.
3. Create `.github/workflows/verify.yml` with this shape (YAML, 2-space indent):

   ```yaml
   name: Verify

   on:
     push:
       branches: [main]
     pull_request:

   permissions:
     contents: read

   concurrency:
     group: verify-${{ github.ref }}
     cancel-in-progress: true

   jobs:
     verify:
       runs-on: ubuntu-latest
       steps:
         - name: Checkout
           uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
         - name: Setup Node
           uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
           with:
             node-version: "22.13"
             cache: npm
             cache-dependency-path: pc-quote-builder/package-lock.json
         - name: Install npm deps
           working-directory: pc-quote-builder
           run: npm ci
         - name: Full app gate (lint + test + disposable build)
           working-directory: pc-quote-builder
           run: npm run check
         - name: Artifact contracts
           working-directory: pc-quote-builder
           run: npm run test:artifacts
         - name: Analyzer assurance conformance suite
           working-directory: pc-quote-builder
           run: npm run test:assurance
   ```

   Use the exact action SHAs pinned elsewhere in this repo (copy them from
   `.github/workflows/pc-data-cron.yml` if they differ).

**Verify**: `npm run test:assurance` → exit 0; `rg -n "npm run check|test:artifacts|test:assurance" .github/workflows/verify.yml` lists all three.

### Step 4: Document the gates

- `CONTRIBUTING.md`, in the "Development commands" table, add a row:
  `| npm run test:assurance | Plan 035 analyzer conformance suite (synthetic fixtures; no private corpus) |`
- `README.md`, in the "Validación (contratos)" area of the pipeline table (or
  the command table if that reads better), add the same command with a short
  Spanish description: `Verifica la conformidad del motor de análisis con la
  suite sintética del Plan 035`.

**Verify**: `rg -n "test:assurance" README.md CONTRIBUTING.md` returns one line per file.

## Test plan

No new unit tests. This plan's verification is the command set itself:

- `npm run check` → lint + tests + disposable build pass.
- `npm run test:artifacts` → artifact contracts pass.
- `npm run test:assurance` → conformance gates pass.
- `npm audit --audit-level=high` → exit 0.

## Done criteria

ALL must hold:

- [ ] `npm run check` exits 0 (from `pc-quote-builder/`)
- [ ] `npm run test:artifacts` exits 0
- [ ] `npm run test:assurance` exits 0 and its JSON report has `"pass": true`
      under `gates.conformance`
- [ ] `npm audit --audit-level=high` exits 0; `npm audit --omit=dev` reports 0
- [ ] `test -f .github/workflows/verify.yml` and it triggers on `push` and
      `pull_request`
- [ ] `rg -n "cache: npm" .github/workflows/` returns both workflows
- [ ] `git diff --name-only 6cde4b8...HEAD` lists only: `.github/workflows/verify.yml`,
      `.github/workflows/pc-data-cron.yml`, `pc-quote-builder/package.json`,
      `pc-quote-builder/package-lock.json`, `README.md`, `CONTRIBUTING.md`
      (three-dot compare, so it still holds if `main` moved)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any baseline command in Step 0 fails on the unmodified checkout.
- `npm run test:assurance` fails or reports `pass: false` on unmodified code.
- `npm update` changes `package.json` or pulls React/Vite outside their
  current caret ranges.
- `npm run check` fails after the lockfile refresh and the failure is not a
  trivially fixable test-environment issue — report the exact failing spec.
- You cannot pin the workflow actions to the same SHAs used in
  `pc-data-cron.yml`.

## Maintenance notes

- `verify.yml` duplicates the lint/test steps already in `pc-data-cron.yml`.
  If a new required gate is added to `package.json`'s `check`, it
  automatically runs on pushes but NOT in the scheduled workflow unless that
  workflow's command list is updated too.
- The assurance CLI's default mode exits non-zero on any failed or unevaluable
  applicable gate. With no private corpus, corpus gates report
  `applicable: false` and do not fail the run (Plan 032 waiver). Do not add a
  coverage-corpus path to CI.
- Lockfile-only refresh: if a future advisory requires widening a range,
  that is a manifest decision, not a lockfile refresh — surface it instead.
- **Deferred**: adding `--max-warnings 0` and linting `scripts/` are plan 046;
  do not fold them in here.
