# Requirements

Source: `docs/reference/client-summary-th.md` — the only source for this file.

> **This file records nothing that is agreed.**
> The source is a CLIENT SIGN-OFF SUMMARY, not an approved requirements spec.
> Every ☐ checkbox in it is UNCONFIRMED. Every requirement below therefore
> carries **Status: PROPOSED — awaiting client confirmation**, and no
> requirement may be called approved, agreed, confirmed, decided or finalized
> until the client confirms it in writing. See Q-001.

**Reading this file**

- `§n` refers to a section of the source document.
- `[SEE Q-0NN]` links to `open-questions.md`. A requirement carrying one is not
  buildable as written.
- **Client discussion notes** blocks hold the loose Thai notes written under
  the checkboxes in the source. They are meeting notes, not requirements. They
  are recorded for meaning only and must not be treated as scope, decisions or
  implementation instructions.

---

## 1. Catalog

### REQ-001: Browse products by category
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §2
- A customer can browse products filtered to a category. The categories named are Nintendo Switch, PlayStation 5, IT Gadgets and Pre-Order.

### REQ-002: Search in Thai and English
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §2
- A customer can search the catalogue using Thai text and using English text, and matching products are returned for both.

### REQ-003: Select a variant and see its price and availability
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §2
- On a product page, a customer can select option values such as colour or capacity, and the price and remaining availability of that specific model are shown immediately without a page reload.

### REQ-004: Parent SKU and ModelSKU structure
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §4
- Each product carries exactly one Parent SKU, and each model of that product carries its own ModelSKU. [SEE Q-014] [SEE Q-007]

### REQ-005: Multiple option types per product
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §4
- A product can have more than one option type (for example colour × capacity), and each resulting combination can carry its own code, price and stock quantity. [SEE Q-013]

### REQ-006: Public availability status without real quantities
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §4
- The storefront shows availability as in stock, low stock, or out of stock, and never shows the real quantity to the public. [SEE Q-019]

### REQ-007: Bilingual storefront
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §1
- The site is available in Thai and in English. [SEE Q-018]

### REQ-008: Thai baht, Thailand only
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §1
- Prices are shown in Thai baht, and selling and delivery are within Thailand only.

### REQ-009: Full functionality on mobile
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §2
- Every function available on desktop is usable on a mobile browser.

---

## 2. Cart and checkout

### REQ-010: Order without registering
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §2
- A customer can add products to a cart and complete an order without creating an account. [SEE Q-022]

### REQ-011: Customer account with order history
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §2
- A customer can register, sign in, view their past orders, and download the tax invoice for an order.

### REQ-012: Self-service parcel tracking
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §2
- A customer can see the delivery status of their order without contacting the shop.

### REQ-013: Request cancellation of an unshipped order
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §2
- A customer can request cancellation of an order that has not yet shipped. [SEE Q-037]

### REQ-014: File a warranty or claim request online
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §2
- A customer can submit a warranty or claim request through the website. [SEE Q-038]

**Client discussion notes** *(meeting notes from §2 — not requirements)*

- The customer dashboard was discussed as showing order history, pre-orders, and order status tracking.
- On cancellation: if the customer never pays, the order is not shipped. If the customer already transferred the money, they tell staff, staff press cancel, and the money is refunded.
- If the order is already in the shipping stage, or the goods have been received and the customer wants to return them — noted as "no need to update".
- Noted in bold: staff only come in to update the status of the order.

---

## 3. Payment

### REQ-015: Bank transfer with slip upload
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §3
- A customer can pay by bank transfer and upload a payment slip, and a staff member reviews and confirms that payment in the system. [SEE Q-030]

### REQ-016: Card payment through K-Payment with automatic status update
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §3
- A customer can pay by credit or debit card through K-Payment (Kasikorn Bank), and the system updates the payment status automatically with no staff action required.

### REQ-017: PromptPay
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §3
- PromptPay is listed as a payment method, with the source explicitly asking the client to state whether it is wanted in the first phase. [SEE Q-029]

### REQ-018: Full and partial refunds with history
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §3
- A staff member can refund an order in full or in part, and every refund is recorded in a history. [SEE Q-036]

### REQ-019: Credit card instalments
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §3, §10
- Instalment payment appears as a switchable option within the K-Payment flow in §3, and also appears in the §10 exclusions list marked `+`. Its scope status is contradictory. [SEE Q-003] [SEE Q-002]

**Client discussion notes** *(meeting notes from §3 — not requirements)*

- Bank transfer: verified by a person; once payment is complete the order is ready to ship; noted as having no fee.
- K-Payment: after paying, the customer is linked out to Kasikorn, where they can use a PromptPay QR, pay by card immediately, or pay by card in instalments (described as something that can be switched on). A callback comes back and updates the status to paid. Noted as incurring a fee.

---

## 4. Stock

### REQ-020: True stock deduction with no overselling
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §4
- Stock is deducted for real, and the shop cannot sell more units than it holds, including when two customers order the same unit at the same moment. [SEE Q-024]

### REQ-021: Stock linked with Shopee
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §4
- A sale on either channel adjusts the stock on the other automatically. [SEE Q-043] [SEE Q-045]

### REQ-022: Staff map products to Shopee without a programmer
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §4
- A staff member can pair a product on the site with its Shopee listing themselves in the admin panel, with no developer involvement.

**Client discussion notes** *(meeting notes from §4 — not requirements)*

- BigSeller: noted for further study, for managing stock.
- Stock could be updated through BigSeller's API, which is noted as paid, covering updates from sales on the site and from sales on other platforms.
- An alternative to the API was discussed: exporting stock daily from BigSeller or Shopee and importing it into the site to update stock, or editing it by hand. Noted as not realtime. Editing by hand could mean setting stock to 0 or changing the status to not available for sale.
- Medusa JS was noted in connection with deciding the tech stack.
- Two open notes were recorded: BigSeller codes, and finding out how to pull data out of Shopee.

---

## 5. Tax and documents

### REQ-023: 7% VAT on every order
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §6
- Value added tax of 7% is calculated on every order. The source states that all products already include VAT and nothing is added on top, which contradicts the question the source itself asks in §12. [SEE Q-010]

### REQ-024: Automatic abbreviated tax invoice as a PDF
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §6
- An abbreviated tax invoice is produced automatically for every order as a PDF, which the customer downloads themselves from their order history. [SEE Q-026]

### REQ-025: Gap-free sequential invoice numbers
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §6
- Tax invoice numbers run in an unbroken sequence with no skipped numbers, including when several orders are placed at the same time. [SEE Q-027]

### REQ-026: Five-year document retention
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §6
- Documents remain retrievable for 5 years as required by law. [SEE Q-027] [SEE Q-028]

### REQ-027: Monthly sales export for accounting
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §6
- Monthly sales can be exported for the accounting team, including a daily summary of how many units of each SKU were sold. [SEE Q-050]

---

## 6. Shipping

### REQ-028: Shipping cost from destination and real weight
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §7
- Shipping cost is calculated from the delivery destination and the actual weight of the goods. [SEE Q-021]

### REQ-029: Integrate at least one real carrier
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §7
- The system connects to at least one real carrier. The source names Flash, Kerry and Thailand Post as candidates and explicitly asks the client which to start with. [SEE Q-034]

### REQ-030: Configurable shipping rules
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §7
- Staff can set shipping rules themselves, for example free shipping once an order reaches a set value. [SEE Q-040]

### REQ-031: Tracking number visible to the customer
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §7
- Once a tracking number is recorded, the customer sees the delivery status immediately.

**Client discussion notes** *(meeting notes from §7 — not requirements)*

- Noted that being able to send the order's data through to print a cover label — name, address, phone number — would be enough ("= จบ"). [SEE Q-039]

---

## 7. Admin back office

### REQ-032: Two-step verification for staff
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §8
- Staff sign-in requires a second factor via OTP, by email or by phone number. [SEE Q-017]

### REQ-033: Single bilingual admin entry point
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §8
- Staff use one place to sign in, and the admin panel is usable in both Thai and English.

### REQ-034: Four permission levels
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §8
- Access is divided into 4 permission levels. The source states four but then lists six roles. [SEE Q-015] [SEE Q-007]

### REQ-035: Owner-configurable role permissions
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §8
- The shop owner can adjust the permissions of each role themselves, without a developer changing code. [SEE Q-016]

### REQ-036: Product list grouped by parent with expandable variants
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §8
- The product management screen lists parent products, and a parent can be expanded to show its variants.

### REQ-037: Inline and bulk editing of price, stock and status
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §8
- A staff member can change price, stock and status directly from the product list, and can change several products at once.

### REQ-038: Excel import and export with validation and dry run
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §8
- Staff can import and export products as an Excel file. The import can create new products, fully supports multi-option products, reports errors before saving, and offers a trial mode that shows the result without writing anything. [SEE Q-012] [SEE Q-013]

### REQ-039: Sales and stock dashboard
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §8
- The admin panel shows sales totals by day, week and month, a count of orders broken down by status, and a list of products that are nearly out of stock. [SEE Q-019] [SEE Q-023]

### REQ-040: Audit history of changes
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §8
- Every change to a price, a stock level and an order status is recorded with who made it and when. [SEE Q-020]

### REQ-041: Automatic email at every order step
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §8
- The system sends email automatically at each step: order received, payment confirmed, shipped, cancelled, and refunded. [SEE Q-023] [SEE Q-032]

### REQ-042: Customers control their own notifications
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §8
- A customer can switch notification emails on and off for themselves. [SEE Q-031]

**Client discussion notes** *(meeting notes from §8 — not requirements)*

- Discussed editing everything as an Excel table and bringing it back into the system to update, rather than having to update one row at a time.
- Discussed that email alerts exist at every step, following the status, but that the customer can choose to switch them on or off themselves.

---

## 8. Content and shop information

### REQ-043: Required content pages
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §9
- The site has these pages: about us, privacy policy, terms of service, order cancellation, warranty and returns, FAQ, how to use, and a warranty registration page with a submittable form.

### REQ-044: Staff edit content pages themselves
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §9
- Staff can edit the content of those pages without a developer changing code.

### REQ-045: Shop information displayed
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §9
- The site displays the shop's phone number, email, LINE, opening hours, address, and the DBD registration mark.

### REQ-046: PDPA data rights
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §9
- The system complies with the Personal Data Protection Act: a customer can view, correct, and delete their own personal data. [SEE Q-028]

### REQ-047: Game news section with categories
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §2
- Customers can read game news. The categories named are announcements, product reviews, and products (Nintendo, PlayStation). [SEE Q-048]

**Client discussion notes** *(meeting notes from §9 — not requirements)*

- Discussed a sale page for each individual product carrying information or news about that product. [SEE Q-049]

---

## 9. Special selling models

The source places these after the main features are finished (§5 heading:
"หลังจาก feature หลักเสร็จ").

### REQ-048: Pre-order products
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §5
- A pre-order product has a release date and a cap on how many can be reserved, and the shop can choose per product whether to take payment in full or take a deposit first and collect the balance before shipping. [SEE Q-041]

### REQ-049: Customer-visible pre-order status
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §5
- A customer can see the status of their pre-order and its release date from their own account page.

### REQ-050: Dropship products
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §5
- Products sourced from a distributor can be sold without holding stock. Orders for these products are separated into a "waiting for goods from supplier" work queue for staff to follow up, and the customer is told the expected waiting time clearly before buying. [SEE Q-047]

**Client discussion notes** *(meeting notes from §5 — not requirements)*

- Discussed that before the customer pays, the shop confirms with the supplier that the goods really exist, and only then can the customer pay. [SEE Q-047]
- Discussed being able to change a product's status from DropShip to a normal stocked product.

---

## 10. Authentication and roles

### REQ-051: Staff roles
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §8
- The roles named are Blogger (writes news only), Sale-manager (products, stock, orders, finance), Admin (oversees everything), and top-level Admin (adds and removes staff, and configures the system). [SEE Q-015]

### REQ-052: Customer role
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §8
- A customer can place orders, follow their order status, and read news.

### REQ-053: Signed-out visitor
- **Status:** PROPOSED — awaiting client confirmation
- **Source:** §8
- A visitor who is not signed in can see only the products on the front page. This contradicts REQ-010. [SEE Q-022]

---

## 11. Items with contradictory or undefined scope status

These appear in §10, the section headed "not included in this phase", but are
marked `+` rather than `✗`. The meaning of `+` is not defined anywhere in the
source, so these are neither requirements nor non-goals today. [SEE Q-002]

| Item | Source | Notes |
| :--- | :--- | :--- |
| Loyalty points / gift cards | §10 | Marked `+` |
| Instalment payment via K-Payment | §10 | Marked `+`; also appears in scope in §3 — see REQ-019 and Q-003 |
| Customer-written product reviews, switchable on and off | §10 | Marked `+`; distinct from the staff news category in REQ-047 — see Q-048 |
| Wishlist, also shown in order history | §10 | Marked `+` |

Items marked `✗` in the same section are recorded as non-goals in
`overview.md`.
