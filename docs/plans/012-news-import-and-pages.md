# 012 — News: database, import from the old site, news pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

- **Status:** Implemented 2026-10-29; the owner's re-import (Task 7 Step 4) and the manual tests are outstanding
- **Phase:** 6 (news), as an early slice on the owner's request of 2026-10-29
- **Requirements:** REQ-047 (staff-written game news in categories)
- **Depends on plan:** 011 (site header and footer, `[locale]` routing, D-120/D-122 404 rules)
- **Spec:** `docs/superpowers/specs/2026-10-29-news-import-and-pages-design.md`. Read it first; §n below refers to it.
- **Branch:** `feat/win/news`

**Goal:** Our PostgreSQL holds every published post and category from `https://www.tinzshop.com/news/`, imported by a re-runnable job, and the site shows them at `/{locale}/news`, `/{locale}/news/category/{slug}` and `/{locale}/news/{slug}`, matching `design/news.html`.

**Architecture:**
- A WordPress adapter reads the public REST API and maps posts to a neutral `NewsArticleSnapshot` with sanitised HTML.
- A framework-free import service upserts snapshots through news repositories under an advisory lock.
- Server Components render the pages through a news read service.

**Tech Stack:** Next.js 16.4.3, next-intl 4.14.9, Tailwind 4.3.3, Prisma 7.10.1, Zod 4.6.7, `sanitize-html` 2.18.1 (+ `@types/sanitize-html` 2.16.2), Vitest 4.1.12.

## Global Constraints

- Pin exactly, versions at least two weeks old: `sanitize-html` 2.18.1 and `@types/sanitize-html` 2.16.2. Install with `npx npm@11.21.0 install --save-exact …`; `npm ci` with npm 10.8 must still work.
- Layers and module folders (D-101, D-116):
  - `src/server/adapters/wordpress/` is the only place WordPress is named.
  - `src/server/services/news/` imports nothing from `next`, `react`, `@prisma/*` or `sanitize-html`; sanitising lives in the adapter.
  - `src/server/repositories/news/` is the only Prisma user.
  - `src/server/controllers/news/` holds the controllers.
- Table and column names exactly as spec §4, with glossary rows (D-014, hard rule 3).
- Body HTML is stored already sanitised (spec §5 allow-list) and rendered only from that stored value. No other HTML from the source is ever rendered.
- Every user-facing string comes from `messages/th.json` + `messages/en.json`, with parity (D-031, D-032). Article titles and bodies are data.
- A real 404 for an unknown article or category and for a page past the end. No `loading.tsx` may sit above these routes (D-120).
- Dates go through the existing locale formatter: Buddhist year on `/th` (D-118).
- Images: plain `<img loading="lazy">` with the old-site URL (O-3). The feature or hero image is eager (D-123).
- The import job: `POST /api/jobs/news-import`, with `Bearer JOB_SECRET` checked in constant time, in every environment. It runs under an advisory lock, and a concurrent call returns `{ outcome: 'skipped' }`. It is documented in `docs/06-api.md` + `docs/openapi.yaml` (D-115).
- Requests to the old site run one after another, never in parallel, at 100 per page. `User-Agent` is `TinzshopNewsImport/1.0`.
- Never read `.env`. The base URL comes from config `NEWS_IMPORT_SOURCE_URL` (non-secret), with a placeholder in `.env.example`.

## Review Focus

1. **Hostile or messy HTML.** A post body containing `<script>`, `onerror=`, `javascript:` links, `<style>`, or an iframe from a non-YouTube host must come out without them. YouTube embeds and images survive. Owner: Task 3, test `sanitises the body to the allow-list`.
2. **Re-running the import.** A second run with unchanged sources reports 0 created and 0 updated and keeps every `id`. A post whose `modified_gmt` changed is updated in place, with its categories re-linked. Owner: Task 4, test `is idempotent and updates only changed posts`.
3. **Parent categories include their children.** `/news/category/news` lists the articles of NINTENDO, SONY Playstation and บทความ too, with no duplicates when a post is in both parent and child. Owner: Task 5, test `includes descendant categories without duplicates`.
4. **Percent-encoded Thai slugs.** `%e0%b8%9a…` is stored decoded (`บทความ`) and round-trips through links and URL params. Owner: Task 3 and Task 6, tests `decodes slugs` and `opens an article by a Thai slug`.
5. **One bad post.** A post that fails to map or save is counted in `failed` and the rest are imported. Owner: Task 4, test `counts a failed post and continues`.

---

## File map

| File | Responsibility | Task |
| :--- | :--- | :--- |
| `docs/**`, `CLAUDE.md`, `.env.example` | Decisions, glossary, scope, config | 1 |
| `prisma/schema.prisma`, `prisma/migrations/*_news/` | News tables (spec §4) | 2 |
| `src/server/adapters/wordpress/{client,schemas,map-post,sanitize}.ts` + tests, `__fixtures__/` | Read the WordPress API; produce snapshots | 3 |
| `src/server/services/news/{news-snapshot,news-import-service}.ts` + tests | Import rules | 4 |
| `src/server/repositories/news/news-repository.ts`, `src/server/controllers/news/news-import-controller.ts`, `src/app/api/jobs/news-import/route.ts` | Persistence and job endpoint | 4 |
| `src/server/services/news/news-read-service.ts` + tests, repository read functions | List, category and article reads | 5 |
| `src/app/[locale]/(shop)/news/**` | List and category pages | 5 |
| `src/app/[locale]/(shop)/news/[slug]/**`, landing news section, nav link | Article page; landing ข่าวเกมล่าสุด | 6 |
| schema `news_category.is_listed`, adapter exclusion rules, import/read changes | No review category; unlisted Uncategorized (owner, Q-048) | 7 |
| exclusion rules, `?full=1` import, SiteHeader บทความ dropdown | Staff reviews back as news; full re-import; header menu | 8 |

---

### Task 1: Record the decisions and names

**Files:** Modify `docs/11-decisions.md`, `docs/02-scope-and-phases.md`, `docs/05-database.md`, `docs/12-glossary.md`, `docs/14-integrations.md`, `CLAUDE.md` and `.env.example`.

- [x] **Step 1:** Add D-rows from D-125 for owner decisions O-1 to O-8 (spec §2) and for the WordPress REST API as the import source (spec §3, §5). Each row links to its owning doc:
  - news scope goes in a short Phase 6 note in `02`, naming plan 012
  - the old-site source goes in a new "Old tinzshop.com WordPress (news import)" section in `14`
  - the tables go in `05`
- [x] **Step 2:** Glossary rows:
  - the tables and columns in spec §4: `news_category`, `news_category_translation`, `news_article`, `news_article_translation`, `news_article_category`, `news_article_status` (`draft`/`published`), `source_id`, `source_url`, `source_modified_at`, `published_at`, `byline_name`, `author_staff_id`, `created_by_staff_id`, `updated_by_staff_id`, `deleted_at`, `body_html`, and the "live article" rule
  - "News import" / `news-import`
  - `NewsArticleSnapshot`
  - the three page routes
  - Extend the existing "News article" row rather than duplicating it.
- [x] **Step 3:**
  - In `CLAUDE.md`, allow plan 012 alongside 010 and 011.
  - In `.env.example`, add `NEWS_IMPORT_SOURCE_URL=` with a comment (non-secret, the old site's origin).
- [x] **Step 4:** Commit: `docs: record the news import and pages as plan 012`.

### Task 2: News tables

**Files:** Modify `prisma/schema.prisma`. Create a migration via `npx prisma migrate dev --create-only --name news`, then review the SQL. Test: `tests/integration/news/news-schema.test.ts`.

- [x] **Step 1: Write the failing integration test:**
  - `stores an article with translations and categories`
  - `rejects a duplicate slug` (article and category)
  - `rejects a duplicate source_id`
  - `allows a category tree via parent_id`
  - `rejects a published article without published_at` (CHECK constraint, hand-written SQL)
- [x] **Step 2:** Run `npm run test:integration`. It fails.
- [x] **Step 3:** Add the five models exactly as spec §4, with `@@map`/`@map` snake_case and uuid ids `@default(dbgenerated("gen_random_uuid()")) @db.Uuid`. `source_id` is `BigInt? @unique`. Reuse the existing `Locale` enum. Add the `news_article_status` enum, the CHECK `status <> 'published' OR published_at IS NOT NULL`, and the partial index on (`status`, `published_at` desc) where `deleted_at` is null. The `*_staff_id` columns are plain nullable uuids with no FK yet (plan 002 adds it). Create the migration, apply it to the dev and test databases (non-destructive), and check that `prisma migrate diff` is empty.
- [x] **Step 4:** Tests pass. Commit: `feat: add news tables`.

### Task 3: WordPress adapter

**Files:** Create `src/server/adapters/wordpress/client.ts`, `schemas.ts`, `map-post.ts`, `sanitize.ts`, the tests beside them, and `__fixtures__/` (real responses saved once from the live API: 2 posts with HTML, plus the categories list). **Replace every author name and the users list in fixtures with invented names** (hard rule 2: no real people's names in the repo). Modify `src/server/config.ts` (`NEWS_IMPORT_SOURCE_URL`, optional URL). Modify `package.json` (pinned `sanitize-html`).

**Interfaces:**
- `createWordPressClient({ baseUrl, fetch })` returns:
  - `listCategories(): Promise<WpCategory[]>`, all pages
  - `listPostsPage(page, perPage=100): Promise<{ posts: WpPost[]; totalPages: number }>`
  - `listAuthors(): Promise<Map<number, string>>` (id → display name)
  - `getMedia(id): Promise<{ sourceUrl } | null>`
- `sanitizeArticleHtml(html: string): { html: string; removedEmbeds: number }`
- `htmlToPlainText(html: string): string`
- `decodeSlug(s: string): string`
- `mapWordPressPost(post, mediaUrl: string | null, authorName: string | null): NewsArticleSnapshot` (status `published`, `bylineName` = author name, else the `shop.news.bylineFallback` text decided in Task 6: the snapshot carries `null`)
- `mapWordPressCategory(c): NewsCategorySnapshot`
- The snapshot types are declared in `src/server/services/news/news-snapshot.ts` (Task 4 uses them; create the file here, types only).

- [x] **Step 1: Write the failing tests:**
  - `sanitises the body to the allow-list` (Review Focus 1)
  - `keeps YouTube iframes and images`
  - `turns the excerpt into plain text`
  - `decodes slugs`
  - `maps a real fixture post` (title, date as UTC `Date`, category source ids, source_url, modified)
  - `zod rejects a post without id`
  - `client pages until totalPages and sends the User-Agent`
- [x] **Step 2:** Run the tests. They fail.
- [x] **Step 3:** Implement. Validate responses with Zod (loose objects). `X-WP-TotalPages` comes from the response headers. HTML entities in `title.rendered` are decoded.
- [x] **Step 4:** Tests pass. Commit: `feat: add the WordPress news adapter`.

### Task 4: Import service, repository and job

**Files:** Create `src/server/services/news/news-import-service.ts` and its tests, `src/server/repositories/news/news-repository.ts`, `src/server/controllers/news/news-import-controller.ts` and its tests, and `src/app/api/jobs/news-import/route.ts`. Modify `src/server/composition-root.ts`, `docs/06-api.md` and `docs/openapi.yaml`. Integration test: `tests/integration/news/news-import.test.ts`.

**Interfaces:**
- `runNewsImport(deps): Promise<NewsImportSummary>`
- `NewsImportSummary = { outcome: 'succeeded' | 'skipped' | 'failed'; categories: number; created: number; updated: number; unchanged: number; failed: number; removedEmbeds: number }`
- Repository: `upsertNewsCategories(snapshots)` (parents first), `upsertNewsArticle(snapshot)` returning `'created' | 'updated' | 'unchanged'`, and `findArticleSourceStates()`.
- Use a separate advisory lock key from the catalogue sync.

- [x] **Step 1: Write the failing tests:**
  - **unit:** `counts a failed post and continues`, and `fails the run when the category list cannot be read`
  - **integration:** `imports categories with parents and articles with links`, and `is idempotent and updates only changed posts` (Review Focus 2)
  - **controller:** 401 without the secret, 200 with the summary, `skipped` on concurrent runs
- [x] **Step 2:** Run the tests. They fail.
- [x] **Step 3:** Implement. Media URLs are fetched once per distinct `featured_media`. Nothing is ever deleted.
- [x] **Step 4:** Tests pass. Document the endpoint in `06` + `openapi.yaml`. Commit: `feat: add the re-runnable news import job`.

### Task 5: News list and category pages

**Files:** Create `src/server/services/news/news-read-service.ts` and its tests, add read functions to `news-repository.ts`, add `getNewsReader()` to `src/server/composition-root.ts`, and create `src/app/[locale]/(shop)/news/page.tsx`, `src/app/[locale]/(shop)/news/category/[slug]/page.tsx` and `_components/` (NewsTabs, NewsFeature, NewsCard, NewsGrid, Pagination). Messages go under `shop.news.*`.

**Interfaces:**
- `listNews({ locale, categorySlug?, page }): Promise<NewsListPage | null>`. It returns `null` for an unknown category or a page past the end.
- `NewsListPage = { items: NewsCardData[]; page: number; totalPages: number; total: number; categories: { slug; name; count }[]; activeCategorySlug: string | null }`
- Only live articles are read (`status = 'published'`, `published_at <= now()`, `deleted_at` null); test `hides drafts, scheduled and deleted articles`. The category filter includes descendants, distinct articles, newest first, 12 per page. Tabs list categories that have at least one article, ordered by count.

- [x] **Step 1: Write the failing tests:**
  - **service:** `includes descendant categories without duplicates` (Review Focus 3), `returns null past the last page`, `falls back to the th title on en`
  - **render:** the tabs mark the active one, and pagination links keep the category
- [x] **Step 2:** Run the tests. They fail.
- [x] **Step 3:** Build the pages to match `design/news.html`: breadcrumb, header, tabs with counts, the feature block of 3 on page 1, the grid, and pagination (`?page=n`). Use the site header and footer from plan 011. The page is `force-dynamic` and calls `notFound()` on `null`.
- [x] **Step 4:** Compare headless-Chrome screenshots against `design/news.html` at 1440 and 390 wide. Tests, typecheck and build pass. Commit: `feat: add news list and category pages`.

### Task 6: Article page, landing news section, nav link

**Files:** Create `src/app/[locale]/(shop)/news/[slug]/page.tsx` + `layout.tsx` (metadata, as for products, D-120) and `_components/`. Modify the landing `(home)/page.tsx` (bring back ข่าวเกมล่าสุด with the 3 newest, as in `design/index.html`, D-124) and the nav "ข่าวเกม" link. Messages go under `shop.news.*`.

**Interfaces:**
- `getNewsArticle({ locale, slug }): Promise<NewsArticleDetail | null>`
- `NewsArticleDetail = { slug; title; bylineName: string | null; publishedAt; featuredImageUrl; bodyHtml; categories: { slug; name }[]; related: NewsCardData[] }`. The page shows "โดย {bylineName}", or the message `shop.news.bylineFallback` ("ทีม Tinzshop") when it is null.

- [x] **Step 1: Write the failing tests:**
  - `opens an article by a Thai slug` (Review Focus 4)
  - `returns null for an unknown slug`
  - `related excludes the article itself, max 3`
  - landing renders the news section with 3 cards and hides it when there are none
- [x] **Step 2:** Run the tests. They fail.
- [x] **Step 3:** Implement. The body renders the stored sanitised `body_html` inside a prose-styled container, and this is the only place HTML is rendered. The "Not found" page uses `NotFoundPanel`.
- [x] **Step 4:** Tests, typecheck, integration tests and build pass. `/th/news/<unknown>` gives 404. Commit: `feat: add the news article page and landing news section`.

### Task 7: No review category in news; hide the Uncategorized tab (owner, 2026-10-29)

The project owner answered Q-048 on 2026-10-29: "เขียน blog/news ไม่มี review มีแค่ product ที่ให้ลูกค้า review". News has no review category; "review" means only customer product reviews (REQ-054). This **supersedes O-1 / D-125**. For Uncategorized: "just leave it, just show it when on the news page that does not query the category".

Facts in the dev database after the first import:
- The old site's review tree is "Reviews" (WP id 7, slug `reviews`) with its children "Nintendo" (15) and "PS5" (17).
- 43 articles are linked to that tree, and 3 of them only to it.
- "Uncategorized" is WP id 1, slug `uncategorized`.

**Files:**
- Modify `prisma/schema.prisma`, plus a migration adding `news_category.is_listed BOOLEAN NOT NULL DEFAULT true`.
- Modify the WordPress adapter (exclusion rules), the news import service and repository, the news read service and repository, and the news pages' category route.
- Docs: a new D-row superseding D-125, plus `13` (record the Q-048 answer), `05`, `14`, `07` and the glossary (`is_listed`, "excluded category", "unlisted category").

**Rules:**
1. **Excluded categories.** The WordPress category with slug `reviews` and all its descendants are *excluded*.
   - The import stores them with `is_listed = false` and never links an article to them.
   - On a re-run it removes existing links to them.
   - It deletes no category row.
2. **Articles in excluded categories only.** An article whose categories on the source are all excluded is not news.
   - The import sets its `deleted_at`, or leaves an already-set one; this is a soft delete, so it can be restored.
   - It is never shown.
   - If a later source version gives it a non-excluded category, the import clears `deleted_at` again, but only if the import set it. Record who set it by keeping the rule simple: before go-live, WordPress is the master, so the import owns `deleted_at` for imported rows (note this in the D-row).
3. **Unlisted category.** The WordPress category with slug `uncategorized` is stored with `is_listed = false`, and its links are kept.
   - Its articles still appear under "ทั้งหมด".
   - There is no tab for it, and it is never a card's tag.
   - `/{locale}/news/category/uncategorized` gives 404.
4. **Read side.** Tabs, card tags, breadcrumb categories and "related" use only listed categories. A category route for an unlisted slug is a real 404.
5. **Where the rules live.** The slugs live in one constant in the WordPress adapter, as `{ excluded: ['reviews'], unlisted: ['uncategorized'] }`, and are mapped into the neutral snapshot fields `isListed` and `isExcluded`. No WordPress slug appears in services or pages.

- [x] **Step 1: Write the failing tests:**
  - **adapter:** the `reviews` subtree is marked excluded and `uncategorized` is marked unlisted
  - **service/integration:**
    - re-running the import over the current DB removes the review links
    - it soft-deletes the 3 review-only articles
    - an article in News + Reviews keeps News only
    - Uncategorized articles stay listed under ทั้งหมด
  - **read:**
    - tabs exclude unlisted
    - `/news/category/reviews` and `/news/category/uncategorized` give 404
    - a card's tag is never an unlisted category
- [x] **Step 2:** Run the tests. They fail.
- [x] **Step 3:** Implement. Add the migration (non-destructive) and apply it to the dev and test databases.
- [x] **Step 4:** Tests, typecheck, integration tests and build pass. Commit: `feat: drop review categories from news and hide the Uncategorized tab`.
- [ ] **Step 4 (owner):** The owner re-runs the import over the dev database. Restart the dev server first: it caches the Prisma client from before `is_listed` existed, so until then the news pages and the import answer 500. Expected afterwards: 0 created and 0 updated, 43 articles lose their review links, the 3 review-only ones are soft-deleted, and `/th/news/category/reviews` and `/th/news/category/uncategorized` give 404.

### Task 8: Staff product reviews are news again; full re-import; บทความ dropdown (owner, 2026-10-29)

**Owner clarification of the Q-048 answer** (2026-10-29): "there is still รีวิวสินค้า, but the requirement means รีวิวสินค้า that a blogger creates. รีวิวสินค้าโดยลูกค้า (customer product reviews) is not about this feature; it is about the other feature (REQ-054)." So:
- the WordPress `reviews` category and its children are **news categories again**, listed, and shown as "รีวิวสินค้า";
- only customer reviews are a separate feature.

This supersedes the review part of D-139. Uncategorized stays unlisted. A new D-row is needed, citing D-125 (restored) and D-139 (partly superseded).

The owner's choices for the header menu:
- **"บทความ ▾"** in the utility bar (top dark bar), as on the old site:
  - **รีวิวสินค้า** → `/{locale}/news/category/reviews`
  - **สินค้า** → `/{locale}/news/category/products` (the old "Products" news category)
  - **News ›** → `/{locale}/news`, with a submenu of exactly **Nintendo Switch 2** (`nintendo-switch-2`), **NINTENDO** (`nintendo`) and **SONY Playstation** (`sony-playstation`)
  - No ข่าวประชาสัมพันธ์ item.

**State of the dev database** (the owner already re-ran the import after Task 7):
- `reviews` has `is_listed = false`
- 3 articles are soft-deleted by the rule
- review links were removed

A normal re-run skips unchanged posts, so it cannot undo this.

**Rules:**
1. **Exclusion rules.** `NEWS_CATEGORY_SLUG_RULES` becomes `{ excluded: [], unlisted: ['uncategorized'] }`.
   - Keep the excluded mechanism and its tests, using a fixture slug, so a future exclusion stays possible.
   - The category upsert must also set `is_listed` back to `true` for a category that is no longer unlisted.
2. **Full re-import.** `POST /api/jobs/news-import?full=1` (same secret) disables the unchanged-post skip.
   - Every post is mapped, saved and re-linked, and images are re-read.
   - A saved post that is not hidden by the rules has `deleted_at` cleared (the existing upsert behaviour, D-139).
   - Any other value of `full` gives 400.
   - Document it in 06 and openapi.
   - After the owner runs it once, the 3 articles return, Reviews is listed and all links are back.
3. **Dropdown.**
   - The menu items are a single config constant of `{ labelKey, slug }`.
   - The page reads the listed categories and renders only items whose slug exists and is listed. A missing category's item is not shown, so a link can never 404.
   - Labels come from messages (`shop.header.articles.*`). For the 3 submenu items, use their category names from the DB.
   - **Accessibility and mobile:**
     - It opens on hover and on click/Enter/Space, and closes on Escape and when focus or the pointer leaves.
     - It uses `aria-expanded` and is keyboard reachable.
     - At phone width it works by tap, with no hover dependency.
   - The utility bar's current "ข่าวเกม" link is replaced by "บทความ ▾". The category nav's "ข่าวเกม" stays.
   - Style it like the site (dark bar, white menu panel), not a copy of the old colours.

**Steps:**
- [ ] **Step 1: Write the failing tests:**
  - the rules constant, and a category that leaves `unlisted` becomes listed
  - `full=1` re-saves an unchanged post and restores a rule-hidden article with its links (integration test on a seeded "after Task 7" state); `full=abc` gives 400
  - the dropdown renders the configured items, hides a missing or unlisted one, and has correct `aria-expanded`/keyboard behaviour (render + interaction test)
  - the reviews category page gives 200 once listed
- [ ] **Step 2:** Run the tests. They fail.
- [ ] **Step 3:** Implement. Docs:
  - a D-row, plus a Q-048 note recording the clarification (quote it)
  - 02, 05, 06, 07, 14, the glossary, and spec O-1 (restored)
  - a CLAUDE.md decision range if it changes
- [ ] **Step 4:** Tests, typecheck, integration tests and build pass. Commit: `feat: staff product reviews are news again, full re-import, and the บทความ menu`.
- [ ] **Step 5 (owner):** run `POST /api/jobs/news-import?full=1` once (about 20 minutes), then check that Reviews is back and the dropdown works.

---

## Manual test checklist

Run by a person against the real old site and the dev database. Never tick a box for a check nobody performed.

- [ ] Run `curl -X POST -H "Authorization: Bearer $JOB_SECRET" http://localhost:3002/api/jobs/news-import`. It succeeds with about 540 articles and 13 categories, and `failed` is 0 or explained.
- [ ] Run it again: 0 created, 0 updated.
- [ ] `/th/news` shows the newest article first, and there are about 45 pages.
- [ ] `/th/news/category/news` includes NINTENDO and SONY Playstation articles.
- [ ] An article opens with images and its body. A YouTube embed plays.
- [ ] `/th/news/does-not-exist` gives 404.
- [ ] At 360px wide, nothing scrolls sideways.

## Not in this plan

Staff news editor/admin, comments, tags, search, old-URL redirects, image copying, RSS.

## Outcome

Implemented on branch `feat/win/news` (2026-10-29): the news tables, the WordPress adapter and import job, and the news list, category and article pages and the landing news section. After the owner's answer to Q-048 (D-139, superseding D-125) news has no review category and the old "Uncategorized" category is unlisted (Task 7). The final whole-branch review's findings were fixed in one pass: the featured image URL is kept only when it is an absolute http(s) URL, the iframe title is inserted literally, and the stale documentation and `.env.example` wording were corrected.

The import has been run once against the live old site (540 articles, 13 categories), before Task 7. The owner's re-run after Task 7 (Step 4), which applies D-139 to the stored articles, is pending, and so are the manual tests; no manual test box is ticked.
