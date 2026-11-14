# Acceptance Criteria and Sign-off

What must pass before each phase in `02-scope-and-phases.md` is considered
complete, and who confirms it.

> **This document is a proposal from the project side**, drafted in answer to
> Q-052 ("Please design the acceptance criteria and sign-off process for
> me"). It has not been confirmed by the client. The one piece it cannot
> supply itself is a **named approver** — see *Sign-off process* below.

## How to read this

Each phase carries three kinds of criteria:

- **Requirements delivered** — the `REQ-0NN` items from `02-scope-and-phases.md` that must work, cross-referenced to the plan that builds them.
- **Invariant checks** — for any phase touching the four invariants in `03-architecture.md` (no overselling, gap-free invoice numbers, correct VAT, permission enforcement), the specific integration test that must pass, per D-044.
- **Manual walkthrough** — the concrete, human-performed checks from the phase's plan in `docs/plans/`, per `09-coding-guidelines.md`'s rule that a plan is complete only when every box is ticked, including every manual test.

A phase is accepted only when all three are true, not when the code merges.
**Never tick a box for a check nobody performed** — this rule from
`09-coding-guidelines.md` applies here exactly as it does in a plan.

## Sign-off process

1. The developers mark a phase's plan (`docs/plans/00N-*.md`) complete — every build checklist item and every manual test box ticked, with the outcome recorded.
2. The developers demonstrate the phase against the criteria below, live, to the client's named approver.
3. The approver either accepts the phase, or lists specific defects against specific criteria — not a general "looks off."
4. Acceptance is recorded as a dated line in the phase's plan outcome section, naming who approved it.

**Approver: the client's owner (D-194).** This closes Q-052's residual item.
Acceptance is now given per **payment stage**, not per phase (D-193): the
client's owner runs that stage's UAT checklist below on DEV
(`dev.tinzshop.com`), marks each item pass or fail, and signs the stage off.
A stage is paid only after it is signed off. A failed item is fixed and
re-tested on its own. Anything not on a stage's checklist is not a condition
of accepting that stage (D-200).

The phase criteria further down remain the developers' own definition of done
for each requirement. The stage checklists are the client's view of the same
work, regrouped by stage, in plain words. The Thai version the client signs is
the appendix to the MOU, kept outside this repository with it.

## Payment-stage UAT checklists

Every page item is checked in Thai and in English, and on a phone. Payments in
stages 3 and 4 use the K-Payment sandbox, except 4.16. Items marked **(PROD)**
are checked on `tinzshop.com`; all others on DEV.

### Stage 1 — due 2026-12-15

| # | Check |
| :--- | :--- |
| 1.1 | **(PROD)** `tinzshop.com` shows the news section and the maintenance notice: the site is being rebuilt, cannot take orders yet, and lists the shop's other sales channels (REQ-057). |
| 1.2 | **(PROD)** No page or button that places an order exists. |
| 1.3 | **(PROD)** The articles imported from the old site are all there, by category, and open (REQ-047). |
| 1.4 | `dev.tinzshop.com` opens, and test data on DEV never appears on PROD (D-190). |
| 1.5 | A staff member signs in to the back office only after entering the OTP sent by email (REQ-032, D-064). |
| 1.6 | A wrong or missing OTP refuses the sign-in. |
| 1.7 | All six roles exist: Guest, Customer, Blogger, Sale-manager, Admin, Top-level Admin (REQ-034). |
| 1.8 | A Top-level Admin adds and removes staff and sets their role. |
| 1.9 | A Blogger reaches the news menu only, and no other menu. |
| 1.10 | Staff write a new article and save it as a draft; the draft is not on the site. |
| 1.11 | Publishing the article puts it on the site. |
| 1.12 | Editing a published article changes what the site shows. |
| 1.13 | The developers demonstrate one change deploying to DEV automatically, then to PROD automatically after DEV passes (D-191). |

### Stage 2 — due 2027-01-12

| # | Check |
| :--- | :--- |
| 2.1 | Products from Shopee show with photos, name, price and options (REQ-021, D-094). |
| 2.2 | A price or stock change in Shopee shows on the site after the next catalogue pull. |
| 2.3 | Pages show stock only as in stock / out of stock, never a real quantity (REQ-006). |
| 2.4 | The product listing filters, sorts and pages (REQ-001). |
| 2.5 | On a product page, picking an option changes the price and status shown (REQ-003). |
| 2.6 | Staff create and edit categories and put products in them, and the site follows. |
| 2.7 | A Thai search and an English search both find the matching products (REQ-002). |
| 2.8 | A Sale-manager manages products and categories; a Blogger cannot. |
| 2.9 | All eight content pages exist: about us, privacy policy, terms of service, order cancellation, warranty and returns, FAQ, how to use, warranty registration (REQ-043). |
| 2.10 | Staff edit those pages themselves, without a developer (REQ-044). |
| 2.11 | The warranty registration form submits, and staff see what was sent. |
| 2.12 | The site shows the phone number, email, LINE, opening hours, address and DBD mark (REQ-045). |
| 2.13 | Staff create a product's Sale Page, distinct from its product page and from news (REQ-055). |
| 2.14 | Staff mark a product as dropship, and its page shows "Contact staff / Check availability" instead of buying straight away (REQ-050). |

### Stage 3 — due 2027-02-09

| # | Check |
| :--- | :--- |
| 3.1 | A customer registers, signs in and signs out (REQ-011). |
| 3.2 | A signed-out visitor cannot order and is asked to sign in first (REQ-053). |
| 3.3 | In the cart, a customer adds products, changes quantities and removes products. |
| 3.4 | At checkout, a customer enters a delivery address and sees the order summary before paying. |
| 3.5 | Shipping is charged by size tier (small / medium / large), and staff change the amounts themselves (REQ-028, REQ-030). |
| 3.6 | The total is price × quantity + shipping, with VAT already inside the price (REQ-023). |
| 3.7 | A card payment succeeds and the order turns "paid" automatically (REQ-016). |
| 3.8 | An instalment payment succeeds, on at least one plan (REQ-019). |
| 3.9 | A PromptPay QR payment succeeds. |
| 3.10 | A failed or abandoned payment does not turn the order "paid". |
| 3.11 | A customer sees their order status and history and filters it by date range and status (REQ-042). |
| 3.12 | Staff see every order in the back office. |
| 3.13 | Staff export the Excel file of sold order lines and can cut stock in BigSeller from it (REQ-020, D-201). |
| 3.14 | A website order never changes stock by itself (D-096). |
| 3.15 | A customer adds and removes wishlist products and sees the list (REQ-056). |
| 3.16 | A customer has no cancel button; the order page shows the shop's contact channels for cancelling (REQ-013, D-196). |
| 3.17 | An Admin and a Top-level Admin cancel an order in the back office; a Sale-manager and a Blogger cannot. |
| 3.18 | Cancelling without a reason is refused. |
| 3.19 | An order can be cancelled at any stage, before and after shipping. |
| 3.20 | A cancelled order shows "cancelled" and the reason, in the back office and in the customer's order history. |
| 3.21 | An order cancelled before export is not in the stock-cut Excel file. |
| 3.22 | Cancelling an order that was already exported warns staff to restore the stock in BigSeller. |

### Stage 4 — due 2027-03-02

| # | Check |
| :--- | :--- |
| 4.1 | A customer downloads the simplified tax invoice PDF from their order history (REQ-024). |
| 4.2 | Invoice numbers run on with no gap, and the invoice carries the shop's tax ID (REQ-025, Q-025). |
| 4.3 | Staff print a shipping label (name, address, phone) from an order (REQ-031). |
| 4.4 | Staff mark a product as pre-order and set its deposit (REQ-048, D-080). |
| 4.5 | A customer places a pre-order, pays the deposit, and sees its pre-order status (REQ-049). |
| 4.6 | When the goods arrive, staff record them as received and the system asks for the balance. |
| 4.7 | Dropship: a customer sends a request; if staff confirm it the customer can pay, and if staff cancel it they cannot (REQ-050, D-083). |
| 4.8 | A customer writes a product review and it shows on the product page, apart from news (REQ-054). |
| 4.9 | The dashboard shows sales by day, week and month and orders counted by status (REQ-039). |
| 4.10 | The monthly sales export for accounting downloads, with the columns accounting set (REQ-027, Q-050). |
| 4.11 | **(PROD)** The developers demonstrate the site's security protection is on (phase 8, D-198). |
| 4.12 | **(PROD)** The database is backed up automatically every day and kept for 30 days (D-088). |
| 4.13 | **(PROD)** The developers restore from a real backup and record how long it took. |
| 4.14 | The Thai back-office manual covering every staff role is handed over (REQ-051, D-086). |
| 4.15 | Every stage 1–3 item is re-tested and still passes. |
| 4.16 | **(PROD)** The maintenance notice is off, and one real order succeeds. |
| 4.17 | All source code is handed over to the client. |

---

## Phase 1 — Planning documentation

**Requirements delivered:** none — documentation is the deliverable.

**Criteria:**

- [ ] Every document listed in `docs/README.md` exists and contains no placeholder or empty-file content.
- [ ] Every `REQ-0NN` referenced anywhere resolves to an entry in `02-scope-and-phases.md`.
- [ ] Every `Q-0NN` referenced anywhere resolves to an entry in `13-open-questions.md`, with a status of RESOLVED, PARTIALLY RESOLVED, or UNRESOLVED — never silently dropped.
- [ ] No document describes a requirement as approved, agreed, confirmed, decided or finalized beyond what `13-open-questions.md` actually records.
- [ ] `reference/client-summary-th.md` is byte-for-byte unchanged from the client's original.
- [ ] The client (or named approver) has read `13-open-questions.md` and `02-scope-and-phases.md#schedule-and-budget`, and has either confirmed the proposed schedule/budget or given a specific correction.

**Manual walkthrough:** the plan 001 checklist in `docs/plans/001-planning-documentation.md`.

---

## Phase 2 — Products, variants, stock, Excel import

**Requirements delivered:** REQ-004, 005, 006, 020, 032, 033, 034, 035, 036, 037, 038, 051.

**Criteria:**

- [ ] The BigSeller data-inspection session has happened, and Parent SKU/ModelSKU format, real stock quantities, and the Excel column layout are recorded as decisions, not assumptions.
- [ ] A product with two or more option types can be created, each variant carrying its own code, price and stock (REQ-005).
- [ ] The public storefront never exposes a real stock number, in the page or in any network response (REQ-006, D-024).
- [ ] All six roles exist as rows, permissions are editable by the owner without a code change, and no "create a role" control exists anywhere in the admin (REQ-034, REQ-035, D-062, D-063).
- [ ] Staff sign-in requires email OTP; sign-in without it is refused (REQ-032, D-064).
- ~~Excel import dry-run writes nothing to the database (REQ-038).~~ Removed with REQ-038 (D-094).

**Invariant check:** ~~no-overselling integration test~~ — withdrawn, because website orders never change stock (D-096, D-044).

**Manual walkthrough:** the plan 002 checklist in `docs/plans/002-catalogue-stock-and-admin-foundation.md`.

---

## Phase 3 — Storefront, ordering, K-Payment, simplified tax invoice

**Requirements delivered:** REQ-001, 002, 003, 011, 016, 019, 023, 024, 025, 026, 041, 042, 052, 053.

**Criteria:**

- [ ] K-Payment sandbox testing has actually been performed — card payment, at least one instalment plan, and PromptPay QR each complete a real sandbox transaction and the callback updates the order (REQ-016).
- [ ] A paid order never changes stock; its lines appear in the stock-cut Excel export for staff to cut in BigSeller (REQ-020, D-096, D-201).
- [ ] A signed-out visitor reaches only front-page products; no path to checkout exists without an account (REQ-053, D-061).
- [ ] Every order total matches product price × quantity + shipping, with VAT correctly extracted from the VAT-inclusive price, not added on top (REQ-023, D-060).
- [ ] A simplified tax invoice PDF is generated automatically and downloadable from order history, with a gap-free invoice number even under concurrent orders (REQ-024, REQ-025).
- [ ] A customer can view and filter their own order-status history by date range and status (REQ-042, D-073).

**Invariant checks (three apply; no overselling is withdrawn by D-096):**

- Gap-free invoice numbers — concurrent and failed/rolled-back orders produce an unbroken sequence.
- VAT correctness — table-driven test over mixed carts and rounding boundaries; lines always sum to the total.
- Permission enforcement — every protected action attempted as every one of the six roles; only the permitted combinations succeed.

**Manual walkthrough:** the plan 003 checklist (browse → variant → cart → checkout → K-Payment → paid → invoice downloaded), run in Thai and in English, at 360px.

---

## Phase 4 — Shipping tiers, simple label, return/claim contact

**Requirements delivered:** REQ-013, 014, 028, 030.

**Criteria:**

- [ ] A product assigned each shipping size tier (small/medium/large) charges the corresponding configurable amount at checkout, and the owner can change the amounts without a code change (REQ-030, D-079).
- [ ] A customer has no cancel control; an Admin or Top-level Admin cancels with a required reason at any stage, the customer sees the reason, a cancelled order leaves the stock-cut export, and cancelling an already-exported order warns staff to restore stock in BigSeller (REQ-013, D-196).
- ~~Return/warranty/claim contact request reaches a staff queue (REQ-014).~~ Removed with REQ-014 (D-195).
- [ ] A simple address label (name, address, phone) can be printed from an order's data (REQ-031, D-075).

**Manual walkthrough:** the plan 004 checklist, including one order per shipping tier.

---

## Phase 5 — Pre-order, dropship, Shopee stock sync

**Requirements delivered:** REQ-021, 022, 048, 049, 050.

**Criteria:**

- [ ] A pre-order with a configured deposit percentage and balance timing can be placed; no stock is deducted at order time, only a reservation count against the release-date cap (REQ-048, D-068, D-080).
- [ ] Recording a pre-order's goods as "received" performs the real stock deduction under the same locking rules as a normal order, and prompts balance collection if applicable.
- [ ] A dropship product shows "Contact staff / Check availability" instead of immediate checkout; staff can authorize or cancel the request, and only an authorized request reaches payment (REQ-050, D-083).
- [ ] Staff can pair a site product with a Shopee listing without a developer (REQ-022).
- [ ] A deliberately introduced Shopee/site stock mismatch resolves in Shopee's favour at the next catalogue pull (REQ-021, D-082, D-095). There is no BigSeller file sync (D-201).

**Manual walkthrough:** the plan 005 checklist. **This phase's sign-off may need to wait on Shopee access (Q-042)** — if a Shopee test account still does not exist when phase 4 finishes, flag this explicitly to the client rather than accepting the phase with the sync criteria unverified.

---

## Phase 6 — News, content pages, product reviews, Sale Page, reports

**Requirements delivered:** REQ-027, 039, 043, 044, 045, 046, 047, 054, 055.

**Criteria:**

- [ ] Existing content has been migrated into the new system before the new content types (product reviews, Sale Page) are built on top of it, per the phase goal in `02-scope-and-phases.md`.
- [ ] Staff can publish a news article and edit every required content page (about us, privacy policy, terms, cancellation, warranty/returns, FAQ, how-to-use, warranty registration form) without a developer (REQ-043, REQ-044).
- [ ] A customer can submit a product review, distinct from staff news (REQ-054, D-084).
- [ ] A product's Sale Page renders as a distinct page from both its normal product page and any news article (REQ-055, D-085).
- ~~A customer can view, correct and delete their own personal data (REQ-046).~~ Removed with REQ-046 (D-197).
- [ ] The monthly sales export produces a file (exact columns pending Q-050, but the mechanism itself must work end to end).

**Manual walkthrough:** the plan 006 checklist, in Thai and English.

---

## Phase 7 — Testing, staff training, go live

**Requirements delivered:** none new — this phase verifies everything above.

**Criteria:**

- [ ] Every criterion in phases 2 through 6 above has been demonstrated and accepted.
- [ ] The one combined Thai-language training manual exists and covers all six roles (REQ-051, D-086).
- [ ] The registered tax ID is in place (Q-025) — without it, invoices are not legally correct.
- [ ] Every go-live item in `10-deployment.md#going-live` is checked, including a **performed and timed** backup restore.
- [ ] A named approver (or, absent one, the project owner) has signed off phases 2 through 6 individually before go-live is attempted as a whole.

**Manual walkthrough:** the plan 007 checklist, plus every end-to-end journey in `08-security-testing.md`.

---

## Phase 8 — Security

**Requirements delivered:** none written — Cloudflare Free scope only (D-087). Whether Cloudflare is still the tool now that hosting is AWS is Q-064.

**Criteria:**

- [ ] Cloudflare Free is active on tinzshop.com's DNS, with WAF managed rules and bot fight mode enabled.
- [ ] No paid Cloudflare feature is enabled without a specific justification recorded as a new decision.
- [ ] This phase is demonstrably complete **before** phase 7's go-live checklist is signed off, and before the maintenance notice comes off PROD (D-198).

**Manual walkthrough:** the plan 008 checklist.

---

## Phase 9 — Database backup

**Requirements delivered:** none written — strategy in `10-deployment.md#backup` (D-088).

**Criteria:**

- [ ] Automatic daily backup is running with no human action required.
- [ ] 30-day rolling retention is configured and verified.
- [ ] **A restore has actually been performed and timed**, and the result is written into this phase's plan outcome. This is the one criterion across all nine phases most likely to be skipped under time pressure — it is also the one that matters most if it is skipped.
- [ ] This phase is demonstrably complete **before** phase 7's go-live checklist is signed off, and before the maintenance notice comes off PROD (D-198).

**Manual walkthrough:** the plan 009 checklist.
