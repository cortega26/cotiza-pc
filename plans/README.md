# Implementation Plans

Generated on 2026-07-29 against commit `63ecbca`. Execute in order unless a plan's dependency says otherwise. Executors must read the whole plan, honor STOP conditions, and update this table.

| Plan | Title | Priority | Effort | Depends on | Status |
|---|---|---:|---:|---|---|
| 001 | Restore a green verification gate | P1 | S | — | DONE |
| 002 | Preserve complete catalog compatibility data | P1 | S | 001 | DONE |
| 003 | Validate deployed catalog artifacts | P1 | S | 001, 002 | DONE |
| 004 | Pin scheduled catalog supply-chain inputs | P1 | M | 003 | TODO |
| 005 | Upgrade vulnerable development tooling | P1 | M | 001 | TODO |
| 006 | Characterize and harden quote import workflows | P2 | M | 001 | TODO |
| 007 | Consolidate catalog maintenance and onboarding | P2 | M | 003 | TODO |
| 008 | Stage catalog loading by builder demand | P3 | M | 002, 006 | TODO |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (state why) | REJECTED (state why).

## Dependency notes

- Plan 001 establishes a trustworthy local and CI gate before any behavioral work.
- Plan 002 fixes the fallback and preserves the fields that plan 003 validates.
- Plan 003 adds artifact contracts before plan 004 changes how source inputs are pinned.
- Plan 006 supplies regression coverage before plan 008 changes loading behavior.

## Findings consolidated into plans

- CSV multiline round-trip and price-import quadratic lookup are part of plan 006.
- Dead root lockfile and the parallel `fetch:catalog` pipeline are part of plan 007.

## Findings considered and rejected

- Hosted quote sharing, automated price feeds, and a catalog-confidence UX are product options, not committed implementation work. They need maintainer product decisions and are intentionally not planned here.
