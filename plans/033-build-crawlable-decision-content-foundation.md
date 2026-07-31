# Plan 033: Build the crawlable Spanish decision-content foundation

> **Executor instructions**: Follow this plan step by step. Publish only a small
> authored pilot backed by supported Analyzer rules. Do not generate component-
> permutation pages, invent market-price claims, or claim Milestone 1 completion
> without external index-observation evidence. Run build-output assertions using
> the disposable build.
>
> **Drift check (run first)**:
> `git diff --stat cef0acd..HEAD -- docs/PRODUCT_VISION.md docs/design/quote-analyzer.md pc-quote-builder/index.html pc-quote-builder/vite.config.js pc-quote-builder/package.json pc-quote-builder/pages pc-quote-builder/public/robots.txt pc-quote-builder/public/sitemap.xml pc-quote-builder/src/content-pages.css pc-quote-builder/src/lib/staticPageContract.test.js`
>
> If the production domain/base path, supported rules, or Analyzer entry URL
> changed, STOP and reconcile canonical URLs and calls to action.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: Plans 030, 031, 032, and 035
- **Category**: direction
- **Planned at**: commit `cef0acd`, 2026-07-30

## Why this matters

The deployed source is a generic English-labeled SPA shell. Milestone 1 requires
Spanish metadata, stable canonical URLs, crawlable internal links, robots,
sitemap, search observation, and useful pages that work without SPA execution.
This plan establishes a dependency-free Vite multipage foundation and publishes
three authored evidence briefs as a quality pilot. It does not attempt the full
12-page milestone or programmatic SEO.

## Product-decision record

- Audience: Chilean users asking a concrete pre-purchase compatibility or PSU
  question.
- Every page must answer one decision, cite its rule/evidence basis, disclose
  scope, freshness, limitations, and unsupported conclusions, and link to the
  Analyzer workflow.
- Initial topics are limited to rules already supported by the v1 Analyzer:
  CPU↔motherboard socket, GPU↔case length, and PSU power/connectors with explicit
  unknown handling.
- No product-name permutations, price/value rankings, performance claims,
  affiliate ordering, sponsored placement, or structured data unsupported by
  visible content.
- Expansion from three to twelve pages requires observed unique query value,
  indexing evidence, maintained freshness, and qualified Analyzer starts.

## Current state

- `pc-quote-builder/index.html:1-12` has `lang="en"`, Vite icon, generic title,
  no description, no canonical, and an empty root.
- `pc-quote-builder/vite.config.js:5-14` has one SPA input, Pages base
  `/cotiza-pc/`, output `../docs`, and disposable tests.
- `pc-quote-builder/public/` contains catalog data and `vite.svg`; no
  `robots.txt` or sitemap exists.
- `docs/PRODUCT_VISION.md:394-418` requires decision-specific, crawlable,
  evidence/freshness-aware pages and rejects thin duplication.
- `docs/PRODUCT_VISION.md:532-543` defines Milestone 1 technical/indexing gates
  and the eventual 12-page target.
- `pc-quote-builder/package.json:10-22` provides `build:check` and the required
  `check` gate. Do not add dependencies.
- Origin remote implies a likely canonical root of
  `https://cortega26.github.io/cotiza-pc/`, but the owner must confirm that no
  custom domain is authoritative before implementation.

## Commands you will need

Run from `pc-quote-builder/`.

| Purpose | Command | Expected on success |
|---|---|---|
| Static contracts | `npx vitest run src/lib/staticPageContract.test.js` | all source-page/metadata tests pass |
| Disposable build | `npm run build:check` | exit 0; output only under `/tmp/pc-check-build` |
| Built-page assertions | `STATIC_BUILD_DIR=/tmp/pc-check-build npx vitest run src/lib/staticPageContract.test.js` | all built routes contain standalone content |
| Required gate | `npm run check` | exit 0 |
| Link/lint hygiene | `git diff --check` | exit 0 |

Do not run `npm run build` during iteration because it rewrites tracked `docs/`.

## Scope

**In scope**:

- `docs/design/search-content-foundation.md` — page contract, editorial workflow,
  freshness/correction ownership, and search-observation procedure.
- `pc-quote-builder/index.html` — Spanish metadata, canonical, favicon cleanup,
  and non-JS fallback navigation/content.
- `pc-quote-builder/vite.config.js` — dependency-free multipage HTML inputs.
- Three authored HTML sources under:
  - `pc-quote-builder/pages/guias/compatibilidad-cpu-placa-madre/index.html`
  - `pc-quote-builder/pages/guias/gpu-cabe-gabinete/index.html`
  - `pc-quote-builder/pages/guias/fuente-poder-watts-conectores/index.html`
- `pc-quote-builder/src/content-pages.css` — shared lightweight styling.
- `pc-quote-builder/public/robots.txt` and `public/sitemap.xml`.
- `pc-quote-builder/src/lib/staticPageContract.test.js`.
- README/content-maintenance documentation if needed.

**Out of scope**:

- More than three pilot pages or automatic component/product pages.
- A CMS, SSR framework, router dependency, backend, or deployment-platform move.
- Blog/community/comments, public quotes, affiliate links, retailer rankings,
  or commercial structured data.
- Market prices, performance/bottleneck, thermals, noise, durability, BIOS, or
  upgrade claims.
- Search Console configuration without explicit account/domain authority.
- Production build/deployment unless separately instructed.

## Git workflow

- Branch: `advisor/033-build-crawlable-decision-content-foundation`
- Suggested commits: `033: establish crawlable Spanish site metadata` and
  `033: add three evidence-backed decision briefs`.
- Do not deploy, submit a sitemap, or configure external services unless asked.

## Steps

### Step 1: Confirm canonical origin and editorial ownership

Obtain explicit owner confirmation of the production canonical origin. Default
proposal: `https://cortega26.github.io/cotiza-pc/`. If a custom domain exists,
use it consistently in canonicals, sitemap, robots, and documentation.

Assign a content owner, technical evidence owner, automated conformance status,
review interval, and correction path. Record these in
`docs/design/search-content-foundation.md`. No independent human reviewer is a
launch dependency.

**Verify**:
`rg -n "Canonical origin|Content owner|Evidence owner|Conformance status|Review interval|Correction" docs/design/search-content-foundation.md`
→ each field has an approved value.

### Step 2: Define the source-page quality contract

Document required fields for every page:

- unique slug, title, description, H1, and user decision;
- audience/scope and Chile relevance;
- Analyzer rule IDs and evidence/data sources;
- last reviewed date and catalog/rule freshness explanation;
- deterministic/derived/unsupported labels;
- limitations and what cannot be concluded;
- authored worked example that contains no user data;
- contextual Analyzer CTA and at least two relevant internal links;
- correction/contact path.

Pages fail review if their substantive body differs only by component names.

**Verify**:
the document includes an editor checklist and a machine-checkable page contract.

### Step 3: Correct the root shell and provide non-JS fallback content

Update `index.html` to `lang="es-CL"`, a descriptive cotiza-pc title/description,
confirmed canonical URL, and project-owned icon or no icon. Add concise fallback
HTML inside `#root`: product purpose, Analyzer CTA, and crawlable links to the
three guides. React will replace it when JavaScript runs; without JavaScript it
must remain useful and honest.

Do not insert structured data unless visible root content fully satisfies its
schema.

**Verify**:
static contract tests assert language, unique title/description, one canonical,
H1, Analyzer link, and three guide links without executing JavaScript.

### Step 4: Configure Vite multipage inputs

Add the three nested HTML files as Rollup/Vite inputs alongside the SPA root.
Use Vite's existing base so assets resolve under `/cotiza-pc/`. Import shared
`content-pages.css` from each page through Vite; do not hardcode hashed assets.
Ensure output paths end in the expected `/guias/<slug>/index.html`.

**Verify**:
`npm run build:check`
→ exit 0 and all four HTML entry points exist under `/tmp/pc-check-build`.

### Step 5: Author three distinct evidence briefs

Each page must contain standalone Spanish prose and visible decision logic:

1. **CPU↔motherboard socket**: equality check, exact identity requirement,
   inferred/missing socket handling, and what socket alone cannot prove.
2. **GPU↔case fit**: board length vs maximum GPU length, unit clarity,
   missing-dimension handling, and exclusions such as thickness/radiators.
3. **PSU power/connectors**: estimated envelope/headroom vs GPU recommendation,
   connectors as a separate check, and explicit unknown when PSU/GPU connector
   data is absent.

Use synthetic examples and link to the relevant Analyzer entry. Do not state that
a real build is safe based only on the article.

**Verify**:
contract tests require each page's distinct rule IDs, unsupported section,
freshness/review date, CTA, and no duplicate description/H1.

### Step 6: Add robots and canonical-only sitemap

Create `robots.txt` permitting public content and pointing to the confirmed
absolute sitemap. Create an XML sitemap containing only canonical root and the
three pilot pages. Exclude query/hash Analyzer URLs, generated assets, and data
files. Use valid absolute URLs.

**Verify**:
static tests parse XML, assert exactly four unique canonical URLs, match page
canonicals, and reject noncanonical/query/hash entries.

### Step 7: Add source and built-output contract tests

`staticPageContract.test.js` must run against source by default and against
`STATIC_BUILD_DIR` when provided. Check:

- all pages exist and contain readable body text without SPA execution;
- unique titles/descriptions/H1/canonical;
- correct language and internal links;
- no broken `/cotiza-pc/` base paths;
- robots/sitemap agreement;
- required evidence/scope/freshness/unsupported/CTA markers;
- no accidental `noindex` on canonical pages.

Use Node filesystem/XML-safe parsing available without adding dependencies;
avoid brittle full-page snapshots.

**Verify**:
`npm run build:check && STATIC_BUILD_DIR=/tmp/pc-check-build npx vitest run src/lib/staticPageContract.test.js`
→ all pass.

### Step 8: Document external search observation without claiming completion

Document owner steps for Search Console or equivalent: verify the canonical
property, submit sitemap, record submitted/indexed/excluded URLs and reasons,
inspect queries and landing-to-Analyzer starts under Plan 031's privacy
contract. Do not perform external account changes without authority.

Define pilot review after sufficient observation. Expand only when each page has
unique value and maintained evidence; investigate exclusions rather than
lowering the 80% milestone target.

**Verify**:
the design document contains an observation log template and explicit
expand/maintain/retire criteria.

### Step 9: Run the full non-mutating gate

Run static source/built tests and `npm run check`. Inspect `/tmp` output, not
tracked `docs/`. Confirm no dependencies or generated catalog artifacts changed.

**Verify**:
`npm run check && STATIC_BUILD_DIR=/tmp/pc-check-build npx vitest run src/lib/staticPageContract.test.js && git diff --check`
→ all exit 0.

## Test plan

- Source and built-output file existence.
- Unique metadata/canonical/H1 and `es-CL`.
- Base-path-correct internal/assets links.
- Sitemap/robots/canonical agreement.
- Visible evidence, scope, freshness, unsupported, and CTA blocks.
- Duplicate/thin-content guard using normalized title/description/section text,
  while avoiding a simplistic word-count-only quality claim.
- Regression: SPA root still mounts and `npm run check` remains green.

## Done criteria

- [ ] Canonical production origin is explicitly approved.
- [ ] Root has Spanish metadata and useful non-JS fallback content.
- [ ] Three distinct authored guides build to stable nested URLs.
- [ ] Each guide exposes evidence, scope, freshness, limitations, and Analyzer
  CTA without unsupported claims.
- [ ] Robots and sitemap contain canonical URLs only.
- [ ] Source and disposable-built output pass contract tests.
- [ ] Search observation procedure exists; no false claim of external setup.
- [ ] No new dependencies, mass-generated pages, prices, rankings, or deployment.
- [ ] `npm run check` and `git diff --check` pass.
- [ ] `plans/README.md` is updated.

## STOP conditions

Stop and report if:

- The canonical domain/custom-domain choice is unknown.
- Plan 030 says a proposed rule lacks support for public explanation.
- Plan 035 has no passing conformance case for the rule, misses a critical
  negative control, or otherwise leaves the topic's automated assurance gate
  failed/unevaluable.
- A page requires price/value/performance claims outside Analyzer v1.
- Stable nested output cannot be achieved without changing deployment behavior.
- Search/structured-data guidance would require unsupported visible content.
- Someone requests programmatic component pages before the pilot is measured.
- External Search Console/deployment action lacks explicit authority.

## Maintenance notes

Every rule or evidence-source change must trigger review of affected pages.
Maintainers and automated contracts should inspect built HTML, canonical/base
paths, unsupported language, current Plan 035 conformance status, and whether
the article remains independently useful. The three-page pilot is a quality
gate, not permission to mass-produce content.
