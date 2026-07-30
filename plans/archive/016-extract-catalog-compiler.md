# Plan 016: Extract a pure, fixture-tested catalog compiler

> **Executor instructions**: Do not run the network downloader. Preserve deterministic output and current artifact filenames. Treat generated data as artifacts and modify it only through the pipeline.
>
> **Drift check (run first)**: `git diff --stat fabeb49..HEAD -- scripts/build_pc_data.js pc-quote-builder/src/lib/artifactContract.test.js pc-quote-builder/src/lib/catalogQuality.test.js pc-quote-builder/package.json`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: `009-align-runtime-toolchain.md`, `011-isolate-downloader-tests.md`
- **Category**: tests / tech-debt
- **Planned at**: commit `fabeb49`, 2026-07-29

## Why this matters

Source extraction, normalization, merge policy, ID creation, quality metadata, and filesystem orchestration live in one 796-line auto-executing script. Current artifact tests verify only parseability, non-empty arrays, IDs/names, and tier-map shape, so semantic corruption such as form-factor mismatch and duplicate IDs passes green. Plans 017 and 018 need a safe compiler seam before changing data meaning.

## Product-governance checklist

- **Problem/users/value**: trustworthy compatibility depends on reproducible normalized data; this improves compatibility, completeness, provenance, and confidence.
- **Evidence/uncertainty**: fixtures distinguish source facts, inference, conflicts, and missing data; no inferred fact becomes verified.
- **Explanation/precision**: conflict flags/provenance remain traceable; no score beyond existing documented metadata is introduced.
- **Failure paths**: malformed/missing source rows, duplicates, empty datasets, conflicting sources, and deterministic ordering are tested.
- **Freshness/commercial bias**: source timestamps/pins remain visible; no retailer ranking is added.
- **Workflow/value/tests**: public schemas remain stable while pure tests reduce pipeline-change risk.

## Current state

- `scripts/build_pc_data.js:179-421`: source adapters.
- Lines 424-655: private merges and IDs.
- Lines 661-795: build, assertions, metadata, writes; the module immediately calls `build()`.
- `catalogQuality.test.js` checks only the tiny fallback catalog.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| Fixture tests | `cd pc-quote-builder && npm test -- catalogCompiler` | all pass without writing repo artifacts |
| Artifact tests | `cd pc-quote-builder && npm run test:artifacts` | all current contracts pass |
| Gate | `cd pc-quote-builder && npm run check` | exit 0 |

## Scope

**In scope**: split `scripts/build_pc_data.js` into pure modules under `scripts/lib/`, add small frozen fixtures/tests, update build script imports, strengthen non-behavior-changing contracts.

**Out of scope**: network downloads, source pins, changing IDs/form-factor semantics (plans 017/018), hand-editing generated artifacts, changing public filenames.

## Git workflow

- Branch: `advisor/016-extract-catalog-compiler`
- Prefer commits for pure extraction, fixtures, then CLI wiring.

## Steps

1. Freeze current small source fixtures covering every category and both/three sources; exclude copyrighted bulk datasets.
2. Extract pure source adapters, normalization helpers, grouping/merge functions, tier computation, and compatibility metadata assembly. No extracted module may create directories or write files on import.
3. Keep a thin CLI that resolves paths, reads inputs, calls pure compiler functions, validates, and writes deterministic sorted/minified outputs.
4. Add fixture tests for precedence, conflicts, malformed rows, empty inputs, deterministic output, provenance propagation, and current public shape.
5. Add a temp-directory end-to-end compiler test proving imports are side-effect free and writes stay within the supplied output root.
6. Compare regenerated artifacts in an explicit pipeline run only if the operator has suitable raw data; unexpected semantic diffs are a STOP, not an automatic commit.

## Test plan

Use Vitest Node environment and filesystem temp directories. Add no live-network dependency. Test pure functions directly and one CLI integration seam.

## Done criteria

- [ ] Importing compiler modules writes nothing.
- [ ] Every source adapter and merge policy has fixture coverage.
- [ ] Deterministic fixture compile produces byte-identical output twice.
- [ ] Existing artifact schemas and full gate pass.
- [ ] No generated artifact changes unless explicitly justified and regenerated.

## STOP conditions

- Extraction changes generated semantics before plans 017/018.
- A source fixture cannot be legally/minimally included.
- Public output changes despite identical fixture input.

## Maintenance notes

Upstream schema changes must first update a frozen fixture and adapter test. Keep CLI orchestration free of normalization policy.

---

## Completion — 2026-07-30

Commit: `HEAD` (uncommitted working tree)

### What was done

- Extracted pure modules from `scripts/build_pc_data.js` into four files under `scripts/lib/`:
  - `normalize.js` — `deburr`, `normalizeKey`, `slug`, `safeNumber`, `assert`, `envNumber`, `stableIdSort`, `sortObjectKeys`
  - `io.js` — `readJsonFiles`, `readCsvFile`, `ensureDir`
  - `sources.js` — `loadBuildCores`, `loadDbGpu`, `loadPcPart` (parameterized by `rawDir`; file I/O contained in IO module)
  - `compiler.js` — all `merge*` functions, `computeTierCpu`, `computeTierGpu`, `byNormalizedKey`, `mergeGrouped`, `range`, `computeCompatibilityMeta` (with injectable `now` for deterministic tests)
- Refactored `build_pc_data.js` into a thin CLI that calls the extracted modules.
- Added 64 pure unit/e2e tests (no network, no real data) covering:
  - Normalization utilities (`normalizeKey`, `slug`, `safeNumber`, etc.)
  - Tier computation for CPUs and GPUs
  - Merge policy for each category (CPU, GPU, motherboard, PSU, case, RAM, cooler, fan)
  - TDP conflict flagging for multi-source CPU/GPU
  - Source precedence (buildcores over pcpart for CPUs; dbgpu over pcpart for GPUs)
  - `computeCompatibilityMeta` output shape, counts, ranges, tiers, sockets, form_factors
  - Empty-dataset edge cases
  - Byte-identical output for repeated deterministic runs (frozen timestamp)
  - Temp-directory end-to-end pipeline with fixture sources
  - Side-effect-free module imports (no writes on import)
- Updated `vite.config.js` test include to pick up `scripts/lib/*.test.js`.
- Moved plan to archive.

### Gate results

```
npm run check     — 0 lint errors, 356 tests passed, build ok
npm run test:artifacts  — 26 tests passed
```

### Remaining `.todo` tests

30 `.todo` tests remain in `App.test.jsx` under plans 012–014 (CRUD flow, builder filtering/navigation). Not affected by this extraction.

### Invariant preserved

- `scripts/build_pc_data.js` CLI interface unchanged (same path, same npm scripts).
- Generated artifact filenames and structure unchanged.
- `memory.min.json` dual-write preserved (same data as `ram.min.json`).
- All existing tests pass unmodified.
