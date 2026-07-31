# Plan 029: Establish the Quote Analyzer validation corpus and offline harness

> **Status notice — REJECTED/SUPERSEDED (2026-07-31):** Do not execute the
> remaining steps in this plan. The project owner rejected recurring
> independent expert labeling as operationally infeasible for a solo, free
> product. Plan 035 replaces it with automated conformance plus a private,
> unlabeled real-quote coverage corpus. The protocol and reviewer harness
> delivered here remain historical implementation until Plan 035 migrates or
> isolates them. They are not a launch gate and must not be described as
> expert validation.
>
> This file is retained as a decision record. Never commit raw quotations,
> personal data, contact details, order numbers, addresses, or private reviewer
> notes produced before supersession.
>
> **Drift check (run first)**:
> `git diff --stat cef0acd..HEAD -- docs/PRODUCT_VISION.md docs/PRODUCT_VISION_RED_TEAM_AUDIT.md docs/design/quote-analyzer.md pc-quote-builder/src/lib/quoteAnalyzer scripts .gitignore`
>
> If the Analyzer contract or milestone thresholds changed, STOP and reconcile
> this protocol before collecting or scoring data.

## Status

- **Plan status**: REJECTED — superseded by Plan 035 on 2026-07-31
- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: Plan 028 for the automated harness; protocol/recruitment may
  begin in parallel
- **Category**: direction
- **Planned at**: commit `cef0acd`, 2026-07-30

## Supersession decision

The original method correctly required genuinely independent human ground truth;
automated or AI-generated labels cannot satisfy that requirement. The method
was nevertheless rejected because obtaining two qualified reviewers per case
creates recurring labor and cost the approved operating model cannot sustain.

The replacement deliberately changes the claim instead of faking the evidence:

- source-backed/synthetic conformance cases validate enumerated deterministic
  and derived rule behavior;
- critical negative controls prove the new harness detects known unsafe output;
- real anonymized quotes measure coverage and resolution only, without labels;
- gaming-balance expert agreement leaves the MVP gate and remains unsupported;
- results are described as bounded automated assurance, never expert validation
  or a universal real-world false-negative estimate.

See `docs/validation/quote-analyzer-corpus.md`,
`docs/validation/quote-analyzer-assurance-schema.md`, and Plan 035.

## Why this matters

The Chilean gaming-quotation beachhead is explicitly a hypothesis. Milestone 0
requires at least 30 real anonymized quotations, while Milestone 2 requires
measured identity resolution, expert agreement, and zero dangerous false
negatives in the controlled launch corpus. This plan creates a privacy-safe
collection and adjudication protocol plus an offline harness that measures those
gates without shipping raw user data in the application or repository.

## Product-decision record

- User problem: validate whether the proposed Analyzer changes or materially
  confirms a near-term purchase decision.
- Evidence type: real quote snapshots and human expert labels; results are
  empirical, not product claims by themselves.
- Privacy posture: data minimization, explicit consent, redaction before review,
  access-limited storage outside git, and aggregate-only committed results.
- Commercial posture: no retailer ranking or recruitment incentive may affect
  labels or findings.
- Success gates: at least 80% of required components resolve exactly or after
  one confirmation; at least 95% expert agreement on deterministic
  compatibility; at least 80% agreement on the top gaming-balance concern; zero
  dangerous confirmed incompatibility false negatives in the controlled launch
  subset.
- Problem/value falsification: target at least 60% reporting that analysis
  changed or materially confirmed the decision and at least 40% acting on a
  finding. Do not weaken thresholds merely to declare success.

## Current state

- `docs/PRODUCT_VISION.md:519-530` defines Milestone 0 and the 30-quote corpus.
- `docs/PRODUCT_VISION.md:545-556` defines the Milestone 2 reliability and time
  gates.
- `docs/PRODUCT_VISION_RED_TEAM_AUDIT.md:482-497` defines the concierge and
  accuracy falsification experiments.
- `docs/design/quote-analyzer.md:359-396` defines Analyzer acceptance criteria
  and reserves Phase G for an offline corpus harness.
- `docs/design/quote-analyzer.md:405-420` leaves corpus ownership and collection
  process unresolved.
- Tests use synthetic, committed fixtures. Real quotations do not currently
  have a governed storage or labeling protocol.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Harness tests | `cd pc-quote-builder && npx vitest run ../scripts/lib/quote_analyzer_corpus.test.js` | synthetic harness tests pass |
| Analyzer tests | `cd pc-quote-builder && npx vitest run src/lib/quoteAnalyzer` | all pass |
| Protocol link check | `rg -n "consent|redact|retention|delete|reviewer|false negative" docs/validation/quote-analyzer-corpus.md` | all required topics found |
| Required gate | `cd pc-quote-builder && npm run check` | exit 0 |
| Diff hygiene | `git diff --check` | exit 0 |

The harness must run on an operator-supplied directory, for example:

`node scripts/quote_analyzer_corpus.js --corpus-dir /absolute/private/path --out /tmp/cotiza-pc-corpus-report.json`

It must never default to a repository directory.

## Scope

**In scope**:

- `docs/validation/quote-analyzer-corpus.md` — consent, redaction, sampling,
  review, retention, deletion, correction, and outcome-follow-up protocol.
- `docs/validation/quote-analyzer-label-schema.md` — versioned expert label and
  adjudication contract.
- `scripts/quote_analyzer_corpus.js` — offline CLI.
- `scripts/lib/quote_analyzer_corpus.js` and test — pure loading, validation,
  metric calculation, and aggregate reporting.
- `.gitignore` — explicit patterns for any agreed local private-corpus staging
  directory and reviewer exports.
- `docs/validation/quote-analyzer-corpus-report.example.json` — synthetic,
  non-user example only.

**Out of scope**:

- Committing any real quote or contact information.
- Building an upload backend, account system, public sharing, CRM, or email tool.
- Automatically contacting communities, creators, retailers, or participants.
- Paying reviewers or participants without an owner-approved research process.
- Changing Analyzer findings to increase agreement.
- Publishing performance-balance claims; current balance remains deferred.

## Git workflow

- Branch: `advisor/029-establish-analyzer-validation-corpus`
- Suggested commits: `029: define analyzer corpus governance` and
  `029: add offline corpus reliability harness`.
- Do not push, publish results, or contact participants unless instructed.

## Steps

### Step 1: Assign accountable roles and data location

Before collection, obtain explicit owner choices for:

- research owner and data steward;
- one or two qualified independent reviewers;
- approved private storage location and access list;
- retention period and deletion request path;
- whether quotes may be retained after the study or only aggregate labels.

Record roles, never personal secrets or private storage credentials, in
`docs/validation/quote-analyzer-corpus.md`. If no secure non-git storage exists,
stop after the protocol design.

**Verify**:
`rg -n "Accountable owner|Data steward|Reviewer|Retention|Deletion" docs/validation/quote-analyzer-corpus.md`
→ each heading exists with a named role or explicit `TBD — collection blocked`.

### Step 2: Define consent, redaction, and sampling

Specify a plain-Spanish participant notice explaining purpose, fields used,
retention, who reviews the quote, withdrawal/deletion, and that this is not a
guarantee of purchase safety. Redact names, emails, phone numbers, addresses,
order/account IDs, payment data, free-form notes unrelated to components, and
tracking URLs before expert review.

Define sampling strata: at least multiple Chilean retailers/technicians,
1080p/1440p/4K intent, integrated and dedicated graphics where available,
complete/incomplete quotes, and a range of budgets. Report recruitment source so
community convenience sampling is visible.

**Verify**:
`rg -n "Consentimiento|Redacción|Muestreo|Sesgo|Retiro" docs/validation/quote-analyzer-corpus.md`
→ all protocol sections exist.

### Step 3: Define the versioned label schema

Create a machine-readable JSON shape in the label-schema document. Each case
must include a pseudonymous case ID, schema version, quote snapshot timestamp,
catalog/rules versions, user context, per-row confirmed identity state, required
component status, expected deterministic findings, dangerous incompatibility
flag, reviewer confidence, top decision-changing concern, and eventual user
action. Keep the balance concern as an expert research label, not an Analyzer v1
finding.

Require two independent reviews for the controlled launch subset. Conflicts are
adjudicated by a third role or documented consensus session without rewriting
the original labels.

**Verify**:
`rg -n "schemaVersion|caseId|dangerous|decisionAction|adjudication" docs/validation/quote-analyzer-label-schema.md`
→ all fields/processes are defined.

### Step 4: Implement a private-input, aggregate-output harness

After Plan 028 lands, create the pure harness module and thin CLI. It must:

- reject corpus/label schema mismatches;
- call the exported pure `analyzeQuote`;
- compare only permitted deterministic/derived dimensions;
- calculate identity-resolution rate, per-finding confusion counts, dangerous
  false negatives, expert agreement, evidence completeness, and time-to-verdict
  when supplied;
- separate `unknown` from `ok`;
- emit aggregate counts/rates and pseudonymous failing case IDs only;
- never echo product notes, raw quote text, prices, contacts, or full rows.

Return a nonzero exit code when launch gates fail, but provide a `--report-only`
mode for early collection.

**Verify**:
`cd pc-quote-builder && npx vitest run ../scripts/lib/quote_analyzer_corpus.test.js`
→ pass cases, threshold failures, unknown-vs-ok, schema mismatch, redaction
leakage assertions, and empty corpus all pass.

### Step 5: Dry-run with synthetic cases

Create synthetic private-directory fixtures during the test only; do not commit
a fake "real" corpus. Verify that output contains no banned raw fields and that
the example aggregate report matches the documented schema.

**Verify**:
`rg -n "product|notes|email|phone|address|offerPrice|regularPrice" docs/validation/quote-analyzer-corpus-report.example.json`
→ no raw sensitive/input fields match.

### Step 6: Conduct the 30-quote concierge study

This is an operator action, not an autonomous executor action. Only proceed with
explicit authority to recruit/contact participants. Follow the approved protocol,
manually deliver the evidence report, and follow up on keep/change/reject/
negotiate/compare/defer actions. Record withdrawals and corrections.

Run the harness in report-only mode until the corpus is complete. Do not enable a
public product launch merely because the command runs.

**Verify**:
the aggregate report states `caseCount >= 30`, resolution rate, expert agreement,
dangerous false negatives, and decision-value/action rates without raw case data.

### Step 7: Record the gate decision

Add a dated aggregate result and explicit decision: proceed, narrow scope,
improve data, or stop/reframe. If any quality gate fails, do not relax it; record
the failure and open a separate corrective plan grounded in failing case IDs.

**Verify**:
`git diff --check && cd pc-quote-builder && npm run check`
→ exit 0; `git status --short` contains no private corpus files.

## Test plan

- Use only synthetic fixtures in automated tests.
- Cover empty/small corpus, invalid schema, duplicate case IDs, reviewer
  disagreement, unknown outputs, dangerous false negatives, threshold
  boundaries, and aggregate redaction.
- Assert no raw rows or quote text appear in serialized reports or errors.
- Run the full Analyzer suite and required repository gate.

## Done criteria

- [ ] Accountable roles, consent, redaction, retention, deletion, and sampling
  are documented.
- [ ] A versioned label/adjudication contract exists.
- [ ] The offline harness has synthetic tests and no repository-default data path.
- [ ] Aggregate output cannot contain raw quote content or direct identifiers.
- [ ] At least 30 quotes are collected or formally scheduled, satisfying
  Milestone 0 wording.
- [ ] The gate report records actual rates and a proceed/narrow/stop decision.
- [ ] `npm run check` and `git diff --check` pass.
- [ ] No real user quote or private reviewer file is tracked by git.
- [ ] `plans/README.md` is updated.

## STOP conditions

Stop and report if:

- Secure non-git storage, consent, accountable ownership, or deletion handling is
  absent.
- The operator has not authorized participant outreach.
- Reviewers cannot independently label deterministic compatibility.
- Analyzer output lacks stable rule/catalog versions.
- A requested report would expose raw quote data or identifiable information.
- Quality thresholds fail; do not weaken them or reinterpret unknown as valid.
- The harness requires a backend, production telemetry, or product UI.

## Maintenance notes

Treat the corpus as a governed research asset, not test fixture bulk. Any future
rule version must be evaluated against preserved labels under the approved
retention policy. Reviewers should scrutinize sampling bias, redaction quality,
label leakage, and whether expert disagreement is being hidden by aggregate
averages.
