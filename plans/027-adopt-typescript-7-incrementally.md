# Plan 027: Adopt TypeScript 7 incrementally without a big-bang rewrite

> **Executor instructions**: Follow this plan in order and keep the application
> behaviorally unchanged. Run every verification command after each conversion
> wave. Do not suppress compiler or linter failures to make the migration pass.
> If a STOP condition occurs, stop and report it instead of weakening the type
> contract. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 7eebe14..HEAD -- pc-quote-builder/package.json pc-quote-builder/package-lock.json pc-quote-builder/eslint.config.js pc-quote-builder/src README.md`
> Drift from prerequisite plans is expected. Confirm that Plans 017, 018, and
> 022 are marked DONE, then map their final catalog, quote, assessment, and App
> boundaries against the "Current state" section below. STOP if those
> prerequisites are incomplete, their intended seams do not exist, or unrelated
> behavior changes make the migration scope ambiguous.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: `017-correct-case-form-factors.md`, `018-guarantee-catalog-id-uniqueness.md`, `022-decompose-app-after-characterization.md`
- **Category**: migration / dx
- **Planned at**: commit `7eebe14`, 2026-07-29
- **Status**: BLOCKED — STOP condition hit at Step 1 preflight, 2026-07-30

## STOP log

- Step 1 ecosystem preflight failed: `typescript-eslint@8.65.0` (latest stable) declares
  peer range `typescript: >=4.8.4 <6.1.0`; the official dependency-versions page
  (<https://typescript-eslint.io/users/dependency-versions>) lists the same range, so
  TypeScript `7.0.2` is not officially supported. ESLint 10 (`^10.0.0`) is supported.
- Per the plan and `plans/README.md`, no canary release, unsupported-version warning
  suppression, or temporary lint exclusion was used. No toolchain or source changes were
  made; baseline `npm run check` remains green.
- TypeScript 7.0 does not expose the compiler API consumed by tools such as
  typescript-eslint. Microsoft's TypeScript 7.0 announcement anticipates a new API in
  TypeScript 7.1 and documents a side-by-side arrangement using TypeScript 7 for `tsc`
  plus `@typescript/typescript6` for API consumers. That arrangement does not satisfy
  this plan's single supported toolchain requirement and must not be adopted without an
  explicit owner-approved plan amendment.
- Re-run the Step 1 preflight when a stable typescript-eslint release officially supports
  the installed stable TypeScript 7.x version without requiring a TypeScript 6
  compatibility API. Do not repeatedly retry unchanged version ranges.

## Why this matters

The SPA has roughly 5,500 lines across 25 JavaScript/JSX application, test,
and Node-script files, but it has no static type-check command. The catalog,
quote, compatibility, assessment, and hook result shapes are implicit and
cross several trust boundaries; currently a field rename, missing status
variant, or wrong nullable assumption can reach runtime before tests expose it.
TypeScript 7 is worthwhile here for contract safety and refactoring confidence,
not for compiler speed alone.

This must not be a repository-wide rename. The high-churn correctness plans and
`App` decomposition land first; this plan then introduces a strict compiler gate
and converts the stable SPA from pure domain modules outward. Root catalog
pipeline scripts remain JavaScript because converting executable Node tooling
has different runtime and deployment consequences and is not required to type
the browser application.

## Product-governance checklist

- **Problem/users/value**: stronger compile-time contracts reduce regressions in
  compatibility, assessment, price, import, and quote workflows for both guided
  and expert users.
- **Decision-engine dimension**: this is enabling infrastructure for
  compatibility, explainability, price confidence, and honest unknown states;
  it adds no user-facing score or interface.
- **Evidence/uncertainty**: types must model verified, inferred, heuristic,
  unknown, and missing states already established by prerequisite plans. A type
  must never turn missing runtime data into a verified fact.
- **Failure paths**: imported JSON/CSV, fetched catalog JSON, absent DOM nodes,
  nullable selections, failed loads, and incomplete artifact fields remain
  explicit boundaries.
- **Precision/commercial bias**: no ranking, price inference, retailer
  preference, or commercial behavior changes.
- **Workflow/value/tests**: existing workflows and serialized contracts remain
  unchanged; the compiler joins the mandatory gate and every renamed test
  continues to pass.

## Current state

- `pc-quote-builder/package.json:10-22` defines lint, test, build, and `check`,
  but no `typecheck`. `check` currently runs
  `npm run lint && npm test && npm run build:check`.
- `pc-quote-builder/package.json:28-41` already has React declaration packages,
  but neither `typescript`, `typescript-eslint`, nor a direct `@types/node`
  dependency.
- `pc-quote-builder/eslint.config.js:7-29` applies JavaScript and React rules only
  to `**/*.{js,jsx}`. Renaming files without extending this configuration would
  silently remove them from lint coverage.
- `pc-quote-builder/src/main.jsx:6` passes
  `document.getElementById("root")` directly to `createRoot`; strict typing must
  make that bootstrap invariant explicit.
- `pc-quote-builder/src/lib/catalogMapper.js:49-135` converts mixed
  snake_case/camelCase processed records into six normalized catalog arrays and
  two tier maps. The normalized catalog is a primary type boundary, while raw
  aliases remain optional input fields.
- `pc-quote-builder/src/lib/selectionEvaluation.js:45-140` composes
  compatibility, power, connector, balance, issue, information, and status
  results without a declared result type. The final type must preserve all
  status/uncertainty variants established by Plan 014.
- `pc-quote-builder/src/hooks/useCatalog.js:39-158` returns catalog, compatibility
  metadata, tier maps, a socket set, and loading/error/fallback state. Its refs
  and dynamically keyed category updates currently rely on inference from
  untyped empty collections.
- `pc-quote-builder/src/test/fixtures.js` centralizes reusable catalog fixtures
  introduced by workflow characterization. These fixtures should become typed
  contract examples rather than duplicated casts in tests.
- The repository uses Vite 8, React 19, Vitest 4, npm, ESM, flat ESLint config,
  and Node `>=22.13`. Preserve those choices.
- TypeScript 7.0 became generally available on 2026-07-08:
  <https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/>.
- TypeScript 7.0 ships without a compiler API. The same announcement says TypeScript 7.1
  is expected to provide a new API and recommends a temporary side-by-side TypeScript
  7/TypeScript 6 arrangement for tools such as typescript-eslint. This plan deliberately
  waits for direct stable support instead of adding that dual toolchain by default.
- At planning time, the official typescript-eslint compatibility page still
  lists TypeScript support as `>=4.8.4 <6.1.0`, although it supports ESLint 10:
  <https://typescript-eslint.io/users/dependency-versions/>. Consequently, the
  ecosystem preflight in Step 1 is expected to block execution if run
  immediately. Do not use an unsupported parser, canary release, or warning
  suppression to bypass it.

## Commands you will need

Run application commands from `pc-quote-builder/`.

| Purpose | Command | Expected result |
|---|---|---|
| Ecosystem preflight | `npm view typescript version && npm view typescript-eslint version && npm view typescript-eslint peerDependencies --json` | stable releases are printed; the selected stable typescript-eslint release supports ESLint 10 |
| Install | `npm install` | exit 0 and only intended type-tool dependencies change in the lockfile |
| Dependency tree | `npm ls typescript typescript-eslint @types/node eslint` | one supported stable version of each; no invalid peer dependencies |
| Typecheck | `npm run typecheck` | exit 0 with no diagnostics and no emitted files |
| Focused hook tests | `npm test -- useCatalog` | catalog hook and loader-boundary tests pass |
| Full tests | `npm test` | all existing and new tests pass |
| Lint | `npm run lint` | all JS config files and all TS/TSX source files are linted; exit 0 |
| Build | `npm run build:check` | exit 0; output goes only to `/tmp/pc-check-build` |
| Full gate | `npm run check` | lint, strict typecheck, tests, and non-mutating build all pass |
| JS residue | `find src -type f \( -name '*.js' -o -name '*.jsx' \) -print` | no output after the final wave |
| Unsafe suppressions | `rg -n '@ts-(ignore|nocheck|expect-error)|eslint-disable.*typescript|as unknown as' src` | no output unless a narrowly justified `@ts-expect-error` exists in a compile-time negative test |

## Suggested executor toolkit

- Read TypeScript's incremental JavaScript-checking guidance before configuring
  the first wave:
  <https://www.typescriptlang.org/tsconfig/checkJs.html>.
- Read the TypeScript 7 release notes for removed or changed compiler options:
  <https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/>.
- Use the stable typescript-eslint flat-config documentation that matches the
  installed release. Do not copy a prerelease/canary configuration.

## Scope

**In scope** (the only files that may be modified):

- `pc-quote-builder/package.json`
- `pc-quote-builder/package-lock.json`
- `pc-quote-builder/eslint.config.js`
- `pc-quote-builder/tsconfig.json` (create)
- `pc-quote-builder/src/vite-env.d.ts` (create if absent)
- All repository-owned code and tests under `pc-quote-builder/src/`, renamed
  from `.js/.jsx` to `.ts/.tsx` in the ordered waves below
- Shared or domain-adjacent type modules under `pc-quote-builder/src/`
- `README.md`, limited to the development verification/typecheck command
- `plans/README.md`, limited to this plan's status

**Out of scope** (do NOT touch):

- `scripts/`, including `build_pc_data.js` and
  `sync_processed_to_public_data.js`
- Python downloader code or requirements
- Generated `data/processed/`, `pc-quote-builder/public/data/`,
  `pc-quote-builder/src/data/catalog.json`, or deployed `docs/`
- `vite.config.js`; Vite already transpiles TypeScript and must not be confused
  with the independent type-check gate
- React, Vite, Vitest, ESLint, or application dependency upgrades unrelated to
  the minimum supported TypeScript toolchain
- Public catalog artifact fields, JSON/CSV schemas, localStorage keys, visible
  labels, recommendation logic, status meaning, or runtime behavior
- Root Node-script TypeScript execution, build output, source maps, declaration
  generation, project references, path aliases, decorators, or a new state
  library

## Git workflow

- Branch: `advisor/027-adopt-typescript-7-incrementally`
- Follow the repository's numbered commit style, for example
  `011: isolate downloader tests`.
- Prefer one commit for compiler/lint infrastructure and one green commit per
  conversion wave. Every commit after the initial baseline must pass
  `npm run check`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Prove the stable lint and compiler ecosystem is ready

1. Confirm Plans 017, 018, and 022 are DONE and the current branch passes
   `npm run check` before changing dependencies.
2. Check the current official typescript-eslint dependency-version page. Its
   supported TypeScript range must include the selected stable TypeScript 7
   release without requiring a TypeScript 6 compatibility API, and its ESLint
   range must include the repository's ESLint 10 release.
3. Run the ecosystem and dependency-tree commands above. Select stable releases
   only; use the repository's existing caret-version convention and commit the
   resolved lockfile.

**Verify**:

- `npm run check` → baseline exits 0.
- `npm ls typescript typescript-eslint @types/node eslint` → one valid,
  supported tree after installation.

Do not continue if official TypeScript 7 support is absent even when npm peer
dependencies are permissive; typescript-eslint documents that permissive peers
permit experimentation and do not imply official support.

Microsoft's documented side-by-side TypeScript 7 compiler and TypeScript 6 API
arrangement is a viable ecosystem transition strategy, but it is not authorized
by this plan. If the owner prioritizes strict typing before direct TypeScript 7
tooling support exists, amend the plan explicitly with separate dependency-tree,
lint/typecheck-divergence, upgrade-removal, and verification criteria. Do not
silently treat the arrangement as satisfying this preflight.

### Step 2: Add a strict no-emit type-check gate while files are still JavaScript

1. Create `tsconfig.json` for the browser source with:
   - `target` appropriate for the existing Vite browser target;
   - `module: "ESNext"` and `moduleResolution: "Bundler"`;
   - DOM and current ECMAScript libraries;
   - `jsx: "react-jsx"`;
   - `resolveJsonModule: true`;
   - `strict: true`, `noEmit: true`, and consistent filename casing;
   - temporary `allowJs: true` and `checkJs: true`;
   - `include: ["src"]`.
2. Add `src/vite-env.d.ts` references for Vite client types. Add a direct
   `@types/node` development dependency because some Vitest artifact tests
   import Node built-ins.
3. Add `"typecheck": "tsc -p tsconfig.json"` and insert
   `npm run typecheck` into `check` before tests.
4. Resolve the JavaScript baseline with precise JSDoc at domain boundaries.
   Prefer named record typedefs, discriminated unions, and narrow type guards.
   Do not use `@ts-nocheck`, blanket `@ts-ignore`, broad `Object`, or
   catch-all `any` to force a green baseline.
5. Raw imported/fetched/parsed data begins as `unknown` or a truthful optional
   raw-record type. Type assertions do not validate runtime data; preserve the
   existing normalization/parsing checks and do not claim otherwise.

**Verify**:

- `npm run typecheck` → exit 0, no emitted `.js`, `.d.ts`, or map files.
- `npm run check` → exit 0 before any extension is renamed.
- `git status --short` → no generated catalog or `docs/` changes.

### Step 3: Establish owned domain contracts before renaming consumers

Define types adjacent to the module that owns each contract. Use
`src/types/` only for records genuinely shared across multiple domains.

At minimum, model:

- normalized `Cpu`, `Motherboard`, `RamKit`, `Gpu`, `Psu`, `PcCase`, `Catalog`,
  `CatalogCategory`, compatibility metadata, and `TierMaps`;
- raw processed catalog inputs separately from normalized UI records, retaining
  optional snake_case/camelCase aliases only at the mapper boundary;
- selected parts and nullable/incomplete selections;
- quote, quote-row, catalog identity, local row identity, price snapshot, and
  import/export results established by Plans 013 and 015;
- compatibility, power, connector, balance, and assessment results as
  discriminated unions that preserve `ok`, warning/potential-problem,
  confirmed-failure, unknown/missing-data, and any additional final variants
  from Plan 014;
- `useCatalog` arguments and return state, including valid category keys and
  dynamically keyed catalog updates;
- component props, callback signatures, DOM events, refs, and browser file APIs.

Do not make optional fields required merely to simplify downstream code.
Unknown and missing data are product states, not compiler inconveniences.

Add `src/types/contracts.test.ts` using Vitest's `expectTypeOf` or
compiler-checked assignments. It must prove that representative shared fixtures
fit the normalized contracts, category keys cannot be arbitrary strings, and
assessment consumers must handle every status variant.

**Verify**:

- `npm run typecheck` → the contract test and all JavaScript consumers pass.
- `npm test -- src/types/contracts.test.ts` → exit 0.
- `rg -n '\[key: string\]: any|Record<string, any>|:\s*any\b' src` → no
  catch-all domain contracts.

### Step 4: Convert pure domain modules and their tests first

Rename and type one source/test pair at a time, beginning with pure leaf modules:

1. catalog helpers and normalized catalog mapping;
2. compatibility and selection/assessment evaluation;
3. CSV, money, quote interchange, identity, and persistence-independent model
   modules produced by prerequisite plans;
4. shared test fixtures and their direct consumers.

For each pair:

- preserve exported symbol names and runtime return shapes;
- use exhaustive `switch` checks with a `never` assertion for closed status
  unions instead of a silent `default`;
- retain nullable/optional source fields and snake_case aliases at their actual
  boundary;
- replace casts with narrowing when the value crosses a JSON, CSV, storage, or
  fetch boundary;
- run the focused test, typecheck, and lint before moving to the next pair.

**Verify after every pair**:
`npm run typecheck && npm test && npm run lint` → all exit 0.

### Step 5: Convert loaders and hooks

1. Convert the data loader, catalog hook, and their tests.
2. Type `CATEGORY_NAMES` and category metadata from one literal source so a
   category key cannot drift from its processed and catalog keys.
3. Give caches, sets, refs, request tokens, fetch results, errors, and functional
   state setters explicit types where empty initial values otherwise infer
   incorrectly.
4. Preserve stale-request handling, fallback behavior, staged loading,
   cancellation, reload semantics, and error text exactly.
5. Do not make a successful fetch imply that unvalidated fields are complete.

**Verify**:
`npm run typecheck && npm test -- useCatalog && npm run lint` → all exit 0,
including failure, cancellation, and rapid-reload cases.

### Step 6: Convert focused React components

1. Convert leaf components and their tests before containers.
2. Type props and callbacks from owned domain contracts rather than duplicating
   anonymous object shapes in each component.
3. Type refs and events precisely (`ChangeEvent`, `KeyboardEvent`, file input,
   focus, and click handlers as applicable).
4. Preserve keyboard navigation, ARIA attributes, focus behavior, markup,
   labels, and CSS class names. Do not introduce render-time effects or
   effect-driven derived state.

**Verify after each component**:
`npm run typecheck && npm test && npm run lint` → all exit 0.

### Step 7: Convert the decomposed App and bootstrap last

1. Convert the focused sections/hooks extracted by Plan 022, then `App`, its
   integration tests, and `main` last.
2. Preserve component interfaces, derived selection logic, persistence keys,
   browser downloads/imports, assessment semantics, and all visible behavior.
3. In `main.tsx`, make the root-element invariant explicit with a null check and
   clear thrown error before `createRoot`; do not hide it with an unchecked
   non-null assertion.
4. Keep the characterization tests as runtime regression coverage. Do not
   replace behavioral assertions with type assertions.

**Verify**:
`npm run typecheck && npm test -- App && npm run lint && npm run build:check` →
all exit 0.

### Step 8: Make TypeScript the complete SPA gate

1. Extend flat ESLint configuration to lint every `.ts/.tsx` source and test
   with the stable supported typescript-eslint configuration plus the existing
   React Hooks and React Refresh rules. Retain a JS config for repository config
   files still matched by `eslint .`.
2. Once `src/` contains no JavaScript/JSX, remove temporary `allowJs` and
   `checkJs` from `tsconfig.json` (or set `allowJs: false`). Keep `noEmit` and
   strict checking.
3. Update README development commands to include `npm run typecheck` and state
   that `npm run check` is the required lint + typecheck + test + build gate.
4. Inspect the complete diff for accidental behavior, generated files,
   dependency upgrades, and import/export contract changes.

**Verify**:

- `find src -type f \( -name '*.js' -o -name '*.jsx' \) -print` → no output.
- `npm run lint` → exit 0 and reports no ignored TS/TSX files.
- `npm run typecheck` → exit 0 and emits nothing.
- `npm run check` → exit 0.
- `npm run test:artifacts` → exit 0.
- `git status --short` → only in-scope source, configuration, lockfile, README,
  and plan-index files are modified.

## Test plan

- Rename every existing `*.test.js`/`*.test.jsx` with its implementation wave;
  preserve all behavioral assertions and test names.
- Add one focused type-contract test for shared catalog, quote, assessment,
  category, and hook contracts. Use existing `src/test/fixtures` as values
  rather than inventing a second fixture universe.
- Retain sad-path runtime tests for null/empty selections, missing catalog
  fields, malformed imports, load failure, cancellation, rapid reload, unknown
  assessment, and browser file APIs. Types do not replace these tests.
- Add compile-time negative cases only when they demonstrate a load-bearing
  invariant. A narrowly scoped `@ts-expect-error` is permitted only in such a
  negative test and must include a comment naming the invariant.
- Do not add snapshots or a second test runner.

## Done criteria

- [ ] Official stable typescript-eslint support includes the installed
      TypeScript 7.x and ESLint 10 versions without a TypeScript 6
      compatibility API.
- [ ] `npm ls typescript typescript-eslint @types/node eslint` is valid and has
      no unintended duplicate toolchain.
- [ ] `npm run typecheck` performs strict, no-emit checking and exits 0.
- [ ] `npm run check` includes lint + typecheck + tests + non-mutating build and
      exits 0.
- [ ] `npm run test:artifacts` exits 0.
- [ ] No `.js` or `.jsx` files remain under `pc-quote-builder/src/`.
- [ ] ESLint covers `.ts` and `.tsx`; renamed files are not silently ignored.
- [ ] No production `@ts-ignore`, `@ts-nocheck`, double assertion, catch-all
      `any`, or blanket TypeScript lint disable was introduced.
- [ ] Catalog, quote, assessment, selection, hook, and component boundaries
      have named truthful types; unknown/missing states remain representable.
- [ ] Public JSON/CSV shapes, localStorage keys, visible text, compatibility and
      recommendation behavior, test expectations, and generated artifacts are
      unchanged.
- [ ] Root `scripts/` remain JavaScript and executable through existing npm
      commands.
- [ ] README documents `typecheck` and the strengthened required gate.
- [ ] No files outside the in-scope list are modified.
- [ ] `plans/README.md` status row is updated.

## STOP conditions

Stop and report back instead of improvising if:

- Any prerequisite plan is incomplete or its tests are not green.
- The stable typescript-eslint support range does not include both the selected
  TypeScript 7.x release and ESLint 10 without a TypeScript 6 compatibility
  API. Do not use canaries, unsupported-version warning suppression, a
  temporary lint exclusion, or an undeclared dual toolchain.
- TypeScript 7 lacks a compiler/configuration feature required by the current
  Vite/Vitest application, or the migration requires keeping TypeScript 6
  compiler APIs in the production toolchain.
- A compiler error reveals an unresolved product-semantic question—for example,
  whether missing data means unknown, warning, or failure. Surface the question;
  do not choose a status merely to satisfy a union.
- Correct typing requires changing catalog artifacts, serialized quote/price
  formats, localStorage keys, runtime normalization acceptance, visible UI, or
  recommendation logic.
- A conversion wave cannot pass its focused tests, typecheck, and lint after two
  reasonable correction attempts.
- The migration appears to require converting root Node scripts, changing how
  the data pipeline executes, or adding a runtime TypeScript loader.
- Generated catalog data or `docs/` changes appear.
- The only apparent path to green uses broad `any`, `@ts-ignore`,
  `@ts-nocheck`, double assertions, unchecked JSON casts, or blanket lint
  disables.

## Maintenance notes

- Vite transpilation is not type checking. Keep `npm run typecheck` in
  `npm run check` and CI permanently.
- Treat normalized domain types as owned contracts. Raw external/catalog/import
  records must be narrowed at adapters rather than leaking optional aliases
  throughout UI code.
- Review every new assessment union variant exhaustively so missing data cannot
  silently fall through to a valid/all-clear presentation.
- Keep TypeScript, typescript-eslint, ESLint, Vite, and Vitest upgrades within
  their documented stable compatibility ranges. Do not infer support solely
  from permissive peer dependencies.
- Treat a future side-by-side TypeScript 7 compiler and TypeScript 6 API setup
  as an explicit plan amendment, not an implementation detail. It must define
  why two compiler generations are acceptable, how lint/typecheck divergence is
  detected, and when the compatibility dependency is removed.
- Root data-pipeline scripts are deliberately deferred. Propose a separate plan
  only if measured maintenance or correctness value justifies changing their
  execution model.
