# Database

PostgreSQL, accessed through Prisma. Decided by
[ADR-0001](adr/ADR-0001-backend-approach.md).

This document gives the conceptual model, the rules every table obeys, and the
three mechanisms that carry the invariants. **It is not the schema.**
`prisma/schema.prisma` is the schema and is the authority; this file is the
reasoning behind it.

> Several parts of the model cannot be drawn at all until the client answers a
> question. Those are listed under *What cannot be modelled yet* and are left
> genuinely blank rather than guessed at.

## Naming

Every identifier is `snake_case` and every one must already exist in
`12-glossary.md` (D-014). Tables are singular: `order`, not `orders`.

| Rule | Example |
| :--- | :--- |
| Primary key is `id` | `product.id` |
| Foreign key is `<table>_id` | `order_line.variant_id` |
| Boolean reads as a statement | `is_active`, not `active` |
| Timestamp ends `_at` | `created_at`, `paid_at` |
| Money ends `_satang` | `unit_price_satang` |
| Enumerated column ends `_status` | `stock_status` |

If a concept is not in the glossary, add it to the glossary in the same pull
request. A column named for something nobody agreed to call that is how two
developers end up with `variant` and `model` in one schema.

## Entity map

```
category ──< product ──< variant >──┬── option_value >── option_type
                          │         │
                          │         └── (composite: one row per option per variant)
                          │
                          ├──< stock_movement          append-only
                          ├──< order_line >── order ──┬──< payment
                          │                           ├──< shipment
                          │                           └──1 tax_invoice
                          ├──< product_review          customer-written (REQ-054)
                          ├──1 sale_page                per-product (REQ-055)
                          └──< channel_listing          Shopee / BigSeller mapping

customer ──< order
customer ──< product_review

role ──< role_permission >── permission     six roles: 4 staff + customer + guest

content_page      news_article >── news_category
```

**Removed from the earlier draft:** `refund` (out of scope, D-077) and
`audit_log` (removed, D-066). `staff` is a `customer`-shaped identity distinct
from the customer/guest roles, holding the same `role` foreign key — see
*Access control* below.

## Money

**Money is an integer number of satang, never a float (D-010).** `199.50` baht
is stored as `19950`. The column is `BIGINT` and its name ends `_satang`.

This is not a preference. VAT at 7% on a mixed cart produces repeating
decimals, and an invoice whose lines do not add up to its total is a legal
defect in a document that has already been sent to a customer and given to an
accountant (invariant 3, `03-architecture.md`). Floats guarantee that outcome
eventually; integers make it impossible.

Rounding happens **once**, in a single domain function, at a single defined
point in the calculation. That function is the only place in the codebase
allowed to round money.

> **Resolved (Q-010, D-060):** every displayed price already includes 7% VAT.
> The single rounding function extracts the VAT component; nothing is added
> on top. This was exactly the kind of change the centralisation above was
> designed to absorb in one place.

## Catalogue

A **product** is what the customer thinks they are buying and carries one
`parent_sku`. A **variant** is what they actually buy and carries its own
`model_sku`, price and stock (REQ-004, REQ-005).

```
product        id, parent_sku (unique), category_id, is_active,
               shipping_size_tier (small | medium | large), ...
variant        id, product_id, model_sku (unique), price_satang,
               stock_quantity, is_active, weight_grams, ...
option_type    id, product_id, name           e.g. colour, capacity
option_value   id, option_type_id, value      e.g. black, 512GB
variant_option_value   variant_id, option_value_id      composite PK
```

`shipping_size_tier` carries the configurable shipping cost (REQ-030, D-079)
as a staff-assigned category. `variant.weight_grams` stays in the model as an
optional, informational field — it is not load-bearing for any calculation
(D-067, Q-021); shipping cost reads `shipping_size_tier`, never a computed
function of weight.

Options are modelled as a join rather than as columns on `variant` because
the number of option types per product is unknown (Q-013). A join table is
correct for one type and for five; columns would have to be guessed and then
migrated.

Bilingual product text (REQ-007) is a per-locale row, not two columns — the
same shape `content_page` and `news_article` use, so there is one translation
mechanism in the schema rather than three.

### Stock

**Stock lives on the variant, never on the product (D-011),** because the
source gives each ModelSKU its own quantity.

`variant.stock_quantity` is the current figure. Every change to it also writes
a `stock_movement` row — quantity delta, reason, actor, timestamp, and the
order or channel that caused it. The movements are append-only and are what
make a discrepancy investigable; the column is what makes a read fast.

The public storefront never sees `stock_quantity`. It sees a derived
`stock_status` of in stock / low stock / out of stock (REQ-006), computed in
the domain layer, and the raw number is not present in any public API response
(D-024). The threshold for "low" is undefined (Q-019), so it is a
configuration value with no default written into code.

## Concurrency rules

These are the rules that stop the shop overselling (REQ-020, invariant 1).
They are not style; a write that skips them is a defect.

1. **Every write that changes stock happens inside a transaction (D-012).** No exceptions, including admin edits, Excel import, and channel sync.
2. **Take the lock before reading the number you are about to act on.** `SELECT … FOR UPDATE` on the variant rows. Reading the quantity, deciding, then writing is a race, and it is a race that loses exactly when the shop is busiest.
3. **Lock rows in a deterministic order** — variants sorted by `id`. Two concurrent orders for the same two products that lock in opposite orders deadlock. Sorting removes the possibility rather than retrying it.
4. **A check constraint backs the rule up:** `stock_quantity >= 0`. Application logic is where the rule is expressed; the constraint is where it is guaranteed. If the constraint ever fires, that is a bug worth waking up for.
5. **Hold the transaction for as short a time as possible.** Price the cart, render, call the payment provider — all outside. Only the read-check-write is inside.

> **Resolved (Q-024, D-068).** Two distinct flows:
>
> - **Normal order:** the rules above apply at the moment K-Payment confirms
>   payment (the webhook handler), not at order placement. No reservation is
>   held between placing an order and paying for it.
> - **Pre-order:** no `stock_quantity` change at order time at all. A
>   `reservation_quota` is held against the release-date cap instead — a
>   simple counter, not a locked-transaction stock deduction — and the real
>   `stock_quantity` deduction (with the locking rules above) happens only
>   when staff mark the goods **received** from the supplier.

## Invoice numbering

Tax invoice numbers must run gap-free, including under concurrent orders
(REQ-025, invariant 2).

**A dedicated PostgreSQL sequence, advanced inside the order transaction
(D-013).** Written as raw SQL in a migration, because Prisma's schema language
cannot express it.

Why this and not the obvious alternatives:

| Rejected | Why it fails |
| :--- | :--- |
| `MAX(number) + 1` | Two concurrent transactions read the same maximum and produce the same number. |
| A UUID or random id | Unique, but not sequential. The requirement is a gap-free *run*, which is strictly stronger. |
| An auto-increment primary key | Gaps on every rolled-back transaction, and PostgreSQL sequences are explicitly non-transactional for exactly that reason. |
| Allocating the number before the transaction | A failed order burns a number, which is the gap the requirement forbids. |

The number is allocated in the same transaction that inserts the order, so an
order that does not commit does not consume one.

> The number **format** is undefined (Q-027) — prefix, year component, reset
> policy, width. The sequence is the mechanism; the format is a domain
> function that renders it, and that function cannot be written until Q-027 is
> answered. Whether an abbreviated or a full tax invoice is required is also
> open (Q-026).

## Orders and payments

An order carries several payments over time, because pre-orders take a deposit
and collect a balance (REQ-048, D-080). **There is no `refund` table** — refund
payout is out of scope for this system (D-077, Q-036).

```
order          id, customer_id (never null — no guest checkout, D-061),
               order_status, subtotal_satang, vat_satang, shipping_satang,
               total_satang, placed_at, reservation_quota_expires_at (pre-order only), ...
order_line     id, order_id, variant_id, quantity,
               unit_price_satang, line_total_satang
payment        id, order_id, method, amount_satang, paid_at,
               provider_reference          -- K-Payment only; no slip_file_id
tax_invoice    id, order_id (unique), invoice_number, issued_at, pdf_file_id
customer       id, email, ..., tax_id (nullable), company_tax_id (nullable, 10-digit)
```

**`order_line` stores its own `unit_price_satang`.** It is not read from the
variant at display time. A price that changes next month must not change what
an invoice issued last month says.

**`customer_id` is never null (D-061, Q-022).** The earlier draft's
guest-checkout contradiction is resolved in favour of REQ-053: every order
belongs to a registered customer, and a signed-out visitor never reaches
checkout.

**`customer.tax_id` / `customer.company_tax_id`** exist only to hand data to
the separate full-tax-invoice system when a customer requests one (D-019,
D-069, Q-027); the website itself only ever generates the simplified invoice.

> **`order_status` has no value set.** The source never enumerates the
> statuses and never describes a transition (Q-023). A **candidate** —
> `pending_payment`, `paid`, `awaiting_supplier`, `awaiting_stock`, `received`,
> `shipped`, `cancelled`, `completed` — is proposed in `13-open-questions.md`
> for client review and recorded in `12-glossary.md`, but it is **not
> adopted**. No enum, no state machine, and no code may assume one (D-018).

## Access control

Permissions are rows, not code (D-040, REQ-035), because the shop owner must
change them without a developer.

```
staff            id, email, is_active, two_factor_enabled   -- staff identity only
customer         id, email, ...                             -- customer identity, separate table
role             id, name, is_system      -- six system rows: blogger, sale_manager,
                                           -- admin, super_admin, customer, guest
permission       id, key            e.g. product.edit, order.viewOwn
role_permission  role_id, permission_id      composite PK
```

**Six roles, all system rows (D-062, Q-015):** Blogger, Sale-manager, Admin,
Top-level Admin, Customer, and Guest. Customer and Guest go through the same
`role_permission` mechanism as the four staff roles rather than being handled
as a special case in code — a role compiled into the application as a
TypeScript union fails REQ-035 outright, which is why this is a join table.

**`role.is_system` is `true` for all six, permanently (D-063, Q-016).** The
admin UI lets the owner toggle which permissions each of the six holds; it
never offers a way to insert a seventh row. There is no `order.refund`
permission key — refund is out of scope (D-077).

## Deletion and retention

Two requirements pull in opposite directions: documents must remain
retrievable for five years (REQ-026), and a customer may delete their personal
data (REQ-046).

**Resolved (Q-028, D-070, superseding D-017's Blocked status).** Tax and
accounting documents may retain the necessary customer information as an
accepted legal exception. The schema keeps the two concerns separable:

- Records under the retention rule carry `deleted_at` and are soft-deleted, never removed.
- Personal fields — name, address, phone, email — are on the customer record and on a per-order snapshot, separable from the order's financial content.
- On a PDPA deletion request, personal fields **not** covered by the retention rule are erased; fields on a document within the five-year window are kept, disclosed to the customer as a stated exception at the point they request deletion.

## Migrations

**Forward-only, reviewed as SQL, never generated at deploy time (D-015).**

1. Prisma generates the migration; a person then reads the SQL before it is committed. Constraints, partial indexes and the invoice sequence are written by hand because Prisma cannot express them.
2. One migration per pull request. A migration is a contract change under `09-coding-guidelines.md` Rule 3 — say so before making it.
3. No destructive migration in one step. Dropping a column is: stop writing it, ship; stop reading it, ship; drop it, ship.
4. Never edit a migration that has been applied anywhere but a local machine. Write another one.
5. `prisma/seed.ts` holds development data only. Never real customer data, never a real order, never a real tax id.

## What cannot be modelled yet

Left blank deliberately. Filling any of these in requires inventing a fact.
Much of the earlier list is now resolved — see `13-open-questions.md` for the
full record. What remains:

| Missing | Blocked on | What stays undrawable |
| :--- | :--- | :--- |
| Order status values and transitions | Q-023 | The order state machine, and every email trigger that depends on it (REQ-041). A candidate is proposed but not adopted. |
| Parent SKU / ModelSKU format | Q-007, Q-014, Q-044 | Identity rules, and the Shopee/BigSeller listing mapping — all wait on one BigSeller data-inspection session |
| Maximum option types enforced by validation | Q-013 | Nothing structurally — the join table already holds any number — but the practical UI/import limit waits on Shopee/Lazada research |
| Invoice number format | Q-027 | The rendering function over the sequence; also waits on an example invoice |
| Accounting export columns | Q-050 | `05-database.md` has no row for this — the export query cannot be written |
| Shopee / BigSeller mapping shape | Q-042, Q-045 | `channel_listing` beyond the fact that it exists — waits on a Shopee account and real export examples |
| Weight vs. dimensions as the long-term shipping basis | Q-040 residual | Whether `shipping_size_tier` ever becomes computed rather than staff-assigned |
