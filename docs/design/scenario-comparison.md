# Scenario Comparison: multi-quote comparison and upgrade scenarios

> **Status**: Plan 026 design deliverable, 2026-07-30. Design/data spike — no production comparison UI or winner logic was implemented or authorized by this document.
>
> **Governance**: Read together with the Canonical Product Vision, `docs/design/quote-analyzer.md` (shared assessment contract), and `docs/design/builder-modes.md` (intent and priorities). Comparison consumes the same analyzer outputs as individual quotes; it never forks recommendation semantics into a second engine.

## 1. Problem and users

The app already stores, switches, duplicates, and deletes multiple quotations (`usePersistence`: `quotes`, `activeQuoteId`; `handleAddQuote`/`handleDuplicateQuote`/`handleDeleteQuote`), but renders totals, store breakdown, price freshness, and assessment for **only** the active quote (`activeQuote` derived at `App.jsx:97-100`; `totals`/`storeTotals` at `App.jsx:244-271`). A buyer comparing two store offers, or deciding between a repair/upgrade and a new PC, must switch tabs and hold the differences in their head.

The vision requires comparing configurations, marking owned components, and comparing upgrades with a new PC. This design defines the shared scenario model and comparison dimensions, exposing trade-offs and uncertainty rather than declaring a winner from total price alone.

## 2. Current-state facts (verified 2026-07-30)

| Fact | Evidence |
|---|---|
| Quote model | `{ id, name, currency, priceUpdatedAt, rows }`; rows `{ id, category, product, itemId, store, offerPrice, regularPrice, notes }` (`quoteModel.js:19-53`) |
| Currency is per-quote | `normalizeQuote` keeps `currency` (default CLP); `App.jsx:162-167` syncs currency draft to active quote |
| Builder is global, not per-quote | single `builder` state in `usePersistence`; `buildRowsFromSelection` materializes rows into the active quote |
| Totals never treat missing prices as zero | `computeTotals` sums only `parsePrice(...).status === "valid"` rows and counts `rowsWithPrice` (`money.js:66-91`); "Faltan precios" status when partial (`App.jsx:282-299`) |
| Freshness is per-quote | 14-day staleness on `priceUpdatedAt` (`App.jsx:273-305`) — same rule as analyzer fixture F6 |
| Assessment engine | `evaluateSelection` (builder) and the designed analyzer contract (`quote-analyzer/input|output/v1`) share the same `compatibility.js` checks |
| No owned-part model | nothing marks a row as user-owned/reused |

## 3. Scenario wrapper — `scenario-comparison/input/v1`

A scenario is the unit of comparison. It wraps the analyzer input contract (§4.1 of the analyzer design) plus the data the comparison needs and the analyzer does not produce.

```
scenario = {
  id: string,                                  // stable, derived from quote id
  label: string,                               // "Tienda A", "Upgrade", "PC nuevo"
  quoteSnapshot: {                             // deep copy of normalizeQuote output
    id, name, currency, priceUpdatedAt, rows
  },
  intent: {                                    // mirrors analyzer userContext
    useCase, targetResolution, budget, usesIntegratedGpu
  } | null,
  ownedPartRowIds: string[],                   // rows reused from a previous PC
  assessedAt: string,                          // when this scenario was last analyzed
  catalogProvenance: { generatedAt, schemaVersion }  // catalog version used for assessment
}
```

Rules:

- The **quoteSnapshot is immutable for the comparison**; editing a quote does not mutate open comparisons. Comparison re-runs on demand ("Actualizar análisis") and stamps a new `assessedAt`.
- `ownedPartRowIds` reference rows inside the snapshot. Owned rows are **excluded from acquisition cost** but **remain in compatibility/performance assessment** (they are physically part of the build).
- Currency comes from the snapshot. A comparison group is a set of scenarios sharing one currency; a scenario whose currency differs from the group is marked incomparable for price dimensions (§5).
- `catalogProvenance` must be identical across a comparison group, otherwise cross-scenario assessment is flagged `unknown` for catalog-dependent dimensions.

## 4. Comparison output — `scenario-comparison/output/v1`

```
comparison = {
  schemaVersion: "scenario-comparison/output/v1",
  scenarios: [ { scenarioId, label, currency, verdict, dimensions, cost, gaps } ],
  deltas: {
    componentDiff: [ { category, role, rows: [ { scenarioId, itemId, label } ] } ],  // aligned by category
    dimensionTable: [ { dimension, perScenario: { [scenarioId]: DimensionOutcome }, comparable: boolean, notComparableReason? } ],
    acquisitionCost: { perScenario: { [scenarioId]: CostSummary }, comparable: boolean }
  },
  hasWinner: false,                            // never true in v1
  priorities: [ ... ] | null                   // explicit user priorities, ordering aid only
}

CostSummary = {
  pricedRows: number, totalRows: number,
  pricedTotal: number,                         // sum of valid offer prices (regular fallback)
  ownedRowsExcluded: number,
  missingPriceRows: number                     // never counted as zero
}
```

- `hasWinner` is a constant `false` in v1. Any "better for X" statement requires an explicit user priority and renders as a **preference-dependent explanation**, never a score (checklist: no opaque winner/score; no hidden weighting).
- `dimensionTable` reuses the analyzer's seven dimensions (compatibility, completeness, power, connectors, caseFit, priceFreshness, priceCompleteness) plus the derived `acquisitionCost` row. Dimensions the analyzer marks `unknown` stay `unknown` in comparison; they are never re-scored.
- `componentDiff` aligns rows by category using the same normalized category mapping the builder and analyzer use. Items with identical `itemId` are "same"; otherwise a label diff (name + distinguishing specs) is shown. No product ranking.

## 5. Incomparability rules (failure paths)

| Case | Behavior |
|---|---|
| Different currencies in the group | Price-related dimensions (`acquisitionCost`, `priceFreshness`, `priceCompleteness`) → `unknown` with `notComparableReason: "monedas distintas"`. Non-price dimensions still compare. **No exchange-rate conversion in v1** (owner decision §9.1). |
| Different `catalogProvenance.generatedAt` | Catalog-dependent dimensions → `unknown` with reason; the design recommends forcing a re-analysis with one catalog version. |
| Different intent (`useCase`/`targetResolution`) | Comparison allowed but the summary shows "distintos objetivos de uso" and the intent per scenario; verdicts are not cross-compared as apples-to-apples. |
| Missing prices in one scenario | `acquisitionCost.pricedTotal` is labeled partial (`pricedRows/totalRows`); never zero, never presented as complete (`computeTotals` semantics preserved). |
| Unmatched text rows (analyzer resolution gap) | Those rows are excluded from `componentDiff` alignment and flagged in that scenario's `gaps`; assessment for affected dimensions is `unknown`. |
| Owned rows with missing prices | Excluded from cost entirely (no price needed — already owned); still assessed for compatibility. |
| More than two scenarios | Multi-scenario view (§7) with pairwise subset selection; dimension table supports N columns. |

## 6. Acquisition cost and upgrade treatment

- `acquisitionCost` = sum of valid offer prices (regular as fallback) over **non-owned** rows only. `ownedRowsExcluded` counts what was removed.
- Missing-price rows are counted (`missingPriceRows`) and excluded from the sum, never treated as zero.
- **Upgrade scenario**: a scenario whose `ownedPartRowIds` is non-empty and whose snapshot contains new rows. Its cost is the *delta* spend (new parts). Its compatibility assessment includes owned parts — so an upgrade that reuses an incompatible mobo/PSU fails honestly rather than hiding the reused part.
- A "PC nuevo" scenario is the same model with `ownedPartRowIds: []` — the natural baseline for the vision's "upgrade vs new PC" question.

## 7. UX wireflow

1. **Entry**: with ≥2 quotes, a "Comparar" control appears in the quote header; selecting it pre-selects the active quote + the previously active quote.
2. **Summary strip**: one line per scenario — name, verdict chip, acquisition cost (or "sin precio"), freshness chip. No winner highlight.
3. **Priority selector** (collapsible): the builder-modes priority set (performance, silence, appearance, efficiency, compact, upgradeability); selects ordering of the summary strip and highlights the top dimension per scenario. Preference-dependent, always labeled as such.
4. **Dimension table**: rows = dimensions, columns = scenarios; each cell shows status + one-line summary + evidence freshness. `unknown` cells render as "no verificable (razón)".
5. **Component diff**: category-aligned table with same/different badges and per-scenario specs; owned rows marked "Reutilizada".
6. **Actions**: export the comparison (JSON/CSV snapshot), apply a scenario's rows to the active quote, or open a scenario in the Expert Builder (handoff keeps intent, per builder-modes §5).
7. Expert users can edit scenarios directly (change quote, mark owned rows) without going through a questionnaire (beginner/expert checklist).

## 8. Fixtures and acceptance criteria

Fixtures (deterministic, from the plan's test plan):

| Fixture | Expected output |
|---|---|
| F1 same build, two stores | Cost differs; all other dimensions equal; no winner |
| F2 cheaper but stale | Stale scenario shows freshness warning; cost still lower; no winner; stale dimension `unknown`-safe |
| F3 upgrade with owned parts | Owned rows excluded from cost, included in compat; upgrade cost = delta |
| F4 incompatible cheaper option | Fail dimension + lower cost both visible; no winner; fail not hidden by price |
| F5 different currencies | Price dims `unknown` with `monedas distintas`; non-price dims compare |
| F6 missing prices | Partial cost labeled `pricedRows/totalRows`; never zero |
| F7 three+ scenarios | N-column table; pairwise subset selection works |

Acceptance invariants: no `hasWinner: true` output in any fixture; incomparable dimensions never re-scored; owned parts never in cost and never out of assessment; missing prices never zero; identical snapshots + same catalog → identical comparison (pure).

Analytics/success questions (design-level, to be instrumented in Phase C):

- What share of sessions with ≥2 quotes opens comparison?
- Of those, what share completes a decision action (apply rows, export, or open in Expert Builder)?
- What share of comparisons renders all price dimensions comparable (freshness + completeness), i.e., how often do missing prices/staleness block cost comparison?
- What share of comparisons involve an upgrade scenario (owned rows)? Do those users complete the "nuevo vs upgrade" decision?

## 9. Open decisions for the project owner

1. **Currency conversion in v1** (STOP condition): recommended **no conversion** — mixed-currency groups mark price dimensions incomparable; conversion is deferred with the exchange-rate API explicitly out of scope (requires owner approval).
2. **Owned-part model**: row-level `ownedPartRowIds` on scenarios (recommended) vs a separate parts library.
3. **Upgrade baseline**: "PC nuevo" = empty owned parts (recommended) vs requiring an explicit current-PC snapshot.
4. **Priorities**: reuse the builder-modes §8 priority set verbatim (recommended) vs a comparison-specific set.
5. **No-winner guarantee**: confirm `hasWinner` stays false in v1 even with explicit priorities (recommended).

## 10. Phased implementation backlog (future plans, owner-approved only)

| Phase | Contents | Gate |
|---|---|---|
| A | Quote-level comparison panel using **existing** `evaluateSelection` + `computeTotals`: component diff, cost diff (no owned parts), freshness chips | none beyond current engine — production-safe today |
| B | Analyzer-contract comparison: scenario wrapper, seven dimensions, incomparability rules | analyzer contract in production (Plan 024 implementation) |
| C | Owned parts + upgrade scenarios + priority selector + analytics | Phase B |
| D | Export/apply actions and Expert Builder handoff | Phase C (align with builder-modes Phase C) |

No phase introduces a winner score; Phase B+ consumes the analyzer's `output/v1` without modifying it (the analyzer contract is versioned; comparison is a consumer).

## 11. STOP-condition review

- **Analyzer contract unavailable/unsuitable**: contract exists in `docs/design/quote-analyzer.md` §4 and is suitable — comparison consumes its output verbatim. Production phases are gated on its implementation (Phase A works with the current engine).
- **Owner has not chosen whether currency conversion belongs in v1**: not chosen — surfaced as §9.1 with a recommended default, not silently resolved. Conversion is out of v1 scope pending approval.
- **Hidden weighting / unsupported performance claims**: none — no winner, no score, priorities preference-dependent, performance claims only from catalog tiers with `confidence`/`decisionType` labels.

## 12. Scope boundaries (unchanged from plan)

Out of scope: production UI, accounts/cloud sharing, exchange-rate API, automated prices, universal winner score, professional CRM features. This document is a design; implementation requires new owner-approved plans.
