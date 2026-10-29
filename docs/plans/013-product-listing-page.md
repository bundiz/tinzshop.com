# 013 — Product listing page and category mock — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

- **Status:** Not started — written 2026-10-29, awaiting the project owner's review
- **Phase:** 3 (storefront), an early slice on the owner's request of 2026-10-29
- **Requirements touched:**
  - REQ-001 (browse products by category)
  - REQ-003 (variant price and availability, unchanged)
  - REQ-006 (stock as a status)
  - REQ-007 (Thai and English)
  - REQ-009 (mobile-first)
  - REQ-002 (search) is **not** delivered.
- **Depends on plans:** 010 (catalogue mirror) and 011 (pages, header, card)
- **Design:** `design/category.html` (the listing) and `design/product.html` (the detail page already built in 011)
- **Branch:** `feat/win/products`, from `main`

**Goal:**
- `/{locale}/product` lists every visible product, with category tabs, the sidebar filters, sort, a grid/list toggle and pagination, matching `design/category.html`.
- `/{locale}/product/{productId}/detail` is the product page, moved from `/{locale}/products/{productId}`.
- Until admins can assign categories, a development job assigns them from product-name keywords.

**Architecture:**
- **Catalogue service (framework-free):** a new storefront listing read in the catalogue service turns URL filters into one repository query.
- **Repository (SQL):** filters, sorts, counts and paginates in SQL, plus one facet-count query.
- **Categoriser:** a pure keyword categoriser behind a dev-only job endpoint fills `product_category` and `primary_category_id`, but only for products that have none.

## Owner decisions (2026-10-29)

1. **Routes.**
   - The all-products page is `/{locale}/product`.
   - A product's page is `/{locale}/product/{productId}/detail`.
   - The old `/{locale}/products/{productId}` route is removed, and every link is updated. The site is not live, so no redirect is needed.
2. **Category data.** Categories are a mock for now, derived from the product name (e.g. a PS5 model goes to PlayStation 5). Later they come from admins, or from a mapping of Shopee's categories. Shopee's `v2.product.get_category` returns Shopee's own marketplace tree, not the shop's menu.
3. **Default sort.** "แนะนำ" means best-selling first.
4. **Branch.** This plan is built on a new branch after the news plan.

## Global Constraints

- **Layers and modules (D-101, D-116).**
  - Categoriser rules and the listing service live in `src/server/services/catalogue/`.
  - Queries live in `src/server/repositories/catalogue/`.
  - The job controller lives in `src/server/controllers/catalogue/`.
  - Nothing in `src/app` imports Prisma. Services import nothing from `next`, `react` or `@prisma/*`.
- **Storefront visibility rule** (spec 2026-10-26 §5.3): `product.is_active`, `channel_item.external_status = 'NORMAL'`, and at least one active variant. Every query in this plan applies it **in SQL**.
- **Admin-owned fields are never overwritten.** The categoriser touches only products with no `product_category` row and no `primary_category_id`.
- **Filters are URL search params**, so every state is shareable and back/forward works:
  - `category` (a category slug), `type` (a repeated type slug)
  - `min`, `max` (whole baht)
  - `in_stock=1`, `kit=1`, `pre_order=1`
  - `sort` (`recommended` default, `best_selling`, `newest`, `price_asc`, `price_desc`)
  - `view` (`grid` default, `list`)
  - `page`
  - Invalid values follow rulings R1 and R2 below. Nothing ever throws (D-120, D-122).
- **Ruling R1 (facet counts).** Each facet count applies every active filter except the facet's own dimension.
- **Ruling R2 (invalid params).**
  - An invalid `page`, or an unknown `category`, `type`, `sort` or `view`, gives a real 404.
  - A non-numeric or negative `min`/`max` is ignored (that filter is dropped, with no error).
  - `min > max` is swapped.
  - Nothing ever throws.
- **Paging and sort.**
  - 24 products per page.
  - Ties break by `product.id`, so pages never overlap.
  - "แนะนำ" = best-selling (`channel_item.sales_count` desc), with in-stock products before sold-out ones.
  - Price filters and sorts use each product's cheapest active variant.
- **Rendering.**
  - Every user-facing string comes from messages th + en (D-031, D-032). Category names come from `category_translation`, with an `en` → `th` fallback through the existing single function.
  - Price is rendered by `PriceDisplay`, stock by `StockBadge`, and cards by the existing `ProductCard`.
  - No ratings (O-6). Controls that do not work yet render inert (D-124).
- **Status codes.** A real 404 for an unknown category slug or a page past the end. No `loading.tsx` above `/product/{id}/detail` (D-120).
- **The landing page's catalogue read moves to SQL** (sort + limit in SQL, not in JS). The same visibility rule applies.

## Review Focus

1. **Filter combinations.** A category plus a type plus a price range plus in-stock combine with AND. Each facet count reflects the other active filters, not itself, and an article-style double count never happens. Owner: Task 3, test `combines filters with AND and counts facets without double counting`.
2. **A product with several variants at different prices.** The price range uses the cheapest active variant, and a sold-out cheapest variant still counts for price but not for "มีสินค้า". Owner: Task 3, test `filters and sorts by the cheapest active variant`.
3. **Admin work survives the categoriser.** A product that already has a category is never re-categorised, and re-running the job changes nothing. Owner: Task 2, test `only fills uncategorised products and is idempotent`.
4. **Hostile query strings.** Inputs like `?min=abc`, `?page=0`, `?type=…` repeated 1000 times, `?sort=drop`, or `?category=../x` answer 404 or are ignored per R2, never a 500. Owner: Task 4, test `rejects or ignores invalid params without throwing`.
5. **Old links.** The landing cards, related products and the breadcrumb point at `/product/{id}/detail`, and nothing links to `/products/…` any more. Owner: Task 5, test `no link targets the old /products route`.

---

## Category tree (seeded by the categoriser job if missing)

**Platforms** (top level, ordered as in the design):
- `nintendo-switch` (Nintendo Switch)
- `playstation-5` (PlayStation 5)
- `it-gadgets` (IT Gadgets)

**Types** are the children of each platform: `{platform}-console` (เครื่องเกม), `{platform}-game` (แผ่นเกม), `{platform}-controller` (จอย) and `{platform}-accessory` (อุปกรณ์เสริม). IT Gadgets has only `it-gadgets-accessory`.

**Not categories:** "ชุดโปรโมชั่น" is the `kit=1` filter (`channel_item.is_kit`), and "พรีออเดอร์" is the `pre_order=1` filter (`product.is_pre_order`). They appear as tabs and sidebar entries but are flags.

**Keyword rules** for the Thai name, case-insensitive, with the first match winning in each column:

| Platform, if the name contains | Platform |
| :--- | :--- |
| `PS5`, `PlayStation`, `DualSense` | `playstation-5` |
| `Switch`, `Nintendo` | `nintendo-switch` |
| `SSD`, `Keyboard`, `Mouse`, `Headset`, `คีย์บอร์ด`, `เมาส์`, `หูฟัง` | `it-gadgets` |
| none of these | no category (shown under "ทั้งหมด" only) |

| Type, if the name contains | Type |
| :--- | :--- |
| `Controller`, `จอย`, `DualSense`, `Joy-Con` | controller |
| `Console`, `เครื่อง` and not `Game` | console |
| `Game`, `เกม` | game |
| anything else, with a platform | accessory |

A product gets its type category as `primary_category_id` and a `product_category` row for both the type and its platform. Both tables live in one constant in the service, so the owner can edit words in one place.

---

### Task 1: Docs, branch and names

- [x] **Decision rows.** Add D-rows from the next free number for owner decisions 1–4, for the category tree, and for the URL-param filter contract. The owning docs are `02` (a Phase 3 note naming plan 013), `05` (the tree and categoriser), `06` (the job endpoint) and `07` (the listing page).
- [x] **Glossary rows:** the routes, every query param, `StorefrontListing*` names, the categoriser and its job, and "product type".
- [x] **`CLAUDE.md`:** allow plan 013 alongside 010–012.
- [x] **Commit:** `docs: record the product listing page as plan 013`.

### Task 2: Keyword categoriser and job

- [ ] **Failing tests first:**
  - **Unit tests:** `categoriseByName` on real sandbox names (DualSense → PS5 controller; Portable SSD → IT Gadgets accessory; Mario Kart → Switch game; Servage Raven Case for Nintendo Switch 2 → Switch accessory; Three Tier Limit Test → no category).
  - **Integration tests:** `only fills uncategorised products and is idempotent` (Review Focus 3); `seeds the category tree when missing`.
  - **Controller tests:** 404 in production before auth; 401; 200 `{ categorised, skipped }`.
- [ ] **Implement:**
  - The pure service (`src/server/services/catalogue/categorise-by-name.ts`, rules constant).
  - A repository function that seeds the tree and assigns in one transaction.
  - `POST /api/jobs/catalogue-categorise`, using the shared `isJobAuthorized` and the dev-only 404 in production, as with catalogue activation.
  - Document it in `06` + `docs/openapi.yaml`.
- [ ] **Commit:** `feat: add a development job that categorises products from their names`.

### Task 3: Listing query in SQL

- [ ] **Failing integration tests:**
  - `combines filters with AND and counts facets without double counting` (Review Focus 1)
  - `filters and sorts by the cheapest active variant` (Review Focus 2)
  - `pages 24 at a time without overlap`
  - `hides products the visibility rule excludes`
  - `recommended = best-selling with in-stock first`
- [ ] **Implement:**
  - `listStorefrontProducts(filter)` returns one page of rows plus the total, with the filters and sort in SQL. Use Prisma where it can express the query; otherwise a tagged-template `$queryRaw` (never string-concatenated). The cheapest active variant comes from a subquery or a lateral join.
  - `countStorefrontFacets(filter)` returns the category, type, kit and pre-order counts under the other filters.
  - The service `getStorefrontListing(deps, params, locale)` maps rows to `LandingProductCard` and the facets to the sidebar and tabs.
- [ ] **Landing.** Rewrite the landing page's `listStorefrontCandidates` so sort and limit run in SQL (best sellers 8, bundles 6, pre-orders 4), with the same output and tests.
- [ ] **Commit:** `feat: list storefront products with SQL filters, sort and paging`.

### Task 4: `/product` page

- [ ] **Failing tests:**
  - `rejects or ignores invalid params without throwing` (Review Focus 4)
  - Render tests: the tabs mark the active category; a sidebar count; filter chips with "ล้างทั้งหมด"; pagination keeps the filters; the list view.
- [ ] **Build** `src/app/[locale]/(shop)/product/page.tsx` (+ layout metadata) to match `design/category.html` block for block:
  - breadcrumb, then the hero band (title + description of the active category, or "สินค้าทั้งหมด")
  - type tabs with icons (ทั้งหมด, เครื่องเกม, แผ่นเกม, จอย, อุปกรณ์เสริม, ชุดโปรโมชั่น)
  - the sidebar:
    - หมวดหมู่ with counts
    - ช่วงราคา inputs + presets
    - ประเภทสินค้า checkboxes with counts
    - มีสินค้า and พรีออเดอร์ toggles
  - the toolbar: "พบ N รายการ", the sort select, grid/list
  - active-filter chips
  - the card grid (`ProductCard`, 4 per row on desktop as in the design) and pagination
- [ ] **Interaction.**
  - Filter controls are a small client component that rewrites the URL, so the page stays server-rendered and `force-dynamic`.
  - Price inputs apply on blur/Enter.
  - At 360px the sidebar becomes a "ตัวกรอง" panel.
- [ ] **Navigation.** The header's "หมวดหมู่ทั้งหมด" and the category nav links (Nintendo Switch, PlayStation 5, IT Gadgets, พรีออเดอร์, ชุดโปรโมชั่น) now go to `/product?…`. The landing "ดูทั้งหมด" links do the same.
- [ ] **Commit:** `feat: add the product listing page`.

### Task 5: Move the product page to `/product/{id}/detail`

- [ ] **Failing test:** `no link targets the old /products route` (Review Focus 5). It renders the landing, a related section and the breadcrumb, and asserts every href.
- [ ] **Move** `src/app/[locale]/(shop)/products/[productId]/` to `src/app/[locale]/(shop)/product/[productId]/detail/`, keeping D-120: no loading boundary, real 404s, and metadata in the layout.
- [ ] **Breadcrumb.** It is now หน้าแรก › {platform} › {type} › name, using the product's categories, with links to `/product?category=…`.
- [ ] **Update** the `ProductCard` link, related products, docs (07, glossary) and openapi, if it names routes.
- [ ] **Commit:** `feat: move the product page to /product/{id}/detail`.

---

## Manual test checklist

Run by a person against the dev database. Never tick a box for a check nobody performed.

- [ ] Run `curl -X POST -H "Authorization: Bearer $JOB_SECRET" http://localhost:3002/api/jobs/catalogue-categorise`. It returns `categorised` > 0, and a second run returns 0.
- [ ] `/th/product` shows every visible product. Clicking PlayStation 5 filters the list, and its counts match.
- [ ] Price 1000–3000 plus มีสินค้า narrows the list, the chips show the filters, and "ล้างทั้งหมด" resets them.
- [ ] Sort by price ↑/↓ and ขายดี, the grid/list toggle, and pagination keep the filters.
- [ ] A card opens `/th/product/{id}/detail`, with the category breadcrumb.
- [ ] At 360px wide, nothing scrolls sideways, and the filter panel opens.

## Not in this plan

Search, admin category assignment (plan 002), mapping Shopee categories, a wishlist, ratings and reviews.

## Outcome

Not started.
