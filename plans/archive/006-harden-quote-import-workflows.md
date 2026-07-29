# Plan 006: Characterize and harden quote import workflows

> **Executor instructions**: Preserve the current Spanish labels and file formats unless a test proves a defect. Update the plan index on completion.
>
> **Drift check**: `git diff --stat 63ecbca..HEAD -- pc-quote-builder/src/App.jsx pc-quote-builder/src/components/TypeaheadSelect.jsx pc-quote-builder/src/hooks/useCatalog.js pc-quote-builder/src/**/*.test.*`

## Status

- **Priority**: P2; **Effort**: M; **Risk**: LOW; **Depends on**: `001-green-verification-gate.md`
- **Category**: tests
- **Planned at**: commit `63ecbca`, 2026-07-29
- **Completed at**: commit `2fa039f`, 2026-07-29

### Completion summary

- Created `src/lib/csvParser.js` with an RFC-4180 state-machine parser (handles quoted newlines, escaped quotes, \r\n/\n/\r endings) and extracted inline `escapeCsvField`, `parsePriceJson`
- Replaced `items.find()` O(n²) in `handleImportPrices` with a `buildPriceMap()` Map-based O(1) lookup; first-match-wins semantics preserved
- Wrote 40 csvParser unit tests covering round-trip (commas, quotes, newlines), price CSV (many items, duplicate IDs, edge cases), and import semantics
- Wrote 4 App characterization tests covering startup restore (empty, valid, corrupt localStorage) and button rendering
- All 131 tests pass, lint clean, build succeeds

## Why this matters

The primary quote workflow is concentrated in `App.jsx` but has no app-level coverage. It also exports quoted multiline CSV fields then imports by splitting on newlines, which corrupts its own valid output; price import linearly scans every supplier item for every quote row.

## Current state

`App.jsx:320-342` persists quote/builder state independently. Lines 586-691 export CSV, while 595-652 split it by line. Lines 726-746 import quote files; 789-820 imports prices and uses `items.find` inside `rows.map`. Existing test style is Vitest + Testing Library in `src/components/TypeaheadSelect.test.jsx`.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| Target tests | `cd pc-quote-builder && npm test -- App quote` | all matching tests pass |
| Gate | `cd pc-quote-builder && npm run check` | exit 0 |

## Scope

Modify `App.jsx`, create App/data-loader/use-catalog tests, and add one small CSV parser dependency only if no existing complete parser can be reused safely. Do not create a backend, change JSON envelope compatibility, or change CSV headers.

## Steps

1. Add characterization tests with mocked `fetch`, `File`, `localStorage`, and browser download APIs: startup restore, builder-to-quote rows, JSON import, CSV import, ID-based price application, remote catalog failure, and reload success.
2. Replace line-based CSV parsing with an RFC-4180-capable complete-stream parser. It must support escaped quotes and quoted newline fields emitted by `escapeCsvField`; use the same parser for price CSV if appropriate. Keep headers and totals-line omission compatible.
3. Before mapping quote rows, create an ID-to-price `Map` that preserves today's first matching non-empty item behavior. Use constant-time lookup per row.

## Done criteria

- [ ] An export/import test preserves a notes field containing comma, quote, and newline.
- [ ] Price-import test covers many input items and duplicate ID semantics.
- [ ] Fallback/reload and persistence behavior are covered.
- [ ] `npm run check` exits 0.

## STOP conditions

Stop if existing external CSV files rely on non-RFC dialect behavior that conflicts with correct quoted-newline support; provide sample-driven compatibility options instead.

## Maintenance notes

Keep import parsing isolated from rendering. Any future schema version must have an import migration test before release.
