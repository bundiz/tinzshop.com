# Frontend Component Standard

The rules every component in Tinzshop follows.

React and Next.js App Router, decided by
[ADR-0001](adr/ADR-0001-backend-approach.md). Files live where
`04-tech-stack-and-structure.md` says they live.

## Server first

**Every component is a Server Component unless it needs to be otherwise
(D-030).** `"use client"` is added for one of exactly four reasons:

1. It uses state or an effect.
2. It handles a browser event.
3. It uses a browser-only API.
4. It uses a hook that requires one of the above.

Nothing else qualifies. "It felt easier" is not a reason, and neither is
"everything else in the folder has it".

**Push `"use client"` down, never up.** A product page is a Server Component
that fetches once and renders; only the variant picker inside it is a Client
Component (REQ-003). Marking the page instead sends the whole subtree to the
browser, including the price formatting and the catalogue data used to produce
it.

A Server Component may import a Client Component. The reverse only works by
passing it as `children`, which is usually the shape you actually wanted.

## The three tiers

Components live in exactly three places (D-033).

| Tier | Where | Knows about | Example |
| :--- | :--- | :--- | :--- |
| **1 — Primitive** | `src/components/ui/` | Nothing. No product, no order, no baht | `Button`, `Input`, `Dialog`, `Table` |
| **2 — Domain** | `src/components/domain/` | The domain, used by more than one route | `PriceDisplay`, `StockBadge`, `ProductCard` |
| **3 — Route-owned** | Beside the route that uses it | Everything about that one screen | `VariantPicker` (product page), `CheckoutSummary` |

**Rule of second use.** A component is born in tier 3. It moves to tier 2 the
first time a *second* route genuinely needs it — not when someone anticipates
that it might. A component generalised for one caller acquires props that
exist for a use case that never arrives, and every later caller has to read
past them.

Movement is upward only. A tier-1 primitive that grows domain knowledge has
been misfiled; split it.

### No component library

Deliberate, and the one place this project takes on more work than it has to.

The admin needs an editable data grid with inline and multi-row editing
(REQ-037), the storefront needs a variant picker with no page reload
(REQ-003), and everything must work in Thai and English (REQ-007, REQ-033).
Thai text runs longer than English, wraps differently, and has no word spaces —
which is where a library's fixed-width table cells and truncation rules break
first. We would be overriding the library at exactly the points that matter,
which is more work than owning a small set of primitives.

If this is revisited, it is a `D-0NN` decision in `11-decisions.md`.

## Component contract

Every component file, in this order:

```tsx
// 1. Imports — external, then internal, then types
// 2. Props type — exported, named <Component>Props
// 3. The component — one default export, named
// 4. Local subcomponents, if any and only if unexported
```

### Props

| Rule | Why |
| :--- | :--- |
| Props are an explicit named type. Never inline, never `any` | The type is the component's contract and gets read far more often than the body |
| Required props first, optional after | The call site shows what matters |
| No boolean prop that flips more than one thing | `variant="danger"` beats `isDanger` plus `isBig` plus `isOutline` |
| Never spread unknown props onto a DOM element | `{...rest}` makes it impossible to know what a component renders |
| Pass values, not fetchers | A component that fetches cannot be rendered in a test or reused on another screen |
| Pass a `messageKey`, not a translated string, where the parent has no reason to know the language | See *Bilingual* |

### State

| Rule | Why |
| :--- | :--- |
| Server state is not client state | Data from the database is fetched in a Server Component. Copying it into `useState` creates a second version that goes stale |
| The URL holds anything a user should be able to share or return to | Category filter, page, search term, selected locale |
| `useState` is for genuinely local, genuinely transient state | Is this dropdown open |
| No global store | Nothing in this application has cross-route client state. A cart lives on the server, keyed by a cookie |
| No `useEffect` for fetching | If a Server Component can fetch it, it should |

### Money, dates and numbers

- **A price is only ever rendered by `PriceDisplay`.** It takes satang (D-010) and renders baht. No component formats money itself; that is how `฿1,995.00` and `1995 บาท` end up on the same page.
- Dates render through one formatter that knows the locale. Thai dates may need the Buddhist era — the source document itself is dated 2569 BE — and that decision belongs in one place.
- **How `PriceDisplay` formats (D-118).** `Intl.NumberFormat` for the page's locale with currency `THB` and the narrow symbol, so both languages show `฿`. A whole-baht price shows no decimals (`฿2,990`, as the design does); a price with satang shows two (`฿1,990.50`). A price range reads as one message with a placeholder, `shop.product.price.from` (`เริ่มต้น {price}`), never a prefix glued to the number.
- **Dates and years use the locale's own calendar, in Bangkok time (D-118).** On `/th` that is the Buddhist era, on `/en` the Gregorian year — the design writes `วางจำหน่าย 20 พ.ย. 2569` and `© 2569`. Dates go through next-intl's formatter (`{date, date, medium}` in a message), which takes the calendar from the locale; the footer's copyright year is the `year` part of the same `Intl` format, computed from the request's current date, never written into a message.
- **A struck-through original price shows only when it is above the price (D-123),** never when it is equal, lower or 0, and it carries visually hidden text from `shop.product.price.original` (`ราคาเดิม`), because a strikethrough is not announced by a screen reader.
- Never render a raw stock quantity on the storefront. `StockBadge` takes a status, not a number (REQ-006, D-024).

### The variant picker (D-121)

The product page is a Server Component; only `VariantPicker`, `Gallery` and
`ProductTabs` are Client Components. The picker receives the product's option
types and its **active** variants, already priced in satang, and keeps only the
current choice in `useState`.

- A value is **disabled** only when no active variant carries it at all — the customer cannot choose what Shopee does not sell.
- Picking a value that has no active variant with the other current choices moves those choices to the best active variant carrying it: in stock first, then cheapest. Disabling such a value instead (D-119, superseded) could make a variant unreachable — with only 1TB-Black and 2TB-White active, starting on 1TB-Black would disable both 2TB and White. `selectValue` holds this rule.
- If the variant a value leads to is sold out, the value stays **selectable** and reads `{value} (สินค้าหมด)` (`shop.product.option.soldOut`). Disabling it as the design mockup does would hide the variant's price; selecting it shows the price and the out-of-stock `StockBadge`, so the status is said in text, not only by a greyed control.
- The page opens on the cheapest in-stock active variant, else the cheapest active one, so its first price is one a customer can buy at when any exists.

## Design fidelity and inert controls (D-124)

**The storefront pages follow `design/index.html` and `design/product.html`
block for block,** on the project owner's instruction of 2026-10-28, including
controls whose feature does not exist yet. This replaces plan 011's earlier rule
that a control which does nothing is not shown.

- **An inert control looks exactly as designed and goes nowhere.** A link points to `#`, or to the real page when there is one (the logo and "home" go to `/{locale}`, a product card to its product page, "ข่าวเกม" in the nav and footer to `/{locale}/news`, D-138, and the utility bar's "บทความ ▾" menu to news categories, D-140). A button is `type="button"`. The header search is a `role="search"` form with no `action` whose `onSubmit` prevents submission (`SearchForm`, the one Client Component the header needs), so pressing Enter does nothing.
- **Never a made-up number.** The cart count is `0`, not the design's sample `3`. No rating stars, scores or review counts appear anywhere (spec O-6, only our own reviews); the product page's reviews tab is an empty state, `shop.product.reviews.empty`.
- **Data still comes from the database.** Prices, stock, names, images and the variant picker are unchanged. A section with no products is still not rendered, so the bundle and pre-order sections appear only when the mirror has kits or pre-orders. Related products on the product page are the best sellers without the current product, until categories exist to relate by.
- **The design's category line on a card (`card__cat`) is left out,** and the breadcrumb is home › name: the mirror holds no category names yet.
- **Left out on purpose:** the design's mockup notice bar and the footer's mockup disclaimer. The news section ("ข่าวเกมล่าสุด") is back since plan 012 (D-138).
- **Every string is a message key,** with the Thai text exactly as the design writes it. Category names shared by the nav, rail, tiles and footer live once under `shop.category`.
- **Icons are the design's inline SVG set,** in the tier-1 primitive `Icon` (`src/components/ui/Icon.tsx`), always `aria-hidden`.
- **Breakpoints are the design's:** `xs` 480px, `sm` 640px, `md` 900px and `lg` 1100px, defined in rem in `globals.css`. Use these names, never `min-[…px]:` arbitrary variants: mixed with Tailwind's rem breakpoints those sorted out of order, and the card grid stayed at 3 columns on desktop. The design's grids are 2 / 3 / 4 / 5 columns for product grids and 6 cards across for a rail at `lg`.
- **Text sizes inherit the design's line height** (1.65): `globals.css` sets it for `text-xs`, `text-sm` and `text-base`, and headings are bold as in the design.

### News list pages (D-137)

`/{locale}/news` and `/{locale}/news/category/{slug}` follow `design/news.html` (plan 012 Task 5), built by `NewsListView` from `listNews`.

- **Blocks:** breadcrumb (home › ข่าวเกม, plus the category on a category page), the title (the category's name on a category page) and subtitle, the category tabs with counts, the feature block of the 3 newest on page 1 only (ruling R1, D-134), the "ข่าวล่าสุด" grid (1 / 2 / 3 columns) with pagination, and the sidebar beside it from `lg` (300px).
- **Only listed categories (D-139; D-141).** A category with `is_listed = false` (today Uncategorized and บทความ; the old site's review tree is listed, D-140) has no tab and no sidebar entry, is never a card's tag, a breadcrumb entry or a related key, and its category route is a 404, the same as an unknown slug. Its articles still appear under "ทั้งหมด" and **roll up into its listed ancestors**: a listed parent's page and tab count cover its whole subtree, unlisted descendants included, and a card whose only category is an unlisted child is tagged with the nearest listed ancestor (D-141). The pages never name a slug; they read `isListed` only.
- **Counts include descendants,** each article once, so a tab's count is what its page lists; tabs are ordered by count, then `position`.
- **A card's tag** is the article's most specific listed category: one that is no ancestor of another of its listed categories, by `position` when several are; none when it has no listed category.
- **The sidebar** keeps the design's "หมวดหมู่ข่าว" panel (real counts) and the pre-order panel, whose button is inert (D-124). "ข่าวยอดนิยม" is left out: nothing records which articles are popular, and a ranking is never made up.
- **Images** are the old site's URLs (D-127): a grid card's is `loading="lazy"`, a feature card's eager (D-123). A feature card with an image shows it under a dark wash with white text; one without keeps the design's gradient and icon. A grid card without an image shows `ImagePlaceholder` at 4:3.
- **Plain text only:** titles, excerpts and category names render as escaped text; no body HTML on these pages.
- **Tabs:** `NewsTabs` stays server-rendered (real links, current one `aria-current`); `NewsTabsScroller` (client) wraps it in a sideways strip with ‹ › buttons (`shop.news.tabs.scrollPrev`/`scrollNext`, 44px, 80% of the width per click, instant under reduced motion) shown only when that way can scroll (`scrollEdges`, 1px tolerance), and scrolls the current tab into view on load.
- **Not found:** `?page` must be a plain positive integer ("2", not "02" or "2abc"); anything else, a page past the end or an unknown category calls `notFound()`, rendered by `news/not-found.tsx` with `shop.notFound.*`. There is no `loading.tsx` above these routes (D-120). The category slug arrives percent-encoded and is decoded once (`decodeSlugParam`); links encode it once (`newsCategoryPath`). A malformed escape such as `%zz` is refused by Next with 400 before the page runs.
- **Titles:** `news/layout.tsx` sets `shop.news.meta.title`; the category layout sets the category's name, or the not-found title for an unknown one. A list page past the end keeps the list's title, since a layout does not see `?page`.
- **Empty:** an empty list or category still answers page 1, with `shop.news.empty` or `shop.news.categoryEmpty` in the grid; pagination is hidden for a single page.

### News article page and landing news (D-138)

`/{locale}/news/{slug}` (plan 012 Task 6) is built by `NewsArticleView` from `getNewsArticle`. There is no design file for it; it uses the site's breadcrumb, white panel and type.

- **Blocks:** breadcrumb (home › ข่าวเกม › title), then in one panel with a 760px reading column: the article's listed category labels (links to their category pages, in `position` order; D-139), the title (`h1`), the byline and date, the featured image and the body; below the panel, "ข่าวที่เกี่ยวข้อง". No sidebar.
- **Byline:** `shop.news.byline` ("โดย {name}") with the stored `byline_name`, or with `shop.news.bylineFallback` ("ทีม Tinzshop") when it is null (D-132).
- **The body is the only HTML rendered from data** (`ArticleBody`, `dangerouslySetInnerHTML` on the stored, already-sanitised `body_html`, D-133, D-135). Titles, excerpts, category names and the byline stay escaped text. At render time `lazyEmbeds` adds `loading="lazy"` to each `<img>` and `<iframe>` start tag, and `titleIframes` gives each `<iframe>` the title `shop.news.videoTitle` (escaped; the sanitiser keeps no iframe `title`, so none is doubled); the stored value is never changed. Sanitised HTML always escapes a literal `<`, so those strings only start real tags; this is why every writer of `body_html` must pass through the sanitiser (05). Styling is a class list of descendant variants (`[&_p]:…`), since Tailwind's preflight resets every element: iframes are full width at 16:9, images never exceed the column, and a wide table scrolls inside itself with its words kept whole.
- **Images:** the featured image is `loading="eager"` (D-123); body images and iframes are lazy.
- **Related:** up to 3 (`RELATED_NEWS_LIMIT`) other live articles, newest first, from each of the article's most specific listed categories in turn (the same leaf rule as a card's tag, D-137, D-139), in `position` order so the tag's category comes first, then filled up from its listed parent categories only when those give fewer than 3; never the article itself. Relating by every category at once would show the same newest articles under every post, since almost all carry the top-level one and broad leaves such as บทความ. Shown as cards without excerpts (`NewsCardSection`); the section is left out when there are none.
- **Not found:** the slug arrives percent-encoded and is decoded once (`decodeSlugParam`); an unknown, draft, scheduled or deleted slug calls `notFound()`, rendered by `news/not-found.tsx`. `news/[slug]/layout.tsx` sets the title (`shop.news.meta.articleTitle`) and the excerpt as description, or the not-found title, through the per-request `readNewsArticle`. A slug `category` would be shadowed by the category route; none exists today.
- **Landing:** "ข่าวเกมล่าสุด" (`shop.news.landing.*`) is `NewsCardSection` with the 3 newest live articles (`listLatestNews`) and the design's "อ่านทั้งหมด" link to `/{locale}/news`, after the product sections; it shows even when there are no products, and is not rendered when there are no articles or when the read fails (`readLatestNewsOrNone` logs the error's name only and the page still renders).
- **Nav:** "ข่าวเกม" links to `/{locale}/news` and is drawn current (`activeNav="news"`) on the list, category and article pages.

### The articles menu (D-140)

The utility bar's "บทความ ▾" replaces its "ข่าวเกม" link (owner, 2026-10-29); the nav's "ข่าวเกม" stays.

- **Items:** one constant, `ARTICLES_MENU` (`_components/articles-menu.ts`), of `{ labelKey, slug }`: รีวิวสินค้า (`reviews`), สินค้า (`products`) and News (`slug` null, `/{locale}/news`) with a submenu of the categories `nintendo-switch-2`, `nintendo` and `sony-playstation`. Labels are `shop.header.articles.*`; the submenu links use the categories' names from the database.
- **Never a 404 link:** `buildArticlesMenu` keeps an item or submenu link only when its category is listed (`listListedNewsCategories`). Each page reads the menu through `readArticlesMenu(locale)` (React `cache`, one read per request; `readRequestArticlesMenu()` on a not-found screen) and passes it to `SiteHeader` as `articlesMenu`. A failed read never breaks the page: `readListedCategoriesOrNone` logs the error's name only and the menu keeps only News.
- **Behaviour:** `ArticlesMenu` is a Client Component (it handles events) and a disclosure, not an ARIA `menu`: a `type="button"` with `aria-expanded` and `aria-controls`, and the News row has its own submenu toggle with the same attributes. It opens on mouse hover and on click, Enter or Space. A mouse click only opens, never toggles, since the hover before it has already opened the menu or submenu; the keyboard and a tap toggle (`activationPointer`). It closes on Escape wherever focus is (focus returns to the button when it was inside), when focus leaves it (also while the mouse rests over it; a blur is ignored only for a moment after a pointerdown inside, so a tapped link still works), when the mouse leaves it, and on a tap outside. Touch and pen never open it by hover, so at phone width it works by tap alone (`isHoverPointer`). The behaviour is the pure `articlesMenuReducer`, tested without a browser.
- **Layout:** it sits outside the help links, which are hidden below `sm`, so it is there on a phone, and first in the bar's right-hand group, so the submenu has room on its right. The panel is white on the dark bar, aligned to the button's right edge. Below `md` the submenu opens inside the panel, indented, its "›" turning down. From `md` it opens to the **right** of the panel, as on the old site (owner, 2026-10-29): flush against the panel's right edge, level with the top of the News row, with a "›" chevron (`md:left-full`). It flips left (`md:right-full`) only when, measured as it opens, it would run past the viewport's right edge (`shouldFlipLeft`). Every row is at least 44px tall.

## Bilingual

**Thai and English, on the storefront and in the admin, from the same
mechanism (D-031, REQ-007, REQ-033).**

- The locale is a URL segment: `/th/…` and `/en/…`. It is shareable, crawlable, and never guessed from a browser header.
- **No user-facing string is written literally in a component (D-032).** Every one comes from a message key in `messages/th.json` or `messages/en.json`. This includes button labels, placeholders, `aria-label`, alt text, validation messages, empty-state text and error text.
- Message keys are dot paths mirroring the route: `shop.product.addToCart`, `admin.order.status.label`.
- Both catalogues carry every key. A missing Thai key is a build failure, not an English word appearing mid-sentence on a Thai page.
- **Never build a sentence by concatenating translated fragments.** Word order differs. Use one key with placeholders.
- Pluralisation goes through the library. Thai has no plural form and English does; a component must not encode either.

### Designing for Thai

Thai is the primary language of this shop, and it breaks layouts English does
not:

- Thai has **no spaces between words**, so a long string will not wrap at all unless the container allows it. Fixed-width cells and `text-overflow: ellipsis` fail differently than they do in English.
- Thai has **taller line boxes** — vowels and tone marks stack above and below. Tight `line-height` clips them.
- Thai text is often **shorter than English** for the same content, and sometimes much longer. Never size a container to the text of one language.

**Check every screen in both languages before opening the pull request.** It
is on the review checklist in `09-coding-guidelines.md`.

## Forms

**Every form validates with the same Zod schema the server uses (D-034).** One
definition, imported by both. Client and server cannot disagree about what is
valid, because there is nothing to disagree about.

- Client validation is for speed of feedback. **It is never the enforcement.** The server validates every submission regardless.
- Errors attach to their field, in the user's language, from a message key.
- The submit button disables while submitting and the form survives a failure with the user's input intact. Retyping an address because the server said no is the fastest way to lose an order.
- Every input has a real `<label>`. A placeholder is not a label — it disappears exactly when the user needs it.
- Mutations go through Server Actions (`06-api.md`), never a hand-written `fetch` to our own routes.

## Loading, empty and error

**Every screen that loads data handles four states, not one.** The happy path
is the state least likely to be wrong.

| State | Requirement |
| :--- | :--- |
| **Loading** | A skeleton matching the real layout. Not a spinner in a blank page — the shift when content arrives is the jarring part |
| **Empty** | Say what is missing and what to do about it. "No orders yet" plus a next step, never a blank panel |
| **Error** | The `messageKey` from the `Result` (`06-api.md`), plus a way to retry. Never a raw error, never a stack |
| **Loaded** | The content |

**A page that can be `notFound()` has no loading skeleton above it (D-120).**
In Next 16 a `loading.tsx` boundary starts streaming with status 200 before the
page runs, so a later `notFound()` can only stream the not-found UI into a 200.
The product page therefore has no skeleton, and an unknown or hidden product
answers a real 404; the landing page's skeleton sits in the `(shop)/(home)/`
route group so it covers `/{locale}` only.

**An unmatched URL under a locale gets the site's own 404 (D-122).** Without
it, `/th/nope` showed Next's built-in English "This page could not be found".
The catch-all `src/app/[locale]/(shop)/[...rest]/page.tsx` calls `notFound()`,
and its `not-found.tsx` (`PageNotFound`) renders `NotFoundPanel` — header,
`shop.notFound.*` text in the locale, a link home, footer — with a not-found
`<title>` from the segment's `layout.tsx`. The product page's `ProductNotFound`
uses the same panel with `shop.product.notFound.*`. Every real route is more
specific than the catch-all, and `/api/**` sits outside the locale segment.

Empty and error states are written in the same pull request as the happy path.
They are not follow-up work; they are the states a user hits when something is
already going wrong.

## Responsive

**Mobile-first (D-035),** because REQ-009 requires every desktop function to
work on a phone — not a cut-down version of it.

- Base styles are the phone. Breakpoints add, never subtract.
- Tap targets are at least 44×44px.
- **The admin is included.** REQ-037's inline and bulk editing has to work on a phone. A wide data grid becomes stacked cards below the breakpoint; it does not become a horizontal scroll nobody can use.
- Test at 360px wide. That is a real phone, and it is where Thai text and a data table collide.

## Accessibility

Not a separate pass. Baseline, on every component:

- Semantic elements. A `<div>` with `onClick` is not a button and cannot be reached by keyboard.
- Every interactive element is keyboard-reachable, in a sensible order, with a visible focus ring. Never `outline: none` without a replacement.
- Every image has meaningful `alt`, from a message key. Decorative images get `alt=""`.
- Forms use real labels tied to their inputs.
- Colour is never the only signal. Stock status shows text as well as a colour (REQ-006), which also protects it against a red badge meaning "urgent" to one reader and "sold out" to another.
- A dialog traps focus, closes on `Escape`, and returns focus where it came from.

## Admin patterns

The back office carries the hardest requirements in this document.

### Product list (REQ-036)

Parents listed, expandable to variants. The expansion state is in the URL, so
a staff member editing a variant and going back does not lose their place.

### Inline and bulk editing (REQ-037)

- A cell becomes editable in place. `Escape` cancels, `Enter` commits, and the previous value is restored on failure.
- Selection is by checkbox with a select-all that selects **the filtered set**, not the current page, and says which it did.
- A bulk action states exactly what it will do to how many rows before it does it.
- Optimistic update, then reconcile with the server's answer. A failed write rolls the row back visibly and says why.

### Excel import (REQ-038)

The dry run is a first-class screen, not a checkbox. It shows what would be
created, what would be changed, and what failed with the row number and the
reason — before anything is written. See `05-database.md` for the transaction
that backs it.

## Undecided

| Area | Blocked on |
| :--- | :--- |
| Order status labels and their colours | Q-023 — a candidate set is proposed, not adopted |
| Which admin screens each of the six roles sees | Resolved in outline (D-062, D-063 — six fixed roles, owner edits permissions only); exact screen-to-permission mapping is phase 2 design work, not an open question |
| Whether product text is translated by staff or by us, and what shows when a translation is missing | Q-018 residual |

**Resolved since the last revision:** there is no low-stock badge — the
storefront shows in stock / out of stock only (D-065, Q-019). `StockBadge`
takes exactly those two states.
