# cotiza-pc Product Vision Red-Team Audit

**Audit date:** 2026-07-30  
**Repository commit reviewed:** `2b3b536`  
**Primary document:** [`PRODUCT_VISION.md`](PRODUCT_VISION.md)  
**Audit posture:** Treat the vision as a proposed strategic foundation, not approved truth.

## Reconciliation status

On 2026-07-30, the project owner directed that the product prioritize organic traffic before considering monetization. The canonical vision was amended in response to this audit with:

- A working Chile-first desktop gaming Quote Analyzer beachhead
- An explicit Quote Analyzer → supporting Expert Builder → later Guided Builder sequence
- A decision/evidence contract and data operating principles
- An organic-search strategy tied to qualified product activation rather than page views
- Outcome-based milestones for search readiness, product reliability, organic validation, and organic scale
- Monetization deferred to an optional final milestone that requires explicit owner acknowledgement

This audit remains a point-in-time record of the weaknesses found in the prior vision. Its original monetization recommendations are superseded where they conflict with the owner’s decision: monetization research is now **Later**, after sustained organic product success, rather than a P1 activity.

| Audit gap | Reconciled canonical section |
|---|---|
| No beachhead or sequence | “Current strategic focus and beachhead”; “Current product sequence and MVP boundary” |
| Recommendation epistemology unspecified | “Decision and evidence contract” |
| Data strategy absent | “Data strategy and operating model” |
| Growth model absent | “Organic growth and distribution strategy” |
| Monetization timing unresolved | “Business-model sequencing” |
| No metrics, gates, or kill criteria | “Milestones and decision gates” |

## Evidence conventions

This audit distinguishes:

- **Document claim:** language stated in `PRODUCT_VISION.md`.
- **Repository fact:** behavior or data observed in the reviewed repository.
- **External evidence:** a current public claim from a competitor or market participant; these claims were not independently verified.
- **Audit inference:** a conclusion drawn from the available evidence.
- **Recommendation:** a proposed leadership decision or correction.

No source changes were made during the audit. The repository verification gate passed:

```text
npm run check
17 test files passed
464 tests passed, 30 todo
lint passed
disposable production build passed
```

## 1. Executive verdict

`PRODUCT_VISION.md` is a strong product-principles document and a weak product-strategy document.

It clearly states the desired product category, establishes an unusually good uncertainty taxonomy, and rejects opaque or commercially biased recommendations. But it does not choose a beachhead, define an MVP, specify the information and recommendation system required to fulfill the promise, establish a business or growth model, or provide measurable evidence thresholds.

### Governance verdict

**No — it is not yet strong enough to serve as the repository’s highest-authority product document.**

It can govern how recommendations should behave, but not what should be built first, which users take priority, which claims may safely be made, or when the strategy should be abandoned. Granting it constitutional authority in [“Authority and purpose”](PRODUCT_VISION.md#authority-and-purpose) therefore creates false certainty: teams must obey a document that leaves the most consequential choices unresolved.

### Three most important strengths

1. **A sharp category thesis.** “Help users decide whether a PC configuration is actually worth buying” is materially better than describing another parts picker. The distinction is explicit in [the central product distinction](PRODUCT_VISION.md#authority-and-purpose).

2. **A defensible epistemic standard.** The required separation between confirmed incompatibility, potential problems, suboptimality, missing data, and validity is excellent and specific. See [“Expert Builder”](PRODUCT_VISION.md#expert-builder) and [“Conflict-resolution rules”](PRODUCT_VISION.md#conflict-resolution-rules).

3. **Trust is treated as product behavior.** Traceable evidence, reproducibility, freshness, commercial disclosure, and willingness to say “insufficient information” are correctly positioned as core capabilities rather than disclaimers. See [“Trust and explainability”](PRODUCT_VISION.md#trust-and-explainability).

### Three most dangerous weaknesses

1. **No initial market or product choice.** “Anyone” across gaming, office, servers, development, data analysis, video, virtualization, and ML is not a segment. Three major product experiences are declared without sequence or exclusions.

2. **The data promise is disconnected from a data strategy.** The vision promises Chile-relevant price, stock, shipping, warranty, performance, workload, fit, connector, BIOS, and upgrade-path intelligence, but specifies no sources, ownership, SLA, validation, licensing, operating cost, or supported-coverage threshold.

3. **No venture model exists.** There is no evidence plan, growth model, monetization hypothesis, success metric, unit economics, milestone, or kill criterion. The document cannot answer whether this deserves to be a standalone business.

### Confidence

**High confidence** in the document and repository findings; **medium confidence** in the market verdict.

Evidence limitations:

- No user interviews, analytics, conversion data, revenue, cost model, or support logs were available.
- No independently verified market-size study was found.
- Competitor observations are based on current public claims, not hands-on quality benchmarking.
- Current generated catalog artifacts were inspected, but source accuracy was not independently checked against manufacturers.
- This is not a legal opinion on dataset licensing, scraping, privacy, or affiliate disclosure.

## 2. Vision scorecard

| Area | Score | Justification |
|---|---:|---|
| Problem clarity | 3 | The document names concrete purchase questions, but provides no evidence of incidence, severity, frequency, current coping behavior, or willingness to switch. **A 5 requires** a validated problem statement tied to a specific purchase event and segment. |
| Target-user focus | 1 | Beginners, experts, quote recipients, upgraders, technicians, stores, enthusiasts, and many workload types are included without priority. **A 5 requires** one beachhead, explicit exclusions, and a sequenced expansion thesis. |
| Value proposition | 3 | “Explainable purchasing recommendation” is compelling, but “best defensible configuration” has no operational definition or minimum evidence standard. **A 5 requires** a measurable outcome, supported claim boundary, and demonstrated superiority over alternatives. |
| Differentiation | 2 | Quote evaluation is promising, but the PCPartPicker contrast is a slogan rather than a competitive analysis. Chilean competitors publicly claim guided/manual building, compatibility, local pricing, freshness, and upgrades. **A 5 requires** a capability competitors cannot cheaply reproduce and proof users value it. |
| Product coherence | 2 | Shared assessment principles connect the experiences, but the user handoffs, ownership of intent, and experience hierarchy are unresolved. **A 5 requires** one coherent lifecycle with clear entry, transition, and exit rules. |
| Data strategy | 1 | Desired fields are listed, but sources, SLAs, rights, conflict handling, coverage, ownership, and failure operations are absent. **A 5 requires** a governed data portfolio with measured coverage, provenance, freshness, licensing, incident response, and cost. |
| Trust and explainability | 3 | The principles are strong and unusually explicit. They stop short of a versioned evidence schema, calibration process, audit procedure, correction mechanism, or reliability target. **A 5 requires** those mechanisms and demonstrated user comprehension. |
| Technical feasibility | 2 | Deterministic compatibility and provenance are feasible; workload suitability, price reasonableness, performance balance, and upgradeability are much harder. Current inputs do not support much of the promise. **A 5 requires** scoped claims, architecture, data contracts, benchmarks, test corpora, and operating estimates. |
| Scope discipline | 1 | The vision combines catalog, builder, analyzer, recommendation engine, price platform, collaboration, education, marketplace, and professional SaaS. **A 5 requires** a narrow MVP and explicit deferral list. |
| Business model | 0 | Commercial bias is discussed, but who pays, for what, at what stage, and under what economics is entirely absent. **A 5 requires** a tested payer/value hypothesis, economics, and neutrality controls. |
| Growth model | 0 | There is no acquisition, activation, retention, referral, creator, SEO, or distribution thesis. **A 5 requires** tested channels and at least one credible compounding loop. |
| Measurability | 0 | No north star, quality threshold, trust metric, milestone, experiment, or kill criterion exists. **A 5 requires** a falsifiable measurement framework and governance cadence. |
| Strategic defensibility | 1 | Explainability could become defensible through proprietary regional quote/outcome data, but the document does not define that flywheel. **A 5 requires** a compounding data, trust, distribution, or workflow advantage demonstrated in market. |

## 3. Critical findings

### Finding 1 — The “constitution” does not make the decisions a constitution must govern

- **Evidence from the document:** It claims authority over “monetization ideas, roadmap priorities [and] architectural decisions” in [“Authority and purpose”](PRODUCT_VISION.md#authority-and-purpose), while [“Product vision”](PRODUCT_VISION.md#product-vision) targets “anyone” and [“Main user experiences”](PRODUCT_VISION.md#main-user-experiences) declares three major experiences without choosing among them.
- **Why it matters:** A team cannot resolve a conflict between Quote Analyzer and Guided Builder investment, gaming and workstation data, or Chilean depth and global breadth from this document. The mandatory checklist can reject weak proposals, but cannot rank two strong proposals.
- **Role lenses:** CEO, PO, PM, CTO
- **Severity:** Critical
- **Confidence:** High
- **Recommended correction:** Add an explicit strategic sequence: initial segment, primary job, first experience, supported claims, MVP exclusions, expansion gates, and kill criteria.
- **Cost or trade-off:** Leadership must reject attractive use cases and tolerate a visibly narrower ambition for 6–12 months.
- **Decision owner:** CEO
- **Time horizon:** Now

### Finding 2 — The data promise is currently infeasible without a new operating model

- **Evidence from the document:** Compatibility promises include fit, cooler clearance, connectors, radiator support, BIOS, ports, and expansion slots in [“Compatibility”](PRODUCT_VISION.md#compatibility). Price intelligence adds store, stock, shipping, payment conditions, history, matching confidence, and warranty in [“Price intelligence”](PRODUCT_VISION.md#price-intelligence). No source, SLA, owner, licensing rule, or coverage boundary follows.
- **Repository fact:** The current artifact records pinned BuildCores and PC Part sources, while DBGPU contributed zero items; it contains no retailer-price feed ([current metadata](../pc-quote-builder/public/data/compatibility.min.json)). A read-only audit of the current JSON found:
  - 0/961 CPUs with explicit socket or memory-support data;
  - 0/4,956 motherboards with explicit memory type;
  - 0/2,128 PSUs with connector data;
  - 0/4,211 cases with GPU-length or cooler-height data;
  - only 315/3,869 GPUs with TDP and 236 with connector data.
- **Repository fact:** The frontend compensates with narrow model-name and socket inference rules ([`catalogHelpers.js`](../pc-quote-builder/src/lib/catalogHelpers.js#L26)), which is useful fallback behavior but not verified product evidence.
- **Why it matters:** The product can render many “unknown” states, but cannot credibly deliver the central purchase recommendation. Building UI before establishing information coverage will produce an explainable engine that mostly explains why it cannot decide.
- **Role lenses:** CIO, CTO, CEO, PM
- **Severity:** Critical
- **Confidence:** High
- **Recommended correction:** Define separate governed datasets for product identity/specifications, compatibility relations, benchmarks, Chilean offers, retailer quality, and user-supplied quotes. For every claim, set required fields, provenance, freshness SLA, minimum coverage, conflict policy, license/attribution requirements, and an accountable owner.
- **Cost or trade-off:** High recurring data-operations cost; narrower catalog coverage; potential need for retailer partnerships or licensed data.
- **Decision owner:** CIO
- **Time horizon:** Now

### Finding 3 — “Decision intelligence” is a list of desired conclusions, not a recommendation system specification

- **Evidence from the document:** [“Performance balance”](PRODUCT_VISION.md#performance-balance), [“Value for money”](PRODUCT_VISION.md#value-for-money), and [“Upgradeability”](PRODUCT_VISION.md#upgradeability) describe what should be detected but not how evidence becomes a conclusion.
- **Repository fact:** Current CPU tiers depend only on core count and boost clock; GPU tiers depend only on TDP or VRAM ([`compiler.js`](../scripts/lib/compiler.js#L9)). PSU sizing uses TDP plus fixed buffers ([`PSU_HEURISTICS.md`](../pc-quote-builder/PSU_HEURISTICS.md)).
- **Why it matters:** “Bottleneck,” “good value,” “quiet,” “durable,” and “good upgrade path” are not interchangeable deterministic facts. Without definitions, evidence grades, validation corpora, and calibration, teams will encode subjective opinions as authoritative output.
- **Role lenses:** CTO, PO, CIO
- **Severity:** Critical
- **Confidence:** High
- **Recommended correction:** Introduce a versioned decision contract defining each dimension as deterministic, derived, heuristic, probabilistic, subjective, or unsupported. State required inputs, output semantics, counterexamples, confidence, explanation, reproducibility, and validation method.
- **Cost or trade-off:** Some attractive claims must be removed until benchmark or market evidence exists. Domain-expert review becomes a recurring cost.
- **Decision owner:** CTO
- **Time horizon:** Now

### Finding 4 — The differentiation claim is already close to local competitive parity

- **Evidence from the document:** The strategy is summarized as “PCPartPicker helps users assemble a PC. cotiza-pc helps users decide whether they should buy it” in [“Strategic differentiator”](PRODUCT_VISION.md#strategic-differentiator). No alternative map or defensibility mechanism is provided.
- **External evidence:** ArmaTuPC publicly claims a manual builder, guided budget/use recommendations, Chilean retail prices, compatibility explanations, 48-hour freshness, upgrade suggestions, accounts, alerts, community builds, and guides. Tamblaze publicly claims compatibility, recommendations, Chilean price aggregation across 380 stores, and multi-store purchase optimization. These are competitor claims, not independently verified product-quality findings. [ArmaTuPC](https://www.armatupc.cl/), [Tamblaze](https://tamblaze.cl/).
- **Why it matters:** Compatibility, guided building, local prices, alerts, and community content cannot be treated as a unique wedge. Even explainability is becoming table stakes. A broad “better decision” promise is easy to imitate in marketing.
- **Role lenses:** CEO, PM, Growth
- **Severity:** High
- **Confidence:** High on positioning overlap; medium on competitors’ execution quality
- **Recommended correction:** Make independent quote diagnosis the wedge: accept a third-party quote, resolve identity conservatively, expose evidence and uncertainty, identify the most consequential change, and retain an auditable decision record. Validate that competitors do not already solve this satisfactorily.
- **Cost or trade-off:** This reduces the initial relevance of the builder and may make acquisition dependent on quote-import quality.
- **Decision owner:** CEO
- **Time horizon:** Now

### Finding 5 — The vision contains no mechanism for proving or falsifying itself

- **Evidence from the document:** The [mandatory product-decision checklist](PRODUCT_VISION.md#mandatory-product-decision-checklist) asks how a feature will be tested, but the vision itself defines no outcome metric, benchmark, experiment, milestone, or kill rule.
- **Why it matters:** The project can continue adding technically correct dimensions without learning whether users trust them, change purchase decisions, or prefer the product to forums, creators, retailers, spreadsheets, or AI assistants.
- **Role lenses:** CEO, PM, Growth, PO
- **Severity:** Critical
- **Confidence:** High
- **Recommended correction:** Add a north star, activation and retention definitions, quality guardrails, data SLAs, expert-evaluation benchmarks, three validation experiments, and explicit expansion/kill thresholds.
- **Cost or trade-off:** Instrumentation, research, and manual expert review compete with feature delivery.
- **Decision owner:** PM
- **Time horizon:** Now

### Finding 6 — Commercial neutrality is a principle without a business model or enforcement mechanism

- **Evidence from the document:** Recommendations must not be “secretly ordered” by affiliate or retailer relationships, and commercial links must be disclosed in [“Trust and explainability”](PRODUCT_VISION.md#trust-and-explainability). The document never states who pays or how ranking independence is technically and organizationally enforced.
- **Why it matters:** Affiliate revenue rewards purchase clicks and retailer conversion, while the user may need advice to wait, buy used, keep an existing part, or reject every available offer. Disclosure alone does not eliminate this conflict.
- **Role lenses:** CEO, CIO, PM, Growth
- **Severity:** High
- **Confidence:** High
- **Recommended correction:** Choose an initial revenue hypothesis and publish a commercial-influence policy: ranking inputs, prohibited signals, separation of sponsored inventory, audit logging, disclosure standards, and conflict ownership.
- **Cost or trade-off:** The safest models—consumer payment, monitoring, or independent professional reports—may monetize more slowly than affiliate links.
- **Decision owner:** CEO
- **Time horizon:** Next

### Finding 7 — There is no growth thesis, and the natural usage frequency is low

- **Evidence from the document:** [“Sharing and comparison”](PRODUCT_VISION.md#sharing-and-comparison) lists share links and saved quotes, while [“Long-term positioning”](PRODUCT_VISION.md#long-term-positioning) names multiple stakeholder groups. Neither section explains discovery, conversion, retention, referral, or distribution.
- **Why it matters:** Most consumers buy or materially upgrade infrequently. A useful one-time analyzer does not automatically become a durable audience or standalone business.
- **Role lenses:** Growth, CEO, PM
- **Severity:** High
- **Confidence:** High
- **Recommended correction:** Treat repeated usage during a 2–6 week purchase window, scenario comparison, changed-price/evidence alerts, and shareable second opinions as the initial retention/referral model. Validate creator/community distribution before investing in broad programmatic SEO.
- **Cost or trade-off:** Price/evidence monitoring and durable links require backend state and notification infrastructure.
- **Decision owner:** Growth
- **Time horizon:** Next

### Finding 8 — The scope is at least seven products disguised as one vision

- **Evidence from the document:** It combines three primary experiences, six-plus assessment systems, price optimization, saving/comparison/sharing/export, upgrade analysis, professional quoting/CRM/inventory, and a community knowledge base across [“Main user experiences”](PRODUCT_VISION.md#main-user-experiences), [“Decision intelligence”](PRODUCT_VISION.md#decision-intelligence), [“Sharing and comparison”](PRODUCT_VISION.md#sharing-and-comparison), and [“Long-term positioning”](PRODUCT_VISION.md#long-term-positioning).
- **Why it matters:** Each area has different data, UX, reliability, operations, and monetization requirements. Attempting them simultaneously will produce shallow coverage and erode the very trust differentiation the vision values.
- **Role lenses:** CEO, CTO, PM, PO
- **Severity:** High
- **Confidence:** High
- **Recommended correction:** Classify capabilities as Now, Next, Later, or Explicitly excluded. Require evidence gates before moving a capability forward.
- **Cost or trade-off:** Roadmap ambition becomes visibly smaller; some existing code may remain supporting infrastructure rather than the primary product.
- **Decision owner:** CEO
- **Time horizon:** Now

### Finding 9 — The named workflows conflict with both each other and the implementation

- **Evidence from the document:** Guided Builder starts with use, budget, workload, performance target, priorities, and existing parts in [its definition](PRODUCT_VISION.md#guided-builder). Expert Builder provides manual control in [its definition](PRODUCT_VISION.md#expert-builder).
- **Repository fact:** The current UI calls a six-component manual stepper “Builder guiado” ([`App.jsx`](../pc-quote-builder/src/App.jsx#L1066)); its stored model contains component IDs and an integrated-GPU flag, not intent, budget, or workload ([`App.jsx`](../pc-quote-builder/src/App.jsx#L21)). Quote import persists rows but does not analyze them ([`App.jsx`](../pc-quote-builder/src/App.jsx#L736)).
- **Why it matters:** Naming the existing picker “guided” creates a product-contract violation and obscures where the real Guided Builder work begins. It also risks duplicating logic when separate experiences are built.
- **Role lenses:** PO, PM, CTO
- **Severity:** High
- **Confidence:** High
- **Recommended correction:** Rename the current experience as the Expert/Manual Builder baseline. Make Quote Analyzer the first consumer of a shared assessment contract. Build intent-first guidance only after the recommendation model and initial segment are validated.
- **Cost or trade-off:** Marketing language and navigation must acknowledge that the promised Guided Builder is not shipped.
- **Decision owner:** PO
- **Time horizon:** Now

### Finding 10 — Operating continuity, legal obligations, and staffing are omitted

- **Evidence from the document:** The product intends to be a “neutral layer between consumers, component data, retailers, technicians, and PC builders” in [“Long-term positioning”](PRODUCT_VISION.md#long-term-positioning), but does not address contracts, rights, attribution, privacy, deletion, incident correction, retailer complaints, or staffing.
- **Repository fact:** BuildCores data uses an attribution license and warns that other content rights may need clearance ([local upstream license](../data/raw/buildcores-open-db/LICENSE.txt)). The scheduled pipeline currently refreshes pinned upstream snapshots rather than continually discovering current products ([`download_pc_datasets.py`](../scripts/download_pc_datasets.py#L43)).
- **Why it matters:** Retail pricing, accounts, alerts, quote uploads, and public links introduce legal, privacy, abuse, takedown, and operational obligations that a static SPA does not currently have.
- **Role lenses:** CIO, CEO, CTO
- **Severity:** High
- **Confidence:** High
- **Recommended correction:** Add an operating-model section covering data rights, attribution, privacy classes, retention/deletion, source failure, correction SLAs, incident ownership, required roles, and cost envelopes.
- **Cost or trade-off:** Legal review and operational discipline slow expansion and may rule out apparently convenient data sources.
- **Decision owner:** CIO
- **Time horizon:** Next

## 4. Contradictions and unresolved tensions

| Tension | Conflict | Leadership decision required |
|---|---|---|
| Beginner simplicity vs expert control | The vision requires both minimal cognitive load and full evidence/override detail. | Decide that these are separate interfaces sharing one assessment contract. Do not make one adaptive screen responsible for both. |
| Neutral advice vs monetization | Affiliate conversion may reward buying when the best advice is to wait, reuse, or reject. | Decide which revenue signals are prohibited from recommendation computation and whether consumer payment is tested before affiliate revenue. |
| Broad catalog vs data quality | Thousands of products increase apparent coverage while key compatibility fields are absent. | Decide that supported coverage is defined by evidence completeness, not item count; quarantine or label unsupported products. |
| Confidence vs incomplete evidence | The promise suggests decisive guidance while the data often cannot verify basic fit/connectors. | Decide the minimum evidence needed for a “decision-ready” verdict and when the only valid output is “insufficient information.” |
| Fast shipping vs rigorous logic | UI features are cheaper than benchmark, validation, and expert-review infrastructure. | Decide that new recommendation dimensions cannot ship without a validated rule/evidence contract and reference fixtures. |
| Chile-first depth vs international breadth | CLP and Chilean retail create relevance, but the vision says “anyone” and supports many workloads/currencies. | Decide whether Chilean desktop gaming purchases are the initial market. If yes, internationalization is a later expansion gate, not a parallel requirement. |
| One-time evaluation vs retention | Quote analysis solves an episodic job; accounts and content do not automatically create repeat use. | Decide whether the business optimizes for high-value episodic decisions and referrals, or expands into ongoing price/upgrade monitoring. |
| Product breadth vs MVP focus | Analyzer, guided builder, manual builder, price tracker, marketplace, content, and pro tooling compete for the same capacity. | Choose one first product experience and freeze the others behind measurable expansion gates. |
| Determinism vs workload subjectivity | Socket compatibility can be deterministic; “good for ML,” “quiet,” or “good value” requires benchmarks and preference weights. | Require dimension-specific evidence classes instead of one generic recommendation mechanism. |
| Consumer neutrality vs store tooling | Stores may pay for quoting tools while also being the subject of quote criticism. | Decide whether consumer evaluation and retailer SaaS share ownership/data or operate behind a formal conflict firewall. |

## 5. Missing decisions

### Blocking

1. **Which single user segment is the initial beachhead?**
2. **Is Quote Analyzer, Guided Builder, or Expert Builder the first primary experience?**
3. **Which use case is supported first: gaming, general office, development, content creation, or another workload?**
4. **Is Chile the initial market, and what does “Chile-first” require beyond CLP?**
5. **What exact claims may MVP make, and which must remain unsupported?**
6. **What component categories are mandatory for a quote to be considered complete?**
7. **What evidence threshold permits “valid,” “good value,” “balanced,” or “recommended”?**
8. **Which recommendation dimensions are deterministic, heuristic, subjective, or deferred?**
9. **What data sources and licenses are approved for each product claim?**
10. **What minimum field coverage and freshness SLA define a supported product or price?**
11. **What is the canonical input/output and versioning contract for assessments?**
12. **What outcome metric and kill threshold determine whether the initial product continues?**
13. **Who owns final decisions about compatibility rules, performance evidence, data conflicts, and corrections?**

### Important

1. **How does an imported text row become a confirmed product identity without silent fuzzy matching?**
2. **How are conflicts between manufacturer, upstream dataset, retailer, and user-entered data resolved?**
3. **How are recommendation rule versions preserved when a saved quote is revisited?**
4. **What is the correction and appeal process when a recommendation is wrong?**
5. **What ranking signals are prohibited under the neutrality policy?**
6. **What commercial model will be tested first, and what product remains free?**
7. **What is the retention window appropriate to a PC purchase cycle?**
8. **Which channel receives the first concentrated acquisition investment?**
9. **What privacy, retention, deletion, and public-sharing rules apply to uploaded quotes?**
10. **What staffing and operating cost can the project sustain for data maintenance and domain review?**
11. **Does the product assess complete PCs, upgrades, used parts, or only new component builds initially?**
12. **What regional retailer and warranty distinctions affect a price comparison?**

### Deferred

1. **Should a transparent summary score ever be added?**
2. **Should technicians or stores receive CRM, branded exports, and inventory integration?**
3. **Should the product expose an API or public knowledge base?**
4. **Should international currencies and retailer markets be supported?**
5. **Should community builds, creator profiles, or public leaderboards exist?**
6. **Should AI assist with OCR or product matching after deterministic confirmation paths are proven?**

## 6. Assumption register

| Assumption | Evidence currently available | Risk if false | Cheapest validation method | Success threshold |
|---|---|---|---|---|
| Buyers experience significant uncertainty after receiving a PC quote | The document asserts it; current forum/search results show recurring quote questions, but no project user research | The primary problem is too weak or already solved informally | Interview 20 Chilean buyers who bought or considered a desktop PC in the last 90 days | ≥12 report seeking a second opinion; ≥8 describe a costly or consequential uncertainty |
| Quote recipients are a better beachhead than blank-slate builders | Vision calls Quote Analyzer a central differentiator; existing app already imports structured quotes | Analyzer acquisition or input friction may be worse than builder demand | Concierge-test 30 quote analyses and 30 guided-build requests using matched acquisition channels | Analyzer has higher completion and decision-action rate by ≥15 percentage points |
| Users can provide enough product identity to analyze a quote | Current import supports text and `itemId`; third-party quotes will rarely contain cotiza-pc IDs | Most quotes remain ambiguous, making the result mostly unknown | Collect 100 real anonymized quotes and attempt conservative manual resolution | ≥80% of required components resolve exactly or after one user confirmation |
| Explainability materially increases trust | Strong document claim; no comprehension or trust data | Explanations add complexity without changing decisions | Test concise verdict vs verdict plus evidence cards with 30 users | Evidence version improves correct comprehension by ≥20% without >25% completion loss |
| Chilean price intelligence is a meaningful wedge | CLP is the implementation default; local competitors emphasize Chilean prices | Price aggregation is expensive and already commoditized | Landing-page and interview test comparing “independent quote diagnosis” against “lowest Chile price” | Diagnosis wins stated preference among target users by ≥20%, or price becomes a required table-stakes dependency |
| Reliable Chilean price data can be maintained economically | No current retailer feed; competitors publicly claim significant coverage | Price promise becomes operationally unaffordable | Integrate or manually track 100 high-demand SKUs across 5 retailers for four weeks | ≥90% identity precision; ≥90% offers refreshed within 48 hours; cost within approved unit economics |
| Current spec datasets can support core compatibility | Provenance exists, but critical fields have very low explicit coverage | Product returns excessive unknowns or false confidence | Measure evidence completeness for the 200 most-purchased Chilean SKUs | ≥95% socket/memory; ≥90% case/GPU fit; ≥90% PSU connector coverage before claiming those dimensions |
| Simple tiers can approximate workload balance | Current tiers use cores/boost and TDP/VRAM only | “Balanced” recommendations are misleading | Blind-test tier verdicts against two independent domain experts on 100 builds | ≥85% agreement on coarse gaming balance and zero dangerous high-confidence disagreements |
| Users will act on the top recommended correction | Not currently measured | Analysis is informative but commercially irrelevant | Concierge reports with one ranked correction and follow-up after seven days | ≥40% change, reject, renegotiate, or explicitly retain the quote based on the report |
| Users will return during the purchase window | Sharing and revisit features are aspirational | Retention is too low for account or monitoring investment | Manual 14-day recheck reminder for saved quotes | ≥25% return to recheck, compare, or update the same purchase decision |
| Users will pay without compromising neutrality | No business-model evidence | Standalone business is not viable | Offer a free verdict and a CLP-priced 30-day monitoring/comparison upgrade | ≥5% of activated users purchase at a price covering marginal service cost |
| Community or creator distribution can acquire qualified users | No project distribution evidence; quote questions exist in communities | Acquisition remains expensive and episodic | Partner with 3 Chilean creators/communities using dedicated quote-analysis links | ≥10% visitor-to-start and ≥40% start-to-activation |
| Public sharing creates a referral loop | Vision proposes public links, but no loop is defined | Sharing becomes low-value export functionality | Generate manual shareable reports with tracked invitations | ≥15% of activated analyses are shared and ≥10% of recipients start their own analysis |
| Neutral recommendations can coexist with retailer relationships | Disclosure principle exists; no enforcement model | Trust collapses when commercial relationships appear | Show users two transparent monetization policies in interviews and test trust | ≥80% accept the chosen model; no material recommendation-preference shift when sponsorship disclosure is shown |

## 7. Recommended strategic focus

### Initial user segment

**Chile-based non-expert buyers who already have an itemized desktop gaming-PC quotation and expect to decide within 30 days.**

Why:

- The vision itself identifies quote evaluation as a “central differentiator” in [“Quote Analyzer”](PRODUCT_VISION.md#quote-analyzer).
- The user arrives with a concrete, high-stakes object to analyze.
- The current product already supports quote rows, prices, imports, and deterministic compatibility assessment.
- Gaming narrows workload evidence enough to construct a benchmark and validation corpus.

Main rejected alternative: **beginners starting from a blank budget.** That is a larger funnel, but it requires a trustworthy optimization engine, current price inventory, preference elicitation, no-result behavior, and generated alternatives before it can fulfill its promise.

### Primary job to be done

> Before I pay for this PC, tell me what can be verified, what could cost me money or performance, and the one to three changes I should question first.

This is narrower and more testable than “build the best PC.”

### First product experience

**Quote Analyzer.**

The Manual/Expert Builder should remain an editing and correction surface. Guided Builder should wait until the analyzer’s assessment and data contracts are validated.

### Narrowest defensible MVP

- Chilean desktop gaming quotes only.
- Six required categories initially: CPU, motherboard, RAM, GPU or confirmed integrated graphics, PSU, and case.
- User states budget, target resolution, games/performance expectation, and whether assembly/peripherals are included.
- Manual/CSV/JSON entry; ambiguous products require explicit user confirmation.
- Deterministic checks:
  - required-part completeness;
  - CPU/motherboard socket;
  - RAM/motherboard type and capacity where evidenced;
  - motherboard/case form factor;
  - GPU/case fit where evidenced;
  - PSU wattage and connectors where evidenced;
  - price completeness and quote timestamp.
- One validated gaming-balance model using licensed benchmark bands—not cores, TDP, or VRAM alone.
- Every finding includes evidence class, source, freshness, rule version, confidence, and next action.
- Output is a concise verdict plus the top three decision-changing findings.
- “Market price reasonableness” is shown only for products with current, identity-confirmed Chilean offer coverage.

### Capabilities to defer

- Automatic full-build generation.
- Non-gaming workloads.
- International pricing.
- Fuzzy or AI-only identity matching.
- OCR without user confirmation.
- Universal scores.
- Public community builds.
- Price history beyond the supported purchase window.
- Upgrade-path optimization.
- Accounts, CRM, store inventory, branded exports, and APIs.
- Retailer ranking based on reputation or commercial value.
- Full cooler, radiator, BIOS, acoustic, thermal, and durability judgments until data supports them.

### Most credible differentiation wedge

**An independent, auditable second opinion on a quote someone else wants the user to buy.**

The defensible asset is not the component catalog. It is the growing corpus connecting:

- real Chilean quotes;
- confirmed product identity;
- rule-versioned findings;
- expert corrections;
- user decisions;
- later price/evidence changes;
- discovered false positives and false negatives.

That corpus can improve calibration and trust in a way a static builder cannot.

### First realistic acquisition channel

**High-intent Chilean gaming communities and trusted local creators**, using “send us the quote before you pay” as the CTA.

This is preferable to immediate programmatic SEO because low-quality automated pages would undermine trust before data coverage is proven. SEO becomes credible after the product has reliable component, quote-pattern, and outcome evidence.

### First meaningful retention mechanism

**A 14–30 day saved-quote watch:** notify the user when a matched price, stock state, critical evidence item, or recommendation changes, and preserve exactly what changed.

Natural retention should be measured inside the purchase window, not as weekly perpetual engagement.

### Trust-compatible monetization hypothesis

Keep the core verdict free. Test a one-time paid **30-day decision pack** containing:

- quote monitoring;
- comparison of up to three alternatives;
- change history;
- downloadable evidence report;
- optional human verification for ambiguous high-impact findings.

No payment, affiliate rate, or sponsorship may affect the assessment or retailer ordering. The hypothesis should be rejected if willingness to pay cannot cover incremental data and review cost.

## 8. Measurement framework

### North-star metric

**Monthly evidence-qualified purchase decisions assisted.**

A decision counts only when:

1. required quote fields are complete;
2. required components are exact or user-confirmed;
3. every high-severity conclusion satisfies its evidence threshold;
4. the user views the verdict;
5. the user records a decision action: keep, change, reject, negotiate, compare, or defer.

### Input metrics

1. **Qualified activation rate:** target users who reach an evidence-qualified verdict.
2. **Median time to verdict:** from first quote input to verdict; target under seven minutes.
3. **Identity-resolution coverage:** required components resolved exactly or explicitly confirmed.
4. **Decision-action rate:** activated users recording a consequential next step.
5. **Purchase-window return/share rate:** users who recheck, compare, or share within 30 days.

### Quality and trust guardrails

- Confirmed dangerous incompatibility false-negative rate: **<1%**, with zero tolerated in the initial controlled pilot.
- High-severity recommendation reversal after expert audit: **<2%**.
- Identical input + data version + rule version produces identical result: **100%**.
- Recommendations with complete evidence/provenance/action fields: **100%**.
- Undisclosed sponsored or affiliate placements: **0**.
- User comprehension of verdict severity and uncertainty: **≥85%** in task testing.
- “Unknown” must never be counted as valid, compatible, or price-reasonable.

### Data freshness and recommendation reliability

- Supported Chilean offers refreshed within 48 hours: **≥90%**.
- Source pipeline successful within SLA: **≥99% of scheduled runs**.
- Products meeting required-field coverage for each claimed dimension: reported separately; unsupported items excluded from that claim.
- Exact or user-confirmed retailer-listing match precision: **≥98%**.
- Expert agreement on deterministic compatibility: **≥95%**.
- Expert agreement on the top gaming-balance concern: **≥80%** before public launch.
- Critical-source correction reflected in product output within the published correction SLA.

### Activation definition

A user activates when they:

- enter or import a quote;
- provide use, budget, and target-resolution context;
- resolve the six required component categories;
- receive and open the evidence-qualified verdict.

Creating a quote or viewing the landing page is not activation.

### Retention definition

A user is retained when, within 30 days of activation, they:

- revisit the same quote after a price/evidence change;
- analyze a competing quote;
- compare a modified scenario; or
- return from a shared report to continue the decision.

Annual hardware repurchase is not a useful early retention metric.

### Three cheap falsification experiments

1. **Concierge problem/value test**
   - Analyze 30 real Chilean gaming quotes manually using the proposed output.
   - Pass: ≥60% report the analysis changed or materially confirmed their decision; ≥40% act on a finding.
   - Kill/reframe: <30% see decision value.

2. **Accuracy and evidence test**
   - Build a blind corpus of 100 quotes reviewed by two independent experts.
   - Pass: ≥95% agreement on deterministic compatibility, ≥80% on the top red flag, and zero dangerous false negatives in the launch subset.
   - Stop public recommendation launch if the threshold is missed.

3. **Acquisition and payment test**
   - Send 200 qualified visitors from three creator/community placements to a concierge-backed analyzer.
   - Pass: ≥15% start, ≥40% of starters activate, ≥15% share, and ≥5% buy the decision pack.
   - If activation works but payment fails, treat the product as an audience/referral asset until another payer is validated.

## 9. Prioritized remediation plan

| Priority | Change | Why now | Owner | Dependency | Effort | Expected impact |
|---|---|---|---|---|---|---|
| P0 | Choose the Chilean quote-recipient beachhead, gaming use case, and Quote Analyzer as the initial experience—or explicitly reject that choice | Nothing else can be prioritized coherently | CEO | Owner decision | S | Removes the largest strategic ambiguity |
| P0 | Define supported MVP claims and explicit exclusions | Prevents unsupported recommendation promises | PO | Beachhead | M | Creates an enforceable product boundary |
| P0 | Define the versioned assessment/evidence contract | Required for reproducibility, UI, tests, and later builders | CTO | Supported claims | M | Establishes the core product architecture |
| P0 | Produce a data-source, coverage, freshness, licensing, and incident plan | Current data cannot support the vision’s central promises | CIO | Supported claims | L | Determines actual feasibility and operating cost |
| P0 | Add north star, reliability guardrails, experiments, expansion gates, and kill criteria | Prevents roadmap progress from substituting for product evidence | PM | Beachhead | M | Makes the vision falsifiable |
| P1 | Conduct the 30-quote concierge and 100-quote expert benchmark pilots | Validates pain, accuracy, and output usefulness before feature expansion | PM | Assessment contract | L | Tests problem–solution fit and technical credibility |
| P1 | Rename the current picker as Manual/Expert Builder and state that Guided Builder and Quote Analyzer are unshipped | Resolves implementation/vision misrepresentation | PO | Strategic sequence | S | Restores product-contract clarity |
| P1 | Create a competitive decision map covering local builders, price sites, forums, creators, and AI assistants | Current differentiation is not defensible | CEO/PM | Beachhead | M | Sharpens the wedge and refusal strategy |
| Superseded by owner decision | Defer monetization until the canonical organic-success milestone is achieved | Organic traffic and successful product use now precede business-model exploration | CEO/Growth | Milestone 4 and explicit owner acknowledgement | — | Preserves focus and trust during product validation |
| P1 | Define privacy, public-sharing, correction, attribution, and commercial-influence policies | Backend and retailer capabilities will introduce material risk | CIO | Data strategy | M | Reduces trust and compliance exposure |
| P1 | Estimate people, recurring data cost, infrastructure, and expert-review capacity for 12 months | The vision omits the operating burden | CEO/CTO/CIO | Data plan | M | Enables a real build-versus-buy decision |
| P2 | Design saved-quote monitoring and shareable reports as the first retention/referral loop | Appropriate only after core analysis is useful | Growth | Pilot success | M | Tests durability beyond one session |
| P2 | Develop SEO and structured content only from validated findings and supported data | Avoids premature low-trust programmatic content | Growth | Data reliability | L | Builds compounding discovery safely |
| P2 | Reframe professional/store tooling as a separately gated business line | Avoids contaminating consumer neutrality | CEO | Consumer proof | S | Preserves focus and trust |
| P2 | Add amendment versioning, decision records, review cadence, and evidence expiration | Current governance says how to amend but not when to revisit assumptions | PO | Revised vision | S | Keeps authority evidence-responsive |

## 10. Proposed document changes

A full rewrite is unnecessary. The trust taxonomy, assessment dimensions, conflict rules, and mandatory checklist should be preserved. Surgical restructuring is sufficient.

### Structural changes

| Change | Classification | Action |
|---|---|---|
| Replace the opening product scope and core promise | **Required** | Narrow the initial market and separate near-term strategy from long-term ambition |
| Add “Validated problem and beachhead” | **Required** | State the initial segment, purchase event, problem evidence, and exclusions |
| Add “Strategic sequence and MVP boundary” | **Required** | Put Quote Analyzer, Manual Builder, and Guided Builder into Now/Next/Later |
| Split “Decision intelligence” into claim types and evidence requirements | **Required** | Distinguish deterministic, heuristic, subjective, and unsupported judgments |
| Add “Data strategy and operating model” | **Required** | Define data portfolios, SLAs, provenance, licensing, failures, and ownership |
| Add “Measurement and falsification” | **Required** | Define metrics, experiments, expansion gates, and kill criteria |
| Add “Business model and commercial firewall” | **Recommended** | Move beyond disclosure to enforcement and payer hypotheses |
| Merge “Long-term positioning” and “Strategic differentiator” | **Recommended** | Remove repeated ambition and replace it with a competitive wedge |
| Move “Sharing and comparison” to roadmap sequencing | **Recommended** | It is a capability set, not part of the core vision |
| Split professional/store features into an explicitly gated future business line | **Recommended** | Prevent consumer and seller incentives from being conflated |
| Add international expansion criteria | **Optional** | Only after Chile-first performance is demonstrated |

### Replacement wording

#### Required — Replace “Product vision” opening and “Core product promise”

> **Near-term strategic focus**
>
> cotiza-pc will first serve Chile-based buyers who already have an itemized desktop gaming-PC quotation and need an independent second opinion before paying.
>
> The initial product will not attempt to find a universally optimal PC. It will identify what can be verified, expose what remains uncertain, highlight the findings most likely to change the purchase decision, and explain what the buyer should question or change next.
>
> **Initial product promise**
>
> > Show us the PC quotation you are considering. We will tell you what is supported by evidence, what may be incompatible or poor value, what cannot yet be verified, and which changes deserve attention before you buy.
>
> The broader ambition remains to support guided building, upgrades, additional workloads, and other markets. Those capabilities must not be treated as current scope until the initial quote-analysis experience meets its quality, trust, usage, and economic gates.

#### Required — Add “Validated problem and beachhead”

> The initial beachhead is a non-expert buyer evaluating a Chilean desktop gaming-PC quotation within an active purchase window.
>
> The primary job is:
>
> > Before I pay, help me determine whether this quote is safe, appropriate for my intended gaming use, reasonably priced where evidence exists, and worth negotiating or changing.
>
> This segment is an initial hypothesis, not an established fact. It must be validated through real quote collection, user interviews, observed decision actions, and willingness-to-pay experiments.
>
> The product will not initially optimize for professional technicians, retailers, international shoppers, non-gaming workstations, used-component marketplaces, or users seeking a fully automatic build.

#### Required — Add “Strategic sequence and MVP boundary”

> **Now — Quote Analyzer**
>
> Analyze structured or user-confirmed quotes using a conservative, evidence-qualified assessment. Support only the dimensions and component categories that meet published data and reliability thresholds.
>
> **Supporting surface — Manual/Expert Builder**
>
> Preserve manual component editing, alternatives, overrides, and detailed compatibility evidence. A quote may move between analysis and manual editing without losing its assumptions or evidence record.
>
> **Next — Guided Builder**
>
> Build an intent-first recommendation experience only after the shared assessment model can reliably evaluate its own generated configurations.
>
> **Later**
>
> Scenario monitoring, public sharing, upgrade optimization, additional workloads, international markets, community content, and professional/store tooling require separate approval gates.
>
> **Explicit MVP exclusions**
>
> No opaque universal score, unconfirmed fuzzy identity matching, unsupported performance claims, retailer ranking influenced by commercial value, or automatic claim that missing data implies compatibility.

#### Required — Add “Decision and evidence contract”

> Every assessment dimension must declare its decision type:
>
> - **Deterministic:** directly entailed by complete, authoritative input data.
> - **Derived:** reproducibly calculated from disclosed inputs and formulae.
> - **Heuristic:** a rule of thumb with known limits and validation evidence.
> - **Probabilistic:** a calibrated estimate with an interpretable confidence range.
> - **Preference-dependent:** valid only under explicit user priorities.
> - **Unsupported:** the product lacks enough evidence to make the judgment.
>
> Every finding must contain:
>
> - conclusion and severity;
> - affected components and input values;
> - decision type;
> - evidence source and freshness;
> - data and rule version;
> - confidence and known limitations;
> - recommended next action.
>
> Identical inputs evaluated against the same data and rule versions must produce identical results. A material change in conclusion must be explainable as a change in input, data, or rule version.

#### Required — Add “Data strategy and operating model”

> cotiza-pc treats the following as separate governed data products:
>
> 1. product identity and specifications;
> 2. compatibility relationships;
> 3. performance and workload evidence;
> 4. Chilean retailer offers, stock, shipping, payment, and warranty context;
> 5. user-provided quotation snapshots;
> 6. assessment rules and validation outcomes.
>
> Each data product must have an accountable owner, approved sources and licenses, attribution requirements, schema, identity policy, freshness SLA, completeness thresholds, conflict policy, correction process, and source-failure behavior.
>
> Catalog size is not a success metric. A product is supported for a dimension only when that dimension’s required fields meet its evidence threshold. Inferred values must remain distinguishable from explicit source data.
>
> Source failure, stale data, ambiguous identity, and conflicting values must degrade the affected conclusion to an honest uncertainty state. They must not silently reuse stale confidence.

#### Required — Add “Measurement and falsification”

> The north-star metric is monthly evidence-qualified purchase decisions assisted.
>
> The product must also track activation, component identity coverage, data freshness, expert agreement, critical false-negative rate, recommendation reversals, user comprehension, decision-action rate, purchase-window retention, sharing, and commercial disclosure compliance.
>
> Expansion beyond the initial segment requires:
>
> - validated user demand;
> - approved data coverage and operating cost;
> - deterministic reproducibility;
> - reliability thresholds for the added dimension;
> - no unacceptable trust or commercial-bias regression.
>
> Leadership must define thresholds at which the initial thesis is narrowed, changed, or stopped. Shipping more interface surface is not evidence that the vision is working.

#### Recommended — Add “Business model and commercial firewall”

> The assessment result and retailer ordering must be independent of affiliate rate, sponsorship, retailer relationship, lead value, or payment.
>
> Commercial content must be visually and structurally separate from assessment output. The system must log which signals affected recommendation and ranking behavior so neutrality can be audited.
>
> The initial monetization hypothesis is a paid decision service—such as monitoring, comparison, durable evidence reports, or optional human verification—while the core verdict remains accessible without payment.
>
> Affiliate or retailer revenue may be tested only after neutrality controls exist and users demonstrate that disclosure is understood.

#### Recommended — Replace repeated long-term positioning/differentiator text

> cotiza-pc aims to become the independent decision layer users consult before accepting a PC quotation.
>
> Its differentiation will not come from having the largest catalog or another compatibility form. It must come from conservative quote identity resolution, Chile-relevant evidence, reproducible assessments, visible uncertainty, correction history, and a growing corpus of real quotes and validated outcomes.
>
> The product should refuse expansion that increases surface area faster than evidence quality, or that turns independent advice into a disguised retailer funnel.

## 11. Final leadership memo

### What is cotiza-pc really trying to become?

An independent, explainable second-opinion engine for PC purchase decisions—initially, the place a Chilean buyer checks a third-party gaming-PC quote before paying.

### What should it refuse to become?

Another broad component catalog, compatibility wizard, affiliate price funnel, opaque AI shopping assistant, content farm, or retailer CRM pretending to offer neutral consumer advice.

### What is the single most important decision leadership must make now?

Choose whether the initial business is a **Chile-first gaming Quote Analyzer**. If yes, freeze Guided Builder, broad workload support, internationalization, community features, and professional tooling behind evidence gates.

### What evidence is required before expanding scope?

- Real quote-resolution coverage.
- Expert-validated reliability with no dangerous false negatives.
- User evidence that findings change or confirm purchase decisions.
- Sustainable Chilean price/spec data operations.
- Acquisition and activation proof.
- A monetization signal that does not undermine neutrality.

### Is the vision ready to govern product development?

**No.**

It is ready to govern recommendation ethics and uncertainty semantics. It is not ready to govern strategy, sequencing, investment, or business decisions.

### Post-audit owner decision

The original audit listed a monetization signal among the evidence to obtain before expanding scope. The 2026-07-30 owner decision supersedes that sequencing: product and organic-growth expansion are now governed by the canonical quality, activation, and organic milestones. Monetization is neither required nor authorized until the later optional monetization gate is reached and explicitly acknowledged.
