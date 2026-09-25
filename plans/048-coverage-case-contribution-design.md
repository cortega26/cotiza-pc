# Plan 048: Design a privacy-reviewed `coverage-case/v1` contribution path (design spike)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6cde4b8..HEAD -- docs/validation/quote-analyzer-assurance-schema.md scripts/lib/quote_analyzer_assurance.js docs/design/decision-measurement.md`
> If any in-scope reference file changed since this plan was written, compare
> the "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S (design/spike only; no implementation)
- **Risk**: LOW to build the document; MED governance (touches user data policy)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `6cde4b8`, 2026-09-25

## Why this matters

Milestone 0 requires "at least 30 real, anonymized Chilean gaming quotations
… collected or scheduled for the initial validation corpus"
(`docs/PRODUCT_VISION.md:529-530`), and Milestone 2's exit requires "at least
80% of required components in the validation corpus resolve exactly or after
one explicit user confirmation" (`:552`). The Plan 035 harness can evaluate
that gate, but no private corpus exists, so Plan 032 recorded an explicit
owner waiver: "No authorized private corpus exists (0 observable real
quotations), so the gate is unevaluable" (`plans/README.md:126-131`).

The product currently has no path for a willing user to contribute an
anonymized case. This spike designs one: a user-initiated, local download of a
label-free `coverage-case/v1` file, aggregated offline by the operator with
the existing harness. It authorizes no code and no network transmission.

## Current state

- Contract: `docs/validation/quote-analyzer-assurance-schema.md:111-139`
  defines `quote-analyzer-assurance/coverage-case/v1`; the harness rejects
  top-level `labels`, `notes`, `stores`, `prices`, `urls`, `contacts`
  (`scripts/lib/quote_analyzer_assurance.js:359-411`), but the required
  `analyzerInput` carries the user's rows.
- Operator workflow: `scripts/quote_analyzer_assurance.js` requires
  `--coverage-corpus-dir <absolute private path>`; it "never defaults to a
  repository coverage directory" (`scripts/lib/quote_analyzer_assurance.js:804-813`).
- Privacy rules already recorded: real quotes stay "private, minimized,
  redactable, withdrawable, absent from git and serialized reports"
  (`plans/archive/035-automate-analyzer-assurance.md:52-53`); the CLI never
  defaults a corpus path.
- No product path exists: `rg -ln "coverage-case" pc-quote-builder/src`
  returns nothing (verify before proceeding).
- An existing local-download pattern to reuse: `lib/fileIO.js:51-57`
  (`exportJSON`/`downloadFile`).

## Commands you will need

| Purpose | Command | Provenance | Expected on success |
|---|---|---|---|
| Confirm no existing UI path | `rg -ln "coverage-case" pc-quote-builder/src` | executed | no matches |
| Confirm schema section | `rg -n "coverage-case" docs/validation/quote-analyzer-assurance-schema.md` | executed | section found |
| Doc checks after writing | `rg -n "<required sections>" docs/design/coverage-case-contribution.md` | declared | all sections present |

No code runs; this plan produces one document.

## Scope

**In scope**:
- `docs/design/coverage-case-contribution.md` (create)

**Out of scope** (do NOT create or modify):
- Any code under `pc-quote-builder/src/`, `scripts/`.
- Any schema file under `docs/validation/` (amendment proposals are described
  in the new design doc, not applied).
- `docs/PRODUCT_VISION.md`.
- Anything that uploads, transmits, logs, or stores a real quotation.

## Git workflow

- Branch: `advisor/048-coverage-case-contribution-design`
- Commit: `048: design privacy-reviewed coverage-case contribution`.
- Do NOT push or open a PR.

## Steps

### Step 1: Read the governing constraints

Read, in full: `docs/validation/quote-analyzer-assurance-schema.md` (at least
the coverage-case and report sections), `plans/archive/035-automate-analyzer-assurance.md`
(privacy invariants and the aggregation workflow), and
`docs/design/decision-measurement.md` (event/field prohibitions, including the
forbidden raw fields). Quote the specific constraints you will honor in the
document, with `file:line` references.

### Step 2: Write `docs/design/coverage-case-contribution.md`

Use these exact section headings (the done criteria check them):

1. `## Objetivo y alcance` — one paragraph: what is contributed, by whom, for
   which milestone exit criterion; explicit statement that no transmission
   exists and contribution is a local file the user chooses to share.
2. `## Estado actual` — the harness, the waived gate, and the absence of a UI
   path, with `file:line` evidence.
3. `## Minimización de datos` — table mapping every field of
   `coverage-case/v1` to: needed / not needed for identity+evidence coverage;
   for each "not needed", state whether it can be omitted or must be stripped
   before export, and why. The user's `analyzerInput` rows are the sensitive
   core; specify the minimum fields required to measure resolution and
   evidence availability (component keys, itemIds, catalog references,
   unknown/ambiguous states) and identify store, notes, prices, and free text
   as candidates for removal or hashing.
4. `## Consentimiento, retención y retiro` — plain-language consent copy
   proposal (Spanish), retention period options, deletion/withdrawal process a
   user can invoke, and where the corpus lives (operator-controlled private
   storage, never git, never a report).
5. `## Flujo de exportación local` — the exact user journey (analyze → confirm
   identities → optional "Descargar caso anónimo" action → file saved locally),
   including what the dialog must say and what the app must never do
   (auto-upload, background send, third-party script).
6. `## Agregación offline` — how the operator collects files and runs the
   existing harness (`--coverage-corpus-dir`), what remains local, and what the
   serialized report may contain (aggregates only).
7. `## Amenazas y mitigaciones` — at minimum: re-identification through free
   text/notes, quote fingerprinting, accidental git commit, accidental report
   inclusion, and consent ambiguity. Each with a concrete mitigation.
8. `## Enmiendas de esquema necesarias` — whether `coverage-case/v1` needs a
   new optional field (e.g. minimization/version marker); if yes, describe the
   amendment and the governance step required; if no, say so with reasoning.
9. `## Decisiones pendientes del propietario` — checklist of decisions only the
   owner can make (consent wording, retention duration, hosting, withdrawal
   SLA, whether to proceed to implementation).
10. `## No objetivos` — explicit list: no network sink, no telemetry vendor, no
    automatic upload, no OCR/AI matching, no raw quotes in git or reports, no
    claim that contributed cases validate correctness.

### Step 3: Cross-check against the harness

For every claim about what the harness accepts or rejects, verify against
`scripts/lib/quote_analyzer_assurance.js` and cite the line. If a proposed
minimized shape would fail the harness's required fields, revise the proposal
or list it as a schema amendment (section 8) — do not claim it works without
checking `loadCoverageCorpus` and the report builder.

**Verify**: every `analyzerInput` field named in section 3 appears in
`loadCoverageCorpus`/`buildAssuranceReport` or is marked as a required
amendment; every rejected top-level field is quoted from the code.

## Test plan

Documentation-only. Verification is structural:

- All ten headings present.
- Every constraint quoted with a `file:line`.
- No implementation instructions (the document must not tell anyone to build
  the export yet).

## Done criteria

ALL must hold:

- [ ] `test -f docs/design/coverage-case-contribution.md`
- [ ] `rg -n "^## (Objetivo|Estado actual|Minimización|Consentimiento|Flujo|Agregación|Amenazas|Enmiendas|Decisiones|No objetivos)" docs/design/coverage-case-contribution.md` lists all ten sections
- [ ] `rg -n "file:line|\.js:[0-9]+|\.md:[0-9]+" docs/design/coverage-case-contribution.md` returns at least 8 references
- [ ] `rg -n "coverage-case/v1" docs/design/coverage-case-contribution.md` matches
- [ ] `git diff --name-only 6cde4b8...HEAD` lists only the new document
- [ ] `plans/README.md` status row updated with a note that implementation
      requires an explicit owner decision

## STOP conditions

Stop and report back (do not improvise) if:

- The harness requires raw fields that cannot be minimized without a schema
  amendment larger than an optional marker (report the fields).
- You cannot state a retention/withdrawal design without a legal/privacy
  decision beyond the owner's authority (list the open question).
- The design would require collecting anything not already produced by the
  Analyzer (that is a product change, not a spike).
- You find yourself writing code. This plan authorizes none.

## Maintenance notes

- This document is the input to a future implementation plan; that plan must
  not start until the "Decisiones pendientes" checklist is explicitly resolved
  by the owner, and it must amend `docs/validation/` schemas deliberately if
  section 8 calls for it.
- If the owner declines contribution, record the rejection in
  `plans/README.md` so the finding is not re-audited.
- **Deferred**: any UI, download button, consent dialog, or aggregation tooling.
