# Glossary

This file exists so two developers do not invent two different names for the
same thing. Before naming a table, field, type, route, class or variable,
check here first. If the concept is missing, add it here in the same pull
request rather than inventing a name locally.

Source of every Thai term and definition: `reference/client-summary-th.md`.

> The source is a CLIENT SIGN-OFF SUMMARY, not an approved requirements spec.
> The definitions below describe what the source PROPOSES. Where the source
> does not define something, this file says so rather than filling the gap.

**Identifier convention.** The "identifier" column gives the canonical name in
`snake_case`. Adapt casing to whatever the chosen language requires
(`camelCase`, `PascalCase`) but do not change the words. Stack is undecided —
see Q-008 — so no type, table or column is being specified here, only the
vocabulary.

---

## Catalog

| English | Thai | Definition | Identifier |
| :--- | :--- | :--- | :--- |
| Product | สินค้า | A sellable item as the customer thinks of it, holding one Parent SKU. May have several variants. | `product` |
| Variant | รุ่น / ตัวเลือกสินค้า | One specific buyable combination of a product's options, holding its own ModelSKU, price and stock. | `variant` |
| Option type | ตัวเลือก | An axis a product varies on, such as colour or capacity. Maximum number per product is unknown — see Q-013. | `option_type` |
| Option value | ค่าตัวเลือก | One value on an option type, such as "black" or "512GB". | `option_value` |
| Parent SKU | รหัสสินค้าหลัก | The single code identifying a product. Stored as Shopee holds it, with no uniqueness constraint; identity is Shopee's item id (D-103). Our own format rule is unknown — see Q-014, Q-007. | `parent_sku` |
| Model SKU | รหัสรุ่น | The code identifying one variant. Stored as Shopee holds it, with no uniqueness constraint; identity is Shopee's model id (D-103). Our own format rule, and whether it embeds the Parent SKU, is unknown — see Q-014. | `model_sku` |
| Category | หมวดหมู่ | A grouping used to browse products. Named in the source: Nintendo Switch, PlayStation 5, IT Gadgets, Pre-Order. Our own menu categories; admin assigns products to them (D-099). | `category` |
| Category translation | ชื่อหมวดหมู่ตามภาษา | The Thai or English name of a category, one row per locale. | `category_translation` |
| Product category | หมวดหมู่ของสินค้า | Links a product to one of our categories; a product may sit in several. | `product_category` |
| Product translation | ข้อความสินค้าตามภาษา | The name and description of a product in one locale. The sync writes Shopee's text into the `th` row; the `en` row is optional and edited in our admin. | `product_translation` |
| Product image | รูปสินค้า | One photo of a product, with its position and Shopee's image URL (D-097). | `product_image` |
| Variant option value | ค่าตัวเลือกของรุ่น | Links a variant to each option value that makes up its combination. | `variant_option_value` |
| Product activation | การเปิดใช้งานสินค้า | The admin switch that makes a product visible on the storefront. A product first seen by the sync is created inactive until admin assigns a category and a shipping size tier. | `is_active` |

> Use `product` only for the parent and `variant` only for the buyable model.
> Never use "SKU" alone — always `parent_sku` or `model_sku`, because the source
> uses the word for both.

## Stock

| English | Thai | Definition | Identifier |
| :--- | :--- | :--- | :--- |
| Stock | สต๊อก | The quantity of a variant the shop can sell. Held per variant, not per product. | `stock` |
| Stock status | สถานะสินค้า | The public-facing availability shown instead of a real number: **in stock or out of stock only.** "Low stock" is removed from scope — see Q-019, D-065. | `stock_status` |
| In stock | มีสินค้า | Public status: available to buy. | `in_stock` |
| Out of stock | สินค้าหมด | Public status: not available to buy. | `out_of_stock` |
| Not available for sale | ไม่พร้อมขาย | A status raised in the §4 discussion notes as a manual alternative to setting stock to zero. Not a confirmed requirement. | `not_for_sale` |
| Stock sync | เชื่อมสต๊อก | Keeping the site's stock and Shopee's stock in agreement, by pulling the Shopee catalogue every 10 minutes (D-095); staff update stock in BigSeller by hand from an admin list (D-096), and BigSeller pushes it to Shopee. The daily BigSeller file (D-081) is superseded for the catalogue. Shopee is authoritative when the two disagree — see Q-043, Q-046, D-082. | `stock_sync` |
| Stock movement | ความเคลื่อนไหวสต๊อก | An append-only record of a change to a variant's stock quantity — delta, reason, actor, source. Not the same as the removed audit log (D-066); this is the stock-integrity record, kept regardless. | `stock_movement` |
| Manual stock adjustment | ตัดสต๊อกด้วยมือ | Staff updating stock in BigSeller by hand for a paid website order line, recorded on the order line as adjusted or not needed, with who and when. The website itself never changes stock. See D-096. | `stock_adjustment` |
| Reservation quota | โควตาจอง | For a pre-order only: a cap on reservations against a release date, held at order time. Not a stock deduction — see `pre_order` and Q-024. D-068 is superseded by D-096 for normal orders; how pre-orders interact with stock is phase 5 work (spec §5.3, §5.5). | `reservation_quota` |

## Orders

| English | Thai | Definition | Identifier |
| :--- | :--- | :--- | :--- |
| Order | คำสั่งซื้อ | A customer's purchase, covering one or more variants. | `order` |
| Order line | รายการในคำสั่งซื้อ | One variant and quantity within an order. | `order_line` |
| Order status | สถานะคำสั่งซื้อ | Where an order has reached. **The source never enumerates the status set** — see the table below and Q-023. | `order_status` |
| Cart | ตะกร้า | Items a customer has selected but not yet ordered. | `cart` |

### Order status values — still NOT a defined set

The source never lists the order statuses, and the client's 2026-09-13 answer
to Q-023 explicitly keeps it that way pending review — see the candidate table
there. **Do not treat the table below as the status model.** It merges the
values the source's text refers to in passing with the candidate proposed in
Q-023, so nobody invents a third rival set. No transition is confirmed.

| Referred to as | Thai | Where it appears | Proposed identifier |
| :--- | :--- | :--- | :--- |
| Pending payment | รอชำระเงิน | Candidate, Q-023 | `pending_payment` |
| Paid | ชำระเงินแล้ว | §8 "payment confirmed", email trigger; candidate, Q-023 | `paid` |
| Waiting for goods from supplier | รอสินค้าจากซัพพลายเออร์ | §5, dropship work queue; candidate, Q-023 | `awaiting_supplier` |
| Awaiting stock (pre-order) | รอสินค้าเข้า | Candidate, Q-023, following D-068's pre-order flow | `awaiting_stock` |
| Received (pre-order) | รับสินค้าแล้ว | Candidate, Q-023, following D-068's pre-order flow | `received` |
| Shipped | จัดส่ง | §8, email trigger; candidate, Q-023 | `shipped` |
| Cancelled | ยกเลิก | §8, email trigger; candidate, Q-023 | `cancelled` |
| Completed | สำเร็จ | Candidate, Q-023 | `completed` |

**Refunded is deliberately not in this table.** Refund payout is out of scope
(D-077, Q-036), so no order status models it.

## Payment

| English | Thai | Definition | Identifier |
| :--- | :--- | :--- | :--- |
| Payment | การชำระเงิน | A customer's transfer of money against an order. **K-Payment is the only payment method** (Q-030, D-072) — no bank transfer, no standalone PromptPay. | `payment` |
| PromptPay | พร้อมเพย์ | Thai instant transfer scheme, offered **only** as a QR option inside the K-Payment flow — never standalone (Q-029, D-071). | `promptpay` |
| Card payment | บัตรเครดิต/เดบิต | Payment by credit or debit card through K-Payment, with status updated automatically from its callback. Noted in the source as carrying a fee. | `card_payment` |
| Instalment | ผ่อนชำระ | Paying for one order across several instalments via K-Payment. **Confirmed in scope** (Q-003, D-089). | `instalment` |
| Deposit | มัดจำ | A part payment taken up front on a pre-order, with the balance collected before the goods arrive. Percentage and timing are shop-owner-configurable, never hard-coded — see Q-041, D-080. | `deposit` |

## Tax and documents

| English | Thai | Definition | Identifier |
| :--- | :--- | :--- | :--- |
| VAT | ภาษีมูลค่าเพิ่ม | Value added tax at 7%, already included in every displayed product price. Nothing is added on top — see Q-010, D-060. | `vat` |
| Simplified tax invoice | ใบกำกับภาษีอย่างย่อ | The **only** tax document this website generates — a PDF, automatic, per order. Formerly "abbreviated tax invoice"; renamed to match the client's own wording. See Q-026, D-069. | `tax_invoice_simplified` |
| Full tax invoice | ใบกำกับภาษีเต็มรูป | Generated by a **separate system**, not this one. This site only supplies the data it needs — see `customer_tax_id`. See Q-027, D-069. | `tax_invoice_full` |
| Customer tax identification data | ข้อมูลผู้เสียภาษีของลูกค้า | Optional customer-record fields collected only when a full tax invoice is requested: personal tax ID / national ID, or a 10-digit company tax ID. See Q-027, D-019. | `customer_tax_id` |
| Tax invoice number | เลขที่ใบกำกับภาษี | The gap-free sequential number on a tax invoice. Format undefined — see Q-027. | `tax_invoice_number` |
| Tax identification number | เลขประจำตัวผู้เสียภาษี | The shop's own registered tax ID, required before legally correct invoices can be issued. Not yet supplied — see Q-025. | `tax_id` |

## Shipping

| English | Thai | Definition | Identifier |
| :--- | :--- | :--- | :--- |
| Shipment | การจัดส่ง | The dispatch of an order to the customer. Handled entirely through BigSeller — no direct carrier integration is built. See Q-034, D-075. | `shipment` |
| Tracking number | เลขพัสดุ | The carrier's parcel reference. Not a core requirement; if present, importable/exportable with BigSeller. See Q-039. | `tracking_number` |
| Shipping label | ใบปะหน้า | A simple self-printed address label (name, address, phone) generated from order data — not a carrier's own barcoded label. Exact layout waits on an example. See Q-039, D-075. | `shipping_label` |
| Shipping size tier | ระดับขนาดสินค้า | The shop-owner-configurable category — small / medium / large — a product is assigned for shipping-cost purposes, replacing a computed weight/dimension calculation. Candidate prices: small 50 THB, medium 100 THB, large free. See Q-040, D-079. | `shipping_size_tier` |
| Shipping rule | กฎค่าส่ง | A staff-configurable rule, currently the size-tier pricing above. See Q-040. | `shipping_rule` |
| Shipping size tier rate | ราคาค่าส่งตามระดับขนาด | The price, in satang, of one shipping size tier. Seeded with the candidate values and edited by the owner. See D-079. | `shipping_size_tier_rate` |

## Selling models

| English | Thai | Definition | Identifier |
| :--- | :--- | :--- | :--- |
| Pre-order | พรีออเดอร์ | Selling a product before release, with a release date and a reservation quota. Website orders never change stock (D-096, which supersedes D-068 for normal orders); how pre-order lines join the manual stock list when goods are received is phase 5 work (spec §5.3, §5.5). See Q-024. | `pre_order` |
| Release date | วันวางจำหน่าย | The date a pre-ordered product becomes available. | `release_date` |
| Dropship | สินค้าสั่งจากตัวแทนจำหน่าย | Selling a product the shop does not hold, ordered from a distributor after the sale, gated by a supplier-availability check before payment — see `supplier_availability_check`. | `dropship` |
| Supplier availability check | ตรวจสอบสินค้ากับซัพพลายเออร์ | The "Contact staff / Check availability" step a dropship customer uses before paying. Staff confirm with the supplier and authorize or cancel the order. See Q-047, D-083. | `supplier_availability_check` |

## Content

| English | Thai | Definition | Identifier |
| :--- | :--- | :--- | :--- |
| News article | ข่าว | Staff-written content in the game news section — announcements, product news. Does not include product reviews. See Q-048, D-084. | `news_article` |
| Product review | รีวิวสินค้าโดยลูกค้า | A **customer-written** review of a product, distinct from staff-written news. Confirmed in scope. See Q-002, Q-048, D-084. | `product_review` |
| Sale page | Sale Page | A per-product page distinct from both the normal product page and a news article, carrying product-specific information or news. See Q-049, D-085. | `sale_page` |
| Order-status history filter | ประวัติสถานะคำสั่งซื้อ | A customer-facing view/filter of their own order-status history by date range and status. Replaces the earlier "notification opt-out" reading. See Q-031, D-073. | `order_status_history` |

## People

| English | Thai | Definition | Identifier |
| :--- | :--- | :--- | :--- |
| Customer | ลูกค้า | Someone who buys, tracks their orders, and reads news. One of the six roles in the authorization model — see Q-015, D-062. Requires an account; there is no guest checkout (Q-022, D-061). | `customer` |
| Signed-out visitor / Guest | ผู้ใช้งานที่ไม่ login | Someone browsing without an account. Sees only front-page products. One of the six roles in the authorization model, resolving the earlier contradiction — see Q-022, D-061. | `guest` |
| Staff | พนักงาน | Any back-office user, of any of the four staff roles below. | `staff` |
| Blogger | Blogger | Staff role: writes news only. | `blogger` |
| Sale manager | Sale-manager | Staff role: products, stock, orders, finance. | `sale_manager` |
| Admin | Admin | Staff role: oversees everything. | `admin` |
| Top-level admin | Admin สูงสุด | Staff role: adds and removes staff and configures the system. | `super_admin` |

> **Six roles, confirmed** (Q-015, D-062): Blogger, Sale-manager, Admin,
> Top-level Admin, Customer, Guest. All six are rows in `role`/`role_permission`
> — Customer and Guest are not a special case. The owner may edit permissions
> on these six only; there is no "create a role" feature (Q-016, D-063).

## External systems

| English | Thai | Definition | Identifier |
| :--- | :--- | :--- | :--- |
| Shopee | Shopee | Marketplace the shop also sells on; authoritative source of truth for stock on conflict. See Q-046, D-082. | `shopee` |
| BigSeller | BigSeller | Stock management tool, account already held by the shop. Daily file export/import is the confirmed sync mechanism (Q-043, D-081); SKU mapping still waits on inspecting real data (Q-007, Q-014, Q-044). | `bigseller` |
| K-Payment | K-Payment | Kasikorn Bank's payment service — the **sole** payment method (card, instalments, PromptPay QR). Merchant/test credentials already exist; sandbox testing is the next step. See Q-030, Q-033, D-072. | `kpayment` |
| Channel item | สินค้าบนช่องทางขาย | The link between a product and its Shopee item: Shopee's item id, status, sales count and rating. | `channel_item` |
| Channel listing | รายการรุ่นบนช่องทางขาย | The link between a variant and its Shopee model. | `channel_listing` |
| Channel authorization | การอนุญาตของช่องทางขาย | The shop's Shopee tokens, stored encrypted. | `channel_authorization` |
| External item id | รหัสสินค้าของช่องทางขาย | Shopee's `item_id`. Identity of a product on Shopee; stored as a 64-bit integer. See D-103. | `external_item_id` |
| Channel mirror columns | คอลัมน์สำหรับสะท้อนข้อมูลช่องทางขาย | Plain column names of the Shopee mirror tables (spec 5.2 to 5.4): `raw_payload` (last base-info JSON, debugging only), `rating_star`, `is_kit`, `last_synced_at`, `primary_category_id` (breadcrumb category). | `raw_payload`, `rating_star`, `is_kit`, `last_synced_at`, `primary_category_id` |
| External model id | รหัสรุ่นของช่องทางขาย | Shopee's `model_id`. Identity of a variant on Shopee; null for an item without models. See D-103. | `external_model_id` |
| Sync run | รอบการซิงก์ | One recorded attempt of the catalogue sync, with its outcome, counts, API calls and warnings. | `sync_run` |
| Catalogue sync | การซิงก์แคตตาล็อก | The job that pulls the Shopee catalogue every 10 minutes into our database (D-095). | `catalogue_sync` |
| Catalogue item snapshot | ภาพรวมสินค้าจากแคตตาล็อก | The catalogue data the sync read for one Shopee item in one run, as it was written into our tables. | `catalogue_item_snapshot` |
| Mail relay | Mail Relay | The category of transactional email solution decided on; specific provider and sending domain still to be finalized. See Q-032, D-074. | `mail_relay` |
| Cloudflare | CloudFlare | Free plan, scoped to security and bot protection. See Q-054, D-087. | `cloudflare` |
| PDPA | พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล | Thailand's Personal Data Protection Act. Deletion requests carry an accepted exception for retained tax/accounting data. See Q-028, D-070. | `pdpa` |
| DBD | เครื่องหมาย DBD | The Department of Business Development registration mark shown on the site. | `dbd` |

## Project process

Terms for how the team works, not for the shop itself. Agent names are also
their file names in `.claude/agents/`.

| English | Thai | Definition | Identifier |
| :--- | :--- | :--- | :--- |
| Plan | แผนงาน | A numbered description of a piece of work in `docs/plans/`, carrying its own checklists. Its checklist is the record of what was done. | `plan` |
| Project board | บอร์ดโปรเจกต์ | The GitHub project board showing work status, driven by issues. A view of the plans, never the record. See `09-coding-guidelines.md#project-board`. | `project_board` |
| Planner agent | เอเจนต์วางแผน | Subagent that writes plans and keeps the board's issues in step (D-093). | `planner` |
| Developer agent | เอเจนต์นักพัฒนา | Subagent that builds features and fixes from a plan (D-093). | `developer` |
| Tester and security reviewer agent | เอเจนต์ทดสอบและตรวจความปลอดภัย | Subagent that tests and security-reviews a change before merge (D-093). | `tester-security-reviewer` |
| DevOps agent | เอเจนต์ DevOps | Subagent for CI, environments, configuration, release and backup procedures (D-093). | `devops` |

## Terms deliberately NOT defined here

These appear in the source but have no definition that can be written today
without inventing one:

- **Order status model** — the full set and its transitions. A candidate is proposed for review but not adopted. See Q-023.
- **Accounting export columns** — the exact fields the accounting team needs. See Q-050.
- **BigSeller SKU generation rules** — who generates a Parent SKU / ModelSKU and in what format. Waits on inspecting real BigSeller data. See Q-007, Q-014, Q-044.
- **Simplified tax invoice exact fields**, and the export shape for the separate full-invoice system — both wait on an example invoice. See Q-027.
- **Shipping label exact layout** — waits on an example label. See Q-039.
