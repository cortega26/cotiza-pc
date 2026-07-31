# Plan 028: Implement the pure Quote Analyzer v1 core

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report; do not improvise. When done, update this plan's row in
> `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat cef0acd..HEAD -- docs/PRODUCT_VISION.md docs/design/quote-analyzer.md pc-quote-builder/src/lib/compatibility.js pc-quote-builder/src/lib/csvParser.js pc-quote-builder/src/lib/quoteModel.js pc-quote-builder/src/test/fixtures.js pc-quote-builder/src/lib/quoteAnalyzer`
>
> If an in-scope file changed, compare the "Current state" excerpts with the
> live code. If a contract or severity rule no longer matches, STOP and report.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: archived Plans 014, 015, 018, and 024 (all DONE)
- **Category**: direction
- **Planned at**: commit `cef0acd`, 2026-07-30

## Why this matters

The product can import and edit quotations, but it cannot evaluate an imported
quotation using the versioned evidence contract required by the canonical
vision. This plan implements only the deterministic, pure Analyzer foundation:
identity resolution, selection assembly, compatibility/completeness reporting,
evidence-bearing findings, and verdict precedence. It deliberately excludes UI,
analytics, value-for-money claims, performance-balance claims, and fuzzy/AI
matching.

## Product-decision record

Execution of this plan requires explicit project-owner approval of the following
v1 defaults. The executor must present this block before changing code; an
instruction to execute the plan without amendments counts as approval.

1. A fully `ok` technical verdict requires CPU, motherboard, RAM, PSU, case, and
   either a resolved GPU or explicit integrated-graphics confirmation. A missing
   or unresolved required component produces `unknown`/`incomplete`, never a
   fabricated compatibility failure.
2. CPU/GPU tiers are not findings and are not exposed by the v1 report.
3. Quote prices become stale after 14 days, matching existing behavior.
4. A user-confirmed product mapping applies only to the current analysis; it is
   not silently persisted as a global alias.
5. `useCase` is `gaming` only. Budget is stored as context but produces no value
   or affordability conclusion.
6. Determinism takes priority over wall-clock convenience: add a caller-supplied
   `evaluatedAt` value to the input contract and copy it to the output. The pure
   analyzer must never call `Date.now()` or construct the timestamp itself.

This advances Milestones 0 and 2. Findings remain deterministic, derived, or
unsupported as specified; missing evidence affects only the relevant dimension.
No retailer identity or commercial field may influence severity or ordering.

## Current state

- `docs/design/quote-analyzer.md:118-213` defines
  `quote-analyzer/input/v1`, `quote-analyzer/output/v1`, `AnalyzerFinding`, and
  verdict precedence.
- `docs/design/quote-analyzer.md:94-116` allows evidence only for `exact-id` and
  `user-mapped`; free text alone is never a product identity.
- `docs/design/quote-analyzer.md:245-283` enumerates the supported v1 findings
  and explicitly defers balance, value, upgradeability, fuzzy matching, and
  unsupported categories.
- `pc-quote-builder/src/lib/quoteModel.js:27-53` normalizes quote rows:

  ```js
  return {
    id: row.id || createId(),
    category: row.category || "",
    product: row.product || "",
    itemId: row.itemId || "",
    store: row.store || "",
    offerPrice: row.offerPrice || "",
    regularPrice: row.regularPrice || "",
    notes: row.notes || "",
  };
  ```

- `pc-quote-builder/src/lib/compatibility.js:15-107` contains the authoritative
  socket, RAM, form-factor, GPU-length, PSU-power, and connector checks. Reuse
  these functions; do not copy their formulas.
- `pc-quote-builder/src/lib/selectionEvaluation.js:145-155` establishes current
  precedence: fail, warning, unknown, ok, incomplete.
- Tests are co-located Vitest files. Shared domain fixtures live in
  `pc-quote-builder/src/test/fixtures.js`; use those rather than creating a
  second unrelated fixture universe.

## Commands you will need

Run all commands from `pc-quote-builder/`.

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npx vitest run src/lib/quoteAnalyzer` | all Analyzer tests pass |
| Import regression | `npx vitest run src/lib/csvParser.test.js src/lib/quoteModel.test.js` | all pass |
| Compatibility regression | `npx vitest run src/lib/compatibility.test.js src/lib/selectionEvaluation.test.js` | all pass |
| Required gate | `npm run check` | lint, full test suite, and disposable build all exit 0 |
| Diff hygiene | `git diff --check` | exit 0 |

Do not run `npm run build`; it rewrites tracked `docs/`. Do not run the catalog
download pipeline.

## Scope

**In scope**:

- `docs/design/quote-analyzer.md` — record approved defaults and the
  caller-supplied `evaluatedAt` determinism correction.
- `pc-quote-builder/src/lib/quoteAnalyzer/contracts.js` — schema constants,
  status enums, required categories, rule version, and JSDoc contracts.
- `pc-quote-builder/src/lib/quoteAnalyzer/resolver.js` and test.
- `pc-quote-builder/src/lib/quoteAnalyzer/assemble.js` and test.
- `pc-quote-builder/src/lib/quoteAnalyzer/report.js` and test.
- `pc-quote-builder/src/lib/quoteAnalyzer/index.js` and integration test.
- `pc-quote-builder/src/test/fixtures.js` — only the sparse and marginal-PSU
  fixtures already specified by the design.
- Existing tests only where needed to prove unchanged import/compatibility
  behavior.

**Out of scope**:

- `pc-quote-builder/src/App.jsx`, CSS, and all production UI.
- Fuzzy or AI matching, OCR, global alias persistence, and retailer scraping.
- Balance, bottleneck, price-reasonableness, value, upgradeability, thermals,
  noise, durability, BIOS, and international-price findings.
- Changes to the underlying compatibility formulas.
- TypeScript or dependency changes; Plan 027 remains blocked. Use JSDoc.
- Catalog generation and generated artifacts.

## Git workflow

- Branch: `advisor/028-implement-quote-analyzer-core`
- Use logical commits such as `028: add quote analyzer resolution contract` and
  `028: implement evidence-qualified analyzer report`.
- Do not push or open a PR unless instructed.

## Steps

### Step 1: Record the approved v1 decisions

Update `docs/design/quote-analyzer.md` §4 and §12 with the approved defaults
above. Add `evaluatedAt` to the input and specify that output `generatedAt`
copies it verbatim. Preserve schema name `quote-analyzer/input/v1`; if the owner
considers this correction incompatible with approval already given, bump the
draft schema before any production consumer exists.

**Verify**:
`rg -n "evaluatedAt|required.*motherboard|per-analysis|14-day" docs/design/quote-analyzer.md`
→ each approved decision has an explicit match.

### Step 2: Define contracts and rule constants

Create `contracts.js` with frozen schema/version constants and JSDoc shapes.
Define the six normalized component keys, the allowed resolution states,
dimension names, verdict states, finding severity, decision types, confidence
levels, and a single exported `RULES_VERSION`. Export pure validators for
development/test use; validators must reject malformed inputs with stable,
Spanish user-safe messages and must not mutate input.

**Verify**:
`npx vitest run src/lib/quoteAnalyzer/contracts.test.js`
→ valid v1 fixtures pass; wrong schema, missing quote, malformed rows, unsupported
use case, and missing `evaluatedAt` fail deterministically.

### Step 3: Implement conservative row resolution

Create `resolver.js`.

- Normalize supported Spanish category labels into `cpu`, `mobo`, `ram`, `gpu`,
  `psu`, and `pcCase`.
- Resolve `itemId` through `resolveCatalogId` aliases and then require exactly
  one catalog item in the supported category.
- Accept an explicit mapping object keyed by row ID for `user-mapped`.
- For unresolved text, generate candidate IDs using normalized token inclusion,
  but return `ambiguous` even when exactly one candidate exists.
- Return `unmatched-text` when no candidate exists and
  `unsupported-category` outside v1.
- Never mutate the row, catalog, aliases, or explicit mappings.

Candidate generation is advisory only. No ambiguous row may reach assembly.

**Verify**:
`npx vitest run src/lib/quoteAnalyzer/resolver.test.js`
→ exact alias, explicit mapping, one candidate, multiple candidates, unmatched
text, duplicate-name ambiguity, unsupported category, null inputs, and input
immutability all pass.

### Step 4: Assemble only evidence-qualified components

Create `assemble.js`. Consume the resolution map and catalog to produce the
builder-shaped selection `{ cpu, mobo, ram, gpu, psu, pcCase }`, plus
component-resolution gaps and integrated-GPU state. Include only `exact-id` and
`user-mapped` items. Detect duplicate resolved rows for one required category;
represent the category as unresolved rather than choosing by row order.

**Verify**:
`npx vitest run src/lib/quoteAnalyzer/assemble.test.js`
→ complete, integrated-GPU, missing, ambiguous, duplicate-category, stale alias,
and immutable-input cases pass.

### Step 5: Build dimensions, findings, and verdict

Create `report.js`. Call the existing compatibility functions directly and map
their outputs to the Analyzer contract. Every emitted finding must include:
stable ID, dimension, severity, conclusion, affected row/component keys,
decision type, exact source-field names, source kind, catalog and quote
freshness, `RULES_VERSION`, confidence, explanation, and next action.

Implement the seven dimensions from the design. Preserve precedence exactly:
`fail > warning > unknown > ok > incomplete`. A missing input must never become
`ok`; a compatibility mismatch backed by complete catalog fields may become
`fail`; inferred or conflicting evidence must lower confidence. Sort findings
by severity and then stable finding ID so output is byte-stable.

**Verify**:
`npx vitest run src/lib/quoteAnalyzer/report.test.js`
→ F1 valid, F2 incompatible, F3 warning, F4 insufficient evidence, F5
ambiguous identity, and F6 stale/partial prices match the design.

### Step 6: Compose the public pure entry point

Create `index.js` exporting one main `analyzeQuote(input)` function. It validates,
resolves, assembles, reports, and returns a fresh serializable object without
mutating input or retaining module-level state. Add integration tests for F1-F7,
including the existing malformed CSV rejection before analysis.

Assert:

- identical deep-cloned input yields deep-equal and JSON-byte-identical output;
- changing only `rulesVersion`, catalog timestamp, quote timestamp, a user
  mapping, or `evaluatedAt` changes only the expected fields;
- a 20-row synthetic quote completes below the design's 100 ms ceiling without
  network access.

**Verify**:
`npx vitest run src/lib/quoteAnalyzer`
→ all unit and integration tests pass.

### Step 7: Run regressions and the required gate

Run the compatibility/import regressions and then `npm run check`. Inspect
`git status --short`; only in-scope source/test/design files and the plan index
may be changed.

**Verify**:
`npm run check && git diff --check`
→ both exit 0.

## Test plan

- Model fixture construction after `src/test/fixtures.js`.
- Test each resolution state and every verdict state.
- Test malformed/null/empty values, duplicate categories, aliases, ambiguous
  names, unsupported categories, integrated graphics, absent timestamps,
  sparse TDP/length/form-factor/connector data, and invalid prices.
- Assert all evidence fields, not just summary strings.
- Assert input immutability and byte-stable output.
- Keep UI and network entirely out of these tests.

## Done criteria

- [x] Owner defaults are recorded in `docs/design/quote-analyzer.md`.
- [x] `analyzeQuote` is a pure, exported, versioned entry point.
- [x] Free text never produces evidence without explicit confirmation.
- [x] All F1-F7 fixture classes pass.
- [x] Every finding has evidence, freshness, confidence, rule version, and action.
- [x] Missing evidence never renders as `ok`.
- [x] `npx vitest run src/lib/quoteAnalyzer` passes.
- [x] `npm run check` and `git diff --check` exit 0.
- [x] No dependencies, UI, generated catalog files, or deployed `docs/assets`
  were changed.
- [x] `plans/README.md` is updated.

## STOP conditions

Stop and report if:

- The owner rejects or has not approved the v1 defaults.
- The analyzer would need free-text identity to meet a passing fixture.
- Reusing a compatibility check would weaken unknown/fail semantics or require
  changing its current behavior.
- The report cannot be deterministic without hidden wall-clock/global state.
- A supported finding requires data absent from the designed v1 inventory.
- Implementation requires UI, new dependencies, or generated catalog changes.
- A verification command fails twice after a reasonable correction.

## Maintenance notes

The Analyzer contract becomes a shared product boundary. Future Expert, Guided,
comparison, content, and measurement work must consume its versioned output
rather than reimplementing verdict logic. Reviewers should scrutinize identity
resolution, missing-data handling, finding ordering, and any claim whose
decision type is stronger than its evidence.
