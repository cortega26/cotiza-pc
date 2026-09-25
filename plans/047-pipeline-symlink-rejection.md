# Plan 047: Reject symlinked dataset files in the catalog pipeline readers

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6cde4b8..HEAD -- scripts/lib/io.js scripts/lib/sources.js`
> If either file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `6cde4b8`, 2026-09-25

## Why this matters

The scheduled pipeline clones third-party datasets at pinned SHAs
(`scripts/download_pc_datasets.py:95-110`) and reads every JSON/CSV file with
`fs.readFileSync`, which follows symlinks. Git materializes committed symlinks
on checkout, so a pinned upstream commit containing a symlinked dataset file
could point a reader at any file readable by the build runner, and if the link
target parses as JSON/CSV its contents would be embedded into the published
Pages catalog (`scripts/sync_processed_to_public_data.js:38-41`). The pin
review process is the real control; this plan adds defense in depth so a
poisoned pinned commit fails the build loudly instead of silently importing
unintended content.

Findings are scoped to code behavior; no runnable misuse examples are needed or
included.

## Current state

`scripts/lib/io.js:8-23` — JSON directory reader with no `lstat` check:

```js
export const readJsonFiles = (dir) => {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const items = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, file), "utf8");
      const parsed = JSON.parse(raw);
      ...
```

`scripts/lib/io.js:25-27` — CSV reader:

```js
export const readCsvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return [];
  const text = fs.readFileSync(filePath, "utf8");
```

`scripts/lib/sources.js:306-314` — dbgpu CSV discovery loop:

```js
  const csvFiles = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => f.endsWith(".csv"))
    : [];
  for (const csv of csvFiles) {
    json.push(...readCsvFile(path.join(dir, csv)));
  }
```

`scripts/lib/sources.js:342-355` — pc-part fixed-file reader:

```js
export function loadPcPart(rawDir) {
  const base = path.join(rawDir, "pc-part-dataset", "data", "json");
  const read = (file) => {
    const full = path.join(base, file);
    if (!fs.existsSync(full)) return [];
    try {
      const raw = fs.readFileSync(full, "utf8");
```

Repo conventions: pipeline helpers are pure-ish ESM modules under
`scripts/lib/` with Vitest tests co-located (`normalize.test.js`,
`compiler.test.js`); tests use Node filesystem access and `os.tmpdir()`.

## Commands you will need

| Purpose | Command | Provenance | Expected on success |
|---|---|---|---|
| Install | `npm ci` (in `pc-quote-builder/`) | declared | exit 0 |
| IO tests | `npx vitest run ../scripts/lib/io.test.js` (from `pc-quote-builder/`) | declared | all pass |
| Pipeline tests | `npx vitest run ../scripts/lib` | declared | all pass |
| Root verification | `bash scripts/verify.sh` (from repository root) | declared | exit 0 |
| Full app tests | `npm test` | executed | all pass |

## Scope

**In scope**:
- `scripts/lib/io.js`
- `scripts/lib/sources.js` (readers only: `loadDbGpu` CSV loop, `loadPcPart` reader)
- `scripts/lib/io.test.js` (create)

**Out of scope**:
- `scripts/download_pc_datasets.py` clone/fetch behavior, pin values, or
  provenance handling.
- `scripts/lib/compiler.js`, `normalize.js`, `assessmentCoverage.js`.
- Generated artifacts under `data/`, `pc-quote-builder/public/data/`, `docs/`.
- Failing on symlinks outside dataset reads (e.g. repository source files).

## Git workflow

- Branch: `advisor/047-pipeline-symlink-rejection`
- Commits: `047: <imperative summary>` (e.g. `047: reject symlinked dataset files`).
- Do NOT push or open a PR.

## Steps

### Step 0: Establish a green baseline

From `pc-quote-builder/`: `npm ci`; `npx vitest run ../scripts/lib` — all pass.
Then scan any local raw data for existing symlinks (informational; do not
modify):

```sh
find data/raw -type l 2>/dev/null | head
```

If symlinks exist in a currently pinned dataset, STOP and report their paths —
the new guard would refuse to build, and the decision on how to treat them is
the operator's.

### Step 1: Add a symlink guard to the IO helpers

In `scripts/lib/io.js`:

```js
export const assertNotSymlink = (filePath) => {
  if (fs.lstatSync(filePath).isSymbolicLink()) {
    throw new Error(`Archivo de dataset simbólico rechazado: ${filePath}`);
  }
  return filePath;
};
```

Use it before every read:

- `readJsonFiles`: for each candidate file,
  `assertNotSymlink(path.join(dir, file))` before `readFileSync`.
- `readCsvFile`: after the `existsSync` check, `assertNotSymlink(filePath)`.

Do not wrap the guard in the existing `try/catch` that logs and continues —
the throw must abort the build (that is the point). `readJsonFiles` currently
catches per-file parse errors; place `assertNotSymlink` outside that inner
catch (e.g. call it before entering the `try`, or rethrow when the message
matches), so a symlink fails the run rather than being skipped with a warning.

### Step 2: Use the guard in `sources.js` readers

1. In `loadDbGpu`'s CSV loop (`sources.js:309-314`), call
   `assertNotSymlink(path.join(dir, csv))` before `readCsvFile` (or rely on
   `readCsvFile`'s own guard — importing the guard is only needed if you
   filter the list first).
2. In `loadPcPart`'s `read(file)` (`:344-355`), call `assertNotSymlink(full)`
   after the `existsSync` check and before `readFileSync`.

Import `assertNotSymlink` alongside the existing `readCsvFile, readJsonFiles`
import at `sources.js:4`.

**Verify**: `npx vitest run ../scripts/lib` → all pass (no current fixture is a
symlink).

### Step 3: Add focused tests

Create `scripts/lib/io.test.js` using `fs.mkdtempSync(path.join(os.tmpdir(), "pc-io-"))`
and `afterEach` cleanup. Cases:

1. `readJsonFiles` reads regular `.json` files and concatenates arrays.
2. `readJsonFiles` throws when the directory contains a symlinked `.json` file
   (create the target elsewhere in the temp dir, then `fs.symlinkSync`).
3. `readCsvFile` throws for a symlinked CSV path.
4. `readCsvFile` parses quoted fields, escaped quotes, and CRLF as before
   (guard added a regression case).
5. Missing directory/file still returns `[]` (no throw).

Model the test style on `scripts/lib/normalize.test.js` (plain Vitest, `node`
environment, no jsdom import).

**Verify**: `npx vitest run ../scripts/lib/io.test.js` → 5 passing.

### Step 4: Full verification

Run the complete pipeline test set and the root gate:

```sh
cd pc-quote-builder && npx vitest run ../scripts/lib
cd .. && bash scripts/verify.sh
```

`verify.sh` runs the scripts/lib suite plus artifact/post-build contract tests.
If it fails because `docs/data` is stale on your checkout, report which
assertion failed; do not regenerate artifacts in this plan (the guard does not
change data content).

## Test plan

As in Step 3. The regression risk is behavioral: ensure the CSV parser still
handles escaped quotes after moving the guard (case 4).

**Verification**: `npx vitest run ../scripts/lib` → all pass, including the new
`io.test.js`.

## Done criteria

ALL must hold:

- [ ] `npx vitest run ../scripts/lib/io.test.js` exits 0 with 5 tests passing
- [ ] `npx vitest run ../scripts/lib` exits 0
- [ ] `bash scripts/verify.sh` exits 0 (or the only failure is a pre-existing
      stale `docs/data` mismatch, reported)
- [ ] `rg -n "assertNotSymlink" scripts/lib/io.js scripts/lib/sources.js` shows
      the guard defined and used in every dataset read path
- [ ] `git diff --name-only 6cde4b8...HEAD` lists only `scripts/lib/io.js`,
      `scripts/lib/sources.js`, `scripts/lib/io.test.js`
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `find data/raw -type l` lists symlinks in a currently pinned dataset.
- Making the guard fail-fast requires restructuring the parser beyond moving
  the call site (report the structure).
- A pipeline test fails for a reason unrelated to symlinks (report it; do not
  change fixtures).
- The pc-part or dbgpu upstream layouts turn out to use symlinked data files
  legitimately (report the path and upstream link).

## Maintenance notes

- The guard is fail-closed by design: a symlinked dataset file aborts the
  scheduled build. If upstream ever legitimately ships symlinked data, resolve
  the link in the downloader (e.g. copy target content) rather than weakening
  the reader.
- Any new dataset reader in `scripts/lib/` must call `assertNotSymlink` before
  reading; consider centralizing future readers in `io.js`.
- Reviewer should scrutinize: the guard is outside the per-file parse
  `try/catch`, and the CSV parsing behavior is unchanged for regular files.
- **Deferred**: verifying upstream commit signatures or hashes at read time is
  a larger supply-chain change and is not authorized here.
