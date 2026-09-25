# Plan 036: Ingest BuildCores evidence to unlock Analyzer rule coverage

> **Executor instructions**: Follow this plan step by step. This is a catalog
> pipeline and evidence-classification change: generated artifacts must be
> produced by the pipeline, never hand-edited. Never fuzzy-merge a source value
> onto an existing catalog identity — a wrong socket or clearance produces a
> false compatibility conclusion. Run every focused test and the full gate.
>
> **Drift check (run first)**:
> `git diff --stat 6b811b7..HEAD -- scripts/lib scripts/build_pc_data.js data/processed pc-quote-builder/public/data docs/data pc-quote-builder/src/lib/quoteAnalyzer pc-quote-builder/src/lib/compatibility.js pc-quote-builder/src/lib/catalogMapper.js`
>
> If Plan 028/030 rule IDs or field names, or the Plan 032 Analyzer consumer
> contract, changed, STOP and reconcile before regenerating the catalog.
> Do not run `download:pc-data`; the pinned raw snapshot is already present and
> the scheduled workflow owns downloads.

## Status

**DONE — archived 2026-09-25.** Measured coverage, identity, and size results
are recorded in the completion summary.

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: Plans 030 (coverage contract) and 032 (Analyzer consumer)
- **Category**: data
- **Planned at**: commit `c58ea04`, 2026-09-25

## Why this matters

The shipped Analyzer can only reach conclusions where both sides of a rule
carry evidence. As of the Plan 032 archive, five of seven v1 rules were at 0%
assessability and PSU headroom at 3.3%, so real quotations mostly resolve to
`unknown`. The evidence exists in the already-downloaded BuildCores open-db
snapshot but is never ingested.

Root causes (verified against `data/raw` and `data/processed`):

1. `scripts/lib/sources.js:12-46` loads only the `CPU` and `RAM` BuildCores
   categories. Motherboard (3,693), PCCase (3,749), PSU (3,295), and GPU
   (3,833) records are ignored.
2. The BuildCores adapter reads flat `item.brand`/`item.model`/`item.socket`,
   but open-db records store identity under `metadata.manufacturer` and
   `metadata.name`. The resulting empty `normalized_key` makes
   `mergeGrouped`/`byNormalizedKey` (`compiler.js:27-33`) drop every BuildCores
   record. Processed CPUs show 0/961 socket and 0 `buildcores_id`.
3. Nested fields are not mapped: CPU `socket` (789/789 present),
   `specifications.memory.types` (704/789), `specifications.tdp`,
   `cores.total`, `clocks.performance.*`; motherboard `memory.ram_type`
   (3,689/3,693) and `memory.slots`; case `max_video_card_length`
   (3,576/3,749); PSU `connectors.pcie_6_plus_2_pin` (2,425/3,295) and
   `pcie_12vhpwr`; GPU `length` (3,824/3,833), `power_connectors`
   (3,826/3,833), `tdp` (3,809/3,833).
4. `loadPcPart` hardcodes `pcie_power_connectors: {}` for PSUs
   (`sources.js:174`), and pc-part GPUs carry no usable connector string.
5. Identity conventions differ: exact normalized-model overlap between
   BuildCores and pc-part is 43% for CPUs, 7% for motherboards, and ~0% for
   cases, PSUs, and RAM. A fuzzy merge is unsafe.

## Product-decision record

- **User problem**: a buyer's real quotation cannot be assessed because the
  catalog lacks the evidence the supported rules require.
- **Product dimension**: compatibility and data confidence (not new claims).
- **Decision types**: values carried from a source stay `explicit`; derived
  values stay `inferred` and must never be reported as explicit. Missing or
  conflicting evidence still resolves to `unknown`, never `ok`.
- **Identity policy (owner-approved 2026-09-25)**: merge only exact identity
  matches; include unmatched BuildCores records as distinct,
  source-attributed entries; never assign BuildCores specs to an existing
  identity by fuzzy matching.
- **Failure modes**: catalog growth, duplicate-looking names, TDP conflicts,
  socket string drift (`LGA 1700` vs `LGA1700`). Each is measured and recorded.
- **Commercial impact**: none. Catalog size is not a success metric.
- **Assurance context**: Plan 032 shipped with a documented waiver; this plan
  raises evidence coverage but makes no universal false-negative claim. The
  Plan 035 real-input gate remains a later validation item.

## Scope

**In scope**:

- `scripts/lib/sources.js` and `scripts/lib/compiler.js` plus their tests.
- `scripts/build_pc_data.js` wiring.
- Regenerated `data/processed/`, `pc-quote-builder/public/data/`, `docs/data/`
  via the pipeline.
- `README.md` data-sources attribution note.
- `pc-quote-builder/src/lib/catalogMapper.js` and its tests only for the
  explicit-over-inferred CPU socket precedence: the runtime name heuristic
  must not override a source socket (`Threadripper 9980X` must stay `sTR5`,
  `i9-10980XE` must stay `LGA2066`).
- `pc-quote-builder/src/lib/artifactContract.test.js` only if a documented gap
  list must change (counts are structural, not fixed).

**Out of scope**:

- Any fuzzy/alias identity matching or hand-written catalog merges.
- New runtime fields, new rules, or changes to Analyzer verdict semantics.
- Price, stock, benchmark, or quality data.
- Running `download:pc-data` or changing pinned upstream SHAs.
- Other `catalogMapper.js` semantics beyond socket precedence.

## Steps

### Step 1: Fix the BuildCores adapter

In `scripts/lib/sources.js`:

- Resolve identity from `metadata.manufacturer`/`metadata.name` with fallback
  to flat `brand`/`model`/`name` used by current fixtures.
- Add `canonicalSocket(value)`: trim, uppercase, collapse `LGA <n>` to
  `LGA<n>`, so BuildCores and pc-part sockets compare equal. Never invent a
  socket; empty stays empty.
- Load all six categories: `cpus`, `ram`, `mobos`, `pcCases`, `psus`, `gpus`.
  Keep flat-fixture compatibility for every existing test.
- Map nested CPU fields to the existing source-record shape:
  `socket`, `tdp_w`, `cores`, `threads`, `base_clock_ghz`, `boost_clock_ghz`,
  `memory_support: { types, max_speed_mts }`.
- Map motherboard `memory.ram_type` → `memory_type`,
  `memory.slots` → `memory_slots`, `memory.max` → `max_memory_gb`,
  `storage_devices.sata_6_gb_s` → `sata_ports`, and array `m2_slots` to a count.
- Map case `form_factor` (chassis type) → `chassis_type`,
  `max_video_card_length` → `max_gpu_length_mm`,
  `max_cpu_cooler_height` → `max_cpu_cooler_height_mm`, and carry explicit
  `supported_motherboard_form_factors` when present.
- Map PSU `wattage`, `form_factor`, `efficiency_rating`, and
  `connectors.pcie_6_plus_2_pin`/`pcie_12vhpwr`/`pcie_12V_2x6` into the
  compiler-side `pcie_power_connectors` shape (`8_pin`, `12vhpwr`).
- Map GPU `length` → `board_length_mm`, `tdp` → `tdp_w`, `memory` →
  `vram_gb`, `memory_type` → `vram_type`, `chipset`, and convert
  `power_connectors` object into the string contract consumed by
  `checkPsuConnectors` (`Nx8-pin`, `Nx12vhpwr`; 12V-2x6 counts as 12vhpwr).
  A missing/zero connector set yields `""`, never a false requirement.

**Verify**: `npx vitest run ../scripts/lib` → nested-record, flat-record,
canonical-socket, connector-string, and empty-directory cases pass.

### Step 2: Generalize the merge functions

In `scripts/lib/compiler.js`:

- Add a small multi-source picker (ordered source precedence with fallback)
  and use it in `mergeCpu`, `mergeGpu`, `mergeMobo`, `mergePsu`, and
  `mergeCase`.
- Keep output field names and shapes unchanged; add `buildcores_id` to
  `sources` and include `buildcores` in `meta.created_from`.
- Case: when explicit `supported_motherboard_form_factors` are present, emit
  them canonicalized with `form_factor_evidence: "explicit"`; otherwise keep
  the documented chassis-type inference as `"inferred"`.
- Record conflict flags when numeric sources disagree beyond the existing
  thresholds; conflicts stay unusable for coverage.
- Include unmatched BuildCores records as separate entries through the normal
  normalized-key grouping (no changes to `mergeGrouped`).

**Verify**: `npx vitest run ../scripts/lib` → precedence, explicit/inferred
evidence, conflict-flag, and dedupe cases pass.

### Step 3: Wire the build

In `scripts/build_pc_data.js`, load all BuildCores categories and merge them
into their groups. Keep the minimum-count asserts and deterministic output
ordering. Do not remove the pc-part or dbgpu inputs.

**Verify**: `npm run build:pc-data` completes from the existing raw snapshot.

### Step 4: Measure before/after coverage

- Record `data/processed/assessment-coverage.min.json` rule assessability
  before and after; every rule must increase or stay equal, none may regress.
- Report the BuildCores/pc-part exact-match counts and catalog counts per
  category, plus duplicate-looking normalized names.
- Report processed-data byte size before/after.
- Append the measured table to the completion summary; if coverage regresses
  or growth is disproportionate, STOP and report before syncing.

**Verify**: coverage comparison and size table produced.

### Step 5: Sync and run every gate

- `npm run sync:pc-data`
- `npm run test:artifacts`
- `npm run check` (from `pc-quote-builder/`)
- `npm run build` (production build to `../docs/`)
- `npx vitest run src/lib/postBuildAssertion.test.js`
- `bash scripts/verify.sh`
- `git diff --check`

### Step 6: Documentation

- Add a data-sources attribution line to `README.md` naming BuildCores
  (ODC-By), pc-part-dataset (MIT), and dbgpu, with their pinned provenance.
- Update `plans/README.md` status and archive this plan with the measured
  coverage table.

## Test plan

- Nested open-db records and flat legacy fixtures for every category.
- Socket canonicalization (`LGA 1700` ↔ `LGA1700`) and non-invention of values.
- PSU connector map and GPU connector-string derivation, including 12V-2x6.
- Explicit vs inferred case form-factor evidence.
- Multi-source precedence and conflict flags; no fuzzy identity merge.
- Missing directories and empty categories degrade to empty lists.
- End-to-end deterministic build output unchanged for identical inputs.

## Done criteria

- [ ] All six BuildCores categories are ingested with source attribution.
- [ ] CPU socket, CPU memory types, case GPU clearance, PSU connectors, and
      GPU length/connectors/TDP populate the processed catalog.
- [ ] No rule's assessability regresses; before/after table recorded.
- [ ] Inferred values remain distinguishable from explicit source values.
- [ ] No fuzzy identity merge; unmatched records are separate entries.
- [ ] `npm run check`, `npm run test:artifacts`, the post-build assertion, and
      `bash scripts/verify.sh` pass.
- [ ] Generated artifacts are pipeline-produced, never hand-edited.
- [ ] `plans/README.md` updated; completion record added.

## STOP conditions

Stop and report if:

- A rule's assessability would decrease, or a required field would be
  populated only by fuzzy matching.
- Socket canonicalization cannot make BuildCores and pc-part sockets compare
  without guessing.
- Connector or clearance mapping would require changing Analyzer rule
  semantics rather than source normalization.
- Catalog growth or payload size is disproportionate to the coverage gain and
  the owner has not approved the trade-off.
- Any source category lacks a compatible license or attribution path.
- Generated `docs/` output diverges from `public/data/` after a production
  build.

## Maintenance notes

Keep source adapters pure and fixture-tested; keep identity policy explicit in
the compiler, never in heuristics hidden inside a loader. Future sources must
enter through the same explicit-vs-inferred classification and must never
silently overwrite an existing catalog identity. When the scheduled pin
changes, re-run the coverage comparison in Step 4 and report regressions
instead of merging them.

---

## Completion — 2026-09-25

Branch: `advisor/b1-cotiza-verify`. Plan archived on completion.

### What was done

- Fixed the BuildCores adapter: identity from `metadata.manufacturer/name`,
  nested CPU fields (`socket`, `specifications.memory.types`, `tdp`, clocks,
  cores), motherboard memory fields, case clearance and explicit supported
  form factors, PSU connector maps, and GPU length/connectors/TDP. Socket and
  form-factor spellings are canonicalized so BuildCores and pc-part compare
  equal; no value is invented.
- Generalized `mergeCpu`, `mergeGpu`, `mergeMobo`, `mergePsu`, `mergeCase`, and
  `mergeRam` for multi-source evidence with source attribution, identity
  preference for existing pc-part/dbgpu records, and explicit-vs-inferred case
  form-factor evidence.
- Wired all six BuildCores categories into `build_pc_data.js`.
- Fixed explicit-over-inferred CPU socket precedence in `catalogMapper.js`:
  the runtime name heuristic no longer overrides a source socket.
- Regenerated and synced `data/processed/`, `public/data/`, and `docs/data/`
  through the pipeline; added README source attribution.

### Coverage before → after (assessable combinations)

| Rule | Before | After |
|---|---:|---:|
| compat-cpu-mobo-socket | 0.000% | 56.255% |
| compat-cpu-ram-memory | 0.000% | 49.696% |
| compat-gpu-case-length | 0.000% | 44.393% |
| compat-mobo-case-ff | 97.150% | 98.484% |
| compat-mobo-ram-memory | 0.000% | 0.000% (no source for `max_memory_speed_mts`) |
| power-connectors-pcie | 0.000% | 17.019% |
| power-psu-headroom | 3.257% | 50.760% |

No rule regressed. `mobo.max_memory_speed_mts` remains the only required field
with no available source; it stays a documented gap rather than being inferred.

### Identity audit (multi-source merges and new entries)

| Category | Total | Exact-matched (multi-source) | BuildCores-only | pc-part-only | dbgpu-only |
|---|---:|---:|---:|---:|---:|
| cpus | 1,255 | 412 | 294 | 549 | — |
| gpus | 7,614 | 2 | 3,745 | 3,552 | 315 |
| mobos | 8,289 | 339 | 3,333 | 4,617 | — |
| psus | 5,379 | 6 | 3,251 | 2,122 | — |
| cases | 7,914 | 7 | 3,703 | 4,204 | — |
| ram | 7,959 | 0 | 4,478 | 3,481 | — |

Unmatched BuildCores records were included as separate source-attributed
entries exactly as the owner approved; no fuzzy spec assignment occurred.

### Size

`data/processed/` grew from 12.27 MB to 29.71 MB (2.4×);
`compatibility.min.json` from 0.40 MB to 1.50 MB because tiers now cover
1,255 CPUs and 7,614 GPUs. The staged catalog loader fetches only demanded
categories, so per-user payload growth is limited to the Analyzer's six
categories.

### Verification

- `npx vitest run ../scripts/lib` — 207 passed (nested/flat adapters,
  canonicalization, connector mapping, multi-source merges, no-fuzzy-merge).
- `npm run check` — lint 0 errors, 942 tests passed, 27 todo, disposable build.
- `npm run test:artifacts` — 31 passed on the regenerated manifest.
- `npm run build` + `npx vitest run src/lib/postBuildAssertion.test.js` — 12
  passed; `docs/data/` matches `public/data/` byte for byte.
- `bash scripts/verify.sh` — 43 contract tests passed.
- `git diff --check` — clean.

### Follow-ups (not part of this plan)

- `mobo.max_memory_speed_mts` and per-rule coverage thresholds remain open.
- The Plan 035 real-input corpus gate is still unevaluable; Plan 032's waiver
  stays in force until a private corpus exists.
