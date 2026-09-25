# Plan 046: Lint the pipeline, make the app lint gate strict, and prune stale deployed assets

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6cde4b8..HEAD -- eslint.config.js pc-quote-builder/eslint.config.js pc-quote-builder/package.json .github/workflows/pc-data-cron.yml scripts/ pc-quote-builder/src/components/QuoteAnalyzer/QuoteAnalyzer.jsx`
> If any in-scope file changed since this plan was written (plan 037 edits the
> workflow; plans 042/043 edit `QuoteAnalyzer.jsx`), compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S-M
- **Risk**: LOW
- **Depends on**: plans/037 (shared workflow and lint surfaces); recommended after plans/042/043
- **Category**: dx
- **Planned at**: commit `6cde4b8`, 2026-09-25

## Why this matters

`pc-quote-builder/eslint.config.js` is the only ESLint config, and
`npm run lint` runs `eslint .` from `pc-quote-builder/`. The entire Node
pipeline under `scripts/` (2,809 non-test source lines, including the Plan 035
assurance harness and the catalog compiler) is never linted. The app config
also carries a stale `globalIgnores(['dist'])` (the build output is `../docs`),
a contradictory `ecmaVersion: 2020` alongside `parserOptions.ecmaVersion:
"latest"`, and `npm run lint` tolerates warnings (2 currently).

Separately, `docs/assets/` accumulates hashed bundles that the current
`docs/index.html` no longer references (~510 KB of dead weight tracked in git
and uploaded on every deploy), because `vite.config.js` must use
`emptyOutDir: false` to preserve `docs/PRODUCT_VISION.md` and other docs.

The advisor measured the pipeline lint gap by copying `scripts/` into a temp
directory and running ESLint 10.8 with a Node-globals config: **16 errors, all
`no-unused-vars`**, listed in Step 2.

## Current state

`pc-quote-builder/eslint.config.js`:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    ...
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: { ecmaVersion: 'latest', ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
    rules: { 'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }] },
  },
])
```

`pc-quote-builder/package.json:10-24`: `"lint": "eslint ."`,
`"check": "npm run lint && npm test && npm run build:check"`. There is no
`lint:scripts`.

`pc-quote-builder/src/components/QuoteAnalyzer/QuoteAnalyzer.jsx:67` is the
source of both remaining warnings:

```js
  const rows = Array.isArray(quote?.rows) ? quote.rows : [];
```
(`react-hooks/exhaustive-deps`: "The 'rows' conditional could make the
dependencies of useMemo Hook (at line 71) change on every render".)

`pc-quote-builder/vite.config.js:8-11` — `outDir: "../docs"`,
`emptyOutDir: false`. `docs/index.html` references only
`assets/index-LYlTfKix.js` and `assets/index-CoHUX_Uo.css` on this commit, while
`docs/assets/` also contains unreferenced bundles. `docs/` also holds
`PRODUCT_VISION.md`, `design/`, `validation/`, which must never be pruned — the
prune step must touch `docs/assets/` only.

Repository constraint: there is no root `package.json` or root
`node_modules` (deliberate; see `plans/README.md:207-209`). The scripts lint
config therefore resolves its imports through
`./pc-quote-builder/node_modules/...` relative to the repository root.

## Commands you will need

| Purpose | Command | Provenance | Expected on success |
|---|---|---|---|
| Install | `npm ci` (in `pc-quote-builder/`) | declared | exit 0 |
| App lint | `npm run lint` | executed | exit 0, zero warnings after Step 4 |
| Scripts lint | `npm run lint:scripts` (added in Step 1) | declared | exit 0 after Step 2 |
| Full tests | `npm test` | executed | all pass |
| Full gate | `npm run check` | declared | exit 0 |
| Prune assets | `npm run prune:assets` (added in Step 5) | declared | removes only unreferenced `docs/assets/*` |

**Provenance**: `executed` = the advisor ran it during recon; `declared` = read
from `package.json`/CI, not run.

## Scope

**In scope**:
- `eslint.config.js` (create at repository root)
- `pc-quote-builder/eslint.config.js`
- `pc-quote-builder/package.json`
- `.github/workflows/pc-data-cron.yml` (add the scripts-lint and prune steps)
- `scripts/**/*.js` (remove only the 16 unused bindings listed in Step 2)
- `scripts/lib/pruneStaleAssets.js` (create) and
  `scripts/lib/pruneStaleAssets.test.js` (create)
- `scripts/prune_stale_assets.js` (create)
- `docs/assets/` (delete unreferenced files only)
- `pc-quote-builder/src/components/QuoteAnalyzer/QuoteAnalyzer.jsx` (rows memo only)

**Out of scope**:
- Creating a root `package.json`/lockfile or installing root dependencies.
- Adding Prettier or any formatter (previously rejected).
- Changing pipeline logic: the 16 fixes are dead-binding deletions only. If a
  binding looks like a missing validation, report it — do not wire it.
- Any file under `docs/` other than unreferenced `docs/assets/*`.
- Refactoring `scripts/lib/quote_analyzer_assurance.js` beyond dead-binding
  removal.

## Git workflow

- Branch: `advisor/046-lint-scripts-and-asset-hygiene`
- Commits: `046: <imperative summary>` (e.g. `046: lint pipeline and prune stale assets`).
- Do NOT push or open a PR.

## Steps

### Step 0: Establish a green baseline

From `pc-quote-builder/`: `npm ci`, `npm run lint` (exit 0, exactly 2
warnings), `npm test` (exit 0). Record the `docs/assets` listing and
`docs/index.html` references:

```sh
ls docs/assets
rg -o 'assets/[A-Za-z0-9_.-]+' docs/index.html | sort -u
```

### Step 1: Add a root scripts lint config and script

1. Create `/eslint.config.js` at the repository root:

   ```js
   // Lints the Node pipeline under scripts/. Imports resolve through
   // pc-quote-builder's node_modules because this repository has no root
   // manifest by design.
   import js from "./pc-quote-builder/node_modules/@eslint/js/src/index.js";
   import globals from "./pc-quote-builder/node_modules/globals/index.js";

   export default [
     { ignores: ["**/node_modules/**", "scripts/fixtures/**"] },
     {
       files: ["scripts/**/*.js"],
       languageOptions: {
         ecmaVersion: "latest",
         sourceType: "module",
         globals: globals.node,
       },
       rules: {
         ...js.configs.recommended.rules,
         "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
       },
     },
   ];
   ```

2. In `pc-quote-builder/package.json`, add:
   ```json
   "lint:scripts": "eslint --config ../eslint.config.js ../scripts"
   ```
3. Run `npm run lint:scripts` from `pc-quote-builder/`. Expected 16 errors
   (Step 2). If ESLint reports that the files are outside the base path or
   cannot resolve the config, STOP and report the exact error — do not add a
   root `package.json` or install root dependencies.

### Step 2: Remove the 16 unused bindings

Expected findings (from the advisor's run on this commit):

| File | Line | Binding |
|---|---|---|
| `scripts/lib/assessmentCoverage.js` | 476 | `arrayKey` |
| `scripts/lib/assessmentCoverage.test.js` | 15 | `RULES_VERSION_STRING` |
| `scripts/lib/assessmentCoverage.test.js` | 43 | `catalogWith` |
| `scripts/lib/build_pc_data.test.js` | 6 | `SOURCE_TAGS` |
| `scripts/lib/compiler.test.js` | 21 | `SOURCE_TAGS` |
| `scripts/lib/quote_analyzer_assurance.js` | 177 | `isIsoDate` |
| `scripts/lib/quote_analyzer_assurance.js` | 464 | `caseIds` |
| `scripts/lib/quote_analyzer_assurance.js` | 678 | `dimension` |
| `scripts/lib/quote_analyzer_assurance.test.js` | 22 | `EXPECTED_STATUSES` |
| `scripts/lib/quote_analyzer_assurance.test.js` | 23 | `RECRUITMENT_SOURCES` |
| `scripts/lib/quote_analyzer_assurance.test.js` | 26 | `CONFORMANCE_SCHEMA_VERSION` |
| `scripts/lib/quote_analyzer_assurance.test.js` | 27 | `CONTROL_SCHEMA_VERSION` |
| `scripts/lib/quote_analyzer_assurance.test.js` | 45 | `buildAssuranceReport` |
| `scripts/lib/quote_analyzer_assurance.test.js` | 317 | `sampling` |
| `scripts/lib/quote_analyzer_assurance.test.js` | 443 | `input` (argument) |
| `scripts/lib/quote_analyzer_assurance.test.js` | 568 | `suiteCases` |

Delete each unused binding (including its import specifier or destructured
property). Do not delete surrounding logic, and do not add `void binding;`
suppressions. For `isIsoDate` (assurance harness), inspect the surrounding code
before deleting: if it appears to be an intended date-format validation that
was never wired, delete it and record that observation in your final report for
the maintainer — do not wire new behavior.

If the ESLint run reports errors beyond these 16 (e.g. a different rule
firing), STOP and report the list; do not refactor pipeline code to satisfy a
new rule. If it reports fewer, fine — delete only what was reported.

**Verify**: `npm run lint:scripts` → exit 0. `npm test` → exit 0 (the removed
test helpers were unused; if a test fails, STOP — you removed something live).

### Step 3: Wire the pipeline lint into the required gates

1. `pc-quote-builder/package.json`: change `check` to
   `"npm run lint && npm run lint:scripts && npm test && npm run build:check"`.
2. `.github/workflows/pc-data-cron.yml`: in the `Lint and test` step, change the
   command to `npm run lint && npm run lint:scripts && npm test` (append
   `&& npm run test:assurance` only if plan 037 already added it).
3. Fix the app config (`pc-quote-builder/eslint.config.js`):
   - replace `globalIgnores(['dist'])` with `globalIgnores(['dist', 'node_modules'])` (the real build output is `../docs`, which is outside this config's cwd; keeping `dist` harmless is optional, but the comment/ignore should not imply it is the output);
   - remove the contradictory `ecmaVersion: 2020` line, keeping
     `parserOptions.ecmaVersion: "latest"`.

**Verify**: `npm run check` → exit 0.

### Step 4: Make app lint warnings fatal

1. `QuoteAnalyzer.jsx:67`: wrap the derived rows in a memo:
   ```js
   const rows = useMemo(() => (Array.isArray(quote?.rows) ? quote.rows : []), [quote]);
   ```
   Ensure `useMemo` is imported (it already is).
2. `package.json`: change `"lint": "eslint ."` to
   `"lint": "eslint . --max-warnings 0"`.

**Verify**: `npm run lint` → exit 0 with no warnings.

### Step 5: Prune unreferenced deployed assets

1. Create `scripts/lib/pruneStaleAssets.js` with a pure helper:
   ```js
   /**
    * @param {string} indexHtml contents of docs/index.html
    * @param {string[]} assetNames file names under docs/assets
    * @returns {string[]} asset file names not referenced by indexHtml
    */
   export function selectStaleAssets(indexHtml, assetNames) { ... }
   ```
   Matching rule: an asset name is referenced when `indexHtml` contains
   `assets/<name>` (exact name, not a prefix). Return names absent from the
   HTML. Keep it deterministic and case-sensitive.
2. Create `scripts/prune_stale_assets.js`: resolve the repository root from
   `import.meta.url`, read `docs/index.html`, list `docs/assets/` (files only),
   compute stale names, `fs.rmSync` each, print how many were removed and
   which. If `docs/index.html` is missing, exit 0 with a message (the site may
   not be built yet). Never touch anything outside `docs/assets/`.
3. Add `"prune:assets": "node ../scripts/prune_stale_assets.js"` to
   `pc-quote-builder/package.json`.
4. Add a test `scripts/lib/pruneStaleAssets.test.js`: referenced assets kept;
   unreferenced removed; prefix collisions (e.g. `index-a.js` vs
   `index-a.js.map`) handled by exact-name matching; empty html → all stale.
5. In `.github/workflows/pc-data-cron.yml`, add a step after `Build production
   site` and before the post-build assertion:
   ```yaml
   - name: Prune stale hashed assets
     working-directory: pc-quote-builder
     run: npm run prune:assets
   ```
6. Run `npm run prune:assets` once in the checkout and commit the deletions
   under `docs/assets/`.

**Verify**: `npm run prune:assets` twice in a row → second run removes 0;
`ls docs/assets` matches the `rg -o 'assets/...' docs/index.html` set;
`npx vitest run ../scripts/lib/pruneStaleAssets.test.js` passes (from
`pc-quote-builder/`).

## Test plan

- New `pruneStaleAssets.test.js` cases as above (pure function; no filesystem).
- Existing pipeline tests must keep passing after dead-binding removal.
- Full suite: `npm test`; full gate: `npm run check` (now includes
  `lint:scripts` and `--max-warnings 0`).

**Verification**: `npm run check` → exit 0; `npm run lint:scripts` → exit 0;
`git status` shows only intended asset deletions and edits.

## Done criteria

ALL must hold:

- [ ] `npm run lint` exits 0 with no warnings
- [ ] `npm run lint:scripts` exits 0
- [ ] `npm test` exits 0
- [ ] `npm run check` exits 0
- [ ] `ls docs/assets` contains only files referenced by `docs/index.html`
      (compare with the Step 0 command)
- [ ] `.github/workflows/pc-data-cron.yml` invokes `lint:scripts` and
      `prune:assets`
- [ ] `git diff --name-only 6cde4b8...HEAD` lists only in-scope files
- [ ] Final report lists the 16 removed bindings and any observation about
      `isIsoDate`
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The root config cannot be resolved by ESLint (report the error; do not add a
  root manifest).
- The scripts lint reports rule violations beyond unused bindings — those may
  be real defects; report them rather than suppressing.
- A deletion from `scripts/**` breaks a test.
- `docs/index.html` is missing or references assets that do not exist (report
  the mismatch; do not delete anything).
- Pruning would require touching non-asset files under `docs/`.

## Maintenance notes

- The root ESLint config is ESM and uses relative imports into
  `pc-quote-builder/node_modules`. If the toolchain is ever hoisted or a root
  manifest is reintroduced, simplify those imports; if `@eslint/js`'s internal
  path changes on a future major, update the specifier.
- `npm run check` now fails on any app warning; add targeted
  `eslint-disable-next-line` only with a comment explaining why the warning is
  intentional.
- The prune script is the only code allowed to delete under `docs/`; it is
  scoped to `docs/assets/`. Do not generalize it.
- **Deferred**: linting Python (`download_pc_datasets.py` has only a
  help-text test) and adding a formatter remain out of scope.
