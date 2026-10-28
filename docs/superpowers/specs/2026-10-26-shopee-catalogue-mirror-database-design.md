# Shopee catalogue mirror and database design

- **Status:** Approved by the project owner — 2026-10-26
- **Decided with:** Win (project owner), in conversation 2026-10-20 → 2026-10-26
- **Builds on:** `docs/05-database.md` (conceptual model), `docs/03-architecture.md`, ADR-0001
- **Evidence:** real sandbox responses captured 2026-10-20 with `scripts/shopee-sandbox/` (Test Partner 1236675, sandbox shop 227679200)

## 1. Intent

The storefront must never call Shopee while a customer is waiting. Every page reads
from our own PostgreSQL through Prisma. A background job pulls from the Shopee Open
API **every 10 minutes** and refreshes our copy of the catalogue: products, variants,
options, photos, prices and stock.

Shopee is the shop's master record for products. Staff keep editing products on
Shopee (directly or through BigSeller); the website shows what Shopee says. The
website adds only what Shopee does not have: our menu categories, the shipping size
tier, pre-order release dates, our own customers' reviews, and the whole ordering,
payment and invoice side.

A website order never changes stock in the system. Admin sees a list of what was sold
and updates stock in BigSeller by hand; BigSeller pushes it to Shopee; the next sync
brings the new number back to the website.

## 2. Owner decisions this design rests on

Made by the project owner during this design. Each changes something already written,
so each needs a `D-0NN` row and an edit in the owning document when this design is
approved (see §10).

| # | Decision | Replaces / changes |
| :--- | :--- | :--- |
| O-1 | Shopee is the master for product name, description, photos, options, price and stock. Our admin never edits those. | REQ-036/037 inline price/stock editing and REQ-038 Excel import become unnecessary |
| O-2 | Catalogue reaches the site by pulling the Shopee Open API every 10 minutes. | D-081 (daily BigSeller file) for the catalogue direction |
| O-3 | Website orders never deduct stock. Stock is changed by hand in BigSeller from an admin list. | REQ-020 automatic deduction and no-oversell guarantee; D-068; invariant 1 in `03-architecture.md` |
| O-4 | K-Payment remains the only payment method. No slip upload. | — (confirms D-072) |
| O-5 | Photos are shown from Shopee's image URLs; no file storage yet. | — |
| O-6 | Customers see only our own customers' reviews. Shopee's rating and sales count are stored for sorting only. | — (confirms REQ-054) |
| O-7 | Admin assigns each product to our menu categories. | — |
| O-8 | Shopee's own orders are not imported. | — |
| O-9 | Server code is layered controller → service → repository → database, with Shopee HTTP in an adapter. | `03-architecture.md` / `04-tech-stack-and-structure.md` folder names |
| O-10 | **Every product on the website comes from Shopee**, automatically. A product added on Shopee is picked up by the next sync; there are no website-only products. | REQ-050 dropship and pre-order products must also be listed on Shopee |

**Authority.** The project owner's approval of this design is sufficient; the owner
stated (2026-10-26) that the client's earlier answers on stock handling do not need to
constrain it. Because O-1 makes Shopee the source of the catalogue's shape, the
`CLAUDE.md` block on scaffolding while Q-013/Q-014 are open no longer applies: options
come from Shopee and SKUs are stored as Shopee holds them. The implementation plan
therefore starts with the documentation updates in §10 (including that `CLAUDE.md`
line — a shared file), landing in the same pull request as the first code (rule 13).

**Accepted consequence of O-3 (owner, 2026-10-26):** between a website payment and the
next sync after admin has updated BigSeller, the site shows stock that is no longer
true. Two customers can pay for the last unit, and a Shopee buyer can take it too. An
oversold order is handled by staff outside the system (refunds are out of scope, D-077).

**Accepted consequence of O-1:** the site's option structure is exactly Shopee's, so at
most **two option types** per product (tested: Shopee rejects a third). The Q-013
research found the shop already flattens three real axes (edition/colour × distributor
× bundle) into Shopee's two; the website will show the same flattened variants. A
richer structure would need site-side product editing, which O-1 rules out for now.

**Consequences of O-10.**

- **Sets.** On Shopee a set is either a normal listing (often entered as variants of
  one item, as the shop's live listings do today) or a **kit item**
  (`v2.product.add_kit_item`: a listing built from other items' models with quantities;
  `get_item_list` marks it `tag.kit`). Both arrive through the sync as ordinary
  products; admin puts them in our ชุดโปรโมชั่น category. `channel_item.is_kit`
  records the flag. Kit components are not modelled.
- **Shopee bundle deals** (`v2.bundle_deal.*`) are discount rules — fixed price, percent
  or baht off when buying at least N, with start and end times — not products. They are
  not mirrored by this design (non-goal, §3).
- **Dropship (REQ-050, phase 5)** products must be listed on Shopee. Their availability
  follows Shopee's stock like any other product; the "check availability before paying"
  gate is phase 5 work.
- **Pre-orders** appear on the site only once listed on Shopee.

## 3. Goals, non-goals, anti-goals

**Goals**

- Storefront pages (home, category, product, cart, checkout) are served entirely from our database.
- Any product created or changed on Shopee appears correctly on the site within one sync interval, plus admin activation for new products (§5.3).
- Every sync run is recorded, so a failed or missing run is visible and investigable.
- Paid website order lines appear in an admin list until someone marks them as updated in BigSeller.

**Non-goals (this design)**

- Writing anything to Shopee: no `update_stock`, no price or product push.
- Importing Shopee orders.
- Mirroring Shopee bundle-deal promotions or other discounts (`v2.bundle_deal.*`).
- Products that exist only on the website (O-10).
- Pre-order deposits and reservation quota (REQ-048, phase 5) — only the release date is modelled now.
- Lazada, the live go-live of the Shopee app, and the production scheduler (hosting is ADR-0002).
- Order status values and transitions (Q-023 still open; D-018 holds).

**Anti-goals — failure even if it technically works**

- A storefront request that waits on Shopee.
- A Shopee hiccup that blanks or deletes products on the site.
- The partner key or any token in a log line, error message, URL printed to a log, or the repository.
- Two sync runs writing the same rows at the same time.

## 4. Constraints

- **Stack:** PostgreSQL + Prisma (ADR-0001). Prisma version pinned exactly at install, ≥2 weeks old.
- **Naming:** database identifiers are `snake_case`, singular tables, and must exist in `12-glossary.md` (D-014). Prisma models are `PascalCase` with `@@map`, fields `camelCase` with `@map`.
- **Money:** integer satang in `BIGINT` columns ending `_satang` (D-010). Shopee sends decimal baht; conversion happens once, in one function.
- **External ids:** Shopee `item_id` / `model_id` are int64 → `BIGINT`. Never `Int`.
- **Our primary keys:** `uuid` (`String @id @default(uuid()) @db.Uuid`).
- **Layers (O-9):** controller → service → repository → database, in these folders:
  - `src/server/controllers/` — reads the request, validates with Zod, calls one service, shapes the response.
  - `src/server/services/` — business rules. **Framework-free (D-002 now applies here):** no React, Next or Prisma imports.
  - `src/server/repositories/` — the only place Prisma is imported.
  - `src/server/adapters/shopee/` — Shopee HTTP, signing and tokens; nothing outside it builds a Shopee URL or signs a request.
  - Route handlers for outside callers stay in `src/app/api/…` **outside** the locale segment (as `/api/callbacks/shopee` already is), because Shopee and schedulers need fixed URLs. Each is a thin file that calls a controller.
  *(My call: folder names follow the owner's chosen layers; docs 03/04/06 are updated to match, §10.)*
- **Secrets:** partner key from env only; tokens encrypted at rest (§5.4); nothing secret logged.
- **Order status:** no enum, no transition logic (D-018, Q-023).
- **Sandbox first:** development uses the sandbox host and Test Partner only. The live host and Live partner key exist only in production configuration.

## 5. Data model

### 5.1 Overview

```
category ──< category_translation
    │
    └──< product_category >── product ──< product_translation
                                 │  ├──< product_image
                                 │  ├──< option_type ──< option_value
                                 │  ├──1 channel_item                 (Shopee item link)
                                 │  └──< variant ──< variant_option_value >── option_value
                                 │         └──1 channel_listing       (Shopee model link)
                                 │
shipping_size_tier_rate          └── (order_line → variant, unchanged from 05)

channel_authorization            (Shopee tokens, encrypted)
sync_run                         (one row per sync attempt)
```

Shopee-specific values live only in `channel_item`, `channel_listing`,
`channel_authorization` and `sync_run`. `product` and `variant` stay channel-neutral,
as `05-database.md` intends; `channel_listing` is the table 05 already names.

### 5.2 Catalogue — filled by the sync

**`product`** — one per Shopee item.

| Column | Type | Source / rule |
| :--- | :--- | :--- |
| `id` | uuid PK | ours |
| `parent_sku` | text, nullable, indexed (not unique) | Shopee `item_sku`, stored as-is — see §5.8 |
| `brand_name` | text, nullable | `brand.original_brand_name` |
| `weight_grams` | int, nullable | `weight` (kg, arrives as a **string**) × 1000, informational only (D-067) |
| `primary_category_id` | uuid FK → `category`, nullable | ours (§5.3) — breadcrumb |
| `shipping_size_tier` | `small` / `medium` / `large`, nullable | ours (§5.3) |
| `is_pre_order` | boolean, default false | ours (§5.3) |
| `release_date` | date, nullable | ours (§5.3) |
| `is_active` | boolean, default **false** | ours — admin switch (§5.3) |
| `created_at`, `updated_at` | timestamptz | ours |

**`product_translation`** — `product_id`, `locale` (`th` / `en`), `name`, `description`;
unique (`product_id`, `locale`). The sync writes Shopee's `item_name` and `description`
into the **`th`** row only. The `en` row is optional and edited in our admin. What the
English page shows when no `en` row exists is the Q-018 residual — still open; until
answered, build the fallback as a single function so the answer lands in one place.

**`product_image`** — `product_id`, `position` (0-based, from Shopee's order),
`url` (`image.image_url_list[i]`), `external_image_id` (`image.image_id_list[i]`);
unique (`product_id`, `position`). The sync replaces the set when it changes.

**`option_type`** — `product_id`, `position`, `name` (Shopee `variation_name`).
**`option_value`** — `option_type_id`, `position`, `value` (`variation_option_name`).
Positions matter: Shopee's `tier_index` refers to them.

**`variant`** — one per Shopee model; exactly one for an item without models.

| Column | Type | Source / rule |
| :--- | :--- | :--- |
| `id` | uuid PK | ours; **stable across syncs** (matched through `channel_listing`) so order lines stay valid |
| `product_id` | uuid FK | |
| `model_sku` | text, nullable, indexed (not unique) | Shopee `model_sku`; for a no-model item, `item_sku` |
| `price_satang` | bigint | `price_info[0].current_price` → satang |
| `original_price_satang` | bigint | `price_info[0].original_price` → satang (crossed-out price when higher) |
| `stock_quantity` | int, `CHECK >= 0` | `stock_info_v2.summary_info.total_available_stock` — **read-only copy** |
| `is_active` | boolean | false when the model disappears from Shopee or is not `MODEL_NORMAL` |
| `position` | int | display order |
| `created_at`, `updated_at` | timestamptz | |

For a no-model item, price and stock come from `get_item_base_info` (`price_info`,
`stock_info_v2` on the item); for an item with models, from `get_model_list` per model.

**`variant_option_value`** — (`variant_id`, `option_value_id`) composite PK, built from
each model's `tier_index`.

Public stock status stays derived, never stored: in stock when the variant is active and
`stock_quantity > 0` (REQ-006, D-024, D-065). The raw number is never sent to a browser.

### 5.3 Site-only catalogue data — edited in our admin

**`category`** — `id`, `parent_id` (nullable, for sub-categories such as PS5 › เครื่องเกม),
`slug` (unique), `position`. **`category_translation`** — `category_id`, `locale`, `name`.
**`product_category`** — (`product_id`, `category_id`) composite PK; a product may sit in
several (e.g. PS5 › เครื่องเกม and ชุดโปรโมชั่น). `product.primary_category_id` picks the
breadcrumb.

**`shipping_size_tier_rate`** — `tier` (PK: small / medium / large), `price_satang`.
Seeded with the candidate values 5000 / 10000 / 0 (D-079); the owner edits them.

**Activation (`product.is_active`).** A product first seen by the sync is created
**inactive**. Admin activates it after assigning a category and a shipping size tier.
The storefront shows a product only when all of these hold: `is_active`, its
`channel_item.external_status` is `NORMAL`, and at least one variant is active.

**Pre-order (`is_pre_order`, `release_date`).** Ours, because Shopee's pre-order is only
"ships in N days" (sandbox allows 3–4). Deposit and reservation quota are phase 5.

### 5.4 Shopee link and sync tables

**`channel_item`** — one per product.

| Column | Type | Source |
| :--- | :--- | :--- |
| `id` | uuid PK | |
| `product_id` | uuid FK, unique | |
| `channel` | text, `CHECK (channel = 'shopee')` | |
| `external_item_id` | bigint | `item_id`; unique (`channel`, `external_item_id`) |
| `external_status` | text | `item_status` (NORMAL, UNLIST, …) |
| `external_category_id` | bigint | `category_id` (Shopee's tree, informational) |
| `is_kit` | boolean | `get_item_list` → `tag.kit` |
| `external_created_at`, `external_updated_at` | timestamptz | `create_time`, `update_time` (Unix seconds) — `external_created_at` drives "newest" sort |
| `sales_count` | int | `get_item_extra_info` → `sale` — "best-selling" sort |
| `rating_star` | numeric(2,1) | `get_item_extra_info` → `rating_star` — stored, not shown (O-6) |
| `rating_count` | int | `get_item_extra_info` → `comment_count` |
| `last_synced_at` | timestamptz | |
| `raw_payload` | jsonb | last `get_item_base_info` entry — debugging only; catalogue data, no personal data |

**`channel_listing`** — one per variant.

| Column | Type | Source |
| :--- | :--- | :--- |
| `id` | uuid PK | |
| `variant_id` | uuid FK, unique | |
| `channel_item_id` | uuid FK | |
| `external_model_id` | bigint, nullable | `model_id`; **null for an item without models** |
| `external_status` | text, nullable | `model_status` |
| `last_synced_at` | timestamptz | |

Unique (`channel_item_id`, `external_model_id`) with **`NULLS NOT DISTINCT`**, written as
raw SQL in the migration (PostgreSQL 15+; Prisma cannot express it). This is what stops
two "no-model" variants for one item.

**One Shopee shop.** The design assumes Tinzshop has a single Shopee shop: one
`channel_authorization` row, and `channel_item` / `sync_run` carry no shop id. *(My call.
If a second shop is ever authorized, `channel_item` gains `external_shop_id` and the
sync runs per shop.)*

**`channel_authorization`** — the shop's tokens.

| Column | Type |
| :--- | :--- |
| `id` | uuid PK |
| `channel` | text |
| `external_shop_id` | bigint, unique with `channel` |
| `access_token_ciphertext`, `refresh_token_ciphertext` | text — AES-256-GCM, key from env `CHANNEL_TOKEN_ENCRYPTION_KEY` |
| `access_token_expires_at` | timestamptz (now + `expire_in`) |
| `refresh_token_expires_at` | timestamptz (30 days from issue) |
| `authorization_expires_at` | timestamptz, nullable — from `v2.shop.get_shop_info` `expire_time` (max 365 days) |
| `updated_at` | timestamptz |

A refresh token works once: the new pair is written in the same step that receives it.
If that write fails, the shop must be re-authorized — log it loudly.

**`sync_run`** — one row per attempt.

| Column | Type |
| :--- | :--- |
| `id` | uuid PK |
| `channel` | text |
| `started_at`, `finished_at` | timestamptz |
| `outcome` | text: `running` / `succeeded` / `failed` / `skipped` |
| `window_from`, `window_to` | timestamptz — the `update_time` window asked for |
| `items_seen`, `items_created`, `items_updated`, `items_deactivated` | int |
| `api_calls` | int — to watch Shopee's daily call limit |
| `warnings` | jsonb — e.g. empty or duplicate SKUs |
| `error_code`, `error_detail` | text, nullable — never a token, key, signed URL or personal data |

### 5.5 Orders and the manual stock list

Order, order line, payment and tax invoice follow `05-database.md` with three changes:

1. **No stock change anywhere in the order flow** (O-3). The K-Payment webhook still
   verifies, records payment and allocates the invoice number, but takes no stock lock.
2. **`order_line` gains** `stock_adjustment_outcome` (text, nullable: `adjusted` or
   `not_needed`), `stock_adjustment_at` (timestamptz, nullable) and
   `stock_adjustment_by_staff_id` (FK → `staff`, nullable). Glossary term: **manual stock
   adjustment** (ตัดสต๊อกด้วยมือ). `not_needed` covers an order cancelled before anyone
   updated BigSeller.
3. **`order_line` snapshots** what the customer saw: `product_name`, `option_summary`
   (e.g. "มีช่องใส่แผ่น · ขาว"), `model_sku`, alongside the existing `unit_price_satang`.
   A later sync may rename or remove the variant; the order must not change.

**The admin list** = order lines whose order has a payment with `paid_at` set, whose
`stock_adjustment_outcome` is null, and whose product is **not** a pre-order. It needs
no order status, so it does not wait on Q-023.

- Admin marks lines (one or many) as **adjusted** or **not needed**; marking records who and when.
- Pre-order lines are excluded because stock leaves only when the goods arrive
  (REQ-048); phase 5 decides how they join the list. *(My call.)*
- The list can be exported to Excel in **our own columns** (order, date, SKU, product,
  options, quantity). It is not BigSeller's import format — that stays blocked on Q-012.
  This is the closest match to the client's Q-024 "export to Excel to update BigSeller
  daily". *(My call.)*
- An order cancelled after its lines were marked adjusted needs stock put back in
  BigSeller by hand — outside the system.

### 5.6 Ordering against the mirrored stock

*(My call.)* The copied stock still guards the obvious cases:

- Adding to the cart and placing an order are refused for an inactive variant, a variant
  with `stock_quantity` 0, or a quantity above `stock_quantity` — checked at both steps,
  returned as `stock.insufficient` / 409 (`06-api.md`).
- When K-Payment confirms payment, the order is **never rejected** on stock grounds —
  the money has already moved. If the copied stock is by then below the quantity, the
  line is flagged in the admin list so staff can act.

### 5.7 Admin screens this design implies

*(My call.)*

- **Product list (REQ-036)** stays, grouped by product and expandable to variants.
  Shopee-sourced fields are read-only there.
- **Bulk edit of site-only fields**: category, shipping size tier, pre-order and release
  date, activation. The first full sync creates every existing Shopee product inactive
  (about 700 by the category design), so one-by-one editing is not workable.
- **Front page for signed-out visitors** (REQ-053, D-061) is built from derived sections
  (bundle category, best-selling, pre-order), as in `design/index.html`. No extra column.

### 5.8 Deliberate departures from earlier documents

- **SKUs are not unique-constrained.** Shopee does not guarantee `item_sku` / `model_sku`
  are filled or unique; a unique constraint would make the sync fail on the shop's own
  data. Identity is the Shopee ids. Empty or duplicate SKUs are reported in
  `sync_run.warnings`. (Changes plan 002's "unique" checkbox; REQ-004's format question
  Q-014 is unaffected — SKUs are stored as Shopee holds them.)
- **No `stock_movement` writes from the website**, because the website never changes
  stock. Whether the sync should log stock changes it observes is left to the builder (§9).

### 5.9 Unchanged from `05-database.md`

`staff`, `customer`, addresses, `role` / `permission` / `role_permission`, `cart`,
`tax_invoice`, `product_review`, `sale_page`, `content_page`, `news_article`,
`news_category`. Not redesigned here.

## 6. The sync job

**Trigger.** `POST /api/jobs/shopee-sync`, authenticated by a shared secret header
(`06-api.md` job convention), env `JOB_SECRET`. Any scheduler calls it every 10 minutes;
which scheduler is ADR-0002. Locally it can be run by hand.

**One at a time.** The run takes a PostgreSQL advisory lock (`pg_try_advisory_lock`). If
another run holds it, record `outcome = skipped` and return.

**Steps**

1. Load the authorization; refresh the access token if under 5 minutes remain.
2. Choose the window: from the last **succeeded** run's `window_to` minus 10 minutes
   (overlap, so nothing falls between runs) to now. No succeeded run yet → full sync.
3. `GET /api/v2/product/get_item_list` for `item_status` NORMAL and UNLIST (plus any other
   statuses the builder confirms exist), paged, filtered by `update_time` window.
4. For those ids, `get_item_base_info` in batches of 50; `get_model_list` for each item
   with `has_model`; `get_item_extra_info` in batches of 50.
5. For each item, in **one transaction**: upsert `product`, `product_translation` (`th`),
   `product_image`, `option_type` / `option_value`, `variant`, `variant_option_value`,
   `channel_item`, `channel_listing`. New items are created inactive (§5.3).
6. **Stock sweep** — see §8 risk 1; until verified, refresh price and stock for **every**
   active product each run, not only items in the window.
7. Item no longer returned, or status not NORMAL → `channel_item.external_status` updated
   and the product drops off the storefront by the visibility rule. **Never delete** a
   product or variant (order lines point at them).
8. Write the `sync_run` row: counts, warnings, outcome.

**Failure rules**

- One item's failure is recorded in `warnings` and does not stop the run.
- A whole-run failure (auth, network) leaves every existing row untouched and records
  `failed`. The next run's window starts from the last *succeeded* run, so nothing is lost.
- An empty or partial Shopee response is never read as "everything was deleted".

**Mapping rules**

- Baht → satang: one function, `Math.round(baht * 100)` on the decimal, tested with
  awkward values (`133.33`, `0.1 + 0.2`-style inputs).
- `weight` and other numbers may arrive as strings: parse defensively, reject garbage.
- Unix seconds → `timestamptz`.

## 7. How the design pages read this

| Page element | Read from |
| :--- | :--- |
| Card name, photo | `product_translation` (locale), `product_image` position 0 |
| Card / product price | lowest active `variant.price_satang`; crossed-out from `original_price_satang` when higher |
| มีสินค้า / สินค้าหมด | derived from `variant.is_active` and `stock_quantity` |
| Card category label, breadcrumb, menu, category filters and counts | `category`, `product_category`, `primary_category_id` |
| Sort: ขายดี / มาใหม่ / ราคา | `channel_item.sales_count` / `external_created_at` / `variant.price_satang` |
| Product page gallery | `product_image` ordered by `position` |
| Option pickers, price and stock per choice | `option_type`, `option_value`, `variant`, `variant_option_value` |
| Description | `product_translation.description` |
| Spec table | `brand_name`; Shopee `attribute_list` is not stored yet (§9) |
| Rating, review list and star breakdown | `product_review` (ours, O-6) |
| Pre-order card "วางจำหน่าย …" | `is_pre_order`, `release_date` |
| Cart "ขนาดใหญ่ · ส่งฟรี" | `shipping_size_tier` + `shipping_size_tier_rate` |
| Cart, checkout, order history | `cart`, `order`, `order_line`, `payment` (05) |

## 8. Risks and what to verify in the sandbox before building

1. **Does Shopee's `update_time` change when only stock changes?** If a Shopee sale or a
   BigSeller stock push does not bump `update_time`, a window-only sync misses stock
   changes. Test: create an order in Console → Test Order (and change stock in Seller
   Center), then compare the item's `update_time`. Until confirmed, the stock sweep in
   step 6 is mandatory.
2. **Shopee's daily API call limit is unknown** (`error_limit` exists). A full stock sweep
   costs about catalogue ÷ 50 base-info calls plus one `get_model_list` per item with
   models, every 10 minutes. The category design shows roughly 700 products. Measure
   with `sync_run.api_calls` in the sandbox, then confirm the limit before go-live.
   Shopee push notifications could replace the sweep later; not researched.
3. **Shopee image URLs** (O-5): no control over availability or caching; acceptable until
   file storage is chosen.
4. **Stock shown on the site is stale by design** (O-3). Accepted by the owner.
5. **Kit items' price and stock** were not seen in the sandbox. Create one with
   `add_kit_item` and confirm `get_item_base_info` / `get_model_list` return price and
   stock the same way as a normal item before relying on it.
6. **Item statuses other than NORMAL and UNLIST** (e.g. under review, banned, deleted) are
   named in Shopee's docs but were not seen in the sandbox; confirm how they appear.

## 9. Left to the builder

- Whether the sync writes `stock_movement` rows for the stock changes it observes.
- Whether to store Shopee's `attribute_list` now (spec table) or later.
- An admin "sync now" button, and how the admin list paginates and filters.
- Index choices for search (REQ-002: Thai has no word spaces — consider `pg_trgm`) and sorting.
- How the existing `/api/callbacks/shopee` callback grows into the token exchange and
  writes `channel_authorization`; whether to add a `state` check (the console's own
  Authorize link does not send one).
- Exact Prisma and PostgreSQL versions (PostgreSQL ≥ 15 for `NULLS NOT DISTINCT`).

## 10. Documentation to update when this is approved (rule 11, rule 13)

- `11-decisions.md`: a `D-0NN` row for each of O-1, O-2, O-3, O-5, O-6, O-7, O-8, O-9;
  mark D-068 and D-081 as superseded for the catalogue direction.
- `02-scope-and-phases.md`: REQ-020, REQ-021, REQ-036/037/038 changes; plan 002 scope.
- `03-architecture.md`: the order and payment flows (no stock lock), the layer names,
  invariant 1.
- `05-database.md`: this model replaces its catalogue and stock sections.
- `12-glossary.md`: `channel_item`, `channel_listing`, `channel_authorization`,
  `sync_run`, manual stock adjustment, `external_item_id`, `external_model_id`,
  `stock_adjusted_at`.
- `13-open-questions.md`: Q-042 (sandbox access now exists), Q-043 (pull API for the
  catalogue), Q-013 note (site mirrors Shopee's two tiers), new question for the Shopee
  daily call limit.
- `14-integrations.md`: Shopee → RESEARCHED, citing the developer-guide pages read.
- `docs/plans/002-…`: rewritten around this design.
- `.env.example`: `SHOPEE_API_BASE_URL`, `JOB_SECRET`, `CHANNEL_TOKEN_ENCRYPTION_KEY`.
