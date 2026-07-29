# Plan 002: Preserve complete catalog compatibility data

> **Executor instructions**: Follow every step; update `plans/README.md` only after all gates pass.
>
> **Drift check**: `git diff --stat 63ecbca..HEAD -- pc-quote-builder/src/hooks/useCatalog.js pc-quote-builder/src/lib/catalogMapper.js pc-quote-builder/src/lib/compatibility.js pc-quote-builder/src/lib/catalogMapper.test.js pc-quote-builder/src/lib/compatibility.test.js`

## Status

- **Priority**: P1; **Effort**: S; **Risk**: LOW; **Depends on**: `001-green-verification-gate.md`
- **Category**: bug
- **Planned at**: commit `63ecbca`, 2026-07-29

## Why this matters

The local fallback already uses UI-shaped keys (`motherboards`, `ramKits`, `pcCases`) but is passed to a mapper that only accepts processed keys (`mobos`, `ram`, `cases`). It therefore loses three entire collections on remote failure. The mapper also discards RAM and board-limit fields that `compatibility.js` is explicitly written to validate.

## Current state

`useCatalog.js:6` is `const fallbackCatalog = mapProcessedToCatalog(localCatalog || {});`. `catalogMapper.js:49-68` maps board identity and RAM type/speed only; `compatibility.js:36-43` reads `memory_slots`, `capacity_gb_total`, and speed-limit fields. `scripts/build_pc_data.js:529-530,590-593` emits those fields.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| Tests | `cd pc-quote-builder && npm test -- catalogMapper compatibility` | all matching tests pass |
| Gate | `cd pc-quote-builder && npm run check` | exit 0 |

## Scope

Modify only `useCatalog.js`, `catalogMapper.js`, mapper/compatibility tests, and (only if necessary) `compatibility.js`. Do not change data generation schema, selection IDs, or compatibility messages unrelated to memory limits.

## Steps

1. Make fallback initialization retain local UI-schema arrays unchanged, or make `mapProcessedToCatalog` deliberately support both schemas. Preserve `meta`/compatibility metadata. Add a test that simulates processed-load failure and asserts all six collections remain selectable.
2. Add additive mapped fields for board slots, maximum capacity, maximum speed, RAM module count, total capacity, and `speed_mts`; accept existing snake_case/camelCase source variants. Keep current public mapped keys intact.
3. Extend mapper and evaluator tests with: too many modules, capacity above the motherboard limit, and RAM speed above official limit (compatible with warning). Verify `npm run check`.

## Done criteria

- [ ] Fallback has non-empty boards/RAM/cases when the local fixture has them.
- [ ] The three memory-limit cases are tested from mapped data.
- [ ] `npm run check` exits 0.

## STOP conditions

Stop if local `catalog.json` is no longer UI-shaped, emitted fields differ materially from the documented names, or a change would alter existing catalog IDs.

## Maintenance notes

Whenever pipeline schema changes, update mapper tests first; compatibility checks are only as reliable as fields preserved here.
