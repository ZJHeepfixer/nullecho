# Algorithmic and Personalized Pricing: A Four-State Compliance Brief

**With the federal layer and the California enforcement theory. Status as of 2026-08-21.**
Prepared from primary statutory sources except where marked.

> **This document is not legal advice and has not been reviewed by counsel.** It is a compliance
> research brief assembled from statutory text, an agency policy statement, and court records. It
> is written to be checkable: every operative claim is tied to a source, and §8 separates what was
> read from a primary source from what rests on secondary reporting or on inference. Several of the
> questions it addresses are untested — no court has construed the Maryland, Connecticut or New
> Jersey provisions, and the only appellate test of the New York provision is pending and
> undecided. **Obtain an opinion from qualified counsel before relying on anything here to set
> pricing policy.**

---

## 1. Executive summary

**What changed.** In the space of fifteen months, four states went from zero to four distinct
statutory regimes governing the use of consumers' personal data to set prices. They do not agree
with one another on the operative rule, the covered entity, the remedy, or — critically — on the
words a business must display.

| | Statute | Enacted | Operative from | Core mechanism |
|---|---|---|---|---|
| **NY** | GBL § 349-a | May 2025 | Enforced **2025-11-10** | Disclosure |
| **MD** | Com. Law §§ 13-321, 13-322 | 2026-04-28 | **2026-10-01** | Ban (food) **+** disclosure (all merchants) |
| **CT** | P.A. 26-64 § 11 | 2026-05-27 | **2026-10-01** | Disclosure (online) **+** ban (retail sellers) |
| **NJ** | P.L. 2026, c. 65 | 2026-07-23 | **2027-08-01** (ESL moratorium 2027-02-01) | Ban (groceries), no disclosure |

**Three mandated strings, all different, none interchangeable:**

- **New York:** `THIS PRICE WAS SET BY AN ALGORITHM USING YOUR PERSONAL DATA`
- **Maryland:** `THIS PRICE WAS SET BY AN ALGORITHM OR BY USING YOUR PERSONAL DATA`
- **Connecticut:** `THIS PRICE WAS INCREASED BY A PRICE SETTING DEVICE USING YOUR PERSONAL DATA`
  — *or a substantially similar disclosure* (Connecticut is the only one of the three that does not
  fix the wording)

A single national banner cannot satisfy all three. Maryland's differs from New York's by two
inserted words — `OR BY` — which broaden the statement to cover pricing on personal data with no
algorithm involved. Connecticut's is not a variant of the other two at all: it asserts that the
price was *increased*, and it names a "price setting device" rather than an algorithm.

**Who is exposed.** Far more businesses than the "grocery surveillance pricing" framing suggests:

- **Maryland § 13-322 binds every "merchant"**, not just food sellers, and is triggered by setting
  a price using **dynamic pricing *or* personal data** and then advertising, labelling or
  publishing that price. It is the broadest disclosure duty of the four.
- **Connecticut § 11(b) binds "any person doing business in the state"** who uses a price setting
  device for any purpose other than granting a discount in an online transaction.
- **New Jersey is the first state to expose a defendant to private plaintiffs.** It works by
  declaring surveillance pricing an "unlawful practice" under the New Jersey Consumer Fraud Act,
  which carries a private right of action with treble damages and fee-shifting. The other three
  states are attorney-general-only.
- **"Groceries" in New Jersey is not just food.** The defined list reaches paper products,
  household cleaning items, health and beauty products, and pet foods and supplies.

**What to do, and by when.**

| By | Action |
|---|---|
| **Now** | Inventory every pricing input that is personal data. The definitional trigger in all four states is *use of personal data*, not use of AI. |
| **Before 2026-10-01** | Maryland and Connecticut both bite. Decide, jurisdiction by jurisdiction, whether to **disclose** or to **stop triggering**. Counsel is telling most retailers to stop triggering. |
| **Before 2027-02-01** | New Jersey's electronic-shelf-label moratorium begins. New ESL deployments in NJ stop; repair and replacement of pre-existing units continue. |
| **Before 2027-08-01** | New Jersey's grocery ban takes effect, with private-plaintiff exposure. |
| **Watch** | *NRF v. James*, 2d Cir. No. 25-2818 — undecided. New York's **One Fair Price Act**, passed by both houses 2026-06-04 and **not yet signed**; if signed it replaces New York's disclosure regime with a flat ban and deletes the mandated string. **California AB 2564**, a fifth-state ban, faces a **2026-08-31** floor deadline. |

**And a fifth jurisdiction is already enforcing without a pricing statute.** On **2026-01-27** the
California Attorney General opened an investigative sweep of retail, grocery and hotel businesses
using the CCPA's **purpose limitation** principle — not its non-discrimination provision. That
choice is not a technicality: it means a business can be investigated over personalized pricing in
a state that has never regulated pricing, on the theory that using personal data this way is
inconsistent with consumers' reasonable expectations. Every state with a purpose-limitation privacy
statute now has the same hook available. See §5.

**The two facts a general counsel should carry out of this document.** First, the compliance
question is not "do we use AI to price" — it is "does any personal data reach a price, and do we
then publish that price." Second, the four statutes' safe harbours are all built around *loyalty
programs and publicly disclosed, uniformly available discounts*, and they impose different
conditions on those programs. A loyalty program that satisfies New York's "bona fide custom
discount" conditions may still fail Connecticut's posting requirement or New Jersey's
purpose-limitation clause.

---

## 2. The four-state matrix

### 2.1 New York — Gen. Bus. Law § 349-a

| | |
|---|---|
| **Citation** | N.Y. Gen. Bus. Law § 349-a, added by Part X of Ch. 58 of the Laws of 2025 (FY2026 budget) |
| **Mechanism** | **Disclosure only.** No conduct is prohibited. |
| **Mandated string** | `THIS PRICE WAS SET BY AN ALGORITHM USING YOUR PERSONAL DATA` |
| **Effective** | Law took effect 2025-07-08; **enforcement began 2025-11-10** after the district court dismissed the NRF challenge |
| **Who it binds** | Any "entity" — natural person, firm, organization, partnership, association, corporation or other entity **domiciled or doing business in New York** — that (a) sets the price of a specific good or service using personalized algorithmic pricing and (b) directly or indirectly advertises, promotes, labels or publishes a statement, display, image, offer or announcement of that price to a consumer in New York **using personal data specific to that consumer** |
| **Trigger definition** | "Personalized algorithmic pricing" = dynamic pricing set by an algorithm that uses personal data. "Dynamic pricing" = pricing that fluctuates dependent on conditions. "Personal data" = any data that identifies or could reasonably be linked, directly or indirectly, with a specific consumer **or device** |
| **Placement standard** | Same medium as, and provided **on, at, or near and contemporaneous with, every** advertisement, display, image, offer or announcement of a price for which notice is required; lettering and wording easily visible and understandable to the average consumer |
| **Exemptions** | (a) entities subject to the insurance law; (b) financial institutions and affiliates subject to GLBA Title V (15 U.S.C. § 6809); (c) financial institutions as defined in N.Y. Fin. Serv. Law § 801(f); (d) a price offered to a consumer with an **existing subscription contract** where that price is **less than** the contract price. Also excluded from "personal data": for-hire and TNC vehicle location data used **solely** to calculate fare from mileage and trip duration |
| **Penalty** | Civil penalty **≤ $1,000 per violation** |
| **Enforcement** | Attorney General only. **A cease-and-desist letter is a statutory prerequisite** — it must specify the alleged violations and the remedies to cure "within a designated timeline." Only if the entity continues to violate after that timeline may the AG bring a special proceeding for an injunction on ≥5 days' notice. An injunction may issue **without proof that any person was in fact injured** |
| **Private right of action** | **None** |
| **Litigation** | *National Retail Federation v. James*, No. 1:25-cv-05500 (S.D.N.Y.) — Rakoff, J., granted the motion to dismiss **2025-10-08**, holding the mandated statement "factual and uncontroversial" (i.e. reviewed under *Zauderer*), and denied the preliminary injunction as moot. On appeal: 2d Cir. **No. 25-2818**, docketed 2025-11-05. **No oral argument has been held and no decision has issued as of 2026-08-21.** Amici on both sides (U.S. Chamber and Washington Legal Foundation for NRF; EPIC for the State) |
| **Practical note** | The cure-first structure means the realistic first consequence of non-compliance is a letter, not a penalty. That materially lowers near-term risk in New York relative to Maryland and Connecticut, and it is the single most under-reported feature of the statute |

### 2.2 Maryland — Com. Law §§ 13-321 and 13-322 (Protection From Predatory Pricing Act)

Ch. 154, Laws of 2026 (HB 895), approved by Governor Wes Moore **2026-04-28**, effective
**2026-10-01**. Maryland is the only state of the four that enacted **both** a ban and a
general-merchant disclosure duty, in two separate sections with different scopes. Conflating them
is the most common error in the secondary coverage.

#### § 13-321 — the ban (food only)

| | |
|---|---|
| **Who it binds** | A **"food retailer"** — a merchant operating a business establishment that (i) has **a minimum of 15,000 square feet** and (ii) sells food exempt from sales and use tax under Tax-Gen. § 11-206(c) — and a **"third-party food delivery service provider"** (which excludes food retailers) |
| **Prohibition** | May not (i) engage in **dynamic pricing to set a higher price** for sales-tax-exempt food **for a specific consumer**, or (ii) use **surveillance personal data** to set a higher price for such food **for a single consumer or a group of consumers** |
| **Second prohibition** | May not use **protected class data** to offer, advertise or sell a good or service to the consumer it pertains to, where that use has the effect of withholding or denying an accommodation, advantage or privilege accorded to others |
| **"Dynamic pricing"** | "Offering or setting a personalized price for a good or service that is specific to a consumer based on the consumer's personal data, **regardless of whether the seller collected or purchased the personal data**, including through the use of artificial intelligence or models that retrain or recalibrate based on received information in near real-time" |
| **Carve-outs from "dynamic pricing"** | Promotional pricing, loyalty benefits, temporary discounts and retention pricing; price differences from **objective costs** (shipping, location-based taxes); differences from **costs or supply/demand in different locations or geographies**; differences from costs of availability or supply; prices offered through a **loyalty, membership or rewards program any consumer may voluntarily enrol in**; a price offered under a **subscription contract**; a price offered to a consumer **who consents to providing personal data in exchange for obtaining the price**; a **price correction** from a pricing error; **resetting a price** after a system or network outage |
| **Enforcement** | Consumer Protection Division of the Maryland AG's office, under the Maryland Consumer Protection Act. **Mandatory notice of violation plus a fixed 45-day cure period** — if the violation is cured within 45 days the Division may not initiate an enforcement action |
| **Private right of action** | **Expressly none.** § 13-321(e): "THIS SECTION MAY NOT BE CONSTRUED TO AUTHORIZE A PRIVATE RIGHT OF ACTION UNDER THIS SECTION OR ANY OTHER LAW." The Act separately amends § 13-408 so that the CPA's general private action does not reach §§ 13-321 or 13-322 |
| **Criminal exposure** | **None.** The Act amends § 13-411 so the CPA's misdemeanour penalty does not apply to §§ 13-321 or 13-322 |

#### § 13-322 — the disclosure (every merchant)

| | |
|---|---|
| **Who it binds** | Any **"merchant."** This is not limited to food, retail, or any size threshold |
| **Trigger** | Setting the price of a consumer good or service **using dynamic pricing OR personal data**, and then directly or indirectly advertising or promoting, including on a label, or publishing any other communication containing that price |
| **Mandated string** | `THIS PRICE WAS SET BY AN ALGORITHM OR BY USING YOUR PERSONAL DATA` |
| **"Communication"** | "A display, an image, an offer, or an announcement" |
| **"Clear and conspicuous"** | In the **same medium as, and provided on, at, or near and contemporaneous with, each** communication of a price for which notice is required; lettering and wording easily visible and understandable to a consumer |
| **"Personal data"** | Com. Law § 14-4701(w): any information linked or reasonably linkable to an identified or identifiable consumer; **excludes de-identified data and publicly available information** |
| **Exemptions** | (1) merchant conduct regulated under the Insurance Article; (2) food retailers and third-party food delivery service providers already subject to § 13-321; (3) financial institutions as defined in Md. Fin. Inst. § 1-101, and financial institutions or affiliates subject to GLBA Title V; (4) **a lower price offered to a consumer who is an employee of the merchant** |
| **Enforcement** | Same as § 13-321 — Division, notice of violation, **45-day cure**, then MCPA enforcement |
| **Penalty** | Violation is an unfair, abusive or deceptive trade practice under the MCPA. Under Com. Law § 13-410 the civil penalty is **up to $10,000 per violation and up to $25,000 for each repeat violation** *(§ 13-410 amount is from secondary sources; the chapter law does not restate it)* |
| **Private right of action** | **None** (see § 13-408 amendment above) |
| **Note on the "or"** | Maryland's disclosure trigger is disjunctive — **dynamic pricing *or* personal data**. A merchant that sets a price using personal data without any algorithm at all is inside § 13-322. This is broader than New York's trigger, which requires algorithmic *and* personal-data pricing |

#### The Maryland drafting artifact worth knowing about

The enacted chapter law shows heavy amendment layering — earlier definitions of "dynamic pricing"
(originally "varying prices within the same business day based on demand") and "surveillance
personal data" (originally a long technological-collection definition) were struck and replaced.
The bill also began as an emergency measure taking effect on enactment and ended with a
**2026-10-01** effective date. Anyone reading the chapter PDF should read the strike-through
carefully; several published summaries quote superseded language.

### 2.3 Connecticut — P.A. 26-64 § 11 (Substitute S.B. 4)

Signed by Governor Ned Lamont **2026-05-27** *(signing date is from secondary sources; the act text
itself is primary)*. Section 11 is effective **2026-10-01**. Like Maryland, Connecticut has both a
disclosure duty and a ban, but it splits them differently: the **disclosure is online-only and
applies to everyone**, while the **ban applies to retail sellers and third-party delivery services
in any channel**.

| | |
|---|---|
| **Disclosure — who it binds** | "Any person doing business in the state" who uses a **price setting device** for any reason **other than** to establish a **discounted price** as part of an **online transaction**, and who advertises, promotes, labels or publishes that price **online** |
| **Mandated string** | `THIS PRICE WAS INCREASED BY A PRICE SETTING DEVICE USING YOUR PERSONAL DATA` — **"or a substantially similar disclosure"** |
| **Placement standard** | "Readily visible to the average consumer" |
| **"Price setting device"** | "Any automated or programmed process that uses a consumer's personal data to establish a price for a consumer good or consumer service to be sold, leased, exchanged or provided to the consumer" |
| **Ban — who it binds** | No **"retail seller"** or **"third-party delivery service"** doing business in the state shall engage in **surveillance pricing**. "Retail seller" = a retailer as defined in Conn. Gen. Stat. § 12-407 **to the extent engaged in making sales, at retail, of tangible personal property**, and **includes** retail food establishments |
| **"Surveillance pricing"** | Establishing a customized price specific to a consumer based in whole or in part on the consumer's personal data collected **(A)** through any technology or technological method, system or tool — including biometric monitoring, cameras, device tracking or sensors — capable of gathering personal data about a consumer's behaviour, characteristics, location or other personal attributes in a physical or digital environment, **and (B)** acquired by the person setting the price either directly or indirectly from a third party |
| **Ban carve-outs** | (A) a **discounted price for a consumer *service*** offered for **customer retention**; (B) different prices due to **justifiable cost differences** (consumer selections, delivery distances, delivery times) or **justifiable temporal differences** (supply and demand fluctuations); (C) a discounted price based on **publicly disclosed uniform terms** any consumer can satisfy, or available to a **broadly defined group** (veterans, service members, seniors, students, teachers, residents of an area), or through a **loyalty program requiring affirmative enrolment** — **provided** the seller (I) prominently posts the discounted price and its uniform terms on its website in language readily understandable by the average consumer and (II) offers it to all consumers on those posted terms |
| **Exemptions (both duties)** | (1) persons licensed, authorized or registered — or required to be — under Connecticut insurance law; (2) financial institutions or affiliates as defined in 15 U.S.C. § 6809, to the extent subject to GLBA Title V; (3) banks, holding companies, out-of-state banks and out-of-state holding companies supervised by the Connecticut Banking Commissioner under Title 36a |
| **Enforcement** | Violation is an unfair or deceptive trade practice under CUTPA § 42-110b(a), **"and shall be enforced solely by the Attorney General"** |
| **Private right of action** | **Expressly none.** § 11(e): "Nothing in this section shall be construed to create a private right of action or to provide grounds for an action under section 42-110g." Section 42-110g is CUTPA's private damages provision |
| **Penalty** | Via CUTPA. AG remedies include injunctive relief and restitution (§ 42-110m); a civil penalty of **up to $5,000 per wilful violation** (§ 42-110o(b)); and **up to $25,000** per violation of a restraining order or injunction (§ 42-110o(a)) *(CUTPA penalty amounts are from secondary sources)* |
| **No cure period** | Unlike New York and Maryland, § 11 contains **no notice-and-cure prerequisite** |
| **Correction to circulating summaries** | Several secondary summaries state that Connecticut's mandated string is "THIS PRICE WAS INCREASED BY AN ALGORITHM USING YOUR PERSONAL DATA," and that § 11 bans **electronic pricing labels** for in-person transactions. **Both are wrong.** The enacted text says "PRICE SETTING DEVICE," and P.A. 26-64 contains **no** electronic-shelf-label provision — that is New Jersey's. Verified by full-text search of the act |

### 2.4 New Jersey — Fair Price Protection Act, P.L. 2026, c. 65

Assembly Committee Substitute for A.4085 and A.4523, **Third Reprint** (Assembly Budget Committee
amendments of 2026-06-28), signed by Governor Mikie Sherrill **2026-07-23**. Supplements the New
Jersey Consumer Fraud Act, P.L. 1960, c. 39 (N.J.S.A. 56:8-1 *et seq.*).

| | |
|---|---|
| **Mechanism** | **Ban only. There is no mandated disclosure string.** |
| **Prohibition (§ 3(a))** | It is an **unlawful practice** and a violation of the CFA for a **person** to use surveillance pricing "or any other pricing strategy that determines or varies the sale price of **groceries and other foodstuffs** based, in whole or in part, on personal data" |
| **"Surveillance pricing"** | An action, including a pricing strategy, in which the price of groceries and other foodstuffs is, in whole or in part, determined, adjusted, optimized or recommended by an **algorithm or automated system** based in whole or in part on personal data — **including data derived or inferred from other data** — and that **results in price variation for individual consumers or groups of consumers**. Expressly includes pricing based on data collected through **electronic surveillance technology** (sensors, cameras, device tracking, biometric monitoring) |
| **"Groceries and other foodstuffs" — read this carefully** | Dairy, meat and delicatessen, produce, seafood, carbonated beverages, coffee and other beverages, snack foods, candy, baked products, **paper products, household cleaning items, health and beauty products**, frozen foods, **pet foods and supplies**, and any other edible product not listed — **except** food or beverages prepared for immediate consumption on or off the premises of a food service establishment |
| **Restaurant carve-out (§ 6)** | The Act does not apply to the pricing, advertisement, offer or sale of food or beverages by an establishment **primarily engaged in the preparation and sale of food or beverages for immediate consumption** |
| **Permitted price differences (§ 3(b))** | (1) **reasonable costs** of providing the goods to different consumers — **provided a price is not changed more than once in a 24-hour period**; (2) a **bona fide discount** with publicly and conspicuously disclosed eligibility criteria, uniformly offered, open to any member of a broadly defined group (e.g. teachers, veterans); (3) a **bona fide discount under a loyalty program**, including point/credit accrual and purchase-based coupons and third-party pricing benefits, **provided** (a) consumers opt in voluntarily, (b) all members receive pricing benefits pursuant to uniform terms and conditions, (c) the program clearly and conspicuously discloses all pricing benefits, available discounts and data practices to participants **and, on request, to the Division of Consumer Affairs within 14 days**, and (d) the program discloses all terms and conditions and data practices to the public |
| **Purpose limitation (§ 3(c))** | Where a person uses personal data to offer a permitted price difference, **"that personal data shall not be used for any other purpose without the consumer's consent."** This is a standalone data-governance obligation embedded in a pricing statute and is easy to miss |
| **Electronic shelf labels (§ 4)** | A **one-year moratorium on the *new use*** of electronic shelf labels in New Jersey. Purchasing, installing or deploying new ESLs **solely to repair or replace units already in operation at the same place of business** before the moratorium is permitted. After the moratorium, new use is permitted subject to the CFA and any Division rules, unless the Legislature acts |
| **ESL study (§ 5)** | The New Jersey Innovation Authority, with the Division of Consumer Affairs, must study ESL effects and their impact on surveillance pricing, and report to the Governor and Legislature no later than six months before the moratorium ends |
| **AG enforcement (§ 7)** | In addition to any other authority, the AG may bring a civil action to enjoin the practice, enforce compliance, obtain **actual monetary damages for each negligent or greater violation** in addition to any other penalty provided by law, and obtain any other restitution, penalty or relief the court deems appropriate |
| **⚠️ The $50,000 figure is wrong** | Widely repeated reporting says the Act carries a **$50,000** statutory minimum per violation. It did — in the First Reprint. **The Third Reprint struck it** (`obtain for each negligent or greater violation … actual monetary damages incurred from the violation [or $50,000, whichever is greater]`). The enacted text provides actual damages plus other penalties provided by law, not a $50,000 floor |
| **Penalty via the CFA** | Because a violation is a CFA "unlawful practice," the CFA's own penalties attach — reported as up to **$10,000 for a first offence and $20,000 for each subsequent offence** under N.J.S.A. 56:8-13 *(secondary)* |
| **Private right of action** | **Yes — and this is the first in the nation.** The Act does not create one expressly. It attaches by operation of the CFA: N.J.S.A. 56:8-19 gives any person suffering an ascertainable loss from an unlawful practice a private action for **treble damages plus reasonable attorneys' fees and costs**. **This is an inference from the CFA's structure, not a holding**, but it is the reading every law-firm client alert reviewed has adopted, and it is the single largest change in the risk profile across the four states |
| **Effective dates (§ 9)** | The Act takes effect on the first day of the **13th month** next following enactment = **2027-08-01**. Section 4 (**ESL moratorium**) takes effect on the first day of the **7th month** = **2027-02-01**. Section 5 (study) took effect immediately |
| **Rulemaking** | The Director of the Division of Consumer Affairs may adopt implementing rules under the Administrative Procedure Act |

### 2.5 The comparison that matters most

| | NY § 349-a | MD § 13-322 | MD § 13-321 | CT § 11(b) | CT § 11(c) | NJ c. 65 |
|---|---|---|---|---|---|---|
| **Type** | Disclose | Disclose | Ban | Disclose | Ban | Ban |
| **Sector** | All | All merchants | Food retail ≥15k sq ft + 3P food delivery | All persons (**online only**) | Retail sellers of tangible personal property + 3P delivery | Groceries & foodstuffs (excl. prepared food) |
| **Trigger** | Algorithm **and** personal data | Dynamic pricing **or** personal data | Dynamic pricing / surveillance personal data → **higher** price | Price setting device, except online discounts | Tech-collected personal data → customized price | Algorithm/automated system + personal data → price variation |
| **Exact words fixed?** | **Yes** | **Yes** | n/a | **No** — "or substantially similar" | n/a | n/a |
| **Notice-and-cure?** | **Yes**, AG-set timeline | **Yes, 45 days** | **Yes, 45 days** | **No** | **No** | **No** |
| **Private action** | No | No | **Expressly no** | **Expressly no** | **Expressly no** | **Yes, via CFA (inference)** |
| **Max civil penalty** | $1,000/violation | $10,000 / $25,000 repeat *(sec.)* | same | $5,000/wilful *(sec.)* | same | Actual damages + CFA penalties; treble in private suits |
| **Live from** | 2025-11-10 | 2026-10-01 | 2026-10-01 | 2026-10-01 | 2026-10-01 | 2027-08-01 |

---

## 3. Disclosure versus ban — the distinction most coverage conflates

Trade and even law-firm coverage routinely describes all four states as "surveillance pricing
disclosure laws." That is right for New York and wrong for the other three, and the error has a
practical cost: **a business that responds to Maryland, Connecticut or New Jersey by adding a
banner has, in the banned sectors, disclosed its way into an admission rather than out of a
violation.**

**New York is pure disclosure.** § 349-a prohibits no pricing conduct at all. Personalized
algorithmic pricing remains lawful in New York; only publishing such a price without the mandated
statement is unlawful. Compliance is achievable by adding words.

**Maryland is both, in two sections with different scopes.** § 13-322 is a disclosure duty binding
every merchant. § 13-321 is a flat ban binding large food retailers and third-party food delivery
providers — and § 13-322 **expressly does not apply** to conduct covered by § 13-321. So for a
15,000-square-foot grocer selling tax-exempt food in Maryland, the disclosure is not available as a
cure. The conduct is prohibited outright, and no banner fixes it.

**Connecticut is both, split by channel and by actor.** § 11(b)'s disclosure reaches any person,
but only online. § 11(c)'s ban reaches retail sellers of tangible personal property and third-party
delivery services, in any channel. An online retailer of tangible goods doing business in
Connecticut is inside **both** — meaning that if it engages in "surveillance pricing" as defined,
the § 11(b) disclosure does not cure the § 11(c) violation. Note also the asymmetry inside § 11(b):
using a price setting device **solely to grant a discount online** is outside the disclosure duty
entirely, which is why Connecticut's mandated string says "INCREASED."

**New Jersey is pure ban.** There is no disclosure path in the Fair Price Protection Act.
Personalized pricing of groceries and other foodstuffs based on personal data is an unlawful
practice, full stop, subject only to the enumerated permitted price differences. Adding a banner in
New Jersey accomplishes nothing except to evidence the practice.

**The consequence for a national retailer.** The four regimes cannot be satisfied by a single
global change. The realistic architectures are:

1. **Stop triggering everywhere.** Price on non-personal inputs only — market-wide supply and
   demand, inventory, objective costs, geography-based cost differences — and confine
   personalization to the enumerated loyalty and publicly disclosed discount safe harbours. This is
   the approach compliance counsel is broadly recommending, and it is why the observed disclosure
   rate in general retail is near zero (§6).
2. **Geo-fence the rules.** Ban-comply in MD/CT/NJ and disclose in NY, with per-state string
   selection. Operationally heavy, and it requires reliable state-of-consumer determination —
   itself a use of location data that interacts awkwardly with New Jersey's "location" definition
   and New York's device-linked "personal data."
3. **Disclose everywhere with the broadest string.** Does not work. Maryland's string does not
   satisfy New York's, Connecticut's asserts a different fact, and in the banned sectors no string
   is a defence.

Only (1) is simple, and (1) is a business decision about pricing capability, not a legal-copy
decision. **That is the real content of these statutes: three of the four states have effectively
made personalized consumer pricing unavailable in their covered sectors rather than merely
labelled.**

---

## 4. The federal layer

### 4.1 FTC Proposed Enforcement Policy Statement on Personalized Pricing (P034101)

**Dated 2026-08-19; released for public comment. Comment period is 30 days from Federal Register
publication.** *(The prior research in this project records a Commission vote of 2–0; that vote
count was not re-verified from an FTC source in this pass — treat it as unconfirmed.)*

**It is not binding, and it says so.** From the statement's own closing paragraph, quoted verbatim:

> "This Policy Statement does not confer any rights on any person and does not operate to bind the
> FTC or the public. In any enforcement action, the Commission must prove the challenged act or
> practice violates at least one existing statutory or regulatory requirement."

And in a footnote attached to the examples:

> "Examples described herein are not a comprehensive list of potential legal violations related to
> personalized pricing. Nor are they intended to be definitive statements of the Commission
> relating to the legality of the identified practices. Instead, they are presented for discussion
> purposes only."

**The threshold admission.** The Commission states plainly: *"Congress has not given the Commission
the authority to prohibit personalized pricing outright."* It also concedes the empirical position:
*"The extent to which businesses currently use personalized pricing is not well understood, and the
effects of personalized pricing on consumers are unclear."* Anyone citing this document as evidence
that personalized pricing is widespread is citing it against its own text.

**The two § 5 theories.**

*Deception.* Retailers may deceive when they represent, expressly or by implication, that a price
is static or widely offered when it is in fact personalized — **and equally when a consumer
reasonably believes the price is static and the merchant fails to disclose that it is
personalized.** The materiality argument is stated in a form that is unusually useful:

> "consumers who are unaware of personalized pricing cannot take steps to avoid the higher prices
> that may result from it, such as using a virtual private network or private browsing
> functionality, choosing a different retailer whose prices are static or widely offered, rather
> than personalized, or simply declining to complete the transaction."

A second deception theory covers **misleading consumers as to the basis or effect** of the
personalization — e.g. letting a consumer believe a personalized price is a loyalty discount when
it is in fact a mark-up derived from inferred disposable income.

*Unfairness.* Under 15 U.S.C. § 45(n), the higher price paid may be a **substantial injury**; it is
**not reasonably avoidable** where the fact or nature of personalization is concealed:

> "consumers may not be able to avoid paying the higher personalized price if they lack the
> information or tools necessary to, among other things, modify their behavior to avoid triggering
> higher prices, dispute or correct inaccurate information collected about them that is leading to
> higher prices, or avoid the collection of that data in the first place."

The Commission expressly reserves the harder question: it "declines at this time to take any
position on whether some personalized pricing practices are unfair even when fully disclosed."

*A third, data-side theory.* Businesses that **collect, use or disclose personal data for the
purpose of personalized pricing** without adequate disclosure or consent may violate § 5; so may
businesses that price on personal data **without sufficiently verifying that consumers consented to
the collection of those data for that purpose.** This is the theory closest to the California
purpose-limitation approach in §5 below, and it is grounded in the Commission's location-data cases
rather than in pricing cases.

**What adequate disclosure looks like, per the FTC.** Three elements: the fact that the price is
personalized, **the basis for that personalization**, and **the types of data used**. The statement
says telling a consumer only that he is receiving a "specially selected" price "would likely be
misleading because it omits important information," and gives a worked example of a sufficient
disclosure: that the price is based on estimated willingness to pay derived from the consumer's
previous purchases from the same retailer through the same login account.

> **Compliance consequence, and it is a real one.** **None of the three state-mandated strings
> satisfies the FTC's stated standard.** New York's, Maryland's and Connecticut's strings disclose
> the *fact* of personalization but not the *basis* or the *data types*. A business that displays
> the New York string and nothing else is compliant with New York and, on the face of this proposed
> statement, still exposed under § 5. That gap between state-mandated minimum wording and the
> FTC's proposed standard is, in this author's view, the most actionable single finding in this
> brief — and it is inference from the two texts, not anything either regulator has said.

**What the FTC says prices may lawfully vary on.** Supply and demand affecting everyone in the same
market, including "intensely local" variation such as rideshare pricing across adjacent
neighbourhoods; "regional differences in taxes, regulations, and market conditions"; and products
whose price "necessarily" turns on individual characteristics — insurance and credit. These
carve-outs track the state statutes' cost/geography/supply-demand exclusions closely.

**The seven illustrative scenarios**, in the statement's own order — each framed as personalized
pricing *without adequate disclosure* that would raise § 5 concerns:

1. A **food delivery company** quoting a higher price to consumers based on data suggesting they
   are less likely or unable to leave their homes to buy food.
2. A **grocery chain** charging a delivery customer more for milk based on data showing several
   children live in the household.
3. A **hotel** charging more based on data suggesting the consumer is travelling for a funeral or
   other can't-miss personal business.
4. A **rideshare company** charging more based on data showing the user has not installed any
   competitor apps.
5. A **rideshare company** charging more for transport to a medical facility based on data
   suggesting a life-threatening medical emergency or condition.
6. A **retailer** charging more for a home-security camera system based on court filings showing
   the customer was recently the victim of a crime.
7. A **retailer** charging more for a product on its website based on data showing the consumer is
   **inside one of the retailer's physical stores or parking lots** while browsing.

Note the pattern: every scenario turns on **inferred vulnerability or inferred inability to
comparison-shop**, not on algorithms as such. Scenario 7 is the one most likely to catch a business
by surprise, because in-store-versus-online price differentiation is an established retail practice
and the statement's objection is to keying it to the individual's real-time location.

**Related authorities the statement points at.** ROSCA (15 U.S.C. §§ 8401-8405) and the Rule
Against Unfair or Deceptive Fees (16 C.F.R. pt. 464) may be independently violated by the same
conduct. It also cites FCRA § 1681m(a) adverse-action notices and state insurance disclosure laws
as **existing public policy supporting** the unfairness analysis under § 45(n) — while noting that
public policy "may not serve as a primary basis" for an unfairness determination.

### 4.2 Robinson-Patman does not reach consumer personalized pricing

*[This section is completed below from a dedicated research pass — see §4.2 continued.]*

---

## 5. The California angle: a privacy statute pressed into pricing service

California has enacted no algorithmic-pricing statute. It is nonetheless the most active
enforcement jurisdiction in the country on this subject — because its Attorney General opened an
investigation using a **privacy** theory rather than a pricing theory. Understanding why he had to
is the most doctrinally useful thing in this brief.

### 5.1 What the Attorney General actually did, and actually said

On **Tuesday, January 27, 2026** — Data Privacy Day — Attorney General Rob Bonta announced an
investigative sweep. From the press release, verbatim:

> "In honor of Data Privacy Day, California Attorney General Rob Bonta today announced an
> investigative sweep focused on businesses' use of consumers' personal information to set
> targeted, individualized prices for products and services, a practice known as surveillance
> pricing. Surveillance pricing practices may trigger obligations under and even violate the
> California Consumer Privacy Act (CCPA), which includes a 'purpose limitation principle' that
> limits a business's use of personal information to purposes that are consistent with the
> reasonable expectations of consumers. Businesses that use data in ways that targeted consumers
> might not expect — including by using that data to set individualized prices — may be violating
> California law. As part of the sweep, the California Department of Justice is sending letters to
> businesses with significant online presence in the **retail, grocery, and hotel** sectors."

And in the release's background section:

> "Under the CCPA's 'purpose limitation' principle, businesses are limited in their use of personal
> information to purposes that are consistent with the reasonable expectations of consumers."

The letters request four categories of information, in the release's own words: companies' use of
consumer personal information to set prices; policies and public disclosures regarding personalized
pricing; any pricing experiments undertaken; and measures taken to comply with "algorithmic
pricing, competition, and civil rights laws."

> **⚠️ The citations in circulation are not the Attorney General's.** The press release contains
> **no statutory or regulatory pinpoint citations at all** — not Civ. Code § 1798.100(c), not 11
> CCR § 7002, not § 1798.125. It invokes a *principle* by name and stops. The section numbers that
> now appear throughout the practitioner literature were supplied afterward by **law firms
> reconstructing the theory** (Troutman, Reed Smith and Pillsbury map it to § 1798.100(c); Baker
> McKenzie is the only alert located that pinpoints 11 CCR § 7002(b)). Verified by direct search of
> the release's source. Anyone writing that "the AG invoked § 1798.100(c)" is repeating an
> inference as a citation.

> **⚠️ Date.** The release is dated **January 27, 2026**. Several firm alerts say January 28 —
> apparently conflating it with Data Privacy Day itself — and at least one carries a "January 28,
> **2025**" typo. The primary source controls.

### 5.2 Why purpose limitation and not the non-discrimination provision — the answer is on the record

The intuitive CCPA hook for differential pricing is **Civ. Code § 1798.125**. It was not used. The
best available explanation is not a lawyer's theory — it is a statement made on the record in the
California Legislature by the people *advocating* for regulation.

In the **Assembly Committee on Privacy and Consumer Protection** analysis of **AB 2564 (Ward)**,
prepared for the hearing of **March 25, 2026** by Julie Salley, under ARGUMENTS IN SUPPORT, the
analysis reports that "a large coalition of advocacy organizations notes":

> "While California consumers benefit from some privacy protections under the California Consumer
> Privacy Act, **no existing federal or state law prohibits companies from using the data they
> collect to charge consumers individually different prices.** AB 2564 closes this gap."

That is the pro-regulation coalition conceding, in an official legislative document, that the CCPA
— § 1798.125 included — does not reach ordinary personalized pricing. It is far stronger authority
for the proposition than any client alert, because it is an admission against interest by the party
that would most like the law to be otherwise.

The same committee analysis characterizes the CCPA's rights in terms that make the limit explicit,
describing the statute as granting notice, access, disclosure and deletion rights "and **protection
from discrimination for exercising these rights**."

**Two structural reasons the section cannot do the work — this is the brief's own analysis, not
attributed to any commentator.** No named source located has published either argument about this
sweep; both are read directly off the statutory text.

1. **§ 1798.125 requires a predicate act by the consumer.** Its official heading is "Consumers'
   Right of No Retaliation Following Opt Out or Exercise of Other Rights," and subdivision (a)(1)
   bars discrimination — including "[c]harging different prices or rates for goods or services" —
   only "**because the consumer exercised any of the consumer's rights under this title**."
   Ordinary surveillance pricing involves no exercise of any CCPA right: the consumer never opted
   out and never submitted a request. With no predicate, the section has nothing to attach to.
2. **§ 1798.125 contains a safe harbour that would arguably legitimise the conduct.** Both
   (a)(2) and (b)(1) permit a business to charge "a different price or rate … **if that difference
   is reasonably related to the value provided to the business by the consumer's data**." That is
   uncomfortably close to a description of the practice. Proceeding under § 1798.125 would hand
   every target a statutory defence built into the same section.

**Purpose limitation has neither problem.** Civ. Code § 1798.100(c), verbatim:

> "A business' collection, use, retention, and sharing of a consumer's personal information shall
> be reasonably necessary and proportionate to achieve the purposes for which the personal
> information was collected or processed, or for another disclosed purpose that is compatible with
> the context in which the personal information was collected, and not further processed in a
> manner that is incompatible with those purposes."

It reaches the **collection and use itself**, needs no predicate act, and carries no
value-of-data carve-out. The implementing regulation, **11 CCR § 7002**, supplies the operative
test — and it opens by tying itself to the statute: "**In accordance with Civil Code section
1798.100, subdivision (c),**" a business's collection, use, retention and/or sharing "shall be
reasonably necessary and proportionate." Subdivision (b) then supplies the standard the AG
paraphrased almost word for word:

> "The purpose(s) for which the personal information was collected or processed shall be
> **consistent with the reasonable expectations of the consumer(s)** whose personal information is
> collected or processed."

Section 7002(b) then lists five factors for determining reasonable expectations: the relationship
between consumer and business; the type, nature and amount of personal information; the source and
collection method; the specificity, prominence and clarity of disclosures, including the Notice at
Collection; and the degree to which the involvement of service providers, contractors and third
parties is apparent to the consumer. *(Quoted from the version operative 1 January 2026 — § 7002
was amended in the CPPA's ADMT, risk-assessment and cybersecurity-audit package approved by OAL on
2025-09-23, so the widely circulated 2023 text is stale in minor wording.)*

Note a confirming detail from the regulation's own authority note: **§ 7002 cites §§ 1798.100,
1798.106, 1798.121, 1798.130, 1798.135 and 1798.185 — it does not cite § 1798.125.** The two are
separate regimes on the face of the regulatory text.

### 5.3 Why this matters doctrinally

**A purpose-limitation theory converts a pricing question into a disclosure-and-expectations
question, and it does so without needing a pricing statute.** The AG does not have to prove that
prices were unfair, that any consumer was harmed, that competition was injured, or that anyone
exercised a privacy right. He has to show that personal information was used for a purpose
inconsistent with what consumers reasonably expected — and § 7002(b)(4) makes the business's **own
notices and disclosures** the principal evidence. That is a case the state can largely build from
the target's own website.

**The practical consequences for a business:**

- **Every state with a comprehensive privacy law that includes purpose limitation now has this
  hook available**, whether or not it has a pricing statute. California is the demonstration, not
  the exception.
- **The compliance artifact is the Notice at Collection**, not the price. If a business's notice
  discloses that personal information is used to determine pricing, in terms specific and prominent
  enough to satisfy § 7002(b)(4), the reasonable-expectations argument weakens considerably. If the
  notice is silent or generic, the argument is strong.
- **This converges with New Jersey and with the FTC.** New Jersey's Fair Price Protection Act
  § 3(c) provides that personal data used to offer a permitted price difference "shall not be used
  for any other purpose without the consumer's consent" — a purpose-limitation clause inside a
  pricing statute. The FTC's proposed statement advances a parallel data-side theory: businesses
  that price on personal data "without sufficiently verifying that consumers consented to the
  collection of those data for that purpose" may violate § 5. Three regulators, three statutes,
  the same move.
- **It is not obviously a winner.** No enforcement action has been filed, and reading "reasonably
  necessary and proportionate" to prohibit a use the legislature has repeatedly declined to
  prohibit outright is an aggressive construction. The coalition quote in §5.2 cuts both ways: it
  supports the AG's reason for choosing the theory, and it is also the best argument that the
  theory is a workaround for a gap the Legislature has not yet closed.

### 5.4 An unwritten story: the same sweep, a different hook, four years apart

Worth recording because no reviewed commentary has connected the two.

| | **Data Privacy Day 2022** | **Data Privacy Day 2026** |
|---|---|---|
| **Date** | 2022-01-28 | 2026-01-27 |
| **Office** | California AG (Bonta) | California AG (Bonta) |
| **Targets** | "Major corporations in the **retail, home improvement, travel, and food services** industries" operating loyalty programs | Businesses with significant online presence in **retail, grocery, and hotel** sectors |
| **Hook** | The CCPA's **notice-of-financial-incentive** requirement — which lives in **§ 1798.125(b)** | The CCPA's **purpose limitation principle** — unpinpointed, mapped by commentators to § 1798.100(c) / 11 CCR § 7002 |
| **Mechanism** | Notices of non-compliance with a **30-day cure** period | Investigative letters requesting information |

Same office, same annual news peg, overlapping sectors, and the same underlying commercial conduct
— data-for-price exchange — approached through **§ 1798.125 in 2022 and around it in 2026**. In
2022 the office used the section for what it plainly does (notice of a financial incentive); in
2026, when the target was the *price* rather than the *notice*, it reached for a different
principle entirely.

**Presented as an observed contrast, not as evidence of intent.** Nothing in either release
explains the choice, and the two sweeps address different conduct — a loyalty program's disclosure
obligations are not personalized pricing. The contrast is suggestive of the limits of § 1798.125,
not proof of them. It is offered because it is checkable and, as far as this research could
determine, unremarked.

### 5.5 AB 2564 (Ward) — pending, and on a clock

The bill that would give California an actual pricing statute. Status verified from the
Legislature's own bill-status page on 2026-08-21:

| | |
|---|---|
| **Measure** | AB 2564 (Ward), principal coauthor Wahab (S), coauthor Kalra (A) |
| **Official title** | "An act to add Part 5.6 (commencing with Section 7200) to Division 4 of the Civil Code, relating to consumer protection" |
| **Operative provision** | Proposed § 7201(a): "**Except as provided in subdivision (b), a retailer shall not engage in surveillance pricing.**" A ban, not a disclosure |
| **Status** | **"Active Bill – In Floor Process."** Last action **08/18/26 — "Read second time. Ordered to third reading."** Last amended 08/17/26 (Senate). Location: Senate. **No action since 08/18/26** |
| **Next step** | Senate third-reading floor vote; if it passes, back to the Assembly for concurrence in Senate amendments |
| **Deadline** | Under the published 2026 legislative calendars, **August 31, 2026 is the last day for each house to pass bills** in this two-year session. The bill has roughly ten days |
| **Co-sponsors** | Consumer Reports and TechEquity Collaborative |
| **Naming caution** | "End Surveillance Pricing Act" is the **author's and advocates' name**, not a codified short title — the bill text contains no "shall be known as" clause, and TechEquity calls it the "Surveillance Pricing Protection Act." In anything citation-sensitive, use **"AB 2564 (Ward)"** |

If AB 2564 passes and is signed, California becomes the **fifth** state and the **fourth ban**
state, and the largest consumer market in the country closes to personalized retail pricing. If it
dies on 31 August, the purpose-limitation theory in §5.2 remains California's only tool — which is
precisely the gap the coalition described.

### 5.6 A distinction that must not be blurred

> **The companies named in this story are named for two entirely different reasons, and confusing
> them would be fabrication.**
>
> **Recipients of the AG's 2026 investigative letters: none are known.** The press release gives
> sectors only — retail, grocery, hotel. **It states no number of companies and names no
> recipient**, and no copy of the letter has been published. Four independent law-firm alerts
> (King & Spalding, Paul Weiss, Pillsbury, Reed Smith) likewise report no count and no names. Note
> the precise state of the record: this is an **absence of disclosure**, not a refusal — the office
> was not asked on the record and did not decline. Any statement about who received a letter would
> be invented.
>
> **Companies named in the surrounding record — Instacart, Eversight, Albertsons, Costco, Kroger,
> Safeway, Sprouts Farmers Market, Target — appear as subjects of the Consumer Reports / More
> Perfect Union / Groundwork Collaborative investigation** as recounted in the AB 2564 committee
> analysis, and Instacart additionally as the subject of the New York AG's letter. **None of them
> is identified anywhere as a recipient of a California investigative letter.** The AG's own
> release mentions Instacart solely as the subject of the Consumer Reports investigation, and notes
> that Instacart "has since publicly stated that it has stopped offering technology that allowed
> grocery retailers to charge shoppers different prices."

### 5.7 California verification notes

- **Primary, read directly:** the AG press release of 2026-01-27 (including a source-level check
  confirming the absence of any statutory citation); Civ. Code §§ 1798.100(c) and 1798.125 from
  leginfo; 11 CCR § 7002(a)–(b) from the CPPA's regulation text operative 2026-01-01; the Assembly
  Privacy and Consumer Protection Committee analysis of AB 2564 for the 2026-03-25 hearing; the AB
  2564 bill-status page; the 2022 sweep press release.
- **Secondary:** the § 1798.100(c) and § 7002 mappings; the 2022 sweep's sector list and 30-day
  cure detail.
- **The brief's own analysis, unattributed to any commentator:** the exercise-of-rights predicate
  argument and the value-of-data safe-harbour argument in §5.2; the 2022/2026 contrast in §5.4.
  **No located commentator analyses the § 1798.125 omission** — eight firms were checked
  (Pillsbury, Reed Smith, Troutman, King & Spalding, Paul Weiss, Holland & Knight, Crowell, Baker
  McKenzie) and a targeted search for "surveillance pricing" together with "1798.125" returned
  nothing on point. **Do not attribute this reasoning to any firm.**
- **Could not verify:** the number of letters and any recipient's identity; a reported March 2026
  response deadline (one search summary asserted it; no openable source confirmed it); any AG
  follow-up action since 2026-01-27 (the newsroom scan was not exhaustive, so treat that negative
  as soft); any express AG citation to 11 CCR § 7002.
- **Unchecked, and flagged rather than glossed:** the **ABA Antitrust Law Section's "When Pricing
  Gets Personal: Defining and Regulating Surveillance Pricing" (April 2026)** returned 403 and was
  not read. It is the likeliest place a genuine § 1798.125 analysis exists, and its absence from
  this brief is a gap in the survey, not evidence that the literature is exhausted.

---

## 6. Observed compliance reality

The following is from this project's own compliance sweep (`research/NY-349A-COMPLIANCE-SWEEP.md`,
2026-08-21), which searched for real-world instances of the New York mandated string. It is
observation, with its coverage limits stated. It is not a statistical sample.

**Who is complying, and it is one category.** Digital-subscription publishers — **Wall Street
Journal, Wired, The New Yorker, Albany Times Union, NJ.com** — carry the mandated string on
renewal pricing. Renewal and win-back pricing keyed to a subscriber account is textbook
personalized algorithmic pricing, and the publishers have responded by disclosing rather than by
stopping. Two observed formulations:

- Standalone, all caps: `THIS PRICE WAS SET BY AN ALGORITHM USING YOUR PERSONAL DATA.`
- With a New York preamble: `NEW YORK RESIDENTS: PLEASE NOTE THAT WE ARE REQUIRED TO INFORM YOU
  THAT THIS PRICE WAS SET BY AN ALGORITHM USING YOUR PERSONAL DATA.`

**Where the disclosures actually live is renewal *email*, not web pages.** That matters for anyone
trying to measure compliance from the outside, and it matters for a compliance team: if your
personalized pricing is communicated by email, the disclosure obligation attaches to the email,
because the statutes require the disclosure in **the same medium as** the price communication.

**One enforcement action, and it is instructive.** The New York Attorney General's letter to
Maplebear/Instacart of **2026-01-08** (read in full) quotes Instacart's live disclosure carrying the
mandated string — in lower case, buried mid-sentence on a fine-print-linked pricing-policy page —
and concludes it **fails the "clear and conspicuous" standard** and is **absent from category and
product pages**, which is where prices are actually displayed. The link labels the AG identified
were "View pricing policy" (Stop & Shop), "Higher than in-store prices" (Wegmans) and "Pricing &
fees" (Costco). Instacart ended its item price tests on 2025-12-22.

> **The lesson for compliance teams: having the string somewhere is not compliance.** All four
> statutes tie the disclosure to *each* price communication — New York and Maryland both use "on,
> at, or near and contemporaneous with," and Connecticut requires it be "readily visible to the
> average consumer." A linked policy page is the pattern the AG has already rejected once.

**General retail, travel and ticketing: no hits.** Reverse-searching the mandated string across the
web index surfaced only the publishers, Instacart, and law-firm explainers. Direct page fetches
retrieved real page text with the string **absent** on Ticketmaster, Uber's price-estimate page,
Kayak, StubHub and Instacart help.

**Honest coverage limits — state these whenever the finding is cited:**

- **Bot walls blocked the highest-value targets.** Amazon, Walmart, Best Buy, Expedia, Booking,
  DoorDash, SeatGeek and the WSJ checkout returned CAPTCHA, 403, 429, 500 or timeout. These are
  could-not-verify, not verified-absent.
- **No logged-in, New-York-geolocated checkout flow was reachable** — which is precisely where a
  personalized price would render.
- **Absence of the string is not evidence of compliance or of non-compliance.** It is equally
  consistent with (a) the retailer not personalizing at all, (b) the retailer personalizing and not
  disclosing, and (c) the retailer personalizing only in flows the sweep could not reach.

**The most likely explanation is (a), and it is a policy success.** The compliance counsel guidance
reviewed (Proskauer, Skadden, Duane Morris, Norton Rose, Hunton) consistently advises clients to
**avoid triggering** these statutes by pricing on non-personal or generalized data, rather than to
disclose. If that advice is being followed, near-zero observed disclosure in general retail means
near-zero personalized pricing in general retail — which is what the statutes were for.

**There is no compliance-SaaS ecosystem for this, at all.** Searches for a § 349-a disclosure
widget or vendor, and for subscription platforms (Piano, Zuora, Recurly) shipping a disclosure
feature, returned nothing. Unlike cookie consent — where OneTrust and TrustArc created a shared
script, `aria-label`, data-attribute and CSS-class convention — **every observed implementation of
a pricing disclosure is hand-written legal copy.** Two consequences: there is no vendor
fingerprint to detect or audit against, and there is an unserved market. As of today a compliance
team implementing these four regimes is building from scratch.

**A note on detection.** Because there is no vendor convention, text matching is the only viable
detection method — and it is sufficient, because the strings are statutorily fixed and
distinctive. Any detector must match a **family** of strings case-insensitively, not one literal:
real implementations re-case and embed them. Practical anchors: `set by an algorithm`,
`price setting device`, `using your personal data`, `personalized algorithmic pricing`, and the
`NEW YORK RESIDENTS:` preamble. Connecticut's "or a substantially similar disclosure" means a
Connecticut detector cannot be exact-match by construction.

---

## 7. Practical compliance checklist

Ordered by deadline. This is a starting framework for counsel to adapt, not a compliance program.

### Phase 1 — inventory (do now; needed for all four states)

1. **Map every input to every consumer-facing price.** For each, record whether it is *personal
   data* as each state defines it. New York's definition reaches data linkable to a **device**.
   Maryland's excludes de-identified and publicly available information. New Jersey's expressly
   includes **derived and inferred** data.
2. **Separate the four things that get conflated**, because only the first is regulated:
   (a) personalized pricing — this individual's data changes this individual's price;
   (b) geographic/ZIP variation; (c) dynamic pricing on market-wide supply and demand;
   (d) randomized A/B price testing. All four statutes and the FTC statement exclude (b) and (c)
   in substance. **(d) is genuinely unsettled** — an A/B bucket assigned at random is not based on
   personal data, but a bucket assigned from a user identifier arguably is.
3. **Identify every channel in which a price is communicated**: web PDP, category page, cart,
   checkout, mobile app, email, push notification, physical shelf label, electronic shelf label,
   printed circular, third-party marketplace listing. The disclosure duties attach **per
   communication**, in **the same medium**.
4. **Inventory third-party pricing and personalization vendors** and determine, contractually, what
   consumer data each receives and whether it is used to set price. Connecticut and New York both
   reach **service providers**; New Jersey's definition of "person" reaches agents and employees.

### Phase 2 — decide the architecture (before 2026-10-01)

5. **Decide, per state and per sector, whether you are stopping or disclosing.** In Maryland's
   food sector, Connecticut's retail sector and New Jersey's grocery sector, **disclosure is not an
   option** — the conduct is banned.
6. **If stopping: re-derive prices from permitted inputs only.** Objective costs, shipping, taxes,
   location-based cost differences, supply and demand, inventory, availability, price-error
   correction, post-outage resets. Note **New Jersey's 24-hour rule** — a cost-based price
   difference is permitted only if the price is not changed more than once in a 24-hour period.
7. **If disclosing: implement per-state strings, not one string.** Verify the mandated text
   character-for-character against the enacted statute, not against a summary. Two of the three
   circulating versions of Connecticut's string are wrong.
8. **Add the FTC's three elements to the state string.** The state strings disclose the fact of
   personalization only. Adding the *basis* and the *data types* is what the FTC's proposed
   standard asks for, and doing so does not jeopardise the state disclosure so long as the mandated
   text itself remains intact, clear and conspicuous. *(Inference — no regulator has blessed a
   combined disclosure.)*

### Phase 3 — audit the safe harbours (before 2026-10-01)

Every one of these statutes protects loyalty programs and publicly disclosed discounts — **on
conditions that differ**. Audit each program against all four:

9. **Voluntary, affirmative opt-in.** Required in MD, CT and NJ. Enrolment by default fails.
10. **Uniform terms.** NJ requires all members receive pricing benefits "pursuant to uniform terms
    and conditions." CT requires the discount be offered to **all** consumers on the posted terms.
11. **Public posting.** CT requires the discounted price *and* its uniform terms be prominently
    posted on the website in language readily understandable by the average consumer. NJ requires
    public disclosure of all terms, conditions and **data practices**.
12. **Data-practice disclosure and regulator access.** NJ requires the program disclose its data
    practices to participants and, **on request, to the Division of Consumer Affairs within 14
    days**. Build the ability to produce that package before the request arrives.
13. **NJ purpose limitation.** Personal data used to offer a permitted price difference **may not
    be used for any other purpose without the consumer's consent.** This is a data-governance
    control, not a pricing control, and it is the provision most likely to be missed by a pricing
    team. It also converges with the California theory in §5.
14. **Tier and history constraints.** New York's pending One Fair Price Act (if signed) would allow
    purchase-history-based tiers only where the history data is **not paired, combined or
    cross-referenced with any other personal data** except the fact of loyalty enrolment. If you
    are rebuilding a loyalty program now, building to that constraint is cheap insurance.

### Phase 4 — New Jersey-specific (before 2027-02-01 and 2027-08-01)

15. **Freeze new electronic shelf label deployments in New Jersey** ahead of **2027-02-01**.
    Document which units were already in operation at each place of business, because the
    repair-and-replace carve-out is keyed to that. Get the inventory recorded before the
    moratorium starts, not after.
16. **Prepare for private plaintiffs, not just an AG.** New Jersey CFA claims carry treble damages
    and fee-shifting and are attractive to the class bar. That changes what "acceptable residual
    risk" means: an AG can be negotiated with and, in three of the four states, must give notice
    first. A class action gives no notice.
17. **Check whether your non-food SKUs are in scope.** Paper goods, cleaning products, health and
    beauty, and pet supplies are inside New Jersey's "groceries and other foodstuffs."

### Phase 4b — privacy-law exposure in states with no pricing statute

Do this regardless of whether you operate in the four states above.

17b. **Read your own Notice at Collection as a regulator would.** Under the California theory in
    §5, the central question is whether using personal information to set a price is "consistent
    with the reasonable expectations of the consumer," and 11 CCR § 7002(b)(4) makes the
    specificity, prominence and clarity of your own disclosures a named factor. If pricing is a
    purpose, say so specifically — a generic "to improve our services" will be the state's best
    exhibit.
17c. **Check purpose-limitation language in every comprehensive privacy state you operate in.**
    California is the demonstration, not the exception. The same hook exists wherever a privacy
    statute limits processing to disclosed, compatible purposes.
17d. **Verify consent provenance for pricing inputs.** The FTC's data-side theory targets pricing
    on personal data "without sufficiently verifying that consumers consented to the collection of
    those data for that purpose." Purchased and inferred data is the exposed category — Maryland's
    definition reaches personal data "regardless of whether the seller collected or purchased" it,
    and New Jersey's expressly includes derived and inferred data.

### Phase 5 — standing posture

18. **Retain the evidence that you are *not* triggering.** If the compliance strategy is "we do not
    price on personal data," the artifact that proves it is a documented pricing-input inventory
    with change control — not an assertion. Under Maryland's and New York's notice-and-cure
    regimes, being able to answer a letter quickly and completely is most of the defence.
19. **Watch four things, in this order:** (i) **California AB 2564** — it faces a 2026-08-31 floor
    deadline and would make the largest consumer market in the country a ban state; (ii) whether
    **New York's One Fair Price Act** is signed — it deletes the mandated string and converts New
    York to a ban; (iii) the Second Circuit in ***NRF v. James*** — a reversal would unsettle every
    mandated string in the country on compelled-speech grounds; (iv) the FTC comment docket and
    whether the policy statement is finalised.
20. **Do not treat the FTC statement as the ceiling.** It is proposed, non-binding, and expressly
    reserves the question of whether some personalized pricing is unfair **even when fully
    disclosed**. A disclosure-only compliance posture is built on a question the Commission has
    declined to answer.

---

## 8. Sources and verification status

### 8.1 Read in full from a primary source

| Source | What was taken from it |
|---|---|
| **Md. Ch. 154, Laws of 2026 (HB 895)** — `mgaleg.maryland.gov/2026RS/Chapters_noln/CH_154_hb0895e.pdf` | Full text of Com. Law §§ 13-321, 13-322; the mandated string; all definitions, carve-outs and exemptions; the 45-day cure; the express no-private-right provision; the § 13-408 and § 13-411 amendments; "Approved by the Governor, April 28, 2026"; effective 2026-10-01 |
| **Conn. P.A. 26-64 (Substitute S.B. 4), § 11** — `cga.ct.gov/2026/ACT/PA/PDF/2026PA-00064-R00SB-00004-PA.PDF` | Full § 11 text; the mandated string and its "or a substantially similar disclosure" qualifier; "price setting device," "surveillance pricing," "retail seller" definitions; all carve-outs and exemptions; CUTPA hook; "enforced solely by the Attorney General"; express bar on a private right of action; effective 2026-10-01. **Full-text search confirmed the act contains no electronic-shelf-label provision** |
| **N.J. ACS for A.4085/A.4523, Third Reprint** — `pub.njleg.gov/bills/2026/A4500/4085_R3.PDF` | Full text as reported by the Assembly Budget Committee 2026-06-28; all definitions; the § 3 prohibition and permitted price differences; § 3(c) purpose limitation; § 4 ESL moratorium and repair carve-out; § 6 restaurant exclusion; § 7 AG remedies **with the $50,000 minimum struck**; § 9 staggered effective dates |
| **FTC Proposed Enforcement Policy Statement Regarding Personalized Pricing, P034101, 2026-08-19** — `ftc.gov/system/files/ftc_gov/pdf/p034101-…pdf` | All quoted passages; both § 5 theories; the data-practices theory; the three-element disclosure standard; all seven illustrative scenarios verbatim in order; the non-binding disclaimer; the "Congress has not given the Commission the authority" and "not well understood" concessions; ROSCA and Fees Rule cross-references |
| **N.Y. A.9349-B (One Fair Price Act), as passed** — `legislation.nysenate.gov/pdf/bills/2025/A9349B` | Full amendatory text; confirms the bill **deletes** the mandated string and rewrites § 349-a into a prohibition; new exceptions; new penalty tier ($5,000 first / $20,000 subsequent); 180-day effective date; severability |
| **N.Y. Senate/Assembly bill status pages for S.8623 and A.9349** | Action histories. A.9349-B **passed Assembly and Senate 2026-06-04**; no delivery, signature, veto or chapter number recorded as of 2026-08-21 |
| **CourtListener appellate docket** for *NRF v. James*, 2d Cir. No. 25-2818 (docket id 73349039) | `dateFiled` 2025-11-05; **`dateArgued` null; `dateTerminated` null** — no argument held, no decision, as of 2026-08-21 |
| **N.Y. AG letter to Maplebear/Instacart, 2026-01-08** (read in full in the earlier sweep) | Quotation of Instacart's live disclosure; the AG's conclusion that it fails "clear and conspicuous"; the specific link labels |
| **Cal. AG press release, 2026-01-27** — `oag.ca.gov/news/press-releases/data-privacy-day-attorney-general-bonta-focuses-surveillance-pricing-compliance` | All quoted passages; the sector list; the four information categories; **and a source-level check confirming the release contains no statutory or regulatory citation** |
| **Cal. AG press release, 2022-01-28** (loyalty-program sweep) | The 2022 sweep's existence, date, target industries and notice-of-financial-incentive hook |
| **Cal. Civ. Code §§ 1798.100(c) and 1798.125** — leginfo | Verbatim text of § 1798.100(c); § 1798.125's heading, the "because the consumer exercised" predicate, and the (a)(2)/(b)(1) value-of-data language |
| **11 CCR § 7002(a)–(b)**, version operative 2026-01-01 — `cppa.ca.gov/regulations/pdf/ccpa_statute_eff_20260101.pdf` | The "in accordance with Civil Code section 1798.100, subdivision (c)" tie; the reasonable-expectations standard; the five factors; the authority note omitting § 1798.125 |
| **Cal. Assembly Comm. on Privacy and Consumer Protection, AB 2564 (Ward) analysis, hearing 2026-03-25** (Julie Salley) — `apcp.assembly.ca.gov/system/files/2026-03/ab-2654-ward-apcp-analysis.pdf` | The advocacy-coalition quote in §5.2 verbatim and its attribution ("a large coalition of advocacy organizations"); the committee's own "protection from discrimination **for exercising these rights**" characterization; the Consumer Reports/More Perfect Union/Groundwork findings and the retailer list, **as study subjects** |
| **Cal. AB 2564 bill-status page** — leginfo, fetched 2026-08-21 | "Active Bill – In Floor Process"; last action 08/18/26; official title; proposed § 7201(a) |

### 8.2 Verified from a reliable secondary source, not read in the original

| Item | Source type | Note |
|---|---|---|
| **N.Y. GBL § 349-a codified text** | FindLaw and NY Senate codified-law pages, triangulated; the NY AG's Instacart letter quotes the section verbatim | The Senate site is behind a bot wall for direct fetch. Substance cross-checked three ways and against the A.9349-B strike-through, which reproduces the current text in brackets — **this is a strong check**, since the amendatory bill must quote existing law exactly |
| **CT signing date 2026-05-27 (Gov. Lamont)** | Multiple law-firm alerts and trade press | The act text is primary; the signing date is not |
| **NJ signing date 2026-07-23 (Gov. Sherrill), P.L. 2026, c. 65** | **NJ Governor's office press release, `nj.gov/governor/news/2026/20260723a.shtml`** (fetched) plus Morgan Lewis, Skadden, Crowell, DLA Piper | The press release confirms the date and the substance but **does not state the chapter number, bill number, effective date, penalties or private right of action**. The chapter designation "P.L. 2026, c. 65" rests on law-firm alerts. **This closes the gap flagged in the earlier research, but only partly — the chapter number itself remains secondary** |
| **MD CPA civil penalty $10,000 / $25,000 (Com. Law § 13-410)** | Justia codified text via search summary | Not read in the original |
| **CUTPA penalties $5,000 wilful / $25,000 order violation (§ 42-110o)** | Justia and CGA OLR reports via search summary | Not read in the original |
| **NJ CFA penalties $10,000 / $20,000 (N.J.S.A. 56:8-13)** | Law-firm alerts | Not read in the original |
| **NRF v. James district court holding of 2025-10-08** | Volokh/Reason, Clark Hill, Bloomberg Law commentary | The opinion itself was not read in this pass. The characterization "factual and uncontroversial" is quoted consistently across sources |
| **FTC comment period of 30 days from Federal Register publication** | IAPP, Wiley, Consumer Finance Monitor | The policy statement PDF does not state a deadline. **No Federal Register publication date was confirmed, so no calendar deadline can be given** |
| **Nieman Lab, 2026-07-22, on publisher compliance** | Recovered via search index and a mirror; the original returned 403 | The verbatim renewal wording is consistent across recoveries |

### 8.3 Inference, clearly labelled — not holdings

1. **New Jersey's private right of action.** The Act does not create one. It attaches, if it
   attaches, because a violation is an "unlawful practice" under the CFA and N.J.S.A. 56:8-19 gives
   a private action for ascertainable loss. Every law-firm alert reviewed reads it this way. **No
   court has so held**, and no court could have — the section is not effective until 2027-08-01.
2. **That no state string satisfies the FTC's proposed disclosure standard.** This is a comparison
   of two texts, not a regulator's statement. It is the brief's own conclusion.
3. **That combining a state string with additional FTC-style detail preserves state compliance.**
   Reasonable, since the mandated text remains present, clear and conspicuous — but untested.
4. **That "not found" in the compliance sweep mostly means "not personalizing."** This is the best
   explanation given the uniform tenor of compliance counsel guidance, but the sweep cannot
   distinguish it from non-disclosure in unreachable flows.
5. **That randomized A/B price testing falls outside these statutes.** The definitions all key on
   personal data, and a randomly assigned bucket is not personal data — but if the bucket is
   assigned from a persistent user identifier, the argument weakens. **No authority either way.**
6. **The two California § 1798.125 arguments** in §5.2 — the exercise-of-rights predicate and the
   value-of-data safe harbour. Both are read off the statutory text by this brief. **No named
   commentator has published either about this sweep.**
7. **The 2022/2026 California sweep contrast** in §5.4. An observed contrast between two published
   press releases. Neither release explains the choice of hook, and the two sweeps address
   different conduct. It is not evidence of intent.
8. **That the § 1798.100(c) / 11 CCR § 7002 mapping is what the AG meant.** The AG named a
   principle; the citations are the bar's reconstruction. The mapping is well supported by § 7002's
   own text, which cites § 1798.100(c) and states the reasonable-expectations standard the AG
   paraphrased — but it remains a reconstruction.
9. **The NY Governor's action deadline.** Under N.Y. Const. art. IV, § 7 the Governor has 10 days
   (Sundays excepted) to act on a bill delivered while the Legislature is in session and 30 days
   when it is not, and bills passed in a session must be delivered before the year ends.
   **No delivery record for A.9349-B was located**, so no specific deadline date is asserted here.

### 8.4 Could not verify — open items

- **Whether the Second Circuit will rule, and when.** The docket shows no argument scheduled. A
  reversal in *NRF v. James* would put every mandated string in the country under compelled-speech
  pressure; an affirmance would settle the point for the Second Circuit only.
- **Whether New York's One Fair Price Act has been delivered to the Governor.** Passed 2026-06-04;
  no delivery, chapter number, signature or veto recorded as of 2026-08-21. **If signed, New York's
  mandated string disappears** and New York becomes the fourth ban state, with penalties rising
  from $1,000 per violation to $5,000 first / $20,000 subsequent and the cease-and-desist
  prerequisite removed.
- **The FTC's Federal Register publication date**, and therefore the actual comment deadline.
- **The Commission vote count** on P034101.
- **The MD, CT and NJ chapter/session-law texts as codified**, as opposed to as enacted. Codified
  section numbering for CT § 11 and the NJ Act was not confirmed.
- **Whether any of the four AGs has opened an investigation** under the Maryland, Connecticut or New
  Jersey provisions. None had, as far as this pass could determine — all three are pre-effective.
- **Whether general retailers are complying in logged-in, geolocated checkout flows.** Structurally
  unreachable from outside.
- **California AB 2564 (Ward)** — no action since 2026-08-18; pending a Senate third-reading vote
  against a 2026-08-31 house-passage deadline. See §5.5 and §5.7.
- **The California sweep's scope.** No source states how many companies received letters and no
  recipient has ever been named. See §5.6 for the distinction between letter recipients (unknown)
  and companies named in the surrounding investigative record (known, and different).
- **ABA Antitrust Law Section, "When Pricing Gets Personal: Defining and Regulating Surveillance
  Pricing" (April 2026)** — returned 403, unread. The likeliest home of a substantive § 1798.125
  analysis. Flagged as an unchecked gap in the survey.

### 8.5 Explicitly not relied on

- Secondary summaries of the Connecticut mandated string. At least two published versions are
  wrong, and one attributes an electronic-shelf-label ban to Connecticut that does not exist in the
  act.
- The widely repeated **$50,000** New Jersey penalty figure. It was struck before enactment.
- Any characterization of the Maryland definitions drawn from the bill's superseded language. The
  chapter law carries visible amendment layering and several summaries quote text that was struck.
- The *American Prospect* piece of 2026-08-21 on FTC enforcement — could not be fetched (403),
  unread, not cited.

---

*Prepared 2026-08-21. Statutory positions stated as of that date. Nothing here is legal advice;
have counsel review before acting.*
