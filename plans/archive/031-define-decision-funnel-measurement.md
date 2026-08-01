# Plan 031: Define the privacy-preserving decision-funnel measurement contract

> **Executor instructions**: Follow this plan step by step. This plan creates a
> versioned event contract and provider-neutral adapter seam. It does not
> authorize transmitting data to any third party. If provider, consent, or
> retention choices are needed, stop at the documented decision gate.
>
> **Drift check (run first)**:
> `git diff --stat cef0acd..HEAD -- docs/PRODUCT_VISION.md docs/PRODUCT_VISION_RED_TEAM_AUDIT.md docs/design/quote-analyzer.md pc-quote-builder/package.json pc-quote-builder/src/main.jsx pc-quote-builder/src/App.jsx pc-quote-builder/src/lib/measurement`
>
> If milestone definitions or the Analyzer output contract changed, STOP and
> reconcile event semantics before implementation.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: Plan 028 for stable Analyzer schemas/event payload references
- **Category**: direction
- **Planned at**: commit `cef0acd`, 2026-07-30

## Why this matters

The product cannot distinguish page views from qualified purchase decisions.
Milestones require non-branded acquisition, starts, identity resolution,
evidence-qualified verdicts, time-to-verdict, decision actions, reliability, and
trust guardrails. This plan defines exactly what is measured and what is
forbidden, then builds a testable no-op/injected adapter so Plan 032 can
instrument the Analyzer without coupling product logic to a vendor.

## Product-decision record

- Measure product learning, not user surveillance.
- Never collect raw quote text, component names/IDs, store names, notes, exact
  prices/budgets, uploaded files, contact details, IP addresses, or persistent
  cross-device identifiers in event payloads.
- Permitted fields are categorical states, aggregate counts, coarse duration,
  acquisition class, schema/rules/catalog versions, and explicit decision
  action.
- `unknown` and `incomplete` remain separate from qualified verdicts.
- Reliability metrics come from Plan 035's automated conformance report, not
  client events. Real-quote client/corpus observations measure coverage and
  product behavior, never ground-truth correctness.
- No analytics provider, cookie, network endpoint, or dependency is authorized
  here. Provider/hosting, consent presentation, retention, deletion, and access
  are explicit owner/privacy decisions.

## Current state

- `docs/PRODUCT_VISION.md:523-530` requires operational definitions and
  privacy-respecting measurement.
- `docs/PRODUCT_VISION.md:545-568` defines time-to-verdict, qualified activation,
  and organic-product thresholds.
- `docs/PRODUCT_VISION_RED_TEAM_AUDIT.md:420-478` defines the north star,
  activation, decision actions, guardrails, and 30-day return behavior.
- `pc-quote-builder/package.json:24-41` contains React only at runtime; there is
  no analytics dependency.
- `pc-quote-builder/src/main.jsx:6-9` mounts `<App />` directly with no provider.
- `pc-quote-builder/src/App.jsx:415-435` reports import success/failure with
  alerts but records no activation checkpoint.
- `pc-quote-builder/src/hooks/usePersistence.js:6-10` persists quotes, active
  quote ID, and builder state only.

## Commands you will need

Run from `pc-quote-builder/`.

| Purpose | Command | Expected on success |
|---|---|---|
| Contract tests | `npx vitest run src/lib/measurement` | all pass |
| Forbidden-field scan | `rg -n "product|itemId|store|notes|offerPrice|regularPrice|budgetAmount|email|phone" src/lib/measurement` | matches only explicit deny-list tests/docs, never permitted payload construction |
| Required gate | `npm run check` | exit 0 |
| Diff hygiene | `git diff --check` | exit 0 |

## Scope

**In scope**:

- `docs/design/decision-measurement.md` — metric glossary, event lifecycle,
  privacy boundaries, governance decisions, and reporting formulas.
- `pc-quote-builder/src/lib/measurement/contracts.js` and tests.
- `pc-quote-builder/src/lib/measurement/measurement.js` and tests — no-op and
  injected sink adapter.
- `pc-quote-builder/src/lib/measurement/index.js`.

**Out of scope**:

- Wiring events into `App.jsx` or Analyzer UI; Plan 032 owns instrumentation.
- Adding analytics SDKs, cookies, beacons, endpoints, databases, dashboards, or
  account/session tracking.
- Persisting a cross-session/cross-device user identifier.
- Capturing raw product, quote, price, retailer, note, or contact data.
- Defining reliability from self-reported browser events.
- Marketing attribution beyond a coarse, privacy-approved acquisition class.

## Git workflow

- Branch: `advisor/031-define-decision-funnel-measurement`
- Suggested commits: `031: define qualified decision metrics` and
  `031: add provider-neutral measurement contract`.
- No dependency changes or external configuration.

## Steps

### Step 1: Define the metric glossary

Create `docs/design/decision-measurement.md` with operational definitions:

- `product_start`;
- `quote_input_completed`;
- `identity_confirmation_requested`;
- `identity_confirmation_completed`;
- `evidence_qualified_verdict_viewed`;
- `finding_evidence_opened`;
- `decision_action_recorded`;
- optional `return_within_purchase_window` only if a future privacy-approved
  mechanism exists.

Define qualified activation exactly: input/import completed, gaming/budget/
resolution context supplied, six required categories resolved or explicitly
confirmed, high-severity findings meet evidence requirements, and verdict
opened. Define allowed actions: keep, change, reject, negotiate, compare, defer.
Define time-to-verdict start/end and pause/abandonment rules.

**Verify**:
`rg -n "Qualified activation|Time to verdict|Decision action|Unknown|Reliability" docs/design/decision-measurement.md`
→ every term has a formula and exclusion rule.

### Step 2: Approve the privacy envelope

Document a field-level allow-list and deny-list. Specify coarse duration buckets
or bounded integer milliseconds, acquisition classes, count maximums, schema
versions, and enum values. Document data retention and deletion as unresolved
until a sink exists.

Require explicit owner approval before any future network sink. If Chilean legal
or privacy requirements are unclear, request qualified review; do not claim this
technical plan is legal advice.

**Verify**:
the document explicitly states no network transmission is implemented and names
every forbidden raw-data class.

### Step 3: Implement frozen event contracts

Create schema/version constants and event constructors. Constructors accept only
event-specific allow-listed fields, reject unknown keys, clamp counts/durations,
and return fresh serializable objects. Use a per-tab ephemeral session token only
if needed for event sequencing; do not store it in `localStorage`.

Each event must carry:

- `schemaVersion`;
- event name and sequence;
- event timestamp supplied by the caller for deterministic tests;
- relevant Analyzer input/output schema and rules/catalog versions;
- categorical state/count fields permitted for that event.

**Verify**:
`npx vitest run src/lib/measurement/contracts.test.js`
→ valid events pass; unknown keys, raw quote fields, exact prices, oversized
values, invalid enums, and missing versions fail.

### Step 4: Implement a provider-neutral adapter

Create a factory accepting a sink function. Default to a no-op sink. The adapter
must validate before delivery, swallow no validation errors in development/test,
and isolate sink failures so purchase assessment still works. Provide an
in-memory sink for tests only.

No module may call `fetch`, `sendBeacon`, global vendor functions, or write to
storage.

**Verify**:
`npx vitest run src/lib/measurement/measurement.test.js`
→ no-op, injected sink, ordering, duplicate suppression if specified, invalid
payload, and sink failure isolation pass.

### Step 5: Define the Plan 032 instrumentation map

In the design document, map each event to the future UI transition that owns it,
including deduplication semantics. A React render is never an event by itself;
emit only from explicit state transitions or user actions. State which events
are required before a controlled launch and which remain deferred.

**Verify**:
`rg -n "Owner transition|Deduplication|Plan 032|controlled launch" docs/design/decision-measurement.md`
→ each concept is explicit.

### Step 6: Run verification and privacy review

Run focused tests and `npm run check`. Inspect the diff for any dependency,
network, storage, or App wiring. Those are scope violations.

**Verify**:
`npm run check && git diff --check`
→ exit 0; `git diff -- pc-quote-builder/package.json` is empty.

## Test plan

- Event constructor happy paths for every event.
- Deny raw quote/product/price/contact fields, including nested objects.
- Invalid enums, negative/overflow counts, missing versions, and extra keys.
- Deterministic timestamp/session injection.
- No-op and in-memory sinks; sink error isolation.
- Static assertion that measurement source contains no `fetch`, `sendBeacon`,
  cookie, `localStorage`, or third-party global calls.

## Done criteria

- [ ] Every milestone metric has an operational definition and exclusion rule.
- [ ] Qualified activation cannot count `unknown`/`incomplete` as success.
- [ ] Event payloads are allow-listed and raw quote data is rejected.
- [ ] A provider-neutral no-op/injected adapter exists with tests.
- [ ] No provider, network, cookie, storage, or dependency was added.
- [ ] Plan 032 has an explicit event-to-transition integration map.
- [ ] `npm run check` and `git diff --check` pass.
- [ ] `plans/README.md` is updated.

## STOP conditions

Stop and report if:

- The Analyzer contract/rules versions are not stable.
- A required metric cannot be computed without raw quote contents or persistent
  identity.
- The operator asks to add a provider without approving consent, retention,
  access, and deletion decisions.
- The plan appears to require a backend or legal conclusion.
- Product assessment begins depending on measurement availability.
- A verification command fails twice after a reasonable correction.

## Maintenance notes

Version event semantics; do not silently redefine activation. Any future sink
must preserve the allow-list and keep assessment functional when analytics fail.
Reviewers should treat new payload fields as privacy-sensitive API changes and
require a documented metric purpose.
