# Plan 051: Produce the measurement-enabling decision packet (design spike)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6cde4b8..HEAD -- docs/design/decision-measurement.md pc-quote-builder/src/App.jsx pc-quote-builder/src/lib/measurement/`
> If any in-scope reference changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S (decision document only; no code)
- **Risk**: LOW to write; MED governance (the document proposes enabling
  collection, which only the owner may authorize)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `6cde4b8`, 2026-09-25

## Why this matters

Plan 031 defined the privacy-preserving decision-funnel contract and a
provider-neutral no-op adapter; Plan 032 wired every event through it. But no
sink is authorized, and `acquisitionClass` is hardcoded to `"unknown"`
(`App.jsx:552`). As a result Milestone 0's exit criterion — "Privacy-respecting
measurement can separate non-branded organic visits, product starts, qualified
activations, and decision actions" (`docs/PRODUCT_VISION.md:529`) — is
unobservable, and would remain partly unobservable even if a sink were added,
because acquisition class never varies.

This spike produces the decision packet the owner needs to authorize (or
decline) enabling measurement and to approve a concrete, privacy-bounded
acquisition-class derivation rule. It recommends no vendor and writes no code.

## Current state

- Contract: `docs/design/decision-measurement.md:3-12` — approved contract; no
  provider/cookie/beacon/endpoint/database/dashboard approved; retention and
  deletion "unresolved until a sink exists".
- `docs/design/decision-measurement.md:144` — the non-branded-organic metric
  depends on acquisition class; `:167` — `non-branded-organic` is in the
  allow-listed enum; `:211-212` — full referrer URLs are deny-listed.
- `docs/design/decision-measurement.md:238-242` — retention/deletion unresolved.
- `pc-quote-builder/src/App.jsx:548-560`:
  ```js
  measurement.track("product_start", {
    acquisitionClass: "unknown",
    catalogVersion: catalogSignature,
    timestamp: new Date().toISOString(),
  });
  ```
- The adapter and no-op sink: `pc-quote-builder/src/lib/measurement/measurement.js`
  (`createMeasurement`, default no-op sink); `contracts.js` validates every
  event and rejects forbidden raw fields.
- Milestone thresholds that need this data: `docs/PRODUCT_VISION.md:571-590`
  (non-branded sessions, qualified activations, product-start conversion).

## Commands you will need

| Purpose | Command | Provenance | Expected on success |
|---|---|---|---|
| Confirm hardcoded class | `rg -n "acquisitionClass" pc-quote-builder/src` | executed | `"unknown"` literal in `App.jsx`, enum in contracts |
| Confirm no sink | `rg -n "noop\|sink" pc-quote-builder/src/lib/measurement/measurement.js` | declared | no-op default |
| Doc checks | `rg -n "^## " docs/design/measurement-enabling-decision.md` | declared | all required sections |

No code runs; this plan produces one document.

## Scope

**In scope**:
- `docs/design/measurement-enabling-decision.md` (create)

**Out of scope** (do NOT create or modify):
- Any code, dependency, or configuration.
- A vendor recommendation or ranking.
- `docs/PRODUCT_VISION.md`, `docs/design/decision-measurement.md` (the latter
  is an approved contract; this packet proposes, it does not amend).
- Any cookie, consent banner, network call, or storage key.

## Git workflow

- Branch: `advisor/051-measurement-enabling-decision`
- Commit: `051: add measurement enabling decision packet`.
- Do NOT push or open a PR.

## Steps

### Step 1: Establish the exact decision surface

Read `docs/design/decision-measurement.md` in full and
`pc-quote-builder/src/lib/measurement/contracts.js` (event specs and forbidden
fields). Then enumerate, in the document, exactly what is blocked today and
what each blocked item requires:

| Blocked outcome | Requires |
|---|---|
| Non-branded vs branded vs referral separation | an acquisition-class derivation rule |
| Any collection at all | an owner-authorized sink + consent/retention decision |
| Milestone 3/4 thresholds | the above plus time |

### Step 2: Write `docs/design/measurement-enabling-decision.md`

Required sections:

1. `## Objetivo y alcance` — decision packet for the owner; no recommendation,
   no authorization implied by the document's existence.
2. `## Estado actual` — contract + adapter + no-op sink + hardcoded
   `acquisitionClass`, with `file:line` evidence.
3. `## Qué falta decidir` — the three coupled decisions: (a) whether to collect
   at all, (b) sink/hosting model, (c) acquisition-class derivation + retention.
4. `## Opciones de destino` — at least three neutral options (self-hosted
   first-party endpoint; a privacy-focused analytics service; remain no-op),
   each with: what it collects, where data lives, consent implications,
   operational cost, and what Milestone 0/3/4 evidence it can produce. Do not
   name or rank vendors; describe categories.
5. `## Derivación de acquisitionClass` — 2-3 candidate rules, e.g.:
   - A: keep `"unknown"` (status quo; Milestone 3 unobservable).
   - B: UTM-only classification (`utm_source`/`utm_medium` presence → class),
     computed locally, raw values never stored.
   - C: UTM plus a coarse referrer-host category allow/deny table computed
     locally in the browser; the raw referrer is never persisted, logged, or
     emitted, only the derived enum.
   For each: exact inputs read, what is emitted, what is discarded, limits
   (direct traffic, app in-app browsers, search engines that strip referrers),
   and how it maps onto the existing `acquisitionClass` enum.
6. `## Compatibilidad con el contrato Plan 031` — confirm the enum already
   exists and whether any event/field would need to change; state that raw
   referrers/URLs remain forbidden per the deny-list; note the `unknown`
   default must remain valid.
7. `## Consentimiento, retención y acceso` — the owner decisions required:
   consent model (none needed if truly aggregate/local? state the analysis,
   not legal advice), retention period, deletion path, who can access, and
   where the privacy statement would live.
8. `## Qué desbloquearía` — map each decision combination to the Milestone 0
   exit criterion and Milestone 3/4 metrics, including which remain
   unobservable regardless.
9. `## Decisiones pendientes del propietario` — a one-line-per-decision
   checklist with a recommended default marked as a recommendation only.
10. `## No objetivos` — no vendor recommendation, no code, no cookie/consent
    banner, no raw quote data, no collection before explicit approval, no
    retroactive claim that past sessions were measured.

### Step 3: Cross-check every claim

For every claim about the contract or code, cite `file:line` and verify it in
the working tree. If the code contradicts this plan (e.g. the enum changed),
STOP and report rather than writing around it.

**Verify**: `rg -n "^## " docs/design/measurement-enabling-decision.md` lists
all ten headings; `rg -c "file:line\|\.js:[0-9]+\|\.md:[0-9]+"` is non-trivial;
the document contains no vendor names.

## Test plan

Documentation-only. Structural verification as above; additionally confirm the
document never instructs implementation ("build", "wire", "deploy" as
imperatives except in the explicitly labeled future-plan section).

## Done criteria

ALL must hold:

- [ ] `test -f docs/design/measurement-enabling-decision.md`
- [ ] All ten required `##` headings present
- [ ] At least three destination options and three acquisition-class rule
      candidates described with trade-offs
- [ ] `rg -n "acquisitionClass" docs/design/measurement-enabling-decision.md` matches
- [ ] No vendor names appear (self-check; state the command you used)
- [ ] `rg -n "file:line|\.js:[0-9]+|\.md:[0-9]+" docs/design/measurement-enabling-decision.md` returns at least 6 references
- [ ] `git diff --name-only 6cde4b8..HEAD` lists only the new document
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The measurement contract or adapter has changed shape since this plan was
  written (report the divergence).
- Writing the packet requires proposing legal advice or a specific vendor.
- You cannot describe a derivation rule that keeps raw referrers out of the
  emitted event — do not weaken the privacy envelope to make the rule work.
- You find yourself editing code or `docs/design/decision-measurement.md`.

## Maintenance notes

- This document is input to a future, separately authorized implementation
  plan. That plan must not start until the owner resolves the checklist and
  records the decision in `plans/README.md` / an amendment if the contract
  changes.
- If the owner declines collection, record the rejection in `plans/README.md`
  and consider removing the hardcoded `product_start` emission question from
  future audits.
- **Deferred**: any sink, consent UI, endpoint, retention job, dashboard, or
  vendor evaluation.
- **Completion (2026-09-25)**: packet delivered in `78669d5`, reviewed and
  merged as `12a900b`. The owner decision recorded 2026-09-25 is **stay
  no-op**: no sink or collection is authorized until Milestone 1 traffic
  exists and the owner re-approves; the acquisition-class derivation may be
  built locally with the no-op sink if a future plan is authorized. Sink
  model, consent, retention, and access remain open in ROADMAP §7.
