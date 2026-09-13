# Scope and Phases

What Tinzshop must do, and the order it gets built in.

Source: §11 of `reference/client-summary-th.md` for the phases, every other
section for the requirements, and the client's 2026-09-13 answers in
`13-open-questions.md` for everything that changed since. This is the only
scope document — there is no separate requirements file.

> **Sign-off status.** Per Q-001, the client has reviewed the source and
> confirmed the requirements below as **CONFIRMED** unless a specific answer
> changed, removed, or added one — those are marked individually. A
> requirement still carrying a `[Q-0NN]` tag depends on a question that is
> still UNRESOLVED or only PARTIALLY RESOLVED; see `13-open-questions.md`
> before building it.

## Reading this document

- `§n` — a section of the source document.
- `REQ-0NN` — a requirement. Status is CONFIRMED unless marked REMOVED, or tagged `[Q-0NN]` for one still genuinely open.
- `[Q-0NN]` — links to `13-open-questions.md`.
- **Client discussion notes** — loose Thai notes written under the checkboxes in the source. They are meeting notes, not requirements, and must never be treated as scope or implementation instructions.

**The source does not assign requirements to phases.** It gives a phase list
and, separately, a feature list. The mapping below is ours. Q-030's removal of
bank transfer moved K-Payment card payment from phase 4 into phase 3, since it
is now the only payment method rather than one of two — that is the one place
the phase-to-requirement mapping changed materially from the original draft.

---

## Schedule and budget

**Total budget: 100,000 THB for phases 2 through 9** (Q-006). Phase 1
documentation is substantially complete already. This is a lean budget for the
integration list this project carries (K-Payment, BigSeller, Shopee,
Cloudflare, email), which is the reasoning behind several scope-narrowing
answers below — no carrier API, no audit log, no refund engine, no centralized
return/warranty engine, daily-file sync instead of a paid realtime API.

**The schedule below is a proposal from the project side (Q-004), not a
client-committed deadline.** It should go back to the client for confirmation.
It will also move if the BigSeller data-inspection session (the single
dependency behind Q-007, Q-011, Q-012, Q-014 and Q-044) turns up more work than
assumed here, or if Shopee access (Q-042) arrives late.

| Phase | Dates (proposed) | Duration | Why this length |
| :--- | :--- | :--- | :--- |
| 1 — Planning documentation | 2026-09-01 → 2026-09-15 | 2 weeks | Documentation, mostly complete at time of writing |
| 2 — Catalogue, stock, admin foundation, Excel | 2026-09-16 → 2026-10-13 | 4 weeks | Scaffold, schema, roles/2FA, product/variant model, Excel import — the foundation everything else sits on |
| 3 — Storefront, ordering, K-Payment, simplified tax invoice | 2026-10-14 → 2026-11-17 | 5 weeks | Now includes K-Payment integration and testing (moved from phase 4, Q-030) since it is the only payment method and credentials already exist (Q-033) |
| 4 — Shipping tiers, simple label, case-by-case return/claim contact | 2026-11-18 → 2026-12-08 | 3 weeks | Lighter than originally planned — no carrier API, no refund engine, no return/warranty policy engine (Q-034, Q-035, Q-036, Q-037, Q-038) |
| 5 — Pre-order, dropship, BigSeller/Shopee sync | 2026-12-09 → 2027-01-12 | 5 weeks | Includes buffer for the BigSeller data-inspection dependency; extends if Shopee access (Q-042) is still unavailable |
| 6 — News, content pages, product reviews, Sale Page, reports | 2027-01-13 → 2027-02-09 | 4 weeks | Includes migrating existing content before building the new content types |
| 7 — Testing, training, go live | 2027-02-10 → 2027-03-02 | 3 weeks | One Thai training manual (Q-051), acceptance sign-off per `15-acceptance-criteria.md` |
| 8 — Security and bot verification (Cloudflare Free) | 2027-02-24 → 2027-03-02 | 1 week, **run alongside phase 7** | Recommended change from the source's ordering — see *Recommended re-ordering* below |
| 9 — Database backup | 2027-02-24 → 2027-03-02 | 1 week, **run alongside phase 7** | Same reasoning — a live shop with no backup and no bot protection is the wrong order |

**Recommended re-ordering.** The source places security (phase 8) and backups
(phase 9) after go-live. `03-architecture.md` and `10-deployment.md` already
flagged this as worth raising with the client (Q-001's ordering was never
confirmed). Now that a schedule has to be committed to, the recommendation is
made concrete: **run phases 8 and 9 in parallel with the tail of phase 7**, so
Cloudflare and a tested backup both exist before the shop takes its first real
payment. This is a scheduling recommendation, not a requirement change, and
should be confirmed with the client alongside the rest of this schedule.

**Backlog — confirmed in scope, not scheduled.** Loyalty points/gift cards and
a wishlist are confirmed in scope by Q-002 (`+` means "add to scope"), but
neither is detailed anywhere in the source beyond its name, and the 100,000
THB budget does not stretch to building either alongside the nine phases
above. They are held as a post-launch backlog:

| Item | Source | Why deferred |
| :--- | :--- | :--- |
| Loyalty points / gift cards | §10, marked `+` | No design detail exists anywhere in the source; budget does not cover discovery plus build inside phases 2–9 |
| Wishlist, shown in order history | §10, marked `+` | Same — low cost individually, but every addition to the fixed budget displaces something else |

If the client wants either moved into a numbered phase, that is new direction
and should be said explicitly, along with what it displaces.

---

## Requirement index

| Phase | Requirements |
| :--- | :--- |
| 1 — Planning documentation | *(none — this documentation is the deliverable)* |
| 2 — Products, variants, stock, Excel | REQ-004, 005, 006, 020, 032, 033, 034, 035, 036, 037, 038, 051 |
| 3 — Storefront, ordering, K-Payment, invoice | REQ-001, 002, 003, 010 (REMOVED), 011, 016, 019, 023, 024, 025, 026, 041, 042, 052, 053 |
| 4 — Shipping tiers, labels, return/claim contact | REQ-013, 014, 028, 030 |
| 5 — Pre-order, dropship, Shopee sync | REQ-021, 022, 048, 049, 050 |
| 6 — News, content pages, reviews, reports | REQ-027, 039, 043, 044, 045, 046, 047, 054, 055 |
| 7 — Testing, training, go live | *(no new requirements)* |
| 8 — Security and bot verification | *(none written — Cloudflare Free scoped in Q-054)* |
| 9 — Database backup | *(none written — strategy in `10-deployment.md#backup`)* |
| Cross-cutting | REQ-007, 008, 009 |
| Removed | REQ-010, 015, 017, 018, 029, 040 |
| Backlog, not scheduled | Loyalty/gift cards, wishlist (§10, `+`) |

---

## Phase 1 — Planning documentation

- **Dates:** 2026-09-01 → 2026-09-15
- **Deliverables (from the source):** planning documents covering the detail of the work, division of work, scope, and working method, written to a shared format; a clear project structure; and identifying what is not yet known or not yet clear and making it clear. The source names Cloudflare, Shopee, BigSeller, Medusa JS and K-Payment as the subjects to get clear on.
- **Status:** Substantially complete. Medusa JS was evaluated and not chosen ([ADR-0001](adr/ADR-0001-backend-approach.md)). K-Payment, Shopee and BigSeller remain NOT RESEARCHED pending the accounts and data named in `13-open-questions.md`'s residual items. Cloudflare's scope is now fixed (Q-054) even though no configuration exists yet.

This documentation is the deliverable. No requirement is delivered by it.

**Client discussion notes** *(from the §11 table — not commitments)*

- Update on progress with Win every Wednesday at 21:00, and update with the father every two weeks, around the weekend.
- Register one mailbox for Claude Code Enterprise. The exact address is deprioritized — Q-009.

---

## Phase 2 — Products, variants, stock, Excel import

- **Dates:** 2026-09-16 → 2026-10-13
- **Deliverables (from the source):** the product system, product options, stock, and Excel file import.
- **Blocked by:** the BigSeller data-inspection dependency (Q-007, Q-011, Q-012, Q-014, Q-044) for the catalogue's identity rules and the Excel format; Q-013 (Shopee/Lazada option-count research) for the practical maximum enforced in the UI and import, though the underlying model already supports any number.

> The staff authentication and role requirements (REQ-032 to REQ-035, REQ-051)
> are placed here because the admin panel cannot be used without them. **The
> source does not say this** — it is our sequencing.

### Catalogue

**REQ-004 — Parent SKU and ModelSKU structure** · §4 · CONFIRMED, format `[Q-014]`
Each product carries exactly one Parent SKU, and each model of that product carries its own ModelSKU. The format of both is not invented — it comes from inspecting real BigSeller data (Q-007, Q-014).

**REQ-005 — Multiple option types per product** · §4 · CONFIRMED, cap `[Q-013]`
A product can have more than one option type (for example colour × capacity), and each resulting combination can carry its own code, price and stock quantity. **No hard-coded cap of two** — the join-table model in `05-database.md` already supports any number. The practical maximum the import/UI enforces still waits on Shopee/Lazada research.

**REQ-006 — Public availability status without real quantities** · §4 · CONFIRMED (narrowed)
The storefront shows availability as **in stock or out of stock** — never a real quantity. Low stock is removed from this requirement (D-065, Q-019).

### Stock

**REQ-020 — True stock deduction with no overselling** · §4 · CONFIRMED (timing decided, D-068)
Stock is deducted for real and the shop cannot sell more units than it holds. For a normal order, deduction happens when K-Payment confirms payment, not at order placement. For a pre-order, a reservation quota is held at order time and stock is only actually deducted when goods are recorded as received from the supplier — see REQ-048 and Q-024.

### Admin back office

**REQ-032 — Two-step verification for staff** · §8 · CONFIRMED (narrowed)
Staff sign-in requires a second factor via **email OTP** (D-064, Q-017). No SMS/phone OTP.

**REQ-033 — Single bilingual admin entry point** · §8 · CONFIRMED
Staff use one place to sign in, and the admin panel is usable in both Thai and English.

**REQ-034 — Six roles, permission-based access** · §8 · CONFIRMED (rewritten)
Access is divided among six roles: Blogger, Sale-manager, Admin, Top-level Admin, Customer, and Guest (D-062, Q-015). Customer and Guest are rows in the same `role`/`role_permission` tables as the four staff roles, not a special case.

**REQ-035 — Owner-configurable role permissions, editing only** · §8 · CONFIRMED (narrowed)
The shop owner can adjust the permissions of each of the six existing roles themselves, without a developer changing code. **There is no "create a new role" capability** (D-063, Q-016).

**REQ-036 — Product list grouped by parent with expandable variants** · §8 · CONFIRMED
The product management screen lists parent products, and a parent can be expanded to show its variants.

**REQ-037 — Inline and bulk editing of price, stock and status** · §8 · CONFIRMED
A staff member can change price, stock and status directly from the product list, and can change several products at once.

**REQ-038 — Excel import and export with validation and dry run** · §8 · CONFIRMED, format `[Q-012]`
Staff can import and export products as an Excel file. The import can create new products, fully supports multi-option products, reports errors before saving, and offers a trial mode that shows the result without writing anything. The column layout is not invented — it follows BigSeller's actual export format once inspected (Q-012).

**REQ-051 — Staff roles** · §8 · CONFIRMED (see REQ-034)
The four staff roles: Blogger (writes news only), Sale-manager (products, stock, orders, finance), Admin (oversees everything), and Top-level Admin (adds and removes staff, and configures the system).

### Removed

**REQ-040 — Audit history of changes** · §8 · **REMOVED** (D-066, Q-020)
No audit log of price, stock or order-status changes is built.

**Client discussion notes** *(from §4 and §8 — not requirements)*

- BigSeller: noted for further study, for managing stock. The daily file export/import approach is now the confirmed primary mechanism (D-081, Q-043); the paid API is a future option only.
- Two open notes were recorded: BigSeller codes, and finding out how to pull data out of Shopee. Both are now tracked as the residual "BigSeller data inspection" dependency in `13-open-questions.md`.
- Noted against phase 2: gather how things are really used on Shopee, what its limitations are — still a research item (Q-045). Also noted: an order slipping through without stock being updated — the reconciliation rule is now decided (Shopee is authoritative, D-082); the detection mechanism itself still waits on seeing real export formats.

---

## Phase 3 — Storefront, ordering, K-Payment, simplified tax invoice

- **Dates:** 2026-10-14 → 2026-11-17
- **Deliverables (from the source, as revised):** the storefront, ordering, K-Payment card/instalment/PromptPay-QR payment, and the simplified tax invoice. **K-Payment is folded into this phase** because bank transfer (its original phase-3 payment method) is removed, leaving no payment method at all for phase 3 unless K-Payment moves up — and its credentials already exist (Q-033).
- **Blocked by:** phase 2 complete; conducting K-Payment sandbox testing (Q-033 residual); an example invoice, to finalize the exact simplified-invoice fields (Q-027 residual).

### Storefront

**REQ-001 — Browse products by category** · §2 · CONFIRMED
A customer can browse products filtered to a category. The categories named are Nintendo Switch, PlayStation 5, IT Gadgets and Pre-Order.

**REQ-002 — Search in Thai and English** · §2 · CONFIRMED
A customer can search the catalogue using Thai text and using English text, and matching products are returned for both.

**REQ-003 — Select a variant and see its price and availability** · §2 · CONFIRMED
On a product page, a customer can select option values such as colour or capacity, and the price and remaining availability of that specific model are shown immediately without a page reload.

### Ordering

**REQ-010 — Order without registering** · §2 · **REMOVED** (D-061, Q-022)
There is no guest checkout. A signed-out visitor sees only the front page's products (REQ-053); placing an order requires a customer account.

**REQ-011 — Customer account with order history** · §2 · CONFIRMED
A customer can register, sign in, view their past orders, and download the simplified tax invoice for an order.

### Payment

**REQ-016 — K-Payment: card, instalments and PromptPay QR** · §3 · CONFIRMED (expanded, moved from phase 4)
A customer pays through K-Payment (Kasikorn Bank) — by credit or debit card, immediately or in instalments (REQ-019, now confirmed in scope, D-089), or via PromptPay QR reached through the K-Payment flow. The system updates payment status automatically from the K-Payment callback, with no staff action required. **This is the only payment method** — bank transfer is removed (D-072, Q-030) and standalone PromptPay is not offered (D-071, Q-029).

### Tax and documents

**REQ-023 — 7% VAT, already included in displayed prices** · §6 · CONFIRMED (resolved)
Every displayed product price already includes 7% VAT. The order-totals function extracts the VAT component; nothing is added on top (D-060, Q-010).

**REQ-024 — Automatic simplified tax invoice as a PDF** · §6 · CONFIRMED
A simplified (abbreviated) tax invoice is produced automatically for every order as a PDF, which the customer downloads from their order history. The website generates **only** this document; a full tax invoice, when a customer needs one, is generated by a separate system from data we provide (D-069, Q-026, Q-027). The exact output fields wait on an example invoice.

**REQ-025 — Gap-free sequential invoice numbers** · §6 · CONFIRMED, format `[Q-027]`
Tax invoice numbers run in an unbroken sequence with no skipped numbers, including when several orders are placed at the same time. Number format (prefix, year reset, width) is still open.

**REQ-026 — Five-year document retention, with a PDPA exception** · §6 · CONFIRMED (resolved)
Documents remain retrievable for 5 years as required by law. A PDPA deletion request erases personal fields not covered by this rule; fields on a retained tax/accounting document are kept as an accepted legal exception (D-070, Q-028).

### Notification

**REQ-041 — Automatic email at every order step** · §8 · CONFIRMED `[Q-023]`
The system sends email automatically at each step. The exact set of steps depends on the order-status model, which is still a candidate pending client review — see Q-023.

**REQ-042 — Order-status history, viewable and filterable** · §8 · CONFIRMED (rewritten)
A customer can view their order-status history and filter it by date range and by status (D-073, Q-031). This replaces the earlier "customers can turn notifications on and off" reading — there is no transactional-email opt-out anywhere in scope.

### Roles

**REQ-052 — Customer role** · §8 · CONFIRMED
A customer can place orders, follow their order status, and read news.

**REQ-053 — Signed-out visitor** · §8 · CONFIRMED (no longer contradictory)
A visitor who is not signed in can see only the products on the front page. This is now the confirmed rule, not a contradiction (D-061, Q-022).

**Client discussion notes** *(from §3 and §8 — not requirements)*

- K-Payment: after paying, the customer is linked out to Kasikorn, where they can use a PromptPay QR, pay by card immediately, or pay by card in instalments. A callback comes back and updates the status to paid. Noted as incurring a fee.

---

## Phase 4 — Shipping tiers, simple label, return/claim contact

- **Dates:** 2026-11-18 → 2026-12-08
- **Deliverables (as revised):** configurable shipping-tier pricing, an optional simple self-printed shipping label, and a staff-handled contact path for cancellation, return, warranty and claim requests. **Lighter than originally planned:** no carrier integration, no refund engine, and no centralized return/warranty/cancellation policy engine — all removed or reduced by the 2026-09-13 answers.
- **Blocked by:** phase 3 complete; an example shipping label, to finalize its exact layout (Q-039 residual); whether weight or dimensions becomes the long-term shipping-tier basis (Q-040 residual).

### Customer service

**REQ-013 — Request cancellation of an unshipped order** · §2 · CONFIRMED
A customer can request cancellation of an order that has not yet shipped. Post-shipment cancellation/return is handled case by case, directly between customer and shop — no workflow is built for it (D-076, Q-037).

**REQ-014 — Contact staff for return, warranty or claim** · §2 · CONFIRMED (narrowed)
A customer can submit contact details and a description of an issue for staff to follow up manually. There is no automated eligibility check and no centralized policy engine (D-076, Q-035); a warranty claim is routed to the product's distributor, with contact information for the relevant distributor shown to the customer rather than handled inside the system (D-078, Q-038).

### Shipping

**REQ-028 — Shipping cost from a configurable size tier** · §7 · CONFIRMED (simplified)
Shipping cost follows a size category assigned to the product by staff, not a computed function of a captured weight or dimension figure (D-067, Q-021).

**REQ-030 — Configurable shipping rules by size tier** · §7 · CONFIRMED (concrete values)
Three shop-owner-configurable tiers: small (candidate 50 THB — e.g. game discs), medium (candidate 100 THB — e.g. controllers), large (free) (D-079, Q-040). The long-term classification basis — weight or dimensions — is still open.

**REQ-031 — Shipping label printing (optional), tracking via BigSeller** · §7 · CONFIRMED (downgraded)
The site optionally supports printing a simple address label (name, address, phone) from order data. A carrier tracking number is not a core requirement; if present, it can be exported to or imported from BigSeller (D-075, Q-039).

### Removed

**REQ-018 — Full and partial refunds with history** · §3 · **REMOVED** (D-077, Q-036)
Refund payout is out of scope for this system.

**REQ-029 — Integrate at least one real carrier** · §7 · **REMOVED** (D-075, Q-034)
No direct carrier integration. Shipping is handled through BigSeller.

**Client discussion notes** *(from §2, §3 and §7 — not requirements)*

- The customer dashboard was discussed as showing order history, pre-orders, and order status tracking.
- On cancellation: if the customer never pays, the order is not shipped. If already paid, the customer tells staff and staff cancel and (outside the system) arrange the refund. If already shipped or received and the customer wants to return it — case by case (D-076).

---

## Phase 5 — Pre-order, dropship, Shopee stock sync

- **Dates:** 2026-12-09 → 2027-01-12
- **Deliverables (from the source):** pre-order, products from distributors (dropship), and Shopee stock linking.
- **Blocked by:** phase 4 complete; the BigSeller data-inspection dependency; a Shopee Partner account and test shop, not yet available (Q-042); Shopee data/extraction research (Q-045).

### Channel sync

**REQ-021 — Stock linked with Shopee, Shopee authoritative on conflict** · §4 · CONFIRMED
A sale on either channel adjusts the stock on the other, via the daily BigSeller file sync (D-081, Q-043). When the two disagree, Shopee is the source of truth (D-082, Q-046).

**REQ-022 — Staff map products to Shopee without a programmer** · §4 · CONFIRMED
A staff member can pair a product on the site with its Shopee listing themselves in the admin panel.

### Special selling models

**REQ-048 — Pre-order products, configurable deposit, stock deducted on receipt** · §5 · CONFIRMED (expanded)
A pre-order product has a release date and a reservation quota. The shop owner sets the deposit percentage and balance-collection timing per product, never hard-coded (D-080, Q-041). No stock is actually deducted at order time — only the quota is reserved; the real deduction happens when staff record the goods as received from the supplier (D-068, Q-024).

**REQ-049 — Customer-visible pre-order status** · §5 · CONFIRMED
A customer can see the status of their pre-order and its release date from their own account page.

**REQ-050 — Dropship products, with a staff supplier-availability gate** · §5 · CONFIRMED (expanded)
Products sourced from a distributor can be sold without holding stock. Before a customer can pay, they use a "Contact staff / Check availability" action; staff confirm with the supplier and either authorize the order to proceed or contact the customer to cancel it if stock is unavailable (D-083, Q-047). There is no immediate checkout for a dropship product.

**Client discussion notes** *(from §5 — not requirements)*

- Discussed being able to change a product's status from DropShip to a normal stocked product.

---

## Phase 6 — News, content pages, product reviews, Sale Page, reports

- **Dates:** 2027-01-13 → 2027-02-09
- **Deliverables (from the source, as revised):** news, the various content pages, customer product reviews, per-product Sale Pages, and sales reports. **Migrate existing content into the new system before building the new content types on top of it** — an instruction from the 2026-09-13 answers that applies specifically here.
- **Blocked by:** an accounting export format, still pending review (Q-050).

### Reporting

**REQ-027 — Monthly sales export for accounting** · §6 · CONFIRMED, format `[Q-050]`
Monthly sales can be exported for the accounting team, including a daily summary of how many units of each SKU were sold. The exact columns are not invented; they wait on the accounting team's review.

**REQ-039 — Sales dashboard** · §8 · CONFIRMED (narrowed)
The admin panel shows sales totals by day, week and month, and a count of orders broken down by status. The near-out-of-stock list is removed (D-065, Q-019).

### Content

**REQ-043 — Required content pages** · §9 · CONFIRMED
The site has these pages: about us, privacy policy, terms of service, order cancellation, warranty and returns, FAQ, how to use, and a warranty registration page with a submittable form.

**REQ-044 — Staff edit content pages themselves** · §9 · CONFIRMED
Staff can edit the content of those pages without a developer changing code.

**REQ-045 — Shop information displayed** · §9 · CONFIRMED
The site displays the shop's phone number, email, LINE, opening hours, address, and the DBD registration mark.

**REQ-046 — PDPA data rights** · §9 · CONFIRMED (resolved)
A customer can view, correct, and delete their own personal data, subject to the retention exception in REQ-026 (D-070, Q-028).

**REQ-047 — Game news section, staff-written** · §2 · CONFIRMED (narrowed)
Customers can read game news, written by staff, in categories including announcements and products (Nintendo, PlayStation). "Product reviews" is no longer a news category — see REQ-054 (D-084, Q-048).

**REQ-054 — Customer product reviews** · §10 (`+`) · CONFIRMED, new
A customer can write and submit a review of a product they can view on the storefront. Distinct from staff-written news (REQ-047); confirmed in scope by `+` meaning "add to scope" (D-084, Q-002, Q-048). Moderation rules are not specified in the source and are a phase 6 design detail, not an open question.

**REQ-055 — Per-product Sale Page** · §9 · CONFIRMED, new
Each product can carry a Sale Page: a page distinct from the normal product page and from a news article, carrying information or news specific to that product (D-085, Q-049). A reasonable place for distributor/warranty contact information (REQ-014, D-078).

**Client discussion notes** *(from §9 — not requirements)*

- The Sale Page concept above is exactly this note, now confirmed rather than open.

---

## Phase 7 — Testing, staff training, go live

- **Dates:** 2027-02-10 → 2027-03-02
- **Deliverables (from the source):** system testing, staff training, and going live.
- **Blocked by:** all earlier phases; a named client approver for phase sign-off (Q-052 residual); the registered tax ID (Q-025); actual DNS/hosting account access (Q-053 residual).

No new requirements. This phase verifies the ones already delivered, against
the criteria in `15-acceptance-criteria.md`. The go-live conditions are in
`10-deployment.md`, and hosting must be decided here per
[ADR-0002](adr/ADR-0002-hosting-and-deployment.md).

**REQ-051 (training) is delivered here as one combined Thai-language manual**
covering all six roles (D-086, Q-051), not per-role versions.

---

## Phase 8 — Security and bot verification (Cloudflare)

- **Dates:** 2027-02-24 → 2027-03-02, run alongside the tail of phase 7 — see *Recommended re-ordering* above.
- **Deliverables:** Cloudflare **Free** plan, scoped to security and bot protection (WAF managed rules, bot fight mode, DNS proxying). No paid tier without a future justified need (D-087, Q-054).
- **Blocked by:** DNS access to tinzshop.com (Q-053 residual).

---

## Phase 9 — Database backup

- **Dates:** 2027-02-24 → 2027-03-02, run alongside the tail of phase 7 — see *Recommended re-ordering* above.
- **Deliverables:** automatic daily database backup, kept deliberately lightweight given the 100,000 THB budget and BigSeller already holding a secondary record of transaction data (D-088, Q-055). Full policy in `10-deployment.md#backup`.

---

## Cross-cutting requirements

These belong to no phase. They constrain everything built from phase 2 onward.

**REQ-007 — Bilingual storefront** · §1 · CONFIRMED
The site is available in Thai and in English (Q-018). Who writes the translations, and the fallback behaviour when one is missing, is a residual item in `13-open-questions.md`, not a blocker.

**REQ-008 — Thai baht, Thailand only** · §1 · CONFIRMED
Prices are shown in Thai baht, and selling and delivery are within Thailand only.

**REQ-009 — Full functionality on mobile** · §2 · CONFIRMED
Every function available on desktop is usable on a mobile browser.

---

## Removed requirements

Requirements that existed in the earlier draft of this document and are now
explicitly out of scope, per the 2026-09-13 answers. Kept here, rather than
deleted outright, so nobody re-adds them believing they were simply missed.

| ID | Was | Removed by |
| :--- | :--- | :--- |
| REQ-010 | Order without registering (guest checkout) | D-061, Q-022 |
| REQ-015 | Bank transfer with slip upload | D-072, Q-030 |
| REQ-017 | Standalone PromptPay | D-071, Q-029 |
| REQ-018 | Full and partial refunds with history | D-077, Q-036 |
| REQ-029 | Integrate at least one real carrier | D-075, Q-034 |
| REQ-040 | Audit history of price/stock/order-status changes | D-066, Q-020 |

---

## Backlog items confirmed in scope, but not scheduled

See *Schedule and budget* above for the reasoning.

| Item | Source | Status |
| :--- | :--- | :--- |
| Loyalty points / gift cards | §10, marked `+` | In scope (D-089, Q-002); no phase assigned |
| Wishlist, shown in order history | §10, marked `+` | In scope (D-089, Q-002); no phase assigned |

---

## Cross-phase observation

The source places phases 8 and 9 — security and backups — after go-live. This
document now recommends running them alongside the tail of phase 7 instead,
so the shop does not take a real payment before Cloudflare and a tested
backup both exist. That is a scheduling recommendation on our side, not a
client instruction, and should be confirmed alongside the rest of the
schedule in this document.
