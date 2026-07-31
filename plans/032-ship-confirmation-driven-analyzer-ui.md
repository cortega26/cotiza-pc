# Plan 032: Ship the confirmation-driven Quote Analyzer workflow

> **Executor instructions**: Follow this plan step by step. This is the first
> production surface that renders Analyzer conclusions, so evidence semantics
> are safety-critical. Run every focused test and the full gate. If a requested
> UX would turn ambiguous text into a confirmed identity or unknown into valid,
> STOP and report instead of improvising.
>
> **Drift check (run first)**:
> `git diff --stat cef0acd..HEAD -- docs/PRODUCT_VISION.md docs/design/quote-analyzer.md docs/design/builder-modes.md pc-quote-builder/src/App.jsx pc-quote-builder/src/App.css pc-quote-builder/src/components pc-quote-builder/src/hooks/useCatalog.js pc-quote-builder/src/lib/quoteAnalyzer pc-quote-builder/src/lib/measurement pc-quote-builder/src/lib/csvParser.js pc-quote-builder/src/lib/quoteModel.js`
>
> If Plans 028-031 are not DONE or their contracts differ from this plan, STOP.
>
> **Working-tree protection**: run `git status --short` before the drift check.
> At planning time, unrelated uncommitted changes existed in `App.test.jsx` and
> `catalogMapper*`. Preserve them. If they remain uncommitted or overlap this
> plan after rebase, STOP and ask the owner how they should be reconciled.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: Plans 028, 030, 031, and 035
- **Category**: direction
- **Planned at**: commit `cef0acd`, 2026-07-30

## Why this matters

The current application starts with a component picker labeled "Builder
guiado," while the canonical product sequence makes imported-quote analysis the
primary experience and the current picker the supporting Expert Builder. Users
can import CSV/JSON or edit rows but receive no evidence-qualified verdict about
that quote. This plan adds the complete input → confirmation → verdict → action
workflow, preserving every unknown and keeping the existing manual builder
available as an expert surface.

## Product-decision record

- Beachhead: Chile-based non-expert evaluating a desktop gaming quote within a
  near-term purchase window.
- Required context: gaming, target resolution, optional informational budget,
  price/assembly scope, and explicit integrated-GPU confirmation when relevant.
- Identity: only exact catalog ID or explicit row-by-row user confirmation
  enables assessment evidence. Paste parsing creates unresolved rows, never
  confirmed products.
- Output: concise verdict, explicit unknowns, and at most three prioritized
  decision-changing findings, with expandable evidence for all findings.
- No claims about value, market price, performance balance, upgradeability,
  thermals, noise, durability, BIOS, or unsupported categories.
- Current picker is relabeled Expert/Manual Builder; Guided Builder remains
  unshipped.
- Measurement uses Plan 031's provider-neutral adapter. Analytics failure must
  never affect assessment.

Public enablement is conditional on Plan 035 passing its automated conformance,
critical-negative-control, missing-evidence, and real-input resolution gates.
The UI may be implemented and tested before that report exists, but must remain
explicitly controlled or disabled if the gate fails or is unevaluable. Copy
must describe bounded catalog/rule assurance, never expert validation or a
universal safety guarantee.

## Current state

- `pc-quote-builder/src/App.jsx:571-668` puts quote/import/catalog actions in the
  sidebar.
- `pc-quote-builder/src/App.jsx:745-750` currently leads with:

  ```jsx
  <p className="kicker">Builder guiado</p>
  <h2>Selecciona piezas compatibles paso a paso</h2>
  ```

- `pc-quote-builder/src/App.jsx:415-435` imports a CSV/JSON file directly into
  persisted quotes and ends with an alert.
- `pc-quote-builder/src/components/QuoteEditor.jsx:123-216` provides per-row
  manual text inputs but no identity status or confirmation step.
- `pc-quote-builder/src/hooks/useCatalog.js:41-183` loads only requested
  categories and exposes readiness/fallback state.
- `docs/design/quote-analyzer.md:94-116` defines six resolution states and the
  no-free-text-evidence invariant.
- `docs/design/quote-analyzer.md:148-205` defines the report shape and verdict
  precedence.
- `docs/design/quote-analyzer.md:383-396` reserves UI as Phase E.
- UI tests use Testing Library `fireEvent`, `screen`, `waitFor`, and mocked
  catalog hooks; follow `App.test.jsx` and component tests.

## Commands you will need

Run from `pc-quote-builder/`.

| Purpose | Command | Expected on success |
|---|---|---|
| Paste parser | `npx vitest run src/lib/quotePasteParser.test.js` | all pass |
| Analyzer components | `npx vitest run src/components/QuoteAnalyzer` | all pass |
| App integration | `npx vitest run src/App.test.jsx` | all pass |
| Catalog regression | `npx vitest run src/hooks/useCatalog.test.jsx src/lib/dataLoader.test.js` | all pass |
| Required gate | `npm run check` | exit 0 |
| Diff hygiene | `git diff --check` | exit 0 |

Do not run the catalog pipeline or production build to `docs/`.

## Scope

**In scope**:

- `pc-quote-builder/src/lib/quotePasteParser.js` and test.
- `pc-quote-builder/src/lib/workspaceMode.js` and test — dependency-free
  `?modo=analizar|experto` URL/query synchronization.
- `pc-quote-builder/src/components/QuoteAnalyzer.jsx` and test.
- Optional focused subcomponents and tests:
  `AnalyzerContextForm`, `AnalyzerResolutionReview`, `AnalyzerVerdict`.
- `pc-quote-builder/src/App.jsx` and `App.test.jsx` — mode navigation, catalog
  demand, active-quote handoff, and measurement wiring.
- `pc-quote-builder/src/App.css` and `src/index.css` only as needed.
- Existing quote/import modules only for narrowly required adapters/tests.
- `docs/design/quote-analyzer.md` only to record a UI clarification discovered
  during implementation.

**Out of scope**:

- Fuzzy/AI matching, OCR, screenshot/PDF extraction, URL scraping, or automatic
  category guesses from product names.
- Persisting user mappings globally or changing catalog aliases.
- A new router/UI dependency; repository rules prohibit dependency changes here.
- Guided recommendations, comparison UI, owned parts, monitoring, sharing, or
  accounts.
- Value, performance-balance, or retailer recommendations.
- Changing Analyzer core semantics to make the UI easier.
- New telemetry providers or raw event payloads.

## Git workflow

- Branch: `advisor/032-ship-confirmation-driven-analyzer-ui`
- Suggested logical commits:
  `032: add conservative quote paste adapter`,
  `032: add analyzer resolution and verdict UI`,
  `032: make analyzer the primary workspace`.
- Do not push/open a PR unless instructed.

## Steps

### Step 1: Implement dependency-free workspace navigation

Create pure helpers to parse and serialize `?modo=analizar|experto`. Default an
absent/invalid mode to `analizar`. In `App`, synchronize the active workspace
with `history.pushState`/`replaceState` and `popstate` in a dedicated hook or
effect; effects are appropriate here because URL history is an external system.
Do not store derived mode in localStorage.

Render two clearly labeled controls:

- `Analizar cotización` — primary/default;
- `Constructor experto` — current manual picker.

Rename all shipped "Builder guiado" copy so Guided Builder is not implied to
exist.

**Verify**:
`npx vitest run src/lib/workspaceMode.test.js src/App.test.jsx`
→ default, explicit modes, invalid query, back/forward, and labels pass.

### Step 2: Add a conservative structured-paste adapter

Create `quotePasteParser.js` as a pure adapter. Support copied tables with
tab/comma/semicolon delimiters and normalized headers compatible with existing
CSV vocabulary. Without headers, create product-text rows with blank category.
Preserve source line numbers for review, but do not persist the entire clipboard
text after conversion.

Never infer catalog ID or category from a product name. Reject empty input and
enforce bounded rows/cell lengths to avoid freezing the browser. Reuse
`normalizeRow`; do not duplicate CSV quoting logic where `parseCsv` can be
exported safely.

**Verify**:
`npx vitest run src/lib/quotePasteParser.test.js`
→ TSV, quoted CSV, semicolon, headerless lines, CRLF, blank/total rows, oversized
input, formula-like text, and malformed input pass.

### Step 3: Build the Analyzer context and intake screen

The screen must allow:

- analyze the active quote;
- import existing CSV/JSON through current parsing;
- paste structured text and review the resulting rows;
- continue manual row editing through `QuoteEditor`;
- set target resolution, budget amount/currency (informational), price/assembly
  scope, and integrated-GPU confirmation.

All six catalog categories must be requested when Analyzer resolution begins.
Show per-category loading, fallback, and failure; do not run a qualified verdict
while required categories are unresolved due to loading/failure.

**Verify**:
component tests cover active quote, file import, paste, manual editing, context
validation, category loading/fallback/failure, and integrated graphics.

### Step 4: Build explicit identity review

For each supported row, display original product/category, resolution state, and
candidate choices. `exact-id` requires no confirmation but remains inspectable.
`ambiguous` requires explicit selection. `unmatched-text` allows manual
catalog search within a user-selected category. Unsupported rows remain visible
and excluded with an explanation.

Store mappings in component state keyed by analysis/quote row ID. Reset mappings
when quote ID, row product/category/item ID, catalog generation, or aliases
change. A single candidate still requires confirmation. Duplicate required
categories must be resolved explicitly.

Reuse `TypeaheadSelect` for manual choice while preserving keyboard behavior.

**Verify**:
tests prove no candidate auto-confirms, mapping reset works, unsupported rows stay
visible, duplicate categories block qualification, and keyboard selection works.

### Step 5: Invoke the pure Analyzer and render the verdict

Construct the exact Plan 028 input, including caller-supplied `evaluatedAt`,
catalog/rules versions, context, aliases, and mappings. Derive the report with
`useMemo`; do not use an effect followed by `setState`.

Render:

- overall verdict with distinct fail/warning/unknown/ok/incomplete language;
- seven dimension outcomes;
- one to three highest-severity findings first;
- all remaining findings and unknowns;
- expandable evidence: affected components/input values, decision type, source
  fields, catalog/quote freshness, rule version, confidence, limitation, action;
- Plan 030 coverage state when a dimension cannot be verified.

Never render "Todo ok" when any required dimension is unknown.

**Verify**:
tests cover all F1-F7 UI outcomes, evidence expansion, top-three ordering,
unknown isolation, freshness, and no unsupported dimension claims.

### Step 6: Record explicit decision actions through Plan 031

Offer keep, change, reject, negotiate, compare, and defer after the verdict.
Emit only the allow-listed Plan 031 events at explicit transitions: start, input
complete, confirmation requested/completed, qualified verdict viewed, evidence
opened, and decision action. Inject the default no-op sink; do not add a network
sink.

Ensure rerenders do not duplicate events and raw quote information never enters
payloads.

**Verify**:
component/integration tests use the in-memory test sink and assert exact event
counts, order, allowed fields, and no emission for an unqualified verdict.

### Step 7: Preserve Expert Builder and handoff

Keep the existing builder behavior and tests unchanged except honest naming.
Allow a resolved Analyzer quote to open in Expert mode without losing quote rows
or Analyzer context during the session. Do not make Expert edits silently
reapply old mappings; require re-analysis when relevant input changes.

**Verify**:
`npx vitest run src/App.test.jsx src/lib/selectionEvaluation.test.js`
→ Analyzer-to-Expert handoff, edits invalidating analysis, and existing builder
flows pass.

### Step 8: Verify responsive and accessible interaction

Ensure mode navigation, context form, resolution review, evidence disclosure,
and decision actions work below/above the 900px layout breakpoint. Provide
labels, focus order, visible focus, live status only where appropriate, and
focus movement to errors/verdict after explicit submit.

**Verify**:
Testing Library keyboard/focus assertions pass; manually inspect at representative
mobile and desktop widths if browser tooling is available.

### Step 9: Run the full gate and launch check

Run all focused tests and `npm run check`. Confirm Plan 035's launch report
passes conformance, all critical negative controls, missing-evidence behavior,
and the real-input resolution threshold. If it does not, keep the workflow
behind an explicit controlled/non-public entry and report the blocker.

**Verify**:
`npm run check && git diff --check`
→ exit 0 and only in-scope files changed.

## Test plan

- Pure paste parser cases, including size bounds and no inference.
- Resolution states: exact, confirmed, one/many candidate, unmatched,
  unsupported, integrated GPU, duplicates, and catalog drift.
- All Analyzer verdict and dimension states.
- Missing/stale evidence, partial/fallback catalogs, invalid/missing context.
- Measurement event sequence and raw-data denial.
- URL navigation, back/forward, Analyzer↔Expert handoff, mobile drawer.
- Existing import, quote persistence, compatibility, and builder regressions.

## Done criteria

- [ ] Analyzer is the default clearly labeled workspace.
- [ ] Current picker is labeled Expert/Manual, not Guided.
- [ ] File, paste, and manual intake reach a review step.
- [ ] No free text or single candidate auto-confirms identity.
- [ ] All evidence-bearing findings come from Plan 028.
- [ ] Unknown/incomplete cannot render as valid or qualified activation.
- [ ] Evidence, freshness, confidence, rule version, and action are inspectable.
- [ ] Plan 031 events are emitted without a network sink or raw quote data.
- [ ] Expert Builder remains usable and regression tests pass.
- [ ] Plan 035 public-launch gate is met or the workflow remains controlled.
- [ ] `npm run check` and `git diff --check` pass.
- [ ] `plans/README.md` is updated.

## STOP conditions

Stop and report if:

- Any dependency plan is incomplete or its contract changed.
- Plan 035 fails a conformance case, misses a critical negative control, lets
  missing/conflicting evidence become `ok`, or cannot evaluate its coverage
  gate.
- Trustworthy identity would require fuzzy/AI/OCR matching.
- Required catalog categories cannot be loaded without weakening staged-load
  failure semantics.
- UI copy or ordering would imply unsupported value/performance claims.
- Measurement requires raw quote data or a new provider.
- A new routing/dependency package appears necessary.
- Existing Expert Builder behavior would need removal rather than coexistence.

## Maintenance notes

Keep product conclusions in the pure Analyzer, not components. New input
adapters must end at the same explicit confirmation boundary. Maintainers and
automated UI tests should scrutinize mapping resets, top-finding ordering,
unknown language, event deduplication, assurance-claim copy, and whether the
default workflow still matches the canonical product sequence.
