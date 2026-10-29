# News: database, import from the old site, and news pages — design

- **Date:** 2026-10-29 · **Status:** proposed, awaiting the project owner's review
- **Requirement:** REQ-047 (game news, staff-written, in categories). Customer product reviews stay separate (REQ-054).
- **Design file:** `design/news.html` (the news list). There is no design for a single article; it follows the site's style.

## 1. Intent

The shop's current site, `https://www.tinzshop.com/news/`, holds the game news the client already publishes: 43 list pages. The new site must carry that news on day one, organised by the same categories:
- clicking **News** (or the nav's "ข่าวเกม") shows every article together
- clicking a category shows that category's articles

This change designs the news tables, imports everything from the old site, and builds the news pages.

## 2. Owner decisions (2026-10-29)

- **O-1, Reviews category:** the old "Reviews" category (37 posts, such as "รีวิว Mobapad HuBen 2") holds **staff-written** articles, so it is imported as a news category. D-084 / REQ-047's "product reviews is not a news category" concerns **customer** reviews (REQ-054) only.
- **O-2, import mode:** a one-time import that can be **re-run safely until go-live**. A re-run adds new posts and updates changed ones. After go-live, staff write news in our own admin, which is a later plan; the old site is then never read again.
- **O-3, images:** keep the old site's image URLs for now, like Shopee images (spec 2026-10-26 O-5). They must be copied before the old site is shut down. File storage is not chosen yet (ADR-0002, phase 7).
- **O-4, bloggers write news on our site after go-live,** so the tables are built for authoring from the start. The editor itself is a later plan, together with staff sign-in (plan 002).
- **O-5, publishing:** a blogger publishes their own article; no approval step. An Admin can also edit or unpublish.
- **O-6, scheduling:** a blogger can publish now, or set a future publish time, and the article appears on the site automatically at that time.
- **O-7, ownership:** any blogger can edit or delete any article, not only their own.
- **O-8, byline:** the article shows the writer's display name ("โดย …"). For imported posts this is the old WordPress author's display name.

## 3. What the old site offers (verified 2026-10-29)

- **Platform and API.** The site is WordPress, with the public REST API open at `https://www.tinzshop.com/wp-json/wp/v2/`. No login is needed for published posts.
- **Posts.** 540 published posts. The `News` category holds 488. Each post has:
  - `id`, `slug` (percent-encoded Thai), `link`, `date` / `date_gmt`, `modified_gmt`
  - `title.rendered`, `excerpt.rendered` and `content.rendered` (HTML)
  - `categories` (several per post), `featured_media` and `author`
- **Categories.** 13 categories form a tree, each with `id`, `parent`, `count`, `slug` and `name`:
  - **News** (488) has three children: NINTENDO (106), SONY Playstation (30) and บทความ (64).
  - **Reviews** (37) has Nintendo (22) and PS5 (12).
  - **Products** (9) has PS5 GAME (21).
  - **Top level:** Nintendo Switch 2 (415), gulikit (20), เกี่ยวกับ Tinzshop (1) and Uncategorized (5).
- **Tags.** 258 tags exist. They are not imported (YAGNI; no design shows them).
- **Language.** All content is Thai.
- **Authors.** `/wp-json/wp/v2/users` is public and gives each author's display `name`; posts carry an `author` id. Real staff names must never be committed (test fixtures use invented names).

## 4. Data model (new tables)

Naming follows the catalogue pattern (D-014): snake_case, singular, uuid ids, and a translation table per locale.

**`news_category`**
- `id`
- `slug`, unique, decoded from the old site
- `parent_id`, nullable, self-reference
- `position`
- `source_id`, the WordPress category id, unique and nullable, so a re-import matches it again
- `created_at`, `updated_at`

**`news_category_translation`**
- `category_id`, `locale` (th / en), `name`
- unique (`category_id`, `locale`)

**`news_article`**
- `id`
- `slug`, unique, decoded
- `featured_image_url`, nullable, the old-site URL (O-3)
- `source_id`, the WordPress post id, unique and nullable
- `source_url`, the old `link`, kept for a future redirect map
- `source_modified_at`, the `modified_gmt` value, which tells a re-import what changed
- `status`, enum `news_article_status`: `draft` or `published` (the owner's set, O-5). Imported posts are `published`.
- `published_at`, nullable, required when `published`; imported from `date_gmt`. **An article is live when `status = 'published'` and `published_at <= now()`**, so a future time is a scheduled article (O-6), and no extra status or job is needed.
- `byline_name`, the display name shown as "โดย …" (O-8), copied when the article is saved; imported from the WordPress author's `name`
- `author_staff_id`, nullable uuid: the staff member who wrote it. The FK to `staff_user` is added by the staff sign-in plan (002), because that table does not exist yet. It is null for imported posts.
- `created_by_staff_id`, `updated_by_staff_id`, nullable uuids, same FK note; together they record who changed the article (O-7)
- `deleted_at`, nullable: deleting is soft, so an article deleted by mistake can be restored, and order lines and links never dangle. A deleted article is never shown.
- `created_at`, `updated_at`

**`news_article_translation`**
- `article_id`, `locale`
- `title`
- `excerpt`, plain text
- `body_html`, sanitised HTML
- unique (`article_id`, `locale`)

**`news_article_category`**
- `article_id`, `category_id`
- composite primary key

Notes:
- **Bilingual writing.** Bloggers can write `th` and `en` translations; imported posts have `th` only.
- **Indexes.** Add an index on (`status`, `published_at` desc) where `deleted_at` is null, for the list pages. `news_article_category` gets an index on `category_id`.
- **Not stored now:** revision history, tags, comments and SEO fields beyond the excerpt. They can be added when the editor plan needs them.
- **Images written by bloggers** need file storage, which is not chosen yet (phase 7). Until then the editor plan can only take image URLs.

## 5. Import

- **Adapter:** `src/server/adapters/wordpress/`. Only this folder knows WordPress, and it maps posts to a neutral `NewsArticleSnapshot`.
- **Base URL:** from config `NEWS_IMPORT_SOURCE_URL`, documented in `.env.example`. It is not a secret.
- **Service:** `src/server/services/news/news-import-service.ts`. Repositories live in `src/server/repositories/news/`.
- **Order:** import categories first, so parents exist. Then import posts, 100 per page, every page.
  - Each post is upserted by `source_id` in one transaction, together with its category links.
  - An unchanged `source_modified_at` skips the update.
  - Nothing is ever deleted. A post gone from the source stays as it is.
- **Body HTML is sanitised at import with an allow-list:**
  - **Allowed:** headings, `p`, lists, `a` (http/https only, `rel="noopener"`), `img` (http/https `src`, `alt`), `figure`/`figcaption`, `blockquote`, `strong`/`em`, `table`, and `iframe` only from YouTube embed URLs.
  - **Stripped:** every script, style, event handler and other attribute.
  - The excerpt becomes plain text.
- **Run:** `POST /api/jobs/news-import`, with `Bearer JOB_SECRET` like the Shopee sync. It is safe to re-run, works in every environment (it must also run once at go-live), takes an advisory lock, and returns `{ categories, created, updated, unchanged, failed }`.
  - One post that fails is counted in `failed` and does not stop the run.
- **Politeness:** requests run one after another, never in parallel.
- **Done when:** the import lands every published post, about 540, and every category, and a second run reports 0 created and 0 updated.

## 6. Pages

- **`/{locale}/news`**: every live article (published, `published_at` reached, not deleted), newest first, 12 per page, `?page=n`. The layout follows `design/news.html`:
  - breadcrumb, then title and subtitle
  - **category tabs**: "ทั้งหมด" plus each category that has articles, with its count
  - a **feature block** of the 3 newest articles on page 1
  - the **ข่าวล่าสุด** grid
  - **pagination**
- **`/{locale}/news/category/{slug}`**: the same layout, filtered. A category includes its **descendants' articles**, so clicking "News" shows everything under News.
- **`/{locale}/news/{slug}`**: the article page:
  - breadcrumb, category label(s), title, byline "โดย {byline_name}", date (Thai Buddhist year on `/th`, D-118), featured image and sanitised body
  - "ข่าวที่เกี่ยวข้อง": up to 3 other articles from the same category
- **Not found:**
  - an unknown slug or category answers a real 404 (D-120, D-122)
  - a page number past the end answers a 404
- **Other pages:**
  - the landing page's **ข่าวเกมล่าสุด** section comes back (left out earlier for lack of data, D-124), with the 3 newest articles
  - the nav item "ข่าวเกม" links to `/{locale}/news`
- **English:** articles exist only in Thai, so `/en` shows the Thai title and body through the same fallback rule as products (Q-018 residual). Page chrome is English.

## 7. Non-goals

The staff news editor and admin (a later plan, built on these tables together with staff sign-in), comments, tags, search, redirects from old URLs (`source_url` is kept to build them later), copying images, and RSS.

## 8. Risks

1. **Old-site images may break** when that site goes down (O-3). They must be copied before shutdown.
2. **WordPress HTML varies.** Sanitising may drop embeds the allow-list does not know. The importer reports how many posts lost an `iframe` or `script`, so nothing disappears silently.
3. **Rate limits on the old site are unknown.** Requests are sequential and paged at 100.
