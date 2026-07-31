# Quote Analyzer Design — Decision Record (Plan 024)

> Status: DESIGN SPIKE — does not authorize full implementation.
> Date: 2026-07-30
> Depends on: Plans 014 (assessment severity), 015 (quote interchange), 018 (catalog ID uniqueness).
> Relationship: this analyzer contract is the shared assessment seam for the Guided Builder (Plan 025) and scenario comparison (Plan 026).

## 1. Purpose and decision record

The Canonical Product Vision makes Quote Analyzer the primary current product
direction: the first trustworthy end-to-end decision-engine vertical around
structured or explicitly user-confirmed quotations. This design defines how a
user-imported quote is resolved against the catalog, assessed with the
existing evidence model, and reported without claiming evidence that does not
exist.

This document is a design/data spike. It specifies contracts, resolution
states, v1 scope, fixtures, acceptance criteria, and an implementation
backlog. A later implementation plan must be generated from this design and
approved before building the analyzer UI.

### Product-governance checklist (from Plan 024)

| Question | Answer in this design |
|---|---|
| Problem/users/value | Chilean non-expert buyers with an existing desktop gaming quotation who must decide within ~30 days whether to buy. The design answers: what can be verified, what may cost money/performance, what is uncertain, which 1-3 changes to question first. |
| Evidence/uncertainty | Every finding carries a `decisionType` (deterministic/derived/heuristic/probabilistic/preference-dependent/unsupported), confidence, and evidence sources. Unmatched text never becomes a confident product match (§3). |
| Explanation/precision | Findings expose detection, reason, source fields, evidence, confidence, and next action. There is no opaque universal score; the verdict is derived from visible dimensions (§6). |
| Commercial bias | No retailer/product preference, affiliate ordering, or ranking. Price findings report completeness/freshness only in v1; value-for-money conclusions are deferred (§7). |
| Failure paths | Missing IDs, ambiguous products, incomplete quotes, stale prices, unsupported categories, conflicting specs, and no stated use case are first-class states in the input/output contracts and fixtures (§3, §8). |
| Freshness/provenance | Quote snapshot timestamp and catalog `generatedAt` remain separate and visible on every finding's evidence block (§6). |
| Beginner/expert | Concise verdict with expandable evidence; manual component confirmation preserves user control (§3, §8, §10-E). |
| Tests/acceptance | Seven fixture classes prove valid, incompatible, warning, unknown, ambiguous, stale/partial, and malformed cases (§8, §11). |

### Vision decision-checklist (abridged answers)

- **Problem**: verify an existing quotation before paying.
- **Dimension**: compatibility, completeness, power/fit evidence, price
  freshness, explainability, data confidence.
- **Verified vs inferred**: deterministic for catalog-entailed compatibility;
  derived for power estimates; heuristic only where the existing builder
  already applies a rule of thumb (GPU tier is shown as heuristic, never as
  fact); unknown everywhere evidence is missing.
- **Uncertainty honesty**: `unknown` is a verdict state; missing data degrades
  only the affected dimension.
- **No false precision**: no universal score; confidence levels are coarse
  (high/medium/low) and tied to decision type.
- **Milestone**: advances Milestone 0 (contract approval) and Milestone 2
  (evidence-qualified Quote Analyzer MVP).

## 2. Current-state inventory (Step 1)

### 2.1 What exists today

| Asset | Location | Shape |
|---|---|---|
| Quote import (JSON/CSV) | `pc-quote-builder/src/App.jsx:420-436` | rows with `category`, `product`, `itemId`, `store`, prices, `notes`; CSV requires component+product columns |
| Price import by `itemId` | `pc-quote-builder/src/App.jsx:438-484` | matches via `buildPriceMap` + alias resolution; 0 matches → alert |
| Quote model | `src/lib/quoteModel.js` | `normalizeRow`, `normalizeQuote`, `buildRowsFromSelection` |
| CSV/JSON parsers | `src/lib/csvParser.js` | quoted fields, escaped quotes, total-line skip, formula protection |
| Catalog normalization | `src/lib/catalogMapper.js` | six normalized arrays + tier maps; raw snake_case aliases kept at boundary |
| Builder assessment | `src/lib/selectionEvaluation.js` | `evaluateSelection` → power, psuStatus, connectorStatus, balance, statuses, issues, warnings, info, summaryVerdict |
| Compatibility rules | `src/lib/compatibility.js` | socket, RAM type, form factor, GPU length, PSU power/connectors checks |
| Staged catalog loading | `src/hooks/useCatalog.js` | category states, fallback, cancellation, reload semantics |
| ID uniqueness | Plan 018 | catalog IDs unique; `resolveCatalogId` alias map in `compatMeta.aliases` |

### 2.2 Verifiable evidence per category (what the catalog can prove)

| Category | Fields the catalog carries | Verifiable v1 checks | Known gaps (→ unknown) |
|---|---|---|---|
| CPU | id, name, brand (inferred), family (extracted), socket (inferred), memoryType (+`memoryTypeExplicit`), tdp (nullable), suggestedPsu (nullable) | socket↔mobo; memory type↔mobo/RAM when explicit; TDP for power envelope | socket/memoryType can be inferred (not explicit); TDP may be null |
| Motherboard | id, name, socket, formFactor, memoryType (+explicit), memory_slots, max_memory_gb, max_memory_speed_mts (nullable) | socket↔CPU; memory type↔RAM; formFactor↔case | formFactor/memoryType may be inferred from name |
| RAM | id, name, type, speed, modules, capacity_gb_total (nullable) | type↔mobo/CPU; speed↔max_memory_speed when both present | speed/capacity may be null |
| GPU | id, name, tdp (nullable), length (nullable), psuMin (nullable), powerConnectors (nullable) | length↔case; psuMin↔PSU wattage; connectors↔PSU cables | length/tdp/psuMin/connectors may be null |
| PSU | id, name, wattage (nullable), pcieCables (nullable), pcie_power_connectors | wattage↔estimated load; connectors↔GPU | wattage/connectors may be null |
| Case | id, name, chassisType, maxGpuLength (nullable), coolerHeight (nullable), formFactors (+`formFactorEvidence`) | formFactors↔mobo; maxGpuLength↔GPU | formFactors can be `"unknown"` evidence; lengths may be null |
| Tiers | compatMeta tiers for CPU/GPU | not part of v1 findings; optional heuristic info | tier is a heuristic classification, not a fact |

### 2.3 What the quote import can and cannot prove

- Can: categories, product text, `itemId` (when the store quote includes it),
  store, offer/regular price strings, notes, quote `priceUpdatedAt`.
- Cannot (v1): verify that the text matches a catalog product unless `itemId`
  resolves exactly or the user confirms the match (§5). Price strings are
  validated by existing `parsePrice` semantics (invalid → no price).

### 2.4 Freshness semantics (reuse existing rules)

- Quote price freshness: `priceUpdatedAt` vs now; stale after 14 days
  (existing threshold in `App.jsx` price status).
- Catalog freshness: `meta.generatedAt` on the catalog snapshot. Separate
  fields, never merged.

## 3. Resolution states (Step 3)

Resolution is performed per quote row, in this order:

| State | Condition | Assessment behavior |
|---|---|---|
| `exact-id` | `itemId` (after `resolveCatalogId` aliases) matches a unique catalog item in the supported category | Full assessment of that component |
| `user-mapped` | No exact id; user explicitly selected a catalog item for the row (manual confirmation) | Full assessment of that component; finding records `source: "user"` |
| `ambiguous` | No exact id; the product text yields **one or more** candidate catalog items (normalized name-token match) that the user has not yet confirmed. One candidate → single-confirmation prompt; 2+ candidates → choice prompt | Component excluded from findings until confirmed; row listed as needing confirmation; verdict state contributes `unknown` |
| `unmatched-text` | No exact id and no catalog match | Excluded; never becomes a product match; verdict contributes `unknown`; info finding explains why |
| `unsupported-category` | Category outside the six supported (e.g., cooler, storage, monitor) | Excluded from v1 assessment; info finding lists it as out of scope |
| `integrated-gpu` | No GPU row and user explicitly confirms integrated graphics | GPU checks treated as satisfied-with-evidence; mirrors builder's `useIntegratedGpu` |

Candidate matching basis: the same normalized token-inclusion rule the
typeahead uses (lowercased label split on whitespace; every token must be
included). A single unconfirmed text candidate is `ambiguous` (not
`unmatched-text`), because the text alone must never be treated as an
identity.

**Invariant (STOP-condition guard):** free text alone never resolves to a
product. `exact-id` and `user-mapped` are the only states that produce
component evidence. This keeps v1 ID-resolved per the plan and defers fuzzy
matching indefinitely (unmatched rows simply remain unknown).

## 4. Versioned contracts (Step 2)

### 4.1 Analyzer input — `quote-analyzer/input/v1`

```
{
  schemaVersion: "quote-analyzer/input/v1",
  evaluatedAt: string,                       // caller-supplied ISO timestamp; determinism anchor (§4.4)
  quote: {
    id, name, currency, priceUpdatedAt,            // from normalizeQuote
    rows: [{ id, category, product, itemId, store, offerPrice, regularPrice, notes }]
  },
  userContext: {
    useCase: "gaming",                             // v1: only gaming (beachhead)
    targetResolution: "1080p" | "1440p" | "4k" | null,
    budget: { amount: number, currency: string } | null,   // informational in v1
    usesIntegratedGpu: boolean | null              // user confirmation
  },
  catalog: { cpus, motherboards, ramKits, gpus, psus, pcCases, meta },  // snapshot passed in
  catalogMeta: { generatedAt, schemaVersion },     // kept separate from quote snapshot
  aliases: { [oldId]: newId } | null               // from compatMeta
}
```

Notes:

- The analyzer is a **pure function** of this input. Callers (UI or a later
  corpus harness) build the input; the analyzer never fetches.
- `budget` is accepted but produces no finding in v1 (value conclusions are
  deferred, §7).

### 4.2 Analyzer output — `quote-analyzer/output/v1`

```
{
  schemaVersion: "quote-analyzer/output/v1",
  generatedAt: string,                      // copies input.evaluatedAt verbatim; never Date.now() (§4.4)
  verdict: {
    overall: "fail" | "warning" | "unknown" | "ok" | "incomplete",
    summary: string                      // 1-3 sentence verdict
  },
  dimensions: {
    compatibility: DimensionOutcome,     // socket/RAM/form-factor checks
    completeness:   DimensionOutcome,    // missing required components
    power:          DimensionOutcome,    // PSU wattage headroom
    connectors:     DimensionOutcome,    // PSU ↔ GPU connectors
    caseFit:        DimensionOutcome,    // GPU length, mobo form factor
    priceFreshness: DimensionOutcome,    // staleness of quote prices
    priceCompleteness: DimensionOutcome  // rows without prices
  },
  findings: [ AnalyzerFinding ],
  resolution: { [rowId]: "exact-id" | "user-mapped" | "ambiguous" | "unmatched-text" | "unsupported-category" },
  integratedGpu: boolean,
  sources: { catalogGeneratedAt, quotePriceUpdatedAt, rulesVersion }
}

DimensionOutcome = {
  status: "ok" | "warning" | "fail" | "unknown",
  summary: string,                       // human-readable one-liner
  findingIds: string[]
}

AnalyzerFinding = {
  id: string,                            // stable, e.g. "compat-cpu-mobo-socket"
  dimension: keyof dimensions,
  severity: "critical" | "warning" | "info",
  conclusion: string,                    // what was detected
  affected: string[],                    // row ids and/or component keys
  decisionType: "deterministic" | "derived" | "heuristic" | "probabilistic" | "preference-dependent" | "unsupported",
  evidence: {
    sourceFields: string[],              // e.g. ["cpu.socket", "mobo.socket"]
    source: "catalog" | "quote" | "user" | "rule",
    freshness: { catalogGeneratedAt, quotePriceUpdatedAt },
    ruleVersion: string
  },
  confidence: "high" | "medium" | "low",
  explanation: string,                   // why it matters
  action: string                         // what the user can do
}
```

Verdict precedence (reuses the builder's established severity order):

1. Any `fail` finding → `"fail"`
2. Any `warning` → `"warning"`
3. Any `unknown` (resolution gaps or missing evidence) → `"unknown"`
4. All assessed dimensions `ok` → `"ok"`
5. No assessable dimensions → `"incomplete"`

### 4.3 Evidence rules

- `decisionType` per finding is fixed by the check, not by the data.
- `confidence` is derived from evidence completeness: both sides present →
  high; one side present and other confirmed by user → medium; inferred
  catalog fields → low/medium as applicable.
- Identical inputs + same catalog snapshot + same `rulesVersion` → identical
  output (pure, deterministic).

### 4.4 Determinism (Plan 028 correction — approved 2026-07-31)

Determinism takes priority over wall-clock convenience. The analyzer is a
pure function and must never call `Date.now()` or construct a timestamp
itself. The caller supplies `evaluatedAt` (an ISO 8601 timestamp) in
`quote-analyzer/input/v1`; it anchors every freshness computation (quote price
age, catalog age, 14-day staleness) and is copied verbatim to output
`generatedAt`. All freshness semantics therefore depend only on the distance
between `evaluatedAt` and the quote/catalog timestamps, never on the moment
the function runs. Schema name `quote-analyzer/input/v1` is preserved; this
correction is part of the approved Plan 028 defaults.

## 5. Resolution and assembly pipeline (pure seam)

```
input rows
   │ 1. resolve(row)                    ── resolver.js ──
   ▼
resolution map (per row)
   │ 2. assemble(resolutions, catalog)   ── assemble.js ──
   ▼
normalized selection { cpu?, mobo?, ram?, gpu?, psu?, pcCase? } + gaps
   │ 3. assess(selection, userContext)   ── report.js ──
   ▼
dimensions + findings + verdict
```

- `resolve` reuses `resolveCatalogId` + aliases and normalizes category names
  with the same mapping the builder uses (`Procesador`, `Placa madre`, `RAM`,
  `Tarjeta de video`, `Fuente de poder`, `Gabinete`).
- `assess` composes the existing `checkCpuMoboCompatibility`,
  `checkRamMoboCompatibility`, `checkMoboCaseCompatibility`,
  `checkGpuCaseCompatibility`, `checkPsuPowerSufficiency`,
  `checkPsuConnectors`, and `estimatePowerEnvelope` from
  `src/lib/compatibility.js`, mapping each result into the finding model with
  the severity/status semantics fixed by Plan 014. No compatibility rule is
  weakened or duplicated.
- `evaluateSelection` is *not* reused as-is for the analyzer because its
  statuses array is builder-shaped; the analyzer maps the same underlying
  checks into the versioned finding model. A later wave may extract a shared
  check runner both consume (see backlog Phase F).

## 6. v1 findings (Step 4)

| Finding id | Check | decisionType | Severity mapping |
|---|---|---|---|
| `compat-cpu-mobo-socket` | CPU socket ↔ mobo socket | deterministic (or unknown) | fail if mismatch, warning/unknown per evidence |
| `compat-cpu-ram-memory` | CPU explicit memory type ↔ RAM type | deterministic | fail / warning |
| `compat-mobo-ram-memory` | mobo memory type ↔ RAM type | deterministic | fail / warning |
| `compat-mobo-case-ff` | mobo formFactor ↔ case formFactors | deterministic / unknown (formFactorEvidence) | fail / unknown |
| `compat-gpu-case-length` | GPU length ↔ case maxGpuLength | deterministic when both present | fail / unknown |
| `power-psu-headroom` | estimated load vs PSU wattage (est. from CPU+GPU TDP) | derived | fail if below recommended; warning if margin thin. Subsumes the builder's GPU `psuMin`-vs-wattage warning (a `psuMin` above PSU wattage always yields at least `warning` here) |
| `power-connectors-pcie` | GPU connectors vs PSU PCIe cables | deterministic when both present | fail if missing |
| `completeness-missing-required` | required components absent from resolution | deterministic | critical when a required category is missing |
| `completeness-required-resolution-gap` | required component in ambiguous/unmatched state | derived | warning; blocks verdict with unknown |
| `price-completeness-rows` | rows without valid prices vs total | derived | warning |
| `price-freshness-age` | `priceUpdatedAt` older than 14 days (or absent) | derived | warning |
| `price-freshness-catalog` | catalog `generatedAt` age reported as info | derived | info |

Required components for a verdict (**approved 2026-07-31 — §12.1**):

- CPU, GPU or confirmed integrated graphics, PSU, case; motherboard and RAM
  required for full technical-validity verdict but a quote missing them
  degrades to `unknown`/`incomplete` rather than `fail` on those dimensions.

## 7. Explicitly deferred (never claimed in v1)

- Workload suitability beyond "gaming" (only `useCase: "gaming"` accepted).
- Performance balance / bottleneck conclusions (`estimateCpuGpuBalance` output
  is not exposed as a finding; a heuristic balance hint requires a separately
  validated performance model and evidence source. Automated compatibility
  conformance does not qualify it).
- Value-for-money, "total price reasonable", budget-vs-price conclusions,
  price comparison across stores, and cheapest-combination calculations.
- Upgradeability, thermals, noise, durability, BIOS support.
- Fuzzy/AI product matching; international pricing; universal score.
- Cooler, storage, monitor, and other unsupported categories.

Every deferred dimension is recorded as an `unsupported` evidence state if the
interface ever displays the dimension label, per the vision's rule that a
dimension is supported only when its inputs, coverage, validation, and
thresholds are defined.

## 8. Fixture classes and wire-level examples (Step 5)

All fixtures build on the existing `src/test/fixtures.js` catalog values
(`cpuIntel`, `cpuAmd`, `moboLga`, `moboAm5`, `ramDdr5_1`, `gpuLow`,
`gpuHigh`, `psu750`, `psu500`, `caseAtx`, `caseItx`) so the implementation
plan reuses one fixture universe. F3 and F4 require two additions to that
universe: a marginal PSU with two 8-pin cables (`psuMarginal`, 550 W) and
sparse records with `tdp: null` for the insufficient-evidence case.

### F1 — Exact-ID valid quote → verdict `ok`

Input rows (all `exact-id`): cpu-1 (Intel i5, LGA1700), mobo-1 (Z790, LGA1700,
DDR5), ram-1 (DDR5), gpu-1 (RTX 4060, 115W, psuMin 450), psu-1 (750W), case-1
(ATX, GPU ≤350mm). `priceUpdatedAt` = today, all rows priced.

Expected: verdict `ok`; 0 critical; dimensions compatibility/power/
connectors/caseFit/price ok; findings: none or only `price-freshness-catalog`
info.

### F2 — Confirmed incompatible → verdict `fail`

Rows: cpu-2 (AMD AM5) + mobo-1 (LGA1700), both `exact-id`, rest as F1.

Expected finding: `compat-cpu-mobo-socket`, severity critical,
decisionType deterministic, confidence high, evidence
`["cpu.socket","mobo.socket"]`, action: replace CPU or motherboard.

### F3 — Warning-only → verdict `warning`

Rows: cpu-1 + mobo-1 + ram-1 + gpu-2 (RX 7800 XT, psuMin 650) + `psuMarginal`
(550 W, 2x 8-pin — new fixture) + case-1.

Expected: `power-psu-headroom` warning (550 W ≥ 438 W estimated load but
< 650 W recommended), connectors satisfied (2x 8-pin), all compatibility
checks ok; verdict `warning`, no critical.

Note: using the existing `psu-2` (500 W, 1x 8-pin) instead produces a
connector failure (`Faltan 8-pin`) and verdict `fail`, which is why the
warning-only fixture needs `psuMarginal`.

### F4 — Insufficient evidence → verdict `unknown`

Rows: exact-id components whose catalog records have `tdp: null` (sparse
fixture records — new), and no `priceUpdatedAt`.

Expected: power dimension `unknown` (no TDP, no PSU conclusion);
`price-freshness-age` warning with an absent timestamp (existing staleness
semantics: an unverifiable date degrades to warning, not `ok`); verdict
`unknown` driven by the power evidence gap; findings carry confidence `low`
and `decisionType: "unsupported"` where checks could not run.

### F5 — Ambiguous identity → verdict `unknown` (no false claims)

Rows: `itemId: ""`, product text "Intel Core" (token-matches cpu-1 and cpu-3
by name).

Expected: resolution `ambiguous` for that row (2 candidates); no
compatibility finding claims the CPU; `completeness-required-resolution-gap`
warning; verdict `unknown`. The output never names a product for that row.

### F6 — Stale/partial price → verdict `warning` (prices only)

Rows: F1 set; half the rows without prices; `priceUpdatedAt` 20 days old.

Expected: `price-completeness-rows` and `price-freshness-age` warnings; verdict
`warning`; technical dimensions still `ok`; freshness evidence shows the
separate quote and catalog timestamps.

### F7 — Malformed import → analyzer refuses (import error path)

CSV without component/product columns, or empty file: existing
`parseCsvToQuote` throws; the analyzer never runs. Test asserts the existing
error message and that no partial analysis is produced.

## 9. Acceptance criteria (Step 6)

1. **Contract approval**: `quote-analyzer/input/v1` and
   `quote-analyzer/output/v1` schemas are approved and versioned.
2. **Coverage**: all seven fixture classes (F1-F7) pass with asserted
   verdicts, findings, and resolution states.
3. **No false positives on evidence**: every finding exposes
   decisionType/confidence/evidence/freshness/ruleVersion/action; no finding
   is emitted for a dimension whose inputs are missing (it is `unknown`, not
   `ok`).
4. **Determinism**: identical input + catalog snapshot + rulesVersion →
   byte-identical output.
5. **Automated critical-hazard assurance**: every supported deterministic or
   derived rule passes the implementation-independent conformance suite, and
   the assurance harness detects every enumerated critical false-negative
   negative control. The production Analyzer reports no supported conformance
   hazard as `ok` (Milestone 2 gate). This bounded result is not described as a
   universal real-world false-negative rate.
6. **Resolution rate**: ≥80% of required components resolve as `exact-id` or
   after one explicit `user-mapped` confirmation on the validation corpus
   (Milestone 2 gate).
7. **Performance**: analysis of a 20-row quote completes in well under
   100 ms (pure functions over the in-memory catalog; no network).
8. **Behavioral invariance**: builder assessment, import, and price flows
   keep their current tests green; the analyzer shares rules but changes no
   existing behavior.

## 10. Implementation backlog with file boundaries (Step 5)

| Phase | Deliverable | Files (proposed) | Verification |
|---|---|---|---|
| A | Pure resolver + fixtures | `src/lib/quoteAnalyzer/resolver.js`, `src/lib/quoteAnalyzer/resolver.test.js`, fixtures in `src/test/fixtures.js` | focused Vitest |
| B | Pure assembly (rows → normalized selection) | `src/lib/quoteAnalyzer/assemble.js`, `.test.js` | focused Vitest |
| C | Report builder (dimensions/findings/verdict) | `src/lib/quoteAnalyzer/report.js`, `.test.js` | focused Vitest + all F1-F7 |
| D | Contracts file (JSDoc until Plan 027 unblocks; then types) | `src/lib/quoteAnalyzer/contracts.js` | typecheck when enabled |
| E | UI: analyzer screen, confirmation flow for ambiguous rows, verdict panel reusing existing assessment UI patterns | `src/components/QuoteAnalyzer.jsx`, `src/App.jsx` wiring, `src/App.test.jsx` | `npm run check` |
| F | Optional: extract shared check runner used by both `selectionEvaluation` and the analyzer | `src/lib/compatibility.js` refactor (behavior-preserving) | full suite green |
| G | Milestone 2 automated conformance and private coverage harnesses (offline, out of SPA) | `scripts/` (Plan 035) | conformance and coverage reports pass |

Each phase is its own implementation-plan slice; this design does not
authorize phases E-G without approval.

## 11. Test plan (design-level)

The implementation plan must include the seven fixture classes (F1-F7) above,
keeping sad-path runtime tests for: null/empty selections, missing catalog
fields, malformed imports, resolution gaps, unknown assessment, and browser
file APIs. No snapshots, no second test runner.

## 12. Open decisions for the project owner

> **Resolution record (Plan 028, approved 2026-07-31).** The project owner
> approved all six v1 defaults below. They are binding for the v1 core and
> must not be silently amended by a later plan:

1. **Required-component set for the `ok` verdict.** **Approved:** a fully
   `ok` technical verdict requires CPU, motherboard, RAM, PSU, case, and
   either a resolved GPU or explicit integrated-graphics confirmation. A
   missing or unresolved required component produces `unknown`/`incomplete`,
   never a fabricated compatibility failure.
2. **GPU tier display.** **Approved:** CPU/GPU tiers are not findings and are
   not exposed by the v1 report. Any future tier surfacing requires a new
   owner decision after a separately validated performance model and evidence
   source exist; automated compatibility conformance does not validate gaming
   balance.
3. **14-day price staleness.** **Approved:** quote prices become stale after
   14 days, matching existing builder behavior and measured against
   `evaluatedAt`.
4. **Analyzer assurance.** **Amended by owner decision on 2026-07-31:** Plan
   035 owns a committed automated conformance suite and a separate private,
   unlabeled real-quote coverage corpus. Plan 029's human-review/adjudication
   workflow is superseded and is not a launch dependency.
5. **Ambiguous-row UX.** **Approved:** a user-confirmed mapping
   (`user-mapped`) applies only to the current analysis; it is never silently
   persisted as a global alias. Persistence is a separate owner decision.
6. **`useCase` and budget.** **Approved (Plan 028 default):** `useCase` is
   `gaming` only; budget is stored as context but produces no value or
   affordability conclusion in v1.

> The original decision proposals above are superseded by the resolution
> record; they remain visible in git history. Also updated by Plan 028: the
> v1 defaults for required components (§6), tier non-exposure (§7), and the
> per-analysis mapping scope (§3) align with §12 above.

## 13. STOP-condition review

| STOP condition | Status |
|---|---|
| Design requires fuzzy matching for a trustworthy v1 | Not hit — v1 is ID-resolved; unmatched text stays unknown |
| IDs ambiguous because Plan 018 incomplete | Not hit — Plan 018 is DONE; aliases handled at resolution |
| Score proposed without visible dimensions | Not hit — multidimensional output; no universal score |
| Owner must choose required categories | **Flagged** as open decision §12.1; design proceeds with a stated proposal and the implementation plan must not start until confirmed |

## 14. Relationship to adjacent plans

- **Plan 025 (Guided Builder)**: must consume this analyzer output contract;
  the vision forbids guided recommendations before this shared assessment
  contract and Milestone 2 gates exist.
- **Plan 026 (scenario comparison)**: comparison is only meaningful over
  analyzer verdicts; depends on this design.
- **Plan 027 (TypeScript)**: blocked; contracts here are written
  implementation-language-agnostic (JSDoc-ready) so Phase D can adopt types
  when unblocked.
