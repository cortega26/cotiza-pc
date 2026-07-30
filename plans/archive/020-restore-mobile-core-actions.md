# Plan 020: Keep core quote actions available on mobile

> **Executor instructions**: Preserve desktop behavior and Spanish labels. Verify in a real responsive browser, not only jsdom.
>
> **Drift check (run first)**: `git diff --stat fabeb49..HEAD -- pc-quote-builder/src/App.jsx pc-quote-builder/src/index.css pc-quote-builder/src/App.test.jsx`

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: `012-characterize-app-workflows.md`
- **Category**: bug
- **Planned at**: commit `fabeb49`, 2026-07-29
- **Status**: ✅ Done

> **Completed**: 2026-07-30 by opencode. Extracted sidebar markup into `renderSidebarContent()`, added mobile trigger button and slide-in drawer with backdrop close + Escape dismissal + focus trap + auto-focus on open. Added 10 App behavior tests. Verified at 901px/768px/375px in real browser via Playwright. Post-implementation audit fixed duplicate HTML ID (`priceImportRef`), added toggle close, body scroll lock, and resize-close handler. Gate: 441 passed + 30 todo, 0 lint, build ok.

## Why this matters

At widths below 900px, `.sidebar` becomes `display: none`; quote switching/CRUD, import/export, reload, and catalog provenance have no alternate access. Mobile users can edit the current quote but cannot perform core lifecycle actions.

## Product-governance checklist

- **Problem/users/value**: mobile beginners/experts need the same core quote workflow; improves usability without adding product surface.
- **Evidence/uncertainty**: existing actions and statuses are relocated, not reinterpreted.
- **Failure paths**: menu open/close, focus return, keyboard dismissal, long quote lists, file inputs, errors, and rotation are covered.
- **Precision/bias/freshness**: no recommendation/ranking change; catalog freshness remains visible.
- **Cost/tests**: responsive navigation is bounded and tested in browser plus App behavior.

## Current state

`index.css:819-822` hides `.sidebar`; no mobile drawer/menu is rendered elsewhere in `App.jsx`.

## Commands you will need

| Purpose | Command | Expected result |
|---|---|---|
| App tests | `cd pc-quote-builder && npm test -- App` | all pass |
| Gate | `cd pc-quote-builder && npm run check` | exit 0 |
| Browser | run local preview and inspect 375px/768px/901px | all actions accessible |

## Scope

**In scope**: responsive navigation/drawer, focus management, relevant CSS/App tests.

**Out of scope**: full visual redesign, changing quote actions, desktop information architecture, PWA/native app.

## Git workflow

- Branch: `advisor/020-restore-mobile-core-actions`
- Commit: `020: restore mobile quote actions`.

## Steps

1. Add a visible mobile menu trigger and an accessible drawer/sheet containing the existing sidebar actions/statuses.
2. Reuse one action/status component so desktop and mobile do not diverge.
3. Implement focus trap/return, Escape dismissal, backdrop close, and suitable labels.
4. Add App behavior tests and responsive browser screenshots/notes at target widths.

## Test plan

Cover opening/closing, keyboard focus, quote switch/create/delete, import button reachability, catalog error visibility, and desktop sidebar persistence.

## Done criteria

- [x] Every sidebar action is reachable below 900px.
- [x] Keyboard and focus behavior is accessible.
- [x] No duplicated handler logic.
- [x] Tests, gate, and responsive checks pass.

## STOP conditions

- A shared desktop/mobile action component requires changing business behavior.
- Focus management needs a new UI dependency; report native versus dependency options first.

## Maintenance notes

New sidebar actions must be added through the shared navigation content so mobile parity remains automatic.
