# Canonical Product Vision for cotiza-pc

> **Product Constitution and Highest-Authority Product Source of Truth.** This document is the canonical product vision for cotiza-pc and the highest-authority product document in this repository. It is required reading before proposing or implementing a material product change. It is the standard for resolving product ambiguity and competing priorities. It is subordinate only to explicit current instructions from the project owner.

## Authority and purpose

This document governs the continued design and development of cotiza-pc. Use it to evaluate future features, product decisions, technical plans, UX and UI decisions, data-model changes, compatibility rules, recommendation logic, price intelligence, monetization ideas, roadmap priorities, architectural decisions, and refactors that affect product behavior.

The central product distinction is:

> PC-building tools help users assemble parts. cotiza-pc must help users decide whether a PC configuration is actually worth buying.

Compatibility is necessary, but it is not the complete product. cotiza-pc must evolve into an explainable PC purchasing and quotation decision engine.

## Decision hierarchy

When product direction or behavior is ambiguous or conflicts, apply this order of precedence:

1. Explicit current instructions from the project owner
2. This document, docs/PRODUCT_VISION.md
3. Repository-wide agent and engineering instructions
4. Approved architecture and implementation plans
5. Existing implementation
6. Historical documentation and prior assumptions

Existing code does not automatically define correct product behavior, and a feature already being present does not prove that it aligns with this vision. Implementation convenience must not silently override product principles. Historical documentation must defer to this document. User personas may expand this vision, but may not redefine it.

When a request conflicts with this vision, surface the conflict explicitly. The project owner may amend or override the vision through an explicit decision. Explicit owner instructions for a specific task take precedence; document the deviation when it is material.

## Product vision

The goal of **cotiza-pc** is to become the go-to website and application for anyone who wants to build, upgrade, compare, or purchase a PC intelligently.

Most PC-building tools help users assemble a list of components. **cotiza-pc must go further:** it must help users understand whether a build makes sense, what compromises they are making, where they may be wasting money, and what alternatives would produce a better result.

A quotation should not be considered “smart” merely because its total price is calculated correctly. A genuinely smart quotation should answer the questions that matter before someone spends money:

- Are all components technically compatible?
- Will the graphics card physically fit inside the case?
- Is the power supply sufficient, reliable, and properly connected?
- Is the CPU disproportionately weak or expensive relative to the GPU?
- Is the build appropriate for the user’s actual workload?
- Is money being spent where it will produce a meaningful improvement?
- Is the system easy to upgrade, or does it lead to an unnecessary dead end?
- Are the listed prices current, competitive, and available?
- What could be changed to make the build cheaper, faster, quieter, more efficient, or more durable?

The product must transform a collection of components and prices into an **explainable purchasing recommendation**.

### Core product promise

> Tell us what you need and how much you can spend. We will help you create the best defensible PC configuration for that budget—and explain every important decision.

The objective is not to claim that there is one universally perfect build. Different users value different things. A gaming PC, workstation, home server, office computer, streaming setup, software-development machine, data-analysis workstation, and machine-learning system require different priorities.

Instead, cotiza-pc must identify strong configurations according to the user’s intended use, budget, preferences, existing components, and practical constraints.

### Main user experiences

#### Guided Builder

The Guided Builder is for users who do not know exactly which components they need.

The application should begin with understandable questions such as:

- What will the PC be used for?
- What is the maximum budget?
- Does the budget include the monitor and peripherals?
- Which games, applications, or workloads matter most?
- What resolution and performance level does the user expect?
- Does the user prioritize performance, silence, appearance, energy efficiency, compact size, or upgradeability?
- Does the user already own reusable components?

The system should then recommend one or more builds and explain why each component was selected.

#### Expert Builder

The Expert Builder is for users who want complete control.

Experts must be able to select every component manually, compare alternatives, override recommendations, and inspect detailed compatibility information without being forced through a simplified questionnaire.

Warnings must inform rather than unnecessarily block the user.

The application must clearly distinguish between:

- **Confirmed incompatibility**
- **Potential problem**
- **Suboptimal combination**
- **Missing or insufficient data**
- **Valid configuration**

This distinction is mandatory. “We cannot verify this” is not the same as “this will not work.”

#### Quote Analyzer

Users must be able to enter or import an existing quotation received from a store, technician, friend, marketplace, or another tool.

cotiza-pc should evaluate it and answer:

- Is the quotation technically valid?
- Are any components suspiciously weak, outdated, oversized, or unnecessary?
- Is there an obvious bottleneck?
- Is the power supply appropriate?
- Is the seller using an expensive component that offers little practical benefit?
- Are important components missing?
- Is the total price reasonable?
- What should be replaced first to improve the quotation?
- Is the quotation suitable for the buyer’s stated use case?

This is a central differentiator. Many users do not need to create a PC from scratch; they need to know whether the quotation already in front of them is good.

### Decision intelligence

Every completed quotation should include an assessment across several dimensions.

#### Compatibility

The system should validate, wherever reliable data is available:

- CPU and motherboard socket
- CPU, motherboard, and RAM generation or memory type
- Motherboard and case form factor
- GPU dimensions and case clearance
- CPU cooler socket and case clearance
- RAM clearance where relevant
- Storage interfaces and available motherboard slots
- PSU wattage and safety headroom
- PSU connectors required by the GPU and motherboard
- Fan, radiator, and cooling support
- BIOS or firmware compatibility
- Number of available expansion slots and ports

The system must distinguish verified incompatibility from incomplete data.

#### Performance balance

The tool should evaluate whether the build is internally coherent.

For example, it should identify:

- A high-end CPU paired with an entry-level GPU in a gaming build
- An expensive GPU paired with insufficient RAM
- A workstation CPU used where a cheaper gaming CPU performs similarly
- Excessive spending on the motherboard while compromising the GPU
- Storage choices poorly suited to the workload
- Cooling solutions disproportionate to the processor
- Components that technically work together but represent poor value

This assessment must depend on the declared use case.

A configuration that is unbalanced for gaming may be reasonable for software development, data analysis, virtualization, video editing, content creation, or machine learning.

#### Value for money

A build must be evaluated not only by its total price, but by what the buyer receives for each additional amount spent.

The application should identify:

- Components with poor price-to-performance
- Cheaper alternatives with nearly identical practical performance
- More expensive alternatives that provide a meaningful improvement
- Parts whose premium is mostly aesthetic or brand-related
- Situations where spending slightly more prevents an important limitation
- Situations where reducing the budget would have almost no practical impact
- Parts that are overpriced relative to equivalent available alternatives

The user should be able to understand the marginal value of each decision.

#### Upgradeability

The cheapest build today is not always the cheapest build over several years.

cotiza-pc should evaluate:

- Platform longevity
- Available RAM slots
- Storage expansion capacity
- PSU headroom
- Case capacity
- Motherboard connectivity
- CPU upgrade possibilities
- Whether an upgrade would require replacing several related components
- Whether the selected platform is already near the end of its practical upgrade path

The application should explain whether a build is:

- Optimized for the lowest immediate cost
- Balanced for medium-term ownership
- Designed for future upgrades
- Near the practical limit of its platform

#### Price intelligence

A useful quotation must preserve price context.

Each price should ideally include:

- Store
- Regular price
- Offer price
- Availability
- Last verification date
- Shipping cost
- Payment conditions
- Historical or recent price context
- Confidence that the store listing matches the selected component
- Any relevant warranty or seller distinction when available

The system should calculate more than a single total.

It should be able to show:

- Cheapest single-store purchase
- Cheapest multi-store combination
- Total including shipping
- Savings compared with regular prices
- Price differences between equivalent components
- Whether an offer is genuinely attractive or merely presented as a discount
- The effect of replacing one component with a reasonable alternative

Prices must always display their freshness.

A quotation built from outdated prices can be technically correct and still be commercially useless.

### Recommendation output

A completed build should produce a concise, understandable verdict, for example:

> This is a compatible and well-balanced 1440p gaming build. The GPU receives the largest share of the budget, the power supply provides adequate headroom, and the platform allows a future CPU upgrade. The motherboard is more expensive than necessary, however, and replacing it with the suggested alternative would reduce the price without affecting expected gaming performance.

The result should include:

- Overall build assessment
- Compatibility status
- Main strengths
- Critical problems
- Non-critical warnings
- Estimated power consumption
- Recommended PSU capacity
- Performance balance
- Upgradeability assessment
- Value assessment
- Suggested substitutions
- Price and data freshness
- Explicit explanation of assumptions
- Explicit indication of unavailable or insufficient information
- Confidence or evidence level where appropriate

The product must never hide uncertainty behind an authoritative-looking score.

### Trust and explainability

cotiza-pc must earn trust by explaining its reasoning.

Every warning or recommendation should indicate:

- What was detected
- Why it matters
- Which data was used
- Whether the conclusion is verified, inferred, heuristic, or uncertain
- What the user can do about it

Recommendations must not be secretly ordered according to affiliate revenue, sponsorship, retailer relationships, or commercial incentives.

Any sponsored result, affiliate link, preferred retailer, or commercial relationship must be clearly identified.

The credibility of the platform must come from:

- Transparent rules
- Traceable data
- Current prices
- Reproducible evaluations
- Clear uncertainty
- Commercial disclosure
- The willingness to say **“insufficient information”** when a conclusion cannot be supported

### Sharing and comparison

Users should be able to:

- Save multiple quotations
- Duplicate and modify a build
- Compare two or more configurations
- Share a public read-only link
- Export to PDF, spreadsheet, image, or JSON
- Import an existing cotiza-pc quotation
- Preserve a price snapshot
- Add personal notes
- Mark components they already own
- Compare the cost of upgrading an existing PC against purchasing a new one
- Revisit a quotation and understand what prices or assumptions have changed

A shared quotation must remain understandable even to someone who did not create it.

### Long-term positioning

cotiza-pc should become a neutral layer between consumers, component data, retailers, technicians, and PC builders.

For consumers, it should reduce uncertainty and prevent expensive mistakes.

For enthusiasts, it should provide a faster and more rigorous way to evaluate configurations.

For technicians and stores, it could eventually provide:

- Professional quotation tools
- Branded exports
- Client management
- Inventory integration
- Reusable build templates
- Quote history
- Transparent recommendation explanations

For the broader community, it could provide a transparent and auditable knowledge base about:

- Compatibility
- Performance
- Pricing
- Upgrade paths
- Sensible component selection
- Common quotation problems

The long-term ambition is not simply to help users choose parts.

It is to become the place people consult before deciding whether a PC quotation is actually worth buying.

### Strategic differentiator

The product should be guided by this distinction:

> PCPartPicker helps users assemble a PC. cotiza-pc helps users decide whether they should buy it.

This does not require copying, imitating, or positioning the project as dependent on PCPartPicker. The comparison exists only to clarify the product category and strategic distinction.

Compatibility is necessary, but it is not enough.

The product becomes valuable when it can explain that a build is compatible yet still:

- Badly designed
- Overpriced
- Unsuitable for the intended use
- Difficult to upgrade
- Wasteful
- Unbalanced
- Based on stale or unreliable data

### Product assessment model

Do not reduce the entire product to one opaque universal score.

Prefer a multidimensional assessment that separately communicates:

- Compatibility
- Suitability for intended use
- Value for money
- Performance balance
- Upgradeability
- Price freshness
- Data completeness
- Evidence confidence

A summary score may be considered in the future only if:

- Its dimensions remain visible
- Its methodology is transparent
- It does not conceal uncertainty
- It does not replace the underlying explanations
- It cannot imply precision unsupported by the available data

## Mandatory product-decision checklist

Every material feature, plan, or product-affecting refactor must answer:

- [ ] Which user problem does this solve?
- [ ] Which user type or workflow benefits?
- [ ] Does it help users make a better purchasing decision, or merely add interface surface?
- [ ] Which product dimension does it improve: compatibility, suitability, value, performance balance, upgradeability, price intelligence, explainability, or data confidence?
- [ ] Is the output based on verified data, an inference, a heuristic, or an assumption?
- [ ] Is uncertainty represented honestly?
- [ ] Can the recommendation explain why it was produced?
- [ ] Does the proposal introduce false precision?
- [ ] Could commercial incentives bias the result?
- [ ] What are the failure modes and sad paths?
- [ ] How will missing or conflicting data be handled?
- [ ] How will data freshness and provenance be communicated?
- [ ] Does the feature create meaningful user value relative to its implementation and maintenance cost?
- [ ] Does it preserve appropriate beginner and expert workflows?
- [ ] Does it move the project toward becoming a decision engine rather than merely a component picker?
- [ ] How will the behavior be tested?
- [ ] Which acceptance criteria prove the feature actually serves the product vision?

A proposal that cannot answer these questions adequately should not automatically proceed.

## Conflict-resolution rules

1. Apply the decision hierarchy. Do not use existing implementation, historical documentation, or implementation convenience to silently override this vision.
2. State the conflict, the affected product principles, the available options, and the trade-off in the proposal, plan, decision record, or task handoff.
3. Preserve useful historical material, but label a material assumption as superseded when it no longer governs product direction.
4. Treat the following as distinct states in user-facing behavior and product decisions: confirmed incompatibility, potential problem, suboptimal combination, missing or insufficient data, and valid configuration. Never represent unavailable verification as confirmed failure or confirmed validity.
5. Do not hide uncertainty behind a score, ranking, recommendation, or authoritative presentation. Show the evidence, assumptions, freshness, provenance, and confidence appropriate to the conclusion.
6. Do not permit affiliate revenue, sponsorship, retailer relationships, or other commercial incentives to silently bias recommendations or rankings. Clearly identify any sponsored result, affiliate link, preferred retailer, or commercial relationship.
7. If a conflict requires a departure from this vision, request or record an explicit project-owner decision. A material, task-specific owner instruction takes precedence, and the deviation must be documented.

## Amendment governance

This canonical product vision is durable but not immutable. A material amendment must:

1. Be explicitly requested or approved by the project owner.
2. Explain why the change is necessary.
3. Identify which principles or product areas are affected.
4. Update dependent documentation where necessary.
5. Be made in a dedicated or clearly identified product-governance change.
6. Avoid modifying the vision incidentally inside an unrelated feature, refactor, or bug-fix task.

No agent may change this vision merely to justify a feature it already intends to build.

When a proposed feature conflicts with this vision, the correct action is to:

1. Surface the conflict.
2. Explain the trade-off.
3. Request or record an explicit owner decision when required.
4. Amend the vision only if the owner deliberately chooses to change product direction.
