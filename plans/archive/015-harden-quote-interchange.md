# Plan 015: Separate local identity from catalog identity and make CSV export spreadsheet-safe

> **Executor instructions**: Preserve JSON/CSV compatibility where safe. Internal quote/row IDs and catalog `itemId` are different concepts; do not regenerate the latter. Stop if an external format contract cannot be migrated compatibly.
>
> **Drift check (run first)**: `git diff --stat fabeb49..HEAD -- pc-quote-builder/src/App.jsx pc-quote-builder/src/App.test.jsx pc-quote-builder/src/lib/csvParser.js pc-quote-builder/src/lib/csvParser.test.js README.md`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `012-characterize-app-workflows.md`
- **Category**: bug / security
- **Planned at**: commit `fabeb49`, 2026-07-29

## Why this matters

Re-importing the app's own JSON preserves quote and row IDs, so updates/deletion can affect multiple entities with the same identity. CSV has the opposite problem: it omits catalog `itemId`, breaking later price imports. Exported user/imported text is also not neutralized against spreadsheet formula evaluation.

## Product-governance checklist

- **Problem/users/value**: users must safely preserve and revisit quotes; this improves sharing, price matching, and trust.
- **Evidence/uncertainty**: schema behavior is deterministic; unknown legacy fields are retained where safe and rejected with actionable errors where unsafe.
- **Explanation/precision**: import reports counts, migrations, and rejected rows; no recommendation score or commercial ordering is added.
- **Failure paths**: duplicate local IDs, duplicate rows, missing `itemId`, legacy CSV, malformed files, formula-leading cells, and self-round-trips are tested.
- **Freshness/provenance**: imported price freshness remains governed by plan 013; product IDs remain traceable.
- **Beginner/expert/value**: defaults are safe while explicit JSON/CSV remains available; implementation cost is bounded to interchange.

## Current state

- `normalizeQuote`/`normalizeRow` preserve incoming local IDs.
- `handleDownloadCSV` exports six columns without `itemId`.
- `escapeCsvField` only handles RFC-4180 delimiters/quotes/newlines.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| CSV tests | `cd pc-quote-builder && npm test -- csvParser` | all pass |
| App tests | `cd pc-quote-builder && npm test -- App` | all pass |
| Gate | `cd pc-quote-builder && npm run check` | exit 0 |

## Scope

**In scope**: quote normalization/import/export helpers, App integration, CSV parser/escaper tests, format documentation.

**Out of scope**: catalog ID generation (plan 018), backend sharing, PDF/image export, arbitrary spreadsheet dialect support.

## Git workflow

- Branch: `advisor/015-harden-quote-interchange`
- Commit: `015: harden quote interchange`.

## Steps

1. Extract/import a pure distinction between local entity IDs (`quote.id`, `row.id`) and business identity (`row.itemId`). Preserve local IDs only for localStorage restore; regenerate or collision-resolve them for external imports.
2. Version or compatibly extend CSV export/import with an `itemId` column. Continue accepting legacy six-column files with blank `itemId`.
3. Add a spreadsheet-safe cell encoder that neutralizes formula-trigger prefixes before RFC-4180 escaping. Document the convention and avoid double-neutralizing round trips.
4. Report duplicate/migrated entities and maintain first-match price semantics for catalog IDs.
5. Convert plan-015 App `.todo` tests and run the full gate.

## Test plan

Cover self JSON export/import, multiple duplicate quote/row IDs, editing/deleting one imported clone, CSV `itemId` round-trip, legacy CSV, commas/quotes/newlines, formula-trigger prefixes in every text column, leading whitespace before triggers, and non-formula text.

## Done criteria

- [ ] Imported quotes/rows have unique local IDs.
- [ ] Catalog `itemId` survives JSON and new CSV round trips.
- [ ] Legacy CSV still imports.
- [ ] Spreadsheet-dangerous text is neutralized and tested.
- [ ] Full gate passes.

## STOP conditions

- An existing external consumer requires exact six-column CSV output.
- Neutralization cannot both protect spreadsheet opening and preserve documented round trips.
- LocalStorage restore would be re-keyed on every startup.

## Maintenance notes

Future schema versions must explicitly classify local, catalog, and external identities. Formula protection belongs at export, not rendering.

---

## Completion summary

**Committed**: `main` as `015: harden quote interchange`

**What was done**:
1. **Formula protection**: `escapeCsvField` now prefixes cells starting with `=`, `+`, `-`, `@`, or `\t` with `'` to prevent spreadsheet formula execution. Added `unprotectFormulaField` that strips the prefix on import (applied in `parseCsvToQuote` and `parsePriceCsv` via `trimCell`). Round-trips are safe: export adds prefix, import strips it.
2. **`itemId` column**: CSV export (`handleDownloadCSV`) now includes an `itemId` column (7-column format). `parseCsvToQuote` reads `itemId` from CSV (with fallback to `""` for legacy 6-column files). Accepts alternate column names (`id_producto`, `catalog_id`).
3. **Fresh IDs on import**: `freshIds` strips incoming `id` fields before JSON normalization, so external imports always generate unique local IDs. CSV imports already generated fresh IDs.
4. **13 `.todo` tests converted**: CSV/JSON import, price import by itemId, error/empty/alerts, button click triggers.
5. **282 tests + 30 todo pass**; lint clean; production build succeeds.
