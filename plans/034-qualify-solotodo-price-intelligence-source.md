# Plan 034: Qualify SoloTodo as a permissioned Chilean price-intelligence source

> **Executor instructions**: Follow this plan in order. Phase A is a
> documentation, permission, and contract-qualification exercise. It does not
> authorize scraping, reverse engineering, production API calls, credential
> creation, sending an external message, or publishing SoloTodo-derived data.
> A fixture-only technical spike may begin only after the Phase A permission
> gate is satisfied. Production acquisition, scheduled refreshes, public
> redistribution, and consumer UI require the separate owner approval and
> follow-up implementation plan defined in Step 8.
>
> **Drift check (run first)**:
> `git diff --stat cef0acd..HEAD -- docs/PRODUCT_VISION.md docs/design/quote-analyzer.md plans/README.md plans/028-implement-quote-analyzer-core.md plans/030-generate-assessment-coverage-contract.md plans/032-ship-confirmation-driven-analyzer-ui.md plans/035-automate-analyzer-assurance.md scripts/download_pc_datasets.py scripts/build_pc_data.js scripts/lib/sources.js scripts/lib/compiler.js pc-quote-builder/src/lib/quoteModel.js pc-quote-builder/src/lib/money.js .github/workflows/pc-data-cron.yml`
>
> STOP and reconcile this plan if the canonical vision changes the Chile-first
> beachhead, commercial-neutrality policy, product-identity rules, price
> freshness semantics, or governed-data-product boundaries.
>
> **Working-tree protection**: run `git status --short` before the drift check.
> At planning time, unrelated uncommitted changes existed in
> `pc-quote-builder/src/App.test.jsx`,
> `pc-quote-builder/src/lib/catalogMapper.js`, and
> `pc-quote-builder/src/lib/catalogMapper.test.js`. Plans 028-033 and
> `plans/README.md` were also uncommitted. Preserve all of them. This
> qualification plan should not need to edit those source files.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: HIGH
- **Depends on**: no dependency for public-source qualification and owner-led
  outreach; Plan 035 supplies separate automated identity conformance and
  private real-input coverage, Plan 030 supplies evidence-coverage semantics,
  and Plan 028 must be stable before any price evidence becomes an Analyzer
  input
- **Category**: direction
- **Planned at**: commit `cef0acd`, 2026-07-30

## Why this matters

SoloTodo is unusually aligned with cotiza-pc's Chile-first desktop-gaming
beachhead: its public site identifies itself as a price comparator, exposes PC
component categories, lists multiple Chilean retailer offers for a product, and
shows regular/effective prices plus historical-price affordances. That makes it
a strong candidate to improve local price discovery, product identity, and
eventual value analysis without cotiza-pc independently integrating every
retailer first.

That strategic fit is not permission to ingest or republish the data. The
official material reviewed while writing this plan:

- says SoloTodo makes a best effort to keep information current but treats it
  as referential and does not guarantee completeness or accuracy;
- requires users to corroborate prices and characteristics with the actual
  seller;
- allows SoloTodo to change or remove site information and terms;
- provides a public contact form, but no public API or data-feed documentation
  was found in the official pages and search results reviewed on 2026-07-30;
- does not establish the user's hypotheses that SoloTodo is Chile's
  most-visited gamer source or that every price is updated in real time.

The correct first move is therefore to qualify SoloTodo as a **permissioned
primary candidate for Chilean offer discovery**, not to add an unlicensed
scraper. This plan obtains a defensible access/attribution agreement, defines a
separate retailer-offer contract, proves identity and coverage against the
validation corpus, and produces a go/no-go decision before production work.

## Product-decision record

### Source role

- SoloTodo may become a major discovery/aggregation provider for Chilean
  retailer offers. It must not become the sole source of product truth, the
  seller of record, or an authority for compatibility conclusions.
- The underlying retailer remains the source the user must verify before
  purchase. Every consumer-facing offer must retain its retailer, offer URL,
  conditions, observation time, and SoloTodo provenance.
- Product specifications and compatibility evidence remain in the existing
  governed catalog. SoloTodo offer data is joined through an explicit identity
  crosswalk; it is not merged into `scripts/lib/sources.js` as another
  specification record.
- SoloTodo-authored descriptions, prose, images, rankings, or reviews are out
  of scope unless a later written license explicitly covers them.

### Access and licensing

- Prefer an official API, export, or partner feed with written terms.
- Public HTML availability, a permissive `robots.txt`, or an observable browser
  endpoint is not a data license and is insufficient authorization.
- Do not scrape pages, reuse private endpoints, imitate the Chrome extension,
  bypass access controls, or infer undocumented rate limits.
- Written permission must separately cover automated access, caching,
  transformation, public display/redistribution, attribution, deep links,
  historical retention, and any commercial terms. Permission for one does not
  imply the others.
- If SoloTodo offers links/search integration but not data redistribution,
  record that as a valid constrained option rather than treating the
  qualification as a failure.

### Identity and evidence

- Only a provider ID, manufacturer part number, or other exact approved
  crosswalk may auto-link an offer group to a cotiza-pc catalog product.
- Normalized brand/model text may generate candidates but must never silently
  confirm a match. Ambiguous or edition-sensitive matches remain `unmatched` or
  require explicit user confirmation.
- Separate `sourceUpdatedAt` (supplied by SoloTodo) from `observedAt` (when
  cotiza-pc received the record). Never manufacture source freshness from
  acquisition time.
- “Real-time,” “live,” “current,” “best,” and “cheapest” are prohibited labels
  until the provider contract and measured refresh behavior support the
  specific claim.

### Price and ranking semantics

- Preserve effective price, regular price, currency, availability, shipping,
  payment/coupon conditions, seller type, and warranty distinctions as separate
  nullable fields. Missing data is unknown, not zero or “included.”
- A lowest-price sort is permitted only across identity-confirmed, available,
  like-for-like offers whose visible conditions make the comparison meaningful.
  It is not a product recommendation.
- Affiliate rate, sponsorship, provider relationship, retailer commission, or
  coupon economics must never influence findings, product order, or retailer
  order. Any commercial relationship must be disclosed.
- Plan 028's Analyzer v1 continues to report quote price completeness and
  freshness only. This plan does not silently enable value-for-money verdicts,
  cheapest-cart calculations, or replacement recommendations.

### Failure behavior

- A missing, stale, rate-limited, revoked, conflicting, or unavailable
  SoloTodo source degrades only retailer-offer/value conclusions to an explicit
  unavailable or insufficient-evidence state.
- It must not make the specification catalog unusable, invalidate technical
  compatibility, erase user-entered quote prices, or fall back to an old offer
  snapshot without a stale label.
- The product must remain useful when SoloTodo is unavailable.

## Verified external evidence snapshot

Re-verify these pages before outreach and record the review date. External
pages can change.

| Evidence | Official URL | What it supports | What it does not support |
|---|---|---|---|
| Homepage and mission | `https://www.solotodo.cl/` | Consumer product/price-comparison mission; gaming GPU category is prominent | Traffic rank or gamer market share |
| GPU category | `https://www.solotodo.cl/tarjetas_de_video` | A substantial, actively rendered PC-component catalog with prices | API access, reuse rights, or update SLA |
| Example GPU | `https://www.solotodo.cl/products/276343-asus-prime-radeon-rx-9070-xt-oc-edition-16gb-90yv0l71-m0aa00` | Manufacturer part number, specifications, multiple stores, effective/normal prices, historical-price affordance | Guaranteed correctness, completeness, shipping inclusion, or real-time status |
| Terms | `https://www.solotodo.cl/legal_information?tab=0` | Referential-data disclaimer, seller-verification requirement, unilateral content/term changes | An automated-ingestion or redistribution license |
| Contact | `https://www.solotodo.cl/contacto` | Official path for a partnership/data-access inquiry; SoloTodo identifies itself as a comparator, not a store | Agreement to any proposed use |

Treat the absence of public API documentation as “not found in the reviewed
official material,” not as proof that no private or partner API exists.

## Current repository state

- `docs/PRODUCT_VISION.md` treats Chilean retailer offers as a separate governed
  data product and requires approved sources/licenses, identity policy,
  freshness/completeness thresholds, correction rules, failure behavior, and
  operating-cost ownership.
- `scripts/download_pc_datasets.py` acquires pinned open specification sources
  into ignored `data/raw/` and records their provenance. It has no authenticated
  provider, retail-offer, conditional-request, or rate-limit abstraction.
- `scripts/lib/sources.js` normalizes BuildCores, DBGPU, and PC Part records into
  specification categories. Its `SOURCE_TAGS` and merge preferences should not
  be extended with SoloTodo offer records.
- `scripts/build_pc_data.js` compiles static specification artifacts and one
  compatibility metadata snapshot. It does not emit a retailer-offer artifact.
- `.github/workflows/pc-data-cron.yml` runs every 14 days and deploys a static
  GitHub Pages build. That cadence is not evidence of acceptable offer
  freshness, and a public static artifact may be prohibited by a provider
  agreement.
- `pc-quote-builder/src/lib/quoteModel.js` supports user-entered `store`,
  `offerPrice`, `regularPrice`, and quote-level `priceUpdatedAt`.
- `docs/design/quote-analyzer.md` deliberately defers store comparison and
  value-for-money conclusions; Analyzer v1 only evaluates price completeness
  and freshness.
- Plan 035 creates a source-backed automated identity-conformance set plus a
  private unlabeled Chilean quote corpus used only to measure component coverage
  and identity resolution. Plan 030 measures assessment evidence, but explicitly
  excludes retailer-offer coverage.

## Target architecture if qualification succeeds

Keep offer acquisition separate from the specification compiler:

```text
official SoloTodo API / partner feed
              │
              ▼
permission-aware fetcher ──► private raw snapshot + acquisition provenance
              │
              ▼
pure SoloTodo adapter ─────► retailer-offers/v1 candidate records
              │
              ▼
exact identity crosswalk ──► matched / ambiguous / unmatched
              │
              ├────────────► offline coverage and freshness report
              │
              └────────────► publishable artifact only if redistribution is licensed

specification catalog ─────► technical compatibility remains independent
```

The adapter's normalized contract should be provider-neutral even if SoloTodo
is the first provider:

```json
{
  "schemaVersion": "retailer-offers/v1",
  "snapshotId": "opaque-stable-id",
  "provider": {
    "id": "solotodo",
    "obtainedAt": "2026-07-30T00:00:00Z",
    "sourceUpdatedAt": null,
    "licenseRecord": "docs/data-sources/solotodo.md",
    "attributionLabel": "Precios vía SoloTodo"
  },
  "products": [
    {
      "sourceProductId": "276343",
      "sourceUrl": "https://www.solotodo.cl/products/...",
      "identity": {
        "brand": "ASUS",
        "model": "Prime Radeon RX 9070 XT OC Edition 16GB",
        "manufacturerPartNumbers": ["90YV0L71-M0AA00"]
      },
      "crosswalk": {
        "catalogId": null,
        "status": "unmatched",
        "method": null,
        "confirmedBy": null
      },
      "offers": [
        {
          "sourceOfferId": "opaque-provider-id",
          "retailer": {"id": null, "name": "Example", "sellerType": null},
          "url": "https://retailer.example/product",
          "currency": "CLP",
          "effectivePrice": 799900,
          "regularPrice": 823898,
          "priceConditions": ["cash_or_transfer"],
          "availability": "unknown",
          "shipping": {"status": "unknown", "amount": null},
          "warranty": {"status": "unknown", "label": null},
          "observedAt": "2026-07-30T00:00:00Z",
          "sourceUpdatedAt": null
        }
      ]
    }
  ]
}
```

Exact field names may change to match an official schema, but the semantic
distinctions above are mandatory. Do not put credentials, confidential
commercial terms, personal contact details, or raw provider responses in a
public artifact.

## Commands you will need

Run npm commands from `pc-quote-builder/` unless stated otherwise. Phase A is
mostly documentary; Phase B commands are conditional on written permission and
approved sanitized fixtures.

| Purpose | Command | Expected on success |
|---|---|---|
| Confirm planning baseline | `git rev-parse HEAD && git status --short` | baseline and unrelated work are understood |
| Locate accidental source references | `rg -n -i "solotodo|retailer-offers" docs scripts pc-quote-builder/src .github plans` | only intentional references |
| Fixture adapter tests | `npx vitest run ../scripts/lib/solotodoOfferAdapter.test.js` | all authorized fixture cases pass |
| Crosswalk/coverage tests | `npx vitest run ../scripts/lib/retailerOfferCrosswalk.test.js ../scripts/lib/solotodoCoverage.test.js` | all exact/ambiguous/unmatched cases pass |
| Required app gate after any code/config change | `npm run check` | exit 0 |
| Artifact contract, only if a publishable artifact is later approved | `npm run test:artifacts` | all contracts pass |
| Python downloader regression, only if the existing downloader changes | `python ../scripts/test_downloader_help.py && npx vitest run src/lib/downloadPins.test.js` | exit 0 |
| Diff hygiene | `git diff --check` | exit 0 |

Do not run `npm run pc-data:all`, contact SoloTodo, use credentials, or call a
provider endpoint merely to satisfy this plan's verification section.

## Scope

**In scope**:

- A public, non-confidential source decision record at
  `docs/data-sources/solotodo.md`.
- A provider-neutral `retailer-offers/v1` design and SoloTodo field mapping,
  conditional on access to official documentation.
- A contact/partnership questionnaire for owner review.
- Written qualification of allowed access, caching, transformation,
  redistribution, attribution, retention, links, rate limits, and corrections.
- Sanitized or synthetic contract fixtures supplied or approved under the
  agreement.
- A pure fixture-only adapter and identity-crosswalk spike after permission.
- Automated exact-match/ambiguity conformance on source-backed fixtures plus
  coverage, freshness, and failure-mode evaluation against Plan 035's private
  unlabeled corpus.
- Operating-cost and provider-dependency assessment.
- A recorded `GO`, `CONSTRAINED GO`, `NO-GO`, or `PENDING` decision and a
  follow-up implementation plan if warranted.

**Out of scope**:

- Unpermissioned HTML scraping, browser automation, endpoint discovery, CAPTCHA
  handling, proxy rotation, or access-control bypass.
- Sending the contact request without explicit owner authorization.
- Storing credentials or confidential agreement text in git.
- Adding SoloTodo to the current specification `SOURCE_TAGS` or allowing it to
  overwrite compatibility fields.
- Production API calls, scheduled refreshes, public offer artifacts, or
  deployment.
- Consumer-facing price comparison, price alerts, historical charts,
  cheapest-cart optimization, value verdicts, affiliate links, or sponsored
  ranking.
- Importing SoloTodo descriptions, images, reviews, or SEO content.
- Assuming popularity or real-time freshness without evidence.
- Hand-editing `data/processed/`, `pc-quote-builder/public/data/`, or `docs/`.

## Git workflow

- Branch: `advisor/034-qualify-solotodo-source`
- Suggested commits:
  - `034: record SoloTodo source qualification`
  - `034: define retailer offer contract`
  - `034: add fixture-only SoloTodo adapter spike` — only after permission
  - `034: record SoloTodo go-no-go decision`
- Keep private correspondence, API keys, contractual PDFs, and raw partner data
  outside git in an owner-approved secure system. Commit only a non-confidential
  decision summary and public document references.
- If the qualification ends at `NO-GO` or `PENDING`, do not create empty
  production modules to make the repository appear integrated.

## Steps

### Step 1: Freeze the public evidence and source-role hypothesis

Create `docs/data-sources/solotodo.md` with:

- review date and accountable cotiza-pc owner;
- the five official URLs in the evidence table above;
- exact public claims that were verified;
- explicit unverified hypotheses: audience reach, gamer share, update latency,
  API availability, historical-data access, and permitted reuse;
- intended role: primary candidate for Chilean offer discovery, not
  compatibility authority or seller of record;
- the current decision state `PENDING`;
- the date by which terms and capabilities must be rechecked.

Do not copy long passages from SoloTodo. Paraphrase and link.

**Verify**:

- every factual claim is tied to an official page and review date;
- “most visited” and “real-time” are visibly hypotheses, not facts;
- no private data, credentials, or copied catalog content appears.

### Step 2: Prepare and approve the partnership/data-access questionnaire

Draft the inquiry in the decision record or an owner-only communication
document. The project owner must approve and send it through SoloTodo's official
contact path. Ask for:

1. Whether an official API, export, bulk feed, affiliate/product feed, or
   supported deep-link/search integration exists.
2. Authentication method, environments, schema/versioning, pagination,
   incremental updates, rate limits, retry guidance, and availability support.
3. Product identifiers, manufacturer part numbers, retailer/offer identifiers,
   and update timestamps available for PC components.
4. Coverage of effective/regular price, payment/coupon conditions, stock,
   shipping, marketplace seller, warranty, and price history.
5. Permission for automated access, local caching, transformation, public
   display, static redistribution, historical retention, and derived coverage
   metrics.
6. Required attribution, backlinks, logos/brand rules, correction/deletion
   handling, and notice for schema/term changes.
7. Whether a noncommercial/open-source integration differs from a commercial,
   affiliate, or sponsored arrangement.
8. Costs, usage floors, renewal/termination, data-deletion obligations, and any
   confidentiality constraints.
9. A technical and legal contact for incidents and corrections.

State cotiza-pc's neutrality requirement: commercial terms cannot affect
recommendation or retailer order. Do not promise traffic, exclusivity,
endorsement, data volume, or implementation dates.

**Gate A**:

- `PASS`: written terms cover the intended spike and sanitized fixtures.
- `CONSTRAINED`: only links or a subset of fields/uses are allowed; revise the
  target contract to that boundary.
- `PENDING`: no answer or ambiguous terms; no technical access.
- `FAIL`: automated use or necessary display is prohibited or commercially
  incompatible; record `NO-GO`.

### Step 3: Record the permission matrix before touching data

In `docs/data-sources/solotodo.md`, create a matrix with one of
`allowed`, `prohibited`, or `unknown` for:

- automated retrieval;
- fixture storage in a public repository;
- private raw caching and maximum retention;
- transformation/normalization;
- public runtime display;
- public static artifact redistribution;
- direct retailer links and SoloTodo backlinks;
- historical price retention;
- derived aggregate metrics;
- product identifiers and manufacturer part numbers;
- branding/attribution;
- commercial or affiliate relationship.

For every `allowed` cell, cite the controlling public term, agreement section,
or dated written confirmation. Store only a non-confidential reference if the
agreement itself is confidential. Any required capability still marked
`unknown` blocks that capability.

Also name:

- data-product owner;
- credential owner;
- technical incident contact;
- legal/commercial renewal owner;
- correction and takedown owner;
- expected monthly operating cost;
- termination and provider-exit procedure.

**Verify**: the owner or a future maintainer can decide what the project may
fetch, store, transform, and publish without reading private correspondence.

### Step 4: Define the provider-neutral retailer-offer contract

Create `docs/design/retailer-offers-contract.md`. Define:

- `retailer-offers/v1` envelope and versioning;
- provider snapshot identity and provenance;
- SoloTodo product and offer identifiers;
- exact identity fields and crosswalk states;
- price, currency, payment/coupon conditions, availability, shipping, seller,
  warranty, URLs, and timestamps;
- `unknown`, `not_provided`, `not_applicable`, `stale`, `conflicting`, and
  `removed` semantics;
- correction, deletion, supersession, and historical-retention behavior;
- redaction rules for public artifacts;
- deterministic ordering and duplicate handling;
- provider failure and partial-snapshot behavior;
- consumer attribution requirements;
- fields required before claiming lowest price, savings, availability, or
  freshness.

Keep provider acquisition metadata separate from user quote
`priceUpdatedAt`. A user-entered quote price is a historical snapshot; a
SoloTodo offer observation is provider evidence. Neither timestamp substitutes
for the other.

Do not define a universal price-confidence score. Expose evidence classes and
missing conditions directly.

**Verify**: contract fixtures can represent cash vs card/coupon price, unknown
shipping, marketplace seller, unavailable offer, removed product, duplicate
retailer listing, absent provider timestamp, and conflicting product identity.

### Step 5: Build a fixture-only SoloTodo adapter after Gate A passes

Only after permission covers fixtures, add:

- `scripts/lib/solotodoOfferAdapter.js`;
- `scripts/lib/solotodoOfferAdapter.test.js`;
- sanitized/synthetic fixtures under a clearly named test-fixture directory;
- no network client and no secret handling in this step.

The pure adapter must:

- accept the documented provider response as an argument;
- validate required top-level types and schema version;
- normalize CLP amounts without guessing from formatted prose;
- retain source IDs/URLs and price conditions;
- distinguish absent timestamps from acquisition timestamps;
- reject negative/non-finite prices and impossible currency combinations;
- retain unknown fields as unknown rather than optimistic defaults;
- emit deterministic `retailer-offers/v1` candidates;
- fail a malformed page/snapshot atomically or quarantine invalid records as
  specified by the approved contract—never publish a silently partial result.

If the provider supplies only HTML or an undocumented response format, STOP.
Do not turn this step into a scraper.

**Verify**:
`cd pc-quote-builder && npx vitest run ../scripts/lib/solotodoOfferAdapter.test.js`
→ success, malformed schema, missing fields, price conditions, timestamp,
duplicate, unavailable, and deterministic-order cases all pass.

### Step 6: Implement and measure a conservative identity crosswalk

Add a pure crosswalk spike with these precedence rules:

1. reviewed explicit SoloTodo product ID ↔ catalog ID mapping;
2. exact manufacturer part number with category and brand agreement;
3. exact provider-supported canonical identifier;
4. otherwise generate candidates for explicit human confirmation;
5. no fuzzy automatic link.

Record `matched`, `ambiguous`, `unmatched`, `conflicting`, and `removed`
separately. Manufacturer variants, capacity, memory size, OC edition, cooler
bundle, socket revision, PSU wattage, case size, and color must not be collapsed
when they affect the saleable SKU.

Evaluate correctness on sanitized, source-backed SoloTodo conformance fixtures
with explicit expected catalog IDs. Separately evaluate coverage on Plan 035's
private unlabeled corpus. Never treat the adapter's own result as expected truth.
Report:

- eligible required component rows;
- exact auto-linked rows;
- rows resolved after at most one explicit confirmation;
- ambiguous and unmatched rows;
- conformance false-positive links against explicit expected IDs;
- category and model-family breakdown;
- offers with usable price, retailer, conditions, availability, shipping, and
  timestamps;
- provider observation age distribution.

Proposed pilot thresholds, requiring owner approval before they become gates:

- 100% pass on source-backed identity conformance fixtures and zero
  false-positive auto-links in that suite;
- at least 98% source-backed conformance precision for any exact auto-link
  method once the suite is large enough to make that rate meaningful;
- at least 80% of required rows resolved exactly or after one confirmation,
  measured as coverage on the private real-input corpus and matching the
  Milestone 2 product outcome;
- no “current” price claim without a supportable provider/source timestamp or
  explicitly labeled observation time;
- every published offer retains provider, retailer, source URL, and conditions.

Low coverage is a finding, not a reason to loosen matching.

**Verify**:
the evaluation is deterministic, reports integer numerators/denominators,
automatically lists synthetic/source-backed failing case IDs, and never exposes
raw personal quote data. Ambiguous real-input rows remain coverage outcomes,
not correctness labels.

### Step 7: Exercise operational, security, privacy, and failure paths

Before recommending production:

- model authentication and secret rotation without putting secrets in client
  bundles, logs, artifacts, or git;
- determine whether GitHub Actions and a static Pages artifact comply with the
  agreement;
- measure request volume, payload size, refresh duration, rate-limit headroom,
  and estimated monthly cost using only approved test access;
- specify timeouts, bounded retries with jitter, conditional/incremental
  retrieval, and last-known-good retention;
- define maximum stale age from provider capability and user value, not from
  the existing 14-day specification schedule;
- ensure partial retrieval cannot overwrite a complete last-known-good
  snapshot;
- define revocation, correction, product removal, retailer removal, and license
  termination procedures;
- verify logs and derived metrics contain no user quote contents or contact
  information;
- define alert ownership for failed refresh, schema drift, freshness breach,
  coverage regression, and access revocation.

Test at least: authentication failure, 429, timeout, 5xx, schema version change,
empty success response, partial page, duplicate offer, price change during
pagination, missing timestamp, revoked product, retailer URL change, and
provider outage.

**Verify**: each failure has a bounded retry/abort policy and an explicit
last-known-good/user-facing state. None corrupts the specification catalog.

### Step 8: Record the go/no-go decision and create the production plan

The owner records exactly one decision from the automated evidence and
permission matrix:

- `GO — licensed feed/API`: access and redistribution support the target
  contract; create a new production implementation plan.
- `CONSTRAINED GO — link/deep-link only`: data cannot be republished, but an
  attributed outbound SoloTodo lookup is allowed and useful; create a smaller
  link-integration plan.
- `NO-GO`: legal, technical, identity, coverage, neutrality, reliability, or
  cost thresholds fail; document the reason and reassessment trigger.
- `PENDING`: response or terms remain incomplete; record the next follow-up
  date and do not implement.

The production plan, if authorized, must separately cover:

- authenticated acquisition and secret management;
- provider-specific raw storage and retention;
- pure normalization and crosswalk artifacts;
- artifact publication only within licensed boundaries;
- runtime lazy loading and independent readiness/error states;
- visible SoloTodo attribution, retailer verification, price conditions, and
  freshness;
- launch gates, monitoring, rollback, provider exit, and data deletion;
- whether value analysis remains deferred or gets its own governed plan;
- workflow cadence and all CI/artifact/post-build verification.

Do not mark this plan `DONE` merely because an inquiry was sent. It is complete
only when the permission matrix, contract, permitted spike, measured evaluation,
and explicit decision are recorded—or when a documented `NO-GO` conclusively
ends the qualification.

## Test plan

### Documentary and governance tests

- All public claims have official links and review dates.
- Unverified popularity/update claims remain hypotheses.
- Permission matrix has no implicit or blank authorization.
- Source, credential, correction, incident, commercial, and exit owners are
  named.
- Confidential data and credentials are absent from git.

### Contract and adapter tests

- Valid offer with effective and regular CLP prices.
- Cash/transfer, card, and coupon conditions remain distinguishable.
- Unknown shipping/stock/warranty stays unknown.
- Missing provider timestamp is not replaced by `observedAt`.
- Invalid prices, currencies, IDs, URLs, timestamps, and schema versions fail
  safely.
- Duplicate and conflicting offers are deterministic and visible.
- Removed/unavailable products do not appear available.
- Output ordering is deterministic and inputs are immutable.

### Identity tests

- Exact reviewed mapping and exact MPN mapping.
- Same family with different VRAM, capacity, socket, wattage, edition, bundle,
  or form factor does not auto-link.
- Normalization may propose candidates but never confirms them.
- Ambiguous/unmatched/conflicting states survive serialization.
- Every auto-link in the gold set is reviewable and attributable.

### Operational tests

- 401/403, 429, timeout, 5xx, empty payload, partial pagination, and schema drift.
- Last-known-good preservation and stale-state transition.
- Rate-limit and retry bounds.
- Credential redaction from logs/errors.
- Provider outage does not affect technical catalog loading or user quote
  prices.

## Done criteria

- [ ] `docs/data-sources/solotodo.md` records official evidence, hypotheses,
  owners, permission matrix, and decision state.
- [ ] An owner-approved inquiry has been sent, or a documented owner decision
  explains why outreach is not appropriate.
- [ ] Automated access, caching, transformation, display, redistribution,
  retention, attribution, and correction rights are explicit.
- [ ] `retailer-offers/v1` preserves identity, retailer, price conditions,
  availability, shipping, warranty, provenance, and both timestamp meanings.
- [ ] SoloTodo remains separate from specification/compatibility authority.
- [ ] Any adapter work uses only authorized sanitized fixtures and contains no
  network client.
- [ ] Exact/ambiguous/unmatched correctness passes source-backed conformance;
  real-input coverage is measured separately without loosening identity rules.
- [ ] Popularity and real-time freshness are not claimed without evidence.
- [ ] Provider failure degrades only price/value evidence.
- [ ] Commercial terms cannot influence recommendations or retailer order.
- [ ] Operating cost, rate limits, refresh behavior, revocation, and provider
  exit are documented.
- [ ] A `GO`, `CONSTRAINED GO`, `NO-GO`, or `PENDING` decision is explicit.
- [ ] Any production integration is deferred to a newly reviewed plan.
- [ ] Applicable focused tests, `npm run check`, and `git diff --check` pass.
- [ ] `plans/README.md` reflects the final status and follow-up dependency.

## STOP conditions

Stop and report if:

- automated access, fixtures, caching, display, or redistribution needed for
  the current phase is prohibited or remains ambiguous;
- the only feasible implementation requires scraping public HTML or using an
  undocumented/private endpoint;
- someone asks to infer permission from `robots.txt`, browser behavior, or the
  existence of SoloTodo's Chrome extension;
- exact product identity cannot be preserved without fuzzy auto-matching;
- the provider schema cannot distinguish price conditions or timestamps well
  enough for honest labels;
- a proposed public static artifact would exceed licensed redistribution;
- provider credentials would have to ship to the browser or enter git;
- commercial terms require undisclosed preference, exclusive ranking, or
  recommendation bias;
- the source cannot be disabled without breaking the technical catalog;
- test access would send real user quotations or personal data;
- production acquisition, workflow, UI, or deployment is requested without the
  Step 8 owner decision and follow-up plan;
- concurrent changes overlap the governed data contract and ownership is
  unclear.

## Maintenance notes

Re-verify the terms, API/feed documentation, permission matrix, attribution,
schema version, rate limits, prices, and owner contacts at every agreement
renewal and before any material use change. A working integration does not
preserve permission indefinitely.

SoloTodo should remain replaceable behind the provider-neutral contract.
Provider concentration is acceptable for an early Chilean discovery pilot only
if the application remains functional without it and provenance stays visible.
Future direct-retailer sources should coexist as independent evidence, not be
silently overwritten by SoloTodo.

If the provider later exposes better timestamps, availability, shipping,
payment, warranty, or history, amend the contract and validation fixtures
before using those fields in conclusions. If the provider withdraws access,
disable acquisition, honor deletion/retention obligations, retain only what the
agreement permits, and show price evidence as unavailable rather than stale but
apparently current.
