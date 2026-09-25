# Plan 050: Show explicit notices when builder selections are cleared by a conflict

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6cde4b8..HEAD -- pc-quote-builder/src/App.jsx pc-quote-builder/src/App.test.jsx`
> If `App.jsx` changed (plans 038/042/044 also edit it), compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/040-characterize-app-quote-flows.md (cascade tests must exist first); recommended after plans/038/042/044
- **Category**: direction (Expert Builder trust)
- **Planned at**: commit `6cde4b8`, 2026-09-25

## Why this matters

The Expert Builder silently destroys user work: changing the CPU clears an
incompatible motherboard/RAM, changing the motherboard clears mismatched RAM
and an incompatible case, and choosing a longer GPU clears the case — all with
no message. `docs/design/builder-modes.md:21` records this as a known gap
("Destructive clears are silent — no 'we cleared X because Y'"), and
`:102,:126` list "Non-destructive conflict resolution" as a Phase A addition
that is "production-safe today", with no new recommendation rules. The product
vision requires warnings to inform rather than block and requires the distinct
conflict states to be explicit (`docs/PRODUCT_VISION.md:102-112`).

This slice implements the smallest Phase A piece: when the builder clears a
selection because of a conflict, it says so, with a dismissible notice. It does
**not** preserve the cleared selection, does not add override semantics, and
does not change compatibility rules.

## Product-decision record (required by `AGENTS.md` / `docs/PRODUCT_VISION.md`)

- **Owner decision (2026-09-25)**: the project owner selected this slice from
  the improve audit. It is the "explicit notice" variant of the silent-clear
  replacement recorded as an open owner decision in `docs/design/builder-modes.md`
  §8; selections are still cleared, but visibly.
- **Owner decision extension (2026-09-25, after the STOP review)**: the owner
  approved **evidence-gated clears**. A selection may only be cleared when the
  data needed to establish the conflict is present on both sides; unknown or
  missing data must never clear a selection and must never announce a conflict.
  This is the only behavior change this plan authorizes; compatibility rules,
  evaluation semantics, and the real-conflict clears are unchanged. Rationale:
  the repository's own compatibility checks already return `unknown` for
  missing data, so keeping the selection lets the assessment surface the
  unknown honestly instead of destroying user work (see STOP history in
  Maintenance notes).
- **Dimension improved**: explainability / trust on the Expert surface.
- **Evidence type**: deterministic (the same conditions already used to clear,
  now gated on data presence).
- **Failure modes**: more on-screen text; a notice must never appear when
  nothing was cleared; missing data never clears and never announces.
- **Milestone**: no numeric Milestone exit criterion; supports trustworthy
  Expert behavior while the Analyzer remains the primary flow.

## Current state

`pc-quote-builder/src/App.jsx:326-368` (`handleBuilderChange`) contains the
silent clears:

```js
      if (key === "cpuId") {
        ...
        if (mobo && cpu && mobo.socket !== cpu.socket) next.moboId = "";
        if (ram && cpu && cpu.memoryTypeExplicit && ram.type !== cpu.memoryType) next.ramId = "";
      }
      if (key === "moboId") {
        const mobo = findInList(motherboards, cleanValue);
        const ram = findInList(ramKits, next.ramId);
        if (mobo && ram && mobo.memoryTypeExplicit && ram.type !== mobo.memoryType) next.ramId = "";
        const currentCase = findInList(pcCases, next.caseId);
        if (mobo && currentCase && !currentCase.formFactors?.includes(mobo.formFactor)) {
          next.caseId = "";
        }
      }
      if (key === "gpuId") {
        next.useIntegratedGpu = false;
        const gpu = findInList(gpus, cleanValue);
        const currentCase = findInList(pcCases, next.caseId);
        if (gpu && currentCase && gpu.length > currentCase.maxGpuLength) {
          next.caseId = "";
        }
      }
```

The builder section header renders at `App.jsx:798-824`; the stepper begins at
`:826`. `handleClearBuilder` resets the selection. Existing cascade tests are
in `App.test.jsx` (implemented by plan 040; e.g. "deselects incompatible mobo
when CPU socket changes").

## Commands you will need

| Purpose | Command | Provenance | Expected on success |
|---|---|---|---|
| Install | `npm ci` (in `pc-quote-builder/`) | declared | exit 0 |
| Focused tests | `npm test -- App` | declared | all pass |
| Full tests | `npm test` | executed | all pass |
| Lint | `npm run lint` | executed | exit 0 |

## Scope

**In scope**:
- `pc-quote-builder/src/App.jsx`
- `pc-quote-builder/src/App.test.jsx`

**Out of scope**:
- Changing compatibility rules, evaluation semantics, or the real-conflict
  clear outcomes; only the three evidence guards in Step 1 are authorized.
- Preserving/restoring the cleared selection, "undo", or override mechanics.
- `builder-modes.md` — plan 045 corrects its current-state facts; do not add
  features to it here.
- Styling beyond existing class names (`warning-panel`, `link-btn`).

## Git workflow

- Branch: `advisor/050-non-destructive-conflict-notices`
- Commits: `050: <imperative summary>` (e.g. `050: announce builder clears caused by conflicts`).
- Do NOT push or open a PR.

## Steps

### Step 1: Gate each clear on present data (owner decision 2026-09-25)

Guard only the clear conditions that currently treat missing data as a
conflict. Do not change the comparison operators or the compatibility rules.

1. CPU socket (`key === "cpuId"`):
   `if (mobo && cpu && cpu.socket && mobo.socket && mobo.socket !== cpu.socket)`
2. CPU memory type: the condition already requires `cpu.memoryTypeExplicit`;
   additionally require the RAM type to be present:
   `if (ram && cpu && cpu.memoryTypeExplicit && ram.type && ram.type !== cpu.memoryType)`
3. Motherboard memory type: already requires `mobo.memoryTypeExplicit`; add
   `ram.type` as in (2).
4. Motherboard → case form factor:
   `if (mobo && currentCase && mobo.formFactor && currentCase.formFactors?.length && !currentCase.formFactors.includes(mobo.formFactor))`
5. GPU length: already safe (`gpu.length > currentCase.maxGpuLength` is false
   when either value is missing); do not change it.

Rationale: `checkCpuMoboCompatibility`, `checkRamMoboCompatibility` and
`checkMoboCaseCompatibility` already return `unknown` when the data needed for
judgment is missing, so keeping the selection lets the assessment surface the
unknown honestly instead of destroying the selection.

**Verify**: `npm test -- App` passes, including new cases asserting that a CPU
with no socket does not clear a selected motherboard, that a case with empty
`formFactors` is not cleared by a motherboard selection, and that a RAM row
with no type is not cleared; the plan-040 characterization tests for real
conflicts remain green.

### Step 2: Collect a notice inside `handleBuilderChange`

1. Add state near the builder state: `const [builderNotice, setBuilderNotice] = useState("");`.
2. Inside `handleBuilderChange`, accumulate reason strings while building
   `next`, then publish them after `setBuilder`:

   ```js
   const notices = [];
   setBuilder((prev) => {
     const next = { ...prev, [key]: cleanValue };
     if (key === "cpuId") {
       ...
       if (mobo && cpu && mobo.socket !== cpu.socket) {
         next.moboId = "";
         notices.push("Se quitó la placa madre porque su socket no coincide con el CPU seleccionado.");
       }
       if (ram && cpu && cpu.memoryTypeExplicit && ram.type !== cpu.memoryType) {
         next.ramId = "";
         notices.push("Se quitó la RAM porque su tipo no coincide con el CPU seleccionado.");
       }
     }
     ...
   });
   if (notices.length) setBuilderNotice(notices.join(" "));
   ```

   Note: `setBuilder`'s updater may run twice under React StrictMode, so
   **never push into an outer array from inside the updater without
   idempotence** — prefer computing the clears and notices outside the updater
   (the current code already reads `next` inside; restructure minimally so the
   notice array is built from the same conditions, or deduplicate notices with
   a `Set` keyed by string before setting). Do not leave notice accumulation
   as a side effect that can duplicate.
3. `handleClearBuilder`: also `setBuilderNotice("")`.
4. Do not clear the notice when a subsequent change clears nothing — it stays
   until dismissed (the user may still be reading it).

### Step 3: Render the notice

Immediately after the `builder-head` `</div>` at `App.jsx:824`, add:

```jsx
{builderNotice && (
  <div className="warning-panel" role="status">
    <span>{builderNotice}</span>{" "}
    <button className="link-btn" onClick={() => setBuilderNotice("")} aria-label="Cerrar aviso">
      Cerrar
    </button>
  </div>
)}
```

Keep the existing copy rules: only appear for the five clear conditions in
Step 1; no notice for missing data (a `null` socket/form factor never triggers
a clear today, so it must never trigger a notice).

### Step 4: Tests

Extend `App.test.jsx` (use the plan 040 cascade tests as the base). Each case
asserts both the cleared selection and the notice text:

1. CPU socket change clears mobo → notice about socket.
2. CPU memory-type change clears RAM → notice about RAM/CPU.
3. Motherboard memory-type change clears RAM → notice about RAM/placa madre.
4. Motherboard form-factor change clears case → notice about gabinete/placa madre.
5. GPU too long clears case → notice about GPU/gabinete.
6. A compatible change produces **no** notice.
7. "Cerrar" dismisses the notice; clearing the builder also resets it.
8. Missing CPU socket + selected mobo → selection kept, **no** notice.
9. Case with empty `formFactors` + mobo selection → selection kept, **no** notice.
10. RAM with no type + explicit CPU memory type → selection kept, **no** notice.

**Verify**: `npm test -- App` → all pass, including the ten cases.

## Test plan

As in Step 4. Use exact Spanish strings from Step 2; assert with
`screen.getByText(...)` / `getByRole("status")`.

**Verification**: `npm test` → all pass; `npm run lint` → exit 0.

## Done criteria

ALL must hold:

- [ ] `npm run lint` exits 0
- [ ] `npm test` exits 0, including the five notice cases, the no-notice case,
      dismiss/reset, and the three missing-data no-clear cases
- [ ] The three evidence guards (CPU socket, RAM type, case form factors) are
      present in the clear conditions, and the plan-040 real-conflict cascade
      tests are unchanged and green
- [ ] `rg -n "builderNotice" pc-quote-builder/src/App.jsx` shows state,
      five clear sites, render, dismiss, and clear-builder reset
- [ ] `rg -n 'role="status"' pc-quote-builder/src/App.jsx` matches once
- [ ] `git diff --name-only 6cde4b8...HEAD` lists only `App.jsx` and
      `App.test.jsx`
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 040 has not landed (cascade behavior lacks characterization tests).
- The cascade conditions have changed shape (e.g. plan 038/042 rewrote them) —
  report the divergence rather than reintroducing old conditions.
- After the evidence guards, a real-conflict clear stops firing its notice
  (clear condition and notice must stay in lockstep) — report the mismatch.
- `checkCpuMoboCompatibility`, `checkRamMoboCompatibility`, or
  `checkMoboCaseCompatibility` stops returning `unknown` for missing data (the
  rationale for keeping the selection) — report it instead of adding
  compensating copy.
- StrictMode testing shows duplicated notice text (the accumulation is not
  idempotent) — restructure rather than deduplicate display strings.

## Maintenance notes

- The notice copy is user-facing Spanish product text; if copy review changes
  it, update the tests in the same change.
- If a future plan adds override/undo behavior, the notice component is the
  natural place to host the action; do not build it now.
- The evidence guards (Step 1) are part of the 2026-09-25 owner decision; do
  not weaken them. A clear without both sides' data present is a bug, not a
  preference.
- Reviewer should scrutinize: exactly the five clear conditions fire notices,
  each only when both sides' data is present; missing data keeps the selection;
  no compatibility rule changed.
- **Execution history and amendment (2026-09-25)**: the first execution
  stopped on branch `advisor/041-050-builder-cleanups` (WIP commit `4e82726`)
  after implementing the five notices, seven tests, and the StrictMode
  single-notice test (suite green, 1060 passing / 1 todo), because the STOP
  condition "a notice would fire for an unknown/missing-data case" is real:
  - `mobo && cpu && mobo.socket !== cpu.socket` is true when `cpu.socket` is
    missing; 549 of 1,255 shipped CPUs have no `socket` in the raw artifact
    (some are inferred by the mapper, but unknown-socket CPUs remain
    selectable), so the mobo was cleared and the notice would claim a socket
    mismatch that was never established.
  - `!currentCase.formFactors?.includes(mobo.formFactor)` is true when
    `formFactors` is empty; 120 of 7,914 shipped cases have no
    `supported_mobo_form_factors`, so the case was cleared and the notice would
    claim a form-factor mismatch.
  - `mobo.formFactor` missing would do the same for the mobo→case path (0
    occurrences in the shipped catalog, but possible with degraded data).
  **Resolution**: the owner approved evidence-gated clears (see the
  product-decision record and Step 1). Resume from the WIP commit, apply the
  three guards, and extend the tests with the three missing-data no-clear
  cases; the notice WIP otherwise stands.
