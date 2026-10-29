# External Systems

Every external system named in `reference/client-summary-th.md`, in one file.

> **NOT RESEARCHED is the correct status for every system below.** It means
> nobody has read the vendor's documentation yet. Do not write API details,
> endpoints, pricing, rate limits or capabilities here from memory — look them
> up, then record what you actually found, cite where it came from, and change
> the status.

| Status | Meaning |
| :--- | :--- |
| **NOT RESEARCHED** | Named in the source. Nobody has looked at the vendor's documentation. |
| **RESEARCHED** | Documentation read; capabilities, limits and costs recorded with sources. Still not chosen. |
| **DECIDED** | An ADR in `adr/` records the choice. |

| System | Status | Needed for | Blocks |
| :--- | :--- | :--- | :--- |
| [K-Payment](#k-payment-kasikorn-bank) | NOT RESEARCHED — credentials in hand, sandbox testing next | Card payment, instalments, PromptPay QR — the **sole** payment method | Phase 3 |
| [BigSeller](#bigseller) | NOT RESEARCHED — account exists, data inspection pending | Stock management, daily file sync, shipping/fulfilment, labels | Phase 2 (SKU/Excel), Phase 5 (sync) |
| [Shopee](#shopee) | RESEARCHED — sandbox access since 2026-10-20; live go-live pending | Catalogue mirror: pull products, options, prices and stock every 10 minutes (D-094, D-095) | Phase 2 (plan 010) |
| [Old tinzshop.com WordPress](#old-tinzshopcom-wordpress-news-import) | RESEARCHED (2026-10-29) — public REST API, no login | One-time, re-runnable import of the old site's news posts and categories (D-126, D-133) | Phase 6 (plan 012) |
| [Mail relay](#transactional-email) | NOT RESEARCHED — category decided, provider not chosen | Automatic email at every order step | Phase 3 |
| [Cloudflare](#cloudflare) | DECIDED — Free plan, security/bot scope only | Security, bot verification | Phase 8 |
| [LINE](#line) | NOT RESEARCHED | Displaying the shop's LINE contact | Phase 6 |

**Removed from this list, per the 2026-09-13 answers:**

| Was | Removed by |
| :--- | :--- |
| Shipping carrier (direct integration with Flash / Kerry / Thailand Post) | Q-034, D-075 — shipping is handled entirely through BigSeller |
| PromptPay, standalone | Q-029, D-071 — PromptPay exists only as a QR option inside K-Payment |
| Bank transfer / payment-slip verification | Q-030, D-072 — K-Payment is the sole payment method |

**How these are built.** Each system gets one adapter directory under
`src/server/adapters/<system>/`, implementing an interface the domain declares
(`04-tech-stack-and-structure.md`). No vendor name appears anywhere else in the
codebase. That is what lets phases 2 and 3 proceed while every system on this
page is still unresearched.

### Rules for this file

1. Record only what the source says we need the system for.
2. Record what we do not know as an explicit list, not as silence.
3. **Never write a credential here.** Name what credential is needed and who must supply it.
4. When research is done, change the status in the table and in the section in the same commit, and cite where each fact came from.

---

## K-Payment (Kasikorn Bank)

- **Status:** NOT RESEARCHED — merchant/test credentials already supplied, sandbox testing is the next step · **Named in:** §3, and phase 1 of §11 as a research subject · **Blocks:** Phase 3

### What we need it for

**K-Payment is the sole payment method for this project** (Q-030, D-072 — bank
transfer and standalone PromptPay are both removed). Customers pay by credit
or debit card, by card in instalments, or via PromptPay QR, all reached
through K-Payment, and the system updates payment status automatically from
its callback with no staff action (REQ-016). The §3 discussion notes describe
the customer being linked out to Kasikorn for this. The notes record that this
method carries a fee.

Instalments are confirmed in scope (Q-003, D-089). Refunds are explicitly out
of scope for this system regardless of payment method (Q-036, D-077) — nothing
here needs to push money back out through K-Payment.

### What we do NOT know

- Everything about the interface. No endpoints, no data formats, no callback mechanism, no signing scheme, no error or retry behaviour — the credentials exist, but nobody has exercised them against the sandbox yet.
- Fees and settlement timing.

### Credential required

A K-Payment merchant account and test credentials — §12 item 5. **Already
supplied** (Q-033). Placeholder variable names exist in `.env.example`; they
are guesses until the real interface is read and will change. **Never commit
real values.**

### What it blocks

Phase 3 in full, since it is now the only payment method and phase 3 is where
the shop starts selling. The immediate next step is sandbox testing, not
further research — see `13-open-questions.md`'s residual items. The webhook
rules in `06-api.md` describe what any such integration needs; none of them is
a claim about K-Payment's actual behaviour until that testing happens.

---

## Shopee

- **Status:** RESEARCHED (2026-10-26) · **Named in:** §4, and phases 1 and 5 of §11 · **Blocks:** Phase 2 catalogue mirror (plan 010); phase 5 for pre-order and dropship specifics

### What we need it for

The site mirrors Shopee's catalogue: a background job pulls products, variants,
options, photos, prices and stock from the Shopee Open API every 10 minutes
(D-094, D-095), and storefront pages never call Shopee. The site writes nothing
to Shopee. Stock reaches Shopee from BigSeller, and the site reads it back
(REQ-021, D-096). The design is
[the catalogue mirror spec](superpowers/specs/2026-10-26-shopee-catalogue-mirror-database-design.md).

### What was researched

Sources read, and the sandbox work of 2026-10-20 (Test Partner, sandbox shop;
real responses captured with `scripts/shopee-sandbox/`):

- **Shopee Open Platform developer-guide/20 and developer-guide/644**, read for the catalogue and authorization design.
- **`v2.product.init_tier_variation`** — two option tiers at most; a third was tested in the sandbox and rejected (spec §2, consequences of O-1). Recorded in Q-013.
- **`v2.product.add_item`** — read, with the sandbox, to see how a Shopee listing is created and what the item, price and stock fields look like when read back.
- **`v2.product.add_kit_item`** — a set can be a *kit item*: a listing built from other items' models with quantities, marked `tag.kit` by `get_item_list`. The sync records it as `channel_item.is_kit`; components are not modelled (spec §2, consequences of O-10). On the storefront a kit is a product like any other: it has its own page and appears in ชุดโปรโมชั่น, and the product page shows the promotion-set badge when `is_kit` is true. Its components and quantities are not stored, pending Q-058: `v2.product.get_kit_item` returned `error_not_found` in the sandbox and `add_kit_item` failed there (request id `e3e3e7f35ee4b1f520cdd1b6c5fea800`).
- **`v2.bundle_deal.add_bundle_deal`** — Shopee bundle deals are discount rules (fixed price, percent or baht off when buying at least N, with start and end times), not products. They are not mirrored.
- **Sandbox findings** — the item statuses seen were NORMAL and UNLIST; Shopee's pre-order is only "ships in N days" (the sandbox allowed 3–4), which is why pre-order release dates are ours; `weight` arrives as a string; refresh tokens work once.

### How the sync behaves (plan 010)

Built in plan 010; the design is the spec's section 6. This is the run
semantics the code holds, with the codes stored in `sync_run`.

**The run.** Each run lists the items whose `update_time` falls in the window
(from the last *succeeded* run's `window_to` minus 10 minutes, or everything on
the first run), adds every known `channel_item` — `NOT_FOUND` ones included —
as the stock sweep, and fetches base info, model lists and extra info for the
union. Each item is upserted in its own transaction. `sync_run.api_calls` is
the number of Shopee calls made by that run only (D-110).

**When a run fails** (`outcome = failed`, the window does not advance, so the
next run asks for the same window again). `error_code` is one of:

| `error_code` | Meaning |
| :--- | :--- |
| a Shopee error string, e.g. `error_auth`, `error_server`, `timeout`, `network_error`, `non_json_response`, `invalid_response` | `get_item_list` (or a call before it) failed. Nothing was written (D-106). `error_detail` names the call, and for `invalid_response` up to five failing field paths with their issue codes, never a value (D-114). A list page without `item` is read as empty (D-114). |
| `listing_stuck` | `has_next_page` was true but `next_offset` was missing or did not increase (D-108). |
| `listing_incomplete` | A page was empty while `has_next_page` was true (D-108). |
| `listing_too_long` | The listing passed 1000 pages of 50 (D-108). |
| `channel_not_connected` | No shop is connected (`channel_authorization` has no row). |
| `token_persistence_failed` | A refreshed token pair could not be saved. |
| `item_failures` | The run finished, but at least one item **not known before this run** failed. Upserts that committed stay; the window does not advance, so the item is listed again next run (D-109). A new item that fails every run keeps every run `failed`, the window frozen and the job answering 502 until the item is fixed in Shopee; known items are still swept and newer items still found. |
| `unexpected` | Anything else, including a failure to write the finished `sync_run` row. `error_detail` holds the error message only. |

**Per-item warnings** (`sync_run.warnings`, a list of strings, never a reason
to stop the run). Each is `item <id>: <code>` or, for a model,
`item <id> model <model id>: <code>` (D-111):

| Code | Meaning |
| :--- | :--- |
| a Shopee error string | That item's `get_model_list` call failed, or its whole base-info batch of 50 failed. |
| `invalid_response` | That item's base-info element did not parse, or its batch held an element with no readable id; the rest of the batch is mapped normally (D-110). |
| `empty_batch_response` | Its base-info batch came back with no items at all. Never read as "deleted". |
| `mapping_failed` | The item could not be mapped (for example no price). |
| `not_returned` | The item was listed this run but base info did not return it. A failure for that item, never `NOT_FOUND` (D-110). |
| `extra_info_unavailable` | Sales and rating could not be read. The item is still upserted and its stored sales and rating are kept (D-107). The only warning that never counts as an item failure. |
| an upsert error message | The item's database transaction failed. |
| `empty_parent_sku`, `duplicate_parent_sku` | REQ-004: the item's Parent SKU is empty, or another item in this run has the same one (D-103, D-111). |
| `empty_model_sku`, `duplicate_model_sku` | REQ-004: the model's ModelSKU is empty, or another model in this run has the same one. Items without models are checked on the Parent SKU only. |

An item failure that is not `extra_info_unavailable` and not a SKU warning
fails the run with `item_failures` only when the item was not known before
the run; a known item keeps its stored values and the run still succeeds.

**Not found.** A known item that was not listed this run and that base info
does not return is marked `channel_item.external_status = 'NOT_FOUND'` and
counted in `items_deactivated`. It stays in the stock sweep, so if Shopee
returns it again it is restored with its real status (D-110). A model that
disappears from a returned item gets `channel_listing.external_status =
'NOT_FOUND'` and `variant.is_active = false` (D-105). Nothing is deleted.

### What we do NOT know

- Shopee's daily API call limit for this app, and whether the full stock sweep stays under it at the real catalogue size. See Q-056.
- Whether `update_time` changes when only stock changes. Until confirmed, the sync sweeps stock for every active product each run (spec §8 risk 1).
- How kit items' price and stock appear (see Q-058), and how item statuses other than NORMAL and UNLIST appear (spec §8 risks 5 and 6).
- Shopee push notifications, which could replace the stock sweep later. Not researched.
- The live app's go-live process and the shop owner's authorization (Q-042).

### Credential required

Sandbox: a Test Partner and sandbox shop, held. Live: a Live partner key and the
shop owner's authorization, **not yet supplied** (Q-042). No partner key or
token appears in this repository; the partner key comes from the environment
only, and tokens are encrypted at rest. The sandbox Test Partner id and sandbox
shop id do appear, in test fixtures, the spec and plan 010, as test data
(Q-057, D-112); live ids never do. The callback accepts
only the shop configured in `SHOPEE_SHOP_ID` (D-104).

### What it blocks

Plan 010 builds against the sandbox only. Production use waits on the live
go-live and authorization (Q-042) and on ADR-0002 for where the scheduler runs.

---

## BigSeller

- **Status:** NOT RESEARCHED — account exists, daily-file approach decided, data inspection pending · **Named in:** §4 discussion notes, and phase 1 of §11 · **Blocks:** Phase 2 (catalogue/Excel), Phase 5 (sync)

### What we need it for

The shop already has a BigSeller account (Q-044). It is used for:

1. **Stock sync, decided as daily file export/import** (Q-043, D-081) — not the paid realtime API, which is a future option only if order volume justifies it later.
2. **Shipping and fulfilment** — BigSeller handles all shipping operations; there is no direct carrier integration (Q-034, D-075).
3. **The source of the catalogue's identity rules** — Parent SKU / ModelSKU format (REQ-004, Q-007, Q-014), real stock quantities (Q-011), and the Excel import/export column layout (Q-012, REQ-038) all wait on actually inspecting the account's real data, not on further discussion.

### What we do NOT know

- Everything about the interface and export format — no documentation has been read, and BigSeller has limitations on API access for smaller retailers (Q-044), which is consistent with the daily-file approach being primary.
- How SKU codes are generated, by whom, and how they map to Parent SKU / ModelSKU. This is the single most-blocking research task left in the project — see `13-open-questions.md`'s residual items table.
- Whether BigSeller sits between the site and Shopee, or alongside it.

### Credential required

Account access for a data-inspection session: real product, stock and SKU
examples, plus a sample Excel export. Not yet arranged.

### What it blocks

Phase 2's catalogue model and Excel import cannot be finalized, and phase 5's
sync cannot be built, until this one inspection happens.

---

## Transactional email (mail relay)

- **Status:** NOT RESEARCHED — category decided, provider not chosen · **Named in:** §8 (no provider named) · **Blocks:** Phase 3

### What we need it for

Email sent automatically at every step of an order — the exact step set
depends on the order-status candidate in Q-023 (REQ-041) — and a customer able
to view and filter their own order-status history (REQ-042; this replaced the
earlier "notification opt-out" reading — Q-031, D-073). Staff two-factor is
email OTP (REQ-032, Q-017, D-064), which also runs through this integration.

**The category of solution is decided: a mail-relay service** (Q-032, D-074),
reached through the adapter interface so no vendor name appears in domain
code. The specific provider is not chosen.

### What we do NOT know

- The specific mail-relay provider. Direction is set; the vendor is not (Q-032 residual).
- What the sender address and sender domain should be. The source asks for one mailbox for team tooling, written inconsistently as `tech@tinzshop.com` and `tech@tinzshopl.com` — deprioritized, not blocking (Q-009).
- Who controls DNS for tinzshop.com, which is required to configure sender authentication — the domain owner is known (Q-053) but account access is not yet arranged.
- Whether email must be sent in Thai, English, or the language the customer chose. See Q-018 residual.

### Credential required

A sending account with whichever mail-relay provider is chosen, plus DNS
records on tinzshop.com for sender authentication. Neither the specific
provider nor DNS access has been established yet.

### What it blocks

Phase 3. Order confirmation email is part of the phase where the shop starts
selling for real, and it cannot be delivered reliably without a provider and an
authenticated sender domain.

---

## Cloudflare

- **Status:** DECIDED — Free plan, security/bot scope · **Named in:** phase 1 of §11 as a research subject, and phase 8 as a deliverable · **Blocks:** Phase 8

### What we need it for

**Cloudflare Free**, scoped to basic security and bot protection — WAF managed
rules, bot fight mode, DNS proxying — and no paid tier unless a future
requirement justifies one (Q-054, D-087). No configuration has been written
yet; the plan/scope decision removes the ambiguity that previously blocked
even starting.

### What we do NOT know

- The specific rule configuration — still to be built once DNS access exists.
- Who controls DNS for tinzshop.com. The domain owner is known (Q-053) but account access is not yet arranged.
- How it interacts with hosting, which is deferred — see [ADR-0002](adr/ADR-0002-hosting-and-deployment.md).

### Credential required

A Cloudflare account (Free tier) with control of the tinzshop.com DNS zone,
via the domain owner (Q-053).

### What it blocks

Phase 8 configuration work. `02-scope-and-phases.md` now recommends running
phase 8 alongside the tail of phase 7 rather than strictly after go-live, as
the source's ordering originally implied.

---

## LINE

- **Status:** NOT RESEARCHED · **Named in:** §9 · **Blocks:** Phase 6

### What we need it for

The only mention in the source is §9: the site displays the shop's phone
number, email, **LINE**, opening hours, address, and DBD mark (REQ-045).

As written this is a contact detail to display, not a system to integrate with.
No LINE feature — login, messaging, notifications, LINE Pay, or a chat widget —
is requested anywhere in the source.

This section exists because LINE is a named external system and someone will
eventually ask whether more was intended. **Do not build any LINE integration
on the strength of it.**

### What we do NOT know

- Whether displaying a LINE ID or link is all that is wanted, or whether the shop expects customers to contact them through LINE as a support channel with any system involvement.
- The shop's LINE account identifier, which has not been supplied.
- Whether any LINE capability was discussed verbally. Nothing in the source suggests it.

### Credential required

None for displaying a contact detail. The shop's LINE ID or link is needed as
content, which falls under the shop information the client must supply.

### What it blocks

Nothing beyond the shop information block in phase 6. **If a real LINE
integration is wanted, that is new scope and needs a client answer first.**

---

## Old tinzshop.com WordPress (news import)

- **Status:** RESEARCHED (2026-10-29) · **Named in:** the project owner's decisions of 2026-10-29, not the client summary · **Blocks:** nothing; it feeds plan 012

### What we need it for

The shop's current site holds the game news the client already publishes. Plan 012 imports it so the new site carries that news on day one (D-126). After go-live staff write news in our own admin and the old site is never read again.

### What was researched

Verified 2026-10-29 against the live site, see [the news design](superpowers/specs/2026-10-29-news-import-and-pages-design.md) section 3:

- The site is WordPress with the public REST API open at `/wp-json/wp/v2/`; no login is needed for published posts.
- 540 published posts and 13 categories in a tree. Each post has `id`, `slug` (percent-encoded Thai), `link`, `date_gmt`, `modified_gmt`, `title.rendered`, `excerpt.rendered`, `content.rendered`, `categories`, `featured_media` and `author`. All content is Thai.
- `/wp-json/wp/v2/users` is public and gives each author's display `name`, used as the byline (D-132). A real person's name is never committed to this repository; test fixtures use invented names.
- Tags (258) are not imported.

### How the import behaves (plan 012)

- **Adapter:** `src/server/adapters/wordpress/` is the only place that names WordPress; it maps posts to a neutral `NewsArticleSnapshot`. The base URL is the non-secret setting `NEWS_IMPORT_SOURCE_URL`.
- **Order:** categories first, so parents exist, then posts, 100 per page, every page. Requests run one after another, with `User-Agent: TinzshopNewsImport/1.0`.
- **Re-run:** each post is upserted by `source_id` with its category links in one transaction; an unchanged `source_modified_at` skips the update. Nothing is ever deleted. One failed post is counted and the run continues.
- **Body HTML** is sanitised at import with an allow-list and stored sanitised (see [05](05-database.md#news)); images keep the old site's URLs (D-127).
  - **How the allow-list is applied (D-135):** `table` includes its row and cell elements, headings are `h1` to `h6`, and `br` is kept, since 85 of the 540 live posts use it. An `href` or `src` is kept only when it parses as an absolute `http`/`https` URL; relative, fragment, protocol-relative and other-scheme values are refused. An `a` keeps only `href` and gets `rel="noopener"`, and is unwrapped to its text when its `href` is refused; an `img` keeps only `src` and `alt`, and is dropped when its `src` is refused. An `iframe` survives only with a `www.youtube.com` or `youtube.com` `/embed/` source, upgraded to `https`, and keeps only `src` and an empty `allowfullscreen`; any other embed, `youtube-nocookie.com` included, is removed and counted. Every other tag is unwrapped to its text; `script`, `style`, `noscript`, `object` and `embed` lose their content too.
  - **Lost embeds are counted:** each snapshot carries `removedEmbeds`, the number of `iframe`, `script`, `object` or `embed` elements the allow-list removed, so the import can report them. A live survey on 2026-10-29 found `script` in 7 posts and `iframe` in 64.
  - **Titles and excerpts** become plain text with HTML entities decoded; slugs are stored percent-decoded.
- **Client:** `createWordPressClient` validates every response with Zod and reads the page count from the `X-WP-TotalPages` header. A failure is a `WordPressApiError` that names the API path and a reason only, never the URL, query or body. `getMedia` answers null for id 0 or a missing media item.
- **Run:** `POST /api/jobs/news-import` with `Bearer JOB_SECRET`, in every environment, under its own advisory lock (`NEWS_IMPORT_LOCK_KEY`, distinct from the catalogue sync's, so the two never block each other). A second call while one runs returns `{ outcome: 'skipped' }`. Statuses and bodies: [06](06-api.md#scheduled-jobs).
- **How it writes (D-136):** `runNewsImport` (`src/server/services/news/news-import-service.ts`) reads a neutral `NewsSource`; `createWordPressNewsSource` (`src/server/adapters/wordpress/news-source.ts`) implements it over the client and is the only part that knows the source is WordPress. `src/server/repositories/news/news-repository.ts` does every write.
  - **Categories** are saved in one transaction, parents before children whatever order the source lists them in. A new category's `position` is its rank in source id order (D-134); an existing one keeps its position, so a later reorder is not undone, and is written only when its slug, parent or name changed. A parent whose ancestors include the category itself would close a loop, so that category is stored top level, on the first run and every later one.
  - **Posts** are compared by `source_id` and `modified_gmt` before they are mapped: an unchanged one is counted `unchanged`, not mapped, its image not read, and nothing is written. A changed one updates the article, its `th` translation and its category links in one transaction, keeping its `id`, `deleted_at` and staff columns but overwriting `status` and `published_at` from the source (the old site is the master until go-live, D-126); a new one is created `published` with `published_at` from `date_gmt` and `byline_name` from the author's display name (null when the author is unknown). Links to a category the database does not hold are skipped.
  - **Slugs:** a decoded slug already held by another article (or category) gets `-{source_id}` appended. The rule depends only on what is stored, so a re-run never renames.
  - **Images and authors:** the author list is read once per run and each distinct `featured_media` of a changed or new post once.
  - **Failures:** a post whose image cannot be read, that fails to map or that fails to save is counted in `failed`, named in `failedPosts` with its reason (`save_failed` for a save), and the run continues. A failed category list, author list or page of posts stops the run: the job answers `502 news_import.failed` with the `WordPressApiError` reason as `reason` (or `unexpected`) and the counts so far; posts already saved stay, and a re-run continues where it is safe to. The stop, and each failed save, is logged on the server with the error's name and message only (a `WordPressApiError` message is an API path and a reason, never a URL, query or body).
  - **`removedEmbeds`** in the summary is the sum of the removed embeds of the posts created or updated this run; a re-run with nothing changed reports 0.
  - An unset `NEWS_IMPORT_SOURCE_URL` makes the job answer `503 news_import.not_configured` after the secret check. The job reads only `JOB_SECRET` and `NEWS_IMPORT_SOURCE_URL` (`getNewsImportJobConfig`), so a missing Shopee setting never affects it.

### What we do NOT know

- The old site's rate limits.
- Whether WordPress HTML uses embeds the allow-list drops; the importer reports how many posts lost an `iframe` or `script`.
- When the old site will be shut down, which is the deadline for copying its images (D-127).

### Credential required

None. The REST API is public and `NEWS_IMPORT_SOURCE_URL` is the old site's origin, not a secret.

### What it blocks

Nothing external. Plan 012 builds against the live old site read-only.

---

## Named in the source but not external systems

| Named | Why it is not here |
| :--- | :--- |
| Medusa JS | Named in §4 and phase 1 as an item for the technology decision, not a third-party service. Evaluated and not chosen in [ADR-0001](adr/ADR-0001-backend-approach.md). |
| Excel | A file format the shop already uses, not a hosted system. REQ-038; the shop's current file layout is Q-012. |
| DBD mark | A registration mark to display (§9). An asset to obtain from the client, not an integration. |
