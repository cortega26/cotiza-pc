# Plan 042: Make Analyzer row resolution cheap, bounded, and lazy

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6cde4b8..HEAD -- pc-quote-builder/src/lib/quoteAnalyzer/resolver.js pc-quote-builder/src/lib/dataLoader.js pc-quote-builder/src/hooks/useCatalog.js pc-quote-builder/src/components/QuoteAnalyzer/QuoteAnalyzer.jsx pc-quote-builder/src/components/QuoteAnalyzer/session.js pc-quote-builder/src/components/QuoteAnalyzer/AnalyzerResolutionReview.jsx pc-quote-builder/src/App.jsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (resolution feeds analyzer states; behavior must stay identical)
- **Depends on**: none; plan 043 should run after this one (shared `QuoteAnalyzer.jsx`)
- **Category**: perf
- **Planned at**: commit `6cde4b8`, 2026-09-25

## Why this matters

The Analyzer recomputes row resolution against the full catalog on every quote
identity change, with no stage or visibility guard, and then renders every
candidate it finds:

- `resolveRow` does a linear `list.find` for `exact-id` and `user-mapped`
  (`resolver.js:81,91`) and a full `items.filter` for candidates (`:98-100`).
  Measured by the audit on the shipped catalog: 38-57 ms per keystroke for 50
  unmatched rows over GPUs/cases/RAM, 114-147 ms at 200 rows; a `Map` lookup is
  ~13× faster than `find` over motherboards.
- `findCandidates` is unbounded; measured candidate counts: `"ATX"` → 3,247,
  `"RTX"` → 2,040, `"DDR5 16GB"` → 1,338. `AnalyzerResolutionReview.jsx:79-91`
  renders one `<li>` + button per candidate.
- `App.jsx:1124-1139` always mounts `QuoteAnalyzer` (expert mode only CSS-hides
  it), so all of this runs while the user edits quotes in the Expert workspace.
- `dataLoader.js:1,27` keeps the raw parsed JSON in a module-level `Map` after
  `useCatalog` has mapped it into a second full object graph — measured ~40.7
  MiB of dead retained heap for the six shipped files.

After this plan: resolution is O(1) per row, candidates are capped with an
explicit manual-search fallback, resolution does not run while the Analyzer
workspace is hidden, and the raw parse is released after mapping. Resolution
states and verdicts must be byte-for-byte identical for the same inputs.

## Current state

`pc-quote-builder/src/lib/quoteAnalyzer/resolver.js:13-32` (`CATALOG_LISTS`,
`catalogListFor`), `:62-103` (`resolveRow`):

```js
  if (row.itemId !== undefined && row.itemId !== null && row.itemId !== "") {
    const resolvedId = resolveCatalogId(row.itemId, aliases);
    const item = list.find((candidate) => candidate && String(candidate.id) === String(resolvedId));
    ...
  const mappingId = explicitMappings && rowId ? explicitMappings[rowId] : undefined;
  if (mappingId !== undefined && mappingId !== null) {
    const resolvedMappingId = resolveCatalogId(mappingId, aliases);
    const mapped = list.find((item) => item && String(item.id) === String(resolvedMappingId));
    ...
  const candidates = findCandidates(row.product, list);
  if (candidates.length > 0) {
    return { state: "ambiguous", rowId, componentKey, candidates };
  }
```

`pc-quote-builder/src/components/QuoteAnalyzer/QuoteAnalyzer.jsx:94-103`:

```js
  const resolutions = useMemo(
    () => resolveRows(analysisRows, catalog, { aliases, explicitMappings }).resolutions,
    [analysisRows, catalog, aliases, explicitMappings]
  );
```

`pc-quote-builder/src/components/QuoteAnalyzer/AnalyzerResolutionReview.jsx:77-92`
renders `resolution.candidates.map(...)` as a `<ul>` with one button each;
`unmatched-text` rows already get the manual `TypeaheadSelect` search at
`:94-128`.

`pc-quote-builder/src/App.jsx:1121-1139` renders the analyzer section with
`className={"analyzer-workspace" + (mode === "analizar" ? "" : " hidden")}`
and no prop telling the component it is hidden.

`pc-quote-builder/src/lib/dataLoader.js:1,19-27`:

```js
const cache = new Map();
...
  if (cache.has(url)) return cache.get(url);
  if (pending.has(url)) return pending.get(url);
  ...
      const data = await res.json();
      cache.set(url, data);
```

`pc-quote-builder/src/App.jsx:154-165` builds `selection` with `findOrAlias`,
which performs up to four linear scans per component; `handleBuilderChange`
(`:326-336`) repeats the same pattern in `findInList`.

Repo conventions: resolver is a pure module with JSDoc; add behavior tests in
`resolver.test.js`; UI tests use Testing Library.

## Commands you will need

| Purpose | Command | Provenance | Expected on success |
|---|---|---|---|
| Install | `npm ci` (in `pc-quote-builder/`) | declared | exit 0 |
| Focused tests | `npm test -- resolver session dataLoader AnalyzerResolutionReview QuoteAnalyzer` | declared | all pass |
| Full tests | `npm test` | executed | all pass |
| Lint | `npm run lint` | executed | exit 0 |
| Assurance conformance | `npm run test:assurance` (plan 037) | declared | exit 0 |

## Scope

**In scope**:
- `pc-quote-builder/src/lib/quoteAnalyzer/resolver.js`
- `pc-quote-builder/src/lib/dataLoader.js`
- `pc-quote-builder/src/hooks/useCatalog.js`
- `pc-quote-builder/src/components/QuoteAnalyzer/QuoteAnalyzer.jsx`
- `pc-quote-builder/src/components/QuoteAnalyzer/session.js`
- `pc-quote-builder/src/components/QuoteAnalyzer/AnalyzerResolutionReview.jsx`
- `pc-quote-builder/src/App.jsx` (pass `active`; index-based selection lookup only)
- Tests: `resolver.test.js`, `session.test.js`, `dataLoader.test.js`,
  `AnalyzerResolutionReview.test.jsx`, `QuoteAnalyzer.test.jsx`

**Out of scope**:
- `report.js`, `contracts.js`, `assemble.js` (Analyzer semantics).
- `TypeaheadSelect.jsx` — Plan 023 settled its rendering; do not virtualize.
- Moving catalog parsing into a Web Worker (larger, unmeasured-on-device; not
  in this plan).
- Any change to resolution ordering, states, or candidate matching rules.

## Git workflow

- Branch: `advisor/042-resolver-performance`
- Commits: `042: <imperative summary>` (e.g. `042: index and bound analyzer row resolution`).
- Do NOT push or open a PR.

## Steps

### Step 0: Establish a green baseline

From `pc-quote-builder/`: `npm ci`, `npm run lint`, `npm test` — exit 0. Run
`npm run test:assurance` if plan 037 has landed; it must pass before you start.

Record a before-measurement (report it, no threshold, just evidence):
```sh
node -e "const fs=require('fs');const g=JSON.parse(fs.readFileSync('public/data/gpus.min.json','utf8'));const t0=performance.now();const n=g.filter(x=>x.name.toLowerCase().includes('rtx')).length;console.log('rtx matches',n,'in',(performance.now()-t0).toFixed(1),'ms')"
```

### Step 1: Add a catalog index and use it in the resolver

In `resolver.js`:

1. Export an index builder:

   ```js
   /**
    * Build per-component id -> item maps once per catalog snapshot.
    * @param {object|null|undefined} catalog
    * @returns {{ byId: Record<string, Map<string, object>> }}
    */
   export function buildCatalogIndex(catalog) {
     const byId = {};
     for (const key of Object.keys(CATALOG_LISTS)) {
       const map = new Map();
       for (const item of catalogListFor(key, catalog)) {
         if (item && item.id !== undefined && item.id !== null) {
           map.set(String(item.id), item);
         }
       }
       byId[key] = map;
     }
     return { byId };
   }
   ```

2. In `resolveRow`, accept `options.index` and prefer it over the linear scan
   (keep the linear scan as the fallback when no index is supplied so existing
   callers and tests are unaffected):

   ```js
   const byId = options.index?.byId?.[componentKey];
   const findById = (id) =>
     byId ? byId.get(String(id)) : list.find((c) => c && String(c.id) === String(id));
   ```

   Use `findById` for both the `exact-id` and `user-mapped` lookups. Behavior
   must be identical: first-match semantics are preserved because item ids are
   unique in the catalog contract.

3. Export `MAX_CANDIDATES = 20` and cap advisory candidates in `resolveRow`:

   ```js
   const allCandidates = findCandidates(row.product, list);
   if (allCandidates.length > 0) {
     return {
       state: "ambiguous",
       rowId,
       componentKey,
       candidates: allCandidates.slice(0, MAX_CANDIDATES),
       candidateCount: allCandidates.length,
       candidatesTruncated: allCandidates.length > MAX_CANDIDATES,
     };
   }
   ```

**Verify**: `npm test -- resolver` passes; add and run a parity check in the
test file: for every existing resolver fixture, `resolveRow(row, catalog)` and
`resolveRow(row, catalog, { index: buildCatalogIndex(catalog) })` deep-equal
(ignoring the new fields where absent).

### Step 2: Use the index in mapping validation and the App selection

1. `session.js` `validMappingsFor(rows, mappings, catalog)` → add an optional
   fourth parameter `index`, and check existence with
   `byId = index?.byId?.[entry.componentKey]`, using `byId.has(String(entry.itemId))`
   when present, else the existing `list.some(...)`.
2. `QuoteAnalyzer.jsx`: build `const catalogIndex = useMemo(() => buildCatalogIndex(catalog), [catalog]);`
   and pass it to `validMappingsFor` and `resolveRows`.
3. `App.jsx`: replace the `findOrAlias`/`findInList` linear scans in the
   `selection` memo (`:154-165`) and `handleBuilderChange` (`:326-336`) with
   lookups through a memoized `buildCatalogIndex(catalog)`:
   ```js
   const findOrAlias = (componentKey, id) => {
     if (!id) return undefined;
     const byId = catalogIndex.byId[componentKey];
     return byId.get(String(id)) || byId.get(String(resolveCatalogId(id, compatMeta?.aliases || {})));
   };
   ```

**Verify**: `npm test -- App session` passes; inspect that component selection,
alias resolution, and cascades behave identically (the characterization tests
from plan 040 are the safety net).

### Step 3: Skip resolution while the Analyzer workspace is hidden

1. `QuoteAnalyzer.jsx`: add `active = true` to props. Make `resolutions`
   return `[]` when `!active` (keep the same memo dependency list plus
   `active`), and add `if (!active) return null;` to the `report` memo
   condition. Guard `startAnalysis` with `if (!active) return;`.
2. `App.jsx:1121-1139`: pass `active={mode === "analizar"}` to `<QuoteAnalyzer />`.

Do not change any stage transition. `startAnalysis` remains reachable only from
the visible analyzer UI, where `active` is true.

**Verify**: `npm test -- QuoteAnalyzer App` passes. Add a `QuoteAnalyzer` test
that renders with `active={false}` and asserts no candidate list is rendered
for an ambiguous row, then re-renders with `active` and asserts it appears.

### Step 4: Surface truncated candidates and keep a manual path

In `AnalyzerResolutionReview.jsx`, for `state === "ambiguous"`:

- If `resolution.candidatesTruncated`, render a muted hint above the list:
  `Mostrando 20 de {resolution.candidateCount} coincidencias.` (use
  `MAX_CANDIDATES` from the resolver, not a hardcoded 20).
- Always offer the existing manual `TypeaheadSelect` search for ambiguous rows
  as well (reuse the `unmatched-text` block's JSX, defaulting `selectedKey` to
  `resolution.componentKey`). This is required so a capped list never removes
  the ability to confirm the correct item.

**Verify**: `npm test -- AnalyzerResolutionReview` passes, including a new
case: 25 fake candidates → 20 rendered, hint text present, manual search
present; 3 candidates → no hint.

### Step 5: Stop retaining the raw parse after mapping

1. In `dataLoader.js`, add a `noCache` option:
   ```js
   const { cacheBust = "", fetchOptions = {}, noCache = false } = options;
   ...
   if (!noCache) cache.set(url, data);
   ```
   Keep `pending` deduplication unchanged and keep `clearCatalogCache()`.
2. In `useCatalog.js`, pass `{ cacheBust: ..., noCache: true }` for
   `loadCategoryFile` and `loadCompatibilityFile`. Leave
   `loadAssessmentCoverageFile` cached (small manifest).

**Verify**: `npm test -- dataLoader useCatalog` passes, including a new
`dataLoader` test: two sequential `loadCatalogFile` calls without `noCache`
fetch once; with `noCache: true` fetch twice; concurrent calls with
`noCache: true` still dedupe to one fetch via `pending`.

## Test plan

- `resolver.test.js`: index/no-index parity for exact-id and user-mapped;
  candidate cap (`MAX_CANDIDATES`), `candidateCount`, `candidatesTruncated`;
  no resolution state changes.
- `session.test.js`: `validMappingsFor` with and without index yields the same
  valid/invalid map.
- `dataLoader.test.js`: caching and `noCache` semantics (Step 5).
- `AnalyzerResolutionReview.test.jsx`: truncation hint, manual search for
  ambiguous rows, existing states unchanged.
- `QuoteAnalyzer.test.jsx`: `active={false}` skips candidate rendering; active
  renders them; existing stage tests still pass.

**Verification**: `npm test` → all pass; `npm run test:assurance` → exit 0 (the
resolution states are pinned by the analyzer contract).

## Done criteria

ALL must hold:

- [ ] `npm run lint` exits 0
- [ ] `npm test` exits 0, including the new cases
- [ ] `npm run test:assurance` exits 0 (or reported as not yet added if 037 has not landed)
- [ ] `rg -n "buildCatalogIndex|MAX_CANDIDATES|noCache" pc-quote-builder/src` shows all three used in production code
- [ ] `rg -n "candidatesTruncated|candidateCount" pc-quote-builder/src/components/QuoteAnalyzer/AnalyzerResolutionReview.jsx` shows the hint logic
- [ ] `plans/README.md` status row updated
- [ ] `git diff --name-only 6cde4b8...HEAD` lists only in-scope files
- [ ] Report includes the before/after `"rtx matches"` measurement and a note
      that resolution states did not change

## STOP conditions

Stop and report back (do not improvise) if:

- Any resolution test or assurance case changes outcome — resolution ordering
  or matching changed, which is not authorized.
- `active={false}` causes a measurement or stage regression (e.g. status text
  missing when switching back to `analizar`).
- Capping candidates cannot be paired with the manual-search fallback without
  new component state (report the design problem instead).
- Step 5 causes `useCatalog` to refetch categories on ordinary re-renders
  (the React state must keep the mapped catalog; only the raw parse is not
  cached).

## Maintenance notes

- `buildCatalogIndex` is O(catalog) per catalog snapshot. Build it once per
  component (`useMemo`) — never inside `resolveRow`.
- If catalog ids ever become non-unique, the Map index keeps first-match
  semantics only if insertion order matches the array; the catalog contract
  guarantees unique ids (Plan 018), and the artifact tests enforce this.
- `MAX_CANDIDATES` is a UI bound, not a correctness rule: any cap must retain
  the manual confirmation path.
- **Deferred**: moving catalog `JSON.parse`/mapping into a Web Worker
  (~145 ms measured main-thread parse on the default workspace) is a larger,
  device-dependent change; do not fold it in.
- **Completion (2026-09-25)**: implemented `6bff8c9`, `85133f5`, `0ff8d11`,
  `5448893`, `ba8039f`, `b184520`; reviewed and merged as `a3e88ab`. Review
  confirmed resolution-state parity (index/no-index deep-equal over all
  fixtures plus assurance 44/44), the cap paired with the manual search, and
  `noCache` keeping `pending` dedupe. One extra commit (`b184520`) removed
  four App list memos that the index made unused (the only lint failure).
  Branch suite: 1034 passing / 1 todo; 18 new tests.
