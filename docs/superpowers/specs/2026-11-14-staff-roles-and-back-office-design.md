# Staff roles and the back office — design

- **Status:** Approved by the project owner — 2026-11-14
- **Becomes:** plan 016 once approved
- **Delivers:** payment stage 1 checks 1.5 to 1.12 (`docs/15-acceptance-criteria.md`), with 1.5 and 1.6 rewritten by this design
- **Requirements:** REQ-033, REQ-034, REQ-035, REQ-051; REQ-032 changed (section 2)

## 1. Purpose

Stage 1 needs a back office: staff sign in, the six roles exist, a Top-level Admin decides who is staff, and staff write and publish news. On 2026-11-14 the client's new requirements, relayed by the project owner, changed how staff accounts come to exist: staff are not given accounts. They sign up like any customer, and the Top-level Admin raises the account's role. This document describes that model and the stage 1 back office built on it.

## 2. Authority: the owner's decisions of 2026-11-14

These are the project owner's answers on the client's behalf. Each becomes a row in `docs/11-decisions.md` when the plan is written.

- **O-1 One account system.** Staff sign up and sign in through the customer pages that exist today (plan 014): email and password with the emailed sign-up code, or Google. There is no separate staff sign-in, and nobody hands out usernames or passwords.
- **O-2 Every new account is a Customer.** Sign-up never creates a staff account.
- **O-3 The Top-level Admin sets roles.** In the back office the Top-level Admin changes an account's role to Customer, Blogger, Sale-manager, Admin or Top-level Admin.
- **O-4 One role per account, and every role can shop.** A staff role adds back-office permissions on top of everything a Customer can do; an Admin can still browse, buy and see their own orders with the same account.
- **O-5 Guest is not an account.** Guest is anyone signed out. It is never assigned to an account; its permission row describes what a signed-out visitor may do.
- **O-6 No extra code at sign-in.** The emailed code is asked for at sign-up only (as today); signing in to an account with a staff role needs nothing beyond its password or Google. **This changes REQ-032 and supersedes D-064**, a requirement the client confirmed; the project owner confirmed on 2026-11-14 that the client asked for the change. Staff accounts are protected by their password or Google account alone (section 10).
- **O-7 Google is allowed for staff.** An account with a staff role may reach the back office after a Google sign-in.
- **O-8 Removing staff: the Top-level Admin chooses.** Either set the role back to Customer (the person keeps shopping) or block the account (no sign-in at all).
- **O-9 The first Top-level Admin is made by a developer command.** The owner signs up like anyone else; a developer then runs a one-off command that sets that account's role to Top-level Admin. After that, everything happens in the back office.
- **O-10 A staff edit wins over the import.** Once staff edit an imported article, the WordPress import never changes it again, even if the old site's copy changes later; the import report counts it as skipped.
- **O-12 The owner's back-office mockup is the design** (`tinzshop-redesign/admin/`, 2026-11-14): the navy side menu, top bar and pages in `css/admin.css`, built from the storefront's tokens. Where the mockup and these decisions differ, the decisions win: the mockup's separate staff login page with an emailed code (`admin/login.html`) is **dropped** (staff use the normal sign-in page); the users page has **no "add user" and no "delete user"** (people sign up themselves; the Top-level Admin changes roles and blocks or unblocks; deleting a person's data stays a staff-handled request, D-197) and no line about an emailed code at sign-in.
- **O-13 Stage 1 editor extras.** In: tags; related products (an article shows on the product pages it is linked to); product cards inside an article showing the product's current price and stock status; trash with restore; a preview before publishing. Not in stage 1: reader counts, the SEO description and its Google preview, per-article edit history, and "members only" visibility (owner, 2026-11-14).
- **O-11 No images in the editor until upload exists.** There is no file storage until the AWS services are chosen (Q-063), and the owner chose to wait for real upload rather than paste image links. Stage 1's editor is text-only: staff cannot add a featured image or body images. Imported articles keep the images they already have, and editing one leaves its existing images in place. Image upload is added as soon as file storage exists.

## 3. Scope

**In:** the role and permission tables and their six rows; a role and a block flag on every account; permission checks on every back-office page and action; the back office's entry point, layout and menu; the accounts page (find an account, change its role, block or unblock it); the role permissions page (REQ-035); the staff news editor (draft, publish, schedule, edit, delete); the first-Top-level-Admin command; a back-office link in the account menu for accounts with back-office access.

**Out:** the mockup's dashboard figures, orders, slips, products, Excel, Shopee and audit-log screens (later stages; several conflict with earlier decisions and are taken up when those stages are planned); reader counts, the SEO description, edit history and members-only visibility (O-13); the PROD maintenance mode (plan 017); AWS hosting and deployment (Q-063); product, category, order and content-page management (later stages, which add their own permissions); turning the storefront's "sign in to see products" rule (plan 014) into a permission; images in the editor, featured or in the body, until file storage exists (O-11).

## 4. Accounts and roles

**The `customer` table stays the one account table.** Every account can shop (O-4), so every account is a customer; a staff role is an addition to it, not a different kind of person. Renaming the table would touch every plan 014 file for no change in behaviour. The earlier design's separate `staff` table (`docs/05-database.md`, *Access control*: `staff id, email, is_active, two_factor_enabled`) is dropped.

Changes to `customer`:

- `role_id` (uuid, not null, FK to `role`), defaulting to the Customer row. New accounts are created with it by the existing upsert; existing rows are backfilled to Customer by the migration.
- `blocked_at` (timestamptz, nullable): set when the Top-level Admin blocks the account, cleared on unblock. A blocked account cannot sign in (section 6).

New tables, as `docs/05-database.md` already defines them (D-040, D-062, D-063):

- `role`: `id`, `key` (unique: `guest`, `customer`, `blogger`, `sale_manager`, `admin`, `super_admin`), `is_system` (always true), timestamps. Display names are message keys, Thai and English, not stored. Seeded by the migration; no screen creates or deletes a role (D-063).
- `permission`: `id`, `key` (unique). Seeded by the migration; later plans add their own keys in their own migrations.
- `role_permission`: `role_id`, `permission_id`, composite primary key.

**An account's role is read on every request** (D-040), together with the session, so a role change or a permission change applies on the account's next page load with no sign-out.

**The news staff columns get their foreign keys.** `news_article.author_staff_id`, `created_by_staff_id` and `updated_by_staff_id` (plan 012, plain uuids "until plan 002") become FKs to `customer.id`, `ON DELETE SET NULL`. Their names stay.

## 5. Permissions in stage 1

Only what stage 1 uses. Each later plan adds the keys for its own screens.

| Key | Allows | Default holders |
| :--- | :--- | :--- |
| `backoffice.enter` | Open the back office and see its home page | Blogger, Sale-manager, Admin, Top-level Admin |
| `news.manage` | List, create, edit, publish, unpublish, schedule and delete news articles | Blogger, Admin, Top-level Admin |
| `account.manage` | Find accounts, change roles, block and unblock | Top-level Admin |
| `role.manage` | Change which permissions each role holds | Top-level Admin |


> **No review step (D-129, D-131).** The news design approved on 2026-10-29 already settles it: a Blogger publishes their own article with no approval step, any Blogger may edit or delete any article, and `news_article_status` stays `draft` or `published`. The mockup's "ส่งตรวจ" button and "รอตรวจ" status are therefore left out, and its two news rows in the permission grid ("write and edit own" and "publish and edit all") become the one `news.manage`. An Admin and a Top-level Admin hold it too, so they can edit or unpublish anything.

- Customer and Guest hold none of these, and **can never be given a back-office key** (`backoffice.enter`, `news.manage`, `account.manage`, `role.manage`, and any later key marked back-office): the grid shows those cells disabled and the server refuses them, so one click can never turn every account into staff. Their rows exist so later plans can give them storefront permissions through the same mechanism (REQ-034). (Builder-check call, 2026-11-14.)
- **Lock-out guards.** The Top-level Admin row always holds **every** permission, as the mockup shows: its column is ticked and disabled, and the server refuses to remove any (O-12). There is always at least one account with the Top-level Admin role that is not blocked: the server refuses a role change or a block that would leave none, checked inside the same transaction as the change so two concurrent demotions cannot both pass. Otherwise a Top-level Admin may demote or block another Top-level Admin, or themselves.
- A Sale-manager holds only `backoffice.enter` in stage 1, so the back office shows them an empty menu with a "more tools arrive in later stages" note until stage 2 adds product permissions. (Builder's call on the exact wording.)

## 6. Sign-in, blocking and sessions

- **Sign-up and sign-in are unchanged** (plan 014): email and password with the sign-up code, or Google. No second step at sign-in (O-6).
- **The session read returns the role and its permissions** alongside the customer's id, first name and email. The back office and the account menu use them.
- **Blocking** sets `blocked_at` and deletes every `customer_session` row of the account, as a password reset already does (`endAllCustomerSessions`), so the person is signed out everywhere at once. No Cognito call is made: the sealed tokens live only in those rows, and the app never uses a token without its row. **The session read also refuses a blocked account** on every request, so a sign-in that was already in flight when the block happened dies at its next page load; no transaction around sign-in is needed. A new sign-in by a blocked account (password or Google) is refused after Cognito accepts it, with its own message, "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อร้าน" / "This account is suspended. Please contact the shop.", shown only after correct credentials, so it reveals nothing to someone who does not know the password. Unblocking clears `blocked_at`; the person signs in again normally.
- **Role changes** take effect on the next request (section 4). Demoting someone to Customer closes the back office for them at their next page load and leaves their shopping untouched.
- **Accounts appear only after a first sign-in.** A `customer` row is written by the first successful sign-in (plan 014), so a new staff member signs up and signs in once before the Top-level Admin can find them.

## 7. The back office

- **Entry point:** `/{locale}/admin` (REQ-033), in the `(admin)` route group (`docs/04-tech-stack-and-structure.md`). Thai and English like the storefront (D-031).
- **Access:** signed out, it sends the visitor to the sign-in page and back (the same `returnTo` rule as plan 014). Signed in without `backoffice.enter`, it shows a plain "no access" page with a link home; it never reveals which pages exist.
- **Every page and every Server Action checks its permission on the server.** Hiding a menu item is not the check.
- **Layout:** a side menu listing only the sections the account's permissions allow, the account's name and role, a link back to the shop and sign-out. A plain, dense staff style built from the storefront's `@theme` tokens and `buttonClass`; it is a work tool, not a storefront page.
- **Account menu on the storefront:** an account with `backoffice.enter` sees a "หลังบ้าน" / "Back office" link in the header's account menu.

**Pages:**

1. **Home:** the menu and a short greeting. Nothing else in stage 1.
2. **Accounts** (`account.manage`): search by email or name; a paged list showing name, email, role, blocked or not, and created date; on each row, change the role (a select) and block or unblock (with a confirm step). The guards of section 5 show as a clear message when they refuse.
3. **Roles and permissions** (`role.manage`): a grid of the six roles against the permission keys, each cell a checkbox, saved per role. Locked cells (section 5) are disabled. Permission keys show a translated description, not the raw key.
4. **News** (`news.manage`): section 8.

## 8. The staff news editor

Writes to plan 012's tables; nothing about how the storefront shows news changes.

- **List:** every article not deleted, imported and staff-written alike, newest first, with title, status (draft, scheduled, published), categories, publish date and last editor; search by title; filter by status and category. "Scheduled" is not a stored status: it is `status = published` with a future `published_at` (D-130), and the filter derives it that way.
- **Edit form:**
  - Thai title, excerpt and body, required. English title, excerpt and body, optional as a set; the storefront already falls back to Thai on `/en`.
  - Slug: generated from the title on first save, editable, unique (the import's suffix rule applies on a clash, D-136).
  - Categories: one or more, from the listed categories.
  - Featured image: none in stage 1 (O-11). A new article has no featured image; the news cards and article page already render without one. An imported article's existing featured image is kept and shown, not editable.
  - Byline: defaults to the editor's first name, editable.
- **Status:** no review step (D-129). "Save draft" keeps it off the site; "Publish" sets `status = published` and `published_at` to now, or to a chosen future time, which makes it scheduled (D-130); "Unpublish" returns it to draft. Editing a published article changes the site on save (check 1.12).
- **Trash (O-13).** "Move to trash" is the soft delete (`deleted_at`, D-131): the article leaves the site and the list, and appears under "ถังขยะ" (trash), where it can be restored, which clears `deleted_at` and returns it as it was (draft, or published if its `published_at` is reached). Nothing is ever deleted for good from the back office.
- **Preview (O-13).** "ดูตัวอย่าง" shows the unsaved or draft article exactly as the article page would, in a new tab, to staff with `news.manage` only; it is never reachable by a customer and is marked noindex.
- **Tags (O-13).** Free-text tags per article, typed and confirmed with Enter, trimmed, case-insensitive unique, with no limit on how many an article has. Stored in a `news_tag` table and an `news_article_tag` link table. Stage 1 stores and edits them in the back office only; the storefront does not show or filter by tags yet.
- **Related products (O-13).** An article can be linked to products, searched by name or SKU from the catalogue mirror (`news_article_product`: `article_id`, `product_id`). A linked article is listed on that product's page as related news (live articles only, newest first, every linked article with no limit, each with a link). Linking a product the shop later deactivates leaves the link but shows nothing on the storefront for it.
- **Product cards in the body (O-13).** The editor inserts a product card as a placeholder element in `body_html` that names only the product id (for example `<tinz-product data-id="…"></tinz-product>`; the exact tag is the builder's and goes through the sanitiser's allow-list). The article page replaces each placeholder at render time with a card showing the product's current name, photo, price and stock status from the mirror, linking to the product page, so a price is never stale. A placeholder whose product is gone or inactive renders nothing. Product pages need sign-in (plan 014): the card shows to everyone, and the link sends a signed-out reader through sign-in as product links already do.
- **Body editing:** a rich-text editor producing the HTML the article page already renders (headings, paragraphs, bold, italic, links, lists, YouTube embeds). No image insertion in stage 1 (O-11); `<img>` tags already in an imported article's body survive an edit unchanged. The editor must be one that can take an upload button later without being replaced. **Every save passes the body through `sanitizeArticleHtml`**, the import's sanitiser (`docs/05-database.md`, *News*: the invariant that every writer of `body_html` uses the same sanitiser). The choice of editor component is the builder's, recorded as a decision with its licence and version.
- **Imported articles are editable, and a staff edit is final (O-10).** An edit writes `updated_by_staff_id`. From then on the import skips that article on every run, whatever changes on the old site, and counts it in its report as skipped. The marker is `updated_by_staff_id IS NOT NULL` on a row with `source_id`; it is set only by a staff save, so an article staff only opened, or a re-publish without changes, still counts as edited once saved.
- **Who wrote it:** `created_by_staff_id` and `author_staff_id` are the account that created the article; `updated_by_staff_id` the last editor. The `*_staff_id` names are kept: they hold a `customer.id`, since staff are customer accounts (glossary note added with the plan).

## 9. The first Top-level Admin

A command run by a developer with database access, for example `npm run account:set-role -- <email> super_admin`. It finds the account by email (it must have signed in once), sets its role, prints the masked email and the new role, and refuses an unknown email. It works on any environment's database, so it is how PROD gets its first Top-level Admin. It is also the way back if every Top-level Admin is ever lost despite the guards.

## 10. Security

- **No second factor for staff (O-6).** Before this decision a stolen staff password was not enough on its own (REQ-032). Now a leaked Admin or Top-level Admin password, or a compromised Google account, gives full back-office control. Mitigations inside this design: the sign-in rate limits (D-169) apply to every account; blocking signs a person out everywhere at once; role changes apply at once. The client should know this trade-off is theirs; it is recorded as a change to REQ-032, not a silent drop.
- Every back-office page and Server Action checks its permission on the server, against the role read in the same request.
- Back-office Server Actions follow plan 014's rules: Zod validation, no secret or email in logs (ids and hashes only), errors as message keys.
- **Role changes, blocks, unblocks and permission changes are written to the server log**: who did it, which account or role, the old and new value, as ids. There is no audit table, in line with D-066. The first-Top-level-Admin command logs the same way. (Builder-check call, 2026-11-14.)
- The news body is sanitised on every write (section 8).

## 11. Testing

- Unit: tag normalising (trim, case-insensitive duplicates); the product-card placeholder surviving the sanitiser and rendering current price and stock, or nothing for a gone product; trash restore returning the article's earlier state; permission evaluation; the lock-out guards (last Top-level Admin, locked permissions); blocking ends sessions and refuses sign-in on both paths; role change visible on the next session read; slug generation and clash suffix; the editor's sanitise-on-save; the import skipping a staff-edited article and counting it; an imported body's `<img>` tags surviving an edit.
- Integration (real PostgreSQL): migration backfills every existing account to Customer; role and permission reads; the guard under two concurrent demotions (one must fail).
- DOM: the back-office menu shows only permitted sections; the permissions grid disables locked cells.
- Manual checklist: stage 1 checks 1.5 to 1.12 as rewritten, run by a person; never ticked unrun.

## 12. Documents this changes

`CLAUDE.md` (*Current state*: plan 016 unblocked, the stage 1 line), `docs/02-scope-and-phases.md` (REQ-032 changed, REQ-034's note on Guest, the stage 1 row's "staff sign-in with email OTP"), `docs/05-database.md` (*Access control*: no `staff` table; `customer.role_id`, `blocked_at`; the news FKs; *News*: `news_tag`, `news_article_tag`, `news_article_product`, and "tags" leaving the *Not stored now* list), `docs/15-acceptance-criteria.md` (checks 1.5 and 1.6 become "a staff member signs up and signs in like a customer; the Top-level Admin gives the account a staff role and the back office opens" and "an account with the Customer role, or blocked, cannot open the back office"), `docs/12-glossary.md` (back office, account role, blocked account, permission keys), `docs/11-decisions.md` (O-1 to O-9 and the builder's decisions; D-064 superseded), `docs/plans/002-catalogue-stock-and-admin-foundation.md` (its staff sign-in and `staff` table superseded by plan 016), `docs/06-api.md` (the back-office Server Actions).

## 13. Left to the builder

The editor component (it must take an upload button later); the exact back-office styling within the tokens; page sizes and search details; the command's exact name (checked against the glossary); message wording not quoted here.

## 14. Risk to the stage 1 date

The O-13 extras add work: product cards and related products touch the product pages and the sanitiser. If stage 1 runs short, those two are the first to move to stage 2, since they belong with the product pages; this is the owner's call at the time.


Stage 1's UAT has no image check, so a text-only editor meets it. But news without new images will look thin on PROD, and upload needs Q-063 (which AWS services, including file storage) answered first. Q-063 is the critical path for both image upload and stage 1's deployment checks 1.4 and 1.13.
