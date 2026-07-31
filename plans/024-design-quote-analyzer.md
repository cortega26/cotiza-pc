# Plan 024: Design the imported-quote analyzer as the first decision-engine vertical

> **Executor instructions**: This is a design/data spike, not permission to build the whole analyzer. Read `docs/PRODUCT_VISION.md` completely. Produce the specified decision record, prototype only pure evaluation seams behind tests, and stop on unresolved product/data questions.
>
> **Drift check (run first)**: `git diff --stat fabeb49..HEAD -- docs/PRODUCT_VISION.md README.md pc-quote-builder/src/App.jsx pc-quote-builder/src/lib/selectionEvaluation.js pc-quote-builder/src/lib/csvParser.js pc-quote-builder/src/lib/catalogMapper.js`

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: `014-preserve-assessment-severity.md`, `015-harden-quote-interchange.md`
- **Category**: direction
- **Planned at**: commit `fabeb49`, 2026-07-29

## Why this matters

The canonical vision calls Quote Analyzer a central differentiator: many users already have a store or technician quote and need to know whether it is worth buying. The app already imports structured quotes and evaluates catalog-backed builder selections, making an ID-resolved, evidence-conscious analyzer the nearest credible decision-engine vertical. Free-text matching and value claims remain high-risk and must not be improvised.

## Product-governance checklist

- **Problem/users/value**: buyers with existing quotes need technical validity, missing parts, power/fit evidence, and prioritized next actions; improves compatibility, suitability, explainability, price freshness, and confidence.
- **Evidence/uncertainty**: every conclusion is classified verified/inferred/heuristic/assumption/unknown; unmatched text never becomes a confident product match.
- **Explanation/precision**: output includes detection, reason, source fields, evidence, confidence, and action; no opaque universal score.
- **Commercial bias**: no retailer/product preference or affiliate ordering.
- **Failure paths**: missing IDs, ambiguous products, incomplete quotes, stale prices, unsupported categories, conflicting specs, and no stated use case.
- **Freshness/provenance**: quote snapshot and catalog/source timestamps remain separate and visible.
- **Beginner/expert**: concise verdict with expandable evidence; manual overrides preserve expert control.
- **Tests/acceptance**: fixture quotes prove valid, incompatible, warning, unknown, and ambiguous cases.

## Current state

- `App.jsx:656-690`: quote JSON/CSV import.
- `App.jsx:692-716`: price matching by `itemId`.
- `selectionEvaluation.js:45-140`: builder selection assessment.
- Quote rows do not currently resolve into a complete normalized selection or use-case profile.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| Existing tests | `cd pc-quote-builder && npm test` | all pass |
| Design checks | `git diff --check` and local Markdown link check | exit 0 |
| Optional pure spike | focused Vitest command named in design | all spike tests pass |

## Scope

**In scope**: create `docs/design/quote-analyzer.md`; inventory data/evidence; define analyzer input/output contracts, resolution states, staged milestones, test fixtures, analytics-free success criteria; optionally prototype a pure ID-resolved adapter behind tests.

**Out of scope**: fuzzy/AI matching in production, price scraping, retailer ranking, universal score, backend accounts/sharing, full UI implementation.

## Git workflow

- Branch: `advisor/024-design-quote-analyzer`
- Commit design separately from any approved pure spike.

## Steps

1. Map quote rows/import fields to catalog categories and assessment inputs. Quantify which current categories/fields can be verified versus unknown.
2. Define versioned analyzer input/output schemas with per-finding severity, evidence type, confidence, source/freshness, explanation, and action.
3. Define conservative resolution states: exact `itemId`, explicit user mapping, ambiguous candidates, unmatched text, unsupported component.
4. Specify v1 scope: technical validity, missing required components, PSU power/connectors when evidenced, case fit when evidenced, price completeness/freshness. Explicitly defer workload/value/bottleneck conclusions until inputs support them.
5. Produce wire-level examples for at least five fixture quotes and a phased implementation backlog with file boundaries.
6. Define measurable acceptance criteria and open decisions. If approved, a later implementation plan should be generated from the design.

## Test plan

The design must specify fixtures for exact-ID valid, confirmed incompatible, warning-only, insufficient evidence, ambiguous identity, stale/partial price, and malformed import. Optional spike tests only pure transforms.

## Done criteria

- [ ] `docs/design/quote-analyzer.md` answers the full product checklist.
- [ ] Input/output/evidence schemas and v1 exclusions are explicit.
- [ ] Five-plus end-to-end examples and test fixtures are specified.
- [ ] No unsupported value/performance claim is included.
- [ ] Owner decisions and follow-up implementation slices are listed.

## STOP conditions

- The design requires fuzzy matching to deliver any trustworthy v1.
- Current IDs remain ambiguous because plan 018 is incomplete; keep v1 design ID-resolved and flag dependency.
- A score is proposed without visible dimensions/evidence.
- Product owner must choose which component categories are required for a valid quote.

## Maintenance notes

Use this analyzer contract as the shared assessment seam for guided recommendations and scenario comparison. Version it when evidence semantics change.
