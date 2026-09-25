# Plan 044: Harden quote persistence, import detection, export filenames, mapper inputs, and workspace history

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6cde4b8..HEAD -- pc-quote-builder/src/hooks/usePersistence.js pc-quote-builder/src/lib/fileIO.js pc-quote-builder/src/lib/catalogMapper.js pc-quote-builder/src/hooks/useWorkspaceMode.js pc-quote-builder/src/App.jsx pc-quote-builder/src/components/QuoteAnalyzer/QuoteAnalyzer.jsx`
> If any in-scope file changed since this plan was written (plans 038, 042,
> 043 also edit `App.jsx`/`QuoteAnalyzer.jsx`), compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it
> as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S-M
- **Risk**: MED (storage behavior)
- **Depends on**: plans/042 and plans/043 (shared `App.jsx`/`QuoteAnalyzer.jsx`); plan 040 recommended for App test coverage
- **Category**: bug
- **Planned at**: commit `6cde4b8`, 2026-09-25

## Why this matters

Five defense-in-depth defects protect user data and outputs:

1. **One nullish stored quote destroys all quotes.** `usePersistence.js:19-21`
   evaluates `q.name` before `normalizeQuote` can defend against a null entry
   (`lib/quoteModel.js` handles `!quote`), so `[validQuote, null]` throws, the
   outer catch returns a single empty quote, and the mount effect immediately
   overwrites the original array in localStorage. The previous data is
   unrecoverable from the app.
2. **Empty JSON imports report success.** The builder path appends
   `buildQuotesFromJson` results and always alerts "Cotización importada con
   éxito" (`App.jsx:428-449`); an empty array imports nothing yet claims success.
   The analyzer path already throws for an empty result
   (`QuoteAnalyzer.jsx:281-283`). The two surfaces also re-implement the same
   JSON-vs-CSV detection.
3. **Export filenames come from an unvalidated quote name.** A JSON quote file
   from a third party can carry path separators/control characters into
   `link.download` (`App.jsx:419,425` → `fileIO.js:62`). A `slugify` helper
   already exists and is tested (`fileIO.js:1-7`), but is unused on this path.
4. **One malformed case record drops a whole category.** `catalogMapper.js:49-54`
   calls `raw.every(...)` without an `Array.isArray` guard; a string
   `formFactors` field throws and `useCatalog` catches per category, replacing
   the remote category with fallback data.
5. **`pushState` runs inside a `setState` updater** (`useWorkspaceMode.js:17-25`),
   which React StrictMode intentionally double-invokes in development, pushing
   duplicate history entries so Back needs two presses per workspace switch.

## Current state

`pc-quote-builder/src/hooks/usePersistence.js:12-28`:

```js
function buildInitialState() {
  const rawQuotes = (() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.quotes);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          return parsed.map((q, idx) =>
            normalizeQuote(q, q.name || `Importada ${idx + 1}`)
          );
        }
      }
    } catch (err) {
      console.warn("No se pudo cargar cotizaciones guardadas", err);
    }
    return [createEmptyQuote("Mi PC actual")];
  })();
```

The quotes write effect is at `:67-73`. The hook returns `{ quotes, setQuotes,
activeQuoteId, setActiveQuoteId, builder, setBuilder, currencyDraft,
setCurrencyDraft, STORAGE_KEYS }`.

`pc-quote-builder/src/App.jsx:428-449` (builder import) and
`pc-quote-builder/src/components/QuoteAnalyzer/QuoteAnalyzer.jsx:270-290`
(analyzer import) each compute:

```js
const isJson = file.name.toLowerCase().endsWith(".json") || content.trim().startsWith("{") || content.trim().startsWith("[");
```

`pc-quote-builder/src/lib/catalogMapper.js:49-54`:

```js
function normalizeCaseFormFactors(pcCase) {
  const raw = pcCase.supported_mobo_form_factors ?? pcCase.formFactors ?? [];
  if (raw.every((f) => CANONICAL_FORM_FACTORS.has(f))) return raw;
  const mapped = raw.flatMap((f) => LEGACY_FORM_FACTOR_MAP[f] ?? f);
  return [...new Set(mapped)];
}
```

`pc-quote-builder/src/hooks/useWorkspaceMode.js:17-25`:

```js
  const setMode = useCallback((next) => {
    setModeState((current) => {
      if (current === next) return current;
      const url = new URL(window.location.href);
      const search = serializeWorkspaceMode(next, url.search);
      window.history.pushState({ workspaceMode: next }, "", `${url.pathname}${search}${url.hash}`);
      return next;
    });
  }, []);
```

Repo conventions: hooks use `renderHook`/`act`/`waitFor` (see
`usePersistence.test.js`, `useCatalog.test.jsx`); pure helpers are tested
co-located; Spanish user-facing copy.

## Commands you will need

| Purpose | Command | Provenance | Expected on success |
|---|---|---|---|
| Install | `npm ci` (in `pc-quote-builder/`) | declared | exit 0 |
| Focused tests | `npm test -- usePersistence fileIO catalogMapper useWorkspaceMode App QuoteAnalyzer` | declared | all pass |
| Full tests | `npm test` | executed | all pass |
| Lint | `npm run lint` | executed | exit 0 |

## Scope

**In scope**:
- `pc-quote-builder/src/hooks/usePersistence.js`
- `pc-quote-builder/src/lib/fileIO.js`
- `pc-quote-builder/src/lib/catalogMapper.js`
- `pc-quote-builder/src/hooks/useWorkspaceMode.js`
- `pc-quote-builder/src/App.jsx` (import call site + export filenames only)
- `pc-quote-builder/src/components/QuoteAnalyzer/QuoteAnalyzer.jsx` (import call site only)
- Tests: `usePersistence.test.js`, `fileIO.test.js`, `catalogMapper.test.js`,
  new `useWorkspaceMode.test.js`, plus the import/filename cases in
  `App.test.jsx`/`QuoteAnalyzer.test.jsx`

**Out of scope**:
- Storage schema/versioning migration (`pcqb:quotes:v1` key format unchanged).
- Any change to `parseCsvToQuote`, `buildQuotesFromJson`, or price imports.
- `normalizeQuote`/`normalizeRow` semantics (`lib/quoteModel.js`).
- Analyzer stage machine, resolver, report.

## Git workflow

- Branch: `advisor/044-harden-import-persistence-workspace`
- Commits: `044: <imperative summary>`.
- Do NOT push or open a PR.

## Steps

### Step 0: Establish a green baseline

From `pc-quote-builder/`: `npm ci`, `npm run lint`, `npm test` — exit 0. If
plan 040 landed, the App characterization tests are your safety net; if 042/043
have not landed, note it in your report and keep diffs minimal.

### Step 1: Recover per entry and never overwrite corrupt storage on first render

In `usePersistence.js`:

1. Track `hydrationFailed` inside `buildInitialState()`.
2. Normalize each entry defensively with `q?.name` and a per-entry try/catch;
   keep every entry that normalizes and skip only the broken ones.
3. If the outer `JSON.parse` fails, or every entry fails, or some entries were
   skipped, set `hydrationFailed = true`.
4. Before returning the fallback, preserve the original raw string under a
   backup key: `localStorage.setItem(`${STORAGE_KEYS.quotes}:backup:${Date.now()}`, raw)`
   inside its own try/catch (never let backup failure break startup).
5. Return `hydrationFailed` in the state object.
6. In the hook, initialize a ref from `initial.hydrationFailed`
   (`const skipPersistRef = useRef(initial.hydrationFailed);`) and have the
   quotes effect skip exactly one write when it is set:
   ```js
   useEffect(() => {
     if (skipPersistRef.current) { skipPersistRef.current = false; return; }
     try { localStorage.setItem(STORAGE_KEYS.quotes, JSON.stringify(quotes)); }
     catch (err) { console.warn("No se pudo guardar cotizaciones", err); }
   }, [quotes]);
   ```
   All later user edits persist normally.
7. Do not return `hydrationFailed` from the hook unless a test needs it; keep
   the public surface unchanged if possible.

**Verify**: `npm test -- usePersistence` passes including new cases:
`[valid, null]` → valid quote preserved and stored blob unchanged after mount;
unparseable JSON → fallback shown and original blob untouched plus a backup key
created; all-valid input still persists normally after an edit.

### Step 2: Unify import-kind detection and stop reporting empty-import success

1. In `fileIO.js`, export:
   ```js
   export const detectQuoteFileKind = (fileName, content) => {
     const isJson = String(fileName || "").toLowerCase().endsWith(".json")
       || content.trim().startsWith("{")
       || content.trim().startsWith("[");
     return isJson ? "json" : "csv";
   };
   ```
2. Use it in both `App.jsx:433` and `QuoteAnalyzer.jsx:271-275`; keep each
   caller's parsing/selection policy.
3. In `App.jsx`'s `handleImportFile`, after parsing JSON, if
   `importedQuotes.length === 0` throw `new Error("El archivo no contiene cotizaciones.")`
   so the existing catch alerts the error (matching the analyzer). CSV parsing
   already throws for an empty file via `parseCsvToQuote`.

**Verify**: `npm test -- fileIO App QuoteAnalyzer` passes, including an App
case: importing `[]` (or `{"quotes":[]}`) shows the failure alert and adds no
quote.

### Step 3: Slugify export filenames

In `App.jsx:416-426`, import `slugify` from `./lib/fileIO` (it is exported) and
build names as:

```js
const fileBase = slugify(activeQuote.name) || "cotizacion";
downloadFile(csvContent, `${fileBase}.csv`, "text/csv;charset=utf-8;");
downloadFile(JSON.stringify(payload, null, 2), `${fileBase}.json`, "application/json");
```

**Verify**: `npm test -- fileIO App` passes; add a unit test asserting
`slugify("../../etc/passwd")` and a name with control characters/emoji produce a
separator-free filename with the `.csv` suffix when used as above (test the
helper composition, not the browser download).

### Step 4: Guard the mapper against non-array form factors

In `catalogMapper.js:49-54`:

```js
function normalizeCaseFormFactors(pcCase) {
  const raw = pcCase.supported_mobo_form_factors ?? pcCase.formFactors ?? [];
  const list = Array.isArray(raw) ? raw : [];
  if (list.every((f) => CANONICAL_FORM_FACTORS.has(f))) return list;
  const mapped = list.flatMap((f) => LEGACY_FORM_FACTOR_MAP[f] ?? f);
  return [...new Set(mapped)];
}
```

**Verify**: `npm test -- catalogMapper` passes including a case where
`formFactors: "ATX"` and `supported_mobo_form_factors: "ATX"` both map without
throwing and yield `[]`.

### Step 5: Move `pushState` out of the state updater

Rewrite `useWorkspaceMode.setMode` to be effect-free and impure-updater-free:

```js
import { useCallback, useEffect, useRef, useState } from "react";
...
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const setMode = useCallback((next) => {
    if (modeRef.current === next) return;
    modeRef.current = next;
    const url = new URL(window.location.href);
    const search = serializeWorkspaceMode(next, url.search);
    window.history.pushState({ workspaceMode: next }, "", `${url.pathname}${search}${url.hash}`);
    setModeState(next);
  }, []);
```

Keep the `popstate` effect unchanged. The URL remains the external system being
synchronized; only the write moves out of the updater.

**Verify**: create `pc-quote-builder/src/hooks/useWorkspaceMode.test.js` using
`renderHook` from Testing Library inside `React.StrictMode` (wrap with
`{ wrapper: React.StrictMode }`): starting from an empty search, call
`act(() => result.current[1]("experto"))` and assert `window.history.length`
increased by exactly 1 and `window.location.search` contains the serialized
mode; repeating the same mode does not push again. Reset history between tests
with `window.history.replaceState({}, "", "/")`.

## Test plan

- `usePersistence.test.js`: partial-corruption recovery, backup key, no
  overwrite on first render, later edits persist.
- `fileIO.test.js`: `detectQuoteFileKind` for extension/content combinations;
  `slugify` composition for hostile names.
- `catalogMapper.test.js`: non-array form factors.
- `useWorkspaceMode.test.js` (new): single push under StrictMode, no push for
  same mode, popstate still updates.
- `App.test.jsx`/`QuoteAnalyzer.test.jsx`: empty-JSON import error;
  export filename composition (if 040 landed, extend its tests).

**Verification**: `npm test` → all pass; `npm run lint` → exit 0.

## Done criteria

ALL must hold:

- [ ] `npm run lint` exits 0
- [ ] `npm test` exits 0, including the new cases
- [ ] `rg -n "hydrationFailed|backup:" pc-quote-builder/src/hooks/usePersistence.js` shows the recovery path
- [ ] `rg -n "detectQuoteFileKind" pc-quote-builder/src` shows it defined once and used in both importers
- [ ] `rg -n "slugify" pc-quote-builder/src/App.jsx` shows export filenames go through it
- [ ] `git diff --name-only 6cde4b8...HEAD` lists only in-scope files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `normalizeQuote` itself mutates or throws on the valid-entry inputs used by
  existing tests — report the interaction instead of changing `quoteModel.js`.
- Backup-key writes throw in jsdom (quota/mocked storage) — make them
  non-fatal and report the observed error.
- The StrictMode hook test cannot observe a single push without changing the
  hook's public signature.
- `detectQuoteFileKind` differs from existing behavior on any current test
  fixture (report the fixture and the divergence).

## Maintenance notes

- The backup key is a recovery aid, not a migration: it is never read
  automatically. If a future migration needs it, add an explicit, tested
  restore path.
- Keep the one-write skip scoped to hydration failure only; a lingering
  `skipPersistRef` would silently stop syncing user edits.
- `detectQuoteFileKind` centralizes format sniffing; any new import surface
  should call it rather than re-implementing the extension/content check.
- **Deferred**: a `pcqb:quotes:v2` schema with a real migration is not
  authorized; no key format changes here.
- **Completion (2026-09-25)**: implemented `67acba0`, reviewed and merged as
  `b5d7381`. Recorded deviation: the plan's boolean `skipPersistRef` skip was
  replaced by an identity-based skip (ref holds the hydrated `quotes` array)
  because React StrictMode's double-invoked mount effect would otherwise
  write the normalized/fallback blob on the second pass; the executor
  reproduced the failure with the plan's snippet and the suite now covers
  StrictMode explicitly. Branch suite: 1061 passing / 1 todo; 43 test files
  (new `useWorkspaceMode.test.js`).
