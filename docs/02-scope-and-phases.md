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

**Total budget: 100,000 THB for all remaining work** (Q-006), paid in four
payment stages. External running costs — AWS, the domain, K-Payment fees,
email sending and security services — are the client's and are not part of
the budget (D-200). This is a lean budget for the integration list this
project carries (K-Payment, Shopee, AWS, email), which is the reasoning behind
several scope-narrowing answers below — no carrier API, no audit log, no
refund engine, no return/warranty engine, and no direct BigSeller connection.

**Delivery is by payment stage (D-193, Q-062).** The phases further down still
group the requirements; the stages set the order they are delivered and paid
in. Each stage is accepted against its UAT checklist on DEV and signed off by
the client's owner before it is paid (D-194, `15-acceptance-criteria.md`). A
stage may slip by up to four weeks at no extra cost, and work outside this
scope is a change request priced per man-day (D-200). The plan is the project
owner's of 2026-11-14 and is pending the client's signature on the MOU.

| Stage | Due | Share | Delivers | Requirements |
| :--- | :--- | :--- | :--- | :--- |
| 1 | 2026-12-15 | 20% (20,000 THB) | Architecture; staff accounts and roles (staff sign up like customers; D-229); the six roles; news, imported from the old site (plan 012, done), plus a staff news editor; AWS DEV and PROD with automatic deployment (ADR-0004); PROD showing news and the maintenance notice | REQ-032, 033, 034, 035, 047, 051, 057 |
| 2 | 2027-01-12 | 30% (30,000 THB) | The Shopee catalogue mirror (plan 010, done); product listing and product pages (plans 011 and 013, done); category management; search; stock status from Shopee; content pages and shop information, editable by staff; Sale Page; dropship set-up and the staff availability gate | REQ-001, 002, 003, 004, 005, 006, 021, 022, 036, 037, 043, 044, 045, 050 (staff side), 055 |
| 3 | 2027-02-09 | 30% (30,000 THB) | Customer sign-up and sign-in; cart; checkout; shipping cost by size tier; K-Payment card, instalments and PromptPay QR; order status and history; the admin order list with the Excel export for cutting stock in BigSeller; staff cancellation; wishlist | REQ-011, 013, 016, 019, 020, 023, 028, 030, 041, 042, 052, 053, 056 |
| 4 | 2027-03-02 | 20% (20,000 THB) | Simplified tax invoice; shipping label; pre-order; dropship ordering; customer reviews; sales dashboard and the monthly accounting export; security (phase 8); database backup with a timed restore (phase 9); the Thai staff manual; final UAT; ordering opens on PROD; source code handed over | REQ-024, 025, 026, 027, 031, 039, 048, 049, 050 (ordering side), 054 |

**Security and backup before ordering opens (D-198).** The source places
security (phase 8) and backups (phase 9) after go-live. They are delivered in
stage 4 instead and must be complete before the maintenance notice comes off
PROD, so the shop never takes a real payment without them. Until then PROD
holds news articles and staff accounts, but no customer or order data.

**Removed on 2026-11-14 (Q-062).** The return, warranty and claim contact path
(REQ-014, D-195), PDPA self-service (REQ-046, D-197), loyalty points and gift
cards (D-199), and any direct BigSeller connection (D-201). There is no
backlog left: the wishlist is REQ-056 in stage 3.

---

## Requirement index

| Phase | Requirements |
| :--- | :--- |
| 1 — Planning documentation | *(none — this documentation is the deliverable)* |
| 2 — Products, variants, stock, Excel | REQ-004, 005, 006, 020, 032, 033, 034, 035, 036, 037, 038 (REMOVED), 051 |
| 3 — Storefront, ordering, K-Payment, invoice | REQ-001, 002, 003, 010 (REMOVED), 011, 016, 019, 023, 024, 025, 026, 041, 042, 052, 053, 056 |
| 4 — Shipping tiers, labels, cancellation | REQ-013, 014 (REMOVED), 028, 030 |
| 5 — Pre-order, dropship, Shopee sync | REQ-021, 022, 048, 049, 050 |
| 6 — News, content pages, reviews, reports | REQ-027, 039, 043, 044, 045, 046 (REMOVED), 047, 054, 055 |
| 7 — Testing, training, go live | REQ-057 (delivered early, in stage 1) |
| 8 — Security | *(none written — Cloudflare Free scoped in Q-054; open again in Q-064)* |
| 9 — Database backup | *(none written — strategy in `10-deployment.md#backup`)* |
| Cross-cutting | REQ-007, 008, 009 |
| Removed | REQ-010, 014, 015, 017, 018, 029, 038, 040, 046 |
| Backlog, not scheduled | *(none — loyalty removed, wishlist is REQ-056, D-199)* |

---

## Phase 1 — Planning documentation

- **Dates:** set by the payment stages, not by phase — see *Schedule and budget* (D-193).
- **Deliverables (from the source):** planning documents covering the detail of the work, division of work, scope, and working method, written to a shared format; a clear project structure; and identifying what is not yet known or not yet clear and making it clear. The source names Cloudflare, Shopee, BigSeller, Medusa JS and K-Payment as the subjects to get clear on.
- **Status:** Substantially complete. Medusa JS was evaluated and not chosen ([ADR-0001](adr/ADR-0001-backend-approach.md)). K-Payment, Shopee and BigSeller remain NOT RESEARCHED pending the accounts and data named in `13-open-questions.md`'s residual items. Cloudflare's scope is now fixed (Q-054) even though no configuration exists yet.

This documentation is the deliverable. No requirement is delivered by it.

**Client discussion notes** *(from the §11 table — not commitments)*

- Update on progress with Win every Wednesday at 21:00, and update with the father every two weeks, around the weekend.
- Register one mailbox for Claude Code Enterprise. The exact address is deprioritized — Q-009.

---

## Phase 2 — Products, variants, stock (Shopee catalogue mirror)

- **Dates:** set by the payment stages, not by phase — see *Schedule and budget* (D-193).
- **Deliverables (from the source, as revised):** the product system, product options and stock — now delivered as a mirror of the Shopee catalogue (plan 010, D-094, D-095). The source's Excel file import is removed (REQ-038, D-094).
- **Blocked by:** plan 010 (the catalogue mirror) is not blocked; the rest of the phase is unchanged and still waits on its own plans and questions. Per the project owner's approval of 2026-10-26 (spec §2 *Authority*), the catalogue's shape comes from Shopee, so Q-013 and Q-014 do not block it and the Excel format (Q-012) no longer applies. Still open and outside plan 010: Q-056 (Shopee's API call limit, before go-live) and Q-042 (live go-live and owner authorization).

> **Catalogue mirror (owner, 2026-10-26).** Plan 010
> (`plans/010-shopee-catalogue-mirror.md`) changes how this phase's catalogue
> and stock requirements are met: Shopee is the master for the catalogue
> (D-094), pulled every 10 minutes (D-095); website orders never change stock
> (D-096); every product comes from Shopee (D-102). Design: [spec](superpowers/specs/2026-10-26-shopee-catalogue-mirror-database-design.md). REQ-004,
> 020, 036, 037 and 038 below are restated accordingly, and plan 002 is
> superseded in part by plan 010.

> The staff authentication and role requirements (REQ-032 to REQ-035, REQ-051)
> are placed here because the admin panel cannot be used without them. **The
> source does not say this** — it is our sequencing.

### Catalogue

**REQ-004 — Parent SKU and ModelSKU structure** · §4 · CONFIRMED, stored as Shopee holds them (D-103)
Each product carries one Parent SKU, and each model of that product carries its own ModelSKU. Both are stored exactly as Shopee holds them, with no uniqueness constraint and no format rule of our own; identity is Shopee's item and model id (D-103). Empty or duplicate SKUs are reported by the sync rather than rejected. The format question Q-014 is unaffected and stays open.

**REQ-005 — Multiple option types per product** · §4 · CONFIRMED, cap `[Q-013]`
A product can have more than one option type (for example colour × capacity), and each resulting combination can carry its own code, price and stock quantity. **No hard-coded cap of two** — the join-table model in `05-database.md` already supports any number. The Shopee/Lazada research is done — both marketplaces themselves cap at two, which is why the client's answer rules out inheriting it — so the practical maximum the import/UI enforces now waits on a client answer (Q-013).

**REQ-006 — Public availability status without real quantities** · §4 · CONFIRMED (narrowed)
The storefront shows availability as **in stock or out of stock** — never a real quantity. Low stock is removed from this requirement (D-065, Q-019).

### Stock

**REQ-020 — Stock changed by staff from an Excel export of paid order lines** · §4 · CONFIRMED (rewritten, D-096, D-201)
A website order never changes stock in the system, so the no-overselling guarantee is **removed**. Instead, staff export an Excel file of paid order lines from the admin order list (no separate page, D-201) and update stock in BigSeller by hand (manual stock adjustment, ตัดสต๊อกด้วยมือ); BigSeller pushes it to Shopee, and the next catalogue sync brings the new number back to the site. Between a payment and that sync the site can show stock that is no longer true; staff handle an oversold order outside the system (D-077). Pre-order lines are excluded from the list because stock leaves only when goods arrive (REQ-048). Supersedes D-068; see [spec](superpowers/specs/2026-10-26-shopee-catalogue-mirror-database-design.md) §2 and §5.5.

### Admin back office

**REQ-032 — ~~Two-step verification for staff~~** · §8 · CHANGED — no second factor (D-232)
~~Staff sign-in requires a second factor via **email OTP** (D-064, Q-017). No SMS/phone OTP.~~
Changed on 2026-11-14 at the client's request, relayed by the project owner: staff sign up and sign in like customers, and the emailed code is asked for at sign-up only. A staff account is protected by its password or Google account alone. D-232 supersedes D-064; the trade-off is set out in `superpowers/specs/2026-11-14-staff-roles-and-back-office-design.md` §10.

**REQ-033 — Single bilingual admin entry point** · §8 · CONFIRMED
Staff use one place to sign in, and the admin panel is usable in both Thai and English.

**REQ-034 — Six roles, permission-based access** · §8 · CONFIRMED (rewritten)
Access is divided among six roles: Blogger, Sale-manager, Admin, Top-level Admin, Customer, and Guest (D-062, Q-015). Customer and Guest are rows in the same `role`/`role_permission` tables as the four staff roles, not a special case. Guest is not an account: its role row describes signed-out visitors (D-231).

**REQ-035 — Owner-configurable role permissions, editing only** · §8 · CONFIRMED (narrowed)
The shop owner can adjust the permissions of each of the six existing roles themselves, without a developer changing code. **There is no "create a new role" capability** (D-063, Q-016).

**REQ-036 — Product list grouped by parent with expandable variants** · §8 · CONFIRMED (kept; Shopee fields read-only)
The product management screen lists parent products, and a parent can be expanded to show its variants. Fields that come from Shopee (name, description, photos, options, price, stock) are read-only here (D-094).

**REQ-037 — Inline and bulk editing of site-only fields** · §8 · CONFIRMED (narrowed, D-094)
A staff member can edit, inline and for several products at once, only the fields Shopee does not hold: menu category, shipping size tier, pre-order and release date, and activation. Price, stock and the other Shopee fields are no longer editable on the site.

**REQ-051 — Staff roles** · §8 · CONFIRMED (see REQ-034)
The four staff roles: Blogger (writes news only), Sale-manager (products, stock, orders, finance), Admin (oversees everything), and Top-level Admin (adds and removes staff, and configures the system). *Note: staff are now ordinary accounts; the Top-level Admin sets an account's role and blocks or unblocks it (D-230, D-234).*

### Removed

**REQ-038 — Excel import and export with validation and dry run** · §8 · **REMOVED** (D-094)
Shopee is the master for the catalogue and products arrive by the Shopee pull, so there is no product import. See the *Removed requirements* table.

**REQ-040 — Audit history of changes** · §8 · **REMOVED** (D-066, Q-020)
No audit log of price, stock or order-status changes is built.

**Client discussion notes** *(from §4 and §8 — not requirements)*

- BigSeller: noted for further study, for managing stock. The daily file export/import approach is now the confirmed primary mechanism (D-081, Q-043); the paid API is a future option only.
- Two open notes were recorded: BigSeller codes, and finding out how to pull data out of Shopee. Both are now tracked as the residual "BigSeller data inspection" dependency in `13-open-questions.md`.
- Noted against phase 2: gather how things are really used on Shopee, what its limitations are — still a research item (Q-045). Also noted: an order slipping through without stock being updated — the reconciliation rule is now decided (Shopee is authoritative, D-082); the detection mechanism itself still waits on seeing real export formats.

---

## Phase 3 — Storefront, ordering, K-Payment, simplified tax invoice

- **Dates:** set by the payment stages, not by phase — see *Schedule and budget* (D-193).
- **Deliverables (from the source, as revised):** the storefront, ordering, K-Payment card/instalment/PromptPay-QR payment, and the simplified tax invoice. **K-Payment is folded into this phase** because bank transfer (its original phase-3 payment method) is removed, leaving no payment method at all for phase 3 unless K-Payment moves up — and its credentials already exist (Q-033).
- **Blocked by:** phase 2 complete; conducting K-Payment sandbox testing (Q-033 residual); an example invoice, to finalize the exact simplified-invoice fields (Q-027 residual).

### Storefront

> **Plan 011 (D-117), an early slice of this phase.** On the project owner's request of 2026-10-28, the landing page and the product page, filled from the Shopee catalogue mirror, are built first — `plans/011-landing-page-from-mirror.md`. The storefront visibility rule is unchanged (a product shows only when `product.is_active`, its `channel_item.external_status = 'NORMAL'`, and at least one variant is active). Until plan 002's admin screens exist, the development-only job endpoint `POST /api/jobs/catalogue-activate` turns on synced products. It does **not** deliver REQ-001 (no category pages) or REQ-002 (no search). It touches REQ-003 only in part: the product page has a variant picker showing the selected variant's price and stock status, without a cart.

> **Plan 013 (D-142 to D-151), an early slice of this phase.** On the project owner's request of 2026-10-29, the product listing page `/{locale}/product` (category tabs, sidebar filters, sort, grid/list, pagination) is built, the product page moves to `/{locale}/product/{productId}/detail`, and a development job assigns mock categories from product-name keywords — `plans/013-product-listing-page.md`. It delivers REQ-001 (browse by category) against those mock categories only; admin category assignment stays with plan 002. It does **not** deliver REQ-002 (search).

**REQ-001 — Browse products by category** · §2 · CONFIRMED
A customer can browse products filtered to a category. The categories named are Nintendo Switch, PlayStation 5, IT Gadgets and Pre-Order.

**REQ-002 — Search in Thai and English** · §2 · CONFIRMED
A customer can search the catalogue using Thai text and using English text, and matching products are returned for both.

**REQ-003 — Select a variant and see its price and availability** · §2 · CONFIRMED
On a product page, a customer can select option values such as colour or capacity, and the price and remaining availability of that specific model are shown immediately without a page reload.

> **Plan 014 (D-152 to D-175), an early slice of this phase.** On the project owner's request of 2026-11-03, customer registration and sign-in (email and password, or Google, through Amazon Cognito) are built ahead of ordering — `plans/014-customer-authentication.md`. It delivers the register and sign-in part of REQ-011 only; order history and invoices stay open. It applies REQ-053 / D-061: the all-products page and product pages now require sign-in (D-161). Staff sign-in (REQ-032) stays with plan 002.

> **Plan 015 (D-210 to D-223), a restyle within this phase.** On the project owner's request of 2026-11-12, the storefront pages that exist (the shell, home, the product listing, the product page, the news pages and the four sign-in pages) are restyled to the owner's new design in `tinzshop-redesign/` — `plans/015-storefront-redesign.md`. It delivers no requirement and changes no behaviour: sign-in still gates the product pages, stock is still shown as in stock or out of stock only, and the only server change is the landing page's section limits (10 best sellers, 5 kits).

### Ordering

**REQ-010 — Order without registering** · §2 · **REMOVED** (D-061, Q-022)
There is no guest checkout. A signed-out visitor sees only the front page's products (REQ-053); placing an order requires a customer account.

**REQ-011 — Customer account with order history** · §2 · CONFIRMED
A customer can register, sign in, view their past orders, and download the simplified tax invoice for an order.

**REQ-056 — Wishlist / favourite products** · §10 (`+`) · CONFIRMED, scheduled (D-199)
A signed-in customer can add a product to a wishlist, remove it, and see the list. The source lists it beside order history; how it is shown is a stage 3 design detail.

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

- **Dates:** set by the payment stages, not by phase — see *Schedule and budget* (D-193).
- **Deliverables (as revised):** configurable shipping-tier pricing, an optional simple self-printed shipping label, and a staff-handled contact path for cancellation, return, warranty and claim requests. **Lighter than originally planned:** no carrier integration, no refund engine, and no centralized return/warranty/cancellation policy engine — all removed or reduced by the 2026-09-13 answers.
- **Blocked by:** phase 3 complete; an example shipping label, to finalize its exact layout (Q-039 residual); whether weight or dimensions becomes the long-term shipping-tier basis (Q-040 residual).

### Customer service

**REQ-013 — Staff cancel an order on the customer's request** · §2 · CONFIRMED (rewritten, D-196)
A customer cannot cancel an order on the site. The order page shows the shop's contact channels instead, and the customer contacts the shop with a reason. An Admin or Top-level Admin then cancels the order in the back office, at any stage up to the goods' return, and must enter a reason; Sale-manager and Blogger cannot cancel. The customer sees the cancelled status and the reason in their order history. A cancelled order is left out of the stock-cut export (REQ-020); if it was already exported, staff are warned to restore the stock in BigSeller. Refunds and returned goods are handled outside the system (D-077). The full order-status set is still Q-023.

**REQ-014 — Contact staff for return, warranty or claim** · §2 · REMOVED (D-195, Q-062)
Removed 2026-11-14: the shop handles after-sales service through its existing channels, and the site builds no contact form or queue for it. Distributor or warranty contact information can still be shown on a product's Sale Page (REQ-055, D-078). Was:
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

- **Dates:** set by the payment stages, not by phase — see *Schedule and budget* (D-193).
- **Deliverables (from the source):** pre-order, products from distributors (dropship), and Shopee stock linking.
- **Blocked by:** phase 4 complete; the BigSeller data-inspection dependency; Shopee sandbox access now exists (Q-042 PARTIALLY RESOLVED — live go-live and the owner's authorization are pending); Shopee data/extraction research is largely done through plan 010 (Q-045 still UNRESOLVED).

### Channel sync

**REQ-021 — Stock linked with Shopee, Shopee authoritative on conflict** · §4 · CONFIRMED (mechanism changed, D-095)
The mechanism is BigSeller → Shopee → our pull: staff change stock in BigSeller, BigSeller pushes it to Shopee, and the site's 10-minute pull brings it back (D-095, D-096). The site pushes nothing to Shopee. When the two disagree, Shopee is the source of truth (D-082, Q-046).

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

- **Dates:** set by the payment stages, not by phase — see *Schedule and budget* (D-193).
- **Deliverables (from the source, as revised):** news, the various content pages, customer product reviews, per-product Sale Pages, and sales reports. **Migrate existing content into the new system before building the new content types on top of it** — an instruction from the 2026-09-13 answers that applies specifically here.
- **Blocked by:** an accounting export format, still pending review (Q-050).

### News (plan 012)

News (REQ-047) is built ahead of the rest of this phase as [plan 012](plans/012-news-import-and-pages.md), on the project owner's decisions of 2026-10-29 ([design](superpowers/specs/2026-10-29-news-import-and-pages-design.md), D-125 to D-140; D-125 was superseded by D-139 and restored by D-140): the news tables, a re-runnable import of the old WordPress site's posts and categories, and the news list, category and article pages. Staff-written product reviews are news: the old site's `reviews` category tree is a listed news category shown as "รีวิวสินค้า", and only **customer** product reviews (REQ-054) are a separate feature (owner, Q-048 clarification; D-140, which supersedes the review part of D-139). The old "Uncategorized" category is unlisted: it has no tab, and its articles appear under "ทั้งหมด" (D-139). The header's utility bar has a "บทความ ▾" menu of news categories (D-140). The staff news editor is a later plan, together with staff sign-in (plan 002). Page 1 of the list shows 3 feature and 9 grid articles, and later pages 12 (D-134).

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

**REQ-046 — PDPA data rights** · §9 · REMOVED (D-197, Q-062)
Removed 2026-11-14: the shop handles these requests through its contact channels, and the site builds no self-service for them. Was:
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

- **Dates:** set by the payment stages, not by phase — see *Schedule and budget* (D-193).
- **Deliverables (from the source):** system testing, staff training, and going live.
- **Blocked by:** all earlier phases; a named client approver for phase sign-off (Q-052 residual); the registered tax ID (Q-025); actual DNS/hosting account access (Q-053 residual).

No new requirements. This phase verifies the ones already delivered, against
the criteria in `15-acceptance-criteria.md`. The go-live conditions are in
`10-deployment.md`, and hosting is AWS
([ADR-0004](adr/ADR-0004-aws-hosting-and-environments.md)). PROD is already live from
stage 1 with the news section and the maintenance notice (REQ-057); going live
here means taking the notice off and opening ordering.

**REQ-051 (training) is delivered here as one combined Thai-language manual**
covering all six roles (D-086, Q-051), not per-role versions.

**REQ-057 — Maintenance notice on PROD until ordering opens** · owner, 2026-11-14 · CONFIRMED, new (D-192)
From payment stage 1, `tinzshop.com` shows the news section and a notice that the site is being rebuilt and cannot take orders yet, pointing customers to the shop's other sales channels. No page or button that places an order is reachable on PROD until stage 4 takes the notice off. Delivered early, in stage 1, so the old site can be shut down.

---

## Phase 8 — Security

- **Dates:** set by the payment stages, not by phase — see *Schedule and budget* (D-193).
- **Renamed** from "Security and bot verification (Cloudflare)" on 2026-11-14 and delivered in stage 4, before ordering opens (D-198). Whether Cloudflare is still the tool now that hosting is AWS is Q-064; until it is answered, D-087 stands.
- **Deliverables:** Cloudflare **Free** plan, scoped to security and bot protection (WAF managed rules, bot fight mode, DNS proxying). No paid tier without a future justified need (D-087, Q-054).
- **Blocked by:** DNS access to tinzshop.com (Q-053 residual).

---

## Phase 9 — Database backup

- **Dates:** set by the payment stages, not by phase — see *Schedule and budget* (D-193).
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
| REQ-038 | Excel import and export of products | D-094 |
| REQ-040 | Audit history of price/stock/order-status changes | D-066, Q-020 |
| REQ-014 | Contact staff for return, warranty or claim | D-195, Q-062 |
| REQ-046 | PDPA self-service: view, correct and delete own data | D-197, Q-062 |

---

## Backlog items confirmed in scope, but not scheduled

None. Loyalty points and gift cards are removed, and the wishlist is REQ-056 in
stage 3 (D-199, which supersedes D-089's backlog).

---

## Cross-phase observation

The source places phases 8 and 9 — security and backups — after go-live. That
order is changed (D-198): both are delivered in stage 4 and must be complete
before ordering opens on PROD.
