# Plan 013: Make quote currency, totals, completeness, and freshness trustworthy

> **Executor instructions**: This changes money semantics. Read `docs/PRODUCT_VISION.md`, preserve imported data compatibility, and stop if separator interpretation cannot be made deterministic.
>
> **Drift check (run first)**: `git diff --stat fabeb49..HEAD -- pc-quote-builder/src/App.jsx pc-quote-builder/src/App.test.jsx pc-quote-builder/src/lib/csvParser.js pc-quote-builder/src/lib/csvParser.test.js`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `012-characterize-app-workflows.md`
- **Category**: bug
- **Planned at**: commit `fabeb49`, 2026-07-29

## Why this matters

Typing a custom currency crashes on its first one- or two-letter intermediate value. Common Chilean values such as `1.234.567` are accepted but total as roughly `1.234`; rows with only offer or regular price can show misleading savings and be called complete; unrelated price imports refresh the quote timestamp. These outputs directly influence purchase decisions and must not imply precision or freshness the data does not support.

## Product-governance checklist

- **Problem/users/value**: quote editors need correct totals and honest price freshness; this improves price intelligence, data completeness, and confidence.
- **Evidence/uncertainty**: parsing is deterministic software behavior; ambiguous separators must be rejected or shown as unresolved, never guessed silently.
- **Explanation/precision**: show which fields are missing/invalid; no universal score or commercial ranking is introduced.
- **Failure paths**: malformed imports, unsupported currency codes, partial rows, zero matches, zero/owned items, and conflicting separators must remain recoverable.
- **Freshness/provenance**: update freshness only for meaningful matched price changes; preserve prior timestamps otherwise.
- **Beginner/expert**: presets remain simple; experts retain validated custom ISO-style codes.
- **Cost/value**: one centralized money model replaces divergent parsing; tests prove totals and statuses.

## Current state

```jsx
// App.jsx:403-405
const offer = parseFloat(row.offerPrice) || 0;
const regular = parseFloat(row.regularPrice) || 0;
```

`handleCurrencyChange` immediately commits partial text; `priceUpdatedAt` is set for any price keystroke and any non-empty import list.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| Target | `cd pc-quote-builder && npm test -- money App csvParser` | all pass |
| Gate | `cd pc-quote-builder && npm run check` | exit 0 |

## Scope

**In scope**: create a pure money/quote-totals module under `src/lib/`, update `App.jsx`, App and library tests, CSV price normalization if necessary.

**Out of scope**: exchange-rate conversion, per-store recommendations, automated price feeds, database storage, redesigning the entire quote UI.

## Git workflow

- Branch: `advisor/013-correct-quote-money-semantics`
- Commit example: `013: make quote money semantics explicit`.

## Steps

1. Define a pure normalized money parser and result type (`valid`, `missing`, `invalid/ambiguous`) for supported input formats. Document separator rules by currency/locale and preserve original display text where practical.
2. Extract totals/completeness calculation. Savings are calculable only from rows with both comparable values; partial data must be reported separately rather than treated as zero.
3. Keep custom-currency draft text separate from the committed formatter currency. Validate before commit and safely normalize malformed imported values to an explicit fallback/error state.
4. Change manual/import freshness updates to count meaningful price changes. A zero-match or empty-value import must retain the prior timestamp and report the result.
5. Update the UI copy so price completeness, freshness, invalid values, and calculable savings are distinct.
6. Convert plan-013 App `.todo` cases and run the full gate.

## Test plan

Cover `1234567`, `1.234.567` CLP, supported decimal examples for USD/EUR, ambiguous multiple separators, empty and zero values, offer-only, regular-only, both prices, invalid currency drafts/imports, matched unchanged prices, meaningful matches, and zero matches.

## Done criteria

- [x] Custom currency can be typed without any render exception.
- [x] Locale examples produce exact expected numeric totals.
- [x] Partial rows never create false savings or complete status.
- [x] Zero-match imports do not update freshness.
- [x] Full gate passes.

## Completion

- **Completed**: 2026-07-29 (working tree, uncommitted)
- **Summary**: Created `src/lib/money.js` with `parsePrice` (currency-aware parser), `computeTotals` (savings only from rows with both prices), and `normalizeCurrency`. Added `src/lib/money.test.js` (35 tests covering CLP/USD/EUR formats, ambiguous separators, partial rows, zero-match imports). Updated `App.jsx`: replaced `parseFloat` → `parsePrice`/`computeTotals`, added `currencyDraft` state to keep draft text separate from committed currency (no crash on partial codes), removed comma-to-dot sanitization from `handleRowChange`, and added zero-match guard in `handleImportPrices` to preserve prior `priceUpdatedAt`. Updated existing price sanitization tests. All gates pass (234 tests, lint 0, build ok).

## STOP conditions

- Existing exported/imported files demonstrate conflicting separator conventions that cannot be distinguished.
- Correct behavior requires silently changing stored monetary values.
- A product decision is needed on whether zero means “free” or “owned”; report options instead of assuming.

## Maintenance notes

All future price inputs must use the centralized parser and totals model. Do not reintroduce `parseFloat` at UI or import boundaries.
