# Implementation Plans

Generated on 2026-07-29 against commit `63ecbca`. Execute in order unless a plan's dependency says otherwise. Executors must read the whole plan, honor STOP conditions, and update this table.

## Product-governance requirement

Before creating, approving, or implementing a material plan, read [the Canonical Product Vision](../docs/PRODUCT_VISION.md). It governs product direction above plans and existing implementation. Revalidate any plan that changes recommendations, compatibility behavior, core product flows, scoring, warning/failure/unknown-state semantics, monetization, product or retailer rankings, or architecture that constrains future product behavior. Record and surface a material conflict; do not silently let a plan override the vision.

| Plan | Title | Priority | Effort | Depends on | Status |
|---|---:|---:|---:|---:|---|---|
| 007 | Consolidate catalog maintenance and onboarding | P2 | M | 003 | DONE |
| 008 | Stage catalog loading by builder demand | P3 | M | 002, 006 | DONE |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (state why) | REJECTED (state why).

## Archiving

Once a plan is marked DONE, move its markdown file from `plans/` to `plans/archive/` and remove its row from the table below. This keeps the active plan list focused on what remains.

## Dependency notes

- Plan 001 establishes a trustworthy local and CI gate before any behavioral work.
- Plan 002 fixes the fallback and preserves the fields that plan 003 validates.
- Plan 003 adds artifact contracts before plan 004 changes how source inputs are pinned.
- Plan 006 supplies regression coverage before plan 008 changes loading behavior.

## Findings resolved by plans

- CSV multiline round-trip and price-import quadratic lookup — resolved by plan 006 (RFC-4180 parser, Map-based price lookup, characterization tests).
- Dead root lockfile and the parallel `fetch:catalog` pipeline — resolved by plan 007 (`fetch:catalog` script and npm entry retired, orphaned `package-lock.json` removed).

## Findings considered and rejected

- Hosted quote sharing, automated price feeds, and a catalog-confidence UX are product options, not committed implementation work. They need maintainer product decisions and are intentionally not planned here.
