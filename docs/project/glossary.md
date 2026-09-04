# Glossary

This file exists so two developers do not invent two different names for the
same thing. Before naming a table, field, type, route, class or variable,
check here first. If the concept is missing, add it here in the same pull
request rather than inventing a name locally.

Source of every Thai term and definition: `docs/reference/client-summary-th.md`.

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
| Parent SKU | รหัสสินค้าหลัก | The single code identifying a product. Format unknown — defined in a contract that was not provided. See Q-014, Q-007. | `parent_sku` |
| Model SKU | รหัสรุ่น | The code identifying one variant. Format unknown, and whether it embeds the Parent SKU is unknown. See Q-014. | `model_sku` |
| Category | หมวดหมู่ | A grouping used to browse products. Named in the source: Nintendo Switch, PlayStation 5, IT Gadgets, Pre-Order. | `category` |

> Use `product` only for the parent and `variant` only for the buyable model.
> Never use "SKU" alone — always `parent_sku` or `model_sku`, because the source
> uses the word for both.

## Stock

| English | Thai | Definition | Identifier |
| :--- | :--- | :--- | :--- |
| Stock | สต๊อก | The quantity of a variant the shop can sell. Held per variant, not per product. | `stock` |
| Stock status | สถานะสินค้า | The public-facing availability shown instead of a real number: in stock / low stock / out of stock. Threshold for "low" is undefined — see Q-019. | `stock_status` |
| In stock | มีสินค้า | Public status: available to buy. | `in_stock` |
| Low stock | เหลือน้อย | Public status: available but nearly gone. See Q-019. | `low_stock` |
| Out of stock | สินค้าหมด | Public status: not available to buy. | `out_of_stock` |
| Not available for sale | ไม่พร้อมขาย | A status raised in the §4 discussion notes as a manual alternative to setting stock to zero. Not a confirmed requirement. | `not_for_sale` |
| Stock sync | เชื่อมสต๊อก | Keeping the site's stock and Shopee's stock in agreement. Mechanism undecided — see Q-043. | `stock_sync` |

## Orders

| English | Thai | Definition | Identifier |
| :--- | :--- | :--- | :--- |
| Order | คำสั่งซื้อ | A customer's purchase, covering one or more variants. | `order` |
| Order line | รายการในคำสั่งซื้อ | One variant and quantity within an order. | `order_line` |
| Order status | สถานะคำสั่งซื้อ | Where an order has reached. **The source never enumerates the status set** — see the table below and Q-023. | `order_status` |
| Cart | ตะกร้า | Items a customer has selected but not yet ordered. | `cart` |

### Order status values — NOT a defined set

The source never lists the order statuses. The values below are only the ones
its text refers to in passing, and are recorded so nobody invents a rival set
before Q-023 is answered. **Do not treat this as the status model.** Transitions
between them are entirely undefined.

| Referred to as | Thai | Where it appears | Proposed identifier |
| :--- | :--- | :--- | :--- |
| Order received | รับคำสั่งซื้อ | §8, email trigger | `order_received` |
| Payment confirmed | ยืนยันการชำระเงิน | §8, email trigger | `payment_confirmed` |
| Shipped | จัดส่ง | §8, email trigger | `shipped` |
| Cancelled | ยกเลิก | §8, email trigger | `cancelled` |
| Refunded | คืนเงิน | §8, email trigger | `refunded` |
| Waiting for goods from supplier | รอสินค้าจากซัพพลายเออร์ | §5, dropship work queue | `awaiting_supplier` |

## Payment

| English | Thai | Definition | Identifier |
| :--- | :--- | :--- | :--- |
| Payment | การชำระเงิน | A customer's transfer of money against an order. | `payment` |
| Bank transfer | โอนเงินผ่านธนาคาร | Payment method where the customer uploads a slip and staff verify it by hand. Noted in the source as carrying no fee. | `bank_transfer` |
| Payment slip | สลิป | The transfer receipt image a customer uploads as proof of a bank transfer. | `payment_slip` |
| PromptPay | พร้อมเพย์ | Thai instant transfer scheme. Whether it is in the first phase is an open question — see Q-029. | `promptpay` |
| Card payment | บัตรเครดิต/เดบิต | Payment by credit or debit card through K-Payment, with status updated automatically. Noted in the source as carrying a fee. | `card_payment` |
| Instalment | ผ่อนชำระ | Paying for one order across several instalments via K-Payment. Scope status contradictory — see Q-003. | `instalment` |
| Refund | คืนเงิน | Returning money to the customer, in full or in part, with a history record. Payout mechanism undefined — see Q-036. | `refund` |
| Deposit | มัดจำ | A part payment taken up front on a pre-order, with the balance collected before shipping. Percentage undefined — see Q-041. | `deposit` |

## Tax and documents

| English | Thai | Definition | Identifier |
| :--- | :--- | :--- | :--- |
| VAT | ภาษีมูลค่าเพิ่ม | Value added tax at 7%. Whether displayed prices already include it is contradictory in the source — see Q-010. | `vat` |
| Abbreviated tax invoice | ใบกำกับภาษีอย่างย่อ | The tax document the source says is produced automatically for every order as a PDF. Whether a full tax invoice is also needed is open — see Q-026. | `tax_invoice_abbreviated` |
| Tax invoice number | เลขที่ใบกำกับภาษี | The gap-free sequential number on a tax invoice. Format undefined — see Q-027. | `tax_invoice_number` |
| Tax identification number | เลขประจำตัวผู้เสียภาษี | The shop's registered tax ID, required before legally correct invoices can be issued. Not yet supplied — see Q-025. | `tax_id` |

## Shipping

| English | Thai | Definition | Identifier |
| :--- | :--- | :--- | :--- |
| Shipment | การจัดส่ง | The dispatch of an order to the customer. | `shipment` |
| Carrier | บริษัทขนส่ง | The delivery company. First carrier not selected — see Q-034. | `carrier` |
| Tracking number | เลขพัสดุ | The carrier's parcel reference, which makes status visible to the customer. | `tracking_number` |
| Shipping label | ใบปะหน้า | The label printed for a parcel, carrying name, address and phone. Whether it must be the carrier's own barcoded label is open — see Q-039. | `shipping_label` |
| Shipping rule | กฎค่าส่ง | A staff-configurable rule such as free shipping above a spend threshold. See Q-040. | `shipping_rule` |

## Selling models

| English | Thai | Definition | Identifier |
| :--- | :--- | :--- | :--- |
| Pre-order | พรีออเดอร์ | Selling a product before release, with a release date and a cap on reservations. | `pre_order` |
| Release date | วันวางจำหน่าย | The date a pre-ordered product becomes available. | `release_date` |
| Dropship | สินค้าสั่งจากตัวแทนจำหน่าย | Selling a product the shop does not hold, ordered from a distributor after the sale. | `dropship` |

## People

| English | Thai | Definition | Identifier |
| :--- | :--- | :--- | :--- |
| Customer | ลูกค้า | Someone who buys, tracks their orders, and reads news. | `customer` |
| Signed-out visitor | ผู้ใช้งานที่ไม่ login | Someone browsing without an account. Source says front-page products only, which contradicts guest checkout — see Q-022. | `guest` |
| Staff | พนักงาน | Any back-office user, of any of the four roles. | `staff` |
| Blogger | Blogger | Staff role: writes news only. | `blogger` |
| Sale manager | Sale-manager | Staff role: products, stock, orders, finance. | `sale_manager` |
| Admin | Admin | Staff role: oversees everything. | `admin` |
| Top-level admin | Admin สูงสุด | Staff role: adds and removes staff and configures the system. | `super_admin` |

> The source says "4 permission levels" but lists six roles including customer
> and guest. Treat only the four above as staff roles until Q-015 is answered.

## External systems

| English | Thai | Definition | Identifier |
| :--- | :--- | :--- | :--- |
| Shopee | Shopee | Marketplace the shop also sells on; stock is to be kept in step with it. | `shopee` |
| BigSeller | BigSeller | Stock management tool named for further study. Written "BigSaler" in one note. See Q-043, Q-044. | `bigseller` |
| K-Payment | K-Payment | Kasikorn Bank's payment service, for card and PromptPay QR. | `kpayment` |
| Cloudflare | CloudFlare | Named for security and bot verification. Scope undefined — see Q-054. | `cloudflare` |
| PDPA | พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล | Thailand's Personal Data Protection Act. | `pdpa` |
| DBD | เครื่องหมาย DBD | The Department of Business Development registration mark shown on the site. | `dbd` |

## Terms deliberately NOT defined here

These appear in the source but have no definition that can be written today
without inventing one:

- **Order status model** — the full set and its transitions. See Q-023.
- **Warranty claim** (แจ้งเคลม / รับประกัน) — no process, states or fields given. See Q-038.
- **Sale page** — used in the §9 notes; unclear whether it is the product page, a separate page, or linked news. See Q-049.
- **Product review** (รีวิวสินค้า) — used for both a staff news category and a customer-generated feature. See Q-048.
