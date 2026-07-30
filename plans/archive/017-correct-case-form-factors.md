# Plan 017: Separate case chassis class from motherboard compatibility

> **Executor instructions**: Read `docs/PRODUCT_VISION.md`. Do not claim verified motherboard support from a chassis-size label alone. Regenerate artifacts through the pipeline; never hand-edit them.
>
> **Drift check (run first)**: `git diff --stat fabeb49..HEAD -- scripts/build_pc_data.js scripts/lib pc-quote-builder/src/lib/catalogMapper.js pc-quote-builder/src/lib/compatibility.js pc-quote-builder/src/App.jsx pc-quote-builder/src/**/*.test.* data/processed pc-quote-builder/public/data docs/data`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `016-extract-catalog-compiler.md`
- **Category**: bug
- **Planned at**: commit `fabeb49`, 2026-07-29

## Why this matters

The compiler removes “Tower” from case `type` and stores the remainder as `supported_mobo_form_factors`. Current case values (`ATX Mid`, `MicroATX Mini`, etc.) do not match motherboard values (`ATX`, `Micro ATX`), so normal boards are filtered out and unknown evidence becomes false incompatibility.

## Product-governance checklist

- **Problem/users/value**: guided/expert builders need cases not falsely excluded; improves verified compatibility and completeness.
- **Evidence/uncertainty**: source chassis class remains separate; support may be verified, explicitly inferred with evidence, or unknown.
- **Explanation/action**: UI explains why a case is included/excluded and never labels unknown as incompatible.
- **Precision/bias**: no score or commercial ordering.
- **Failure paths**: unfamiliar chassis labels, empty support lists, aliases, multi-form-factor support, and missing dimensions remain non-blocking unknowns.
- **Freshness/provenance**: generated fields retain source/inference provenance.
- **Tests/value**: representative ATX, Micro ATX, Mini ITX and unknown cases prove the behavior.

## Current state

```js
// build_pc_data.js:349-357
if (item.type) formFactors.push(item.type.replace(/Tower/i, "").trim() || item.type);
supported_mobo_form_factors: formFactors
```

`App.jsx:229-235` and `compatibility.js:48-58` use exact inclusion.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| Compiler tests | `cd pc-quote-builder && npm test -- catalogCompiler case compatibility` | all pass |
| Pipeline | `cd pc-quote-builder && npm run build:pc-data && npm run sync:pc-data` | exit 0; generated artifacts only |
| Artifacts | `cd pc-quote-builder && npm run test:artifacts` | all pass |
| Gate | `cd pc-quote-builder && npm run check` | exit 0 |

## Scope

**In scope**: case adapter/schema, compatibility metadata/contracts, mapper, case filter/check, focused tests, regenerated case/compatibility/deployed artifacts.

**Out of scope**: GPU-length sourcing, cooler/radiator support, unrelated categories, retailer data, manual JSON edits.

## Git workflow

- Branch: `advisor/017-correct-case-form-factors`
- Separate source/test commit from generated-artifact commit.

## Steps

1. Add failing fixtures/contracts showing current chassis/support vocabulary mismatch and representative expected states.
2. Preserve raw `chassis_type`. Add supported motherboard form factors only from trustworthy explicit source data or a reviewed mapping whose output is marked inferred with rule/provenance.
3. Canonicalize form-factor aliases in one shared pure function. Unknown/unmapped values produce unknown, not failure or filtering exclusion.
4. Update mapper/filter/evaluation to consume canonical values plus evidence state.
5. Regenerate/sync/build artifacts and inspect only case/compatibility-related diffs.
6. Run artifact and full gates.

## Test plan

Cover ATX mid/full chassis, MicroATX spelling aliases, Mini ITX, unknown/HTPC/test-bench labels, explicit multi-support, inferred support, and confirmed mismatch. Contract must assert meaningful canonical overlap, not a brittle percentage alone.

## Done criteria

- [ ] ATX and Micro ATX representative builds retain valid case options.
- [ ] Chassis class and motherboard support are separate fields.
- [ ] Unknown support is not rendered as incompatibility.
- [ ] Generated artifacts come only from the pipeline.
- [ ] All gates pass.

## STOP conditions

- Upstream data has no defensible basis for motherboard support and proposed mapping would create false verification.
- Regeneration changes unrelated category semantics.
- Existing saved case IDs would change (owned by plan 018).

## Maintenance notes

Future case compatibility dimensions must carry evidence state. Do not infer detailed radiator/cooler support from chassis class.

---

## Completion — 2026-07-30

### What was done

- Added `canonicalizeFormFactors(chassisType)` in `scripts/lib/compiler.js` — maps chassis-type strings (e.g. "ATX Mid Tower", "MicroATX Mini Tower", "Mini ITX Tower") to canonical motherboard form-factor lists with inference evidence.
- Updated case adapter in `scripts/lib/sources.js`: passes raw `chassis_type` instead of computing broken form factors via `item.type.replace(/Tower/i, "")`.
- Updated `mergeCase` in `scripts/lib/compiler.js` to:
  - Preserve `chassis_type` (raw source field)
  - Compute `supported_mobo_form_factors` via `canonicalizeFormFactors`
  - Add `form_factor_evidence` ("inferred" | "unknown")
- Updated `catalogMapper.js` to pass through `chassisType`, `formFactorEvidence`.
- Added test coverage:
  - 8 `canonicalizeFormFactors` tests — ATX Mid/Full/Slim/Desktop, MicroATX, Mini ITX, unrecognized, empty/null
  - Updated `mergeCase` test — validates chassis_type preservation, canonical form factors, evidence
  - 3 `checkMoboCaseCompatibility` tests — ATX↔ATX Mid, ATX↔MicroATX, ATX↔Mini ITX, E-ATX miscibility, empty→unknown, camelCase fields

### Files changed

| File | Change |
|---|---|
| `scripts/lib/compiler.js` | Added `canonicalizeFormFactors`, updated `mergeCase` |
| `scripts/lib/sources.js` | Case adapter now passes `chassis_type` instead of broken form-factor string |
| `scripts/lib/compiler.test.js` | 8 canonicalization tests, updated mergeCase test |
| `pc-quote-builder/src/lib/catalogMapper.js` | Passes through `chassisType`, `formFactorEvidence` |
| `pc-quote-builder/src/lib/compatibility.test.js` | Added 3 case-mobo compatibility tests |
| `plans/README.md` | Marked 017 DONE |

### Gate results

```
npm run check           — 0 lint errors, 374 tests passed, build ok
npm run test:artifacts  — 26 tests passed
```

### Remaining `.todo` tests

30 `.todo` tests remain in `App.test.jsx` — CRUD/lifecycle and builder flow.
