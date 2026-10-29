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
category ──< product_category >── product ──< variant >──┬── option_value >── option_type
                                               │         │
                                               │         └── (composite: one row per option per variant)
                                               │
                                               ├──< stock_movement          append-only
                                               ├──< order_line >── order ──┬──< payment
                                               │                           ├──< shipment
                                               │                           └──1 tax_invoice
                                               ├──< product_review          customer-written (REQ-054)
                                               ├──1 sale_page                per-product (REQ-055)
                                               └──< channel_listing          Shopee model link (spec section 5.4)

product ──1 channel_item ──< channel_listing    Shopee item link (spec section 5.4)

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

**The catalogue and stock model is defined in
[the Shopee catalogue mirror design](superpowers/specs/2026-10-26-shopee-catalogue-mirror-database-design.md) (section 5), approved by the
project owner on 2026-10-26. It replaces the earlier catalogue and stock
sections of this file.** Shopee is the master for product name, description,
photos, options, price and stock (D-094); the sync job pulls them every 10
minutes (D-095) and the site never edits them. This file keeps the rules every
table obeys; the spec carries the columns. Summary of spec section 5:

- **Filled by the sync (5.2).** `product` (one per Shopee item), `product_translation` (Shopee text goes in the `th` row; `en` is optional and edited in our admin), `product_image` (Shopee image URLs, D-097), `option_type`, `option_value`, `variant` (one per Shopee model; stable id across syncs), `variant_option_value`. `variant.stock_quantity` is a read-only copy of Shopee's stock with `CHECK >= 0`.
- **Site-only data, edited in our admin (5.3).** `category`, `category_translation`, `product_category` (D-099), `shipping_size_tier_rate`, and on `product`: `primary_category_id`, `shipping_size_tier`, `is_pre_order`, `release_date`, and `is_active`. A product first seen by the sync is created **inactive** until admin assigns a category and a shipping size tier.
- **Shopee link and sync tables (5.4).** `channel_item` (`external_item_id`, status, sales count, rating stored for sorting only, D-098), `channel_listing` (`external_model_id`, null for an item without models; unique with `NULLS NOT DISTINCT`), `channel_authorization` (tokens, encrypted at rest), `sync_run` (one row per attempt, with `api_calls` and `warnings`).
- **Orders and the manual stock list (5.5).** `order_line` gains `stock_adjustment_outcome`, `stock_adjustment_at` and `stock_adjustment_by_staff_id`, and snapshots `product_name`, `option_summary` and `model_sku`. The admin list is paid, unadjusted, non-pre-order lines (D-096).
- **Identity (5.8, D-103).** `parent_sku` and `model_sku` are indexed but **not unique**; identity is Shopee's item and model id. Empty or duplicate SKUs are reported in `sync_run.warnings` (codes in `14-integrations.md#how-the-sync-behaves-plan-010`, D-111).
- **External status (D-105).** `channel_item.external_status` holds Shopee's `item_status`, or `'NOT_FOUND'` once a known item is no longer returned; a not-found item stays in the stock sweep and is restored when Shopee returns it again (D-110). `channel_listing.external_status` is null for every model Shopee still returns and `'NOT_FOUND'` for a model that vanished from its item; whether a returned model is active lives in `variant.is_active` (from Shopee's `MODEL_NORMAL`), because the snapshot carries that flag and not the raw model status. The raw model status is therefore not queryable; `raw_payload` holds base info only. `markItemsNotFound` marks `channel_item` only — the storefront visibility rule already hides any item whose status is not `NORMAL`.
- **Unchanged (5.9).** Staff, customer, addresses, roles and permissions, cart, tax invoice, product review, sale page and content pages. News is defined in [News](#news) below.

Option types per product are at most two, because the site mirrors Shopee's
structure (D-094, Q-013). The join-table shape is unchanged.

### Stock

**Stock lives on the variant, never on the product (D-011),** because Shopee
gives each model its own quantity.

`variant.stock_quantity` is the copy of Shopee's current figure. **The website
never changes it** — website orders do not deduct stock (D-096), so no website
order flow writes a `stock_movement` row. Whether the sync logs the changes it
observes is left to the builder (spec section 9). Stock reaches the site by
BigSeller → Shopee → the 10-minute pull.

The public storefront never sees `stock_quantity`. It sees a derived
`stock_status` of **in stock or out of stock only** (REQ-006, D-065), computed
in the service layer, and the raw number is not present in any public API
response (D-024). Low stock is removed from scope (Q-019).

## Concurrency rules

> **Superseded for website orders (D-096).** The website no longer deducts
> stock, so the order and payment flows take no stock lock and the no-overselling
> guarantee is withdrawn. The rules below apply to any future write that does
> change a stock number; today that is none. The `CHECK (stock_quantity >= 0)`
> constraint stays on the mirrored copy.

These are the rules that stopped the shop overselling (REQ-020, invariant 1)
under the earlier design. They are not style; a write that skips them is a
defect.

1. **Every write that changes stock happens inside a transaction (D-012).** No exceptions, including admin edits, Excel import, and channel sync.
2. **Take the lock before reading the number you are about to act on.** `SELECT … FOR UPDATE` on the variant rows. Reading the quantity, deciding, then writing is a race, and it is a race that loses exactly when the shop is busiest.
3. **Lock rows in a deterministic order** — variants sorted by `id`. Two concurrent orders for the same two products that lock in opposite orders deadlock. Sorting removes the possibility rather than retrying it.
4. **A check constraint backs the rule up:** `stock_quantity >= 0`. Application logic is where the rule is expressed; the constraint is where it is guaranteed. If the constraint ever fires, that is a bug worth waking up for.
5. **Hold the transaction for as short a time as possible.** Price the cart, render, call the payment provider — all outside. Only the read-check-write is inside.

> **Superseded (D-096).** The earlier normal-order and pre-order stock flows
> (D-068, Q-024) are replaced: the website never changes stock. A pre-order
> still holds a `reservation_quota` against the release-date cap (phase 5), and
> its line joins the manual stock list when the goods are received.

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

## News

Defined in [the news design](superpowers/specs/2026-10-29-news-import-and-pages-design.md) (section 4), on the project owner's decisions of 2026-10-29 (D-125 to D-132; D-125 superseded by D-139 and restored by D-140). Naming follows the catalogue pattern (D-014): uuid ids and a translation table per locale. Five tables:

- **`news_category`**: `slug` (unique, decoded), `parent_id` (self-reference, nullable), `position` (WordPress id order, D-134), `source_id` (WordPress category id, `BigInt`, unique, nullable), `is_listed` (boolean, not null, default `true`; D-139) and the timestamps. **`news_category_translation`**: `category_id`, `locale`, `name`, unique per locale.
- **`news_article`**: `slug` (unique, decoded), `featured_image_url` (the old-site URL, D-127), `source_id` (WordPress post id, `BigInt`, unique, nullable), `source_url`, `source_modified_at`, `status` (`news_article_status`: `draft` or `published`), `published_at`, `byline_name`, `author_staff_id`, `created_by_staff_id`, `updated_by_staff_id`, `deleted_at` and the timestamps.
- **`news_article_translation`**: `article_id`, `locale`, `title`, `excerpt` (plain text), `body_html` (sanitised), unique per locale. Imported posts have `th` only; the storefront falls back to it on `/en`.
- **`news_article_category`**: `article_id` and `category_id`, composite primary key, indexed on `category_id`.

Rules:

- **Live article.** An article is shown only when `status = 'published'`, `published_at <= now()` and `deleted_at IS NULL`. A future `published_at` is a scheduled article; no extra status or job exists (D-130).
- **Tab counts.** The news tabs' counts are one SQL query, `countLiveNewsArticlesByCategory(now)` in `news-repository.ts`: a recursive CTE expands each category to itself and its descendants (`UNION`, so a cycle in the stored tree still terminates), joins `news_article_category` and the live-article rule, and takes `COUNT(DISTINCT article_id)` per category, so an article in a parent and its child counts once and an unlisted descendant rolls up (D-141). It returns one row per category with a live article instead of every (article, category) link; at today's volume the planner rightly picks sequential scans and hash joins, since most articles are live.
- **CHECK** `status <> 'published' OR published_at IS NOT NULL`, and a partial index on (`status`, `published_at` desc) where `deleted_at` is null.
- **Staff ids** (`author_staff_id`, `created_by_staff_id`, `updated_by_staff_id`) are plain nullable uuids with no foreign key, because `staff_user` does not exist yet; plan 002 adds the FK. Imported posts leave `author_staff_id` null.
- **Deleting is soft** (`deleted_at`); a deleted article is never shown (D-131).
- **Listed and unlisted categories (D-139; D-141).** A category with `is_listed = false` has no tab, is never a card's tag, a breadcrumb or a related-articles key, and its category route is a 404; its articles still appear under "ทั้งหมด". An *excluded category* is stored unlisted and never linked to any article; none is excluded today, since the old site's review tree is news again (D-140). An *unlisted category* (Uncategorized, and บทความ since D-141) keeps its links, and its articles roll up into its listed ancestors' pages and tab counts (D-141); an unlisted top-level category such as Uncategorized has no ancestor, so its articles are found only under "ทั้งหมด". No category row is deleted, and a category that is no longer unlisted is set back to listed on the next import.
- **Who sets `deleted_at` before go-live (D-139).** The import owns `deleted_at` of imported rows (`source_id` set): it sets it on an article whose source categories are all excluded, keeps one already set, and clears it only when a changed source version gives the article another category; the pass over stored articles never clears it. It never touches a row without `source_id`. The full re-import (`?full=1`, D-140) saves every post again, so it clears `deleted_at` on every imported article the rules do not hide, including the ones D-139 hid.
- **`body_html` is stored already sanitised** at import with an allow-list, and rendered only from the stored value; it is the only HTML the site renders from data. **Invariant: every writer of `body_html` — the import today, the staff news editor later — passes it through the same sanitiser before saving.** The article page renders it as HTML and adds attributes to its `<img>` and `<iframe>` tags by string (D-138), which is safe only because sanitised HTML escapes every literal `<`; an unsanitised write would be rendered as is.
- **Imported slugs stay unique:** a decoded slug already held by another row gets `-{source_id}` appended, the same on every re-run (D-136).
- **Not stored now:** revision history, tags, comments and SEO fields beyond the excerpt.

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
| Parent SKU / ModelSKU format | Q-007, Q-014, Q-044 | A format rule of our own. SKUs are stored as Shopee holds them (D-103), so nothing in the schema waits on it |
| Maximum option types enforced by validation | Q-013 | Nothing structurally — the join table already holds any number. The Shopee/Lazada research is done (both cap at two, which the client's answer rules out inheriting); the number to enforce now waits on the client |
| Invoice number format | Q-027 | The rendering function over the sequence; also waits on an example invoice |
| Accounting export columns | Q-050 | `05-database.md` has no row for this — the export query cannot be written |
| Shopee daily API call limit | Q-056 | Whether the full stock sweep fits the limit; the tables themselves are defined in the spec |
| Weight vs. dimensions as the long-term shipping basis | Q-040 residual | Whether `shipping_size_tier` ever becomes computed rather than staff-assigned |
