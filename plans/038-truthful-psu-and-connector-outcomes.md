# Plan 038: Report power and connector outcomes truthfully when TDP or connector data is missing

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6cde4b8..HEAD -- pc-quote-builder/src/lib/compatibility.js pc-quote-builder/src/lib/selectionEvaluation.js pc-quote-builder/src/App.jsx scripts/lib/compiler.js pc-quote-builder/src/lib/compatibility.test.js pc-quote-builder/src/lib/selectionEvaluation.test.js pc-quote-builder/src/App.test.jsx scripts/lib/compiler.test.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (037 recommended first so the gate exists)
- **Category**: bug
- **Planned at**: commit `6cde4b8`, 2026-09-25

## Why this matters

The product vision forbids representing unavailable verification as confirmed
validity, and this repository has already been bitten by the inverse (`fix:
missing PSU/GPU connector data reports unknown, not fail`, commit `fe70824`).
Two gaps remain:

1. `checkPsuPowerSufficiency`/`estimatePowerEnvelope` coerce missing CPU/GPU
   TDP to `0 W`, so a build with an unknown-TDP GPU reports
   `PSU potencia: ok` with a fabricated 50 W estimate. Measured on the shipped
   catalog: **3,552 of 7,614 GPUs have `tdp_w: null`**.
2. `checkPsuConnectors` only understands `12vhpwr` and `8-pin`; any `6-pin` or
   `16-pin` requirement falls through to `{status:"ok"}`. The shipped catalog
   contains **604 GPUs requiring 6-pin** (`1x8-pin 1x6-pin` etc.) and **9 GPUs
   requiring `1x 16-pin`**. Reproduced on this commit:

   ```
   checkPsuPowerSufficiency({wattage_w:300},{},{},50)
     => {"status":"ok","estimated_load_w":50,"recommended_min_psu_w":150}
   checkPsuConnectors({pcie_power_connectors:{"8_pin":1}},{power_connectors:"2x 6-pin"})
     => {"status":"ok"}
   checkPsuConnectors({pcie_power_connectors:{"8_pin":2}},{power_connectors:"1x 16-pin"})
     => {"status":"ok"}
   ```

3. The compiler fabricates `recommended_psu_w: 148` for every null-TDP GPU
   (`Math.ceil(((tdp_w || 0) + 75) * 1.3 + 50)`), which the mapper exposes as
   `psuMin` and the builder uses to warn and to filter PSU options.

After this plan: missing consumption data yields `unknown`, recognized-but-
unsatisfiable connector demand yields `fail`, unrecognized connector strings
yield `unknown`, and no recommendation number is invented from absent data.

## Product-decision record (required by `AGENTS.md` / `docs/PRODUCT_VISION.md`)

- **User problem**: a buyer is told a PSU is sufficient or a cabling
  requirement is satisfied when the data needed to know that is absent or
  unparsed. That is false confidence, not a cosmetic issue.
- **Dimension improved**: power / connectors / evidence honesty.
- **Evidence type**: deterministic when data exists (wattage vs computed load,
  connector counts); `unknown` when required inputs are missing.
- **Uncertainty**: `unknown` is displayed; `fail` is only emitted for a
  recognized, physically impossible pairing. Unrecognized connector tokens
  become `unknown`, never `ok`.
- **Failure modes**: a build that used to show `ok` now shows `unknown`
  (honest but noisier) or `fail` (correct); tests and copy must expect this.
- **How tested**: focused unit tests plus the existing analyzer assurance
  conformance suite (`npm run test:assurance`) after the change.
- **Milestone**: supports Milestone 2's "missing or conflicting required
  evidence resolves to `unknown`, never `ok`".

## Current state

`pc-quote-builder/src/lib/compatibility.js:5-13`:

```js
export function estimatePowerEnvelope(cpu, gpu, extraHeadroomW = 50) {
  const cpuTdp = toNumber(cpu?.tdp_w ?? cpu?.tdp) || 0;
  const gpuTdp = toNumber(gpu?.tdp_w ?? gpu?.tdp) || 0;
  const estimated_load_w = cpuTdp + gpuTdp + extraHeadroomW;
  const suggestedByGpu = toNumber(gpu?.suggested_psu_w);
  const recommendedRaw = Math.max(estimated_load_w * 1.3 + 50, suggestedByGpu || 0);
  const recommended_min_psu_w = Math.ceil(recommendedRaw / 50) * 50;
  return { estimated_load_w, recommended_min_psu_w };
}
```

`pc-quote-builder/src/lib/compatibility.js:81-107` — `checkPsuConnectors`
parses only `12vhpwr` (lines 95-98) and `8-pin` (lines 100-104), then
`return { status: "ok" };` at line 106.

`pc-quote-builder/src/lib/quoteAnalyzer/report.js:347-351` already guards the
analyzer path with an `hasTdp` check, so the analyzer reports `unknown` today;
`pc-quote-builder/src/lib/selectionEvaluation.js:114-128` (builder path) does
not, and that is the bug.

`scripts/lib/compiler.js:163-168`:

```js
  const recommendedCalc = Math.ceil(((tdp_w || 0) + 75) * 1.3 + 50);
  return {
    ...
    recommended_psu_w: Math.max(suggested_psu_w || 0, recommendedCalc),
```

`pc-quote-builder/src/lib/catalogMapper.js:160` maps that to
`psuMin: gpu.recommended_psu_w ?? gpu.suggested_psu_w ?? gpu.psuMin ?? null`.
`pc-quote-builder/src/App.jsx:212-215` and `:1004-1013` render the envelope,
and `:222-225` filters the PSU typeahead by it.

PSU connector data shape (`scripts/lib/sources.js:68-83`): the compiler emits
only `8_pin` (from `pcie_6_plus_2_pin` / `8_pin` / `6+2`) and `12vhpwr`
(12VHPWR + 12V-2x6). A `6+2`/`8_pin` cable can serve a 6-pin demand, so both
count toward one shared PCIe cable pool. Pure 6-pin-only PSUs are not modeled;
that remains a documented gap.

Repo conventions: pure functions in `src/lib/`, Spanish user-facing copy,
JSDoc on exported helpers, tests co-located (`*.test.js(x)`) using Vitest.
Follow the existing structure of `compatibility.test.js` (fixtures `cpu`,
`gpu`, `psu` at the top) and `report.test.js`.

## Commands you will need

| Purpose | Command | Provenance | Expected on success |
|---|---|---|---|
| Install | `npm ci` (in `pc-quote-builder/`) | declared | exit 0 |
| Focused tests | `npm test -- compatibility selectionEvaluation` | declared | all pass |
| Full tests | `npm test` | executed | all pass |
| Lint | `npm run lint` | executed | exit 0 |
| Artifact contracts (after regen) | `npm run test:artifacts` | declared | all pass |
| Assurance conformance | `npm run test:assurance` (plan 037) | declared | exit 0 |
| Rebuild processed data | `npm run build:pc-data` | declared | exit 0, writes `data/processed/` |
| Sync to public | `npm run sync:pc-data` | declared | exit 0 |
| Production build | `npm run build` | declared | exit 0, writes `docs/` |

**Provenance**: `executed` = the advisor ran it during recon; `declared` =
read from `package.json`/CI but not run.

## Scope

**In scope**:
- `pc-quote-builder/src/lib/compatibility.js`
- `pc-quote-builder/src/App.jsx` (display of estimate/recommendation and PSU option filter)
- `scripts/lib/compiler.js` (`mergeGpu` recommendation only)
- Tests: `pc-quote-builder/src/lib/compatibility.test.js`,
  `pc-quote-builder/src/lib/selectionEvaluation.test.js`,
  `pc-quote-builder/src/App.test.jsx`, `scripts/lib/compiler.test.js`
- Generated artifacts (only via the pipeline/step 5): `data/processed/gpus.min.json`,
  `pc-quote-builder/public/data/gpus.min.json`, `docs/data/gpus.min.json`

**Out of scope**:
- `pc-quote-builder/src/lib/quoteAnalyzer/report.js` — its `hasTdp` guard is
  already correct; do not change its semantics in this plan. (Plan 039 touches
  this file for unrelated reasons; if 039 already landed, only avoid its
  regions.)
- `scripts/lib/sources.js` connector mapping and PSU 6-pin modeling.
- `pc-quote-builder/src/lib/csvParser.js`, `money.js`, `session.js`.
- Any dependency or workflow change (plan 037).

## Git workflow

- Branch: `advisor/038-truthful-psu-and-connector-outcomes`
- Commits: `038: <imperative summary>` (e.g. `038: report unknown power when TDP is missing`).
- Do NOT push or open a PR.

## Steps

### Step 0: Establish a green baseline

From `pc-quote-builder/`: `npm ci`, `npm run lint`, `npm test`. All exit 0.
Then run the three reproduction one-liners from "Why this matters" with
`node --input-type=module -e` to confirm the bug exists on this checkout. If
they already return `unknown`/`fail`, STOP — the codebase has drifted.

### Step 1: Make the power envelope honest about missing TDP

In `pc-quote-builder/src/lib/compatibility.js`, rewrite
`estimatePowerEnvelope` so that:

- `estimated_load_w` is `null` when either CPU TDP or GPU TDP is not a finite
  number.
- `recommended_min_psu_w` is computed from the envelope only when both TDPs
  exist; otherwise it falls back to the GPU's vendor `suggested_psu_w`
  (rounded up to the next 50 W) or `null`.

Target shape (adapt names as needed):

```js
export function estimatePowerEnvelope(cpu, gpu, extraHeadroomW = 50) {
  const cpuTdp = toNumber(cpu?.tdp_w ?? cpu?.tdp);
  const gpuTdp = toNumber(gpu?.tdp_w ?? gpu?.tdp);
  const suggestedByGpu = toNumber(gpu?.suggested_psu_w);
  const hasTdp = cpuTdp !== null && gpuTdp !== null;
  const estimated_load_w = hasTdp ? cpuTdp + gpuTdp + extraHeadroomW : null;
  const computedRaw = hasTdp ? estimated_load_w * 1.3 + 50 : null;
  const recommendedRaw = hasTdp
    ? Math.max(computedRaw, suggestedByGpu || 0)
    : suggestedByGpu;
  const recommended_min_psu_w =
    recommendedRaw == null ? null : Math.ceil(recommendedRaw / 50) * 50;
  return { estimated_load_w, recommended_min_psu_w };
}
```

In `checkPsuPowerSufficiency`, before comparing wattage, return an unknown
result when the envelope has no estimate:

```js
if (estimated_load_w == null) {
  return { status: "unknown", reason: "Faltan datos de consumo (TDP) para estimar la fuente" };
}
```

Keep the existing `psu`/`cpu`/`gpu` presence guard and "PSU sin wattage" guard
above this. Preserve the existing warning/fail thresholds exactly.

**Verify**: run the missing-TDP one-liner — expected
`{"status":"unknown",...}`; run `npm test -- compatibility` and update the
affected expectations only where the new honest behavior demands it.

### Step 2: Make the connector check parse what the catalog actually contains

Rewrite `checkPsuConnectors` in `compatibility.js` so it handles, in this
order (order matters because `"16-pin"` contains `"6-pin"`):

1. `12vhpwr` and `16-pin` as the same requirement class
   (`/(\d+)\s*x?\s*(?:12vhpwr|16-pin)/`).
2. `8-pin` (`/(\d+)\s*x?\s*8-pin/`).
3. `6-pin` (`/(\d+)\s*x?\s*6-pin/`) — but only on the string left after the
   previous patterns are removed, so `"1x 16-pin"` cannot be read as a 6-pin
   demand.

Count multiple occurrences additively (a string may list several tokens), and
default a token without a leading count to `1`. Then:

- If a 12VHPWR/16-pin demand exceeds `connectors["12vhpwr"]`, return
  `{ status: "fail", reason: "Falta 12VHPWR/16-pin" }`.
- Count one shared PCIe cable pool: `(connectors["8_pin"] || 0) + (connectors["6+2"] || 0)`.
  If `required8 + required6` exceeds the pool, return
  `{ status: "fail", reason: "Faltan cables PCIe" }`.
- If any alphanumeric residue remains after removing all recognized tokens and
  separators (`[\s,;/|+]+`), return
  `{ status: "unknown", reason: "Conectores de GPU no reconocidos: <residue>" }`.
- Otherwise return `{ status: "ok" }`.

Keep the existing early returns: missing PSU/GPU → unknown; PSU with no
connector object → unknown; empty GPU requirement → unknown.

**Verify**: run the two connector one-liners — expected `fail` for
`2x 6-pin` with one `8_pin`, and `fail` for `1x 16-pin` with zero `12vhpwr`.
Add a third check: `{power_connectors:"1x8-pin 1x6-pin"}` against
`{pcie_power_connectors:{"8_pin":1}}` → expected `fail` (needs two cables).

Before finishing this step, count how many GPU records now yield `fail` vs
`unknown` with a throwaway `node -e` script over `data/processed/gpus.min.json`
and `data/processed/psus.min.json`; record the numbers in your report. If the
`unknown` count rises above the number of records whose strings contain tokens
other than 6/8/12/16-pin patterns, STOP and report the sample strings — the
parser is rejecting formats it should understand.

### Step 3: Stop inventing `recommended_psu_w` in the compiler

In `scripts/lib/compiler.js`, inside `mergeGpu` (lines ~155-168), compute the
recommendation only when `tdp_w` is a finite number; otherwise use the vendor
`suggested_psu_w` when it is finite, else `null`:

```js
const hasTdp = typeof tdp_w === "number" && Number.isFinite(tdp_w);
const vendorPsu = typeof suggested_psu_w === "number" && Number.isFinite(suggested_psu_w)
  ? suggested_psu_w
  : null;
const recommendedCalc = hasTdp ? Math.ceil((tdp_w + 75) * 1.3 + 50) : null;
const recommended_psu_w = hasTdp ? Math.max(vendorPsu || 0, recommendedCalc) : vendorPsu;
```

Keep every other field unchanged. `catalogMapper.js:160` already null-coalesces
to `suggested_psu_w`/`psuMin`, so `psuMin` becomes `null` for those records
with no further mapper change. Do not edit `catalogMapper.js` unless a test
proves it necessary (then report why).

**Verify**: `npm test -- compiler` passes, including a new test that
`mergeGpu` of a single record with `tdp_w: null` and no `suggested_psu_w`
produces `recommended_psu_w: null`.

### Step 4: Update the builder display and PSU filtering

In `pc-quote-builder/src/App.jsx`:

- `estimatedTdp`/`suggestedWatts` (lines 212-213) must stay `null` when the
  envelope returns `null`; do not coerce with `|| 0` for display.
- `recommendedPsuWatts` (lines 214-215) remains
  `Math.max(suggestedWatts || 0, gpuPsuRequirement || 0)`; when both are absent
  it is `0` and the `psuOptionsForStep` filter (`:222-225`) must show all PSUs
  (verify `Math.max(0 - 100, 0) === 0`).
- Around lines 872 / 1004 / 1008 / 1013: when `estimatedTdp` is `null`, render
  `"Sin datos de consumo"` (or `"—"`) instead of `0 W`, and hide/omit the
  margin line (`wattage - estimatedTdp`) because it cannot be computed.
  When `recommendedPsuWatts` is `0` and no vendor hint exists, render the
  "Sugerido" hint only if a recommendation exists.
- Keep Spanish copy and existing class names.

**Verify**: `npm test -- App` passes after updating the affected assertions;
manually confirm with `npm run dev` that a GPU with no TDP shows "Sin datos de
consumo" and an unfiltered PSU list. (If you cannot run a browser, state that
in the report; the unit tests are the gate.)

### Step 5: Regenerate catalog artifacts (conditional on environment)

The compiler change is inert until generated data is rebuilt.

1. Check for raw data: `test -d data/raw && echo present`.
2. If present (or after `npm run download:pc-data` succeeds — this task
   concerns catalog data, so the pipeline is authorized here):
   ```sh
   cd pc-quote-builder
   npm run build:pc-data
   npm run sync:pc-data
   npm run test:artifacts
   npm run build                 # refreshes ../docs assets and docs/data
   npx vitest run src/lib/postBuildAssertion.test.js
   ```
   Then prove the fabricated value is gone:
   ```sh
   node -e "const g=require('./data/processed/gpus.min.json');const bad=g.filter(x=>x.tdp_w==null&&x.recommended_psu_w!=null);console.log('null-tdp with recommendation:',bad.length)"
   ```
   Expected `0`. If nonzero, the compiler edit was not applied to the right
   branch of `mergeGpu` — fix and rebuild.
3. If `data/raw/` is absent AND the downloader cannot run (no Python deps and
   no network), STOP and report: list the exact commands the operator must run
   in the main checkout (`npm run pc-data:all`, `npm run build`,
   `npx vitest run src/lib/postBuildAssertion.test.js`). Do not hand-edit any
   file under `data/processed/`, `public/data/`, or `docs/data/`.

**Verify**: either the `node -e` count above prints `0` after a rebuild, or a
STOP report was filed.

## Test plan

Follow the fixture style at the top of `pc-quote-builder/src/lib/compatibility.test.js`.

- `compatibility.test.js`: power with missing CPU TDP → `unknown`; missing GPU
  TDP → `unknown`; both TDP present → unchanged ok/warning/fail thresholds;
  connector `2x 6-pin` with one 8-pin → `fail`; `1x 16-pin` with no 12vhpwr →
  `fail`; `1x8-pin 1x6-pin` with one 8-pin → `fail`; `2x 6-pin` with two
  8-pin → `ok`; an unrecognized token (e.g. `"1x molex"`) → `unknown`;
  existing missing-data cases stay `unknown`.
- `selectionEvaluation.test.js`: a builder selection with an unknown-TDP GPU
  and a PSU yields `psuStatus.status === "unknown"` and no `ok` PSU status.
- `App.test.jsx`: when the selected GPU has no TDP, the metrics show
  "Sin datos de consumo" and the PSU typeahead lists wattages below the old
  filtered floor (use the existing mocked catalog fixtures).
- `scripts/lib/compiler.test.js`: null-TDP GPU → `recommended_psu_w` null;
  null-TDP with vendor `suggested_psu_w: 600` → `600`; with TDP → unchanged
  formula output.

**Verification**: `npm test` → all pass, including the new cases. Then run
`npm run test:assurance` (from plan 037) — the conformance suite must still
pass; if it now fails, STOP and report which case changed, because it would
mean this plan altered a supported rule outcome the assurance suite pins.

## Done criteria

ALL must hold:

- [ ] `npm run lint` exits 0
- [ ] `npm test` exits 0, including the new cases above
- [ ] `npm run test:assurance` exits 0 (or is reported as not yet added if plan
      037 has not landed)
- [ ] `node --input-type=module -e` reproductions from "Why this matters" now
      return `unknown`/`fail` (record the exact outputs)
- [ ] If artifacts were regenerated: the null-TDP-with-recommendation count is
      `0` and `npm run test:artifacts` + post-build assertion pass
- [ ] `plans/README.md` status row updated
- [ ] `git diff --name-only 6cde4b8...HEAD` lists only in-scope files
      (generated data files allowed only if Step 5 ran)

## STOP conditions

Stop and report back (do not improvise) if:

- The "Current state" excerpts do not match the live files.
- The analyzer assurance suite fails after the change (a pinned supported-rule
  outcome changed).
- More than 5% of GPU connector strings over the shipped catalog become
  `unknown` due to unrecognized tokens (report the samples instead of
  broadening the parser silently).
- `data/raw/` is unavailable and the downloader cannot run (Step 5 branch 3) —
  report the required operator commands.
- A fix appears to require editing `quoteAnalyzer/report.js`,
  `catalogMapper.js`, or `scripts/lib/sources.js`.

## Maintenance notes

- `estimatePowerEnvelope` now returns nullable numbers. Any new caller must
  handle `null`; do not reintroduce `|| 0`.
- Pure-6-pin PSUs remain unmodeled in `sources.js` (the compiler emits only
  `8_pin`/`12vhpwr`). A GPU with only a 6-pin demand against such a PSU yields
  `unknown`, which is safe; a future plan may map `pcie_6_pin` separately.
- The shared PCIe cable pool model assumes any `8_pin`/`6+2` cable can serve one
  6-pin or 8-pin demand. If the catalog later exposes per-cable types, revisit
  `checkPsuConnectors` and its assurance cases.
- Reviewer should scrutinize: no `ok` result remains reachable when TDP or
  connector demand is unknown/unparsed; all Spanish copy still renders.
- **Deferred**: `mobo.max_memory_speed_mts` coverage gap (documented in Plan
  036) is unrelated.
- **Completion (2026-09-25)**: implemented `994e39a` (code/tests) and
  `6b1b882` (regenerated artifacts); reviewed and merged as `05e9ca8`. The
  review confirmed the generated `gpus.min.json` delta is exactly
  `recommended_psu_w` on the 3,552 null-TDP records, `compatibility.min.json`
  / `assessment-coverage.min.json` differ only in `generatedAt`, and
  `report.js:348`'s `hasTdp` guard keeps the analyzer path safe. Browser
  verification was skipped (browser profile in use); the new jsdom App test
  and a real-catalog data check covered the display path. Judgment call
  recorded: raw `"None"` connector strings now resolve `unknown` because
  `sanitizeConnectorString` maps them to missing data upstream and no catalog
  record contains them.
