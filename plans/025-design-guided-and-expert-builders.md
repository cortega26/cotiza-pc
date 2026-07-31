# Plan 025: Define separate intent-first Guided and manual Expert Builder experiences

> **Executor instructions**: This is a product/data design spike. Do not replace the current builder or add a questionnaire without a defensible recommendation model. Read the canonical vision and preserve expert overrides.
>
> **Drift check (run first)**: `git diff --stat fabeb49..HEAD -- docs/PRODUCT_VISION.md README.md pc-quote-builder/src/App.jsx pc-quote-builder/src/lib/selectionEvaluation.js pc-quote-builder/src/lib/compatibility.js`

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: `014-preserve-assessment-severity.md`, `019-finish-staged-catalog-loading.md`
- **Category**: direction
- **Planned at**: commit `fabeb49`, 2026-07-29

## Why this matters

The current UI calls a component-by-component picker “Builder guiado,” but its model contains only component IDs and an integrated-GPU flag. The vision requires beginners to start from use, budget, workloads, target resolution, priorities, and reusable parts, while experts retain complete manual control. The product needs two explicit experiences rather than a questionnaire layered over the existing picker.

## Product-governance checklist

- **Problem/users/value**: beginners need defensible recommendations; experts need unrestricted inspection/overrides. Improves suitability, value, balance, upgradeability, and explainability.
- **Evidence/uncertainty**: every recommendation rule declares inputs, evidence/heuristic status, missing-data behavior, and confidence.
- **Explanation/precision**: component choices include why, alternatives, trade-offs, and assumptions; no opaque score or invented benchmark precision.
- **Commercial bias**: retailer/affiliate signals cannot affect recommendation order.
- **Failure paths**: insufficient budget, conflicting priorities, missing prices/specs, owned incompatible parts, no matching build, and manual override.
- **Freshness/provenance**: price/catalog freshness is visible in every proposal.
- **Beginner/expert**: separate routes/modes share assessment but not forced interaction.
- **Tests/acceptance**: personas and deterministic fixtures prove recommendations and override behavior.

## Current state

`App.jsx:19-35` stores only six IDs and `useIntegratedGpu`; `App.jsx:902-943` presents the component stepper as guided. No intended-use/budget/preference model exists.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| Baseline | `cd pc-quote-builder && npm test` | all pass |
| Design validation | Markdown link check and `git diff --check` | exit 0 |
| Optional rule spike | focused Vitest command specified by design | deterministic tests pass |

## Scope

**In scope**: create `docs/design/builder-modes.md`; define personas, intake schema, recommendation/evidence contract, expert override behavior, staged data needs, wireframes, phased backlog; optional pure rule spike.

**Out of scope**: production route/UI replacement, ML/AI recommendations, benchmarks without licensed/source data, automated prices, retailer ranking.

## Git workflow

- Branch: `advisor/025-design-guided-and-expert-builders`
- Commit design and any approved pure spike separately.

## Steps

1. Document the current picker as the candidate Expert Builder baseline, including gaps in components and evidence.
2. Define the minimum Guided intake: primary/secondary use, budget scope, target performance/workloads, priorities, owned parts, region/currency, and acceptable trade-offs.
3. Define deterministic recommendation dimensions/rules, required data, confidence, explanations, alternatives, and no-result behavior. Do not encode rules without evidence/data availability.
4. Design separate beginner/expert flows and the handoff between them: a guided proposal can open in expert mode without losing assumptions/evidence.
5. Specify three to five representative personas and expected multidimensional outputs, including conflicting priorities and insufficient-data cases.
6. Produce phased implementation slices and explicit owner decisions. Generate later implementation plans only after approval.

## Test plan

Design fixtures must include gaming, development/workstation, constrained office budget, owned-part upgrade, and insufficient-data/no-valid-build scenarios. Define invariant tests for budget, compatibility, explanation, uncertainty, and manual override.

## Done criteria

- [ ] `docs/design/builder-modes.md` answers every product checklist item.
- [ ] Guided and Expert responsibilities are distinct.
- [ ] Recommendation rules are tied to available/planned data and evidence.
- [ ] Personas, wireflows, test fixtures, no-result behavior, and phased backlog exist.
- [ ] No production questionnaire or unsupported recommendation was added.

## STOP conditions

- Recommendation quality requires unavailable performance/price data.
- The design would hide expert overrides or incompatibility evidence.
- Owner has not chosen initial target personas/use cases.

## Maintenance notes

Guided and Expert modes should share normalized catalog and assessment contracts, not duplicate compatibility logic.
