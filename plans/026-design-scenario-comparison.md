# Plan 026: Design multi-quote comparison and upgrade scenarios

> **Executor instructions**: This is a design spike. Do not implement a totals-only winner or imply a quote is better without shared, explainable dimensions. Read the canonical vision and the approved Quote Analyzer design first.
>
> **Drift check (run first)**: `git diff --stat fabeb49..HEAD -- docs/PRODUCT_VISION.md docs/design README.md pc-quote-builder/src/App.jsx pc-quote-builder/src/lib/selectionEvaluation.js`

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: `013-correct-quote-money-semantics.md`, `014-preserve-assessment-severity.md`, `024-design-quote-analyzer.md`
- **Category**: direction
- **Planned at**: commit `fabeb49`, 2026-07-29

## Why this matters

The app already stores, switches, and duplicates multiple quotations but renders totals and assessment for only the active quote. The vision explicitly calls for comparing configurations, marking owned components, and comparing upgrades with a new PC. A shared scenario model is adjacent to current state, but it must expose trade-offs and uncertainty rather than declare a winner from total price alone.

## Product-governance checklist

- **Problem/users/value**: buyers choosing between builds/upgrades need component differences, acquisition cost, compatibility, freshness, balance, and upgrade trade-offs.
- **Evidence/uncertainty**: comparison displays each dimension's evidence/confidence and missing data; incomparable dimensions remain unknown.
- **Explanation/precision**: no opaque winner/score; any preference is derived from explicit user priorities.
- **Commercial bias**: no retailer/affiliate weighting.
- **Failure paths**: different currencies, stale dates, missing prices, unmatched parts, owned items, differing use cases, and more than two scenarios.
- **Freshness/provenance**: price snapshots and catalog versions remain per scenario.
- **Beginner/expert**: concise summary plus detailed diff; manual scenario editing remains available.
- **Tests/acceptance**: fixtures prove fair comparison, no-winner states, and upgrade cost treatment.

## Current state

`App.jsx:801-821` supports multiple quotes/duplication. `App.jsx:1247-1301` renders totals/store data only for `activeQuote`; quotes have no owned-part or shared-intent model.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| Baseline | `cd pc-quote-builder && npm test` | all pass |
| Design checks | local Markdown link check and `git diff --check` | exit 0 |

## Scope

**In scope**: create `docs/design/scenario-comparison.md`; define scenario/snapshot/owned-part schema, comparison dimensions, UX wireflow, edge cases, staged implementation plan.

**Out of scope**: production UI, accounts/cloud sharing, exchange-rate API, automated prices, universal winner score, professional CRM features.

## Git workflow

- Branch: `advisor/026-design-scenario-comparison`
- One design commit; no production implementation.

## Steps

1. Reuse the approved analyzer assessment contract and define a scenario wrapper with quote snapshot, intent, owned parts, currency, timestamp, and catalog provenance.
2. Define component-level diff and multidimensional comparison behavior, including when dimensions are incomparable.
3. Define acquisition cost: owned parts are excluded from spend but remain included in compatibility/performance assessment; never treat missing prices as zero.
4. Design two-scenario and multi-scenario views with explicit user priorities and no automatic overall winner.
5. Specify fixtures, acceptance criteria, analytics/success questions, and phased implementation slices.

## Test plan

Design fixtures: same build/different stores, cheaper but stale, upgrade using owned parts, incompatible cheaper option, different currencies, missing prices, and three-plus scenarios. Define expected dimension-by-dimension outputs.

## Done criteria

- [ ] `docs/design/scenario-comparison.md` answers the full checklist.
- [ ] Scenario, snapshot, owned-part, and comparison contracts are explicit.
- [ ] No totals-only winner or missing-price-as-zero behavior.
- [ ] Fixtures, wireflow, acceptance criteria, and implementation slices exist.

## STOP conditions

- Quote Analyzer contract is unavailable or unsuitable as the shared dimension model.
- Owner has not chosen whether currency conversion belongs in v1.
- Comparison requires hidden weighting or unsupported performance claims.

## Maintenance notes

Comparison should consume the same analyzer outputs as individual quotes; never fork recommendation semantics into a second engine.
