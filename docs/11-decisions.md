# Decisions

Every decision on this project, one sentence each. This is the whole register —
if a decision is not on this page it has not been made.

Read this file to find out *what* was decided. Follow the link to find out
*why*.

> Decisions here are ours — engineering choices about how to build. They are
> not client sign-off. Every requirement in `02-scope-and-phases.md` is still
> PROPOSED (Q-001), and a decision made against a proposed requirement can be
> undone by the client changing it.

## Status vocabulary

| Status | Meaning |
| :--- | :--- |
| **Accepted** | Decided. Build to it. Change it only by superseding the record. |
| **Proposed** | Framed, criteria fixed, not yet chosen. Do not build to it. |
| **Deferred** | Deliberately not decided yet, with a stated point at which it must be. |
| **Blocked** | Cannot be decided until a named open question is answered. |

---

## Architecture

| ID | Decision | Status | Detail |
| :--- | :--- | :--- | :--- |
| ADR-0001 | Tinzshop is built on Next.js (App Router), TypeScript, PostgreSQL and Prisma, with the commerce domain written in-house rather than adopted from a platform. | Accepted | [ADR-0001](adr/ADR-0001-backend-approach.md) |
| D-001 | Storefront, admin and API live in one route-grouped application, not a monorepo and not separate repositories. | Accepted | [04](04-tech-stack-and-structure.md#repository-shape) |
| D-002 | Domain logic lives in a framework-free layer that never imports React, Next or Prisma client types directly. | Accepted | [03](03-architecture.md#the-four-layers) |
| D-003 | Every request enters through one of exactly three entry surfaces — Server Component, Server Action, or route handler — and all three converge on the same domain functions. | Accepted | [03](03-architecture.md#entry-surfaces) |

## Data

| ID | Decision | Status | Detail |
| :--- | :--- | :--- | :--- |
| D-010 | Money is stored as an integer number of satang and never as a float. | Accepted | [05](05-database.md#money) |
| D-011 | Stock is held on the variant and never on the product, because the source gives each ModelSKU its own quantity (REQ-005). | Accepted | [05](05-database.md#stock) |
| D-012 | Any write that changes stock takes a row-level lock on the variant inside a transaction, so the shop cannot oversell (REQ-020). | Accepted | [05](05-database.md#concurrency-rules) |
| D-013 | Tax invoice numbers are drawn from a PostgreSQL sequence inside the order transaction, which is the only mechanism that gives a gap-free run under concurrency (REQ-025). | Accepted | [05](05-database.md#invoice-numbering) |
| D-014 | Database identifiers are `snake_case` and must match a term already in `12-glossary.md`. | Accepted | [05](05-database.md#naming) |
| D-015 | Migrations are forward-only, committed as reviewable SQL, and never generated automatically during deployment. | Accepted | [05](05-database.md#migrations) |
| D-016 | Every change to a price, a stock level or an order status writes an append-only audit row naming the actor and the time (REQ-040). | Removed — see D-066 | [05](05-database.md#audit) |
| D-017 | Records covered by the five-year retention rule are soft-deleted; hard deletion is reserved for erasing personal fields under PDPA. | Accepted — see D-070 | [05](05-database.md#deletion-and-retention) |
| D-018 | The order status set is not defined and no code may assume one until the client supplies it. A candidate set has been proposed for review — `13-open-questions.md` Q-023 — but is not adopted. | Blocked — Q-023 | [12](12-glossary.md) |
| D-019 | The customer record can optionally hold a personal tax ID / national ID and a 10-digit company tax ID, collected only when a customer requests a full tax invoice from the separate invoicing system (REQ-026, Q-027). | Accepted | [05](05-database.md#orders-and-payments) |

## API

| ID | Decision | Status | Detail |
| :--- | :--- | :--- | :--- |
| D-020 | Mutations from our own front end are Server Actions; REST route handlers exist only for callers we do not control — webhooks, exports and scheduled jobs. | Accepted | [06](06-api.md#server-actions-versus-route-handlers) |
| D-021 | Every external input is parsed by a Zod schema at the boundary, and unparsed input never reaches domain code. | Accepted | [06](06-api.md#validation) |
| D-022 | Every handler returns either a typed success value or a typed failure; thrown exceptions are for bugs, not for expected outcomes. | Accepted | [06](06-api.md#the-result-shape) |
| D-023 | Inbound webhooks are signature-verified, idempotent by event id, and acknowledged before their work is processed. | Accepted | [06](06-api.md#webhooks) |
| D-024 | Public API responses never include a real stock quantity, only the availability status (REQ-006). | Accepted | [06](06-api.md#what-must-never-be-returned) |

## Frontend

| ID | Decision | Status | Detail |
| :--- | :--- | :--- | :--- |
| D-030 | Components are Server Components by default; `"use client"` is added only where interaction genuinely requires it. | Accepted | [07](07-frontend-components.md#server-first) |
| D-031 | Thai and English come from message catalogues selected by a locale segment in the URL, applied identically to the storefront and the admin (REQ-007, REQ-033). | Accepted | [07](07-frontend-components.md#bilingual) |
| D-032 | No user-facing string is ever written literally in a component; every one comes from a message key. | Accepted | [07](07-frontend-components.md#bilingual) |
| D-033 | Components are grouped as primitives, domain components and route-owned components, and a component is promoted upward only on its second real use. | Accepted | [07](07-frontend-components.md#the-three-tiers) |
| D-034 | Every form validates with the same Zod schema the server uses, so client and server can never disagree about what is valid. | Accepted | [07](07-frontend-components.md#forms) |
| D-035 | Layout is mobile-first, because the source requires every desktop function to work on a phone (REQ-009). | Accepted | [07](07-frontend-components.md#responsive) |

## Security, testing and process

| ID | Decision | Status | Detail |
| :--- | :--- | :--- | :--- |
| D-040 | Role permissions are stored as rows and evaluated at request time, so the shop owner can change them without a developer (REQ-035). | Accepted | [08](08-security-testing.md#authorization) |
| D-041 | Authorization is checked in the domain layer, never only in the UI, and never inferred from which page the user reached. | Accepted | [08](08-security-testing.md#authorization) |
| D-042 | No secret is committed in any form, and no document, script or agent reads `.env`. | Accepted | [08](08-security-testing.md#secrets) |
| D-043 | Testing has three layers: domain unit tests, integration tests against a real PostgreSQL, and a manual checklist inside each plan. | Accepted | [08](08-security-testing.md#the-three-layers) |
| D-044 | The four invariants — no overselling, gap-free invoice numbers, correct VAT, and permission enforcement — carry integration tests before the code that implements them is merged. | Accepted; the no-overselling test is withdrawn — see D-096, the remaining three stand | [08](08-security-testing.md#the-four-invariants) |
| D-045 | Every change reaches `main` through a pull request reviewed by the other developer; an agent review does not substitute. | Accepted | [09](09-coding-guidelines.md#pull-requests) |
| D-046 | Ownership is a path, never a feature. | Accepted | [09](09-coding-guidelines.md#ownership) |
| D-047 | A pull request that assumes an answer to an unresolved question does not merge. | Accepted | [09](09-coding-guidelines.md#pull-requests) |
| D-091 | Work status is tracked as GitHub issues on a Projects board owned by `bundiz`, the repository's owner. Columns Todo / In progress / Done move only through the board's built-in workflows; the plan checklist stays the record of truth. | Accepted | [09](09-coding-guidelines.md#project-board) |
| D-092 | Every change is recorded in the repository's documentation in the same pull request as the change; a pull request with no documentation change says why. | Accepted | [09](09-coding-guidelines.md#documentation-with-every-change) |
| D-093 | The team's Claude Code subagents — planner, developer, tester-security-reviewer and devops — are defined in `.claude/agents/` and committed, so every developer uses the same roles and rules. | Accepted | [09](09-coding-guidelines.md#agent-team) |

## Catalogue mirror (owner, 2026-10-26)

Approved by the project owner on 2026-10-26; the owner's authority is recorded in spec §2 *Authority*.

| ID | Decision | Status | Detail |
| :--- | :--- | :--- | :--- |
| D-094 | Shopee is the master for product name, description, photos, options, price and stock. Our admin never edits them (spec O-1). | Accepted | [spec](superpowers/specs/2026-10-26-shopee-catalogue-mirror-database-design.md#2-owner-decisions-this-design-rests-on) |
| D-095 | The catalogue is pulled from the Shopee Open API every 10 minutes, and storefront pages never call Shopee. Supersedes D-081 for the catalogue direction (O-2). | Accepted | [spec](superpowers/specs/2026-10-26-shopee-catalogue-mirror-database-design.md#1-intent) |
| D-096 | Website orders never change stock. Staff update stock in BigSeller by hand from an admin list of paid order lines. Supersedes D-068 and removes REQ-020's no-oversell guarantee (O-3). | Accepted | [spec](superpowers/specs/2026-10-26-shopee-catalogue-mirror-database-design.md#55-orders-and-the-manual-stock-list) |
| D-097 | Photos are shown from Shopee's image URLs until file storage is chosen (O-5). | Accepted | [spec](superpowers/specs/2026-10-26-shopee-catalogue-mirror-database-design.md#2-owner-decisions-this-design-rests-on) |
| D-098 | Customers see only our own reviews. Shopee's rating and sales count are stored for sorting only (O-6). | Accepted | [spec](superpowers/specs/2026-10-26-shopee-catalogue-mirror-database-design.md#2-owner-decisions-this-design-rests-on) |
| D-099 | Admin assigns products to our own menu categories (O-7). | Accepted | [spec](superpowers/specs/2026-10-26-shopee-catalogue-mirror-database-design.md#53-site-only-catalogue-data--edited-in-our-admin) |
| D-100 | Shopee's orders are not imported (O-8). | Accepted | [spec](superpowers/specs/2026-10-26-shopee-catalogue-mirror-database-design.md#3-goals-non-goals-anti-goals) |
| D-101 | Server code is layered controllers → services → repositories, with external systems in adapters. Services are framework-free, and Prisma is imported only in repositories (O-9). | Accepted | [spec](superpowers/specs/2026-10-26-shopee-catalogue-mirror-database-design.md#4-constraints) |
| D-102 | Every website product comes from Shopee; there are no website-only products (O-10). | Accepted | [spec](superpowers/specs/2026-10-26-shopee-catalogue-mirror-database-design.md#2-owner-decisions-this-design-rests-on) |
| D-103 | Parent SKU and ModelSKU are stored as Shopee holds them, with no uniqueness constraint. Identity is Shopee's item and model id (spec §5.8). | Accepted | [spec](superpowers/specs/2026-10-26-shopee-catalogue-mirror-database-design.md#58-deliberate-departures-from-earlier-documents) |

### Built in plan 010 (engineering, 2026-10-26 to 2026-10-28)

Our own engineering decisions made while building plan 010; they implement the owner decisions above and do not change them.

| ID | Decision | Status | Detail |
| :--- | :--- | :--- | :--- |
| D-104 | The Shopee callback accepts only the shop configured in the required `SHOPEE_SHOP_ID`; any other `shop_id` gets `403 shopee.authorization.unexpected_shop` and no token exchange. | Accepted | [06](06-api.md#get-apicallbacksshopee) |
| D-105 | `channel_listing.external_status` is null for models Shopee still returns and `'NOT_FOUND'` for vanished ones; a returned model's active state is `variant.is_active`. Only `channel_item` is marked not-found for a vanished item. | Accepted | [05](05-database.md#catalogue) |
| D-106 | The sync service stays vendor-free: the Shopee source turns every Shopee API error into `CatalogueSourceError` carrying the Shopee code, and the service maps errors to `sync_run.error_code` (`channel_not_connected`, `token_persistence_failed`, `unexpected` for the rest). | Accepted | [14](14-integrations.md#how-the-sync-behaves-plan-010) |
| D-107 | When extra info is unavailable, an item's sales and rating are unknown, not 0: stored values are kept (a newly created item starts at 0) and the run records `extra_info_unavailable`. | Accepted | [14](14-integrations.md#how-the-sync-behaves-plan-010) |
| D-108 | A listing that does not advance, is empty while claiming more, or passes 1000 pages fails the run (`listing_stuck`, `listing_incomplete`, `listing_too_long`); a partial listing is never read as complete. | Accepted | [14](14-integrations.md#how-the-sync-behaves-plan-010) |
| D-109 | A run in which an item not known before the run fails ends `failed` with `item_failures`, keeping committed upserts, so the window does not advance and the item is listed again. A known item's failure stays a warning. Refines spec §6: every item is still processed, but `failed` now also covers this case. | Accepted | [14](14-integrations.md#how-the-sync-behaves-plan-010) |
| D-110 | Not-found items stay in the stock sweep and are restored when returned; a listed item that base info does not return is a failure (`not_returned`), never not-found; base-info elements are parsed one by one; `api_calls` counts one run's calls only. | Accepted | [14](14-integrations.md#how-the-sync-behaves-plan-010) |
| D-111 | Sync warnings are strings `item <id>: <code>` or `item <id> model <model id>: <code>`; empty and duplicate Parent SKUs and ModelSKUs among a run's upserted items are reported this way (REQ-004), never rejected. | Accepted | [14](14-integrations.md#how-the-sync-behaves-plan-010) |
| D-112 | The Shopee sandbox Test Partner id and sandbox shop id may appear in the repository as test data; live shop and partner ids may not (hard rule 2). | Accepted | [13](13-open-questions.md#q-057-do-the-shopee-sandbox-ids-count-as-account-identifiers) |
| D-113 | Prisma packages pinned at 7.10.1 and Vitest at 4.1.12 (from 7.10.0 / 4.1.11) to clear npm audit advisories, installed 13 days after release on the project owner's instruction. | Accepted | [plan 010](plans/010-shopee-catalogue-mirror.md#global-constraints) |
| D-114 | A `get_item_list` page without `item` is an empty page, not an invalid response; an `invalid_response` error records the failing field paths and issue codes (never values) in `sync_run.error_detail`. Prompted by two sandbox runs failing on 2026-10-28. | Accepted | [14](14-integrations.md#how-the-sync-behaves-plan-010) |
| D-115 | API docs are a hand-written OpenAPI 3.1 file, `docs/openapi.yaml`, kept in step with `06-api.md` in the same pull request; `/api/docs` renders it with the pinned `swagger-ui-dist` (dev dependency, served locally) and answers 404 in production. | Accepted | [06](06-api.md#api-docs-openapi) |
| D-116 | `src/server/controllers`, `services` and `repositories` (and `tests/integration`) are split into the same module folders — `catalogue/`, `channel/`, `api-docs/`, … — plus `shared/` for helpers several modules use; a unit test sits beside its file. The module folder is `catalogue/`, matching the code's spelling. | Accepted | [04](04-tech-stack-and-structure.md#repository-shape) |
| D-117 | The landing page and the product page, filled from the Shopee catalogue mirror, are built ahead of the rest of phase 3 as plan 011, on the project owner's request of 2026-10-28. The storefront visibility rule is unchanged; until plan 002's admin screens exist, the development-only job endpoint `POST /api/jobs/catalogue-activate` turns on synced products. REQ-001 and REQ-002 are not delivered; REQ-003 is touched (the variant picker). | Accepted | [02](02-scope-and-phases.md#phase-3--storefront-ordering-k-payment-simplified-tax-invoice) |
| D-118 | Storefront display details from plan 011 Task 5: `PriceDisplay` shows `฿` in both locales, whole baht without decimals and satang with two, and a price range as the one message `เริ่มต้น {price}`; dates and the copyright year use the locale's calendar in Asia/Bangkok time (Buddhist era on `/th`, Gregorian on `/en`, as the design writes 2569); the TH/EN switch shows at every width; the hero's "shop now" scrolls to the best sellers section and is not rendered when there are none, since no category page exists. | Accepted | [07](07-frontend-components.md#money-dates-and-numbers) |
| D-119 | The product page's variant picker (plan 011 Task 6): a value whose combination with the other current choices has no active variant is disabled; a value whose variant is sold out stays selectable and reads `{value} (สินค้าหมด)`, so the customer still sees that variant's price and stock status. The page opens on the cheapest in-stock active variant, else the cheapest active one. | Superseded — see D-121 | [07](07-frontend-components.md#the-variant-picker-d-121) |
| D-120 | A real 404 wins over a product-page skeleton: the product page has no `loading.tsx` above it, so `notFound()` runs before streaming starts and an unknown, malformed or hidden product answers HTTP 404, not a 200 with the not-found UI streamed in (Next 16). The landing page and its skeleton move to the nested route group `(shop)/(home)/`; `error.tsx` stays at `(shop)`. URLs do not change. Controller ruling R4, plan 011 Task 6 review. | Accepted | [07](07-frontend-components.md#loading-empty-and-error) |
| D-121 | The variant picker (supersedes D-119, plan 011 final review): a value is disabled only when no active variant carries it. Picking a value with no active variant under the other current choices moves those choices to the best active variant carrying it — in stock first, then cheapest — so every active variant can be reached (a diagonal set such as 1TB-Black and 2TB-White left 2TB-White unreachable under D-119). A value whose variant is sold out stays selectable and reads `{value} (สินค้าหมด)`; the page still opens on the cheapest in-stock active variant, else the cheapest active one. | Accepted | [07](07-frontend-components.md#the-variant-picker-d-121) |
| D-122 | Any URL under a locale that matches no page answers 404 with the site's own not-found screen in that locale (site header and footer, `shop.notFound.*`), not Next's built-in English page: a catch-all `src/app/[locale]/(shop)/[...rest]/page.tsx` calls `notFound()` and its `not-found.tsx` renders it; the product page's not-found shares the same `NotFoundPanel`. Every existing route is more specific and wins; `/api/**` never reaches it. Plan 011 final review. | Accepted | [07](07-frontend-components.md#loading-empty-and-error) |
| D-123 | The product gallery's main image loads eagerly, since it is the largest image above the fold; its thumbnails and every product-card image stay `loading="lazy"`. A struck-through original price shows only when it is above the price, and carries a screen-reader label (`shop.product.price.original`). Plan 011 final review. | Accepted | [07](07-frontend-components.md#money-dates-and-numbers) |
| D-124 | The storefront landing and product pages match `design/index.html` and `design/product.html` block for block, on the project owner's instruction of 2026-10-28; this overrides plan 011's constraint that no control is shown that does nothing. Controls whose feature is not built yet (search, account, wishlist, cart, category nav and rail links, "view all", promo tiles, quick links, sign-in and sign-up, carousel dots, quantity, add to cart, buy now, share, footer links) render exactly as designed and are inert: links go to `#` or to a real page where one exists, buttons are `type="button"`, and the search form never submits. Still left out: the news section (no news data), ratings and review counts (spec O-6), and every made-up number (the cart count is 0). | Accepted | [07](07-frontend-components.md#design-fidelity-and-inert-controls-d-124) |
| D-125 | The old site's "Reviews" category holds staff-written articles, so it is imported as a news category (project owner O-1, 2026-10-29). This does not contradict D-084 or REQ-047: "product reviews is not a news category" concerns **customer** product reviews (REQ-054) only. | Accepted | [05](05-database.md#news) |
| D-126 | The news import is a one-time import that can be re-run safely until go-live: a re-run adds new posts and updates changed ones, and nothing is ever deleted. After go-live staff write news in our own admin and the old site is never read again (O-2). | Accepted | [14](14-integrations.md#old-tinzshopcom-wordpress-news-import) |
| D-127 | Imported news images keep the old site's URLs for now, like Shopee images (D-097). They must be copied before the old site is shut down; file storage is decided in phase 7 (O-3, ADR-0002). | Accepted | [05](05-database.md#news) |
| D-128 | The news tables are built for authoring by bloggers from the start; the editor itself is a later plan, together with staff sign-in (plan 002) (O-4). | Accepted | [05](05-database.md#news) |
| D-129 | A blogger publishes their own article with no approval step; an Admin can also edit or unpublish. `news_article_status` is `draft` or `published` only (O-5). | Accepted | [05](05-database.md#news) |
| D-130 | Scheduling needs no extra status or job: an article is live when `status = 'published'`, `published_at <= now()` and `deleted_at IS NULL`, so a future `published_at` is a scheduled article (O-6). | Accepted | [05](05-database.md#news) |
| D-131 | Any blogger can edit or delete any article, not only their own; `author_staff_id`, `created_by_staff_id` and `updated_by_staff_id` record who changed it, and deleting is soft (`deleted_at`) (O-7). | Accepted | [05](05-database.md#news) |
| D-132 | The article byline is the writer's display name, stored as `byline_name` when the article is saved and shown as "โดย {byline_name}"; for an imported post it is the WordPress author's display name, and a post with none shows the message `shop.news.bylineFallback` (O-8). | Accepted | [05](05-database.md#news) |
| D-133 | The old site's news is imported through its public WordPress REST API (`/wp-json/wp/v2/`, no login), through an adapter in `src/server/adapters/wordpress/` that is the only place naming WordPress; the base URL is the non-secret setting `NEWS_IMPORT_SOURCE_URL`; requests run one after another, 100 per page; body HTML is sanitised at import with an allow-list and tags are not imported. | Accepted | [14](14-integrations.md#old-tinzshopcom-wordpress-news-import) |
| D-134 | News list layout (plan 012 rulings, not owner decisions): page 1 shows 3 feature articles plus 9 in the grid (12 in all) and later pages show 12 in the grid; category order follows the WordPress category id order, stored as `news_category.position`. | Accepted | [02](02-scope-and-phases.md#phase-6--news-content-pages-product-reviews-sale-page-reports) |
| D-135 | How the news body allow-list (D-133) is applied (plan 012 Task 3, not an owner decision): `table` includes its `thead`/`tbody`/`tfoot`/`tr`/`th`/`td`, headings are `h1` to `h6`, `br` is kept (85 of the 540 live posts use it), an `href` or `src` is kept only when it is an absolute `http`/`https` URL (a relative, fragment or other-scheme link is unwrapped to its text and such an image is dropped rather than left empty), and an `iframe` survives only with a `www.youtube.com` or `youtube.com` `/embed/` source, upgraded to `https`, keeping only `src` and an empty `allowfullscreen`; any other embed, `youtube-nocookie.com` included, is removed and counted. | Accepted | [14](14-integrations.md#old-tinzshopcom-wordpress-news-import) |
| D-136 | How the news import (D-133) writes (plan 012 Task 4, not an owner decision): its own advisory lock key, separate from the catalogue sync; a new category takes `position` from its source id rank (D-134) and an existing one keeps its position; a decoded slug already held by another row gets `-{source_id}` appended, the same on every run; an unchanged `source_modified_at` writes nothing; links to categories the database does not hold are skipped; a failed image, map or save fails only that post; a failed category, author or post list stops the run with `502 news_import.failed` and a fixed reason; an unset `NEWS_IMPORT_SOURCE_URL` is `503 news_import.not_configured`. | Accepted | [14](14-integrations.md#how-the-import-behaves-plan-012) |

## Deployment

| ID | Decision | Status | Detail |
| :--- | :--- | :--- | :--- |
| ADR-0002 | Where the application and database run is deliberately not chosen yet, and must be chosen at phase 7. | Deferred | [ADR-0002](adr/ADR-0002-hosting-and-deployment.md) |
| D-050 | Application code is written against runtime interfaces rather than any provider's SDK, which is what makes ADR-0002 affordable to defer. | Accepted | [10](10-deployment.md#provider-independence) |
| D-051 | Backup retention and recovery targets cannot be set until the client states them. | Blocked — Q-055 | [10](10-deployment.md#backup) |
| D-052 | What Cloudflare is actually for is undefined and no configuration may be written until it is. | Blocked — Q-054 | [10](10-deployment.md#cloudflare) |

## Business and scope

Decisions recorded from the client's 2026-09-13 answers to `13-open-questions.md`.
These are business-policy calls, not technical design, but they carry the same
force: build to them, and change them only by recording a new answer in
`13-open-questions.md`.

| ID | Decision | Status | Detail |
| :--- | :--- | :--- | :--- |
| D-060 | All displayed prices already include 7% VAT; the totals function extracts it rather than adding it on top. | Accepted | [13](13-open-questions.md#q-010-vat-contradiction-between-sections-6-and-12) |
| D-061 | A signed-out visitor sees only front-page products; there is no guest checkout, and every order belongs to a registered customer. | Accepted | [13](13-open-questions.md#q-022-guest-checkout-contradicts-guest-browsing-restriction) |
| D-062 | Six roles form the authorization model: Blogger, Sale-manager, Admin, Top-level Admin, Customer, Guest. Customer and Guest are rows in `role`, not a special case. | Accepted | [13](13-open-questions.md#q-015-4-permission-levels-but-six-roles-are-listed) |
| D-063 | The owner may edit permissions on the six existing roles only; the system offers no "create a role" screen. | Accepted | [13](13-open-questions.md#q-016-which-permissions-are-owner-configurable) |
| D-064 | Staff two-factor authentication is email OTP only; no SMS/phone OTP. | Accepted | [13](13-open-questions.md#q-017-staff-two-factor--email-or-phone) |
| D-065 | Low-stock status and the near-out-of-stock dashboard list are removed; public stock status is in stock / out of stock only. | Accepted | [13](13-open-questions.md#q-019-low-stock-threshold-is-not-defined) |
| D-066 | Audit logging of price, stock and order-status changes is removed from scope. | Accepted | [13](13-open-questions.md#q-020-audit-log-scope-and-retention) |
| D-067 | Product weight/dimension capture is not required for phase 2; shipping size is a staff-assigned configurable category, not a computed function of a measured value. | Accepted | [13](13-open-questions.md#q-021-product-weight-and-dimension-data) |
| D-068 | Stock is deducted only when K-Payment confirms payment for a normal order; for a pre-order, a reservation quota is held at order time and the real stock deduction happens only when staff record the goods as received from the supplier. | Superseded — see D-096 | [13](13-open-questions.md#q-024-when-is-stock-deducted) |
| D-069 | The website generates only a simplified (abbreviated) tax invoice; a full tax invoice, when a customer needs one, is generated by a separate system from customer data (including an optional personal or company tax ID) that we provide to it. | Accepted | [13](13-open-questions.md#q-026-abbreviated-tax-invoice-or-full-tax-invoice) |
| D-070 | A PDPA deletion request erases personal fields not covered by the five-year retention rule; fields on a retained tax/accounting document are kept as an accepted legal exception. Supersedes the Blocked status of D-017. | Accepted | [13](13-open-questions.md#q-028-pdpa-deletion-versus-5-year-document-retention) |
| D-071 | PromptPay is never offered standalone; it exists only as the QR option inside the K-Payment flow. | Accepted | [13](13-open-questions.md#q-029-is-promptpay-in-the-first-phase) |
| D-072 | The bank-transfer-with-slip payment workflow is removed. K-Payment (card, instalments, PromptPay QR) is the sole payment method, and its integration moves into phase 3 rather than phase 4 because bank transfer no longer exists as an interim method. | Accepted | [13](13-open-questions.md#q-030-bank-transfer-slip-verification-workflow) |
| D-073 | There is no transactional-email opt-out. Instead, a customer can view and filter their own order-status history by date range and status. | Accepted | [13](13-open-questions.md#q-031-which-notification-emails-can-customers-switch-off) |
| D-074 | Transactional email is sent through a mail-relay service via the existing adapter interface; the specific provider and sending domain are a configuration detail finalized later. | Accepted | [13](13-open-questions.md#q-032-transactional-email-sending-domain-and-provider) |
| D-075 | No direct shipping-carrier integration is built. Shipping/fulfilment runs through BigSeller; the site optionally supports printing a simple self-printed address label from order data, and a carrier tracking number is not a core requirement. | Accepted | [13](13-open-questions.md#q-034-first-shipping-carrier-not-selected) |
| D-076 | Return, warranty, and post-shipment cancellation are handled case by case, directly between customer and shop (or through the relevant marketplace's own support). No centralized return/warranty/cancellation policy engine is built. | Accepted | [13](13-open-questions.md#q-035-return-and-warranty-period-and-who-pays-return-shipping) |
| D-077 | Refund payout is out of scope for this system. | Accepted | [13](13-open-questions.md#q-036-how-are-refunds-actually-paid-out) |
| D-078 | Warranty claims are routed to the product's distributor/representative; the system displays contact information and does not manage a claim workflow. | Accepted | [13](13-open-questions.md#q-038-warranty-claim-workflow) |
| D-079 | Shipping cost uses three shop-owner-configurable size tiers: small (candidate 50 THB), medium (candidate 100 THB), large (free). The long-term classification basis — weight or dimensions — is still open. | Accepted (tiers) / Blocked — Q-040 (measurement basis) | [13](13-open-questions.md#q-040-shipping-rule-parameters) |
| D-080 | Pre-order deposit percentage and balance-collection timing are shop-owner-configurable values, never hard-coded. | Accepted | [13](13-open-questions.md#q-041-pre-order-deposit-percentage-and-balance-due-date) |
| D-081 | Stock sync with BigSeller uses daily file export/import as the primary mechanism; the paid realtime API is a future option, not a phase-1 dependency. | Superseded for the catalogue — see D-095 | [13](13-open-questions.md#q-043-bigseller-live-api-versus-daily-file-import--undecided) |
| D-082 | Shopee is the authoritative source of truth when Shopee stock and site stock disagree. | Accepted | [13](13-open-questions.md#q-046-stock-discrepancy-detection-and-reconciliation) |
| D-083 | A dropship order requires a staff-run "Contact staff / Check availability" gate confirming supplier stock before the customer is allowed to pay. | Accepted | [13](13-open-questions.md#q-047-dropship-supplier-confirmation-before-payment) |
| D-084 | Staff-written blog/news and customer-submitted product reviews are two separate features; customer product reviews (previously ambiguous under the `+` marker) are confirmed in scope. | Accepted | [13](13-open-questions.md#q-048-product-review-means-two-different-things) |
| D-085 | A per-product "Sale Page" is a distinct content type, separate from the product page and from news articles. | Accepted | [13](13-open-questions.md#q-049-relationship-between-a-products-sale-page-and-news-articles) |
| D-086 | Staff training is one combined Thai-language manual covering all six roles, not role-specific versions. | Accepted | [13](13-open-questions.md#q-051-staff-training-scope) |
| D-087 | Cloudflare Free plan is used, scoped to security and bot protection; no paid Cloudflare tier without a future justified need. | Accepted | [13](13-open-questions.md#q-054-cloudflare-scope-and-account-ownership) |
| D-088 | Database backup is deliberately lightweight: automatic daily full backup, 30-day rolling retention, one timed restore rehearsed before go-live, no point-in-time recovery. Revisitable. | Accepted | [10](10-deployment.md#backup) |
| D-089 | The `+` marker in source §10 means "add to scope." Instalments and customer product reviews are scheduled; loyalty points/gift cards and a wishlist are confirmed in scope but placed in a post-launch backlog given the 100,000 THB budget. | Accepted | [02](02-scope-and-phases.md#backlog-items-confirmed-in-scope-but-not-scheduled) |
| D-090 | Total project budget is 100,000 THB (phases 2–9). A proposed schedule runs phase 1 from 2026-09-01 and phases 2–9 from 2026-09-16 through 2027-03-09, subject to revision as BigSeller and Shopee research lands. | Accepted (as a working plan; not a client-confirmed deadline) | [02](02-scope-and-phases.md#schedule-and-budget) |

---

## How a decision gets recorded

**A one-liner here is not enough on its own.** Every row above points at the
document that carries the reasoning. Add both, in the same pull request, or
neither.

Two kinds of record exist:

- **`D-0NN` — a design decision.** The reasoning lives in the technical
  document that owns the topic. Use this when the decision is a consequence of
  something already decided, or is small enough that a section explains it.
- **`ADR-000N` — an architecture decision record**, in `adr/`. Use this when
  the decision is genuinely open, has real alternatives worth writing down, and
  will be expensive to reverse.

### ADR fields

| Field | Content |
| :--- | :--- |
| **Status** | `Proposed` · `Accepted` · `Deferred` · `Superseded by ADR-000N` |
| **Date** | The date the status last changed, as YYYY-MM-DD |
| **Context** | The forces at play: what we need, what constrains us, what we do not know |
| **Options considered** | Each option with its trade-offs. An option nobody seriously weighed does not belong here |
| **Criteria** | What the choice is judged on, written *before* the choice |
| **Decision** | What was chosen, and by whom. Empty while Status is not `Accepted` |
| **Consequences** | What this makes easy, what it makes hard, and what we now live with — good and bad |

### Rules

1. **An Accepted ADR is never edited.** If the decision changes, write a new ADR and set the old one's status to `Superseded by ADR-000N`. The old record stays readable exactly as it was. An edited history teaches nothing.
2. A `Proposed` ADR may be edited freely while it is still being argued.
3. Leave `Decision` and `Consequences` empty until the decision is actually made. An ADR that quietly fills them in while still marked Proposed reads as settled and misleads the next person.
4. Record the criteria before the choice. Criteria written afterwards tend to describe whatever was already picked.
5. Link the open questions the decision depends on. A decision resting on an unanswered question is not ready to accept — mark it `Blocked` and name the question.
