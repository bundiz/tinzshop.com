# 011 — Landing page and product page from the catalogue mirror — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

- **Status:** Not started — written 2026-10-28, awaiting the project owner's review
- **Phase:** 3 (storefront), an early slice. The project owner asked on 2026-10-28 for the landing page showing mirrored products and stock to come first (D-117).
- **Requirements touched:** REQ-003 (select a variant and see its price and availability, without adding to a cart), REQ-006 (stock shown as a status, never a number), REQ-007 (Thai and English), REQ-009 (mobile-first). REQ-001 and REQ-002 are **not** delivered: no category pages, no search.
- **Blocked by:** nothing
- **Depends on plan:** 010 (merged as PR #29)
- **Spec:** the catalogue mirror design `docs/superpowers/specs/2026-10-26-shopee-catalogue-mirror-database-design.md`, §5.3 (activation and the storefront visibility rule) and §7 (how the design pages read the tables). The page designs are `design/index.html` and `design/product.html`, with `design/css/style.css`.

**Goal:** `/th` and `/en` render the design's landing page, and `/th/products/<id>` the design's product page. Both are filled from our PostgreSQL mirror on every request, so a sync followed by a page reload shows Shopee's current prices and stock status.

**Architecture:** A Server Component page calls one catalogue read service (`getLandingCatalogue`), which applies the visibility rule and card derivations to rows from one repository query. No route handler is added: our own pages call services directly (D-020). Styling is Tailwind with the design's tokens; text comes from next-intl message catalogues.

**Tech Stack:** Next.js 16.4.3 App Router, React 19.3, Tailwind CSS 4.3.3 (`@tailwindcss/postcss` 4.3.3), next-intl 4.14.9, Prisma 7.10.1, Vitest 4.1.12.

## Owner decisions (2026-10-28)

1. Build the landing page and the product page first, following `design/`, with the products and stock that the sync mirrors from Shopee.
2. **The visibility rule stays as agreed** (spec §5.3): a product shows only when `product.is_active`, its `channel_item.external_status = 'NORMAL'`, and at least one variant is active. Until the admin screens exist, a development command turns on synced products (Task 4).

## Global Constraints

- Pin exactly, versions at least two weeks old: `tailwindcss` 4.3.3, `@tailwindcss/postcss` 4.3.3, `next-intl` 4.14.9. Install with `npx npm@11.21.0 install --save-exact …`; `npm ci` with npm 10.8 must still work.
- Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/` (`AGENTS.md`). Next 16 names the request interceptor `proxy.ts`, not `middleware.ts`.
- Layers and module folders (D-101, D-116): the read query goes in `src/server/repositories/catalogue/`, the rules in `src/server/services/catalogue/`, and nothing in `src/app/` imports Prisma. Services import nothing from `next`, `react` or `@prisma/*`.
- Every user-facing string comes from `messages/th.json` or `messages/en.json`, both carrying every key (D-031, D-032). Keys are dot paths, e.g. `shop.home.bestSellers.title`. Product names and image URLs are data, not messages.
- A price is rendered only by `PriceDisplay` (satang in, baht out, D-010). Stock is rendered only by `StockBadge`, which takes a status, never a number (REQ-006, D-024, D-065). The status is `in_stock` or `out_of_stock`, text plus colour.
- Mobile-first: base styles are the phone, breakpoints add; check at 360px wide (D-035). Thai needs a generous line-height and wrapping (07 *Designing for Thai*).
- The default locale is `th`; `/` redirects to `/th`. The locale is never guessed from a browser header (07 *Bilingual*).
- Product name on `/en`: the `en` translation, else the `th` one. This lives in one function, `pickProductName`, because the real rule is the open Q-018 residual (spec §5.3).
- Images: `<img>` with the Shopee URL from `product_image` position 0 (spec O-5), `loading="lazy"`, product name as `alt`. No `next/image` remote config, because live image hosts are not known. A product without an image renders the design's placeholder block.
- Ratings are not shown: only our own reviews may be shown (spec O-6), and none exist yet. Category menus, news, cart, sign-in and search are not rendered until their plans exist; no control is shown that does nothing.
- On the product page this also leaves out: quantity, add to cart, buy now, wishlist, share, the reviews tab, related products and the payment-method chips. Payment methods are confirmed in plan 003, and K-Payment is the sole method (D-072). The variant picker, gallery and price/stock per choice are kept.
- A product URL is `/{locale}/products/{productId}`, where `productId` is our `product.id` (uuid). A malformed id, an unknown id, or a product the visibility rule hides is `notFound()`, never an error page.
- The page is rendered per request (`export const dynamic = 'force-dynamic'`), never statically cached, so a sync shows on the next reload.

## Review Focus

1. **Products the visibility rule hides.** An inactive product, an `UNLIST` or `NOT_FOUND` item, and a product whose variants are all inactive must never render. Owner: Task 3, test `hides products the visibility rule excludes`.
2. **Variants at different prices.** The card shows the lowest active price, and is marked as a range ("from"). The crossed-out price shows only when that variant's `original_price_satang` is higher. Owner: Task 3, test `derives the card price from the cheapest active variant`.
3. **Sold out.** All active variants at stock 0 give `out_of_stock`; any active variant above 0 gives `in_stock`. An inactive variant's stock never counts. Owner: Task 3, test `derives stock status from active variants only`.
4. **An empty section.** No kit or pre-order products means that section is not rendered at all, never as an empty heading. Owner: Task 5, test `omits a section with no products`.
5. **English without an `en` row.** `/en` shows the Thai name rather than an empty card. Owner: Task 3, test `falls back to the th name when en is missing`.
6. **A product URL that should not open.** A malformed uuid, an unknown id, or a hidden product (inactive, `UNLIST`) gives 404 and never throws. Owner: Task 6, test `returns null for a hidden, unknown or malformed product id`.
7. **A sold-out option combination.** In the picker, a combination whose variant is out of stock is still selectable but marked sold out, and a combination with no active variant is disabled. Owner: Task 6, test `marks sold-out and missing combinations`.

---

## File map

| File | Responsibility | Task |
| :--- | :--- | :--- |
| `docs/**`, `CLAUDE.md` | Scope decision, glossary, structure | 1 |
| `postcss.config.mjs`, `src/app/globals.css` | Tailwind and the design tokens | 2 |
| `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/proxy.ts`, `next.config.ts` | next-intl locale routing | 2 |
| `messages/th.json`, `messages/en.json`, `src/i18n/messages.test.ts` | Message catalogues and their key-parity test | 2 |
| `src/app/[locale]/layout.tsx` | Root layout, `<html lang>`, provider | 2 |
| `src/server/repositories/catalogue/storefront-repository.ts` | One query for landing-page rows | 3 |
| `src/server/services/catalogue/landing-catalogue-service.ts` (+ `.test.ts`) | Visibility rule, card derivation, sections | 3 |
| `tests/integration/catalogue/storefront-repository.test.ts` | Query against real PostgreSQL | 3 |
| `src/server/repositories/catalogue/activation-repository.ts`, `scripts/catalogue-activate.ts`, `package.json` | Development activation command | 4 |
| `src/components/domain/{PriceDisplay,StockBadge,ProductCard}.tsx` | Shared domain components | 5 |
| `src/app/[locale]/(shop)/page.tsx`, beside-route components | The landing page | 5 |
| `src/server/repositories/catalogue/storefront-repository.ts` (extend), `src/server/services/catalogue/product-detail-service.ts` (+ `.test.ts`) | One product's detail | 6 |
| `src/app/[locale]/(shop)/products/[productId]/page.tsx`, beside-route components | The product page | 6 |

---

### Task 1: Record the scope and names

**Files:** Modify `docs/11-decisions.md`, `docs/02-scope-and-phases.md`, `docs/12-glossary.md`, `docs/04-tech-stack-and-structure.md`, `CLAUDE.md`.

- [ ] **Step 1:** Add D-117 to `11-decisions.md`: the landing page showing mirrored products and stock is built before the rest of phase 3, on the owner's request of 2026-10-28, as plan 011; the visibility rule is unchanged, and a development-only command activates synced products until plan 002's admin screens exist. Owning doc: `02-scope-and-phases.md`, where a short note goes under Phase 3 naming plan 011 and what it does **not** deliver (REQ-001/002/003).
- [ ] **Step 2:** Glossary rows (check each against existing rows first; extend rather than duplicate):
  - landing catalogue: `getLandingCatalogue`, `LandingCatalogue`, `LandingProductCard`
  - storefront visibility rule: name the existing rule; identifier `isStorefrontVisible`
  - `pickProductName`
  - `PriceDisplay`, `StockBadge`, `ProductCard` (07 already names the first two; add identifiers)
  - the activation command `catalogue:activate`
- [ ] **Step 3:** In `CLAUDE.md` *Current state*, change the implementation sentence so that plan 011 is allowed alongside plan 010. In `04`, add `messages/` and `src/i18n/` as built.
- [ ] **Step 4:** Commit: `docs: record the landing page as plan 011 (D-117)`.

### Task 2: Tailwind, next-intl and the locale layout

**Files:** Create `postcss.config.mjs`, `src/app/globals.css`, `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/proxy.ts`, `messages/th.json`, `messages/en.json`, `src/i18n/messages.test.ts`, `src/app/[locale]/layout.tsx`. Modify `next.config.ts` (wrap with `createNextIntlPlugin`), `package.json`.

**Interfaces:** Produces `routing` (`locales: ['th', 'en']`, `defaultLocale: 'th'`, `localePrefix: 'always'`), and message namespaces `shop.header`, `shop.home`, `shop.product`, `shop.footer`.

- [x] **Step 1: Write the failing test** `src/i18n/messages.test.ts`:
  - `every key in th.json exists in en.json and the reverse`: flatten both to dot paths and compare the sets.
  - `no message is an empty string`.
- [x] **Step 2:** Run `npx vitest run src/i18n/messages.test.ts`. Expect FAIL (no files).
- [x] **Step 3:** Install the pinned packages. Then wire next-intl per its App Router guide: routing, request config, `proxy.ts` (the matcher excludes `/api`, `/_next` and files with an extension), the plugin in `next.config.ts`, and `[locale]/layout.tsx`. The layout sets `<html lang={locale}>`, gives `notFound()` for an unknown locale, and wraps children in `NextIntlClientProvider`.
- [x] **Step 4:** `globals.css` holds `@import "tailwindcss";` and an `@theme` block with the design's tokens, copied from `design/css/style.css` `:root`: colours `primary`, `primary-dark`, `primary-deep`, `primary-soft`, `accent`, `accent-dark`, `accent-soft`, `danger`, `success`, `success-soft`, `text`, `text-muted`, `text-subtle`, `bg`, `bg-subtle` and `border`; the font stack; the radius values; and the card and hover shadows. The base `line-height` is suited to Thai.
- [x] **Step 5:** Write `th.json` / `en.json` with every string on the page. Thai text comes from `design/index.html` as written; English is the plain equivalent. The header, hero, trust blurbs, section titles, stock labels ("มีสินค้า" / "สินค้าหมด"), the "from" price prefix, badges ("ชุดโปรโมชั่น", "พรีออเดอร์"), the release-date label and the footer are all messages.
- [x] **Step 6:** Run the test: PASS. Run `npm run build`: it succeeds. `curl -sI http://localhost:3002/` shows a redirect to `/th`, and `/api/jobs/shopee-sync` is unaffected (still `401` without a secret).
- [x] **Step 7:** Commit: `feat: add Tailwind, next-intl and the locale layout`.

### Task 3: The landing catalogue read

**Files:** Create `src/server/repositories/catalogue/storefront-repository.ts`, `src/server/services/catalogue/landing-catalogue-service.ts`, `src/server/services/catalogue/landing-catalogue-service.test.ts`, `tests/integration/catalogue/storefront-repository.test.ts`. Modify `src/server/composition-root.ts` (add `getLandingCatalogueReader()`).

**Interfaces:**
- Repository: `listStorefrontCandidates(): Promise<StorefrontCandidate[]>`. It returns every product whose `channel_item.external_status = 'NORMAL'` and `product.is_active` is true, with:
  - its `th` and `en` translations
  - the position-0 image URL
  - `channel_item.is_kit` and `sales_count`
  - `is_pre_order` and `release_date`
  - its variants (`price_satang`, `original_price_satang`, `stock_quantity`, `is_active`)
- `StorefrontCandidate` is a plain type declared in the service file and implemented by the repository, so the service imports nothing from Prisma. Bigints become `bigint`.
- Service, all pure except the last:
  - `isStorefrontVisible(c): boolean`: the spec §5.3 rule, checked again in the service, so the repository's filter is not the only guard.
  - `pickProductName(c, locale): string`
  - `toLandingProductCard(c, locale): LandingProductCard`
  - `buildLandingCatalogue(candidates, locale): LandingCatalogue`
  - `getLandingCatalogue(deps: { listStorefrontCandidates }, locale): Promise<LandingCatalogue>`
- Types:
  - `LandingProductCard = { productId: string; name: string; imageUrl: string | null; priceSatang: bigint; originalPriceSatang: bigint | null; isPriceRange: boolean; stockStatus: 'in_stock' | 'out_of_stock'; isKit: boolean; isPreOrder: boolean; releaseDate: Date | null }`
  - `LandingCatalogue = { bestSellers: LandingProductCard[]; bundles: LandingProductCard[]; preOrders: LandingProductCard[] }`
- Section rules:
  - `bestSellers`: every visible product, by `sales_count` descending, with `null` last and ties by name, first 8.
  - `bundles`: `isKit`, same order, first 4.
  - `preOrders`: `isPreOrder`, by `release_date` ascending with nulls last, first 4.

- [x] **Step 1: Write the failing unit tests** in `landing-catalogue-service.test.ts`, with plain fixture candidates:
  - `hides products the visibility rule excludes`: inactive product, no active variant → absent from every section.
  - `derives the card price from the cheapest active variant`:
    - variants at 299000 and 459000 → `priceSatang 299000n`, `isPriceRange true`
    - one variant at 289000 with original 299000 → `originalPriceSatang 299000n`
    - original equal to the price → `null`
    - a cheaper *inactive* variant is ignored
  - `derives stock status from active variants only`:
    - active stocks [0, 0] → `out_of_stock`
    - [0, 3] → `in_stock`
    - an inactive variant at 5 with the active ones at 0 → `out_of_stock`
  - `falls back to the th name when en is missing`: `en` gives the `th` name when there is no `en` row; `en` gives the `en` name when there is one.
  - `orders best sellers by sales and caps each section`: 10 candidates → 8, highest `salesCount` first, `null` last.
  - `puts kits in bundles and pre-orders in preOrders by release date`.
- [x] **Step 2:** Run `npx vitest run src/server/services/catalogue/landing-catalogue-service.test.ts`. Expect FAIL.
- [x] **Step 3:** Implement the service. Then implement the repository as one Prisma query, and wire `getLandingCatalogueReader()` in the composition root, returning `(locale) => getLandingCatalogue({ listStorefrontCandidates }, locale)`.
- [x] **Step 4: Write the integration test** `storefront-repository.test.ts`. Seed with the existing `tests/integration/fixtures/snapshots.ts` via `upsertCatalogueItem`, then flip `is_active` with Prisma in the test:
  - `returns only active NORMAL products with their variants`: an inactive product is absent, an `UNLIST` one is absent, an active NORMAL one is present with every variant.
  - `returns the position-0 image and both translations`.
- [x] **Step 5:** Run `npm test` and `npm run test:integration`. All pass.
- [x] **Step 6:** Commit: `feat: add the landing catalogue read service`.

### Task 4: Development activation command

**Files:** Create `src/server/repositories/catalogue/activation-repository.ts`, `scripts/catalogue-activate.ts`. Modify `package.json`. Test: `tests/integration/catalogue/activation-repository.test.ts`.

**Interfaces:** `activateSyncedProducts(): Promise<number>`. It sets `is_active = true` on every product whose `channel_item.external_status = 'NORMAL'` and that has at least one active variant, and returns the count changed. It never deactivates anything.

- [ ] **Step 1: Write the failing integration tests:**
  - `activates NORMAL products with an active variant and returns the count`
  - `leaves UNLIST and NOT_FOUND products inactive`
  - `is idempotent: a second call returns 0`
- [ ] **Step 2:** Run it: FAIL.
- [ ] **Step 3:** Implement the repository function. The script refuses to run when `NODE_ENV=production`, prints only the count, and runs through the npm script `catalogue:activate`. That script uses Node's `--env-file=.env` and the same TypeScript execution approach as the integration tests; if none fits, use `vitest`'s runner via a dedicated config rather than adding a new dependency.
- [ ] **Step 4:** Run the tests: PASS. Commit: `feat: add a development command that activates synced products`.

### Task 5: The landing page

**Files:**
- Create `src/components/domain/PriceDisplay.tsx`, `StockBadge.tsx`, `ProductCard.tsx`.
- Create `src/app/[locale]/(shop)/page.tsx`, plus beside-route components in `src/app/[locale]/(shop)/_components/`: `SiteHeader`, `Hero`, `TrustStrip`, `ProductSection`, `SiteFooter`.
- Tests: `src/components/domain/PriceDisplay.test.tsx`, `src/app/[locale]/(shop)/_components/ProductSection.test.tsx`.
- Modify: `vitest.config.ts`. Include `src/**/*.test.tsx` and set `esbuild: { jsx: 'automatic' }` so the tests can render JSX.

**Interfaces:** Consumes `getLandingCatalogueReader()` and `LandingProductCard`.
- `PriceDisplay({ satang, original?, isRange? })` formats with `Intl.NumberFormat(locale, { style: 'currency', currency: 'THB' })`.
- `StockBadge({ status })`.
- `ProductCard({ card })`.
- `ProductSection({ titleKey, cards })` returns `null` when `cards` is empty.

- [ ] **Step 1: Write the failing tests:**
  - `PriceDisplay formats satang as baht`: `299000n` gives text containing `2,990`; a range shows the "from" message.
  - `omits a section with no products`: `ProductSection` with `[]` renders nothing.
  - Render with `react-dom/server`'s `renderToStaticMarkup` inside `NextIntlClientProvider` with the real `th.json`, so no new testing dependency is needed.
- [ ] **Step 2:** Run them: FAIL.
- [ ] **Step 3:** Build the page to match `design/index.html`'s structure and look, in Tailwind:
  - header with logo (`design/assets/logo-mark.png`, copied to `public/`) and the language switch
  - hero
  - trust strip
  - ชุดโปรโมชั่น, สินค้าขายดี and พรีออเดอร์ sections
  - footer
  - Leave out exactly what the Global Constraints exclude.
  - The page is `force-dynamic`, and reads `getLandingCatalogueReader()(locale)`.
  - When every section is empty, show one empty-state message from the catalogue: no products are on sale yet.
- [ ] **Step 4:** Run `npm test`, `npm run typecheck` and `npm run build`. All pass.
- [ ] **Step 5:** Commit: `feat: render the landing page from the catalogue mirror`.

---

### Task 6: The product page

**Files:**
- Modify `src/server/repositories/catalogue/storefront-repository.ts` (add `findStorefrontProduct`), `src/server/composition-root.ts` (add `getProductDetailReader()`), and `src/components/domain/ProductCard.tsx` (link to the product page).
- Create `src/server/services/catalogue/product-detail-service.ts` and its `.test.ts`, `tests/integration/catalogue/product-detail.test.ts`, and `src/app/[locale]/(shop)/products/[productId]/page.tsx`.
- Beside-route components in `products/[productId]/_components/`: `Breadcrumb`, `Gallery` (client, thumbnails switch the main image), `VariantPicker` (client), `ServicePanel`, `ProductTabs` (description and spec only).
- Messages: `shop.product.*` in both catalogues.

**Interfaces:**
- Repository: `findStorefrontProduct(productId: string): Promise<StorefrontProductRow | null>`. It returns the product with:
  - both translations
  - all images by `position`
  - option types and values by `position`
  - every variant with its option value ids
  - `brand_name` and `shipping_size_tier`
  - `channel_item.external_status`
  - `is_pre_order` and `release_date`
  - It returns `null` for a malformed uuid without querying.
- Service:
  - `getProductDetail(deps: { findStorefrontProduct }, productId, locale): Promise<ProductDetail | null>` returns `null` unless `isStorefrontVisible` (Task 3) holds.
  - `ProductDetail = { productId; name; description; brandName: string | null; imageUrls: string[]; optionTypes: { id; name; values: { id; value }[] }[]; variants: { variantId; optionValueIds: string[]; priceSatang: bigint; originalPriceSatang: bigint | null; stockStatus: 'in_stock' | 'out_of_stock' }[]; defaultVariantId: string; isPreOrder; releaseDate: Date | null; shippingSizeTier: 'small' | 'medium' | 'large' | null }`.
  - `variants` holds active variants only.
  - `defaultVariantId` is the cheapest in-stock active variant, else the cheapest active one.
  - Name and description go through `pickProductName` and the same fallback for the description.
- `VariantPicker` gets `optionTypes` and `variants`. For each value it computes whether the selection with that value has an active variant (disabled when not) and whether that variant is sold out (labelled with the sold-out message). It shows the chosen variant's `PriceDisplay` and `StockBadge`.

- [ ] **Step 1: Write the failing unit tests** in `product-detail-service.test.ts`:
  - `returns null for a hidden, unknown or malformed product id`: inactive gives `null`; `UNLIST` gives `null`; a repository `null` gives `null`.
  - `keeps active variants only and picks the cheapest in-stock one as default`.
  - `falls back to the th name and description when en is missing`.
  - `orders images, option types and values by position`.
- [ ] **Step 2: Write the failing picker test** `VariantPicker.test.tsx`, using the SSD shape (2 capacities × 2 colours). It renders with `renderToStaticMarkup`:
  - `marks sold-out and missing combinations`: a sold-out variant's value carries the sold-out text; a value with no active variant for the current selection is `disabled`.
- [ ] **Step 3:** Run them: FAIL.
- [ ] **Step 4:** Implement the repository function, the service and the page, laid out as in `design/product.html`:
  - breadcrumb: home › product name (no category until categories exist)
  - gallery
  - buy box: name, price, stock, VAT note, picker
  - service panel: the shipping, tax invoice and store blurbs from the design
  - description tab: plain text, line breaks kept (`whitespace-pre-line`), never rendered as HTML
  - spec tab: brand, and shipping size when set
  - The page is `force-dynamic` and calls `notFound()` when the service returns `null`.
  - `ProductCard` links to `/{locale}/products/{productId}`.
- [ ] **Step 5: Integration test** `product-detail.test.ts`:
  - `finds an active product with its variants and option links`: the two-tier fixture gives 4 variants, each with 2 option value ids.
  - `returns null for a malformed id without throwing`.
- [ ] **Step 6:** Run `npm test`, `npm run test:integration`, `npm run typecheck` and `npm run build`. All pass.
- [ ] **Step 7:** Commit: `feat: add the product page from the catalogue mirror`.

## Manual test checklist

Run by a person against the sandbox data. Never tick a box for a check nobody performed.

- [ ] Run `npm run catalogue:activate`, then open `/th`. The synced products show in สินค้าขายดี, each with its name, image, price and stock status. Mario Kart (unlisted) is absent.
- [ ] Open `/en`. All page text is English, and the product names fall back to Thai.
- [ ] Change a price and stock to 0 in the sandbox, sync, and reload. The card shows the new price and "สินค้าหมด".
- [ ] At 360px wide, nothing scrolls sideways, and Thai text wraps without clipping.
- [ ] `/` redirects to `/th`, and `/api/docs` and `/api/jobs/shopee-sync` still work.
- [ ] Tab through the page. Every link has a visible focus ring.
- [ ] Click the SSD card. The product page shows 4 images or the placeholder, Capacity and Colour pickers, and price and stock per choice. Choosing 2TB updates the price to 4,590.
- [ ] Set one SSD variant's stock to 0 in the sandbox and sync. That choice shows "สินค้าหมด".
- [ ] Open `/th/products/not-a-uuid` and Mario Kart's product URL (unlisted). Both show 404.

## Not in this plan

Category, search, cart and checkout pages; add to cart; sign-in; ratings and reviews; related products; news; banners managed by staff; the admin activation screen (plan 002).

## Outcome

Not started.
