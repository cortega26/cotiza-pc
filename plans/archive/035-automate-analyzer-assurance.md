# Plan 035: Replace expert labeling with automated Analyzer assurance

> **Executor instructions**: Follow this plan in order. This is a safety-
> critical migration from a superseded human-label harness. Preserve all
> uncertainty semantics and privacy protections. Do not claim expert
> validation, universal safety, or a measured real-world false-negative rate.
> Never commit real quotations or derive expected answers from Analyzer output.
>
> **Drift check (run first)**:
> `git diff --stat cef0acd..HEAD -- docs/PRODUCT_VISION.md docs/design/quote-analyzer.md docs/validation plans/029-establish-analyzer-validation-corpus.md plans/030-generate-assessment-coverage-contract.md plans/031-define-decision-funnel-measurement.md plans/032-ship-confirmation-driven-analyzer-ui.md plans/033-build-crawlable-decision-content-foundation.md plans/034-qualify-solotodo-price-intelligence-source.md pc-quote-builder/src/lib/compatibility.js pc-quote-builder/src/lib/quoteAnalyzer`
>
> If Analyzer rule IDs, formulas, required components, catalog evidence fields,
> or the owner-approved assurance gates changed, STOP and reconcile the
> conformance contract before implementation.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: Plan 028; Plan 030 for generated evidence coverage before
  final launch scoring (the conformance harness may begin first)
- **Supersedes**: rejected Plan 029
- **Category**: direction
- **Planned at**: current working tree, 2026-07-31

## Why this matters

Plan 029 required two qualified independent human labels per quote. That method
could support expert-agreement and empirical false-negative claims, but it is
not feasible for a solo, free product and cannot be replaced honestly by two
LLM prompts. The canonical vision now uses a bounded automated-assurance model:
an implementation-independent conformance suite validates supported rule
classes, while a separate private real-quote corpus measures coverage without
pretending observed Analyzer output is ground truth.

This plan implements that replacement, removes the reviewer blocker, and makes
the narrower evidence claim executable and reproducible.

## Product-decision record

- User problem: prevent supported, mechanically detectable compatibility and
  power errors from being presented as valid while keeping the product free and
  operationally sustainable.
- Evidence type: explicit source facts, synthetic boundaries, disclosed derived
  formulas, automated negative controls, and unlabeled real-input coverage.
- Supported claim: conformance with enumerated rules, boundaries, evidence
  gaps, and hazard classes for a versioned catalog/rules snapshot.
- Unsupported claim: expert agreement, universal physical safety, real-world
  false-negative rate, gaming balance, value, performance, thermals, BIOS, or
  any dimension without a separately validated model.
- Privacy: real quotes remain private, minimized, redactable, withdrawable, and
  absent from git and serialized reports.
- Commercial posture: assurance cases and outcomes are independent of retailer,
  affiliate, sponsorship, or provider economics.
- Failure posture: missing/conflicting evidence is `unknown`; a failed assurance
  gate blocks public claims and public enablement but never gets relaxed to
  declare success.

## Current state

- Plan 028 shipped the pure `analyzeQuote` entry point and versioned findings.
- Plan 029 shipped `quote_analyzer_corpus` code whose schema and metrics require
  reviewer labels and adjudication.
- `docs/validation/quote-analyzer-label-schema.md` now marks that contract
  superseded.
- `docs/validation/quote-analyzer-assurance-schema.md` defines separate
  conformance, negative-control, coverage-case, and aggregate-report schemas.
- Plan 030 will expose rule-level evidence coverage but does not validate rule
  outcomes.
- No real quote has to become a committed test fixture.

## Commands you will need

Run npm commands from `pc-quote-builder/`.

| Purpose | Command | Expected on success |
|---|---|---|
| Assurance unit tests | `npx vitest run ../scripts/lib/quote_analyzer_assurance.test.js` | schema, oracle, controls, metrics, and redaction pass |
| Analyzer regression | `npx vitest run src/lib/quoteAnalyzer src/lib/compatibility.test.js` | all current Analyzer/compatibility tests pass |
| Synthetic conformance gate | `node ../scripts/quote_analyzer_assurance.js --conformance-dir ../scripts/fixtures/quote-analyzer-assurance --out /tmp/cotiza-pc-assurance.json` | exit 0 and gate passes |
| Private progress report | `node ../scripts/quote_analyzer_assurance.js --conformance-dir ../scripts/fixtures/quote-analyzer-assurance --coverage-corpus-dir /absolute/private/path --report-only --out /tmp/cotiza-pc-assurance.json` | aggregate-only report; no raw fields |
| Required app gate | `npm run check` | exit 0 |
| Diff hygiene | `git diff --check` | exit 0 |

The CLI must never default to a repository coverage directory. Do not run a
private corpus command unless the operator supplies and authorizes its path.

## Scope

**In scope**:

- `scripts/lib/quote_analyzer_assurance.js` and tests.
- `scripts/quote_analyzer_assurance.js` thin CLI.
- Synthetic conformance and negative-control fixtures under
  `scripts/fixtures/quote-analyzer-assurance/`.
- An implementation-independent registry/oracle for supported input facts and
  expected relationship outcomes; it must not import production decision code.
- Aggregate metrics for conformance, negative controls, rule/state coverage,
  identity resolution, evidence completeness, state distribution, and optional
  time-to-verdict.
- Migration or explicit isolation of Plan 029's reviewer harness and docs.
- `.gitignore` adjustments for private coverage-corpus staging if needed.
- A synthetic aggregate example with no user data.
- Documentation and plan status updates.

**Out of scope**:

- LLM, AI-agent, crowd, or paid labels presented as expert ground truth.
- Committing any real quote, reviewer file, raw product prose, price, contact,
  order information, or unlicensed source response.
- Adding dependencies; implement the first version with existing Node/Vitest.
- Changing compatibility formulas or findings to make conformance pass.
- Validating gaming balance, value, performance, thermals, noise, durability,
  BIOS, upgradeability, or retailer rankings.
- Production telemetry, upload backend, accounts, or public sharing.
- Downloading catalog data or modifying generated artifacts.

## Git workflow

- Branch: `advisor/035-automate-analyzer-assurance`
- Suggested commits:
  - `035: define automated analyzer assurance contracts`
  - `035: add independent conformance and coverage harness`
  - `035: retire reviewer launch gate`
- Do not push, deploy, publish results, or process real private data unless
  explicitly instructed.

## Steps

### Step 1: Inventory supported rules and hazard classes

Create a versioned assurance registry covering every Analyzer v1 deterministic
or derived rule in compatibility, power, connectors, and case fit. For each,
declare:

- stable rule/finding ID and dimension;
- decision type;
- required fact names and units;
- applicable `ok`, `warning`, `fail`, and `unknown` states;
- exact boundary semantics;
- whether a `fail` belongs to an enumerated critical hazard class;
- required conformance-case classes.

The registry describes relationships and coverage obligations, not production
messages or implementation functions. Price freshness/completeness may retain
normal Analyzer tests but is not a dangerous compatibility class.

**Verify**: tests fail for an Analyzer v1 rule missing from the registry, an
unknown rule, duplicate fact, unsupported state, or hazard without a fail case.

### Step 2: Build implementation-independent conformance fixtures

Create minimal cases for each rule:

- compatible/sufficient;
- exact boundary and both adjacent sides where numeric;
- unequivocal incompatibility/insufficiency where supported;
- missing required fact;
- conflicting fact where representable;
- unresolved identity preventing evidence;
- safe permutations that must not change the result.

Use synthetic facts by default. A source-backed case stores only a concise,
redistributable fact plus URL/reference, observation date, and identity. Never
copy a full source response. Expected outcomes are authored from the public rule
contract, not captured from current Analyzer output.

**Verify**: schema validation rejects incomplete provenance, incompatible
versions, output-derived expected values, malformed inputs, duplicated IDs, and
missing mandatory state classes.

### Step 3: Implement black-box conformance comparison

Run each fixture through exported `analyzeQuote` and compare:

- dimension status;
- required/forbidden finding IDs;
- dangerous fail not becoming `ok` or disappearing;
- `unknown` behavior for missing/conflicting evidence;
- evidence fields, decision type, rule version, and freshness structure;
- deterministic output for identical input.

The expected-outcome oracle must not import `compatibility.js`,
`quoteAnalyzer/report.js`, or shared decision helpers. It may import only schema
constants that do not calculate an outcome.

**Verify**: all committed conformance cases pass; changing a fixture's expected
status causes a stable case-ID-only failure without echoing raw input.

### Step 4: Add critical negative controls

For every supported critical hazard class, provide at least one deliberately
unsafe output such as a socket mismatch reported `ok`, a missing required GPU
connector omitted, or an over-length GPU accepted by the case-fit dimension.
Feed these outputs directly to the harness comparator, never to product metrics.

The harness must classify and reject each as a dangerous false negative. A
missed control is itself a gate failure.

**Verify**: 100% of controls are rejected for the expected reason; removing a
comparison makes the focused test fail.

### Step 5: Add dependency-free property matrices

Using existing Vitest and deterministic loops, cover invariants including:

- unequal known sockets never improve to `ok`;
- deleting required evidence never creates `ok`;
- increasing GPU length or reducing case clearance never improves fit;
- removing available PSU connectors or increasing required connectors never
  improves connector status;
- reducing PSU wattage never improves power status;
- row order does not alter outcomes;
- identical inputs/versions are byte-identical.

Bound generated matrices and print only seed/case IDs on failure. Do not add a
property-testing dependency in this plan.

### Step 6: Replace reviewer labels with private coverage cases

Validate `coverage-case/v1` without any label or expected outcome. Run the
Analyzer only to measure:

- required-component identity resolution;
- observed dimension-state distribution;
- evidence completeness and `unknown` rate;
- catalog/rules version distribution;
- time-to-verdict when supplied;
- aggregate sampling strata.

Observed states are never treated as correct labels. Reject unexpected raw
fields and serialize no rows, text, stores, prices, notes, URLs, contacts, or
private directory paths.

**Verify**: empty, fewer-than-30, complete, malformed, duplicate, withdrawn,
and mixed-version cases produce correct progress/gate behavior without leakage.

### Step 7: Implement aggregate gates and CLI behavior

The full gate passes only when:

- every conformance case passes;
- every supported rule has its required state/boundary coverage;
- every critical negative control is rejected;
- no supported critical conformance hazard is reported `ok`;
- missing/conflicting required evidence produces `unknown`;
- at least 30 real coverage cases exist; and
- required-component identity resolution is at least 80%.

`--report-only` permits incomplete collection without exit failure. Normal mode
returns nonzero on any failed or unevaluable gate. Output only aggregates and
synthetic/pseudonymous failing IDs.

### Step 8: Retire or isolate the Plan 029 harness

Choose the smallest safe migration after checking consumers:

- remove the old reviewer CLI/module/tests if nothing depends on them; or
- move them under an explicitly historical path with no package script or
  launch documentation.

Do not keep two active launch reports with contradictory semantics. Update all
references from Plan 029 to Plan 035 and retain the supersession record.

**Verify**: `rg` finds no active plan, design, README, or CLI instruction that
requires reviewers, adjudication, expert agreement, or label/v1 for launch.

### Step 9: Run full verification and record the gate state

Run focused tests, the committed conformance CLI, Analyzer regressions,
`npm run check`, and `git diff --check`. Inspect output for raw-data leakage and
dependency/generated-artifact changes.

If no authorized private corpus is available, record conformance as tested and
the full Milestone 2 gate as not yet assessable; do not fabricate 30 cases.

## Test plan

- Schema/version, duplicates, malformed facts, provenance, and strict keys.
- Every rule/state/boundary obligation.
- Critical negative controls and false-negative classification.
- Missing/conflicting evidence remains `unknown`.
- Deterministic property matrices and row permutations.
- Empty/small/private coverage corpus and mixed versions.
- Aggregate-only output and banned-field/error-message scans.
- CLI exit codes for pass, fail, report-only, and missing explicit paths.
- Regression against all current Analyzer and compatibility tests.

## Done criteria

- [ ] Every supported Analyzer v1 deterministic/derived rule has a versioned
  conformance obligation and implementation-independent expected outcome.
- [ ] All conformance cases pass and all critical negative controls are
  rejected.
- [ ] Missing/conflicting required evidence cannot produce `ok`.
- [ ] The real-quote corpus contains no labels and is used only for coverage.
- [ ] Aggregate output cannot contain raw quote or private-path data.
- [ ] The Plan 029 reviewer harness is removed or unmistakably isolated.
- [ ] Active plans and product documents depend on Plan 035, not expert labels.
- [ ] No dependency or generated catalog artifact changed.
- [ ] Applicable focused tests, `npm run check`, and `git diff --check` pass.
- [ ] `plans/README.md` is updated.

## STOP conditions

Stop and report if:

- a supported rule cannot be specified without copying production logic or
  relying on subjective judgment;
- the only available expected answer is Analyzer or LLM output;
- a requested claim exceeds the enumerated conformance evidence;
- missing/conflicting evidence would need to be treated as valid;
- a real quote, private path, or non-redistributable source payload would enter
  git or output;
- implementing assurance requires changing a production rule merely to pass;
- Analyzer/catalog/rules versions are unstable or incompatible;
- a full launch report is requested with fewer than 30 authorized real cases;
- any required verification command fails twice after a reasonable correction.

## Maintenance notes

Every rule, formula, severity, evidence field, or catalog semantic change must
update the assurance registry, boundary cases, negative controls, versions, and
affected content before release. A passing suite proves only the declared
versioned contract. Future human audits may supplement this evidence but do not
silently redefine the automated gate.
