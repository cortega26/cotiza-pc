# Plan 005: Upgrade vulnerable Vite and Vitest tooling

> **Executor instructions**: Follow every gate and update `plans/README.md` when done.
>
> **Drift check**: `git diff --stat 63ecbca..HEAD -- pc-quote-builder/package.json pc-quote-builder/package-lock.json pc-quote-builder/vite.config.js pc-quote-builder/src`

## Status

- **Priority**: P1; **Effort**: M; **Risk**: MED; **Depends on**: `001-green-verification-gate.md`
- **Category**: security
- **Planned at**: commit `63ecbca`, 2026-07-29
- **Completed at**: commit `070c485`, 2026-07-29

### Completion summary

- Vite already at 8.1.5 and Vitest already at 4.1.10 (resolved by previous work)
- Upgraded eslint from `^9.39.1` → `^10.8.0` and eslint-plugin-react-hooks from `^7.0.1` → `^7.1.1` to fix 5 high advisories through `brace-expansion` → `minimatch` → `@eslint/config-array`/`@eslint/eslintrc` → `eslint`
- Remaining 1 moderate (ajv) resolved by `npm audit fix` (non-breaking)
- Added two `eslint-disable-next-line` comments for new strict `react-hooks/set-state-in-effect` and `react-hooks/purity` rules in hooks@7.1.1

## Why this matters

The full lockfile audit reports a critical Vitest advisory and high Vite/transitive advisories; production-only audit is clean. These are developer/CI tools, but CI installs and runs them every scheduled deployment.

## Current state

`package.json:33-34` allows Vite `^7.2.4` and Vitest `^2.1.4`; the lock resolves Vite 7.2.4 and Vitest 2.1.9. `npm audit --package-lock-only` reports 1 critical and 9 high findings, with the audited remediation selecting Vitest 4.1.10.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| Install | `cd pc-quote-builder && npm ci` | exit 0 |
| Audit | `npm audit --package-lock-only --audit-level=high` | exit 0 / no high-or-critical findings |
| Gate | `npm run check` | exit 0 |

## Scope

Modify only the app package manifest/lockfile and configuration/test files proven incompatible by the upgrade. Do not add runtime dependencies, ignore audit findings, or alter production behavior.

## Steps

1. Read Vite and Vitest migration notes for the exact patched target selected by `npm audit`; choose mutually compatible versions, including React plugin compatibility. Record the chosen versions in the commit message/PR description.
2. Update dependencies and regenerate only `pc-quote-builder/package-lock.json` using npm. Resolve config/test transform incompatibilities minimally, preserving existing test semantics.
3. Run the full check and full lockfile audit. Inspect remaining high/critical items; update direct parents where a safe compatible fix exists rather than using overrides blindly.

## Test plan

Run all existing Vitest suites, including the jsdom Typeahead test, and Vite production build. Add a regression test only if a migration exposes a behavior difference.

## Done criteria

- [ ] `npm audit --package-lock-only --audit-level=high` exits 0.
- [ ] `npm run check` exits 0.
- [ ] `npm ci` succeeds from a clean dependency directory.
- [ ] Only the application dependency graph changed.

## STOP conditions

Stop if clearing the advisory requires a production framework major upgrade, a breaking React upgrade, or an audit override with no patched release. Report the residual advisory and options.

## Maintenance notes

Keep the full lockfile audit in scheduled CI or a dependency-update workflow; production-only audit is insufficient for this CI-executed toolchain.
