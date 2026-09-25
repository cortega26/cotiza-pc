# cotiza-pc — Roadmap, Scoreboard & Implementation Guide

> **Purpose**: one operational view of the work: what is done, what is next,
> how plans are grouped into waves for wall-clock efficiency, and exactly how
> an executor (human or agent) runs, verifies, and records a plan.
>
> **Source of truth**: `docs/PRODUCT_VISION.md` (product constitution) >
> `plans/README.md` (plan index and status) > this file (schedule, scoreboard,
> and execution view). If this file conflicts with either, they win — then fix
> this file.
>
> **Snapshot**: integration branch `advisor/b1-cotiza-verify` at `b5d7381`,
> 2026-09-25. Plans 037-040, 042-044, 047, 048, 051, and 052 are merged.
> Baseline on the integration branch: `npm run check` exit 0, `npm test` =
> 1061 passing / 1 todo, assurance and root verification green. Plans 041,
> 045, 046, 049, 050 remain TODO, ordered by §4.
>
> **How to use it**: pick the earliest wave that is unblocked, run its plans
> (one worktree each, serial on shared files), update `plans/README.md` when a
> plan is done, then update §2 (Scoreboard) and §4 (Waves) here.

---

## 1. How to read this document

### Effort and time scale

Effort values come from the plans themselves. The day estimates below assume a
capable executor agent plus a human/tech-lead review pass, one plan at a time
inside a worktree, with warm tooling and no external dependency failures.

| Effort | Meaning | Typical wall clock (agent + review) |
|---|---|---|
| S | hours | 0.5–1 working day |
| S-M | hours to a day | 0.75–1.5 working days |
| M | a day-ish | 1.5–3 working days |
| L | multi-day | 3–10 working days |

### Status vocabulary (shared with `plans/README.md`)

`TODO` · `IN PROGRESS` · `DONE` · `BLOCKED (reason)` · `REJECTED (rationale)`

A plan is `DONE` only when every done criterion has been run and observed, the
reviewer confirms the diff is in scope, and the index row is updated. A plan
that stops on its STOP conditions becomes `BLOCKED`, not `DONE`.

### Wave rules

- **Wave** = a set of plans scheduled together, sized so that file conflicts
  stay zero *within a parallel track* and bounded across tracks.
- **Tracks** inside a wave run concurrently in separate worktrees.
- Shared files force strict order: see §5. When in doubt, serialize.
- Never more than **2 concurrent code worktrees** plus any number of
  docs-only tracks; merge cost grows faster than throughput beyond that.

---

## 2. Scoreboard — vision milestones

Evidence is from the shipped tree at `6cde4b8`. "Unmeasurable" means the exit
criterion exists but the product currently cannot observe it.

### Product strategy: where the moat comes from

The catalog (BuildCores / pc-part / dbgpu) and the compatibility rules are open
data any competitor can replicate. The defensible asset is a **private evidence
flywheel** built in one market:

1. **Real, messy quotations** (Chilean) feed the resolution engine — trained on
   real noise, not clean catalog rows.
2. **Every confirmed identity** is a proprietary data point (component key +
   catalog id + how the line was written) that no competitor holds.
3. **Outcome evidence** (did the advice change or confirm a decision; did it
   ever miss dangerously) calibrates trust.
4. More trust → more voluntary contributions and returns → a better engine.

This is slow to copy (it requires field collection and longitudinal outcome
measurement in one market) and compounds as it runs. Consequence for
sequencing: **the corpus, not telemetry, is moat layer 1**, so Plan 052
(local coverage-case export) is the highest-leverage next slice. Telemetry
(051) stays no-op until there is Milestone 1 traffic to measure — measuring
before traffic produces almost no data and spends the privacy budget early.
Expansion beyond Chile should reuse the *methodology* after the engine is
validated, not the map.

| Milestone | Progress | Evidence for what is done | Missing / blocker | Plans |
|---|---|---|---|---|
| **M0 — Strategic & measurement baseline** | **4/6 met, 2 decisions recorded** | Beachhead + MVP exclusions in vision/plans (024/025); versioned analyzer contract (028, `docs/validation/`); supported/unsupported inventory (030/035/036); metric definitions (031) | Both decision packets are DONE and merged: 048 corpus **adopt**, implemented and shipped by 052 (merged `4ff321d`); 051 measurement **stay no-op** until M1 traffic and owner re-approval (merged `12a900b`). Remaining gap: no real coverage cases collected yet (corpus 0/30) — that is now an operator runbook, not a code plan | 048, 051, 052 done and merged |
| **M1 — Search & evidence foundation** | **~15%, not started in code** | None of the exit criteria ship: SPA-only `docs/index.html`, `lang="en"`, no canonical, no `robots.txt`/`sitemap.xml`, no Search Console | 12 pages: 0/12 (033 is a 3-page pilot, TODO); inventory missing; observation gate not started | 033 (TODO), 049 (inventory), then page batch plans |
| **M2 — Evidence-qualified Analyzer MVP** | **~70%; 2 criteria unmeasured** | Entry/import/confirm/verdict flow shipped (032); every supported rule passes the automated conformance suite (035); missing/conflicting evidence resolves to `unknown` (policy + 036); power/connector outcomes now report `unknown` on missing TDP or unparsed tokens (038, `05e9ca8`); quote-quality defects fixed — blank rows, price-CSV ids, inferred-confidence, stale signature (039, `ca11b8e`); local privacy-minimized coverage-case export shipped (052, `4ff321d`), so real-quote identity resolution is now measurable | Corpus-based 80% identity resolution still unmeasured (export is opt-in; 0 cases collected); median time-to-verdict unmeasured | 052; 039 done |
| **M3 — Organic product validation** | **0%, not observable** | — | Requires measurement (sink + acquisition class) and Milestone 1 traffic | 051 → measurement plan → 033/049 |
| **M4 — Organic scale & repeat value** | **0%** | — | Requires M3; scenario comparison and sharing remain deferred | 026 design done; future plan |
| **M5 — Optional monetization** | **Locked** | — | Explicitly gated: begins only after M4 with owner acknowledgement | none authorized |

**Scoreboard maintenance**: update a milestone row only when a merged plan's
done criteria directly move one of its exit criteria; cite the commit in the
evidence column. Never lower a threshold to declare success.

---

## 3. Backlog — open plans

Priority is from the plan. "Wave" is the recommended slot from §4. Archived
plans 016-026, 028, 030-032, 035, 036 are `DONE` and listed in
`plans/README.md`; they are not repeated here.

| Plan | Title | Pri | Effort | Wave | Depends on | Status | Done gate (summary) |
|---|---|---|---|---|---|---|---|
| [037](037-add-per-push-verification-gate.md) | Per-push verification gate, advisories, assurance CLI | P1 | S-M | 0 | — | DONE (merged `c36ee30`) | `verify.yml` runs check + artifacts + assurance; audit clean; docs updated |
| [047](047-pipeline-symlink-rejection.md) | Reject symlinked dataset files | P2 | S | 1B | — | DONE (merged `4c4e349`) | io tests pass; guard fail-closed in every reader |
| [038](038-truthful-psu-and-connector-outcomes.md) | Truthful power/connector outcomes | P1 | M | 1A | 037 (merged) | DONE (merged `05e9ca8`) | reproductions return unknown/fail; compiler regenerated with 0 fabricated recommendations; assurance green |
| [048](048-coverage-case-contribution-design.md) | Coverage-case contribution design | P2 | S | 1C | owner decisions | DONE (merged `f5fcf04`) | design doc with 10 sections; owner checklist resolved 2026-09-25 (adopt, trust-first) |
| [052](052-coverage-case-export.md) | Local privacy-minimized coverage-case export | P1 | M | — | 048, 037 | DONE (merged `4ff321d`) | corpus flywheel layer 1; no network, no event; validated against the real harness validator; one revision retained user-confirmed rows |
| [049](049-content-inventory-pages-4-12.md) | Pages 4-12 rule-backed inventory | P2 | S | 1C | — | TODO | 9 rows, rule IDs verified vs registry, no pages authored |
| [051](051-measurement-enabling-decision.md) | Measurement enabling decision packet | P2 | S | 1C | owner decisions | DONE (merged `12a900b`) | decision doc; no sink, no code; measurement stays no-op pending M1 traffic and owner re-approval |
| [040](040-characterize-app-quote-flows.md) | Characterize App quote CRUD/cascades/exports | P1 | M | 2A | 038 (shared tests) | DONE (merged `5d13de7`) | App suite 121 passed / 1 retained bug-todo; real escaper in export test |
| [039](039-quote-quality-defects.md) | Analyzer quote-quality defects | P1 | S | 2B | 038 (merged) | DONE (merged `ca11b8e`) | blank rows ignored; price CSV id exact; inferred → medium; signature extended |
| [042](042-resolver-performance.md) | Resolver performance | P1 | M | 3A | — | DONE (merged `a3e88ab`) | indexed lookup; capped candidates + manual search; hidden-mode laziness; raw cache released; parity proven |
| [043](043-analyzer-context-and-failure-surfacing.md) | Context edit + degraded-data surfacing | P1 | S | 3B | 042 (same files) | DONE (merged `0de4e23`) | edit-context round trip; compat/coverage failures visible |
| [044](044-harden-import-persistence-workspace.md) | Import/persistence/workspace hardening | P2 | S-M | 4A | 042, 043 | DONE (merged `b5d7381`) | per-entry recovery + backup; unified detection; slugified filenames; mapper guard; single pushState |
| [041](041-retire-dead-builder-reducer.md) | Retire dead builder reducer | P2 | S | 4B | 040 | TODO | `rg builderReducer src` empty; helpers renamed; suite green |
| [050](050-non-destructive-conflict-notices.md) | Conflict-clear notices | P2 | S | 4B | 040 | TODO | 5 clear conditions announce; dismiss works; no rule change |
| [046](046-lint-scripts-and-asset-hygiene.md) | Pipeline lint + strict app lint + asset prune | P2 | S-M | 5A | 037, 042/043 | TODO | scripts lint 0; `--max-warnings 0`; assets match index.html |
| [045](045-docs-truth-up.md) | Docs truth-up | P2 | S | 5B | behavior waves merged | TODO | stale current-state claims gone; example marked synthetic |
| [033](033-build-crawlable-decision-content-foundation.md) | 3-page crawlable content pilot | P2 | L | 6 | 030-032, 035 | TODO | pilot pages + observation gate; external actions not authorized |
| [034](034-qualify-solotodo-price-intelligence-source.md) | Qualify SoloTodo source | P1 | L | 6 | 030, 035 | TODO | written permission matrix + go/no-go; no scraping/ingestion |
| [027](027-adopt-typescript-7-incrementally.md) | Adopt TypeScript 7 incrementally | P2 | L | — | ecosystem gate | BLOCKED | stable typescript-eslint for TS 7 + ESLint 10; do not work around |
| [029](029-establish-analyzer-validation-corpus.md) | Expert-labeled validation corpus | — | — | — | — | REJECTED | superseded by 035; do not execute |

**Backlog intake rule**: new work enters as a `plans/NNN-*.md` file (not as
unwritten intent), lands in this table with a wave, and needs the owner's
selection recorded in `plans/README.md`.

---

## 4. Waves — execution batching for efficiency

Each wave lists parallel tracks, a wall-clock estimate (agent + review), the
entry gate, the exit gate, and the merge order. Estimates include a ~20%
review buffer; catalog regeneration for 038 is called out separately.

```text
Wave 0 ─ 037 ────────────────────────────────────────────────► gate
Wave 1 ─ Track A: 038 ─┐
         Track B: 047  ├─ parallel (disjoint files) ─────────►
         Track C: 048, 049, 051 (docs, owner-gated)
Wave 2 ─ Track A: 040 ─┐
         Track B: 039  ├─ parallel (disjoint files) ─────────►
Wave 3 ─ 042 ──► 043 (serial, shared QuoteAnalyzer/App)
Wave 4 ─ 044 ──► (041 + 050 batched, serial on App.jsx)
Wave 5 ─ 046 ──► 045 (final docs reconcile)
Wave 6 ─ 033, 034 and future plans unlocked by 048/049/051 decisions
```

### Wave 0 — Verification gate (0.5–1 day, single plan)

- **Plans**: 037.
- **Why first**: every later plan is verified by the gate this wave adds
  (`npm run check` + artifact contracts + assurance CLI on push/PR), and it
  clears the two high advisories before any code work.
- **Entry**: clean tree at `6cde4b8`.
- **Exit**: `verify.yml` exists and passes locally-equivalent commands;
  `npm audit --audit-level=high` exit 0; `test:assurance` green; docs updated.
- **Merge**: 037 alone; tag this merge as the new verification baseline.
- **Status (2026-09-25)**: DONE — reviewed `9a5fc9a`…`97e8760`, merged as
  `c36ee30`; audit clean, conformance 44/44, integration branch green.

### Wave 1 — Correctness and safety in parallel (2–3 days wall clock)

- **Track A (code)**: 038 — truthful PSU/connector outcomes. Heaviest plan in
  the wave because of catalog regeneration (see §8). Serial relative to
  Track B (disjoint files, but do not run Track A and 040 concurrently —
  both edit `App.test.jsx`). **Status (2026-09-25): DONE — reviewed and
  merged as `05e9ca8`; catalog rebuilt, 3,552 fabricated recommendations
  removed, assurance green.**
- **Track B (pipeline)**: 047 — symlink rejection. `scripts/lib/io.js` +
  `sources.js` only; merge any time after 037. **Status (2026-09-25): DONE —
  reviewed and merged as `4c4e349`; 6 io/pipeline test files, 215 passing.**
- **Track C (docs/decisions)**: 048, 049, 051 — all create new documents only;
  can run in parallel with code and with each other. Their outputs are inputs
  to owner decisions (§7), not to Wave 2. **Status: 048 and 051 are DONE and
  merged (`f5fcf04`, `12a900b`) as of 2026-09-25; the corpus decision was
  implemented by 052 (merged `4ff321d`); 049 remains TODO.**
- **Entry**: Wave 0 merged.
- **Exit**: 038's reproductions return `unknown`/`fail`, artifacts regenerated
  (or a filed STOP report naming the operator commands), assurance green;
  047's io tests pass; Track C docs structurally complete.
- **Merge order**: 038 → 047 → docs (order irrelevant among docs).
- **Status (2026-09-25)**: Wave 0 entry satisfied (`c36ee30`). Track A done
  (`05e9ca8`), Track B done (`4c4e349`), Track C done. **Next: Wave 2
  (039 and 040 in parallel; merge order 039 → 040).**

### Wave 2 — Analyzer quality (2 days wall clock)

- **Track A**: 040 — characterization tests. Run after 038 so the tests pin
  the new behavior.
- **Track B**: 039 — quote-quality defects. Disjoint files from 040
  (`report.js`, `csvParser.js`, `session.js`, `QuoteAnalyzer.jsx` vs
  `App.test.jsx`, `fileIO.test.js`). Run 039 after 038 for an isolated
  assurance diff.
- **Entry**: 038 merged (039 recommended), Wave 1 Track A merged.
- **Exit**: `App.test.jsx` reports 0 todo; 039's new report/csv/session cases
  pass; `test:assurance` green.
- **Merge order**: 039 → 040 (040's harness may assert copy affected by 039;
  reconcile if reversed).
- **Status (2026-09-25)**: DONE — both executed in parallel worktrees,
  reviewed and merged (`ca11b8e`, `5d13de7`); App suite 121 passed / 1
  retained bug-todo; assurance green. **Next: Wave 3, plan 042 then 043
  strictly serial.**

### Wave 3 — Analyzer performance and UX (2–3 days wall clock, serial)

- **Plans**: 042 → 043, strictly serial: both edit `QuoteAnalyzer.jsx`,
  `App.jsx`, and `useCatalog.js`. Do not parallelize.
- **Entry**: Wave 2 merged; full suite green.
- **Exit**: 042 parity tests prove resolution states unchanged; candidate cap
  has the manual-search fallback; `active={false}` skips work; raw parse cache
  released. 043's edit-context round trip and degraded-data hints pass.
- **Merge order**: 042, then 043 rebased on it.
- **Status (2026-09-25)**: 042 DONE — reviewed (parity + assurance 44/44) and
  merged as `a3e88ab`. 043 DONE — reviewed and merged as `0de4e23`.
  **Wave 3 complete. Next: Wave 4, plan 044.**

### Wave 4 — Data lifecycle hardening (1.5–2.5 days)

- **Plan A**: 044 — persistence/import/filename/mapper/history. Touches
  `App.jsx` + `QuoteAnalyzer.jsx`; must follow Wave 3.
- **Batch B**: 041 + 050 in one worktree/session — both are small edits to
  `App.jsx` (+ `usePersistence.js`, `App.test.jsx`) with tests already in
  place from Wave 2. Batching saves two baseline cycles and avoids a third
  reconciliation of `App.jsx`.
- **Entry**: Wave 3 merged; 040 done.
- **Exit**: 044's recovery/backup, empty-import error, slugified filenames,
  mapper guard, single-push history tests pass; 041+050 green.
- **Merge order**: 044, then 041+050 as one commit series.
- **Status (2026-09-25)**: 044 DONE — reviewed and merged as `b5d7381`
  (StrictMode-safe first-write skip recorded as a deliberate deviation).
  **Next: 041 + 050 batched in one worktree.**

### Wave 5 — Tooling and final reconciliation (1–1.5 days)

- **Plan A**: 046 — scripts lint, strict app lint, asset prune. Depends on 037
  (workflow/lint surfaces) and on Wave 3 (the `rows` memo fix in
  `QuoteAnalyzer.jsx`).
- **Plan B**: 045 — docs truth-up, last so its "current state" corrections
  reflect 038-046.
- **Entry**: Waves 0-4 merged.
- **Exit**: `npm run check` exit 0 with zero warnings and scripts linted;
  `docs/assets` matches `docs/index.html`; doc sweep commands return no
  current-state contradictions.
- **Merge order**: 046 → 045.

### Wave 6 — Decision-gated work (schedule only after §7 decisions)

- **033** (3-page content pilot) and **034** (SoloTodo qualification) were
  already approved as plans and may start independently; they are large (L) and
  do not block Waves 0-5.
- New implementation plans derived from **048** (contribution path), **049**
  (page batch), **051** (measurement) enter the backlog only after the owner
  records the decisions in §7; each becomes its own plan file.
- **027** stays `BLOCKED` until upstream tooling supports TS 7 + ESLint 10.

**Critical path**: `037 → 038 → 040 → 042 → 043 → 044 → (041+050) → 046 → 045`
≈ **10–14 working days** at the stated pace. Everything else (047, 039, 048,
049, 051, 033, 034, 046's scripts half) can overlap and does not lengthen the
path as long as shared-file rules in §5 hold.

---

## 5. Critical path and file-conflict map

Two plans may not run concurrently if they edit the same file. This table is
the scheduling authority; if a plan adds a file to the map, update it here.

| Shared file | Plans that touch it | Rule |
|---|---|---|
| `src/App.jsx` | 038, 041, 042, 043, 044, 050 | Strict serial in this order; 041+050 may batch |
| `src/components/QuoteAnalyzer/QuoteAnalyzer.jsx` | 039, 042, 043, 044, 046 | Serial: 039 → 042 → 043 → 044 → 046 |
| `src/App.test.jsx` | 038, 040, 043, 044, 050 | Serial: 038 → 040 → later plans rebase |
| `src/components/QuoteAnalyzer/session.js` | 039, 042 | Serial: 039 → 042 |
| `src/hooks/useCatalog.js` | 042, 043 | Serial: 042 → 043 |
| `src/hooks/usePersistence.js` | 041, 044 | Serial: 044 → 041 (041 also needs App.jsx free) |
| `src/lib/fileIO.js` / `fileIO.test.js` | 040 (test), 044 (impl) | Serial: 044 → 040 test update if needed |
| `src/lib/csvParser.js` | 039 | Serial with nothing in this batch |
| `package.json` + `.github/workflows/` | 037, 046 | Serial: 037 → 046 |
| `scripts/**` | 038 (compiler), 046 (lint fixes), 047 (io/sources) | Compatible: 038 edits `compiler.js`; 046 edits unused bindings incl. `compiler.test.js`; 047 edits `io.js`/`sources.js` |
| `docs/` (existing docs) | 045 | Run last |
| `docs/design/` (new files) | 048, 049, 051 | Parallel; no overlap with 045's files |
| Generated artifacts (`data/processed`, `public/data`, `docs/data`, `docs/assets`) | 038, 046 | Never run concurrently; 046's prune follows 038's rebuild |

**Merge discipline**: within a wave, merge in the listed order; rebase the next
plan's worktree on the updated default branch before starting. Never merge two
`App.jsx`-touching plans from parallel worktrees.

---

## 6. Implementation guide (executor protocol)

### 6.1 Per-plan loop

1. **Commit `plans/` first.** Worktrees and drift checks (`Planned at` SHA)
   only work when the plan files are versioned. A gitignored `plans/` breaks
   the flow silently.
2. **Read the entire plan** before running anything, including STOP conditions
   and maintenance notes.
3. **Dispatch or open a worktree** named `advisor/NNN-<slug>` on the plan's
   branch convention. For the `improve` skill, use `execute plans/NNN-*.md`;
   the executor runs in an isolated worktree and does not push.
4. **Run the drift check** (`git diff --stat 6cde4b8..HEAD -- <in-scope paths>`)
   and Step 0 baseline. A red baseline or a current-state mismatch is a STOP,
   not an invitation to fix.
5. **Execute steps in order**, running each step's verification command and
   confirming the expected result before proceeding. Never skip a gate.
6. **Run the full done criteria**. Do not mark done on intent.
7. **Review the diff like a tech lead** (or have a reviewer do it): every hunk
   must trace to a plan step; reject out-of-scope changes however plausible.
8. **Update records**: `plans/README.md` status row; this file's §2 Scoreboard
   and §4 wave checkboxes; add a one-line completion note with commit and date.
9. **No push, no PR, no merge** unless the operator explicitly instructs it.

### 6.2 Parallel execution rules

- One worktree per plan; maximum two concurrent code worktrees.
- Consult §5 before parallelizing; docs-only plans may always run in parallel.
- If two planned changes collide unexpectedly, STOP the later one and rebase
  rather than resolving blind conflicts.
- Batch small same-file plans (e.g. 041+050) into one session to save baseline
  and review cycles.

### 6.3 Commands cheat sheet (run from `pc-quote-builder/` unless noted)

| Purpose | Command |
|---|---|
| Install | `npm ci` |
| Fast iteration | `npm run lint && npm test` |
| Required gate | `npm run check` (lint + test + disposable build) |
| Analyzer conformance | `npm run test:assurance` (added by 037) |
| Artifact contracts | `npm run test:artifacts` |
| Post-build contract | `npx vitest run src/lib/postBuildAssertion.test.js` |
| Root contract gate | `bash scripts/verify.sh` (repo root) |
| Data pipeline | `npm run pc-data:all` — only for data plans (038) |
| Advisories | `npm audit --audit-level=high` |

### 6.4 Global definition of done

A plan is complete only when ALL hold:

- Every plan-specific done criterion was executed and observed.
- `npm run check` exits 0; `test:assurance` exits 0 (after Wave 0).
- The diff (`git diff --name-only 6cde4b8...HEAD`) contains only in-scope files.
- Tests were added/updated for every behavior change (repo rule: a behavior
  change without test and doc updates is incomplete).
- `plans/README.md` row and this file's Scoreboard/Wave entries are updated.
- STOP reports, deferrals, and unexpected findings are recorded in the plan's
  Maintenance notes (using the `**Deferred:**` convention).

---

## 7. Owner decision queue

Only the project owner can resolve these; each blocks Wave 6 work or an
already-gated direction. Record decisions in `plans/README.md` (or a plan
amendment) when made.

| Decision | Blocks | Recorded where | Status |
|---|---|---|---|
| Consent wording, retention period, hosting, withdrawal SLA for contributed quotes | Any implementation of 048 | 048 §9 + owner note | OPEN |
| Topic priority and rule-coverage floor for pages 4-12; observation gate stays evidence-based | Page batch plans after 049 | 049 §8 | OPEN |
| Measurement sink model, consent, retention, access; acquisition-class derivation rule | Any implementation of 051 ("`product_start` + non-branded separation") | 051 §9 + contract amendment if needed | OPEN — deferred: no collection authorized until M1 traffic; owner re-approval required (051 merged `12a900b`) |
| SoloTodo go/no-go after qualification | Price-intelligence integration | 034 plan | OPEN (qualification may start) |
| Expand content pilot beyond 3 pages | Pages 4-12 build | 033 + 049 ledger | OPEN (needs observation data) |
| TypeScript 7 adoption gate | 027 | 027 preflight | BLOCKED externally |
| Monetization (M5) | Any monetization work | PRODUCT_VISION | LOCKED until M4 |

---

## 8. Risks, buffers, and operating rules

- **Catalog regeneration (038)**: needs `data/raw/` and Python deps; run the
  pipeline in the main checkout, not a fresh worktree. Budget +0.5–1 day if
  raw data must be downloaded. If unavailable, the executor files a STOP report
  and the compiler change stays inert until the operator regenerates.
- **Assurance suite is a tripwire**: any plan that changes a pinned supported
  rule outcome must STOP and reconcile with `docs/validation/` rather than
  editing fixtures.
- **Shared `App.jsx` is the bottleneck**: Waves 3-4 are serial by design. Do not
  "save time" by parallelizing them; merge conflicts in a 1,174-line file cost
  more than the serialization.
- **Data artifacts are generated, never hand-edited** (`data/processed/`,
  `public/data/`, `docs/data/`, `docs/assets/`). Only 038 (compiler) and 046
  (asset prune) touch them, via tooling.
- **Review buffer**: estimates include ~20%. Add another 20% if two or more
  plans merge in the same day.
- **No scope invention**: a finding discovered mid-plan goes to the plan's
  Maintenance notes as `**Deferred:**`, not into the diff.
- **Governance guardrails** (from `plans/README.md`, do not relitigate):
  no Guided Builder production before M2 quality gates; no monetization before
  M4; no fuzzy/AI product matching; no scraping or SoloTodo ingestion without
  written permission; no programmatic/mass SEO; no expert-label corpus; no
  TypeScript side-by-side workaround; accessibility is a separate audit and is
  not claimed here.

---

## 9. Change log for this document

| Date | Commit | Change |
|---|---|---|
| 2026-09-25 | `6cde4b8` | Initial roadmap: 037-051 batch, scoreboard vs Milestones 0-5, waves 0-6, conflict map, decision queue. |
| 2026-09-25 | unmerged `fe1053a`, `78669d5` | M0 track: plans 048 and 051 executed and reviewed (APPROVE). M0 row now "decision-gated"; Wave 1 Track C partial (049 remains). |
| 2026-09-25 | unmerged `9a5fc9a`…`97e8760` | Wave 0 (037) executed and reviewed (APPROVE): per-push gate + 0 advisories + assurance 44/44. M0 decisions recorded (corpus adopt / measurement stays no-op); Plan 052 written as moat layer 1. |
| 2026-09-25 | merged through `4ff321d` | Batch 1: 037/048/051 merged (`c36ee30`, `f5fcf04`, `12a900b`); 052 executed, revised in review (retain user-confirmed rows), approved and merged (`4ff321d`). Snapshot, scoreboard M0/M2, backlog, and Wave 0/1 statuses updated; integration baseline `npm run check` exit 0, 961 passing / 27 todo. |
| 2026-09-25 | merged `05e9ca8` | Wave 1 Track A: 038 executed (`994e39a`, `6b1b882`), reviewed (APPROVE; "None" connector semantics recorded), merged. Catalog regenerated: 3,552 null-TDP fabricated recommendations removed; integration baseline 972 passing / 27 todo, assurance and artifact gates green. |
| 2026-09-25 | merged `4c4e349` | Wave 1 Track B: 047 executed (`52e63dd`), reviewed (APPROVE), merged. Fail-closed `assertNotSymlink` guard in every dataset read path + 5 focused io tests; integration baseline `npm run check` exit 0, 977 passing / 27 todo, `verify.sh` green. |
| 2026-09-25 | merged `5d13de7` | Wave 2: 039 (`d066a91` → `ca11b8e`) and 040 (`e3c9e53` → `5d13de7`) executed in parallel, reviewed (APPROVE; 040 retains one documented bug-todo), merged in order. Integration baseline `npm run check` exit 0, 1016 passing / 1 todo, assurance and `verify.sh` green. |
| 2026-09-25 | merged `a3e88ab` | Wave 3 step 1: 042 executed (`6bff8c9`…`b184520`), reviewed (APPROVE; resolution parity + assurance 44/44), merged. Indexed O(1) lookups, 20-candidate cap with manual fallback, `active` laziness, raw parse released. Integration baseline 1034 passing / 1 todo. |
| 2026-09-25 | merged `0de4e23` | Wave 3 step 2: 043 executed (`90ba921`), reviewed (APPROVE), merged. Editable context after analysis; `compatFailed` and coverage-unavailable hints surfaced without verdict changes. Integration baseline 1043 passing / 1 todo. |
| 2026-09-25 | merged `b5d7381` | Wave 4 step 1: 044 executed (`67acba0`), reviewed (APPROVE; identity-based first-write skip recorded), merged. Per-entry recovery + backup, unified import detection, slugified export names, mapper guard, single `pushState`. Integration baseline 1061 passing / 1 todo. |
