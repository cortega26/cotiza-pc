# Plan 045: Bring design and validation docs back in line with shipped state (Plans 031/032/035/036)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6cde4b8..HEAD -- docs/design/decision-measurement.md docs/design/builder-modes.md docs/design/quote-analyzer.md docs/validation/quote-analyzer-corpus.md docs/validation/quote-analyzer-label-schema.md docs/validation/quote-analyzer-corpus-report.example.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (documentation only)
- **Depends on**: none (but run after plans 038/039/042/043/044 if their behavior changes should be reflected in the same doc updates — see Step 4)
- **Category**: docs
- **Planned at**: commit `6cde4b8`, 2026-09-25

## Why this matters

Plans 032, 035, and 036 shipped, but the design/validation documents that
future plans and reviewers treat as the current-state baseline still describe
the pre-shipment world. The worst case is
`docs/validation/quote-analyzer-corpus-report.example.json`, which depicts a
passing 30-quote real-corpus gate (`coverageCorpus.caseCount: 30`, every gate
`applicable: true, pass: true`) even though no private corpus exists and the
project owner recorded an explicit waiver on 2026-09-25
(`plans/README.md:126-131`). It is the only report-shaped artifact under
`docs/validation/` and can be mistaken for validation evidence.

These docs are source documentation, not generated artifacts, and are safe to
edit directly.

## Current state

- `docs/design/decision-measurement.md:3-5`:
  ```
  > Status: approved design contract, not yet instrumented.
  > Plan 032 owns wiring events into the App; this document is the governing
  > definition of what is measured, what is forbidden, and how events flow.
  ```
  Reality: `App.jsx:8` imports `createMeasurement`, `:80` constructs it, `:552`
  emits `product_start`; `QuoteAnalyzer.jsx:47,150` receives and calls
  `measurement.track(...)`. The default sink is a no-op
  (`lib/measurement/measurement.js:20`); no network sink is authorized.
  `plans/README.md:58-59` records Plan 032 as DONE.
- `docs/validation/quote-analyzer-corpus.md:4-7`:
  ```
  > (2026-07-31). Sustituye el requisito de revisores independientes de Plan 029.
  > Plan 035 implementa el contrato y los harnesses nuevos; hasta que termine,
  > este documento autoriza la recolección privada conforme a este protocolo,
  > pero no permite declarar cumplida la puerta automatizada de lanzamiento.
  ```
  Reality: Plan 035 is DONE (`plans/README.md:62`); the harness CLI exists at
  `scripts/quote_analyzer_assurance.js`.
- `docs/validation/quote-analyzer-label-schema.md:25-27`:
  ```
  Los archivos o tests existentes que aún mencionen `reviewerId`, `labels` o
  `adjudication` pertenecen a la implementación histórica de Plan 029. No deben
  usarse para afirmar acuerdo experto mientras Plan 035 no complete la migración.
  ```
- `docs/validation/quote-analyzer-corpus-report.example.json:60-102` shows
  `coverageCorpus.caseCount: 30` and five gates with `pass: true`. Verified
  unreferenced by code/tests (`rg -ln "corpus-report" --glob '!node_modules'` →
  only `plans/029-establish-analyzer-validation-corpus.md`).
- `docs/design/builder-modes.md:9` claims the UI labels a picker
  `"Builder guiado"` at `App.jsx:748`; that string no longer exists anywhere in
  `src/` (only `workspaceMode.test.js:75` asserts its absence).
  `:23` says PSU connector data is missing for 100% (`0/2128`); Plan 036 raised
  PSU↔GPU connector coverage to 17.0% (`plans/README.md:136-141`).
- `docs/design/quote-analyzer.md`: `:57-58` cites `App.jsx:420-436`/`:438-484`
  for import/price-import, now at `App.jsx:428-449`/`:451-497`; `:408` proposes
  `src/components/QuoteAnalyzer.jsx` while it shipped as a directory
  (`src/components/QuoteAnalyzer/`); `:275`/`:424` record §12.1 as approved on
  2026-07-31. `plans/README.md:102` still says Plan 024's implementation "waits
  on the owner decision in design §12.1".
- `docs/validation/quote-analyzer-assurance-schema.md:3-4` says the contract is
  "ejecutado por Plan 035" (present tense, fine), but Plan 035 is done —
  rephrase to "implementado por Plan 035 (DONE)".
- `docs/design/scenario-comparison.md:148` and `builder-modes.md:127` gate
  Phase B on "analyzer contract in production (Plan 024 implementation)"; the
  production implementation is Plan 028/032, both DONE.

## Commands you will need

| Purpose | Command | Provenance | Expected on success |
|---|---|---|---|
| Doc link/consistency | `rg -n "<old text>" docs/` | declared | no matches after edits |
| JSON validity | `node -e "JSON.parse(require('fs').readFileSync('docs/validation/quote-analyzer-corpus-report.example.json','utf8'));console.log('ok')"` | declared | prints `ok` |
| Full suite (docs must not break tests) | `npm test` (in `pc-quote-builder/`) | executed | all pass |

No build is required; this plan changes no code.

## Scope

**In scope**:
- `docs/design/decision-measurement.md`
- `docs/design/builder-modes.md`
- `docs/design/quote-analyzer.md`
- `docs/design/scenario-comparison.md` (one gate reference)
- `docs/validation/quote-analyzer-corpus.md`
- `docs/validation/quote-analyzer-label-schema.md`
- `docs/validation/quote-analyzer-corpus-report.example.json`
- `docs/validation/quote-analyzer-assurance-schema.md`
- `plans/README.md` — only the single stale sentence at `:102` about §12.1

**Out of scope**:
- `docs/PRODUCT_VISION.md` — the constitution; amendment governance applies,
  no agent edits it for consistency.
- `AGENTS.md` — gitignored/untracked; a git-based executor cannot deliver it
  (see Maintenance notes).
- Code, tests, workflows, generated artifacts.
- Rewriting design intent or decisions; this plan only corrects current-state
  facts and status wording.

## Git workflow

- Branch: `advisor/045-docs-truth-up`
- Commits: `045: <imperative summary>` (e.g. `045: reconcile design and validation docs with shipped state`).
- Do NOT push or open a PR.

## Steps

### Step 0: Verify the shipped-state facts

Before editing, re-confirm each fact so the docs are updated to reality, not
to this plan:

```sh
rg -n "createMeasurement|product_start" pc-quote-builder/src/App.jsx
rg -n "measurement.track" pc-quote-builder/src/components/QuoteAnalyzer/QuoteAnalyzer.jsx
rg -n "noop|no-op|sink" pc-quote-builder/src/lib/measurement/measurement.js
rg -n "Builder guiado" pc-quote-builder/src
rg -n "PLAN_STATUS|DONE" plans/README.md | head
```

If any contradiction with "Current state" appears, STOP and report.

### Step 1: Correct the measurement status

In `docs/design/decision-measurement.md`, replace the status block lines 3-5
with wording equivalent to:

```
> Status: contract implemented. Plan 032 wires the events through the
> provider-neutral adapter; the default sink is a no-op and **no network
> transmission is authorized by this document**.
```

Keep the rest of the privacy/authorization paragraph (lines 6-12) intact. In
§6 ("Plan 032 instrumentation map"), change leading references from future
tense ("Events are wired by Plan 032") to present ("Events are wired through
the Plan 032 transitions; the adapter's default sink discards them").

### Step 2: Mark the legacy corpus protocol as superseded and the example as synthetic

1. `docs/validation/quote-analyzer-corpus.md`, status block: state that
   Plan 035 is DONE and the harness is implemented; the automated launch gate
   remains unevaluated because no private corpus exists (owner waiver
   2026-09-25), so the document remains the governing protocol for collection
   but is no longer "in progress". Include the actual invocation path:
   `node scripts/quote_analyzer_assurance.js --conformance-dir scripts/fixtures/quote-analyzer-assurance`
   (run from the repository root; use the `package.json` script added by plan
   037 if present).
2. `docs/validation/quote-analyzer-label-schema.md`: replace "mientras Plan 035
   no complete la migración" with "Plan 035 está DONE; estos artefactos de
   Plan 029 son históricos y no deben usarse para afirmar acuerdo experto".
3. `docs/validation/quote-analyzer-assurance-schema.md:3-4`: change
   "ejecutado por Plan 035" to "implementado por Plan 035 (DONE)".
4. `docs/validation/quote-analyzer-corpus-report.example.json`: add a top-level
   `"illustrative": true` key and extend `limitations` with the Spanish
   equivalent of "Synthetic illustration; no real corpus has been collected
   (owner waiver 2026-09-25)". Do not remove existing keys or change the report
   schema shape; validate the JSON parses.

### Step 3: Correct current-state facts in the design docs

1. `docs/design/builder-modes.md`:
   - §1: remove or annotate the "current UI labels … 'Builder guiado'
     (`App.jsx:748`)" claim with an `(as of 2026-07-30)` marker or replace it
     with the shipped fact: the picker is labeled "Constructor experto".
   - §2 table: update the PSU connector row to note Plan 036 measured coverage
     at 17.0% (from 0/2128) and that `checkPsuConnectors` still reports
     `unknown` on missing data.
   - §Phase table (`:127`): the Phase B gate should read "shared analyzer
     assessment contract in production (Plans 028/032, DONE) + Milestone 2
     quality gates".
2. `docs/design/quote-analyzer.md`:
   - §2.1: update the two `App.jsx` line references to `:428-449` and
     `:451-497`.
   - Phase E row (`:408`): change the proposed path to
     `src/components/QuoteAnalyzer/` (shipped) and note it is DONE via Plan 032.
   - Phase G row (`:410`): note Plan 035 is DONE and plan 037 wires its CLI
     into CI.
3. `docs/design/scenario-comparison.md:148`: update the Phase B gate reference
   to Plans 028/032 (DONE).
4. `plans/README.md:102`: change the sentence "Plan 024's implementation
   additionally waits on the owner decision in design §12.1
   (required-component set)" to record that §12.1 was approved 2026-07-31 and
   implemented by Plan 028. Touch no other line of that file.

### Step 4: Sweep for remaining contradictions

Run:

```sh
rg -n "Plan 035 (implementa|no complete|hasta que termine)|not yet instrumented|Builder guiado|0/2128|wait.*§12.1" docs/ plans/README.md
```

Fix any hit that is a current-state claim (not a historical record inside an
archived plan or an explicit "as of" note). Do not edit `plans/archive/`.

**Verify**: the sweep command returns no current-state contradictions; the
JSON example parses.

## Test plan

Documentation-only; the test is the sweep plus:

- `node -e "JSON.parse(...)"` → `ok`
- `npm test` → all pass (proves no accidental code file was touched)

## Done criteria

ALL must hold:

- [ ] `rg -n "not yet instrumented" docs/` returns no matches
- [ ] `rg -n "hasta que termine" docs/validation/` returns no matches
- [ ] `rg -n "Builder guiado" docs/` returns no matches
- [ ] `rg -n "illustrative" docs/validation/quote-analyzer-corpus-report.example.json` matches
- [ ] JSON example parses (`node -e` prints `ok`)
- [ ] `npm test` exits 0
- [ ] `git diff --name-only 6cde4b8...HEAD` lists only in-scope docs plus
      `plans/README.md`
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- A "shipped fact" cannot be confirmed in the working tree (e.g. the no-op sink
  is gone) — the plan's premise is wrong.
- Editing the example JSON would require changing the report schema version or
  keys consumed by the assurance harness.
- A contradiction lives in `docs/PRODUCT_VISION.md` — surface it as a
  governance issue instead of editing the vision.
- You find yourself rewriting design decisions rather than current-state facts;
  stop and report which decision looks wrong.

## Maintenance notes

- These docs are the current-state baseline for future plans (e.g. 048-051).
  When a later plan ships, update the corresponding "current state" section in
  the same change.
- `AGENTS.md` carries a stale plan table (plans 004-008 listed TODO while all
  are archived/DONE). It is gitignored and untracked, so a git-based executor
  cannot deliver the fix. The tracked equivalent is
  `plans/README.md` as the single status source; the local file should be
  synced by the operator manually.
- **Deferred**: converting the example report into a generated fixture is not
  authorized; it stays a hand-maintained illustration.
