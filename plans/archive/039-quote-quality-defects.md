# Plan 039: Fix analyzer quote-quality defects (blank rows, price-CSV IDs, inferred evidence, stale signature)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6cde4b8..HEAD -- pc-quote-builder/src/lib/quoteAnalyzer/report.js pc-quote-builder/src/lib/csvParser.js pc-quote-builder/src/components/QuoteAnalyzer/session.js pc-quote-builder/src/components/QuoteAnalyzer/QuoteAnalyzer.jsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW-MED (one verdict-semantics change; see product record)
- **Depends on**: none (recommended after 038 so the assurance suite diff is isolated)
- **Category**: bug
- **Planned at**: commit `6cde4b8`, 2026-09-25

## Why this matters

Four verified defects distort the primary Analyzer workflow:

1. **Blank placeholder rows are counted as "unpriced"** — a fully resolved,
   fully priced quote that still carries the default empty trailing row is
   reported `warning` overall with "Hay una fila sin precio válido.", and the
   `quote_input_completed.missingPriceRowCount` measurement is inflated.
2. **Price CSV column detection uses substring matching** — the header
   `Cantidad` (contains "id") is selected before a real `ID` column, so price
   imports silently key prices to quantity cells and never apply.
3. **Inferred case form factors produce high-confidence critical findings** —
   `formFactorEvidence === "inferred"` is treated exactly like explicit data,
   contradicting this repository's own design rule ("inferred catalog fields →
   low/medium as applicable") and the vision's evidence-confidence rules.
   4,085 of 7,914 shipped cases are `inferred`.
4. **The analysis signature omits `quote.currency` and `quote.priceUpdatedAt`**,
   so changing either leaves `isCurrent === true`: no reconciliation banner, no
   new completion events, while the verdict is silently recomputed under the
   new inputs.

## Product-decision record (required by `AGENTS.md` / `docs/PRODUCT_VISION.md`)

- **User problem**: warnings that are wrong (empty rows) train users to ignore
  warnings; unapplied prices and silent re-evaluation undermine trust.
- **Dimension improved**: price completeness, evidence confidence, and
  decision traceability.
- **Evidence type**: deterministic (row emptiness, price parsing, evidence
  provenance). The inferred-confidence change lowers confidence to `medium`,
  never removes a finding.
- **Failure modes**: a quote whose only "unpriced" row is a real user row with
  no price still warns; an inferred-evidence fit failure still reports `fail`
  but at `medium` confidence.
- **Milestone**: Milestone 2's "every high-severity finding exposes evidence,
  freshness, confidence" and the unknown/ok separation rules.

## Current state

`pc-quote-builder/src/lib/quoteAnalyzer/report.js:527-537`:

```js
  const rows = Array.isArray(quote?.rows) ? quote.rows : [];
  const unpricedRowIds = [];
  rows.forEach((row, index) => {
    const hasOffer = parsePrice(row?.offerPrice, currency).status === "valid";
    const hasRegular = parsePrice(row?.regularPrice, currency).status === "valid";
    if (!hasOffer && !hasRegular) unpricedRowIds.push(row?.id ?? `#${index}`);
  });
```

`pc-quote-builder/src/lib/quoteModel.js` exports `isRowEmpty` (used by
`App.jsx` when applying builder selections); the analyzer does not import it.

`pc-quote-builder/src/components/QuoteAnalyzer/QuoteAnalyzer.jsx:167-173`:

```js
      const missingPriceRows = analysisRows.filter(
        (row) => !row.offerPrice && !row.regularPrice
      ).length;
      emit("quote_input_completed", {
        inputMethod,
        rowCount: analysisRows.length,
        missingPriceRowCount: missingPriceRows,
```

`pc-quote-builder/src/lib/csvParser.js:184-205`:

```js
export const parsePriceCsv = (text) => {
  const { headers: rawHeaders, rows } = parseCsv(text);
  ...
  const headers = rawHeaders.map((h) => h.toLowerCase());
  const idxId = headers.findIndex((h) => h.includes("id"));
  ...
  if (idxId === -1) throw new Error("El CSV debe tener columna id");
```

Reproduced: header `Cantidad,ID,Precio Oferta,Precio Normal,Tienda` selects the
`Cantidad` cell as the id. Note the file already has an exact-match helper:
`findColumnIndex(headers, candidates)` at `csvParser.js:130-134`, which
normalizes accents/punctuation.

`pc-quote-builder/src/lib/quoteAnalyzer/report.js:284-286`:

```js
    if (result.status === "fail") {
      const fieldInferred = (selection.pcCase.formFactorEvidence ?? "unknown") === "unknown";
      const { source, confidence } = evidenceFor(["mobo", "pcCase"], userMappedKeys, "catalog", fieldInferred);
```

`evidenceFor` (`report.js:79-85`) lowers to `medium` when `fieldInferred` is
true. `docs/design/quote-analyzer.md:210-212` states: "`confidence` is derived
from evidence completeness: both sides present → high; one side present and
other confirmed by user → medium; inferred catalog fields → low/medium as
applicable." CPU memory type (`report.js:206`) and motherboard memory type
(`report.js:259`) already pass `!…Explicit`.

`pc-quote-builder/src/components/QuoteAnalyzer/session.js:59-79` —
`analysisSignature` fingerprints `quote.id`, row fields, context fields,
mappings, exclusions, and `catalogSignature`, but not `quote.currency` or
`quote.priceUpdatedAt`. `report.js:122-123` reads both, and
`QuoteAnalyzer.jsx:75-79` gates `isCurrent` on the signature.

## Commands you will need

| Purpose | Command | Provenance | Expected on success |
|---|---|---|---|
| Install | `npm ci` (in `pc-quote-builder/`) | declared | exit 0 |
| Focused tests | `npm test -- report csvParser session QuoteAnalyzer` | declared | all pass |
| Full tests | `npm test` | executed | all pass |
| Lint | `npm run lint` | executed | exit 0 |
| Assurance conformance | `npm run test:assurance` (plan 037) | declared | exit 0 |

**Provenance**: `executed` = run by the advisor during recon; `declared` = read
from `package.json`, not run.

## Scope

**In scope**:
- `pc-quote-builder/src/lib/quoteAnalyzer/report.js`
- `pc-quote-builder/src/lib/csvParser.js`
- `pc-quote-builder/src/components/QuoteAnalyzer/session.js`
- `pc-quote-builder/src/components/QuoteAnalyzer/QuoteAnalyzer.jsx`
- Tests: `pc-quote-builder/src/lib/quoteAnalyzer/report.test.js`,
  `pc-quote-builder/src/components/QuoteAnalyzer/session.test.js`,
  `pc-quote-builder/src/components/QuoteAnalyzer/QuoteAnalyzer.test.jsx`,
  `pc-quote-builder/src/lib/csvParser.test.js`

**Out of scope**:
- `pc-quote-builder/src/lib/money.js` — CLP decimal parsing is a separate
  product call (see "Considered and rejected" in `plans/README.md`).
- `pc-quote-builder/src/lib/compatibility.js`, `scripts/lib/compiler.js`
  (plan 038).
- `App.jsx` and `fileIO.js` (plans 040/044).
- Any change to `analysisSignature` fields beyond the two named ones.

## Git workflow

- Branch: `advisor/039-quote-quality-defects`
- Commits: `039: <imperative summary>`.
- Do NOT push or open a PR.

## Steps

### Step 0: Establish a green baseline

From `pc-quote-builder/`: `npm ci`, `npm run lint`, `npm test` — all exit 0.
Record the test summary. If any fails on the unmodified checkout, STOP.

### Step 1: Ignore empty rows in price completeness

In `report.js`, import `isRowEmpty` from `../quoteModel` and filter blank rows
out of the price loop:

```js
import { isRowEmpty } from "../quoteModel";
...
const rows = (Array.isArray(quote?.rows) ? quote.rows : []).filter((row) => !isRowEmpty(row));
```

Apply the same filter where `rows.length` feeds the `price-completeness-rows`
condition and `priceCompletenessStatus` so an all-empty quote does not warn.
Do not change the `price-freshness-*` findings for empty quotes.

In `QuoteAnalyzer.jsx:167-173`, compute the measurement from non-empty rows
only:

```js
const measurableRows = analysisRows.filter((row) => !isRowEmpty(row));
const missingPriceRows = measurableRows.filter(
  (row) => !row.offerPrice && !row.regularPrice
).length;
// rowCount: measurableRows.length
```

Import `isRowEmpty` from `../../lib/quoteModel` if not already imported.

**Verify**: `npm test -- report` passes including a new test that a fully
resolved quote plus one `createEmptyRow()` yields no `price-completeness-rows`
finding and `priceCompletenessStatus === "ok"`.

### Step 2: Detect the price-CSV id column exactly before falling back

Rewrite the id detection in `parsePriceCsv` to prefer exact normalized header
candidates and only then fall back to substring matching, excluding known
false-positive words. `findColumnIndex` already exists in the same file:

```js
let idxId = findColumnIndex(rawHeaders, ["id", "itemid", "idproducto", "catalogid", "sku"]);
if (idxId === -1) {
  idxId = headers.findIndex((h) => h.includes("id") && !/cantidad|unidad|medida|validez/.test(h));
}
if (idxId === -1) throw new Error("El CSV debe tener columna id");
```

Keep the existing `idxOffer`/`idxNormal`/`idxStore` substring logic unchanged.
Leave `parseCsvToQuote` and the paste parser untouched.

**Verify**: `npm test -- csvParser` passes including a new case: headers
`Cantidad,ID,Precio Oferta,Precio Normal,Tienda` map prices by the `ID` cell
(assert the parsed `id` is `item-1`, not `1`).

### Step 3: Lower confidence for inferred case form factors

In `report.js` line ~285, treat any non-explicit evidence as inferred:

```js
const fieldInferred = (selection.pcCase.formFactorEvidence ?? "unknown") !== "explicit";
```

Keep the severity `critical` and the status `fail`; only `confidence` changes
to `medium` for inferred cases. Do not touch the `compat-mobo-case-ff`
`unknown` branch at lines 299-308.

**Verify**: `npm test -- report` passes including a new test asserting an
inferred-evidence failing case yields `confidence: "medium"` and an explicit
one yields `"high"`.

### Step 4: Include currency and price freshness in the analysis signature

In `session.js`, extend `analysisSignature`'s array with:

```js
quote?.currency,
quote?.priceUpdatedAt,
```

Place them next to the other quote fields (before `catalogSignature`). No other
call-site changes are needed; `QuoteAnalyzer.jsx` already passes the full
`quote` object.

**Verify**: `npm test -- session` passes including two new cases: changing
`quote.currency` invalidates a prior signature, and changing
`quote.priceUpdatedAt` invalidates it.

## Test plan

- `report.test.js` (fixtures from `src/test/fixtures.js`, `row()` helper at the
  top): blank-row quote → no price warning, `priceCompletenessStatus === "ok"`;
  blank row present alongside real unpriced row → warning still fires for the
  real row only; inferred case FF fail → `confidence: "medium"`; explicit case
  FF fail → `"high"`.
- `csvParser.test.js`: `Cantidad` before `ID`; `ID` only; `itemid`; no id
  column → throws.
- `session.test.js` (signature tests at `:89-109`): currency change and
  `priceUpdatedAt` change each invalidate; `rows`-only changes still work.
- `QuoteAnalyzer.test.jsx`: with a measurement spy, a quote containing one
  empty row emits `quote_input_completed` with `rowCount` excluding the empty
  row (assert exact numbers).

**Verification**: `npm test` → all pass; `npm run test:assurance` → still pass.

## Done criteria

ALL must hold:

- [ ] `npm run lint` exits 0
- [ ] `npm test` exits 0, including the new cases
- [ ] `npm run test:assurance` exits 0 (or reported as not yet added)
- [ ] `rg -n "unpricedRowIds" pc-quote-builder/src/lib/quoteAnalyzer/report.js`
      shows the loop now filters with `isRowEmpty`
- [ ] `rg -n "currency|priceUpdatedAt" pc-quote-builder/src/components/QuoteAnalyzer/session.js`
      shows both in the signature array
- [ ] `plans/README.md` status row updated
- [ ] `git diff --name-only 6cde4b8...HEAD` lists only in-scope files

## STOP conditions

Stop and report back (do not improvise) if:

- Current-state excerpts do not match the live files.
- The assurance suite (`npm run test:assurance`) fails after a change — a
  pinned supported-rule outcome moved; report the failing case instead of
  editing assurance fixtures.
- Removing blank rows from the price loop changes any non-price dimension in
  an unexpected way (report the snapshot).
- Fixing the CSV header needs changes to `parseCsvToQuote` or the paste parser.

## Maintenance notes

- Any new field consumed by `buildReport` from `quote` must be added to
  `analysisSignature`, or stale-analysis detection silently misses it. The
  maintenance-safe rule: signature fields = every quote field the report
  reads.
- The blank-row filter must stay consistent between `report.js` and the
  `quote_input_completed` emission; both use `isRowEmpty`.
- Reviewer should scrutinize: inferred-confidence change is label-only (no
  lost findings); no change to `money.js` or CLP behavior.
- **Deferred**: CLP decimal-notation parsing (`parsePrice("12990.00","CLP")` →
  `1,299,000`) is a product call recorded in `plans/README.md` under
  "considered and rejected"; it is not fixed here.
- **Completion (2026-09-25)**: implemented `d066a91`, reviewed and merged as
  `ca11b8e`. Review confirmed the four fixes are minimal; the
  inferred-confidence change is label-only (severity `critical`, status `fail`
  unchanged), and assurance remains 44/44 with zero critical false negatives.
  Full suite on the branch: 988 passing / 27 todo; 11 new tests.
