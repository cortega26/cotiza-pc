# Decision-funnel measurement contract (Plan 031)

> Status: approved design contract, not yet instrumented.
> Plan 032 owns wiring events into the App; this document is the governing
> definition of what is measured, what is forbidden, and how events flow.
>
> **This plan does not authorize any network transmission.** No analytics
> provider, cookie, beacon, endpoint, database, dashboard, or dependency is
> approved here. Provider/hosting, consent presentation, retention, deletion,
> and access decisions belong to the project owner and must be explicit before
> any future sink is added. This technical plan is not legal advice; if Chilean
> legal or privacy requirements are unclear, request qualified review.

## 1. Purpose

The product must distinguish page views from qualified purchase decisions.
Milestone 0 requires operational definitions for organic acquisition, product
starts, qualified activations, and decision actions; Milestone 2 requires
median time-to-verdict under seven minutes; Milestone 3 requires sustained
organic-product thresholds. This contract defines exactly which observations
count, which are excluded, and which raw data classes are never observed.

Principles:

- **Measure product learning, not user surveillance.** Every payload field must
  have a documented metric purpose.
- **Never collect raw quote text, component names/IDs, store names, notes,
  exact prices/budgets, uploaded files, contact details, IP addresses, or
  persistent cross-device identifiers.**
- Permitted fields are categorical states, aggregate counts, coarse duration,
  acquisition class, schema/rules/catalog versions, and explicit decision
  action.
- `unknown` and `incomplete` remain separate from qualified verdicts and never
  count as success.
- Reliability metrics come from Plan 035's automated conformance report, never
  from client events. Real-quote client/corpus observations measure coverage
  and product behavior, never ground-truth correctness.
- A React render is never an event. Events are emitted only from explicit
  state transitions or user actions.
- Assessment must keep working when measurement fails. Measurement is an
  observation layer, never a dependency of product assessment.

## 2. Metric glossary

Every metric has an operational definition, a formula, and an exclusion rule.

### 2.1 Events

| Event | Operational definition | Emitted when |
|---|---|---|
| `product_start` | A user begins the product workflow in the current session, once per session. | The first explicit interaction that starts a quote after the app loads (opening a quote, creating one, or starting an import). |
| `quote_input_completed` | A complete quote input is accepted: manual rows are all entered and confirmed, or an import/parse succeeds. | The transition into the state where the quote is editable and runnable. |
| `identity_confirmation_requested` | The analyzer found rows it cannot resolve exactly and the confirmation UI is shown. | The transition into the confirmation screen. |
| `identity_confirmation_completed` | The user confirmed or dismissed every ambiguous row, ending the confirmation step. | The transition out of the confirmation screen. |
| `evidence_qualified_verdict_viewed` | The evidence-qualified verdict panel is opened and revealed to the user. | The transition into the verdict-displayed state (first time per analysis). |
| `finding_evidence_opened` | The user expands the evidence block of one finding. | The explicit expand action on a finding's evidence. |
| `decision_action_recorded` | The user records a consequential decision action on the analyzed quote. | The explicit action click: keep, change, reject, negotiate, compare, or defer. |
| `return_within_purchase_window` | **Deferred.** A user rechecks, compares, or shares within 30 days of activation. Requires a future privacy-approved mechanism (e.g. per-device, consent-based, or hosted-quote identity). Not implemented in this contract. | Never emitted in v1. |

### 2.2 Qualified activation

A user is **qualified-activated** when, in the same session and analysis, all
of the following hold:

1. **Input completed**: `quote_input_completed` was emitted.
2. **Context supplied**: gaming use, budget, and target resolution context were
   provided.
3. **Identity resolved**: all six required component categories (CPU,
   motherboard, RAM, GPU or confirmed integrated graphics, PSU, case) resolved
   exactly or after explicit user confirmation.
4. **Evidence requirements met**: every high-severity (critical) finding
   exposes evidence, freshness, confidence, rule version, and next action.
5. **Verdict opened**: `evidence_qualified_verdict_viewed` was emitted with
   `qualifiedActivation: true`.

**Formula**: activation rate = qualified verdict views ÷ product starts in the
cohort period.

**Exclusion rules**:

- A verdict with `overall` equal to `unknown` or `incomplete` can never be a
  qualified activation; the contract enforces `qualifiedActivation: false` for
  those verdict states.
- Creating a quote or viewing the landing page is not activation.
- Re-visiting an existing verdict does not re-activate; activation counts once
  per analysis.

### 2.3 Time to verdict

- **Start**: the `quote_input_completed` timestamp (first completed input in
  the session).
- **End**: the `evidence_qualified_verdict_viewed` timestamp.
- **Reported value**: `timeToVerdictMs`, the active accumulated time between
  start and end, bounded to `MAX_DURATION_MS` (6 hours). The emitter
  accumulates active time and excludes idle gaps of 15 minutes or more
  (pause rule).
- **Abandonment**: a session with `quote_input_completed` but no
  `evidence_qualified_verdict_viewed` within 7 days of start. Abandoned
  sessions are excluded from the median and counted in the abandonment rate.
- **Formula**: median active time-to-verdict across qualified verdict views in
  the cohort.
- **Exclusion**: verdicts with `overall` `unknown`/`incomplete` are excluded
  from the median (they are not qualified verdicts); they are counted as
  funnel drops instead.

### 2.4 Decision action

Allowed actions, all explicit user records:

| Action | Meaning |
|---|---|
| `keep` | Proceed with the quote as analyzed. |
| `change` | Modify one or more components as a result of the analysis. |
| `reject` | Drop the quote or a component. |
| `negotiate` | Seek a price or availability adjustment with a supplier. |
| `compare` | Analyze a competing quote or modified scenario. |
| `defer` | Postpone the decision to a later date. |

**Formula**: decision-action rate = decision actions recorded ÷ qualified
verdict views in the cohort. At most one `decision_action_recorded` per
analysis.

### 2.5 Unknown and incomplete

- `unknown` (resolution gaps or missing evidence) and `incomplete` (nothing
  assessable) are funnel states, never success states.
- A quote whose required components are unresolved, or whose high-severity
  findings lack required evidence fields, cannot produce a qualified verdict.
- `identity_confirmation_completed` with `resolutionOutcome` other than
  `all-resolved` is never followed by a qualified activation.

### 2.6 Reliability

- Recommendation reliability, uncertainty, freshness, and guardrail metrics
  come from Plan 035's automated conformance report and corpus observations,
  not from browser events.
- Client events never measure correctness. Client/corpus observations measure
  coverage and product behavior only.

### 2.7 Derived funnel metrics

| Metric | Formula | Exclusions |
|---|---|---|
| Non-branded organic sessions | `product_start` with `acquisitionClass: "non-branded-organic"` | sessions without a `product_start` |
| Qualified activations | `evidence_qualified_verdict_viewed` with `qualifiedActivation: true` | `unknown`/`incomplete` verdicts; repeated views |
| Start → verdict conversion | qualified verdict views ÷ `product_start` | abandoned sessions (separate rate) |
| Median time to verdict | median of `timeToVerdictMs` over qualified verdict views | abandoned sessions, `unknown`/`incomplete` verdicts |
| Identity-resolution coverage | (exact + confirmed) ÷ required components from `identity_confirmation_completed` | sessions that never reached confirmation |
| Decision-action rate | `decision_action_recorded` ÷ qualified verdict views | duplicate actions per analysis |
| Follow-up impact (Milestone 3) | owner-led survey: fraction of followed-up activated users reporting the analysis changed or materially confirmed their decision | survey cohort definition owned by the operator, never client events |

## 3. Privacy envelope

### 3.1 Field allow-list

Events carry only the fields below. All values are categorical states, counts,
versions, or the bounded duration described in §3.3. There are no nested
objects in any payload.

| Field | Type | Events | Bounds / enum |
|---|---|---|---|
| `schemaVersion` | string (fixed) | all | `decision-measurement/event/v1` (set by the contract) |
| `name` | string (fixed) | all | event name (set by the contract) |
| `timestamp` | ISO 8601 string | all | caller-supplied; deterministic tests inject fixed values |
| `sequence` | non-negative integer | all | per-session monotonic counter (adapter-stamped) |
| `sessionToken` | string (ephemeral) | all | in-memory, per-tab; never persisted |
| `acquisitionClass` | enum | `product_start` | `non-branded-organic` \| `branded-organic` \| `direct` \| `referral` \| `unknown` |
| `catalogVersion` | string ≤ 64 | `product_start`, `quote_input_completed`, `identity_confirmation_completed`, `evidence_qualified_verdict_viewed`, `decision_action_recorded` | catalog snapshot version reported by the loader |
| `inputMethod` | enum | `quote_input_completed` | `manual` \| `import-json` \| `import-csv` \| `paste-structured` |
| `rowCount` | int 0–1000 | `quote_input_completed` | clamped |
| `missingPriceRowCount` | int 0–1000 | `quote_input_completed` | clamped; never ≤ 0 when there are no rows |
| `currency` | enum | `quote_input_completed` | `CLP` \| `USD` \| `EUR` \| `other` |
| `analyzerInputSchemaVersion` | string (fixed) | `quote_input_completed` | `quote-analyzer/input/v1` |
| `ambiguousRowCount` | int 0–1000 | `identity_confirmation_requested` | clamped |
| `requiredComponentCount` | int 1–6 | `identity_confirmation_requested` | fixed 6 in v1; clamped |
| `resolutionOutcome` | enum | `identity_confirmation_completed` | `all-resolved` \| `partial` \| `none` |
| `resolvedExactCount` | int 0–6 | `identity_confirmation_completed` | clamped |
| `resolvedConfirmedCount` | int 0–6 | `identity_confirmation_completed` | clamped |
| `remainingAmbiguousCount` | int 0–6 | `identity_confirmation_completed` | clamped |
| `rulesVersion` | string (fixed) | `identity_confirmation_completed`, `evidence_qualified_verdict_viewed`, `finding_evidence_opened`, `decision_action_recorded` | `quote-analyzer/rules/v1` |
| `verdictOverall` | enum | `evidence_qualified_verdict_viewed`, `decision_action_recorded` | `ok` \| `warning` \| `fail` \| `unknown` \| `incomplete` |
| `criticalFindingCount` | int 0–200 | `evidence_qualified_verdict_viewed` | clamped |
| `warningFindingCount` | int 0–200 | `evidence_qualified_verdict_viewed` | clamped |
| `unknownFindingCount` | int 0–200 | `evidence_qualified_verdict_viewed` | clamped |
| `qualifiedActivation` | boolean | `evidence_qualified_verdict_viewed` | must be `false` when `verdictOverall` is `unknown`/`incomplete` |
| `timeToVerdictMs` | int 0–21,600,000 | `evidence_qualified_verdict_viewed` | clamped; active accumulated time |
| `identityResolutionCoveragePercent` | int 0–100 | `evidence_qualified_verdict_viewed` | clamped |
| `analyzerOutputSchemaVersion` | string (fixed) | `evidence_qualified_verdict_viewed` | `quote-analyzer/output/v1` |
| `findingKey` | string ≤ 64 | `finding_evidence_opened` | stable rule id, e.g. `compat-cpu-mobo-socket` |
| `severity` | enum | `finding_evidence_opened` | `critical` \| `warning` \| `info` |
| `decisionType` | enum | `finding_evidence_opened` | `deterministic` \| `derived` \| `heuristic` \| `probabilistic` \| `preference-dependent` \| `unsupported` |
| `evidenceSource` | enum | `finding_evidence_opened` | `catalog` \| `quote` \| `user` \| `rule` |
| `evidenceItemCount` | int 0–50 | `finding_evidence_opened` | clamped |
| `action` | enum | `decision_action_recorded` | `keep` \| `change` \| `reject` \| `negotiate` \| `compare` \| `defer` |

### 3.2 Deny-list (never collected)

The following raw-data classes are forbidden in any payload, at any nesting
depth. The contract rejects any payload containing these field names:

- quote rows or raw quote text; component names, product names, or IDs
- `itemId`-style identifiers
- store or retailer names
- user notes
- exact prices or budgets (`offerPrice`, `regularPrice`, `budgetAmount`, and
  any price-like field)
- uploaded file names or contents
- contact details (`email`, `phone`, names)
- IP addresses, user-agent strings, or any persistent cross-device identifier
- full referrer URLs (only the coarse `acquisitionClass` is collected)
- clock-exact wall-clock activity times (only relative bounded durations)

Unknown keys, nested objects, and any value whose type is not the allowed
scalar type for its field are also rejected.

### 3.3 Duration and count policy

- Durations are reported as bounded integer milliseconds (max
  `MAX_DURATION_MS` = 6 hours, 21,600,000 ms). Reporting may aggregate into
  coarse buckets (under 1 min, 1–3 min, 3–7 min, 7–15 min, 15–30 min,
  over 30 min) but the contract stores the bounded integer.
- Counts are clamped to documented maximums so payload size and granularity
  stay bounded.
- No clock timestamps other than the required event `timestamp` (used only for
  sequencing and duration deltas) and the version strings already in the
  payload.

### 3.4 Retention and deletion

**Unresolved until a sink exists.** This plan defines events and an in-memory
adapter only; no data is written anywhere. The owner must decide retention
period, deletion mechanism, access control, and consent presentation before
any future sink is approved. The default posture is: no storage, no retention.

### 3.5 Governance

- New payload fields are privacy-sensitive API changes and require a documented
  metric purpose and an owner decision.
- Event semantics are versioned; do not silently redefine activation.
- Any future sink must preserve the allow-list and keep assessment functional
  when analytics fail.
- This technical plan is not legal advice. If Chilean legal or privacy
  requirements are unclear, request qualified review before any collection.

## 4. Frozen event contract (v1)

Implemented in `pc-quote-builder/src/lib/measurement/contracts.js`:

- `MEASUREMENT_SCHEMA_VERSION = "decision-measurement/event/v1"`.
- Every event carries `schemaVersion`, `name`, `timestamp` (caller-supplied,
  ISO 8601), `sequence` (per-session counter), and `sessionToken` (ephemeral,
  in-memory, per-tab; never written to `localStorage` or any storage).
- Constructors accept only the allow-listed fields for their event, reject
  unknown keys and any raw-data field name from §3.2 (including nested
  objects), validate enums, clamp counts and durations, and return fresh plain
  serializable objects.
- The contract imports `quote-analyzer/input/v1`, `quote-analyzer/output/v1`,
  and `quote-analyzer/rules/v1` from the Plan 028 analyzer contracts so schema
  references cannot drift.
- `qualifiedActivation: true` is rejected when `verdictOverall` is `unknown`
  or `incomplete`.

## 5. Provider-neutral adapter

Implemented in `pc-quote-builder/src/lib/measurement/measurement.js`:

- `createMeasurement({ sink, sessionToken, sequenceStart })` returns a
  `track(eventName, payload)` function.
- The default sink is a no-op; no provider, network call, cookie, storage
  write, or third-party global is ever touched.
- The adapter validates before delivery; validation errors are never
  swallowed and throw in development, test, and production (they indicate
  instrumentation bugs).
- Sink failures are isolated: the sink runs inside a guard so a broken
  provider can never break purchase assessment.
- The adapter stamps `sessionToken` and `sequence` when the caller does not
  supply them. The token is generated in memory per tab load, never
  persisted.
- `createInMemorySink()` provides a test-only sink collecting delivered
  events.

The static guarantee: no module under `src/lib/measurement/` calls
`fetch`, `sendBeacon`, cookie, `localStorage`/`sessionStorage`, or any
third-party global; a dedicated test asserts this by reading the sources.

## 6. Plan 032 instrumentation map

Events are wired by Plan 032. Each event is owned by one explicit UI
transition; a render is never an event. Deduplication is per analysis/session
as stated.

| Event | Owner transition (Plan 032) | Deduplication | Required before controlled launch |
|---|---|---|---|
| `product_start` | First explicit start interaction in the builder after app load (open/create/import begin) | once per session | yes |
| `quote_input_completed` | Manual input completed or import/parse success transition (extends the existing import success path) | once per quote session | yes |
| `identity_confirmation_requested` | Analyzer screen enters confirmation for ambiguous rows | once per analysis | yes |
| `identity_confirmation_completed` | Confirmation step ends (all rows resolved or dismissed) | once per analysis | yes |
| `evidence_qualified_verdict_viewed` | Verdict panel transitions to displayed state | once per analysis (re-opens do not re-emit) | yes |
| `finding_evidence_opened` | User expands a finding's evidence block | once per finding per analysis | no (optional polish) |
| `decision_action_recorded` | User clicks keep/change/reject/negotiate/compare/defer | once per analysis | yes |
| `return_within_purchase_window` | — (deferred; no privacy-approved mechanism) | — | no (deferred) |

Required before any controlled launch: `product_start`,
`quote_input_completed`, `identity_confirmation_completed`,
`evidence_qualified_verdict_viewed`, and `decision_action_recorded`.
`identity_confirmation_requested` and `finding_evidence_opened` are
recommended observability but not launch blockers. Plan 032 must pass the
privacy-review checklist in §3 and keep measurement out of the assessment
critical path.
