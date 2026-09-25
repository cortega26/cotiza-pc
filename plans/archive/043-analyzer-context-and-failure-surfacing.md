# Plan 043: Let users edit purchase context after analysis and surface degraded catalog compatibility/coverage

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6cde4b8..HEAD -- pc-quote-builder/src/components/QuoteAnalyzer/QuoteAnalyzer.jsx pc-quote-builder/src/components/QuoteAnalyzer/AnalyzerContextForm.jsx pc-quote-builder/src/hooks/useCatalog.js pc-quote-builder/src/App.jsx`
> If any in-scope file changed since this plan was written (plan 042 also
> edits `QuoteAnalyzer.jsx` and `App.jsx`), compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it
> as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW-MED (stage transitions)
- **Depends on**: plans/042-resolver-performance.md (same files); recommended after plans/040 and 042 so the diff is isolated
- **Category**: bug
- **Planned at**: commit `6cde4b8`, 2026-09-25

## Why this matters

Two honesty/usability defects in the primary flow:

1. **Context is write-once.** `AnalyzerContextForm` is rendered once with
   `disabled={stage !== "intake"}`, and the only transitions back to `intake`
   are the file-import and paste handlers. After the first analysis, the user
   cannot correct the target resolution, the integrated-GPU answer, or the
   budget; the verdict's back action goes to `resolve`, and "Re-analizar ahora"
   reuses the unchanged context. The primary workflow dead-ends into
   re-importing the file or reloading the page.
2. **Degraded catalog data is invisible.** When `compatibility.min.json` fails,
   `useCatalog` swallows the rejection (`.catch(() => {})`), so the app shows
   "Catálogo cargado" while using bundled-local aliases and tier maps; the
   computed `assessmentCoverageFailed` flag is returned by the hook but read by
   no production component (verified by `rg assessmentCoverageFailed
   pc-quote-builder/src --glob '!*.test.*'`: only the hook's own lines).

Both contradict the vision's rule that degraded or unavailable verification be
shown, not hidden.

## Current state

`pc-quote-builder/src/components/QuoteAnalyzer/QuoteAnalyzer.jsx:330-335`:

```jsx
      <AnalyzerContextForm
        context={context}
        onChange={setContext}
        disabled={stage !== "intake"}
      />
```

Stage transitions: `startAnalysis` → `setStage("resolve")` (`:184`); back from
verdict → `setStage("resolve")` (`:415`); only `handleImportFile` (`:289`) and
`handleApplyPasteRows` (`:303`) return to `"intake"`.

`pc-quote-builder/src/components/QuoteAnalyzer/AnalyzerContextForm.jsx:10`:
`function AnalyzerContextForm({ context, onChange, disabled = false }) {`.

`pc-quote-builder/src/hooks/useCatalog.js:53` and `:195-206`:

```js
  const [assessmentCoverageFailed, setAssessmentCoverageFailed] = useState(false);
  ...
  return {
    catalog, compatMeta, tierMaps, socketSet, loading, error, fallbackUsed,
    categoryStates, assessmentCoverage, assessmentCoverageFailed,
  };
```

and the compatibility catch at `:140`: `.catch(() => {})`.

`pc-quote-builder/src/App.jsx:101-103`:

```js
  const { catalog, compatMeta, tierMaps, loading: catalogLoading, error: catalogError, fallbackUsed, categoryStates, assessmentCoverage } =
    useCatalog(reloadToken, neededCategories);
```

`pc-quote-builder/src/App.jsx:789-796` renders a warning panel only for
`catalogError || fallbackUsed`. `assessmentCoverage` is passed to
`<QuoteAnalyzer />` at `:1133`, but the failure flag is not.

Repo conventions: Spanish user-facing copy, Testing Library `fireEvent`,
component tests co-located. `QuoteAnalyzer.test.jsx` has a `renderAnalyzer()`
helper and a stage-walking test at `:77-106` to model the new test on.

## Commands you will need

| Purpose | Command | Provenance | Expected on success |
|---|---|---|---|
| Install | `npm ci` (in `pc-quote-builder/`) | declared | exit 0 |
| Focused tests | `npm test -- QuoteAnalyzer AnalyzerContextForm useCatalog App` | declared | all pass |
| Full tests | `npm test` | executed | all pass |
| Lint | `npm run lint` | executed | exit 0 |

## Scope

**In scope**:
- `pc-quote-builder/src/components/QuoteAnalyzer/AnalyzerContextForm.jsx`
- `pc-quote-builder/src/components/QuoteAnalyzer/QuoteAnalyzer.jsx`
- `pc-quote-builder/src/hooks/useCatalog.js`
- `pc-quote-builder/src/App.jsx`
- Tests: `AnalyzerContextForm.test.jsx`, `QuoteAnalyzer.test.jsx`,
  `useCatalog.test.jsx`, `App.test.jsx`

**Out of scope**:
- Changing what context fields exist or how the analyzer scores (v1 context is
  informational; the design decision stands).
- `report.js`, `resolver.js`, stage-machine redesign beyond returning to
  `intake`.
- Persisting context across sessions (not requested; no storage change).
- `assessmentCoverage` manifest format (`scripts/lib/assessmentCoverage.js`).

## Git workflow

- Branch: `advisor/043-analyzer-context-and-failure-surfacing`
- Commits: `043: <imperative summary>` (e.g. `043: allow context edits and surface degraded catalog data`).
- Do NOT push or open a PR.

## Steps

### Step 0: Establish a green baseline

From `pc-quote-builder/`: `npm ci`, `npm run lint`, `npm test` — exit 0. If
plan 042 landed, run `npm run test:assurance` too.

### Step 1: Add an "Editar contexto" affordance

1. `AnalyzerContextForm.jsx`: add an optional `onEditContext` prop and render a
   button when the form is disabled and a handler exists:
   ```jsx
   function AnalyzerContextForm({ context, onChange, disabled = false, onEditContext }) {
     ...
       {disabled && onEditContext && (
         <button className="secondary-btn" onClick={onEditContext}>
           Editar contexto
         </button>
       )}
   ```
   Place it after the hint paragraph (`!isAnalyzerContextValid` block) so it is
   discoverable on every stage.
2. `QuoteAnalyzer.jsx`: pass `onEditContext={() => setStage("intake")}` to the
   form. Do not clear `analysisStart`, `mappings`, or `excludedRowIds` — the
   existing signature/staleness guard handles re-analysis, and mappings are
   row-scoped and should be preserved (this is the point of the fix).

**Verify**: `npm test -- AnalyzerContextForm QuoteAnalyzer` passes, including a
new test in `QuoteAnalyzer.test.jsx` modeled on the stage-walking test at
`:77-106`: reach the verdict, click "Editar contexto", assert the resolution
select is enabled and changing the target resolution then clicking
"Analizar cotización activa" produces a new verdict (and a stale-analysis
banner appears between the edit and the re-analysis).

### Step 2: Surface a compatibility-file failure

1. In `useCatalog.js`, add `const [compatFailed, setCompatFailed] = useState(false)`.
2. Replace the compatibility `.catch(() => {})` (`:140`) with a token-guarded
   handler that sets `compatFailed` to true:
   ```js
   .catch(() => {
     if (currentTokenRef.current !== token) return;
     setCompatFailed(true);
   })
   ```
3. Reset `setCompatFailed(false)` in the reload branch (`:74-88`).
4. Return `compatFailed` from the hook.
5. In `App.jsx`, destructure `compatFailed` and render a muted line in the
   catalog-meta sidebar area (near the existing `catalogError` hint at
   `:666-667`): `"No se pudo cargar la compatibilidad del catálogo; se usan datos locales."`
   Do not set `fallbackUsed` for this case — that flag drives per-category
   "fallback" states and would mislabel loaded categories.

**Verify**: `npm test -- useCatalog App` passes, including a new
`useCatalog.test.jsx` case: `loadCompatibilityFile` rejects while a category
succeeds → `compatFailed === true`, `fallbackUsed === false`,
`compatMeta` stays at the bundled value; a reload resets the flag.

### Step 3: Surface missing assessment coverage

1. `App.jsx`: read `assessmentCoverageFailed` from `useCatalog` and pass it to
   `<QuoteAnalyzer coverageFailed={assessmentCoverageFailed} />`.
2. `QuoteAnalyzer.jsx`: accept `coverageFailed = false`; where the verdict is
   rendered (`isCurrent && report && !report.error`, around `:408-418`), render
   a muted hint before `<AnalyzerVerdict />` when `coverageFailed`:
   `"La cobertura de reglas del catálogo no está disponible; el veredicto se muestra sin notas de cobertura."`
   Do not block analysis and do not alter findings.

**Verify**: `npm test -- QuoteAnalyzer App` passes, including an App test with
`mockUseCatalog.mockReturnValue({ ...defaultMock(), assessmentCoverageFailed: true })`
asserting the hint text is visible; add `compatFailed: false` to
`App.test.jsx`'s `defaultMock()`.

## Test plan

- `AnalyzerContextForm.test.jsx`: disabled without handler → no button;
  disabled with handler → button calls it; enabled → no button.
- `QuoteAnalyzer.test.jsx`: edit-context round trip (Step 1); coverage-failed
  hint renders and analysis still completes (Step 3).
- `useCatalog.test.jsx`: compatibility rejection sets `compatFailed` without
  marking categories fallback; reload resets.
- `App.test.jsx`: compat-failed and coverage-failed hints.

**Verification**: `npm test` → all pass; `npm run lint` → exit 0.

## Done criteria

ALL must hold:

- [ ] `npm run lint` exits 0
- [ ] `npm test` exits 0
- [ ] `rg -n "onEditContext" pc-quote-builder/src` shows the prop in both the
      form and `QuoteAnalyzer.jsx`
- [ ] `rg -n "compatFailed" pc-quote-builder/src/hooks/useCatalog.js pc-quote-builder/src/App.jsx` shows definition, reset, return, and render
- [ ] `rg -n "assessmentCoverageFailed" pc-quote-builder/src/App.jsx` shows it
      is read and passed to the analyzer
- [ ] `plans/README.md` status row updated
- [ ] `git diff --name-only 6cde4b8...HEAD` lists only in-scope files

## STOP conditions

Stop and report back (do not improvise) if:

- The stage machine cannot return to `intake` without discarding mappings or
  `analysisStart` (report the coupling you found).
- Rendering the edit button inside a `<fieldset disabled>` region would
  disable it — place it outside disabled containers; if the form structure
  prevents that without restructuring, STOP and report.
- The compatibility failure path turns out to also be set by a transient
  cancellation (report the sequence instead of surfacing a false warning).
- Any analyzer test's stage expectations change for reasons other than the new
  affordance.

## Maintenance notes

- Context edits rely on `analysisSignature`: if new quote/context fields are
  added, extend the signature (plan 039 does this for currency/priceUpdatedAt),
  or edits will not produce the stale-analysis banner.
- `compatFailed` is deliberately separate from `fallbackUsed`; do not merge
  them or category fallback labels will misreport loaded categories.
- Reviewer should scrutinize: no report/finding semantics changed; "Editar
  contexto" preserves mappings and exclusions.
- **Completion (2026-09-25)**: implemented `90ba921`, reviewed and merged as
  `0de4e23`. Review confirmed the button sits outside the disabled fieldset,
  `compatFailed` is independent of `fallbackUsed`, and the coverage hint is
  informational only. Recorded deviation: the plan's "stale banner between
  edit and re-analysis" state is unreachable (the verdict unmounts at
  `intake`); the test asserts the re-analysis becomes current instead.
  Branch suite: 1043 passing / 1 todo; 9 new tests.
