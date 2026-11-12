# 015 — Storefront redesign to `tinzshop-redesign/` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

- **Status:** Not started — opened 2026-11-12 on the project owner's request of 2026-11-12
- **Phase:** 3 (storefront), an early slice like plans 011 to 014
- **Requirements touched:**
  - REQ-007 (Thai and English) and REQ-009 (mobile-first): every restyled page, in both languages, from 360px up.
  - REQ-006: stock is still shown as in stock or out of stock only.
  - REQ-053 / D-161: sign-in still gates the product pages.
  - No requirement is newly delivered. This plan changes how the existing pages look, not what they do.
- **Depends on plans:** 011 (home, product page), 012 (news), 013 (listing), 014 (sign-in pages, header account menu). Plan 014 is not merged yet, so this branch merges after it.
- **Blocked by:** nothing for the restyle itself. Q-062 and Q-063 (UNRESOLVED, added 2026-11-12) block only the entries and phrases this plan leaves out or keeps inert; see *Plan rulings* R5.
- **Design:** `tinzshop-redesign/`, as recoloured and corrected on 2026-11-12. `_build.mjs` is the source of every page (the `.html` files are its output); the look is `css/style.css`; the mockup's own interactions are `js/app.js`. Line references below (`style.css` L*n*, `_build.mjs` L*n*) are to those files as they stand on 2026-11-12. `design/` stays in the repository as the record of plans 011 to 014 and is no longer the reference.
- **Branch:** `feat/win/storefront-redesign`, cut from `feat/win/customer-auth`

**Goal:**
- The storefront pages that exist today look like `tinzshop-redesign/`: the shared shell, home, the product listing, the product page, the news pages and the four sign-in pages.
- The base colours are the shop's own blue and yellow from the old tinzshop.com site and the logo (navy `#0E1B4D`, blue `#1863DC`, yellow `#FEA601`), not the mockup's original navy and orange (project owner's instruction, before the 2026-11-12 review).
- Headings in Anuphan and body text in IBM Plex Sans Thai, served from our own files.
- Nothing a customer can do today stops working, and nothing on screen is made up.

**Owner's request (2026-11-12):** "implement it, change the current code into tinzshop-redesign".

**Architecture:**
- **No new routes and no server change** except the landing page's section limits (R9). Every page keeps its Server Component, its reads and its gating.
- **Tokens** live once, in `src/app/globals.css` (`@theme`), named after the mockup's own CSS variables so a reviewer can match `style.css` to a class.
- **Fonts** are four `next/font/local` families in `src/app/_fonts/fonts.ts`, set as CSS variables on `<html>` in `src/app/[locale]/layout.tsx`.
- **New tier-1 primitives** (`src/components/ui/`): `buttonClass` (the mockup's `.btn` variants as one class builder), `Breadcrumbs` (the mockup's `.crumbs`, now used by four routes) and `useModalDialog` (the focus trap the mobile menu and the filter sheet share).
- **One new tier-2 helper** (`src/components/domain/platform-tone.ts`): which platform colour a category slug gets.
- **Client Components added:** `MobileMenu` (the phone drawer). Every other client part already exists (`SearchForm`, `AccountMenu`, `ArticlesMenu`, `ListingControls`, `VariantPicker`, `Gallery`, `ProductTabs`, `NewsTabsScroller`, `AuthForm`).

**Tech stack:** Next.js 16 App Router, Tailwind 4 (`@theme`, `@utility`), next-intl, `next/font/local` (part of Next; no new dependency).

## Page map

What each mockup block becomes. "Left out" blocks are not rendered at all; "inert" means rendered as designed, going nowhere (D-124).

| Mockup block (`_build.mjs`) | App component | New or existing |
| :--- | :--- | :--- |
| Skip link, top bar (L126–136) | `SiteHeader` (`TopBar` local part), `ArticlesMenu` kept inside it | existing, restyled |
| Header row: menu button, logo, search, account, wishlist, cart (L137–152) | `SiteHeader`, `SearchForm`, `AccountMenu` | existing, restyled |
| Category nav (L153–155) | `SiteHeader` (`NavLink`) | existing, restyled |
| Mobile drawer (L157–165) | `MobileMenu` | **new** (client) |
| Footer (L167–187) | `SiteFooter` | existing, rewritten |
| Breadcrumb (L195) | `Breadcrumbs` (ui), used by the product, listing, news and auth pages | **new** primitive |
| Home hero with feature card and minis (L207–237) | `Hero` | existing file, rewritten |
| Platform tiles (L238–240) | `PlatformTiles` | **new** (replaces `CategoryShowcase`) |
| "ชุดโปรโมชั่นพร้อมเล่น" (L242–245) | `ProductSection id="bundles"` | existing, restyled |
| Platform banners (L247–255) | `PlatformBanners` | **new** |
| Best sellers with chips (L257–261) | `ProductSection id="bestSellers"` with `filterLinks` | existing, restyled |
| "ทำไมเกมเมอร์ซื้อกับ Tinzshop" (L273–281) | `Reasons` | **new** (replaces `TrustStrip`) |
| LINE consult band (L283–296) | `ConsultBand` | **new** |
| "ข่าวเกมล่าสุด" (L298–304) | `NewsCardSection` | existing, restyled in Task 7 |
| Product card (L84–96) | `ProductCard`, `PriceDisplay`, `StockBadge`, `ProductBadge`, `ImagePlaceholder` | existing, restyled |
| Listing head, subcategory tiles, filters, toolbar, active chips, grid, pager (L334–362) | `ProductListingView`, `ListingControls`, the news `Pagination` | existing, restyled |
| Product page: gallery, buy box, options, buy row, assurances, ask block (L372–407) | `Gallery`, `ProductHeading`, `VariantPicker`, `BuyActions`, `ServicePanel` | existing, restyled |
| Product tabs (L409–434) | `ProductTabs` (a fourth tab added) | existing, restyled |
| Related products (L436–437) | `ProductSection id="related"` | existing, restyled |
| Phone buy bar (L441) | `VariantPicker` (it owns the chosen price) | existing, extended |
| News head with chips, feature, grid, pager, sidebar (L601–622) | `NewsListView`, `NewsTabs`, `NewsTabsScroller`, `NewsFeature`, `NewsGrid`, `NewsCard`, `Pagination`, `NewsSidebar` | existing, restyled |
| (no mockup) news article page | `NewsArticleView`, `ArticleBody` | existing, restyled with the tokens |
| Sign-in and register: card and perks panel (L627–683) | `AuthShell`, `AuthCard`, `AuthField`, `AuthForm`, `GoogleButton`, `AuthNotice`, `AuthPerks` | existing, restyled; `AuthPerks` **new** |
| (no mockup) verify, forgot password | the same card, without the perks panel | existing, restyled |

**Left out, with the reason:**

| Mockup block | Why |
| :--- | :--- |
| Mockup notice bar and "ตัวอย่างงานออกแบบ" in the copyright | Mockup only (as D-124) |
| Pre-order list with release dates and deposits (L263–271) | Pre-order and deposits are plan 005; the deposit percentage is Q-041 |
| Store-visit block with map, address and hours (L306–328) | Address and hours are unknown (REQ-045) |
| The consult band's LINE chat sample (L292–293 bubbles) | A made-up conversation with a made-up price |
| LINE handle anywhere | Unknown; every LINE button is inert and shows no handle |
| Review stars, scores, counts, sample reviews, "อ่านรีวิวจากลูกค้า" link (L382, L426) | Only our own reviews, none exist (D-098, spec O-6); the reviews tab stays an empty state |
| "สั่งจากตัวแทน" stock state and filter (L81, L341) | REQ-006 allows in stock or out of stock only; dropship is plan 005 |
| "โซนแผ่นเกม" filter group (L345) | No such data |
| "ผ่อนบัตรเครดิตผ่าน K-Payment ได้" on cards priced ฿10,000 or more (L93) | The ฿10,000 threshold is not a known rule |
| Model code "รหัสรุ่น" on the product page (L382) | The product detail read carries no SKU; out of scope |
| "ข่าวเกี่ยวกับ PS5" on the product page (L438–439) | Nothing links a product's platform to news categories |
| "อ่านมากที่สุด" news ranking (L618) | Nothing records popularity (D-137) |
| Registration fine print (L674) | It points at terms and privacy pages that do not exist (REQ-043) and a PDPA page that does not exist (REQ-046) |
| Add-to-cart toast (L188) | No cart |
| Cart, checkout, account, warranty pages | Later plans; their links stay inert (D-124) |

## Global Constraints

- **Build only what this plan lists.** No cart, checkout, account, warranty or order page. No new route, table, param or read, except R9's landing limits.
- **D-124 still holds** apart from its choice of design file: an inert control looks exactly as designed and goes nowhere (a link to `#`, a button `type="button"`), a link goes to the real page where one exists, and **never a made-up number** (the cart count is `0`). Prices, stock, names and images still come from the Shopee mirror (plans 010 to 013); the mockup's drawn product icons appear only where a product has no image, through `ImagePlaceholder`.
- **Keep every behaviour already built:** sign-in gating of `/product` and `/product/{id}/detail` with `returnTo` (D-161); the auth forms' Server Actions, real `<form action>`s, field echo and notices (D-182 to D-187); the live password rule ticks and confirm tick (D-189); the listing's URL contract, filters, sort, grid/list switch and pagination (D-145 to D-148); the variant picker's rules (D-121); news tabs, counts, scroller and pagination (D-137, D-141); the articles menu (D-140); the account menu (D-170); D-118's money and date formatting and the TH/EN switch at every width; the site 404s (D-120, D-122).
- **Text:** every string is a message key in both `messages/th.json` and `messages/en.json` (D-032). Thai is copied exactly from `_build.mjs` except where R5 cuts or renames a phrase; English is the plain equivalent. A sentence with a link or bold part is one key with rich tags (`t.rich`), never fragments joined together. A task that removes the last user of a key deletes the key from both files.
- **No arbitrary breakpoints.** Use `sm` `md` `lg` `xl` only, never `min-[…px]:` (07). Mobile-first: base styles are the phone.
- **Arbitrary colour values** (`bg-[#…]`) are allowed only for the one-off art tints listed below, each in the one file that owns it. Everything else uses a token.
- **Tap targets:** every link and control that is not inside running text is at least 44px tall below `sm` (R16), and keeps a visible focus ring.
- **Layers:** `src/components/ui/` imports nothing from `src/server/` or `src/app/`; pages keep reading through the composition root.

### Tokens (`src/app/globals.css`)

Copied from `tinzshop-redesign/css/style.css` `:root` (L22–37). The Tailwind name is the mockup's variable name, except `--bg`, which becomes `page` so it cannot be confused with the retired `bg` (white).

```css
@theme {
  /* surfaces and text */
  --color-page: #f4f5f7;         /* mockup --bg */
  --color-surface: #ffffff;
  --color-sunk: #edeff2;
  --color-ink: #10141c;
  --color-ink-2: #394150;
  --color-muted: #636b7a;
  --color-line: #e1e4ea;         /* borders, not the LINE app */
  --color-line-2: #cdd2da;
  /* the shop's blue and yellow (owner) */
  --color-navy: #0e1b4d;
  --color-navy-2: #142867;
  --color-navy-3: #1d3a8a;
  --color-on-navy: #e9edf5;
  --color-on-navy-2: #a9b4c8;
  --color-brand: #1863dc;
  --color-brand-dark: #0056a7;
  --color-brand-soft: #e8f0fd;
  --color-accent: #fea601;
  --color-accent-2: #ffb733;
  --color-accent-press: #e08f00;
  --color-accent-soft: #fff4dc;
  /* platforms, only as small tags, dots and tints */
  --color-ps: #0b5fd0;  --color-ps-soft: #e7f0fc;  --color-ps-ink: #08489e;
  --color-ns: #e4002b;  --color-ns-soft: #fde8ec;  --color-ns-ink: #b00022;
  --color-it: #0e8f7e;  --color-it-soft: #e2f5f2;  --color-it-ink: #086b5e;
  --color-other: #7a8394;
  /* status */
  --color-ok: #0b7d44;  --color-ok-soft: #e6f5ec;  --color-ok-ink: #0a5a33;
  --color-sale: #d12a1c;
  --color-warn: #9a5b00;  --color-warn-soft: #fff4dc;
  /* the LINE app's green, with dark text (R16) */
  --color-line-app: #06c755;
  --color-line-app-hover: #05b04b;
  --color-line-app-soft: #e9f9f0;

  --radius-sm: 8px;    /* mockup --r-sm */
  --radius-md: 12px;   /* mockup --r */
  --radius-lg: 18px;   /* mockup --r-lg */
  --radius-xl: 22px;   /* feature card, gallery stage, banners, auth card */
  --radius-2xl: 28px;  /* consult band */

  --shadow-1: 0 1px 2px rgba(16, 20, 28, 0.06), 0 1px 1px rgba(16, 20, 28, 0.04);
  --shadow-2: 0 10px 30px -12px rgba(16, 20, 28, 0.22), 0 2px 6px rgba(16, 20, 28, 0.06);

  --ease-soft: cubic-bezier(0.2, 0.7, 0.2, 1);

  --text-xs--line-height: 1.65;
  --text-sm--line-height: 1.65;
  --text-base--line-height: 1.65;

  /* the mockup's edges (style.css L570–665), mobile-first (R4) */
  --breakpoint-sm: 40rem;      /* 640px */
  --breakpoint-md: 53.75rem;   /* 860px */
  --breakpoint-lg: 64rem;      /* 1024px */
  --breakpoint-xl: 73.75rem;   /* 1180px */
}

@theme inline {
  --font-head: var(--font-anuphan-latin), var(--font-anuphan-thai), var(--font-plex-latin), var(--font-plex-thai), system-ui, sans-serif;
  --font-body: var(--font-plex-latin), var(--font-plex-thai), var(--font-anuphan-latin), var(--font-anuphan-thai), system-ui, sans-serif;
}

@utility wrap {
  max-width: 1280px;
  margin-inline: auto;
  padding-inline: clamp(16px, 3.2vw, 32px);
}
```

- **Base layer:** `body` is `bg-page text-ink font-body`, `16px/1.65`, antialiased, `overflow-x: hidden`, `overflow-wrap: break-word`. `h1`–`h4` are `font-head`, `line-height: 1.25`, `letter-spacing: -0.005em`, bold unless a block says 600. `:focus-visible` is `3px solid var(--color-ps)`, offset 2px, radius 4px (style.css L53). `@media (prefers-reduced-motion: reduce)` turns off every animation and transition and smooth scrolling (style.css L667–669).
- **Retired tokens.** `primary`, `primary-dark`, `primary-deep`, `primary-soft`, `accent-dark`, `danger`, `success`, `success-soft`, `text`, `text-muted`, `text-subtle`, `bg`, `bg-subtle`, `border`, `--font-sans`, `--radius`, `--shadow-card`, `--shadow-hover` and `--breakpoint-xs`. Task 2 keeps the colour ones as aliases (pointing at the nearest new value, under a `/* retired — removed in Task 9 */` comment) so pages do not lose their colours between tasks; Task 9 deletes them and adds the guard test. The mapping a task uses when it touches a file: `primary`→`brand`, `primary-dark`→`brand-dark`, `primary-deep`→`navy`, `primary-soft`→`brand-soft`, `accent-dark`→`accent-press`, `danger`→`sale`, `success`→`ok`, `success-soft`→`ok-soft`, `text`→`ink`, `text-muted`→`ink-2`, `text-subtle`→`muted`, `bg`→`surface`, `bg-subtle`→`page`, `border`→`line`, `rounded-(--radius-sm)`→`rounded-sm`, `rounded-(--radius)`→`rounded-md`, `xs:`→`sm:` (only 3 uses).
- **Art tints** (arbitrary values allowed only in the file named):
  - `ImagePlaceholder.tsx`: the `.media` tones of style.css L160–168 (`ps`, `ns`, `it`, `other`, `dark`).
  - `PlatformTiles.tsx`: the six tile icon colours of `_build.mjs` L198–205.
  - `PlatformBanners.tsx`: the two banner gradients of style.css L261–262.
  - `Hero.tsx`: the hero backdrop of style.css L202–206.
  - `SiteHeader.tsx`: the top bar's green dot `#2bd576`.

### Shared class map

Mockup class → Tailwind, used by every task. Values are the mockup's.

| Mockup | Classes |
| :--- | :--- |
| `.wrap` | `wrap` |
| `.sec` | `py-[clamp(48px,6vw,80px)]` (`.sec--tight`: `py-[clamp(32px,4vw,48px)]`) |
| `.sec__head` | `mb-6 flex flex-wrap items-end justify-between gap-4 sm:flex-nowrap`; its `h2` `text-[clamp(24px,2.4vw,32px)] font-bold`; its `p` `mt-1.5 text-muted` |
| `.link` | `inline-flex min-h-11 items-center gap-1.5 font-semibold text-ink sm:min-h-0` with the underline-grow hover (`bg-[linear-gradient(currentColor,currentColor)] bg-[length:0_1.5px] bg-left-bottom bg-no-repeat hover:bg-[length:100%_1.5px]`) |
| `.btn` and variants | `buttonClass({ variant, size, block })` (Task 2) |
| `.chip` | `inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] border-line-2 bg-surface px-4 text-[14.5px] font-medium hover:border-ink sm:min-h-10`; current: `border-brand bg-brand text-white` |
| `.tag` | `ProductBadge` (Task 2) |
| `.stock` | `StockBadge` (Task 2) |
| `.card` | `ProductCard` (Task 2) |
| `.grid.g-5` | `grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-4 xl:grid-cols-5 md:max-xl:[&>*:nth-child(n+9)]:hidden` |
| `.grid.g-4` | `grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4` |
| `.grid.g-3` | `grid grid-cols-1 gap-2.5 sm:gap-4 md:grid-cols-3` |
| `.panel` | `rounded-lg border border-line bg-surface p-[18px] sm:p-6` |
| `.input` | `min-h-12 w-full rounded-sm border-[1.5px] border-line-2 bg-surface px-3.5 text-base focus:border-ink focus:outline-none` |
| `.select` | as `.input` at `min-h-11` with the chevron background of style.css L373 |
| `.check` | `flex min-h-11 cursor-pointer items-center gap-2.5 text-[15px] sm:min-h-10`; input `size-5 accent-ink` |
| `.eyebrow` | `inline-flex items-center gap-2 text-[13px] leading-none font-semibold tracking-[.06em] uppercase text-muted` |
| `.crumbs` | `Breadcrumbs` (Task 2) |
| `.pager` | the news `Pagination`: `min-w-11 h-11 rounded-sm border-[1.5px] border-line bg-surface`; current `bg-brand border-brand text-white` |

## Review Focus

1. **Nothing made up reaches the screen.** Search the rendered pages for: a cart count other than 0, a star, a review count, "เหลือน้อย" or any stock word but มีสินค้า / สินค้าหมด, "สั่งจากตัวแทน", a free-shipping threshold, "สัปดาห์นี้", "ซื้อคู่กันบ่อย", "ถูกกว่าซื้อแยก", "คุ้มกว่า", "Switch 2", "เครื่องประกันร้าน", "เลขพัสดุ", a LINE handle, "(รอข้อมูลจากร้าน)", "(เบอร์ร้าน)". Pinned by tests in Tasks 3, 4 and 9.
2. **The listing's filter sheet on a phone.** With the sheet open, ticking a checkbox navigates and the sheet stays open with focus on that checkbox; typing a price and pressing Enter keeps focus in the input (D-148 M4); Escape closes and returns focus to "ตัวกรอง"; widening the window past 1024px closes it and drops the dialog role. Pinned in Task 5.
3. **The sign-in forms still work before hydration and never put a secret in a URL,** now with the show/hide password button: it is `type="button"`, never submits, survives React's post-action reset (the field returns to hidden), and the live rule ticks (D-189) still read the typed value. Pinned in Task 8.
4. **The phone buy bar shows the chosen variant's price,** and changes with the picker; it never shows a price the picker does not (D-121, D-123). Pinned in Task 6.
5. **Fonts are ours and Thai is not clipped.** No request leaves the site for a font; Thai text uses Anuphan or IBM Plex Sans Thai, Latin text the Latin files; headings at `line-height: 1.25` do not clip stacked tone marks (check "ชิ้นใหญ่", "ผ่อนชำระ", "ปี่"). Checked in Task 9.
6. **Contrast and targets at 390px and 360px:** LINE buttons read ink on green (8.2:1), every link outside running text is at least 44px tall, nothing scrolls sideways, and the top bar and footer chips line up with the page gutter. Checked in Task 9.

## Plan rulings

Each is a plan ruling the developer builds to; the ones the owner's request decides are marked *owner*. Each becomes a D-row in Task 1.

- **R1, the design source (*owner*, D-190).** The storefront follows `tinzshop-redesign/` (as recoloured and corrected on 2026-11-12) instead of `design/`. This supersedes D-124's choice of design file and its list of what is left out; D-124's inert-control rule, its "never a made-up number" rule and its "data still comes from the database" rule stay.
- **R2, colours and token names (*owner* for the colours, D-191).** The tokens above, named after the mockup's variables. The old tokens are retired by Task 9.
- **R3, fonts (*owner*, D-192).** Anuphan (Cadson Demak) for headings and IBM Plex Sans Thai (IBM) for body text, both published under the SIL Open Font License 1.1, self-hosted from the mockup's woff2 files with `next/font/local`: no request to Google Fonts or any other host at runtime. The licence text of each family is committed beside the files, and `04` records the families, their licence and where the files came from. Each family is two `localFont` calls, a Thai subset and a Latin subset, each with the mockup's `unicode-range`, so a page downloads only the subsets its text uses.
- **R4, breakpoints (D-193).** The mockup's edges become the theme's breakpoints, mobile-first: `sm` 640px, `md` 860px, `lg` 1024px, `xl` 1180px; `xs` (480px) is removed. The mockup writes them as `max-width` (so exactly 640px is a phone there and `sm` here); the 1px difference at each edge is accepted. This supersedes the breakpoint bullet of 07's D-124 section. The grids are the class map's `g-5` (2 / 4 / 5 columns, cards 9 and 10 hidden between 860px and 1180px as the mockup does), `g-4` (2 / 3 / 4) and `g-3` (1 / 3).
- **R5, copy that is cut or renamed (D-190).** Thai is copied exactly except:
  - Every "Nintendo Switch 2" reads "Nintendo Switch", and every "Switch 2" reads "Switch", from `shop.category.switch` where it is the platform's name (Q-062).
  - "เครื่องเกมอื่น ๆ · ของเล่น", "สินค้าลดราคา", the tile "ลดราคา" and the banner link "เคส & ฟิล์ม" render inert at `#` (Q-062).
  - Left out (Q-063): "ราคาถูกกว่าซื้อแยก" (kits subtitle), "คุ้มกว่าซื้อแยก ฿790" (hero card), "คุ้มกว่า" (kits tile), "เครื่องประกันร้าน" (Switch banner), "แจ้งเตือนก่อนวันวางจำหน่ายและวันชำระส่วนที่เหลือ" (pre-order perk's line).
  - "สินค้าขายดีสัปดาห์นี้" reads "สินค้าขายดี": the best sellers are Shopee's sales count, not one week's.
  - "ซื้อคู่กันบ่อย" reads "สินค้าที่เกี่ยวข้อง": related products are best sellers, not bought-together data.
  - "เลขพัสดุ" is cut from the orders perk and "และแจ้งเลขพัสดุในคำสั่งซื้อเมื่อร้านส่งของ" from the shipping tab: a tracking number is not a core requirement (REQ-031, D-075).
  - The wishlist perk is left out: the wishlist is in the backlog with no phase (D-089).
  - "ถามพนักงานที่เล่น PS5 จริงทาง LINE" reads "ถามพนักงานที่เล่นเกมจริงทาง LINE", the wording of the mockup's own hero, since the product page is not always a PS5.
  - The facts the app already shows from the plan 011 design are kept as written: "หน้าร้านย่านสะพานเหล็ก" and "กว่า 20 ปี".
- **R6, the top bar (D-194).** It keeps the articles menu (D-140), first in its right-hand group, and the TH/EN switch, both visible at every width (D-118). "คำสั่งซื้อของฉัน", "ประกัน / เคลม" and "LINE ของร้าน" are inert and hidden below `md`, and repeated in the drawer. Below `sm` the message shows only its bold part, "ส่งทั่วประเทศไทย". The language switch looks like the mockup's "TH · EN" with a globe, built as now: the current language a `span aria-current="true"`, the other a `Link` with `hrefLang`, `lang` and its name as `aria-label`.
- **R7, search stays inert (D-194, D-124).** The form keeps `role="search"`, no `action` and `SearchForm`'s submit guard; the "ค้นหา" button is `type="button"`, so the existing test "no submit button" still holds.
- **R8, the nav and the drawer (D-194).** The nav is the mockup's (หน้าแรก, PlayStation 5, Nintendo Switch, IT Gadgets, พรีออเดอร์, ชุดโปรโมชั่น, เครื่องเกมอื่น ๆ · ของเล่น, สินค้าลดราคา, ข่าวเกม) with the platform dots. "หมวดหมู่ทั้งหมด" leaves the nav, as in the mockup; `/{locale}/product` stays reachable from the hero's "เลือกซื้อสินค้า", the listing's platform links (the current platform links back to all, D-148) and the product breadcrumb. Below `md` the nav is hidden and the menu button opens `MobileMenu`: a modal dialog (focus moves in, Tab stays in, Escape and the close button close it and return focus to the menu button, the page does not scroll behind it). Its sign-in entry shows only when signed out.
- **R9, the landing data (D-195).** The landing read changes its section limits to 10 best sellers and 5 kits (SQL in `listStorefrontCandidates` and the service constants); pre-orders stay 4 in the read, so at most 19 rows. The pre-order section is not rendered (plan 005 brings it back) and `shop.home.preOrders.title` is removed. The hero's feature card is the first kit; with no kit it is not rendered and the hero text spans the width. The three minis are the first three best sellers that are not the feature product. "เลือกซื้อสินค้า" links to `/{locale}/product` (supersedes D-118's "scrolls to the best sellers"); "สมัครสมาชิก" links to register and shows only when signed out. The welcome panel goes (supersedes D-185's greeting; the header already shows the name).
- **R10, best-seller chips are links (D-195).** "ทั้งหมด" is current (a `span aria-current="true"` drawn pressed); "PS5", "Switch" and "IT Gadgets" link to `?category={slug}&sort=best_selling`, a real page (D-124). A toggle that filtered on the page would need three more reads.
- **R11, the product card (D-196).** As the mockup's `.card`, with: the wishlist heart and the cart button inert (`type="button"`, no `aria-pressed`, labels naming the product); the cart button `disabled` with the label "สินค้าหมด" when out of stock; the "ลดราคา" tag and the red price only when the original price is above the price (the D-123 test); no category line (categories are a keyword mock, D-143, and the card's read model has none), no instalment line, no rating.
- **R12, the listing (D-197).**
  - Head: `h1` and the existing description with the count, "{description} · {count} รายการ".
  - Subcategory tiles: the existing type-kind tabs with counts (D-148), drawn as `.subcat` tiles with the art icons.
  - Filters: the existing groups (หมวดหมู่, สถานะสินค้า, ประเภทสินค้า, ช่วงราคา) as `<details open>` groups. From `lg` a sticky 268px column. Below `lg` a full-screen sheet behind "ตัวกรอง": a modal dialog only while open, closed on Escape, the close button, the "แสดง {count} รายการ" button, or widening past `lg`; each change still navigates at once, as built.
  - Price presets follow the mockup, in D-148's convention: ต่ำกว่า ฿2,000 = `max=1999`, ฿2,000–10,000 = `min=2000&max=9999`, มากกว่า ฿10,000 = `min=10000`. Supersedes D-148's four presets.
  - Toolbar: "แสดง {from}–{to} จาก {total} รายการ"; sort select; the grid/list switch is kept from `sm` (the mockup has none).
- **R13, the product page (D-198).**
  - Two columns from `lg` (gallery sticky, buy box).
  - The buy box: a platform tag "{platform} · {type}" from the breadcrumb data (left out with no platform), the kit and pre-order badges, the `h1`, the price box, the options as the mockup's `.opt` chips, the buy row, four assurances and the LINE ask block.
  - `ServicePanel` becomes the assurances and the ask block. The K-Payment chips, store blurb, rate link and contact line go.
  - `BuyActions` keeps the stepper, "ใส่ตะกร้า" and "ซื้อเลย", all inert, and loses wishlist and share (not in the design).
  - Tabs: a fourth tab, "การจัดส่งและรับประกัน", holds the mockup's static text; its warranty link is inert. The reviews tab is the empty state with an inert "เขียนรีวิว".
  - Related products: 5 best sellers, `g-5`, still titled "สินค้าที่เกี่ยวข้อง", with "ดูทั้งหมด" to `?sort=best_selling`.
  - The phone buy bar (below `sm`) is rendered by `VariantPicker`, with the chosen price and an inert "ซื้อเลย".
- **R14, news (D-199).**
  - Head: `h1` with the tabs drawn as the mockup's chips; counts and the scroller are kept.
  - Feature block: the mockup's `.nfeat`.
  - "ข่าวล่าสุด" grid: 1 column, 2 from `sm` (the mockup's inline 2 columns would squeeze a phone).
  - Sidebar from `lg`, 320px: the categories panel (D-137) and the pre-order panel, whose button now links to `?pre_order=1`, a real page (supersedes D-137's inert button). Its text stays the existing keys; the mockup's "เปิดจองแล้ว" and "วางมัดจำก่อนได้" are left out (whether any pre-order is open is data, deposits are plan 005).
  - Every news tag uses one neutral tone (`other`): mapping news categories to platforms would hard-code slugs.
  - News images are 16:9.
- **R15, the sign-in pages (D-200).**
  - Sign-in and register: a breadcrumb, then the card (560px) beside the navy perks panel from `lg`, stacked below it. Verify and forgot password: the card alone, centred, 560px.
  - Under the title, "ยังไม่มีบัญชี? สมัครสมาชิก" / "มีบัญชีอยู่แล้ว? เข้าสู่ระบบ" replaces the top-right link (supersedes that part of D-170). Verify and forgot keep their description line.
  - "ลืมรหัสผ่าน?" sits below the password field, right-aligned. It keeps `returnTo` (D-187).
  - Every password field gets a "แสดง" / "ซ่อน" button (`type="button"`, `aria-pressed`, label "แสดงรหัสผ่าน" / "ซ่อนรหัสผ่าน").
  - Buttons: sign-in submits with the `brand` button, register with the `buy` button.
  - Google: "เข้าสู่ระบบด้วย Google" on sign-in, "สมัครด้วย Google" on register.
  - The register email field gets the hint "ใช้รับอีเมลยืนยันคำสั่งซื้อและใบกำกับภาษี".
- **R16, accessibility fixes over the mockup (D-201).**
  - The LINE green `#06C755` carries ink text (8.2:1), never white (2.26:1).
  - Every link and control outside running text is at least 44px tall below `sm`: top bar links, breadcrumbs (mockup 32px), chips (40px), active-filter chips (36px), filter checks and summaries, banner links (40px), footer links (36px), section "view all" links. The show-password button keeps its 36px look with a 44px hit area.
  - At 390px, the top bar's content and the footer's payment chips sit on the `wrap` gutter; chips wrap whole, and the copyright drops to its own row.
- **R17, cost if any ruling is wrong:** a message key or a class string; no data or route depends on these.

---

### Task 1: Docs, decisions and names

**Files:** `docs/11-decisions.md`, `docs/07-frontend-components.md`, `docs/04-tech-stack-and-structure.md`, `docs/12-glossary.md`, `docs/02-scope-and-phases.md`, `CLAUDE.md`. (`docs/13-open-questions.md` already has Q-062 and Q-063, added by the planner on 2026-11-12.)

- [ ] **D-rows D-190 to D-201** in a new section of `11-decisions.md`, "Storefront redesign (owner, 2026-11-12)", before *Deployment*, with one intro line naming the owner's request and this plan:
  - D-190 R1 and R5 (design source; what is left out or cut, and why)
  - D-191 R2 (colours, the owner's blue and yellow; token names)
  - D-192 R3 (fonts, OFL 1.1, self-hosted, `next/font/local`)
  - D-193 R4 (breakpoints and grids)
  - D-194 R6 to R8 (top bar, header, search, nav, drawer, footer)
  - D-195 R9 and R10 (home layout and the landing limits)
  - D-196 R11 (product card)
  - D-197 R12 (listing)
  - D-198 R13 (product page)
  - D-199 R14 (news)
  - D-200 R15 (sign-in pages)
  - D-201 R16 (accessibility fixes)
- [ ] **Mark superseded rows** (status column), each pointing at its successor:
  - D-124 → "Superseded in part — see D-190, D-193" (design file, the left-out list, the breakpoints; the inert-control rule stays)
  - D-118 → "Superseded in part — see D-195" (the hero's "shop now")
  - D-137 → "Superseded in part — see D-199" (the pre-order panel's button)
  - D-147 → "Superseded in part — see D-195" (the landing limits, 8 and 6, become 10 and 5; at most 19 rows)
  - D-148 → "Superseded in part — see D-197" (the four price presets and the mobile filter panel)
  - D-170 → "Superseded in part — see D-200" (the centred `max-w-sm` card in the `design/` theme; the header part stays)
  - D-185 → "Superseded in part — see D-195" (the home welcome panel's greeting)
- [ ] **`07-frontend-components.md`:**
  - Rewrite *Design fidelity and inert controls (D-124)* as *Design fidelity and inert controls (D-124, D-190)*: the design source, the tokens and fonts (pointing at `globals.css` and `04`), the new breakpoints and grids, the left-out list and the R5 cuts, the 44px and contrast fixes.
  - Update the listing, news, article, landing, articles-menu and sign-in sections where R6 to R15 change them: presets, filter sheet, toolbar count, nav without "หมวดหมู่ทั้งหมด", the top bar, the drawer, the news sidebar button, the auth layout and the show-password button.
  - The landing limits sentence (18 → 19).
- [ ] **`04-tech-stack-and-structure.md`:**
  - The tree gains `src/app/_fonts/` (font files, `fonts.ts`, licence files), `src/components/ui/button-class.ts`, `Breadcrumbs.tsx`, `use-modal-dialog.ts` and `src/components/domain/platform-tone.ts`.
  - A short *Fonts* section: the two families, their designers, SIL Open Font License 1.1, self-hosted with `next/font/local` (no runtime request to a font host), the files' origin (the mockup's `assets/fonts/`), and the licence files beside them.
- [ ] **`12-glossary.md`** (Catalog / storefront rows):
  - *Design tokens* (the names above)
  - *Button class* (`buttonClass`, `ButtonVariant`, `ButtonSize`)
  - *Breadcrumbs* (`Breadcrumbs`)
  - *Modal dialog hook* (`useModalDialog`)
  - *Platform tone* (`PlatformTone`, `platformTone`, `PLATFORM_TONE`)
  - *Mobile menu* (`MobileMenu`)
  - *Product art* (`ProductArt`, the `art*` icon names)
  - *Storefront fonts* (`fonts.ts`, the four CSS variables)
  - Rewrite *Landing page sections*: `Hero`, `PlatformTiles`, `PlatformBanners`, `ProductSection` with `filterLinks`, `Reasons` and `ConsultBand`; `HeroZone`, `CategoryShowcase` and `TrustStrip` removed.
  - Update *Product page sections* (`ServicePanel` as assurances and the ask block; `BuyActions` without wishlist and share; the fourth tab), *Image placeholder* (tones `ps`, `ns`, `it`, `other`, `dark` and `art`) and *Product card* (the inert cart button, the sale tag).
  - Add `AuthPerks` to the customer authentication names.
- [ ] **`02-scope-and-phases.md`:** a phase 3 note like plan 014's: plan 015 restyles the existing storefront pages to the owner's new design; it delivers no requirement and changes no behaviour.
- [ ] **`CLAUDE.md`:**
  - *Current state*: add plan 015's code (the restyle to `tinzshop-redesign/`).
  - Question counts: 63 on record, 43 RESOLVED, 6 PARTIALLY RESOLVED, 14 UNRESOLVED.
  - *Implementation is unblocked*: add plan 015 with its D-range D-190 to D-201, on the owner's request of 2026-11-12. "Build only what plans 010 to 015 describe".
- [ ] **Commit:** `docs: record the storefront redesign as plan 015`

### Task 2: Foundation — tokens, fonts, logo, icons, primitives and the product card

**Files:**
- `src/app/globals.css`
- `src/app/_fonts/` — the 14 woff2 files copied from `tinzshop-redesign/assets/fonts/`, `fonts.ts`, `OFL-Anuphan.txt`, `OFL-IBMPlexSansThai.txt`
- `src/app/[locale]/layout.tsx`
- `src/components/ui/Icon.tsx`, `button-class.ts` (+ test), `Breadcrumbs.tsx` (+ test)
- `src/components/domain/platform-tone.ts` (+ test), `ProductCard.tsx` (+ test), `PriceDisplay.tsx` (+ test), `StockBadge.tsx`, `ProductBadge.tsx`, `ImagePlaceholder.tsx`
- `src/app/design-tokens.test.ts` (new)
- `messages/th.json`, `messages/en.json`

**Interfaces (produces):**
- `fonts.ts` exports `anuphanThai`, `anuphanLatin`, `plexThai`, `plexLatin`: `localFont({ src: [{ path, weight, style: 'normal' }, …], variable: '--font-anuphan-thai' | '--font-anuphan-latin' | '--font-plex-thai' | '--font-plex-latin', display: 'swap', adjustFontFallback: false, preload: <true for the Thai two, false for the Latin two>, declarations: [{ prop: 'unicode-range', value: <the mockup's range> }] })`. Anuphan weights 500, 600, 700; Plex 400, 500, 600, 700. Thai range `U+0E01-0E5B, U+200C-200D, U+25CC`; Latin range `U+0000-00FF, U+2000-206F, U+20AC, U+0E3F` (style.css L7–20).
- `layout.tsx`: `<html lang={locale} className={[anuphanThai, anuphanLatin, plexThai, plexLatin].map((f) => f.variable).join(' ')}>`.
- `buttonClass(options: { variant: ButtonVariant; size?: ButtonSize; block?: boolean }): string`, with `ButtonVariant = 'buy' | 'brand' | 'line' | 'ghost' | 'lineApp'` and `ButtonSize = 'md' | 'lg'`:
  - Base (style.css L62–64): `inline-flex min-h-12 items-center justify-center gap-2 rounded-sm border-[1.5px] border-transparent px-[22px] font-body text-base leading-none font-semibold whitespace-nowrap transition-[transform,background-color,border-color,box-shadow] duration-[180ms] ease-soft hover:-translate-y-px active:translate-y-px active:scale-[.985]`.
  - `buy`: `bg-accent text-ink hover:bg-accent-2 hover:shadow-[0_8px_20px_-8px_rgba(254,166,1,.75)] active:bg-accent-press`.
  - `brand` (the mockup's `.btn-dark`): `bg-brand text-white hover:bg-brand-dark`.
  - `line`: `border-line-2 bg-surface text-ink hover:border-ink`.
  - `ghost`: `border-white/28 text-white hover:border-white hover:bg-white/6`.
  - `lineApp`: `bg-line-app text-ink hover:bg-line-app-hover` (R16).
  - `lg`: `min-h-[54px] text-[17px]`. `block`: `w-full`.
- `Breadcrumbs({ label, items }: { label: string; items: readonly { label: string; href?: string }[] })`: a `nav` with `aria-label={label}`, the items separated by `chevRight` icons (14px); an item with `href` is a `Link` (`min-h-11 sm:min-h-8`, `text-ink-2 hover:text-ink hover:underline`), the last item without `href` is a `span aria-current="page"`. Row: `flex flex-wrap items-center gap-1.5 pt-[18px] pb-1 text-sm text-muted` (style.css L134–137).
- `PlatformTone = 'ps' | 'ns' | 'it' | 'other'`, `PLATFORM_TONE: Readonly<Record<string, PlatformTone>>` (`playstation-5` → `ps`, `nintendo-switch` → `ns`, `it-gadgets` → `it`), `platformTone(slug: string | null): PlatformTone` (anything else → `other`).
- `ProductArt = 'console' | 'handheld' | 'pad' | 'disc' | 'head' | 'key' | 'box' | 'news'`.
- `ImagePlaceholderProps = { label?: string; tone?: PlatformTone | 'dark'; art?: ProductArt; className?: string }` (defaults `other`, `pad`). The old tones `warm`, `cool` and `deep` go with their last users (Task 4).
- `ProductBadgeProps['tone']` becomes `'bundle' | 'preOrder' | 'sale' | PlatformTone` (style.css L145–157): `bundle` `bg-accent text-ink`, `preOrder` `bg-navy text-white`, `sale` `bg-sale text-white`, `ps` `bg-ps-soft text-ps-ink`, `ns` `bg-ns-soft text-ns-ink`, `it` `bg-it-soft text-it-ink`, `other` `bg-sunk text-ink-2`; shape `inline-flex h-[26px] items-center gap-1.5 rounded-[6px] px-2.5 text-[12.5px] leading-none font-semibold whitespace-nowrap`.
- `PriceDisplay` sizes: `card` (`font-head text-lg font-bold sm:text-xl`), `buyBox` (`text-[36px]`), `feature` (`text-[26px] text-white`), `mini` (`text-[13px] font-body font-normal`). On sale, the price is `text-sale` and the original `text-sm text-muted line-through` with its hidden label (D-123).
- `StockBadge`: `inline-flex items-center gap-1.5 text-[13.5px] font-medium` with the 8px dot; `in_stock` `text-ok`, `out_of_stock` `text-muted`.

- [ ] **Failing tests:**
  - `design-tokens.test.ts`: `globals.css` defines every colour, radius, shadow and breakpoint of *Global Constraints* with its exact value, defines no `--breakpoint-xs`, and uses no `min-[` variant in `src/**/*.tsx`.
  - `button-class.test.ts`: each variant's classes; `lineApp` has `text-ink` and never `text-white`; `lg` and `block` add their classes.
  - `Breadcrumbs.test.tsx`: links for items with `href`, `aria-current="page"` on the last, the nav's label.
  - `platform-tone.test.ts`: the three slugs, `null` and an unknown slug → `other`.
  - `ProductCard.test.tsx`, updating `carries an inert wishlist heart and no rating`:
    - `the heart and the cart button are inert buttons naming the product, with no aria-pressed`
    - `an out-of-stock card's cart button is disabled and labelled สินค้าหมด`
    - `shows ลดราคา and the red price only when the original is above the price`
    - `shows no category line, no instalment line and no rating`
    - `links the product name to its product page in the current locale` stays.
  - `PriceDisplay.test.tsx`: the existing formatting tests stay; add one per new size.
- [ ] **Implement:**
  - **Tokens:** add the new tokens and base layer; keep the retired colour tokens as aliases (Global Constraints).
  - **Fonts:** copy the 14 files; write `fonts.ts`; set the variables in `layout.tsx`.
  - **Licences:** add the two licence files with the families' official OFL 1.1 text and copyright lines, copied from each family's upstream source (Anuphan: Cadson Demak's repository or Google Fonts' `ofl/anuphan/OFL.txt`; IBM Plex: IBM's `plex` repository `LICENSE.txt`). Do not write a licence from memory.
  - **Logo:** `public/logo-mark.png` is already the same file as `design/assets/logo-mark.png` and `tinzshop-redesign/assets/logo-mark.png` (checked by hash on 2026-11-12), so nothing is copied; the header and footer show it at 40×40, round (`rounded-full`).
  - **Icons:** add exactly the names the in-scope pages use: `wrench`, `globe`, `tag`, `check`, and the product art `artConsole`, `artHandheld`, `artPad`, `artDisc`, `artHead`, `artKey`, `artBox`, `artNews`, with the paths of `_build.mjs` L21–49. Art draws at `strokeWidth={0.9}`.
  - **Domain components:** restyle `ProductCard` to `.card` (style.css L175–199), mobile-first:
    - card `rounded-[14px] p-2 sm:rounded-lg sm:p-3`, hover lift and `shadow-2`
    - tags `top-3.5 left-3.5 sm:top-5 sm:left-5`
    - heart `size-11 rounded-full bg-white/92 shadow-1` at `top-3 right-3 sm:top-[18px] sm:right-[18px]`
    - image `rounded-md` on `bg-surface`, out of stock `grayscale-[.9] opacity-70`
    - title `font-body text-[15px] font-semibold leading-[1.45] sm:text-base line-clamp-2 min-h-[2.9em]`
    - foot `flex min-h-11 items-center justify-between` with `StockBadge` and the cart button `size-11 rounded-[10px] bg-brand text-white hover:bg-accent hover:text-ink disabled:bg-sunk disabled:text-muted`
    - the stretched name link stays.
  - **The other domain components:** `PriceDisplay`, `StockBadge`, `ProductBadge` and `ImagePlaceholder` as above.
- [ ] **Messages:**
  - `shop.product.wishlist.addNamed` "เพิ่ม {name} ในรายการที่ชอบ"
  - `shop.product.addToCartNamed` "ใส่ {name} ลงตะกร้า"
  - `shop.product.badge.sale` "ลดราคา"
  - `shop.product.addToCart` becomes "ใส่ตะกร้า"
  - Remove `shop.product.wishlist.add` if nothing else uses it.
- [ ] **Commit:** `feat: add the redesign's tokens, fonts, icons and product card`

### Task 3: The shell — top bar, header, nav, drawer, footer, account menu

**Files:**
- `src/app/[locale]/(shop)/_components/SiteHeader.tsx` (+ test), `SearchForm.tsx`, `AccountMenu.tsx` (+ dom test), `ArticlesMenu.tsx` (colours only), `SiteFooter.tsx` (+ test), `NotFoundPanel.tsx`
- `src/app/[locale]/(shop)/_components/MobileMenu.tsx` and `MobileMenu.dom.test.tsx` (new)
- `src/components/ui/use-modal-dialog.ts` and `use-modal-dialog.dom.test.tsx` (new)
- `src/app/[locale]/(shop)/error.tsx`
- every `<main>` under `(shop)`: add `id="main"`
- `messages/*.json`

**Interfaces:**
- **Consumes:** `buttonClass`, `Icon`, `platformTone`, `listingHref`, `NAV_CATEGORY_SLUGS`, `readCurrentCustomer` (unchanged).
- **Produces:**
  - `useModalDialog({ open, onClose, containerRef, returnFocusRef }): void`: while open, focus moves to the first focusable element inside, Tab and Shift+Tab wrap inside, Escape calls `onClose`, `document.body` does not scroll; on close, focus returns to `returnFocusRef`.
  - `MobileMenuProps = { navItems: readonly { label: string; href: string; isCurrent: boolean }[]; signedIn: boolean; otherLocaleHref: string; otherLocaleName: string }`.
  - `SiteHeaderProps` unchanged (`path`, `articlesMenu`, `activeNav`, `customer`). `SiteNavKey` gains `otherToys` and `sale`, which are never current (their links are `#`, R5).

- [ ] **Failing tests** (`SiteHeader.test.tsx` updated; the rest new):
  - `the skip link is the first link and targets #main`
  - `the top bar keeps the articles menu and the language switch outside the links hidden below md` (replaces `shows the menu outside the help links…`)
  - `the top bar's LINE link is inert and shows no handle`
  - `the nav lists the mockup's entries, links the product ones to the listing, and leaves เครื่องเกมอื่น ๆ · ของเล่น and สินค้าลดราคา inert` (replaces `links "หมวดหมู่ทั้งหมด" and the product entries…`; no "หมวดหมู่ทั้งหมด" link remains)
  - `names the Nintendo platform from shop.category.switch, never "Switch 2"` (Q-062)
  - `the search button is type=button and the form has no action` (`renders the search form inert…` and `keeps the search form from submitting on Enter` stay)
  - `the menu button controls the drawer with aria-expanded`
  - `MobileMenu`:
    - `opens as a modal dialog and focuses its first link`
    - `keeps Tab inside and closes on Escape, returning focus to the menu button`
    - `shows the sign-in entry only when signed out`
    - `its LINE button is inert, with ink text`
  - `SiteFooter.test.tsx`:
    - `renders the design's link columns and payment badge` becomes `renders the three columns, the LINE link, and the five payment chips`
    - `shows no phone number, email, opening hours or placeholder text` (new)
    - the year tests and `links "ข่าวเกม" to the news list…` stay
  - `AccountMenu.dom.test.tsx`: existing behaviour tests stay; update any class or text assertion; add `the button shows สวัสดี คุณ{name} and บัญชีของฉัน`.
- [ ] **Build:**
  - **Top bar** (style.css L84–92): `bg-navy text-on-navy-2 text-sm`, `wrap` row `min-h-11 md:min-h-10`, the dot, the message (rich: the bold part always, the rest `hidden sm:inline`), then a right-hand group: `ArticlesMenu`, the links (`hidden md:flex`, each `inline-flex min-h-10 items-center gap-1.5` with `package`, `wrench`, `chat` at 16px), and the language switch with `globe` (R6).
  - **Header** (style.css L93–114): sticky, `bg-white/96 backdrop-blur-[8px] backdrop-saturate-[1.4] border-b border-line`.
    - Row `min-h-[76px] gap-6`; below `md` it wraps: menu button, logo, actions, then search full width.
    - Logo: the mark 40×40 `rounded-full`, the word "Tinzshop" `font-head text-[22px] font-bold tracking-[-.02em] text-navy`.
    - Search: `h-12 rounded-sm bg-sunk border-[1.5px] border-transparent focus-within:bg-white focus-within:border-brand`, the icon, the input, and the "ค้นหา" button `h-10 rounded-[6px] bg-brand px-[18px] text-white font-semibold`, `type="button"` (R7).
    - Actions (`hact`): `min-h-12 px-3 rounded-sm hover:bg-sunk`, icons 24px, two text lines `hidden md:block`, with the small line `hidden xl:block`. The cart count badge `bg-accent text-ink` (no longer red).
    - `AccountMenu` matches `hact`, its two lines reading "สวัสดี คุณ{name}" / "บัญชีของฉัน"; its panel is `rounded-md border border-line bg-surface shadow-2`.
  - **Nav** (style.css L115–124): `border-t border-line`, links `min-h-12 px-3.5 text-[15px] font-medium text-ink-2 border-b-2 border-transparent hover:text-brand`; current `text-ink font-semibold border-accent`; `สินค้าลดราคา` `text-sale`; platform dots `size-[9px] rounded-[3px]` in `bg-ps`, `bg-ns`, `bg-it`, `bg-other`; `hidden md:block`.
  - **Drawer** (style.css L126–130, `_build.mjs` L157–165): `MobileMenu`, a client component (it handles events), `fixed inset-0 z-60 bg-surface` sliding from the left (`ease-soft`, none under reduced motion).
    - Head: the logo and a close button.
    - Rows `min-h-[52px] border-b border-line text-[17px] font-medium`: the nav entries, then "คำสั่งซื้อของฉัน" and "ติดต่อเรื่องคืนสินค้า ประกัน หรือเคลม" (inert), "เข้าสู่ระบบ / สมัครสมาชิก" (signed out only, to sign-in), the other language, and the LINE button (`buttonClass({ variant: 'lineApp', block: true })`, inert).
    - The menu button (`size-12`, `md:hidden`) sits in `SiteHeader` and passes its ref as `returnFocusRef`.
  - **Footer** (style.css L327–342, `_build.mjs` L167–187): `bg-navy text-on-navy-2 text-[15px] mt-[clamp(48px,6vw,80px)]`.
    - Top grid: one column, two from `sm` (the about block spanning both), and `[1.4fr_repeat(3,1fr)]` from `lg`; padding `pt-14 pb-10`.
    - About: the logo with the word in white and a white ring on the mark, the about text, the LINE social button (`size-11 rounded-[10px] bg-white/7`, inert).
    - Columns: ช่วยเหลือ, เกี่ยวกับเรา, ติดต่อร้าน. Headings are `h2` `text-white font-body font-semibold text-base` (the mockup's `h4` would skip levels). Links are `min-h-11 sm:min-h-9`; "ข่าวเกม" goes to the news list; the rest are `#`. "ติดต่อร้าน" holds only "LINE ของร้าน" (inert), not phone, email or hours (REQ-045).
    - Bottom: `border-t border-white/8`, the `wrap` row `flex flex-wrap justify-between gap-4 py-5`. The five chips `h-8 rounded-[6px] bg-white/7 px-3 text-[13px] font-medium text-on-navy`, `flex flex-wrap gap-2`; the copyright `© {year} Tinzshop` on its own row below `sm` (R16).
  - **`NotFoundPanel` and `error.tsx`:** the new tokens, a `panel`, and `buttonClass({ variant: 'brand' })` for the action.
  - **Main:** add `id="main"` to every storefront `<main>`.
- [ ] **Messages:**
  - **Add:**
    - `shop.header.skip` "ข้ามไปเนื้อหาหลัก"
    - `shop.header.links.myOrders` "คำสั่งซื้อของฉัน"
    - `shop.header.links.warranty` "ประกัน / เคลม"
    - `shop.header.links.line` "LINE ของร้าน"
    - `shop.header.logo.word` "Tinzshop"
    - `shop.header.menu.open` "เปิดเมนู", `shop.header.menu.close` "ปิดเมนู", `shop.header.menu.label` "เมนู"
    - `shop.header.drawer.warranty` "ติดต่อเรื่องคืนสินค้า ประกัน หรือเคลม"
    - `shop.header.drawer.account` "เข้าสู่ระบบ / สมัครสมาชิก"
    - `shop.contact.lineChat` "แชทกับร้านทาง LINE"
    - `shop.category.otherToys` "เครื่องเกมอื่น ๆ · ของเล่น"
    - `shop.category.sale` "สินค้าลดราคา"
    - `shop.auth.menu.greeting` "สวัสดี คุณ{name}"
    - footer:
      - `shop.footer.help.myOrders` "คำสั่งซื้อของฉัน", `shop.footer.help.warranty` "คืนสินค้า ประกัน และเคลม", `shop.footer.help.cancellation` "การยกเลิกคำสั่งซื้อ"
      - `shop.footer.aboutUs.warrantyPolicy` "นโยบายการรับประกันและคืนสินค้า", `shop.footer.aboutUs.privacy` "นโยบายความเป็นส่วนตัว (PDPA)", `shop.footer.aboutUs.terms` "เงื่อนไขการใช้บริการ"
      - `shop.footer.contact.title` "ติดต่อร้าน", `shop.footer.contact.line` "LINE ของร้าน"
      - `shop.footer.pay.label` "ช่องทางชำระเงิน"
      - `shop.footer.pay.kpayment` "ชำระผ่าน K-Payment", `shop.footer.pay.card` "บัตรเครดิต / เดบิต", `shop.footer.pay.instalment` "ผ่อนชำระ", `shop.footer.pay.promptPay` "PromptPay QR", `shop.footer.pay.dbd` "DBD Registered"
  - **Change:**
    - `shop.header.tagline` "<b>ส่งทั่วประเทศไทย</b> <rest>ค่าส่งตามขนาดสินค้า · สินค้าชิ้นใหญ่ส่งฟรี</rest>"
    - `shop.header.search.placeholder` "ค้นหาเกม เครื่อง อุปกรณ์"
    - `shop.footer.about` "ร้านเกม คอนโซล และอุปกรณ์ไอที หน้าร้านย่านสะพานเหล็กมากว่า 20 ปี วันนี้สั่งออนไลน์ได้ทั่วประเทศไทย"
    - `shop.footer.help.howToOrder` "วิธีสั่งซื้อและชำระเงิน", `shop.footer.help.shipping` "ค่าจัดส่ง"
  - **Remove:**
    - `shop.header.logo.wordLead`, `wordTail`, `sub`, `shop.header.search.scope`, `shop.header.links.trackOrder`, `help`, `shop.header.nav.all`
    - `shop.footer.shopping.*`, `shop.footer.policy.*`, `shop.footer.payBadge.*`, `shop.footer.dbdBadge.*`, `shop.footer.help.payment`, `trackOrder`, `shop.footer.aboutUs.contact`
- [ ] **Commit:** `feat: restyle the storefront shell to the redesign`

### Task 4: Home

**Files:**
- `src/app/[locale]/(shop)/(home)/page.tsx`, `loading.tsx` (+ test)
- `_components/Hero.tsx` (rewritten), `PlatformTiles.tsx`, `PlatformBanners.tsx`, `Reasons.tsx`, `ConsultBand.tsx` (new, with tests in `home-sections.test.tsx`), `ProductSection.tsx` (+ test)
- delete `_components/HeroZone.tsx`, `CategoryShowcase.tsx`, `TrustStrip.tsx`
- `src/server/services/catalogue/landing-catalogue-service.ts` (+ test), `src/server/repositories/catalogue/storefront-repository.ts`, `tests/integration/catalogue/storefront-repository.test.ts` and `kit-landing.test.ts` where they assert the limits
- `messages/*.json`

**Interfaces:**
- `HeroProps = { feature: LandingProductCard | null; minis: readonly LandingProductCard[]; signedIn: boolean }`.
- `ProductSectionProps = { id: ProductSectionId; titleKey: string; subtitleKey?: string; cards: readonly LandingProductCard[]; moreHref?: string; moreLabelKey?: string; filterLinks?: readonly { label: string; href: string | null }[]; columns: 5 | 4 }`. `layout` and `tone` go. A `filterLinks` entry with `href: null` is the current one. `ProductSectionId` gains nothing; `preOrders` stays in the type for plan 005.
- Landing constants: `BEST_SELLER_LIMIT = 10`, `BUNDLE_LIMIT = 5`, `PRE_ORDER_LIMIT = 4`; the SQL `LIMIT`s match. The repository's doc comment says "at most 19".

- [ ] **Failing tests:**
  - `landing-catalogue-service.test.ts`: `toHaveLength(8)` → 10, `toHaveLength(6)` → 5; the integration tests' limits likewise.
  - `Hero`:
    - `links เลือกซื้อสินค้า to the product listing`
    - `shows สมัครสมาชิก only when signed out`
    - `the feature card is the first kit, with its price and stock and no savings line`
    - `without a kit there is no feature card`
    - `the minis are the first three best sellers that are not the feature`
  - `PlatformTiles`:
    - `links the platforms to the listing, พรีออเดอร์ to pre_order=1 and ชุดโปรโมชั่น to kit=1`
    - `leaves ลดราคา inert`
  - `PlatformBanners`:
    - `links each banner and its type links to the listing with category and type`
    - `leaves เคส & ฟิล์ม inert and says nothing about a shop warranty`
  - `ConsultBand`:
    - `its LINE and FAQ buttons are inert`
    - `the LINE button has ink text`
    - `shows no chat sample and no handle`
  - `ProductSection.test.tsx`:
    - `renders the bundles section as a warm rail…` becomes `renders the bundles section as a 5-column grid with subtitle, ดูชุดทั้งหมด and kit badges`
    - add `renders the best-seller chips as links, ทั้งหมด current`
    - the other tests stay
  - `public-pages.test.tsx`: `the home page stays public and keeps showing its products (D-161)` stays; add `the home page has no pre-order section and no store-visit block`.
  - `loading.test.tsx`: the skeleton uses the `g-5` grid.
- [ ] **Build** (`_build.mjs` L206–328; style.css L200–311), in this order:
  1. **Hero** (style.css L201–230): a full-width `bg-navy` band with the backdrop, `wrap` grid one column, `[1.05fr_.95fr]` from `lg`, `min-h-[min(640px,calc(100svh-170px))]`, `py-11 lg:py-14`, the entrance animation (none under reduced motion).
     - `h1` `text-[clamp(34px,4.4vw,58px)] leading-[1.14] text-white`, its `em` `not-italic text-accent`.
     - The lead, the three facts with `truck`, `card`, `receipt` in `text-accent`.
     - Two buttons: `buy lg` to the listing, `ghost lg` to register (signed out only); full width below `sm`.
     - The feature card (`bg-navy-2 rounded-xl p-4`, image or `ImagePlaceholder tone="dark" art="box"` at 5:4, the tag "ชุดโปรโมชั่นขายดี", name link stretching over the card, `PriceDisplay size="feature"`, `StockBadge`) and the minis (`grid-cols-1 sm:grid-cols-3`; below `sm` only the first).
  2. **`PlatformTiles`** (style.css L237–247): `bg-surface border-b border-line`, a 2 / 3 / 6-column grid (`sm` 3, `xl` 6), tiles `min-h-[72px] sm:min-h-[84px]` with the 44px icon square.
  3. **"ชุดโปรโมชั่นพร้อมเล่น":** `ProductSection id="bundles" columns={5}` with "ดูชุดทั้งหมด" to `?kit=1`.
  4. **`PlatformBanners`** (style.css L257–270): two columns from `lg`; each `rounded-xl p-[22px] sm:p-7 min-h-0 sm:min-h-[300px] text-white`, the art hidden below `sm`, the type links `min-h-11 sm:min-h-10 rounded-full bg-white/14`.
  5. **Best sellers:** `ProductSection id="bestSellers" columns={5}` with `filterLinks` (R10) and no "view all".
  6. **`Reasons`** (style.css L249–254): 1 / 2 / 4 columns, cards `rounded-lg border border-line bg-surface p-[22px]`, icon squares `bg-brand-soft text-brand`.
  7. **`ConsultBand`** (style.css L291–300): `bg-navy rounded-2xl p-[clamp(28px,4vw,56px)]`, two columns from `lg`; the eyebrow, `h2`, text, the `lineApp lg` and `ghost lg` buttons (full width below `sm`), and the word "LINE" at `font-head text-[44px] sm:text-[clamp(44px,6.4vw,92px)]` (`aria-hidden`).
  8. **News:** `NewsCardSection` as now.
  9. The empty state (`shop.home.empty`) when there are no products, as now.
- [ ] **Messages:**
  - **Add or replace** under `shop.home`:
    - `meta.title` "Tinzshop — เครื่องเกม แผ่นเกม และอุปกรณ์ PS5 · Nintendo Switch"
    - `meta.description` "ร้านเกมย่านสะพานเหล็กกว่า 20 ปี ขาย PS5, Nintendo Switch, แผ่นเกม จอย และ IT Gadgets ส่งทั่วไทย ชำระผ่าน K-Payment"
    - hero:
      - `hero.eyebrow` "หน้าร้านย่านสะพานเหล็กกว่า 20 ปี · ส่งทั่วไทย"
      - `hero.title` "เครื่องเกม แผ่นเกม และอุปกรณ์ <em>PS5 · Switch</em> ครบในร้านเดียว"
      - `hero.lead` "สมัครสมาชิกครั้งเดียว ดูราคาทุกรุ่น สั่งซื้อ และติดตามคำสั่งซื้อได้เอง ไม่แน่ใจรุ่นไหน ทักถามพนักงานที่เล่นเกมจริงทาง LINE ก่อนซื้อได้"
      - `hero.facts.shipping` "ค่าส่งตามขนาดสินค้า สินค้าชิ้นใหญ่ส่งฟรี", `hero.facts.payment` "บัตร ผ่อนชำระ หรือ PromptPay QR ผ่าน K-Payment", `hero.facts.invoice` "ใบกำกับภาษีอย่างย่อ PDF ทุกคำสั่งซื้อ"
      - `hero.shop` "เลือกซื้อสินค้า", `hero.register` "สมัครสมาชิก"
      - `hero.feature.tag` "ชุดโปรโมชั่นขายดี"
    - platforms:
      - `platforms.label` "เลือกตามแพลตฟอร์ม"
      - `platforms.consoleGames` "เครื่อง · เกม · จอย" (PS5 and Switch)
      - `platforms.gadgets` "คีย์บอร์ด · เมาส์"
      - `platforms.preOrder` "จองก่อนวางขาย"
      - `platforms.bundles` "เครื่อง + เกม"
      - `platforms.saleTitle` "ลดราคา", `platforms.sale` "สินค้าราคาพิเศษ"
    - `bundles.title` "ชุดโปรโมชั่นพร้อมเล่น", `bundles.subtitle` "เครื่อง เกม และอุปกรณ์เสริม จัดเป็นชุด", `bundles.more` "ดูชุดทั้งหมด"
    - banners:
      - `banners.label` "เลือกซื้อตามเครื่อง"
      - `banners.ps.title` "ทุกอย่างสำหรับ PS5", `banners.ps.text` "เครื่อง Slim ทั้งรุ่นมีช่องแผ่นและ Digital แผ่นเกมโซน 3 ซับไทย จอย และ SSD เพิ่มความจุ"
      - `banners.switch.title` "ทุกอย่างสำหรับ Switch", `banners.switch.text` "เกมใหม่โซนเอเชีย Pro Controller เคส และฟิล์มกันรอย"
      - `banners.casesFilm` "เคส & ฟิล์ม"
    - `bestSellers.title` "สินค้าขายดี", `bestSellers.filterLabel` "กรองสินค้าขายดี", `bestSellers.all` "ทั้งหมด", `bestSellers.ps5` "PS5", `bestSellers.switch` "Switch", `bestSellers.gadgets` "IT Gadgets"
    - reasons:
      - `reasons.title` "ทำไมเกมเมอร์ซื้อกับ Tinzshop"
      - `reasons.store.title` "ร้านจริงกว่า 20 ปี" / `.text` "หน้าร้านย่านสะพานเหล็ก ขายเครื่องเกมและแผ่นเกมมานาน ตอนนี้สั่งออนไลน์และส่งได้ทั่วประเทศ"
      - `reasons.staff.title` "ถามคนที่เล่นจริง" / `.text` "พนักงานเล่นเกมเอง แนะนำรุ่นและเกมตามที่คุณใช้ ไม่ขายเกินความจำเป็น"
      - `reasons.warranty.title` "ติดต่อเรื่องประกันได้ตรง" / `.text` "ส่งเรื่องคืนสินค้า ประกัน หรือเคลมจากคำสั่งซื้อของคุณ พนักงานติดต่อกลับเอง และแจ้งช่องทางของศูนย์ผู้จำหน่าย"
      - `reasons.documents.title` "เอกสารครบ" / `.text` "ราคารวม VAT 7% ใบกำกับภาษีอย่างย่อออกให้ทุกคำสั่งซื้อ ดาวน์โหลด PDF จากประวัติการสั่งซื้อ"
    - consult: `consult.eyebrow` "ไม่แน่ใจว่าจะเลือกรุ่นไหน", `consult.title` "ทักถามร้านก่อนซื้อ ตอบในเวลาทำการ", `consult.text` "ถามได้ทั้งเรื่องรุ่น โซนแผ่น การผ่อน หรือของที่ต้องสั่งจากตัวแทน", `consult.faq` "อ่านคำถามที่พบบ่อย", `consult.word` "LINE"
  - **Remove:** `shop.home.hero.label`, `hero.text`, `hero.shopNow`, `hero.viewAll`, `shop.home.trust.*`, `rail.*`, `promo.*`, `welcome.*`, `showcase.*`, `preOrders.*`.
- [ ] **Commit:** `feat: rebuild the home page to the redesign`

### Task 5: Product listing

**Files:** `src/app/[locale]/(shop)/product/_components/ProductListingView.tsx` (+ test), `ListingControls.tsx` (+ dom test), `product/page.tsx`, `product/not-found.tsx`, `messages/*.json`.

**Interfaces:**
- **Consumes:** `useModalDialog`, `Breadcrumbs`, `ProductCard`, `buttonClass`, the news `Pagination`.
- `PRICE_PRESETS` becomes `[{ key: 'under2000', minBaht: null, maxBaht: 1999 }, { key: 'from2000', minBaht: 2000, maxBaht: 9999 }, { key: 'over10000', minBaht: 10000, maxBaht: null }]`.
- `ListingFilterPanel` gains `count: number` (for "แสดง {count} รายการ").
- The URL contract (D-145) does not change.

- [ ] **Failing tests:**
  - `ProductListingView.test.tsx`:
    - `has the ตัวกรอง disclosure for narrow screens, closed at first` becomes `has the ตัวกรอง button for narrow screens, controlling the closed filter sheet`
    - add `the presets link to max=1999, min=2000&max=9999 and min=10000`
    - add `the toolbar says แสดง 1–24 จาก N รายการ, and the last page's range ends at N`
    - add `the head shows the description with the count`
    - add `the type tiles carry their counts`
    - the rest stay
  - `ListingControls.dom.test.tsx`: the existing focus tests stay, and add:
    - `the open sheet is a modal dialog; Escape closes it and focus returns to ตัวกรอง`
    - `a checkbox change inside the open sheet keeps it open and keeps focus`
    - `the price input keeps focus after Enter inside the sheet`
    - `widening past lg closes the sheet and drops the dialog role`
    - `แสดง N รายการ closes the sheet`
- [ ] **Build** (`_build.mjs` L334–362; style.css L343–382, L570–665):
  - `wrap`, `Breadcrumbs` (home › category or สินค้าทั้งหมด).
  - Head: `.lhead` (`flex flex-wrap items-end justify-between gap-4 pt-3 pb-5`, `h1` `text-[clamp(28px,3vw,40px)]`, `p` `mt-1 text-muted`).
  - Type tiles (`.subcat`): a 2 / 3 / 6-column grid (`sm` 3, `lg` 6), `rounded-md border-[1.5px] border-line bg-surface`, the 64px art, the label and "{count} รายการ"; current `border-ink shadow-[inset_0_0_0_1px_var(--color-ink)]`, `aria-current="page"` as now. Art: ทั้งหมด `artConsole`, เครื่องเกม `artConsole`, แผ่นเกม `artDisc`, จอย `artPad`, อุปกรณ์เสริม `artHead`, ชุดโปรโมชั่น `artBox`, toned by the active platform (`platformTone`).
  - Layout: one column, `[268px_1fr] gap-7` from `lg`.
  - Filters: from `lg` sticky at `top-[140px]`, `rounded-lg border border-line bg-surface px-5 py-1.5`; each group a `<details open>` with `summary` `min-h-11 sm:min-h-8 font-semibold` and the `chevDown` turning; checks as the class map; the price inputs and the three presets as chips. Below `lg` the sheet (R12): `fixed inset-0 z-70 overflow-auto bg-surface px-[clamp(16px,3.2vw,32px)] pt-4 pb-[100px]`, a head with "ตัวกรอง" and the close button, and a fixed bottom bar with `buttonClass({ variant: 'brand', block: true })` "แสดง {count} รายการ".
  - Toolbar: the count, then "ตัวกรอง" (`line`, `lg:hidden`), the sort `select`, and the grid/list switch (`hidden sm:flex`).
  - Active filters: "ตัวกรองที่ใช้:", chips (current style, `min-h-11 sm:min-h-9`) with an `x`, and "ล้างทั้งหมด".
  - Grid `g-4`, or the list view as now. Pager as the class map.
- [ ] **Messages:**
  - Change:
    - `shop.listing.toolbar.count` "แสดง <b>{from, number}–{to, number}</b> จาก <b>{total, number}</b> รายการ"
    - `shop.listing.active.label` "ตัวกรองที่ใช้:"
    - `shop.listing.filters.inStock` "มีสินค้า"
    - `shop.listing.description` "เครื่องเกม แผ่นเกม จอย และอุปกรณ์เสริมทุกแพลตฟอร์ม · {count, number} รายการ"
    - `shop.listing.categoryDescription` "{types}สำหรับ {name} · {count, number} รายการ"
  - Add:
    - `shop.listing.tabs.count` "{count, number} รายการ"
    - `shop.listing.filters.close` "ปิดตัวกรอง", `shop.listing.filters.apply` "แสดง {count, number} รายการ"
    - `shop.listing.filters.preset.under2000` "ต่ำกว่า ฿2,000", `from2000` "฿2,000–10,000", `over10000` "มากกว่า ฿10,000"
  - Remove: the four old preset keys.
- [ ] **Commit:** `feat: restyle the product listing to the redesign`

### Task 6: Product page

**Files:** `src/app/[locale]/(shop)/product/[productId]/detail/page.tsx` (+ test), `_components/Breadcrumb.tsx` (+ test), `Gallery.tsx` (+ test), `ProductHeading.tsx` (+ test), `VariantPicker.tsx` (+ test), `BuyActions.tsx` (+ test), `ServicePanel.tsx`, `ProductTabs.tsx` (+ test), `not-found.tsx`, `messages/*.json`.

**Interfaces:**
- `ProductHeadingProps = { name: string; isKit: boolean; isPreOrder: boolean; releaseDate: string | null; platform: ProductDetailCategory | null; productType: ProductDetailCategory | null }`. It owns the platform tag and the badges; the page's inline pre-order badge moves into it.
- `VariantPicker` props are unchanged; it renders the price box, the option groups and the phone buy bar.
- `RELATED_LIMIT = 5`.

- [ ] **Failing tests:**
  - `ProductHeading`:
    - `shows the platform tag "{platform} · {type}" in the platform's tone, and none without a platform`
    - the kit test stays
  - `VariantPicker`:
    - the selection tests stay
    - add `the phone buy bar shows the chosen variant's price and follows a new choice`
    - add `the price box carries the K-Payment and VAT line`
  - `BuyActions.test.tsx`:
    - `renders the stepper, cart and buy-now controls inert, at quantity 1` stays
    - `shows the K-Payment block with its three chips` becomes `shows no wishlist, share or K-Payment chips`
  - `ServicePanel` (new test): `shows the four assurances and an inert LINE button with ink text and no handle`.
  - `ProductTabs.test.tsx`:
    - the description, spec and reviews tests stay
    - add `has a fourth tab, การจัดส่งและรับประกัน, with no tracking-number promise and an inert warranty link`
    - add `the reviews tab has an inert เขียนรีวิว and no scores`
  - `page.test.tsx`: the gating and 404 tests stay; add `related products are 5, titled สินค้าที่เกี่ยวข้อง`.
- [ ] **Build** (`_build.mjs` L372–441; style.css L383–456):
  - `Breadcrumb` renders `Breadcrumbs` (its D-151 logic unchanged).
  - `.pdp`: one column, `[minmax(0,1.15fr)_minmax(0,1fr)] gap-10` from `lg`.
  - Gallery: sticky at `top-[140px]` from `lg`; stage `rounded-xl border border-line bg-surface p-4`, image `rounded-[14px]`; the 5-column thumbnails `rounded-md border-2`, current `border-ink`.
  - Buy box:
    - the tag, the badges and `h1` (`text-[clamp(26px,2.6vw,34px)] mt-2.5`)
    - the price box (`mt-5 rounded-lg border border-line bg-surface p-5`, `PriceDisplay size="buyBox"`, `StockBadge`, the `card` icon line)
    - options as `.opt` (legend `font-semibold`, the value `font-normal text-muted`; labels `min-h-12 rounded-sm border-[1.5px] border-line-2 bg-surface px-4 font-medium`, checked `border-ink shadow-[inset_0_0_0_1px_var(--color-ink)]`, disabled dashed; the sold-out label rule of D-121 unchanged)
    - the buy row (`grid grid-cols-2 gap-3 sm:grid-cols-[auto_1fr_1fr] mt-6`: the stepper `h-[54px]`, on its own row below `sm` (`col-span-full justify-self-start sm:col-span-1`), `brand lg` "ใส่ตะกร้า", `buy lg` "ซื้อเลย")
    - assurances (`grid gap-2.5 sm:grid-cols-2 mt-5`, each `rounded-md border border-line bg-surface p-3.5`)
    - the ask block (`mt-3 flex items-center justify-between gap-3 rounded-md bg-line-app-soft px-4 py-3.5`, `buttonClass({ variant: 'lineApp' })`)
  - Tabs: `mt-14`, the list `border-b border-line`, tabs `min-h-[52px] px-[18px] font-semibold text-muted`, selected `text-ink border-b-[2.5px] border-accent`; prose `max-w-[760px] text-ink-2`, `h3` `text-[21px] text-ink`; the spec table as `.spec`. Arrow keys still move between the four tabs.
  - Related products: `ProductSection id="related" columns={5}` with "ดูทั้งหมด".
  - Phone buy bar: `fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-line bg-white px-[clamp(16px,3.2vw,32px)] py-2.5 shadow-[0_-8px_24px_-12px_rgba(0,0,0,.15)] sm:hidden`, and the page's `main` gets `pb-[84px] sm:pb-10`.
- [ ] **Messages:**
  - Change:
    - `shop.product.vatNote` "ผ่อนบัตรเครดิตผ่าน K-Payment เลือกจำนวนงวดตอนชำระเงิน · ราคารวม VAT แล้ว"
    - `shop.product.tabs.reviews` "รีวิวจากลูกค้า"
  - Add:
    - `shop.product.platformTag` "{platform} · {type}"
    - assurances:
      - `shop.product.assure.shipping.title` "ค่าส่งตามขนาดสินค้า" / `.text` "สินค้าชิ้นใหญ่อย่างเครื่องเกมส่งฟรี"
      - `assure.warranty.title` "ติดต่อเรื่องประกันได้" / `.text` "ส่งเรื่องจากคำสั่งซื้อ พนักงานติดต่อกลับ"
      - `assure.invoice.title` "ใบกำกับภาษีอัตโนมัติ" / `.text` "ดาวน์โหลด PDF จากประวัติการสั่งซื้อ"
      - `assure.cancel.title` "ขอยกเลิกได้ก่อนส่งของ" / `.text` "ส่งคำขอยกเลิกจากหน้าคำสั่งซื้อ"
    - ask block: `shop.product.ask.title` "มีคำถามก่อนซื้อ?", `ask.text` "ถามพนักงานที่เล่นเกมจริงทาง LINE", `ask.button` "ถามทาง LINE"
    - shipping tab:
      - `shop.product.tabs.shipping` "การจัดส่งและรับประกัน"
      - `shop.product.shippingTab.shippingTitle` "ค่าจัดส่ง", `shippingText` "คิดตามขนาดสินค้า: ชิ้นเล็กอย่างแผ่นเกม ชิ้นกลางอย่างจอย และชิ้นใหญ่อย่างเครื่องเกมส่งฟรี แสดงยอดก่อนชำระเงิน"
      - `warrantyTitle` "การรับประกัน", `warrantyText` "ส่งเรื่องคืนสินค้า ประกัน หรือเคลมได้ที่หน้า <link>ติดต่อเรื่องประกัน / เคลม</link> พนักงานติดต่อกลับ และแจ้งช่องทางของศูนย์ผู้จำหน่ายสินค้า"
      - `cancelTitle` "การยกเลิก", `cancelText` "ส่งคำขอยกเลิกได้จากบัญชีของคุณ ตราบใดที่ร้านยังไม่ส่งของ"
    - `shop.product.reviews.write` "เขียนรีวิว"
  - Remove: `shop.product.service.*`, `shop.product.share`.
- [ ] **Commit:** `feat: restyle the product page to the redesign`

### Task 7: News pages

**Files:** `src/app/[locale]/(shop)/news/_components/NewsListView.tsx`, `NewsTabs.tsx`, `NewsTabsScroller.tsx`, `NewsFeature.tsx`, `NewsGrid.tsx`, `NewsCard.tsx`, `NewsCardSection.tsx`, `NewsSidebar.tsx`, `Pagination.tsx`, `news-components.test.tsx`; `news/[slug]/_components/NewsArticleView.tsx`, `ArticleBody.tsx`, `news-article.test.tsx`; `news/not-found.tsx`; `messages/*.json`.

- [ ] **Failing tests** (`news-components.test.tsx`, `news-article.test.tsx`):
  - The tab, scroller, pagination, card and feature tests stay; update any class or aspect assertion (the card image is now 16:9).
  - Add `the sidebar's pre-order button links to the listing with pre_order=1`.
  - Add `every news tag uses the neutral tone`.
  - `lists the categories with counts, marks the active one, and shows no popularity ranking` stays.
- [ ] **Build** (`_build.mjs` L601–622; style.css L301–311, L544–567):
  - `Breadcrumbs`; the head `.lhead` with `h1`, the subtitle and the tabs drawn as chips (current: brand fill) inside the existing scroller (its arrow buttons stay 44px).
  - Feature (`.nfeat`): one column, `[1.5fr_1fr]` from `lg`; the big card `rounded-xl min-h-[340px] p-[22px] sm:min-h-[420px] sm:p-8`, the dark wash `linear-gradient(transparent 30%, rgba(8,14,26,.88))`, white text; the side cards `rounded-xl`. A card without an image keeps a `navy` or `navy-2` ground with the `artNews` art at 35% opacity.
  - Layout: one column, `[1fr_320px] gap-7` from `lg`.
  - Grid: one column, two from `sm`. Cards `.ncard` (`rounded-lg border border-line bg-surface overflow-hidden`, image 16:9 `object-cover`, body `px-5 pt-[18px] pb-5`, `h3` `font-body text-lg font-semibold leading-[1.45]`, excerpt `text-[15px] text-ink-2`, date `mt-auto text-sm text-muted`); the tag `ProductBadge tone="other"`.
  - Sidebar: sticky from `lg`; the categories `panel`; the pre-order panel `bg-navy text-on-navy border-0` with `buttonClass({ variant: 'buy', block: true })` linking to `listingHref(locale, { preOrder: true })`.
  - Pager as the class map.
  - Article page: the same `Breadcrumbs`, the reading `panel`, `font-head` title, the tokens in `ArticleBody`'s descendant styles (links `text-brand`, tables `border-line`), related news as `.ncard`s.
- [ ] **Messages:**
  - Change `shop.news.subtitle` to "ข่าวเกมใหม่ ข่าวสินค้า และประกาศจากร้าน".
  - Nothing else; the sidebar keeps `shop.news.sidebar.preOrder*` (R14).
- [ ] **Commit:** `feat: restyle the news pages to the redesign`

### Task 8: Sign-in pages

**Files:** `src/app/[locale]/(shop)/(auth)/_components/AuthShell.tsx`, `AuthCard.tsx`, `AuthField.tsx`, `AuthForm.tsx` (+ dom test), `AuthNotice.tsx`, `GoogleButton.tsx`, `AuthPerks.tsx` (new); `sign-in/page.tsx`, `register/page.tsx`, `register/verify/page.tsx`, `forgot-password/page.tsx`; `auth-pages.test.tsx`; `messages/*.json`.

**Interfaces:**
- `AuthShell` gains `breadcrumb: string` (the page's crumb label) and `perks: 'signIn' | 'register' | null`.
- `AuthCard` gains `switchPrompt?: ReactNode` (the rich line under the title) in place of the top-right link.
- `AuthField` gains `revealable?: boolean` (the show/hide button, on for password fields).
- `GoogleButton` takes `labelKey: 'google.label' | 'google.register'`.
- `AuthPerks({ variant: 'signIn' | 'register' })`.
- Server Actions, controllers and cookies do not change.

- [ ] **Failing tests:**
  - `auth-pages.test.tsx`:
    - `shows email and password, the forgot link on the password label row, Google, and the register link at the top right` becomes `shows email and password, the forgot link below the password field, Google, and "ยังไม่มีบัญชี? สมัครสมาชิก" under the title`.
    - `shows the five fields … and the sign-in link at the top right` becomes `… and "มีบัญชีอยู่แล้ว? เข้าสู่ระบบ" under the title`; the register email field has its hint.
    - Add `sign-in and register show the perks panel without the wishlist perk, the tracking number or reminders; verify and forgot password show none`.
    - Add `register shows no terms or PDPA fine print`.
    - Add `each page has the breadcrumb`.
    - Every other test stays: `returnTo`, notices, `every auth form has a server action…`, the reset step, Q-061, the language switch, the 404.
  - `AuthForm.dom.test.tsx`: the rule-tick and confirm-tick tests stay, and add:
    - `the show button reveals and hides the password, is type=button and never submits`
    - `after an action resets the form, the password field is hidden again and the ticks clear`
    - `revealing the password does not stop the rule ticks`
- [ ] **Build** (`_build.mjs` L627–683; style.css L703–756):
  - `wrap`, `Breadcrumbs`.
  - `.auth`: one column, `[minmax(0,560px)_minmax(0,1fr)] gap-7` from `lg`.
  - Card `rounded-[16px] border border-line bg-surface px-[18px] py-[22px] sm:rounded-xl sm:p-[clamp(24px,3vw,40px)]`, `h1` `text-[clamp(28px,2.6vw,36px)]`, the switch line `mt-1.5 mb-6 text-ink-2` with its link `.link`.
  - Fields: labels `font-semibold text-[15px] mb-1.5`, inputs as the class map, hints and errors `text-[13.5px]` (`text-muted`, `text-sale`); first and last name in two columns from `sm`.
  - The show button `absolute right-1.5 top-1/2 -translate-y-1/2 min-h-9 min-w-16 rounded-[6px] bg-sunk text-sm font-semibold` with a 44px hit area (`after:absolute after:-inset-y-1 after:inset-x-0`); the input gets `pr-[84px]`.
  - The rules list as `.rules` (style.css L751–756), grey dot to green check.
  - "ลืมรหัสผ่าน?" in a right-aligned row below the password field, `min-h-11`.
  - Submit: sign-in `brand lg block`, register `buy lg block`, the others `brand lg block`.
  - The "หรือ" divider; Google `line block`.
  - Notices as `.note` (success `bg-ok-soft text-ok-ink`).
  - Perks (`.auth__perks`): `bg-navy rounded-xl` with its backdrop, sticky at `top-[140px]` from `lg`; the eyebrow, `h2`, the list with 44px icon squares in `text-accent`.
- [ ] **Messages:**
  - Add:
    - `shop.auth.breadcrumb.label` "เส้นทาง", `shop.auth.breadcrumb.home` "หน้าแรก"
    - `shop.auth.signIn.switchPrompt` "ยังไม่มีบัญชี? <link>สมัครสมาชิก</link>"
    - `shop.auth.register.switchPrompt` "มีบัญชีอยู่แล้ว? <link>เข้าสู่ระบบ</link>"
    - `shop.auth.google.register` "สมัครด้วย Google"
    - `shop.auth.field.emailHint` "ใช้รับอีเมลยืนยันคำสั่งซื้อและใบกำกับภาษี", `shop.auth.field.emailPlaceholder` "name@example.com"
    - `shop.auth.password.show` "แสดง", `hide` "ซ่อน", `showLabel` "แสดงรหัสผ่าน", `hideLabel` "ซ่อนรหัสผ่าน"
    - perks:
      - `shop.auth.perks.eyebrow` "สมาชิก Tinzshop"
      - `perks.signInTitle` "เข้าสู่ระบบเพื่อดูคำสั่งซื้อ พรีออเดอร์ และใบกำกับภาษีของคุณ", `perks.registerTitle` "สมัครครั้งเดียว ติดตามทุกคำสั่งซื้อได้เอง"
      - `perks.orders.title` "ติดตามคำสั่งซื้อในที่เดียว" / `.text` "สถานะการชำระเงิน และประวัติการสั่งซื้อทั้งหมด"
      - `perks.invoice.title` "ดาวน์โหลดใบกำกับภาษี" / `.text` "ไฟล์ PDF ของทุกคำสั่งซื้อ เก็บย้อนหลังได้"
      - `perks.preOrder.title` "ดูพรีออเดอร์และยอดคงเหลือ" (no second line, R5)
      - `perks.warranty.title` "ติดต่อเรื่องประกันง่ายขึ้น" / `.text` "เลือกสินค้าจากประวัติการสั่งซื้อ ไม่ต้องกรอกเลขคำสั่งซื้อเอง"
  - Remove `shop.auth.signIn.description` and `shop.auth.register.description` once nothing uses them. Keep `switchLink` only if a page still uses it.
- [ ] **Commit:** `feat: restyle the sign-in pages to the redesign`

### Task 9: Clean-up, visual check and the manual checklist

**Files:** `src/app/globals.css`, `src/app/design-tokens.test.ts`, `src/components/ui/Icon.tsx`, `messages/*.json`, this plan, `docs/07-frontend-components.md` (only where the build differs from Task 1's text).

- [ ] **Retire the old tokens:** delete the aliases. Extend `design-tokens.test.ts`:
  - `no retired token remains`: `globals.css` defines none of the retired names, and no file under `src/` uses a class built on one (`bg-primary`, `text-text-muted`, `border-border`, `bg-bg-subtle`, `rounded-(--radius`, `xs:`, …).
  - `no made-up storefront text remains` (Review Focus 1): no value in `messages/th.json` contains "Switch 2", "สัปดาห์นี้", "ซื้อคู่กันบ่อย", "ถูกกว่าซื้อแยก", "คุ้มกว่า", "เครื่องประกันร้าน", "เลขพัสดุ", "รอข้อมูลจากร้าน" or "เบอร์ร้าน".
- [ ] **Remove dead code:** `Icon` names with no remaining user (`gamepad`, `switch`, `cpu`, `headphones`, `keyboard`, `mouse`, `share`, and any other a grep finds unused), and message keys with no user (checked by grep, both files).
- [ ] **Run everything:** typecheck, lint, the unit and DOM tests, the integration tests against the dev database, and `next build`. Every existing test passes or was updated by a task above, with the reason in that task.
- [ ] **Visual pass, by a person, in a real browser:** each page beside its mockup page at 1440, 1180, 1024, 860, 390 and 360px, in Thai and English. Record what differs and why in *Outcome*.
- [ ] **Docs aligned:** where the build differs from Task 1's text, update `07`, the glossary and the D-rows in the same commit.
- [ ] **Commit:** `chore: retire the old design tokens and record the redesign checks`

---

## Manual test checklist

Run by a person against the dev server with the mirror loaded and a signed-in dev account. Never tick a box for a check nobody performed.

- [ ] Home at 1440px and 390px, Thai and English, beside `tinzshop-redesign/index.html`: the blocks in order (hero, tiles, kits, banners, best sellers, reasons, consult band, news); no pre-order list, no store-visit block, no chat sample, no "Switch 2", the cart shows 0.
- [ ] Signed out, the hero shows "สมัครสมาชิก"; signed in, it does not, and the header shows "สวัสดี คุณ{name}".
- [ ] A best-seller chip opens the listing for that platform sorted by best selling; "ลดราคา", "เครื่องเกมอื่น ๆ · ของเล่น", "สินค้าลดราคา" and "เคส & ฟิล์ม" go nowhere.
- [ ] At 390px: the menu button opens the drawer; Tab stays inside; Escape closes it and focus is back on the button; the page behind does not scroll; "English" switches language on the same page.
- [ ] Keyboard only, at 1440px: skip link, top bar (the articles menu opens and closes as before), search (Enter does nothing), account menu, nav, a product card (one tab stop for the name, then the heart and the cart button, which do nothing).
- [ ] Listing at 390px: "ตัวกรอง" opens the sheet; ticking มีสินค้า filters the results behind it and the sheet stays open; a typed price applies on Enter with focus kept; "แสดง N รายการ" closes it; rotating or widening to 1024px+ shows the sidebar and no sheet. The presets give ≤ ฿1,999, ฿2,000–9,999 and ≥ ฿10,000.
- [ ] Listing at 1440px: sort, grid/list, chips, "ล้างทั้งหมด" and pagination behave as before; "แสดง 1–24 จาก N รายการ" is right on the last page.
- [ ] Product page at 1440px and 390px beside `product.html`: the platform tag, price box, options, buy row (inert), assurances, ask block; four tabs work with the arrow keys; at 390px the bottom bar shows the price of the chosen variant and changes when another is picked; a sold-out variant still shows its price (D-121).
- [ ] Signed out, `/th/product` and a product page still send you to sign-in and back after signing in.
- [ ] News list, a category and an article at 1440px and 390px beside `news.html`: tabs scroll with the arrows, the feature block, the 2-column grid, pagination; the sidebar's "ดูสินค้าพรีออเดอร์" opens the pre-order listing; no ranking.
- [ ] Sign-in and register at 1440px and 360px beside `login.html` and `register.html`: the perks panel shows no wishlist perk; "แสดง" reveals the password and "ซ่อน" hides it; the rules tick as you type; a wrong password keeps the email, empties the password field and hides it again; register works end to end; verify and forgot password show the card alone.
- [ ] Fonts: in the browser's network panel, every font comes from this site; Thai headings are Anuphan and body text IBM Plex Sans Thai; stacked marks in "ชิ้นใหญ่", "ผ่อนชำระ" and "ปี่" are not clipped in headings.
- [ ] Contrast: a contrast checker reads at least 4.5:1 on the LINE buttons (ink on `#06C755`), the muted text on `page`, white on `brand` and `sale`, and `on-navy-2` on `navy`.
- [ ] At 390px and 360px: every link and button outside running text is at least 44px tall (top bar, breadcrumbs, chips, filter rows, banner links, footer links); the top bar and the footer chips line up with the page edge; nothing scrolls sideways on any page.
- [ ] With "reduce motion" on in the operating system: no hero entrance, no card lift, the drawer and sheet appear without sliding.

## Outcome

Not started.

## Not in this plan

- Cart, checkout, account, order history, order tracking, warranty form and content pages: later plans. Their links stay inert.
- The pre-order list with release dates and deposits (plan 005, Q-041) and a dropship stock state (plan 005).
- The store-visit block, the shop's phone, email, opening hours and address (REQ-045, data unknown), and a LINE handle.
- Customer reviews and ratings (REQ-054, phase 6).
- Search (REQ-002) and the wishlist (backlog, D-089).
- Any change to the category tree: a Switch 2 platform, other consoles and toys, a sale listing, a cases type (Q-062).
- The card's category line, the product page's model code, related news on the product page.
- Any server change other than R9's landing limits.
- The admin.
