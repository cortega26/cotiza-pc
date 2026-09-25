# Plan 052: Add the local, privacy-minimized coverage-case export (corpus flywheel, layer 1)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6cde4b8..HEAD -- pc-quote-builder/src/components/QuoteAnalyzer/ docs/design/coverage-case-contribution.md scripts/lib/quote_analyzer_assurance.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (privacy-sensitive; user data leaves the app as a local file)
- **Depends on**: plans/048 (design decision record; must be merged and its
  owner checklist resolved) and plans/037 (assurance gate green)
- **Category**: direction (implementation of an approved design)
- **Planned at**: commit `6cde4b8`, 2026-09-25

## Why this matters

This is the first layer of the product's moat. The catalog (BuildCores,
pc-part, dbgpu) and the compatibility rules are open data that any competitor
can replicate next quarter. What cannot be replicated is a corpus of **real,
messy Chilean quotations** and the resolution intelligence derived from it —
how a store or technician actually writes a line item, and which catalog
identity it truly refers to. The Quote Analyzer is currently evaluated only
against synthetic fixtures; on real quotations nobody knows whether the 80%
identity-resolution target is met, because the corpus is 0/30.

Plan 048 designed the contribution path and left implementation pending owner
decisions. The owner has resolved them conservatively (recorded in
`plans/README.md`, 2026-09-25):

- **Adopt** the `coverage-case/v1` local-download path.
- Keep real `itemId` values (hashing them breaks `exact-id` resolution, which
  is the metric being measured); keep them only inside the exported file and
  never in a report.
- v1 is limited to `exact-id` / `user-mapped` outcomes: free-text product
  strings are dropped, which means the corpus cannot measure `ambiguous` or
  `unmatched-text`. This is a deliberate, documented reduction of scope.
- Staging files are deleted after each aggregate run; only aggregates persist.
- Withdrawal is by opaque `caseId`.
- The product never uploads. There is no endpoint, no fetch, no queue.

After this plan, a user can voluntarily download a minimized, validated
coverage case; the operator can aggregate it offline with the existing CLI;
and Milestone 2's identity-resolution criterion becomes measurable for the
first time.

## Current state

- The Analyzer already assembles the exact payload the harness validates.
  `QuoteAnalyzer.jsx:113-145` builds `input`:
  ```js
  const input = {
    schemaVersion: SCHEMA_VERSION_INPUT,
    evaluatedAt: analysisStart.evaluatedAt,
    quote: { ...quote, rows: analysisRows },
    userContext: { useCase: "gaming", targetResolution, budget, usesIntegratedGpu, assemblyScope },
    catalog,
    catalogMeta: compatMeta || { generatedAt: "", schemaVersion: null },
    aliases,
    explicitMappings,
    rulesVersion: RULES_VERSION,
  };
  ```
  It is passed to `analyzeQuote(input)` inside the `report` memo.
- The coverage-case contract is a strict allow-list
  (`scripts/lib/quote_analyzer_assurance.js:359-398`):
  ```js
  const allowedKeys = ["schemaVersion","caseId","quoteSnapshotAt","elapsedMs",
                       "recruitmentSource","sampling","analyzerInput"];
  ```
  `caseId` must be a non-empty string starting with `COVERAGE-`; `quoteSnapshotAt`
  must be a valid ISO 8601 datetime; `elapsedMs` must be `null` or a
  non-negative finite number; `recruitmentSource` must be in
  `RECRUITMENT_SOURCES` which is `["direct"]` only (`:38`); `sampling` must be an
  object whose four keys `resolutionTarget`, `graphics`, `completeness`,
  `budgetBand` are all non-empty strings. Any other top-level key is rejected.
- `validateAnalyzerInput` (`pc-quote-builder/src/lib/quoteAnalyzer/contracts.js:112-148`)
  requires: `schemaVersion`, an ISO `evaluatedAt`, `quote.rows` (array of plain
  objects — **row contents are never inspected**), `userContext.useCase ===
  "gaming"`, `userContext.usesIntegratedGpu` boolean-or-null, all six catalog
  lists present as arrays, and a plain-object `catalogMeta`. Because row
  contents are unvalidated, minimization is safe as long as the file still
  analyzes to the same resolution states.
- The harness re-analyzes `analyzerInput` through the black-box analyzer and
  counts only `exact-id` and `user-mapped` toward identity resolution
  (`scripts/lib/quote_analyzer_assurance.js:648-704`). A minimized catalog
  containing only the referenced items is sufficient: `resolveRow` looks up by
  id within the provided list (`resolver.js:75-84`).
- The local-download precedent already exists: `exportJSON` + `downloadFile` in
  `pc-quote-builder/src/lib/fileIO.js:51-67`.
- `AnalyzerVerdict.jsx` renders the verdict and owns the `onDecisionAction`
  callback; `QuoteAnalyzer.jsx` composes it at `:408-418`. There is currently
  no export action in the Analyzer.

Repo conventions: pure logic in `src/lib/*.js` with a co-located
`*.test.js`; components in `src/components/QuoteAnalyzer/`; Spanish user-facing
copy; no new dependencies; tests are Vitest + Testing Library.

## Commands you will need

| Purpose | Command | Provenance | Expected on success |
|---|---|---|---|
| Install | `npm ci` (in `pc-quote-builder/`) | declared | exit 0 |
| Focused tests | `npm test -- coverageCase` | declared | all pass |
| Full tests | `npm test` | executed | all pass |
| Lint | `npm run lint` | executed | exit 0 |
| Required gate | `npm run check` | declared | exit 0 |
| Assurance | `npm run test:assurance` (after plan 037) | declared | exit 0 |

**Provenance**: `executed` = run by the advisor during recon; `declared` = read
from `package.json`/CI, not run.

## Scope

**In scope** (the only files you may create or modify):
- `pc-quote-builder/src/lib/coverageCase.js` (create)
- `pc-quote-builder/src/lib/coverageCase.test.js` (create)
- `pc-quote-builder/src/components/QuoteAnalyzer/CoverageCaseExport.jsx` (create)
- `pc-quote-builder/src/components/QuoteAnalyzer/CoverageCaseExport.test.jsx` (create)
- `pc-quote-builder/src/components/QuoteAnalyzer/QuoteAnalyzer.jsx` (wire the
  action into the resolve and verdict stages only)
- `pc-quote-builder/src/components/QuoteAnalyzer/QuoteAnalyzer.test.jsx` (add tests)

**Out of scope** (do NOT touch):
- Any network code, `fetch`, telemetry event, or measurement change. The export
  emits **no** measurement event and does not alter the measurement contract.
- `scripts/` and the assurance harness (the builder's output must satisfy them,
  not modify them).
- `pc-quote-builder/src/lib/fileIO.js` (reuse `downloadFile`; do not edit it).
- `docs/validation/*.md` and `docs/design/*.md` (read-only references).
- Persisting the case into quote state, localStorage, or the quote export.
- Any UI outside the Analyzer's resolve/verdict stages.
- OCR, PDF, scraping, AI matching, fuzzy resolution, or community features.

## Git workflow

- Branch: `advisor/052-coverage-case-export`
- Commits: `052: <imperative summary>` (e.g. `052: add minimized local coverage-case export`).
- Do NOT push or open a PR.

## Steps

### Step 0: Establish a green baseline

From `pc-quote-builder/`: `npm ci`, `npm run lint`, `npm test` — all exit 0.
If plan 037 has merged, also run `npm run test:assurance` and confirm exit 0.
Record the outputs.

### Step 1: Write the pure builder `src/lib/coverageCase.js`

Export exactly two functions plus the version constant. No DOM, no network, no
imports from components.

```js
export const COVERAGE_CASE_SCHEMA_VERSION = "quote-analyzer-assurance/coverage-case/v1";
export const buildCoverageCase = (analyzerInput, { caseId, sampledAt, sampling }) => ({ ... });
```

`buildCoverageCase` must produce:

```js
{
  schemaVersion: "quote-analyzer-assurance/coverage-case/v1",
  caseId,                       // "COVERAGE-" + caller-supplied opaque token
  quoteSnapshotAt: sampledAt,   // ISO 8601 string from the caller
  elapsedMs: null,              // never measured in v1
  recruitmentSource: "direct",  // the only value the harness accepts
  sampling: {
    resolutionTarget, graphics, completeness, budgetBand, // 4 non-empty strings
  },
  analyzerInput,                // minimized, see below
}
```

Minimize `analyzerInput` — this is the load-bearing privacy logic:

1. `schemaVersion`, `evaluatedAt`, `userContext.useCase` (always `"gaming"`),
   `userContext.usesIntegratedGpu`, and `catalogMeta` pass through unchanged.
2. Drop from `userContext`: `budget` (contains an amount), `targetResolution`
   (already carried as `sampling.resolutionTarget`), and `assemblyScope`.
3. Drop from `quote`: `name`, `currency`, `priceUpdatedAt`. Keep `rows`.
4. For each row keep **only**: a new opaque `id`, `category`, and `itemId`.
   Drop `product`, `store`, `offerPrice`, `regularPrice`, `notes`, and any
   other field. If a row has no `itemId`, **omit that row entirely** (free-text
   rows cannot contribute to the v1 metric and their text is the main privacy
   risk).
5. Renumber the kept rows' ids deterministically (`r-1`, `r-2`, … in input
   order) so nothing from the user's quote id space leaks. Record the old→new
   mapping nowhere; the user's original ids must not appear in the output.
6. Reduce `catalog` to only the items referenced by the kept `itemId`s, keeping
   each of the six required arrays present (an empty array is valid and means
   "no referenced items of this kind"). Copy the item objects as-is (they are
   public catalog data, not user data).
7. `aliases`: keep only entries whose key or value is a referenced `itemId`;
   otherwise `null`.
8. `explicitMappings`: rebuild keyed by the **new** row ids so the harness can
   still reproduce `user-mapped` outcomes; drop it if no kept row was
   user-mapped.
9. Never mutate the caller's `analyzerInput`.

Sensible `sampling` defaults when a value is missing (all must be non-empty
strings): `resolutionTarget: "unknown"`, `graphics: "unknown"`,
`completeness: "unknown"`, `budgetBand: "unknown"`. The caller may override.

Also export a small helper the component uses to render the pre-download
summary: `summarizeCoverageCase(coverageCase)` returning
`{ componentCount, categories: string[] }` from the minimized rows — for the
dialog copy, never the product text.

### Step 2: Prove contract compliance with the real validators

This is the acceptance test that matters. In `coverageCase.test.js`, import the
production validators and assert the builder's output passes them:

```js
import { validateCoverageCase, COVERAGE_SCHEMA_VERSION } from "../../../scripts/lib/quote_analyzer_assurance.js";
import { validateAnalyzerInput, SCHEMA_VERSION_INPUT } from "./quoteAnalyzer/contracts";
```

Cases:
1. A built case passes `validateCoverageCase(...)` with an empty error array.
2. `validateAnalyzerInput(case.analyzerInput)` does not throw.
3. The output has exactly the 7 allow-listed top-level keys.
4. No retained row contains `product`, `store`, `notes`, `offerPrice`, or
   `regularPrice` (assert by key set, not by value).
5. A row without `itemId` is dropped; rows with `itemId` are kept with ids
   `r-1…r-n` and the original row ids appear nowhere in the JSON string
   (`expect(JSON.stringify(case)).not.toContain(originalRowId)`).
6. `catalog` keeps only referenced items and all six arrays still exist.
7. `elapsedMs` is `null`, `recruitmentSource` is `"direct"`, and a caller
   supplying four non-empty sampling strings preserves them.
8. Builder does not mutate its input (deep-clone the input and compare).
9. Malformed input: empty rows → still a valid case (all six catalog arrays
   empty), because the harness requires arrays, not items.

Use a small fixture helper modeled on `src/test/fixtures.js`
(`cpuIntel`, `moboLga`, `gpuHigh`, …). Use a fixed `sampledAt` string; do not
call `Date.now()` inside `buildCoverageCase`.

**Verify**: `npm test -- coverageCase` → all pass, including the
`validateCoverageCase` case.

### Step 3: Build the export component

Create `CoverageCaseExport.jsx` rendering a button labeled
`Descargar caso anónimo` that opens a confirmation dialog. Requirements:

- The dialog states, in Spanish, what the file is, that it stays on the device,
  that nothing is uploaded, what is removed (stores, prices, notes, free text)
  and what remains (category, catalog reference, resolution outcome), that
  participation is voluntary and does not change the verdict, and how to ask
  for deletion.
- The dialog shows the summary from `summarizeCoverageCase` (how many
  components and which categories) so the user can see the size of the
  contribution.
- On confirm: call `downloadFile(JSON.stringify(case, null, 2), "coverage-case.json",
  "application/json")` using the existing `fileIO.js` helper. The filename
  must be a constant, not derived from the quote name.
- On cancel or dialog close: nothing is written.
- The component receives `analyzerInput`, `caseId`, and `sampledAt` as props;
  it fetches nothing and imports no network code.
- The `caseId` token must be generated per click with `crypto.randomUUID()`
  when available, prefixed `COVERAGE-` (harness requirement). Do not derive it
  from quote content.

Tests (`CoverageCaseExport.test.jsx`): button renders; clicking opens the
dialog with the removal/retention statements; cancel triggers no download;
confirm calls `downloadFile` exactly once with `"coverage-case.json"` and
valid JSON; the JSON passes `validateCoverageCase`; the dialog summary shows
the component count.

### Step 4: Wire it into the Analyzer (resolve and verdict only)

In `QuoteAnalyzer.jsx`, where `input` is built for the `report` memo
(`:113-145`), lift that object so it is also available to the export. Render
`<CoverageCaseExport analyzerInput={input} ... />` in exactly two places:

- the resolve stage, below the resolution review;
- the verdict stage, next to the existing decision actions.

Use the same `analysisStart.evaluatedAt` as `sampledAt`. Do not alter the
stage machine, the report memo, the verdict copy, or any measurement call.
Add one `QuoteAnalyzer.test.jsx` test: reaching the verdict shows the button,
and confirming the dialog produces a valid coverage case whose `analyzerInput`
still resolves the same component keys.

**Verify**: `npm test` → all pass; `npm run lint` → exit 0.

## Test plan

- `coverageCase.test.js`: the nine cases in Step 2, anchored on the real
  validators, not on re-implemented expectations.
- `CoverageCaseExport.test.jsx`: dialog copy, cancel, confirm-once, valid
  output, summary count.
- `QuoteAnalyzer.test.jsx`: button present at resolve and verdict, and the
  exported `analyzerInput` preserves the resolution outcome.
- Regression: `npm test` fully green — the export must not change any verdict
  text, dimension, or measurement event.

**Verification**: `npm run check` → exit 0; `npm run test:assurance` → exit 0.

## Done criteria

ALL must hold:

- [ ] `npm run lint` exits 0
- [ ] `npm test` exits 0, including the new files
- [ ] `npm run check` exits 0
- [ ] `npm run test:assurance` exits 0 (after plan 037)
- [ ] `rg -n "fetch\(|XMLHttpRequest|sendBeacon|WebSocket" pc-quote-builder/src/lib/coverageCase.js pc-quote-builder/src/components/QuoteAnalyzer/CoverageCaseExport.jsx` returns no matches
- [ ] `rg -n "measurement|track\(" pc-quote-builder/src/components/QuoteAnalyzer/CoverageCaseExport.jsx` returns no matches
- [ ] A test asserts `validateCoverageCase(buildCoverageCase(...))` has zero errors
- [ ] A test asserts no `product`/`store`/`notes`/price keys survive in kept rows
- [ ] `git diff --name-only 6cde4b8...HEAD` lists only in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 048's design document is not merged, or its owner checklist is
  unresolved — do not implement ahead of the decision.
- The real `validateCoverageCase` rejects a case your builder produces: fix the
  builder, never relax the harness.
- Minimizing the catalog changes any resolution state or report dimension in a
  way the Analyzer surfaces to the user (a minimized case must analyze
  identically to the full one for the retained rows).
- Any requirement seems to need network access, a new dependency, a storage
  key, or a change to `fileIO.js`.
- The consent copy needs legal wording you are not able to draft responsibly —
  leave the copy plain and flag the question in NOTES.

## Maintenance notes

- The privacy boundary is the builder, not the UI. Any future field added to
  `analyzerInput` must be explicitly allowed in `buildCoverageCase`; a new
  field must never be copied through by default.
- `RECRUITMENT_SOURCES` is `["direct"]` today. If the owner approves another
  recruitment source, update the builder **and** the harness allow-list in the
  same change, with a schema note in `docs/validation/`.
- Reviewer should scrutinize: the JSON emitted contains no free text, no
  prices, no store, no notes, and no original row/quote ids; the dialog's
  claims match what the builder actually does.
- Operator aggregation remains: copy authorized files to a private directory
  outside Git, run
  `node scripts/quote_analyzer_assurance.js --conformance-dir scripts/fixtures/quote-analyzer-assurance --coverage-corpus-dir <abs> --report-only`,
  then delete the staging copies. That operator runbook is not part of this
  plan; the public report is aggregates only.
- **Deferred**: `ambiguous`/`unmatched-text` coverage metrics (needs a harness
  amendment), an optional minimization-profile marker, and any in-app
  aggregation. All require owner approval per Plan 048 §8.
