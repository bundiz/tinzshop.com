# Open Questions

Every unknown, contradiction, gap, and missing reference found in
`docs/reference/client-summary-th.md`.

**The source is a client sign-off summary, not an approved requirements spec.
Every ☐ checkbox in it is UNCONFIRMED.** Nothing below may be resolved by
assumption. Resolve a question only with an answer from the party named in
**Ask**, then change its **Status** and record where the answer came from.

Sorted by the phase they block. Phase numbers refer to
`docs/project/scope-and-phases.md`.

---

## Blocking Phase 1 — planning and sign-off

### Q-001: The source document has not been signed off
- **Status:** UNRESOLVED
- **Question:** Every checkbox in `client-summary-th.md` is unticked (☐). Has the client reviewed and confirmed the scope, and if so which items are agreed and which are amended?
- **Why it matters:** Every requirement in `requirements.md` is recorded as PROPOSED. Until sign-off there is no agreed scope, so any build work risks being rejected.
- **Blocks phase:** 1
- **Ask:** client

### Q-002: Meaning of the `+` symbol in section 10
- **Status:** UNRESOLVED
- **Question:** Section 10 is titled "not included in this phase" and marks most rows with `✗`, but four rows are marked `+`: loyalty points/gift cards, K-Payment installments, customer product reviews, and wishlist. The `+` symbol is never defined. Does `+` mean "add to scope", "client requested, not yet priced", or something else?
- **Why it matters:** Four features are of unknown scope status. They cannot be listed as either requirements or non-goals, and they change effort and cost.
- **Blocks phase:** 1
- **Ask:** client

### Q-003: K-Payment installments appear both in scope and in the exclusions section
- **Status:** UNRESOLVED
- **Question:** Section 3 describes credit-card installments as part of the K-Payment flow ("บัตรเครดิต แบบผ่อน (เลือกเปิดได้)"), while section 10 lists "ระบบผ่อนชำระ -> K-Payment" among the excluded items with a `+`. Is installment payment in scope?
- **Why it matters:** Contradiction inside the source. Affects the payment work in phase 4.
- **Blocks phase:** 1
- **Ask:** client

### Q-004: Phases 2 through 9 have no dates
- **Status:** UNRESOLVED
- **Question:** The delivery table in section 11 gives a date only for phase 1. What are the target dates for phases 2–9?
- **Why it matters:** No delivery plan, no sequencing commitment, and no way to tell whether the client's information deadlines (section 12) will be met in time.
- **Blocks phase:** 1
- **Ask:** client

### Q-005: The phase 1 date is ambiguous and has passed
- **Status:** UNRESOLVED
- **Question:** Phase 1 is dated `02/09` with no year. The document header is dated 22 August 2569 BE (2026 CE). Is `02/09` 2 September 2026, and is that deadline now being extended?
- **Why it matters:** The date is unclear and appears to be in the past, so the current phase status is unknown.
- **Blocks phase:** 1
- **Ask:** client

### Q-006: No cost information anywhere
- **Status:** UNRESOLVED
- **Question:** The "ค่าใช้จ่าย" (cost) column in the section 11 delivery table is blank for all nine phases. What is the budget or price per phase?
- **Why it matters:** Section 10 warns that adding scope affects time and budget, but there is no baseline budget to compare against. Also blocks any decision that carries a recurring fee, such as the BigSeller API (Q-043).
- **Blocks phase:** 1
- **Ask:** client

### Q-007: The referenced contract has not been provided
- **Status:** UNRESOLVED
- **Question:** Section 4 defines the Parent SKU / ModelSKU structure "ตามที่ระบุไว้ในสัญญา" (as specified in the contract), and section 8 refers to permission levels "ตามที่ตกลงไว้" (as agreed). Neither the contract nor the prior agreement is available. Can they be supplied?
- **Why it matters:** Two core structures — the SKU scheme and the staff permission model — are defined by reference to a document nobody on the build side has. See also Q-014 and Q-015.
- **Blocks phase:** 1
- **Ask:** client

### Q-008: Technology stack is undecided
- **Status:** UNRESOLVED
- **Question:** The source lists Medusa JS as an item to evaluate ("เพิ่มเติม Medusa JS ตัดสินใจเรื่อง tech stack") and names Cloudflare, Shopee, BigSeller and K-Payment as phase 1 research topics. What stack will be used?
- **Why it matters:** The phase 1 deliverable includes making this call. Nothing can be built until it is made, and several other questions (backups, hosting, database) depend on it.
- **Blocks phase:** 2
- **Ask:** developers

### Q-009: Project email address is inconsistent in the source
- **Status:** UNRESOLVED
- **Question:** The source asks for one mailbox, written as `tech@tinzshop.com` but hyperlinked to `tech@tinzshopl.com` (note the extra `l`). Which is correct, who creates and owns it, and is it also the sender address for customer email?
- **Why it matters:** Team tooling registration is blocked, and the address may be reused for transactional email (Q-032).
- **Blocks phase:** 1
- **Ask:** client

---

## Blocking Phase 2 — products, variants, stock, Excel

### Q-010: VAT contradiction between sections 6 and 12
- **Status:** UNRESOLVED
- **Question:** Section 6 states that all products already include VAT and nothing is added on top ("ทุกสินค้า include vat แล้ว ไม่มีการบวกเพิ่ม"). Section 12 item 3 asks the client to confirm whether displayed prices include VAT or not. Which is true?
- **Why it matters:** Direct contradiction inside the source. It determines how every price is stored, how order totals are computed, and what appears on the tax invoice. Getting it wrong misstates tax on every order.
- **Blocks phase:** 2
- **Ask:** client

### Q-011: Real stock quantities per SKU
- **Status:** UNRESOLVED
- **Question:** Section 12 item 1 requires actual on-hand quantities for every product code. When will this data be provided, and in what format?
- **Why it matters:** The source states stock deduction cannot work without real numbers. Named by the client as a blocker.
- **Blocks phase:** 2
- **Ask:** client

### Q-012: Current Excel file format
- **Status:** UNRESOLVED
- **Question:** Section 12 item 4 asks for the Excel file format the shop uses today, so existing files keep working. Can a real sample file be provided?
- **Why it matters:** Import/export must accept the shop's existing files including multi-variant products. Without a sample the column layout would have to be invented.
- **Blocks phase:** 2
- **Ask:** client

### Q-013: Maximum number of option types per product
- **Status:** UNRESOLVED
- **Question:** Section 12 item 10 asks whether two option types per product (e.g. colour + capacity) is enough, or more are needed.
- **Why it matters:** Determines whether the variant model is fixed-depth or arbitrary. Changing it later is expensive.
- **Blocks phase:** 2
- **Ask:** client

### Q-014: Parent SKU and ModelSKU format rules are unknown
- **Status:** UNRESOLVED
- **Question:** The source says each product has one Parent SKU and each model its own ModelSKU, but gives no format, length, allowed characters, or rule for whether a ModelSKU embeds its Parent SKU. The stated source is the contract (Q-007).
- **Why it matters:** SKUs are the join key to Shopee, BigSeller, Excel imports and the accounting export. The format cannot be invented.
- **Blocks phase:** 2
- **Ask:** client

### Q-015: "4 permission levels" but six roles are listed
- **Status:** UNRESOLVED
- **Question:** Section 8 states permissions are split into 4 levels "as agreed", then lists six: Blogger, Sale-manager, Admin, top-level Admin, customer, and non-logged-in visitor. Are the 4 levels the staff roles only, with customer and guest being something else?
- **Why it matters:** The role model underpins every admin screen. An off-by-two in the role list means the wrong access model.
- **Blocks phase:** 2
- **Ask:** client

### Q-016: Which permissions are owner-configurable
- **Status:** UNRESOLVED
- **Question:** Section 8 says the shop owner can adjust each role's permissions without a programmer. Which permissions are adjustable, at what granularity, and can roles be created or only edited?
- **Why it matters:** The difference between a fixed role list and a full permission-editing UI is large, and it is a stated requirement that no programmer is needed.
- **Blocks phase:** 2
- **Ask:** client

### Q-017: Staff two-factor — email or phone?
- **Status:** UNRESOLVED
- **Question:** Section 8 says OTP two-step verification "by email or phone number". Is it one of the two, either at the user's choice, or both required?
- **Why it matters:** Phone OTP needs an SMS provider that is named nowhere in the source; email OTP does not. Changes the integration list.
- **Blocks phase:** 2
- **Ask:** client

### Q-018: Who produces the Thai and English content
- **Status:** UNRESOLVED
- **Question:** The site is bilingual. Must every product name, description, content page and news article exist in both languages, and who writes the translations? What happens when a translation is missing?
- **Why it matters:** Determines whether translation fields are mandatory and whether a fallback language is needed.
- **Blocks phase:** 2
- **Ask:** client

### Q-019: "Low stock" threshold is not defined
- **Status:** UNRESOLVED
- **Question:** Section 4 requires the site to show in stock / low stock / out of stock without revealing real quantities, and section 8 requires a near-out-of-stock list. At what quantity does a product become "low"? Is it global or per product?
- **Why it matters:** The rule cannot be invented; it is a merchandising decision.
- **Blocks phase:** 2
- **Ask:** client

### Q-020: Audit log scope and retention
- **Status:** UNRESOLVED
- **Question:** Section 8 requires recording every price, stock and order-status change with who and when. How long must these records be kept, and who may read them?
- **Why it matters:** Retention affects storage and any PDPA deletion request (Q-028).
- **Blocks phase:** 2
- **Ask:** client

### Q-021: Product weight and dimension data
- **Status:** UNRESOLVED
- **Question:** Section 7 requires shipping cost calculated from destination and real weight. Weight is a product attribute that must be captured when products are created. Is weight data available for the existing catalogue, and are dimensions needed too?
- **Why it matters:** If weight is not captured in phase 2, the phase 4 shipping calculation has no input and the catalogue must be re-entered.
- **Blocks phase:** 2
- **Ask:** client

---

## Blocking Phase 3 — storefront, ordering, bank transfer, tax invoice

### Q-022: Guest checkout contradicts guest browsing restriction
- **Status:** UNRESOLVED
- **Question:** Section 2 says customers can add to cart and order without registering. Section 8 says non-logged-in users can only see products on the front page ("ผู้ใช้งานที่ไม่ login ดูได้แค่สินค้าหน้าแรก"). These cannot both hold. Which applies?
- **Why it matters:** Contradiction inside the source. It decides whether guest checkout exists at all, which changes the order model, the account model and the whole storefront funnel.
- **Blocks phase:** 3
- **Ask:** client

### Q-023: Order status values are never enumerated
- **Status:** UNRESOLVED
- **Question:** The source refers to order statuses throughout but never lists them. Section 8 names five email trigger points (order received, payment confirmed, shipped, cancelled, refunded) and section 5 names a "waiting for supplier" queue. Is that the complete set, and what are the legal transitions between them?
- **Why it matters:** Order status drives the storefront, the staff queue, the email triggers and the reports. Two developers will otherwise invent two different status sets. See `glossary.md`.
- **Blocks phase:** 3
- **Ask:** client

### Q-024: When is stock deducted?
- **Status:** UNRESOLVED
- **Question:** Section 4 requires true stock deduction so the shop cannot oversell even when two customers click at the same time. Is stock committed when the order is placed, or only when payment is confirmed? If it is held at order time, for how long before an unpaid order releases it?
- **Why it matters:** Bank transfer payment is verified by hand, so there is a gap between order and confirmation. Without a rule, either stock is oversold or it is locked up indefinitely by unpaid orders.
- **Blocks phase:** 3
- **Ask:** client

### Q-025: Registered tax identification number
- **Status:** UNRESOLVED
- **Question:** Section 12 item 2 requires the registered tax ID. When will it be available?
- **Why it matters:** The source states legally correct tax invoices cannot be issued without it. Named by the client as a blocker.
- **Blocks phase:** 3
- **Ask:** client

### Q-026: Abbreviated tax invoice or full tax invoice?
- **Status:** UNRESOLVED
- **Question:** Section 6 says the system issues an abbreviated tax invoice ("ใบกำกับภาษีอย่างย่อ") automatically for every order. Section 2 says customers can download their tax invoice. Do any customers need a full tax invoice showing their name, address and tax ID — for example business buyers?
- **Why it matters:** A full tax invoice requires collecting buyer tax details at checkout, which the source never mentions. Adding it later changes checkout and the customer record.
- **Blocks phase:** 3
- **Ask:** client

### Q-027: Invoice numbering scheme and 5-year storage
- **Status:** UNRESOLVED
- **Question:** Section 6 requires gap-free sequential invoice numbers even under concurrent orders, and 5-year retention. What is the required number format, does the sequence reset annually, and where must the documents be stored?
- **Why it matters:** The uniqueness and gap-free guarantee is a hard constraint on the design. The format cannot be invented and the retention location is unspecified.
- **Blocks phase:** 3
- **Ask:** client

### Q-028: PDPA deletion versus 5-year document retention
- **Status:** UNRESOLVED
- **Question:** Section 9 requires customers to be able to delete their personal data under PDPA. Section 6 requires tax documents to be kept for 5 years, and those documents contain customer data. How is a deletion request handled for a customer who has past orders?
- **Why it matters:** The two requirements conflict. Getting it wrong is a legal exposure in either direction. Likely needs legal input, not just a client preference.
- **Blocks phase:** 3
- **Ask:** client

### Q-029: Is PromptPay in the first phase?
- **Status:** UNRESOLVED
- **Question:** Section 3 lists PromptPay and explicitly asks the client to say if it is wanted in the first phase ("หากต้องการในเฟสแรก กรุณาระบุ"). The section 3 notes also describe PromptPay QR as something reached through K-Payment. Is standalone PromptPay in scope, or only PromptPay via K-Payment?
- **Why it matters:** An unanswered question the source itself asks. Determines whether phase 3 has one payment method or two.
- **Blocks phase:** 3
- **Ask:** client

### Q-030: Bank transfer slip verification workflow
- **Status:** UNRESOLVED
- **Question:** Customers upload a slip and staff verify it by hand. What must staff check, how long may verification take, what happens if the amount does not match, and what if no slip is uploaded at all?
- **Why it matters:** This is the only payment method in phase 3, the phase where the shop starts selling for real. The unhappy paths are undefined and they interact with stock holding (Q-024).
- **Blocks phase:** 3
- **Ask:** client

### Q-031: Which notification emails can customers switch off
- **Status:** UNRESOLVED
- **Question:** Section 8 requires automatic email at every step and also says customers can turn notifications on and off themselves. Can a customer disable transactional mail such as payment confirmation, or only some categories?
- **Why it matters:** Letting customers disable payment or shipping confirmations creates disputes; the source does not distinguish transactional from optional mail.
- **Blocks phase:** 3
- **Ask:** client

### Q-032: Transactional email sending domain and provider
- **Status:** UNRESOLVED
- **Question:** Automatic email is required at every order step, but no sending provider or sender domain is named. Who controls DNS for tinzshop.com so sender authentication can be configured?
- **Why it matters:** Order confirmation email is required in phase 3 and cannot be delivered reliably without this. See also Q-009.
- **Blocks phase:** 3
- **Ask:** client

---

## Blocking Phase 4 — card payment, carriers, refunds, claims

### Q-033: K-Payment merchant account and test data
- **Status:** UNRESOLVED
- **Question:** Section 12 item 5 requires the K-Payment merchant account and test credentials. When will they be available?
- **Why it matters:** Card payment cannot be built or tested without them. Named by the client as a blocker.
- **Blocks phase:** 4
- **Ask:** client

### Q-034: First shipping carrier not selected
- **Status:** UNRESOLVED
- **Question:** Section 7 requires integration with at least one real carrier and asks the client to name which one to start with (Flash / Kerry / Thailand Post). Section 12 item 6 also requires the carrier account. Which carrier?
- **Why it matters:** An unanswered question the source itself asks. Each carrier is a different integration; nothing about shipping can be researched until it is chosen.
- **Blocks phase:** 4
- **Ask:** client

### Q-035: Return and warranty period, and who pays return shipping
- **Status:** UNRESOLVED
- **Question:** Section 12 item 7 requires the return/warranty window and who pays the cost of return shipping.
- **Why it matters:** These are the business rules behind the claims feature. Named by the client as a blocker.
- **Blocks phase:** 4
- **Ask:** client

### Q-036: How are refunds actually paid out?
- **Status:** UNRESOLVED
- **Question:** Section 3 says staff can refund in full or in part with a history record. For bank transfer orders, is the money returned manually outside the system with staff only recording it, or is there an automated path? For card orders, is the refund pushed through K-Payment?
- **Why it matters:** Determines whether refund is a bookkeeping record or an integration. The section 2 notes describe staff cancelling and refunding by hand, which suggests the former, but this is a note, not a requirement.
- **Blocks phase:** 4
- **Ask:** client

### Q-037: Cancellation rules once shipping has started
- **Status:** UNRESOLVED
- **Question:** Section 2 says customers can request cancellation of orders not yet shipped. The notes then say that if the order is already in shipping or received and the customer wants to return it, "ไม่ต้องอัพเดท" (no need to update). Does that mean returns after shipping are handled entirely outside the system?
- **Why it matters:** Decides whether a post-shipment return flow exists at all. The note is ambiguous and is a discussion note, not a requirement.
- **Blocks phase:** 4
- **Ask:** client

### Q-038: Warranty claim workflow
- **Status:** UNRESOLVED
- **Question:** Section 2 says customers can file a claim through the website and section 9 requires a warranty registration form. What information is collected, what states does a claim move through, who handles it, and is the customer notified?
- **Why it matters:** "File a claim" is one line in the source with no process behind it.
- **Blocks phase:** 4
- **Ask:** client

### Q-039: Shipping label format
- **Status:** UNRESOLVED
- **Question:** The section 7 note says printing a cover label with name, address and phone from the order is sufficient ("ส่งข้อมูลจาก Order มา print ใบปะหน้า ... = จบ"). Does the label need to be the carrier's own barcoded label produced through their system, or is a self-printed address label acceptable?
- **Why it matters:** A carrier barcode label requires the carrier API; a plain address label does not. This materially changes the carrier integration.
- **Blocks phase:** 4
- **Ask:** client

### Q-040: Shipping rule parameters
- **Status:** UNRESOLVED
- **Question:** Section 7 says staff can set shipping rules such as free shipping above a spend threshold. What rules are needed on day one, and what is the threshold?
- **Why it matters:** Determines how general the shipping rule engine must be.
- **Blocks phase:** 4
- **Ask:** client

---

## Blocking Phase 5 — pre-order, dropship, Shopee stock sync

### Q-041: Pre-order deposit percentage and balance due date
- **Status:** UNRESOLVED
- **Question:** Section 12 item 8 requires the deposit percentage and when the remaining balance is collected.
- **Why it matters:** Split payment is the core of the pre-order feature. Named by the client as a blocker.
- **Blocks phase:** 5
- **Ask:** client

### Q-042: Shopee Partner account and test shop
- **Status:** UNRESOLVED
- **Question:** Section 12 item 9 requires a Shopee Partner account and a test shop.
- **Why it matters:** Shopee stock sync cannot be researched or built without them. Named by the client as a blocker.
- **Blocks phase:** 5
- **Ask:** client

### Q-043: BigSeller live API versus daily file import — undecided
- **Status:** UNRESOLVED
- **Question:** Section 4 presents two alternatives: update stock through BigSeller's paid API, or export stock daily from BigSeller or Shopee and import the file into the site, which is not realtime. Which approach?
- **Why it matters:** The two designs are entirely different. One is a paid realtime integration, the other a scheduled file job with a stale-data window. Also depends on the missing budget (Q-006).
- **Blocks phase:** 5
- **Ask:** client

### Q-044: BigSeller account, codes and pricing
- **Status:** UNRESOLVED
- **Question:** The source notes "รหัส BigSaler" (BigSeller codes) and marks BigSeller as needing further study. Does the shop already have a BigSeller account, what does the API cost, and how do BigSeller product codes map to Parent SKU / ModelSKU?
- **Why it matters:** Needed to evaluate Q-043 at all. The product code mapping is the join key between the two systems.
- **Blocks phase:** 5
- **Ask:** client

### Q-045: How to extract data from Shopee
- **Status:** UNRESOLVED
- **Question:** The source records an open note to find out how to get data out of Shopee ("ดูวิธีการดึงข้อมูลออกจาก Shopee"), and the phase 2 note asks what Shopee's real-world limitations are and whether they can be reflected on the site. What are those limits?
- **Why it matters:** An unanswered research item the source itself raises. Shapes the whole stock sync design.
- **Blocks phase:** 5
- **Ask:** research

### Q-046: Stock discrepancy detection and reconciliation
- **Status:** UNRESOLVED
- **Question:** The phase 2 note asks how to detect a dropped order where stock was not updated and the two systems disagree ("Order หลุด ไม่ได้ update stock ไม่เท่า เช็คยังไง"). What is the reconciliation process, and which system wins when they disagree?
- **Why it matters:** A raised-but-unanswered question in the source. Any two-way stock sync needs a defined authority and a mismatch procedure.
- **Blocks phase:** 5
- **Ask:** client

### Q-047: Dropship supplier confirmation before payment
- **Status:** UNRESOLVED
- **Question:** The section 5 note says the shop must confirm with the supplier that stock actually exists before the customer can pay ("ก่อนลูกค้าชำระเงิน confirm กับร้านค้าก่อนว่ามีของจริงไหม จึงจะจ่ายเงินได้"). How does the customer wait, how long is acceptable, and what happens if the supplier says no?
- **Why it matters:** This inserts a manual pause into checkout, which is a very different flow from a normal order. It is currently only a discussion note.
- **Blocks phase:** 5
- **Ask:** client

---

## Blocking Phase 6 — news, content pages, reports

### Q-048: "Product review" means two different things
- **Status:** UNRESOLVED
- **Question:** Section 2 lists "รีวิวสินค้า" as a news/blog category written by staff. Section 10 lists "รีวิวสินค้าโดยลูกค้า" (customer-written reviews) with a `+`. Are these two separate features, and is the customer-written one in scope (see Q-002)?
- **Why it matters:** The same Thai phrase covers a staff blog category and a customer-generated content feature with moderation needs. They must not be conflated in naming or scope.
- **Blocks phase:** 6
- **Ask:** client

### Q-049: Relationship between a product's sale page and news articles
- **Status:** UNRESOLVED
- **Question:** The section 9 note asks for a sale page per product carrying information or news about that product ("Sale page ของสินค้าแต่ละตัว ข้อมูลหรือข่าวของสินค้านั้นๆ"). Is this the normal product page, a separate landing page, or news articles linked to a product?
- **Why it matters:** Determines whether news articles need to be linked to products, and whether a separate page type exists.
- **Blocks phase:** 6
- **Ask:** client

### Q-050: Accounting export format and fields
- **Status:** UNRESOLVED
- **Question:** Section 6 requires exporting monthly sales for the accounting team with a daily summary of units sold per SKU. What file format and columns does the accounting team need?
- **Why it matters:** An export nobody can load is useless. The receiving system is unnamed.
- **Blocks phase:** 6
- **Ask:** client

---

## Blocking Phase 7 — testing, training, go live

### Q-051: Staff training scope
- **Status:** UNRESOLVED
- **Question:** Phase 7 includes staff training. How many staff, in which roles, in what format, and is written material in Thai required?
- **Why it matters:** Training effort is a deliverable with no definition.
- **Blocks phase:** 7
- **Ask:** client

### Q-052: Acceptance criteria and who signs off
- **Status:** UNRESOLVED
- **Question:** Phase 7 is "test the system, train staff, go live". What counts as passing, and who at the shop signs off each phase?
- **Why it matters:** Without a named approver and criteria, no phase can be formally completed.
- **Blocks phase:** 7
- **Ask:** client

### Q-053: Domain, DNS and production environment ownership
- **Status:** UNRESOLVED
- **Question:** Who currently owns the tinzshop.com domain and its DNS, and who will own the production hosting account and its billing?
- **Why it matters:** Go-live, email authentication (Q-032) and Cloudflare (Q-054) all need DNS control. Hosting choice itself depends on Q-008.
- **Blocks phase:** 7
- **Ask:** client

---

## Blocking Phase 8 — security and bot verification

### Q-054: Cloudflare scope and account ownership
- **Status:** UNRESOLVED
- **Question:** Phase 8 is "Security, verify bot – CloudFlare" and Cloudflare is a phase 1 research topic. Which Cloudflare capabilities are wanted, on what plan, and who owns the account?
- **Why it matters:** "Cloudflare" names a vendor, not a requirement. Scope, cost and account ownership are all unknown.
- **Blocks phase:** 8
- **Ask:** client

---

## Blocking Phase 9 — database backup

### Q-055: Backup retention and recovery targets
- **Status:** UNRESOLVED
- **Question:** Phase 9 requires automatic daily database backups. How long are backups kept, where are they stored, how much data loss is acceptable, and must a restore be tested?
- **Why it matters:** "Daily backup" alone does not define a recovery guarantee. Storage location also interacts with the 5-year retention rule (Q-027) and PDPA (Q-028). The mechanism depends on Q-008.
- **Blocks phase:** 9
- **Ask:** client
