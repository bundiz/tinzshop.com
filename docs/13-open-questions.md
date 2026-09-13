# Open Questions

Every unknown, contradiction, gap, and missing reference found in
`reference/client-summary-th.md`, plus the answers received back from the
client through the project owner on 2026-09-13.

**The source is still a client sign-off summary, not a signed contract.** A
question below is marked **RESOLVED** only where the 2026-09-13 answer settles
it outright. Where the answer explicitly says "wait", "check later", "see
example", "inspect the real data first" or "research", the question stays
**UNRESOLVED** and the entry records exactly what it is now waiting on — per
`CLAUDE.md` Rule 6, ambiguity is recorded, not guessed at, and a "we'll look at
it later" is not an answer to build on.

Every resolution creates a decision row in `11-decisions.md` (Rule 11) and,
where it changes a requirement, a matching edit in `02-scope-and-phases.md`.

Sorted by the phase they block. Phase numbers refer to `02-scope-and-phases.md`.

## Status at a glance

| Status | Count | Meaning |
| :--- | :--- | :--- |
| **RESOLVED** | 37 | Answered 2026-09-13. Decision recorded in `11-decisions.md`. |
| **PARTIALLY RESOLVED** | 5 | Direction decided; one concrete detail still waits on data or an example. |
| **UNRESOLVED** | 13 | Explicitly deferred by the client ("wait", "inspect first", "research") or still genuinely open. |

---

## Blocking Phase 1 — planning and sign-off

### Q-001: The source document has not been signed off
- **Status:** RESOLVED — 2026-09-13
- **Question:** Every checkbox in `reference/client-summary-th.md` is unticked (☐). Has the client reviewed and confirmed the scope, and if so which items are agreed and which are amended?
- **Answer:** "I have reviewed the requirements and ticked all requirement items. Treat the requirements as confirmed unless another answer below explicitly changes or limits them."
- **Effect:** Every `REQ-0NN` in `02-scope-and-phases.md` that is not separately touched by Q-002 through Q-055 is now **CONFIRMED**, not PROPOSED. Requirements changed, removed or added by a specific answer below are marked individually. The source document itself is still never edited (Rule 8) — this file and `02-scope-and-phases.md` are where the confirmation is recorded.
- **Recorded in:** `11-decisions.md` D-090.

### Q-002: Meaning of the `+` symbol in section 10
- **Status:** RESOLVED — 2026-09-13
- **Question:** Four rows in §10 are marked `+` rather than `✗`: loyalty points/gift cards, K-Payment instalments, customer product reviews, and wishlist. What does `+` mean?
- **Answer:** "`+` means add to scope."
- **Effect:** All four items are **in scope**: loyalty points/gift cards, K-Payment instalments (also see Q-003), customer-written product reviews (also see Q-048), and a wishlist shown in order history. Given the 100,000 THB total budget (Q-006), loyalty points/gift cards and the wishlist are placed in a **post-launch backlog** rather than a numbered phase — see `02-scope-and-phases.md#backlog-items-confirmed-in-scope-but-not-scheduled`. This is a scheduling call, not a scope reduction; if the client wants either in an early phase, that is new direction and needs saying explicitly.
- **Recorded in:** `11-decisions.md` D-089.

### Q-003: K-Payment instalments appear both in scope and in the exclusions section
- **Status:** RESOLVED — 2026-09-13
- **Question:** Is instalment payment in scope, given the source both describes it in §3 and excludes it with a `+` in §10?
- **Answer:** "K-Payment installments are in scope. The K-Payment key has already been provided."
- **Effect:** REQ-019 moves from "scope undetermined" into the payment feature set (REQ-016) as a confirmed capability of the K-Payment integration. A K-Payment merchant/test credential already exists — see Q-033.
- **Recorded in:** `11-decisions.md` D-089.

### Q-004: Phases 2 through 9 have no dates
- **Status:** RESOLVED — 2026-09-13
- **Question:** What are the target dates for phases 2–9?
- **Answer:** "Please create a realistic implementation schedule for me, taking into account the total budget and dependencies between phases."
- **Effect:** A proposed schedule, 2026-09-16 through 2027-03-09, is recorded in `02-scope-and-phases.md#schedule-and-budget`, built from the actual phase dependencies and the 100,000 THB budget (Q-006). **This is a proposal from the project side, not a client-set deadline** — it should go back to the client for confirmation the same way the rest of this file does, and it will move as the still-unresolved research items (BigSeller data, Shopee account) land.
- **Recorded in:** `11-decisions.md` D-090.

### Q-005: The phase 1 date is ambiguous and has passed
- **Status:** RESOLVED — 2026-09-13
- **Question:** Is the stated `02/09` phase 1 date 2 September 2026, and is it now extended?
- **Answer:** "The old Phase 1 date can be updated. Use a realistic/current schedule rather than preserving the old 02/09 date."
- **Effect:** Phase 1 is recorded as running 2026-09-01 through 2026-09-15 in the new schedule — the old `02/09` figure is dropped entirely rather than reinterpreted.
- **Recorded in:** `11-decisions.md` D-090.

### Q-006: No cost information anywhere
- **Status:** RESOLVED — 2026-09-13
- **Question:** What is the budget or price per phase?
- **Answer:** "The total project budget is 100,000 THB overall, so manage the implementation plan carefully and keep the scope and architecture cost-conscious through go-live."
- **Effect:** 100,000 THB is the **total** figure for phases 2 through 9 (phase 1 is documentation already substantially done). This is an unusually tight budget for the integration list in this project (K-Payment, BigSeller, Shopee, Cloudflare, email). It is why several answers below are deliberately kept simple (no carrier API, no audit log, no refund engine, daily-file sync instead of a paid real-time API) and why loyalty/gift cards and the wishlist are backlog rather than scheduled. **This budget constraint should be raised back to the client explicitly** if any unresolved item below (particularly Q-013, Q-042, Q-044) turns out to demand more work than assumed here.
- **Recorded in:** `11-decisions.md` D-090.

### Q-007: The referenced contract has not been provided
- **Status:** UNRESOLVED — waiting on BigSeller data inspection
- **Question:** Section 4 defines Parent SKU / ModelSKU "as specified in the contract"; section 8 refers to permission levels "as agreed." Neither document exists. Can they be supplied?
- **Answer:** "There is no separate contract document available at the moment. We will inspect the actual data in BigSeller later to determine how Parent SKU / ModelSKU are generated and structured. Do not invent the format yet."
- **Effect:** The permission-levels half of this question is resolved separately — see Q-015 and Q-016, which give the role model directly rather than through the missing contract. The SKU half remains genuinely open and is now tracked together with Q-014 and Q-044 as one dependency: **inspecting real BigSeller product/SKU data.** No format may be assumed before that inspection happens.
- **Ask:** client / BigSeller data inspection

### Q-008: Technology stack is undecided
- **Status:** RESOLVED — 2026-09-13
- **Question:** What technology stack will be used?
- **Answer:** "Recommend the technology stack based on the confirmed requirements and project constraints. I want a practical, maintainable, cost-conscious stack suitable for this project rather than adopting Medusa JS automatically. Please document the recommendation and rationale before implementation."
- **Effect:** This was already done. [ADR-0001](adr/ADR-0001-backend-approach.md) — Next.js, TypeScript, PostgreSQL, Prisma, commerce written in-house — was Accepted on 2026-09-09, evaluated Medusa JS on exactly this project's requirements and did not choose it, and gives its full reasoning. No new stack work is needed; this answer confirms the ADR was the right call rather than requesting a different one. Nothing about the requirement changes now confirmed in this document (roles, VAT, payment, shipping tiers) requires revisiting ADR-0001.
- **Recorded in:** [ADR-0001](adr/ADR-0001-backend-approach.md), already Accepted.

### Q-009: Project email address is inconsistent in the source
- **Status:** UNRESOLVED — deprioritized, no longer blocking
- **Question:** The source asks for one mailbox, written both as `tech@tinzshop.com` and `tech@tinzshopl.com`. Which is correct, who owns it, and is it the transactional sender address too?
- **Answer:** "Skip this for now. It is not a major blocker and can be fixed later."
- **Effect:** Removed from every phase's blocking list. It still needs an answer before team tooling is registered and before the transactional sender address (Q-032) is finalized, but nothing currently waits on it.
- **Ask:** client, no target date set

---

## Blocking Phase 2 — products, variants, stock, Excel

### Q-010: VAT contradiction between sections 6 and 12
- **Status:** RESOLVED — 2026-09-13
- **Question:** Do displayed prices already include VAT, or is VAT added on top?
- **Answer:** "All product prices already include 7% VAT. Do not add VAT on top of the displayed product price."
- **Effect:** REQ-023 is rewritten: the domain totals function extracts the VAT component already embedded in the displayed price rather than adding 7% to it. Invariant 3 in `03-architecture.md` now has a settled input.
- **Recorded in:** `11-decisions.md` D-060.

### Q-011: Real stock quantities per SKU
- **Status:** UNRESOLVED — waiting on BigSeller data inspection
- **Question:** When will real on-hand stock quantities be provided, and in what format?
- **Answer:** "We need to inspect the actual stock data in BigSeller first. Do not invent the stock import format yet."
- **Effect:** No change from before, except the path to an answer is now specific: this is resolved by inspecting BigSeller directly, not by a client-supplied file. Tracked together with Q-012, Q-014 and Q-044.
- **Ask:** BigSeller data inspection

### Q-012: Current Excel file format
- **Status:** UNRESOLVED — waiting on BigSeller data inspection
- **Question:** Can a real sample of the shop's current Excel file be provided?
- **Answer:** "We need to inspect BigSeller's actual export/data format first before finalizing the Excel structure."
- **Effect:** Same dependency as Q-011. The Excel import/export format (REQ-038) is not designed against BigSeller's export shape until that export has actually been looked at.
- **Ask:** BigSeller data inspection

### Q-013: Maximum number of option types per product
- **Status:** UNRESOLVED — research required before a limit is set
- **Question:** Is two option types per product (e.g. colour + capacity) enough, or are more needed?
- **Answer:** "Check the real product/variant structures used by Shopee and Lazada before deciding the maximum number of option types. Do not arbitrarily limit it to two options."
- **Effect:** One thing is settled now: **no hard-coded cap of two.** `05-database.md`'s option model is already a join table (`option_type` / `option_value` / `variant_option_value`) precisely because the number was unknown, so this answer requires no schema change — it rules out ever adding a two-option assumption to validation or the UI. What Shopee's and Lazada's actual variant structures allow, and what practical maximum the import/UI should therefore enforce, is a research task that has not been done.
- **Ask:** research (Shopee and Lazada seller documentation)

### Q-014: Parent SKU and ModelSKU format rules are unknown
- **Status:** UNRESOLVED — waiting on BigSeller data inspection
- **Question:** What is the format, length, and character set of a Parent SKU and a ModelSKU, and does a ModelSKU embed its Parent SKU?
- **Answer:** "Inspect the actual BigSeller data first. We need to see examples and understand how the SKU values are generated before finalizing the rules."
- **Effect:** Unchanged in substance, but now definitively resolved by data inspection rather than by a contract that does not exist (see Q-007). Tracked together with Q-007, Q-011, Q-012 and Q-044 as one BigSeller-inspection dependency that blocks the catalogue model.
- **Ask:** BigSeller data inspection

### Q-015: "4 permission levels" but six roles are listed
- **Status:** RESOLVED — 2026-09-13
- **Question:** Are the 4 levels the staff roles only, with customer and guest being something else?
- **Answer:** "Use 6 roles: Blogger, Sale-manager, Admin, Top-level Admin, Customer, Guest / Non-logged-in Visitor. Treat Customer and Guest as actual roles in the authorization model."
- **Effect:** REQ-034 is rewritten from "4 permission levels" to six roles, and Customer and Guest move from being merely "who uses the site" into rows in the `role` table alongside the four staff roles — they now go through the same permission mechanism (`role_permission`) rather than being handled as a special case. `05-database.md` and `12-glossary.md` are updated to match.
- **Recorded in:** `11-decisions.md` D-062.

### Q-016: Which permissions are owner-configurable
- **Status:** RESOLVED — 2026-09-13
- **Question:** Can the shop owner create new roles, or only edit the existing ones?
- **Answer:** "The system should support editing permissions for the existing roles only. Do not provide functionality to create new roles."
- **Effect:** REQ-035 is narrowed: the admin UI lets the owner toggle which permissions each of the six fixed roles holds, and does not offer a "create role" screen. `role.is_system` (already in `05-database.md`) is exactly this constraint — all six rows are system rows, none deletable, none the model for a user-created row.
- **Recorded in:** `11-decisions.md` D-063.

### Q-017: Staff two-factor — email or phone?
- **Status:** RESOLVED — 2026-09-13
- **Question:** Is the OTP by email, by phone, either, or both?
- **Answer:** "Use Email OTP. No phone/SMS OTP is required."
- **Effect:** REQ-032 is settled: email OTP only. No SMS provider is needed, which removes an entire integration from `14-integrations.md`.
- **Recorded in:** `11-decisions.md` D-064.

### Q-018: Who produces the Thai and English content
- **Status:** RESOLVED — 2026-09-13
- **Question:** Must every product, page and article exist in both languages, and who translates?
- **Answer:** "The entire website should support Thai and English. Design the content model so the relevant website content can have both language versions."
- **Effect:** Confirms REQ-007 as already designed: `05-database.md`'s per-locale row for product text, content pages and news is the right shape. **Still open, and not answered by this response:** who actually writes the translations, and what happens when one is missing. Recorded as a residual item below rather than a separate Q, since it is a detail of an otherwise-resolved requirement, not a blocker to building the bilingual mechanism itself.
- **Recorded in:** `11-decisions.md` D-031 (already Accepted; unchanged).
- **Residual:** translation ownership and fallback behaviour when a translation is missing — ask the client when convenient, does not block phase 2.

### Q-019: "Low stock" threshold is not defined
- **Status:** RESOLVED — 2026-09-13
- **Question:** At what quantity does a product become "low stock"?
- **Answer:** "We do not need a Low Stock feature. Remove this requirement rather than implementing a threshold."
- **Effect:** REQ-006 is narrowed to two public states — in stock / out of stock — removing "low stock" entirely. REQ-039's "list of products nearly out of stock" is removed from the dashboard. `12-glossary.md`'s `low_stock` and `stock_status` entries are updated.
- **Recorded in:** `11-decisions.md` D-065.

### Q-020: Audit log scope and retention
- **Status:** RESOLVED — 2026-09-13
- **Question:** How long must price/stock/order-status change records be kept, and who may read them?
- **Answer:** "We do not need Audit Logs for price, stock, or order-status changes. Remove this requirement unless another confirmed requirement explicitly requires it."
- **Effect:** REQ-040 is removed. `audit_log` is dropped from `05-database.md`'s entity map, D-016 is retired, and D-044's four invariants list drops permission-enforcement's audit dependency (the permission check itself is unaffected — only the change-history record is removed). No confirmed requirement elsewhere requires an audit trail, so nothing reinstates it.
- **Recorded in:** `11-decisions.md` D-066.

### Q-021: Product weight and dimension data
- **Status:** RESOLVED — 2026-09-13
- **Question:** Is weight data available for the existing catalogue, and are dimensions needed too?
- **Answer:** "Shipping-related weight/dimension handling will be managed by the shipping/BigSeller side. Do not make a complex product shipping-dimension system a core requirement unless later evidence shows it is necessary."
- **Effect:** REQ-028 is simplified: shipping cost is not computed from a captured weight/dimension field on the product. Instead it follows the configurable size-tier model in Q-040 (small / medium / large), set per product by staff as a category rather than a precise measurement. `variant.weight_grams` in `05-database.md` becomes optional, informational, and not load-bearing for any calculation.
- **Recorded in:** `11-decisions.md` D-067.

---

## Blocking Phase 3 — storefront, ordering, payment, tax invoice

### Q-022: Guest checkout contradicts guest browsing restriction
- **Status:** RESOLVED — 2026-09-13
- **Question:** Can a non-registered customer complete an order, or can a signed-out visitor only see front-page products?
- **Answer:** "Non-logged-in users can only view products on the front page. Do not implement unrestricted guest browsing/guest checkout. Resolve the previous contradiction in favor of this rule."
- **Effect:** REQ-010 ("order without registering") is **removed**. REQ-053 (signed-out visitor sees only front-page products) is confirmed as the rule and is no longer contradictory. `order.customer_id` in `05-database.md` is no longer nullable for this reason — every order belongs to a registered customer. The full category/search browsing experience (REQ-001, REQ-002) is for signed-in customers; what exactly a guest's "front page" shows (whether it includes search or category browsing) is a UI detail, not a new open question.
- **Recorded in:** `11-decisions.md` D-061.

### Q-023: Order status values are never enumerated
- **Status:** UNRESOLVED — candidate proposed, still needs client review
- **Question:** What is the complete set of order statuses, and what are the legal transitions between them?
- **Answer:** "This still needs to be reviewed. Do not invent the final order-status state machine yet. Keep it as an explicit pending business decision and propose the candidate statuses/transitions for review."
- **Effect:** Still genuinely open — `D-018` in `11-decisions.md` still holds: no code may assume a status set. A **candidate** is proposed below for the client to react to; it is not adopted.

  **Candidate statuses**, reflecting the two stock-deduction flows now confirmed in Q-024:

  | Status | Applies to | Meaning |
  | :--- | :--- | :--- |
  | `pending_payment` | Normal order, pre-order deposit | Order placed, K-Payment not yet confirmed |
  | `paid` | Normal order | Payment confirmed, stock deducted |
  | `awaiting_supplier` | Dropship | Staff checking supplier availability before payment is allowed (Q-047) |
  | `awaiting_stock` | Pre-order | Deposit or full payment received; goods not yet arrived (Q-024) |
  | `received` | Pre-order | Goods arrived from supplier; final stock deduction and balance due (Q-024) |
  | `shipped` | All | Handed to carrier via BigSeller |
  | `cancelled` | All | Order will not be fulfilled |
  | `completed` | All | Delivered, no further action expected |

  **Not proposed:** a `refunded` status, since refund payout is out of scope (Q-036); the abbreviated tax invoice/full tax invoice split does not need its own status, since it happens on top of `paid`.

- **Ask:** client — send this candidate back for review before it is built.

### Q-024: When is stock deducted?
- **Status:** RESOLVED — 2026-09-13
- **Question:** Is stock committed at order placement or at payment confirmation, and how is an unpaid order's hold released?
- **Answer:** For normal orders: "Deduct stock only after payment is completed. Export the resulting stock/order data to Excel. Use the Excel export to update BigSeller daily." For pre-order: "There can be a quota for delayed-delivery products where the customer pays the full amount before the product is physically received. The actual sale/stock deduction should happen when the product arrives and is recorded as received, not before."
- **Effect:** Two distinct flows, and they must not be merged into one:

  1. **Normal order:** no stock reservation at order placement. `03-architecture.md`'s order flow moves the `SELECT … FOR UPDATE` / deduct step from "order placed" to "K-Payment webhook confirms payment" (see also Q-030 — since bank transfer is removed, this is always the K-Payment webhook now). A daily Excel export of stock/order changes feeds BigSeller (see Q-043).
  2. **Pre-order:** a reservation **quota**, not a stock deduction, is held against the release-date cap when the order (full payment or deposit, per Q-041) is placed. The actual `variant.stock_quantity` deduction happens only when staff record the goods as **received** from the supplier — a new staff action, not an automatic one.

  `05-database.md`'s "what cannot be modelled yet" table drops this row; the reservation-quota concept for pre-order is new modelling work for phase 5, not phase 3.
- **Recorded in:** `11-decisions.md` D-068.

### Q-025: Registered tax identification number
- **Status:** UNRESOLVED — not yet available
- **Question:** When will the shop's registered tax ID be available?
- **Answer:** "Not available yet. Keep this pending."
- **Effect:** No change. Still blocks legally correct invoice issuance and go-live (`10-deployment.md`'s go-live checklist).
- **Ask:** client, no target date set

### Q-026: Abbreviated tax invoice or full tax invoice?
- **Status:** RESOLVED — 2026-09-13
- **Question:** Do any customers need a full tax invoice with name, address and tax ID?
- **Answer:** "The website only needs to issue a simplified tax invoice."
- **Effect:** REQ-024 is confirmed as written — the abbreviated (simplified) tax invoice is the only document the website itself generates. See Q-027 for what happens when a customer needs more than that.
- **Recorded in:** `11-decisions.md` D-069.

### Q-027 (extended): Full tax invoice handling and invoice numbering
- **Status:** RESOLVED (process) / PARTIALLY RESOLVED (exact output format)
- **Question:** Where does a full tax invoice come from, and what fields does the site need to collect for it? What is the invoice number format, and does the sequence reset annually?
- **Answer:** "The real/full tax invoice is handled by another system/website. Our website should: generate only the simplified invoice itself; send/provide the necessary invoice data to the other system; if a customer requests the full invoice, provide the necessary customer information such as name, address, personal tax ID / national ID where applicable, company legal entity tax ID (10 digits). The full tax invoice is ultimately generated by the other website/system. Most customers will use the simplified invoice. Please also request/inspect an example invoice before finalizing the exact output format."
- **Effect:** REQ-026 is unaffected (5-year retention still applies to whatever we hold). A new customer-data requirement follows from this: the customer record must be able to optionally hold a personal tax ID / national ID and a 10-digit company tax ID, and an order must be able to export enough data (customer identity + order total + line items) for the other system to build a full tax invoice from. This is added to `05-database.md`'s customer and order model as new, confirmed structure. **What is still open:** the exact simplified-invoice output format and the exact export shape for the other system, both of which explicitly wait on an example document that has not yet been supplied. Invoice number format (prefix, year reset, width) is unaffected by this answer and remains open under the original Q-027 wording.
- **Recorded in:** `11-decisions.md` D-069.
- **Ask (residual):** an example invoice, and the invoice number format — client

### Q-028: PDPA deletion versus 5-year document retention
- **Status:** RESOLVED — 2026-09-13
- **Question:** How is a PDPA deletion request handled for a customer with past orders subject to 5-year retention?
- **Answer:** "Tax/accounting-related documents are allowed to retain the necessary customer information for legal/accounting purposes. Treat this as an accepted retention exception rather than deleting legally required tax/accounting data."
- **Effect:** D-017 in `11-decisions.md` moves from Blocked to Accepted: a PDPA deletion request erases personal fields on the customer record and on order data **not** covered by the retention rule, and leaves the financial/tax-relevant fields on retained documents untouched, disclosed to the customer as a stated exception at the point they request deletion.
- **Recorded in:** `11-decisions.md` D-070 (supersedes the Blocked status of D-017).

### Q-029: Is PromptPay in the first phase?
- **Status:** RESOLVED — 2026-09-13
- **Question:** Is standalone PromptPay in scope, or only PromptPay via K-Payment?
- **Answer:** "Do not implement standalone PromptPay. Payment should be handled through K-Payment only."
- **Effect:** REQ-017 (standalone PromptPay) is **removed**. PromptPay exists only as the QR option inside the K-Payment flow, which was already how `14-integrations.md` described the K-Payment discussion notes — this closes the ambiguity in the requirement's favour.
- **Recorded in:** `11-decisions.md` D-071.

### Q-030: Bank transfer slip verification workflow
- **Status:** RESOLVED — 2026-09-13
- **Question:** What must staff check on a bank-transfer slip, and what happens on a mismatch or a missing slip?
- **Answer:** "Bank-transfer slip verification is no longer required because the payment flow will use K-Payment only. Remove the bank-transfer slip workflow from the implementation scope."
- **Effect:** This is a large change, not a small one. REQ-015 (bank transfer with slip upload) is **removed** entirely. **K-Payment becomes the sole payment method for every order from phase 3 onward**, not introduced later in phase 4 as previously sequenced. Since K-Payment credentials already exist (Q-033), the schedule in Q-004 folds K-Payment integration into phase 3 rather than phase 4 — see `02-scope-and-phases.md#schedule-and-budget`. `payment_slip` is dropped from `12-glossary.md`'s payment terms and from the file-upload rules in `08-security-testing.md`.
- **Recorded in:** `11-decisions.md` D-072.

### Q-031: Which notification emails can customers switch off
- **Status:** RESOLVED — 2026-09-13
- **Question:** Can a customer disable transactional email such as payment confirmation?
- **Answer:** "The requirement is not about allowing customers to disable transactional emails. Instead, customers should be able to view/filter order-status history and choose which period/status range they want to see. Please interpret the existing requirement accordingly and avoid implementing a notification opt-out system unless another confirmed requirement requires it."
- **Effect:** REQ-042 is rewritten from "customers control their own notifications" to "a customer can view and filter their order-status history by date range and by status" — a read/filter feature on the customer's order-history page, not a settings toggle. Transactional email (REQ-041) is sent unconditionally at every step; there is no opt-out anywhere in scope.
- **Recorded in:** `11-decisions.md` D-073.

### Q-032: Transactional email sending domain and provider
- **Status:** PARTIALLY RESOLVED — direction set, provider/domain detail pending
- **Question:** Who sends transactional email, and who controls DNS for sender authentication?
- **Answer:** "Use mail-relay as the current direction for transactional email. Keep exact provider/domain configuration as an implementation/configuration detail to finalize later."
- **Effect:** The category of solution is decided — a mail-relay service, configured through the adapter interface in `04-tech-stack-and-structure.md` so no specific vendor is named in domain code. The specific provider, sending domain, and DNS records are still open and depend on Q-053 (who controls tinzshop.com's DNS).
- **Recorded in:** `11-decisions.md` D-074.
- **Ask (residual):** specific mail-relay provider and DNS access — client, before phase 3 email actually needs to send

---

## Blocking Phase 4 — carrier, refunds, claims, shipping rules

*(K-Payment card payment itself is now scheduled in phase 3 — see Q-030 — so this phase is lighter than originally planned.)*

### Q-033: K-Payment merchant account and test data
- **Status:** PARTIALLY RESOLVED — credentials available, testing pending
- **Question:** When will the K-Payment merchant account and test credentials be available?
- **Answer:** "K-Payment merchant/test credentials are already available. The remaining task is to proceed with testing."
- **Effect:** No longer a blocker to starting the integration. `14-integrations.md`'s K-Payment status moves from NOT RESEARCHED toward RESEARCHED once the test credentials are actually exercised against the sandbox; that testing has not happened yet and is the next concrete step, not this documentation update.
- **Ask (residual):** conduct sandbox testing — developers, phase 3

### Q-034: First shipping carrier not selected
- **Status:** RESOLVED — 2026-09-13
- **Question:** Which carrier — Flash, Kerry or Thailand Post — should be integrated first?
- **Answer:** "Do not build direct carrier integrations for now. Shipping is handled through BigSeller."
- **Effect:** REQ-029 (integrate at least one real carrier) is **removed**. No carrier adapter is built. `14-integrations.md`'s "Shipping carrier" section is retired as a system we integrate with — BigSeller already covers this per Q-043.
- **Recorded in:** `11-decisions.md` D-075.

### Q-035: Return and warranty period, and who pays return shipping
- **Status:** RESOLVED — 2026-09-13
- **Question:** What is the return/warranty window, and who pays return shipping?
- **Answer:** "Return/warranty handling is case by case. Each marketplace/platform provides some level of support, and cases are handled directly between the customer and the shop. Do not build a complex centralized return/warranty policy engine unless later requirements require it."
- **Effect:** No fixed window or cost-allocation rule exists to encode. REQ-014's scope is reduced to letting a customer submit contact details and a description of the issue for staff to handle manually — no automated eligibility check, no policy engine.
- **Recorded in:** `11-decisions.md` D-076.

### Q-036: How are refunds actually paid out?
- **Status:** RESOLVED — 2026-09-13
- **Question:** Is a refund a manual bookkeeping record, or an automated payout through K-Payment?
- **Answer:** "Refund handling is not part of this system's responsibility. Treat it as out of scope."
- **Effect:** REQ-018 (full and partial refunds with history) is **removed**. If staff need to record that a refund happened outside the system, that is a note on the order, not a feature — and nothing currently confirmed asks even for that.
- **Recorded in:** `11-decisions.md` D-077.

### Q-037: Cancellation rules once shipping has started
- **Status:** RESOLVED — 2026-09-13
- **Question:** Are post-shipment returns handled entirely outside the system?
- **Answer:** "Handle this case by case. Do not implement a complex post-shipment cancellation/return workflow unless later confirmed."
- **Effect:** REQ-013 (request cancellation of an unshipped order) stands for the pre-shipment case. Nothing is built for post-shipment cancellation; it is a staff-handled conversation, consistent with Q-035.
- **Recorded in:** `11-decisions.md` D-076.

### Q-038: Warranty claim workflow
- **Status:** RESOLVED — 2026-09-13
- **Question:** What information is collected for a warranty claim, and who handles it?
- **Answer:** "Warranty depends on the individual product. There are distributors in Thailand. Warranty claims should be sent to the relevant distributor/representative. This does not need to be handled inside our system."
- **Effect:** REQ-014 does not need an in-system claim state machine. The site's role is limited to displaying the correct distributor/contact information per product (data on the product or its Sale Page — see Q-049) so the customer can pursue the claim themselves.
- **Recorded in:** `11-decisions.md` D-078.

### Q-039: Shipping label format
- **Status:** PARTIALLY RESOLVED — direction set, exact format pending an example
- **Question:** Does the label need to be the carrier's own barcoded label, or is a self-printed address label acceptable?
- **Answer:** "All order shipping operations are handled through BigSeller. However, our website should ideally support printing a simple shipping/address label from the order data. Please inspect an example label before finalizing the exact format. Tracking number is not required as a core feature at this stage. It can be exported/imported into BigSeller if needed."
- **Effect:** REQ-031 (tracking number visible to customer) is downgraded from a core requirement to an optional BigSeller export/import detail. A new light requirement is confirmed: print a simple address label (name, address, phone) from order data — no carrier barcode, no carrier API. The exact layout waits on an example label.
- **Recorded in:** `11-decisions.md` D-075.
- **Ask (residual):** an example label — client

### Q-040: Shipping rule parameters
- **Status:** RESOLVED (tiers and configurability) / open (measurement basis)
- **Question:** What shipping rules are needed on day one?
- **Answer:** "Current shipping concept: Small products (e.g. Nintendo/PS5 discs) — 50 THB. Medium products (e.g. controllers) — 100 THB. Large products — free shipping. The classification should eventually be based on weight or dimensions, but we need to review which measurement is more appropriate. Shipping prices should be configurable by the shop owner."
- **Effect:** REQ-030 is confirmed with a concrete three-tier model — small / medium / large, each a shop-owner-configurable price, defaulting to the candidate values above. Consistent with Q-021: the tier is a category staff assign, not a computed function of a captured weight or dimension figure, until the client decides which measurement basis is worth the extra data entry.
- **Recorded in:** `11-decisions.md` D-079.
- **Ask (residual):** weight vs. dimensions as the long-term classification basis — client

---

## Blocking Phase 5 — pre-order, dropship, Shopee stock sync

### Q-041: Pre-order deposit percentage and balance due date
- **Status:** RESOLVED — 2026-09-13
- **Question:** What is the deposit percentage, and when is the balance collected?
- **Answer:** "Do not hard-code the deposit percentage or balance timing. Design it so the shop owner can configure these values themselves."
- **Effect:** REQ-048 is confirmed with owner-configurable deposit percentage and balance-collection timing, stored as data (similar in spirit to the shipping tiers in Q-040 and the role permissions in Q-016) rather than a constant in code.
- **Recorded in:** `11-decisions.md` D-080.

### Q-042: Shopee Partner account and test shop
- **Status:** UNRESOLVED — not yet available
- **Question:** Is a Shopee Partner account and test shop available?
- **Answer:** "Shopee Partner/Test access is not available yet. Keep this pending."
- **Effect:** No change. Still blocks any Shopee research or build work.
- **Ask:** client, no target date set

### Q-043: BigSeller live API versus daily file import — undecided
- **Status:** RESOLVED — 2026-09-13
- **Question:** Which approach — paid realtime API or daily file import — is used for stock sync?
- **Answer:** "Use daily file export/import as the primary approach. The BigSeller paid API / real-time approach is a secondary/future option, potentially to be implemented later if the purchase/order volume justifies it. Do not make the paid real-time API a Phase 1 dependency."
- **Effect:** `03-architecture.md`'s "stock changing somewhere else" flow is decided: the scheduled-file-import branch, not the live-API branch. This directly enables Q-024's normal-order flow (deduct at payment, export daily to update BigSeller) and removes the paid API entirely from the phase 5 budget.
- **Recorded in:** `11-decisions.md` D-081.

### Q-044: BigSeller account, codes and pricing
- **Status:** PARTIALLY RESOLVED — account exists, SKU data still pending
- **Question:** Does the shop have a BigSeller account, what does the API cost, and how do BigSeller codes map to Parent SKU / ModelSKU?
- **Answer:** "The shop already has a BigSeller account. However: BigSeller has limitations regarding access/opening APIs for smaller retailers. We need to inspect the real BigSeller data. We need example SKU data. We need to understand how SKU codes are generated. We need to determine who generates them. We need to establish how they map to Parent SKU / ModelSKU. Do not finalize the SKU rules until the actual BigSeller examples are reviewed."
- **Effect:** The account-existence half is resolved (yes, and API access for a smaller retailer may be limited — consistent with Q-043's choice of the file-based approach as primary). The SKU mapping half joins Q-007, Q-011, Q-012 and Q-014 as the same underlying dependency: **someone needs to sit down with the real BigSeller account and pull actual product/stock/SKU examples before the catalogue's identity rules can be finalized.**
- **Ask (residual):** BigSeller data inspection — this is the single most-blocking research task left in the project; it gates four separate questions.

### Q-045: How to extract data from Shopee
- **Status:** UNRESOLVED — research required
- **Question:** How is data extracted from Shopee, and what are its real-world limitations?
- **Answer:** "Wait for actual examples/data before finalizing the Shopee extraction design. Keep this as a research item for now."
- **Effect:** No change. Blocked on Q-042 (no Shopee access yet) as well as being its own research task.
- **Ask:** research, blocked on Q-042

### Q-046: Stock discrepancy detection and reconciliation
- **Status:** RESOLVED — 2026-09-13
- **Question:** What is the reconciliation process, and which system wins when Shopee and site stock disagree?
- **Answer:** "Use Shopee as the primary reference/source of truth when stock data conflicts. Document the daily synchronization/reconciliation flow around this decision."
- **Effect:** Shopee is authoritative on conflict. The daily reconciliation flow itself — exactly how a discrepancy is detected given the file-based sync in Q-043 — still depends on seeing real Shopee and BigSeller export formats (Q-045), but the authority rule needed to design it is now fixed.
- **Recorded in:** `11-decisions.md` D-082.

### Q-047: Dropship supplier confirmation before payment
- **Status:** RESOLVED — 2026-09-13
- **Question:** How does the shop confirm supplier stock before the customer pays for a dropship item?
- **Answer:** "Before the customer places/pays for a dropship order: the customer should have a Contact Staff / Check Availability action. Staff checks with the supplier. If stock is available, staff authorizes/allows the customer to proceed with the order. If stock is unavailable, staff contacts the customer and cancels the request/order. Do not assume normal immediate checkout for dropship products."
- **Effect:** REQ-050 gains a concrete pre-payment gate: a dropship product shows a "Contact staff / Check availability" action instead of an immediate add-to-cart-and-pay flow. This produces the `awaiting_supplier` candidate status in Q-023.
- **Recorded in:** `11-decisions.md` D-083.

---

## Blocking Phase 6 — news, content pages, reports

### Q-048: "Product review" means two different things
- **Status:** RESOLVED — 2026-09-13
- **Question:** Are the staff blog category and the customer-written feature the same thing, and is the customer-written one in scope?
- **Answer:** "There is no 'product review' blog/news feature. The system should have: Blog/News content written by staff. A separate product review feature where customers can review products. Keep these as separate concepts."
- **Effect:** Two distinct, both-confirmed features. REQ-047 (game news, staff-written, with categories) drops "product reviews" as a news category. A new requirement is added for customer-submitted product reviews, consistent with Q-002 confirming this was in scope all along — see `02-scope-and-phases.md`'s new REQ-054.
- **Recorded in:** `11-decisions.md` D-084.

### Q-049: Relationship between a product's sale page and news articles
- **Status:** RESOLVED — 2026-09-13
- **Question:** Is the "Sale page" the normal product page, a separate landing page, or linked news articles?
- **Answer:** "The Sale Page is a separate page, not simply the normal product page and not just a news article."
- **Effect:** A new content type, distinct from both the product page and a news article. Added as REQ-055 in `02-scope-and-phases.md`. It is also where the distributor/warranty contact information from Q-038 can reasonably live.
- **Recorded in:** `11-decisions.md` D-085.
- **Note:** existing/old content should be migrated into the new system before this is built out — see the phase 6 goal in `02-scope-and-phases.md`.

### Q-050: Accounting export format and fields
- **Status:** UNRESOLVED — pending review
- **Question:** What file format and columns does the accounting team need?
- **Answer:** "The exact accounting data/format still needs to be reviewed. Keep this pending and do not invent the accounting team's required columns yet."
- **Effect:** No change. REQ-027 still cannot specify its output shape.
- **Ask:** client, no target date set

---

## Blocking Phase 7 — testing, training, go live

### Q-051: Staff training scope
- **Status:** RESOLVED — 2026-09-13
- **Question:** How many staff, in which roles, in what format, is written Thai material required?
- **Answer:** "Create one complete training version/manual in Thai rather than separate versions for different roles."
- **Effect:** One combined Thai-language manual covering all six roles, rather than role-specific documents. Simpler and cheaper, consistent with the 100,000 THB budget.
- **Recorded in:** `11-decisions.md` D-086.

### Q-052: Acceptance criteria and who signs off
- **Status:** RESOLVED — 2026-09-13
- **Question:** What counts as passing each phase, and who signs off?
- **Answer:** "Please design the acceptance criteria and sign-off process for me. Create practical acceptance criteria for each phase, including what must be tested/passed before a phase can be considered complete."
- **Effect:** Drafted in a new document, `15-acceptance-criteria.md`, covering all nine phases. **This is a proposal from the project side and needs a named approver from the client**, which nobody on the build side can supply — see the residual item below.
- **Ask (residual):** who at the shop signs off each phase — client

### Q-053: Domain, DNS and production environment ownership
- **Status:** RESOLVED — 2026-09-13
- **Question:** Who owns the tinzshop.com domain, DNS, and the production hosting account?
- **Answer:** "The domain/hosting ownership is currently with my father. Keep the exact account/access details as an operational dependency rather than blocking development."
- **Effect:** Ownership is known; the specific account credentials and access process are not yet arranged, and are explicitly treated as an operational task rather than a design blocker. It still must be resolved before phase 7 go-live (TLS, DNS, email sender authentication in Q-032, Cloudflare in Q-054 all need it), but it no longer blocks the architecture or earlier-phase work.
- **Recorded in:** `11-decisions.md` — no new D-row; this is an operational fact, not a design decision.
- **Ask (residual):** actual DNS/hosting account access, arranged with the domain owner — client, before phase 7

---

## Blocking Phase 8 — security and bot verification

### Q-054: Cloudflare scope and account ownership
- **Status:** RESOLVED — 2026-09-13
- **Question:** Which Cloudflare capabilities, on what plan, owned by whom?
- **Answer:** "Use Cloudflare Free. The immediate purpose is mainly to verify/configure the necessary security/bot protection functionality. Do not introduce paid Cloudflare services unless a future requirement justifies them."
- **Effect:** Cloudflare Free plan, scoped to basic security and bot protection (WAF managed rules, bot fight mode, DNS proxying) — no paid tier. Account ownership follows Q-053 (the domain owner).
- **Recorded in:** `11-decisions.md` D-087.

---

## Blocking Phase 9 — database backup

### Q-055: Backup retention and recovery targets
- **Status:** RESOLVED — 2026-09-13
- **Question:** How long are backups kept, where stored, how much data loss is acceptable, must a restore be tested?
- **Answer:** "Keep the backup design lightweight for now. Transaction data is also recorded in BigSeller, and long-term retention of our application's transaction database is not considered a priority at this stage. Please propose a reasonable backup strategy that fits the 100,000 THB total budget without over-engineering it. Keep the final retention/recovery policy documented as a decision that can be revisited later."
- **Effect:** A lightweight strategy is proposed in `10-deployment.md#backup`: automatic daily full-database backup, 30-day rolling retention, one restore performed and timed before go-live, no point-in-time recovery. It leans on BigSeller already holding a secondary record of transaction data, which is why deep retention is not worth the budget here. Explicitly recorded as revisitable, not a permanent policy.
- **Recorded in:** `11-decisions.md` D-088.

---

## Residual items — not new questions, but not fully closed either

These came out of otherwise-resolved answers above. None blocks the phase it is filed under; each is a loose end worth tracking so it does not get lost.

| From | What is still needed | Ask |
| :--- | :--- | :--- |
| Q-018 | Who writes Thai/English translations, and the fallback when one is missing | client |
| Q-027 | An example invoice, to finalize the simplified invoice's exact fields and the export shape for the full-invoice system | client |
| Q-032 | Specific mail-relay provider and DNS access for sender authentication | client |
| Q-033 | Actually run K-Payment sandbox testing | developers |
| Q-039 | An example shipping label | client |
| Q-040 | Whether weight or dimensions is the long-term shipping-tier classification basis | client |
| Q-044 / Q-007 / Q-011 / Q-012 / Q-014 | One BigSeller data-inspection session covering stock, Excel export, and SKU examples — this single task resolves five open questions at once | client, with developer access to the account |
| Q-052 | A named approver for each phase's sign-off | client |
| Q-053 | Actual DNS/hosting account access | client, via the domain owner |
