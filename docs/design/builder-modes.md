# Builder Modes: separate intent-first Guided and manual Expert Builder experiences

> **Status**: Plan 025 design deliverable, 2026-07-30. Design/data spike — no production UI or recommendation rules were implemented or authorized by this document.
>
> **Governance**: Read together with the Canonical Product Vision and `docs/design/quote-analyzer.md`. The shared assessment contract is defined there; this document defines the two builder surfaces that will consume it.

## 1. Problem and users

The current UI labels a component-by-component picker "Builder guiado" (`App.jsx:748`), but its selection model contains only six component IDs and an integrated-GPU flag (`EMPTY_BUILDER`, `builderReducer.js:10-18`). There is no intent, budget, workload, priority, or owned-parts model. The vision requires two explicit experiences: a **Guided Builder** where users who do not know their components answer understandable questions and receive explained builds, and an **Expert Builder** where users with complete control select manually, compare alternatives, override, and inspect detailed compatibility without being forced through a questionnaire.

Value: beginners get defensible starting builds without drowning in part numbers; experts keep unrestricted inspection and override. Both share the same assessment engine, so a guided proposal degrades gracefully into an expert session and vice versa.

## 2. Baseline: the current picker as the candidate Expert Builder

The existing picker is the production baseline for the Expert surface. It already implements hard compatibility filtering and live assessment:

| Capability | Current state | Gap for Expert Builder |
|---|---|---|
| Component selection | 6 steps: CPU → Placa madre → RAM → GPU → Fuente → Gabinete (`BUILDER_STEPS`) | No persistent "apply to quote" evidence trail per component |
| Dependency filtering | Mobo by CPU socket; RAM by mobo/CPU memory type; case by mobo form factor + GPU length (`App.jsx:31-70`); PSU by wattage floor `recommendedPsuWatts - 100` (`App.jsx:209-212`, `psuOptionsForStep`) | Filter reasons are not shown as evidence |
| Auto-clear on conflict | CPU change clears mobo/ram; mobo change clears ram/case; GPU change clears case (`App.jsx:313-355`) | Destructive clears are silent — no "we cleared X because Y" |
| Live assessment | `evaluateSelection`: issues, warnings, statuses, summaryVerdict, selectionChips (`App.jsx:197`) | No per-component explanation of *why this part was chosen* |
| Power | `estimatePowerEnvelope`, `checkPsuPowerSufficiency`, `checkPsuConnectors` (compatibility.js) | PSU connector data missing for 100% of PSUs (0/2128 `pcie_power_connectors`); `checkPsuConnectors` reports `unknown` on missing data — never a confirmed incompatibility (2026-07-30 fix) |
| Tiers | CPU tier 1-4 (961 items), GPU tier 1-4 (3869 items) via `compatibility.min.json` | Tier is displayed raw, never translated to workload fit |
| Data staging | Staged catalog loading by builder step (`useCatalog` `neededCategories`) | Prices are not part of the catalog at all |

**Critical data fact**: the catalog carries **no prices** (verified 2026-07-30: `cpus.min.json`, `gpus.min.json`, `psus.min.json` have no price fields; `compatibility.min.json` has no price map). Prices exist only in user-imported quote rows (per-store offer/regular price, 14-day staleness). Budget and value rules must therefore be designed as *preference markers* in v1, not price-ranking rules.

## 3. Guided Builder intake schema (v1)

Minimum intake mapped one-to-one from the vision's question list. Versioned as contract `builder-intent/input/v1`.

| Field | Vision question | Values | Rule status | Missing-data behavior |
|---|---|---|---|---|
| `primaryUse` | What will the PC be used for? | `gaming` (v1-supported), `office`, `workstation` (evidence-gated) | deterministic | default `gaming` (beachhead) |
| `secondaryUse` | Which games, applications, or workloads matter most? | free text + optional workload tags | heuristic → free text is stored, never auto-mapped without evidence | kept as note, does not drive rules |
| `budgetScope` | What is the maximum budget? | `total` (tower + monitor + peripherals), `towerOnly` | preference-dependent | stored; cost estimation unsupported (no price data) |
| `budgetAmount` | — | CLP integer | preference-dependent | constraint only when prices exist for every proposal component |
| `targetResolution` | What resolution and performance level? | `1080p` / `1440p` / `4k` / `unknown` | heuristic (tier-band mapping, see §4.3) | default `1080p` |
| `performanceLevel` | — | `entry` / `mid` / `high` / `flagship` | heuristic | derived from resolution if absent |
| `priorities` | Performance, silence, appearance, efficiency, compactness, upgradeability | ordered subset, max 3 | preference-dependent | default `[performance, upgradeability]` |
| `ownedParts` | Does the user own reusable components? | list of owned catalog IDs + free text | deterministic for IDs; heuristic for text | text stored as note, never auto-resolved (mirrors Quote Analyzer §2 rule) |
| `regionCurrency` | — | `CLP` (default), free-form | preference-dependent | default CLP |
| `acceptableTradeoffs` | — | allow integrated-GPU start, allow older socket, prioritize budget over tier | preference-dependent | defaults per persona |

Rules on intake: every field declares `deterministic | derived | heuristic | preference-dependent | unsupported` (decision/evidence contract from the vision). Fields that would require unavailable data (e.g., workload-to-component mapping for non-gaming) are marked `unsupported` and stored only as context.

## 4. Recommendation contract

### 4.1 Dimensions

| Dimension | Rule status | Inputs | Output |
|---|---|---|---|
| Compatibility | deterministic | socket, memory type, form factor, GPU length, wattage, connectors | per-component verdict from the shared taxonomy (confirmed / potential / suboptimal / missing-data / valid) |
| Performance fit | derived | CPU/GPU tier (1-4) + target resolution + performance level | tier-band match, `derived` with declared mapping |
| Power adequacy | deterministic | tdp_w, suggested_psu_w, PSU wattage, connector availability | OK / insufficient / unverifiable |
| Balance | derived | CPU vs GPU tier via `estimateCpuGpuBalance` | tier delta + direction (which side caps) |
| Budget | preference-dependent | budgetAmount + scope | constraint marker; **no ranking** — cost estimation `unsupported` without prices |
| Value | unsupported in v1 | — | not computed; explanation states why (no price source) |
| Upgradeability | heuristic | socket generation age / platform recency | labeled estimation, never a hard claim |

### 4.2 Evidence rules (mandatory, from the vision's decision/evidence contract)

1. Every proposed component carries: inputs used, rule status, missing-data note, confidence (`verified` / `estimated` / `unknown`), and alternatives considered.
2. No opaque composite score. Tiers are shown as tier bands, never converted into synthetic "performance points" (no invented benchmark precision).
3. Retailer/affiliate signals never affect recommendation order — **no price ranking at all in v1**, so the bias rule is structurally satisfied.
4. Freshness/provenance: catalog `generatedAt` and any price staleness are visible on every proposal (reuse the 14-day staleness semantics from the quote analyzer F4).
5. Free text (secondaryUse, owned parts) never resolves to a product automatically.

### 4.3 Performance mapping (heuristic, declared)

| Target | CPU tier band | GPU tier band |
|---|---|---|
| 1080p / entry | 1-2 | 1-2 |
| 1440p / mid | 2-3 | 2-3 |
| 4k / high | 3-4 | 3-4 |
| flagship | 4 | 4 |

Confidence: `estimated`. This mapping is a default proposal heuristic, never a claim; the user can adjust performance level and the mapping is re-applied deterministically. Owner decision required to change bands (see §8).

### 4.4 No-result and degraded-result behavior

- **No budget-matched build**: proposal explains "we cannot reach your tier target within budget" and offers the nearest lower tier-band build with the delta shown; never an empty result.
- **No compatible build at all**: state the blocking constraint (e.g., owned parts incompatible with all options), offer constraint removal (owned parts or priorities), and hand to Expert Builder.
- **Insufficient data**: components with missing specs are excluded from *filters* (current behavior: "si falta dato, no se excluye") but flagged in evidence; the proposal marks affected dimensions `unknown` instead of `verified`.

## 5. Flows and handoff

### 5.1 Guided flow

1. Intake (intent questions) → intent record `builder-intent/input/v1`.
2. Engine generates proposal candidates from the shared assessment contract (compatibility-validated, tier-band targeted).
3. Proposal shows 1-3 builds, each with per-component evidence (§4.2) and the resolved assumptions.
4. "Open in Expert Builder" handoff: the proposal materializes as full builder state **plus the intent record attached**, so assumptions and evidence survive; expert edits never lose the original guided rationale.

### 5.2 Expert flow

Current picker + three additions:

1. **Evidence panel per component** — why this part fits (which filter matched, tier, power contribution), using the same shared assessment contract as the analyzer.
2. **Alternatives** — same-category parts within one tier band, listed with the differences (never ranked by retailer).
3. **Non-destructive conflict resolution** — replace today's silent auto-clears with an explicit "we removed X because Y" notice; expert override is always recorded as a user decision, never reverted.

### 5.3 Mode rules

- Guided and Expert are separate routes sharing the assessment engine and catalog — no duplicated compatibility logic.
- A guided proposal can always open in Expert mode; the reverse (expert build → guided) is not a goal in v1.
- Warnings inform, never block (vision: "Warnings must inform rather than unnecessarily block the user").

## 6. Personas and expected outputs

| # | Persona | Intent | Expected multidimensional output | Data posture |
|---|---|---|---|---|
| P1 | Gonzalo, gaming beachhead (vision §persona) | 1440p, tower-only CLP 1.2M, priorities performance+upgradeability | 2 builds: mid-tier AMD + Intel; per-part evidence; balance notes; budget marker "within/over" only if prices exist | tiers full, tdp_w full, prices absent → budget shown as preference only |
| P2 | María, constrained office | ≤ CLP 500k total, integrated-GPU acceptable, office+web | single build with integrated-GPU start; explanation of why dedicated GPU is not proposed; silent case note | CPU tier 1-2; no prices |
| P3 | Pablo, development/workstation | compile + VM workloads | **deferred**: workload→component mapping is `unsupported` (no benchmark data). Proposal explains deferral and offers mid-high tier manual defaults with evidence labels | no licensed benchmark source |
| P4 | Daniela, owned-parts upgrade | owns PSU + case; buys cpu/mobo/ram/gpu | proposals exclude owned parts from cost scope; owned parts integrated into compatibility validation; connector/power checks flagged `unknown` where PSU connector data missing | PSU connectors 0/2128 → honest unknown |
| P5 | Luis, no-valid-build / insufficient data | minimal budget + conflicting priorities (performance vs silence vs budget) | conflict explanation, constraint removal suggestions, handoff to Expert with intent record | demonstrates §4.4 paths |

P3 is deliberately gated: its rule would require unavailable performance/benchmark data, triggering the plan's STOP condition. The design does not encode it.

## 7. Phased implementation backlog (future plans, owner-approved only)

| Phase | Contents | Gate |
|---|---|---|
| A | Expert evidence panel + alternatives + non-destructive conflicts (no new recommendation rules) | none beyond current engine — production-safe today |
| B | Intake schema + deterministic gaming recommendation engine | **shared analyzer assessment contract in production (Plan 024 implementation) + Milestone 2 quality gates** (vision sequencing, plans/README) |
| C | Proposal presentation + guided→expert handoff | Phase B |
| D | Budget/value rules | a licensed or source-verifiable price feed exists (owner decision, plan 024 §12 companion) |
| E | Non-gaming workloads | benchmark data with declared provenance (P3) |
| F | Alternatives/comparison polish | coordinate with Plan 026 (scenario comparison) |

## 8. Explicit owner decisions requested

1. **Initial persona scope**: adopt the vision beachhead (Chile, non-expert, gaming) as the only v1-encoded persona, with P2-P5 as fixture/design personas (recommended), vs. encoding office personas in v1.
2. **Budget semantics**: budget stored as preference marker in v1 (recommended, given no price data) vs. blocking constraint even without prices.
3. **Performance-band mapping** (§4.3): confirm default bands or provide alternatives.
4. **Guided Builder timing**: confirm Phase B stays gated on the analyzer contract + Milestone 2 gates (recommended) vs. earlier production pilot.
5. **Silent-clear replacement**: confirm non-destructive conflict resolution for Expert (recommended) is acceptable before Phase A planning.

## 9. Test and acceptance plan

Fixtures (deterministic, no live data): P1 gaming, P3 dev/workstation (deferral path), P2 constrained office budget, P4 owned-part upgrade, P5 insufficient-data/no-valid-build. Invariant tests:

- **Budget invariant**: proposals never exceed a *priced* budget; with no prices, budget never pretends to be enforced.
- **Compatibility invariant**: every proposal passes the shared assessment; flagged `unknown` never rendered as `ok` (mirrors Plan 014 severity semantics).
- **Explanation invariant**: every proposed component carries rule status + confidence + alternatives.
- **Uncertainty invariant**: missing-data dimensions are labeled `unknown`, never `verified`.
- **Override invariant**: expert overrides persist and are recorded; guided assumptions never silently re-apply after handoff.
- **Bias invariant**: no rule reads retailer or store identity.

Acceptance: personas above produce the expected multidimensional outputs; all five fixture scenarios covered; handoff preserves intent record and evidence.

## 10. Scope boundaries (unchanged from plan)

Out of scope: production route/UI replacement, ML/AI recommendations, benchmarks without licensed/source data, automated prices, retailer ranking. This document is a design; implementation requires new owner-approved plans (Phase A could start immediately; B+ are gated).
