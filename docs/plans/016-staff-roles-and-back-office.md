# 016 — Staff roles and the back office — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

- **Status:** In progress — Tasks 1 to 4 built and reviewed (2026-11-14); Tasks 5 to 11 not started. Planned 2026-11-14 on the project owner's decisions and approval of 2026-11-14
- **Stage:** payment stage 1 (due 2026-12-15), checks 1.5 to 1.12 of `docs/15-acceptance-criteria.md` (1.5 and 1.6 rewritten by Task 1)
- **Requirements:** REQ-033, REQ-034, REQ-035, REQ-051 delivered for stage 1; REQ-032 changed (D-232); REQ-047 extended (the staff editor)
- **Depends on plans:** 012 (news tables, import, pages), 014 (accounts, sessions, sign-in), 015 (tokens, `buttonClass`)
- **Blocked by:** nothing. Image upload in the editor waits on Q-063 (file storage) and is not in this plan (D-237).
- **Spec:** `docs/superpowers/specs/2026-11-14-staff-roles-and-back-office-design.md` (approved 2026-11-14). Read it before any task; section numbers below (§n) are its sections.
- **Design:** `tinzshop-redesign/admin/` (`posts.html`, `post-edit.html`, `users.html`, `index.html`), styled by `css/admin.css`, built from `_src/admin.mjs`. Not used: `admin/login.html`, `products.html`, `product-edit.html`, and every dashboard figure (spec §3, D-238).
- **Branch:** `feat/win/staff-back-office`, cut from `main` at `a6c5284`

**Goal:** Staff sign up and sign in like customers; a Top-level Admin raises an account to a staff role or blocks it; a role's permissions are editable rows; the back office at `/{locale}/admin` shows each account only what its role allows; and staff write, schedule, publish, trash and restore news with tags, related products and live product cards.

**Architecture:**
- **One account table.** `customer` gains `role_id` and `blocked_at`; `role`, `permission` and `role_permission` are new (spec §4). There is no `staff` table.
- **Access lives in `access/`** in each layer (D-175): permission keys and pure rules in `src/server/services/access/`, Prisma in `src/server/repositories/access/`, request handling in `src/server/controllers/access/`.
- **The session read carries the role.** `CurrentCustomer` gains `roleKey` and `permissions`, read in the same query as the session row; a blocked account reads as signed out (spec §6).
- **The back office is a new route group** `src/app/[locale]/(admin)/admin/`, with its own layout (side menu, top bar) and one server-side gate, `requirePermission`, called by every page and Server Action.
- **News authoring** is a new pair, `news-admin-service.ts` and `news-admin-repository.ts`, beside plan 012's read and import modules. The import's sanitiser is injected into the service, not imported (services stay framework-free, D-002).

**Tech stack:** Next.js 16 App Router (Server Components, Server Actions), TypeScript, Prisma 7 / PostgreSQL 17, Tailwind 4 `@theme`, next-intl, Zod 4, `sanitize-html` 2.18.1, Vitest (unit, jsdom DOM, integration). One new dependency: the rich-text editor (Task 9, D-244).

## Global Constraints

- Every rule in `CLAUDE.md` applies; above all: never read `.env`; no secret, real email or account id in any file or commit; check `docs/12-glossary.md` before naming; every decision gets a row in `docs/11-decisions.md` plus its reasoning; documentation in the same change.
- Decision numbers for this plan start at **D-229** (D-202 to D-209 are reserved by the open docs PR #39). Question numbers, if any, start at **Q-070**.
- Role keys, exactly: `guest`, `customer`, `blogger`, `sale_manager`, `admin`, `super_admin` (glossary, D-062).
- Permission keys in stage 1, exactly: `backoffice.enter`, `news.manage`, `account.manage`, `role.manage` (spec §5). All four are back-office keys.
- Default holders: `backoffice.enter` → blogger, sale_manager, admin, super_admin; `news.manage` → blogger, admin, super_admin; `account.manage` and `role.manage` → super_admin. `super_admin` always holds every key; `customer` and `guest` never hold a back-office key.
- At least one `super_admin` account with `blocked_at IS NULL` must exist after every role change or block; the check runs in the same transaction as the change (spec §5).
- No second factor at sign-in (D-232). No add-user and no delete-user anywhere (D-238).
- Every back-office page and Server Action checks its permission on the server with `requirePermission`; a hidden menu item is never the check.
- Logs carry ids, role keys, permission keys and codes only; never an email, name, token or cookie (plan 014's rule).
- Every write of `news_article_translation.body_html` passes through `sanitizeArticleHtml` (`docs/05-database.md`, *News*).
- No review status for news: `news_article_status` stays `draft | published` (D-129). "Scheduled" is derived: `published` with `published_at > now()` (D-130).
- No images can be added in the editor (D-237); `<img>` already in an imported body survives a save.
- Messages: every user-visible string is a key in `messages/th.json` and `messages/en.json` under `admin.*` (new namespace) or `shop.*`; Thai first, English required (REQ-033).
- Styling: Tailwind classes on the existing `@theme` tokens and `buttonClass`; new tokens only if `css/admin.css` uses a colour the theme lacks, added to `src/app/globals.css` with a guard in `design-tokens.test.ts`.

## Review Focus

1. **A demotion or block racing another one** — two Top-level Admins demote each other at once; exactly one change must fail with the last-admin message. Test: Task 3, integration.
2. **A stale session after a role change or block** — the account's next page load must show the new permissions or sign it out, with no sign-out needed. Test: Task 4.
3. **A crafted Server Action call** — posting the role or permission form without `account.manage` / `role.manage`, or posting `backoffice.enter` for `customer`, must be refused on the server. Test: Tasks 7 and 8.
4. **A body with a fake product card** — `<tinz-product data-id="not-a-uuid" onclick=…>` or a card for an inactive product must not render script or a broken card. Test: Task 10.
5. **The import after a staff edit** — the next import run, and the `?full=1` re-import, must leave a staff-edited article untouched and count it as skipped. Test: Task 6.

---

### Task 1: Docs, decisions and names

**Files:**
- Modify: `docs/11-decisions.md`, `docs/02-scope-and-phases.md`, `docs/05-database.md`, `docs/06-api.md`, `docs/12-glossary.md`, `docs/15-acceptance-criteria.md`, `docs/plans/002-catalogue-stock-and-admin-foundation.md`, `CLAUDE.md`

- [x] **Step 1: Decision rows** after D-228, each one sentence ending "(project owner, 2026-11-14)" and linking to the spec:
  - D-229 one account system: staff sign up and sign in through the customer pages (O-1).
  - D-230 every new account is Customer; the Top-level Admin sets the role; one role per account and every role can shop (O-2 to O-4).
  - D-231 Guest is not an account; its role row describes signed-out visitors (O-5).
  - D-232 no second factor at sign-in, staff included; REQ-032 changed at the client's request; **supersedes D-064** (O-6). Mark D-064 "Superseded — see D-232".
  - D-233 staff may reach the back office after Google sign-in (O-7).
  - D-234 removing staff is a role change back to Customer or a block; blocking deletes every session and the session read refuses a blocked account (O-8, spec §6).
  - D-235 the first Top-level Admin is set by the `account-role` job (O-9, Task 5).
  - D-236 a staff edit wins over the import (O-10).
  - D-237 no images in the editor until file storage exists (O-11).
  - D-238 the owner's admin mockup is the design; its staff login page, add user and delete user are dropped (O-12).
  - D-239 stage 1 editor extras: tags, related products, product cards, trash with restore, preview; not reader counts, SEO, edit history, members-only (O-13).
  - D-240 `customer` is the one account table (`role_id`, `blocked_at`); the separate `staff` table is dropped; the news `*_staff_id` columns become FKs to `customer.id` (spec §4).
  - D-241 the four stage 1 permission keys and their defaults; `super_admin` holds every key; `customer` and `guest` never hold a back-office key; the last-Top-level-Admin guard (spec §5).
  - D-242 role, block and permission changes go to the server log as ids, with no audit table (in line with D-066).
  - D-243 the back office is `/{locale}/admin`; every page and action checks its permission on the server; no access shows a plain page (spec §7).
  - D-244 is reserved for Task 9's editor choice; D-245 for Task 10's product-card tag.
- [x] **Step 2: Scope and acceptance.** In `02-scope-and-phases.md`: REQ-032 becomes "CHANGED — no second factor (D-232)" with the old text kept struck through; the stage 1 row's "staff sign-in with email OTP" becomes "staff accounts and roles (staff sign up like customers; D-229)". In `15-acceptance-criteria.md` replace 1.5 and 1.6 with the spec §12 wording.
- [x] **Step 3: Database and API docs.** `05-database.md` *Access control*: replace the `staff` block with the tables of spec §4 and the rules of spec §5; *News*: the staff columns' FKs, `news_tag`, `news_article_tag`, `news_article_product`, and remove "tags" from *Not stored now*; *Customer authentication*: drop "the `role` table comes with plan 002". `06-api.md`: a *Back-office Server Actions (plan 016)* section listing the actions of Tasks 7 to 10 with their permission and error keys, and the `account-role` job.
- [x] **Step 4: Glossary.** Add: Back office (`/{locale}/admin`), Account role (`customer.role_id`, `RoleKey`), Permission key (`PermissionKey`, the four keys), Back-office key, Blocked account (`blocked_at`), Last-Top-level-Admin guard, Product card (`<tinz-product>`), News tag (`news_tag`), Related products (`news_article_product`), Trash (soft delete restore), `account-role` job. Edit **Staff**: "an account whose role is blogger, sale_manager, admin or super_admin; not a separate table (D-240)". Note on the news row: `*_staff_id` holds a `customer.id`.
- [x] **Step 5: Plan 002 and CLAUDE.md.** Plan 002 *Status*: add "staff sign-in, `staff` table and email OTP superseded by plan 016 (D-229, D-232, D-240)". `CLAUDE.md` *Current state*: add plan 016 to the code list and the "unblocked" sentence, on the project owner's approval of 2026-11-14.
- [x] **Step 6: Commit** `docs: record plan 016's decisions, the REQ-032 change and the back-office names`

### Task 2: Schema — roles, permissions, account role and block, news links

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_staff_roles_and_back_office/migration.sql`
- Test: `tests/integration/access/access-schema.test.ts`

**Interfaces:**
- Produces: Prisma models `Role` (`role`: `id`, `key` unique, `isSystem` default true, timestamps), `Permission` (`permission`: `id`, `key` unique), `RolePermission` (`role_permission`: composite PK); `Customer.roleId` (`role_id`, not null, FK), `Customer.blockedAt` (`blocked_at`, nullable); `NewsTag` (`news_tag`: `id`, `name`, `name_key` unique = lower(trim(name))), `NewsArticleTag` (composite PK, cascade), `NewsArticleProduct` (`news_article_product`: `article_id`, `product_id`, composite PK, cascade both, index on `product_id`); FKs `news_article.{author,created_by,updated_by}_staff_id → customer.id ON DELETE SET NULL`.

- [x] **Step 1: Write the failing integration tests:** `seeds the six roles and four permissions with the default grants` (asserts the exact table of Global Constraints); `backfills existing customers to the customer role` (insert a customer row before the migration's backfill is impossible in-test, so assert `every customer has role_id` and that a new row defaults to `customer`); `a news staff id must reference a customer` (insert with a random uuid → FK error); `a tag name is unique case-insensitively` (`"Switch 2"` then `" switch 2 "` → unique error on `name_key`).
- [x] **Step 2: Run** `npm run test:integration -- access-schema` — expect FAIL (tables missing).
- [x] **Step 3: Write the migration.** Order: create `role`, `permission`, `role_permission`; insert the six roles with **fixed uuids written as literals** in the migration, the four permissions and the default grants; add `customer.role_id` nullable, `UPDATE customer SET role_id = '<customer role uuid>'`, then `SET NOT NULL` and `SET DEFAULT '<customer role uuid>'`, so every new account is a Customer without the repository naming a role; add `blocked_at`; clear any `*_staff_id` that matches no customer (imports leave them null) and add the three FKs; create the news tag and product link tables. Mirror it in `schema.prisma` and run `npm run db:generate`.
- [x] **Step 4: Run** the integration tests and `npm run typecheck` — expect PASS.
- [x] **Step 5: Commit** `feat: add roles, permissions, account role and block, and news tag and product links`

### Task 3: Access rules and the access repository

**Files:**
- Create: `src/server/services/access/permission-keys.ts`, `src/server/services/access/access-service.ts`, `src/server/services/access/access-service.test.ts`, `src/server/repositories/access/access-repository.ts`
- Test: `tests/integration/access/access-repository.test.ts`

**Interfaces:**
- Produces (`permission-keys.ts`): `ROLE_KEYS` (the six, in menu order), `type RoleKey`; `PERMISSION_KEYS` (the four), `type PermissionKey`; `BACK_OFFICE_KEYS: ReadonlySet<PermissionKey>` (all four); `STAFF_ROLE_KEYS` (`blogger`, `sale_manager`, `admin`, `super_admin`); `ASSIGNABLE_ROLE_KEYS` (the five without `guest`).
- Produces (`access-service.ts`): `can(viewer: { permissions: readonly PermissionKey[] } | null, key: PermissionKey): boolean`; `checkRolePermissions(roleKey: RoleKey, keys: readonly PermissionKey[]): { ok: true } | { ok: false; reason: 'super_admin_locked' | 'back_office_key_for_customer' }` (`super_admin` must equal every key; `customer`/`guest` may hold no back-office key); `type AccessError` codes `access.forbidden`, `access.last_super_admin`, `access.super_admin_locked`, `access.back_office_key_for_customer`, `access.unknown_account`.
- Produces (`access-repository.ts`): `listRoleGrants(): Promise<Record<RoleKey, PermissionKey[]>>`; `replaceRolePermissions(roleKey: RoleKey, keys: readonly PermissionKey[]): Promise<void>`; `searchAccounts(input: { query: string; roleKey: RoleKey | null; blocked: boolean | null; skip: number; take: number }): Promise<{ total: number; rows: AccountRow[] }>` where `AccountRow = { id; email; firstName; lastName: string | null; roleKey: RoleKey; blockedAt: Date | null; createdAt: Date }`, search over email, first and last name (case-insensitive contains), newest first; `changeAccountRole(accountId: string, roleKey: RoleKey): Promise<'changed' | 'unchanged' | 'last_super_admin' | 'unknown_account'>` and `setAccountBlocked(accountId: string, blocked: boolean): Promise<'changed' | 'unchanged' | 'last_super_admin' | 'unknown_account'>` — each in one transaction that locks the `super_admin` accounts (`SELECT … FOR UPDATE`) and refuses when no unblocked `super_admin` would remain; blocking also deletes the account's `customer_session` rows in the same transaction; `findAccountByEmail(email: string): Promise<{ id: string; roleKey: RoleKey } | null>`.

- [x] **Step 1: Write the failing unit tests** for `can` (null viewer → false; key present/absent) and `checkRolePermissions` (super_admin with three keys → `super_admin_locked`; customer with `backoffice.enter` → `back_office_key_for_customer`; guest with `news.manage` → same; blogger with any subset → ok).
- [x] **Step 2: Write the failing integration tests:** `refuses to demote the last unblocked super_admin`; `refuses to block the last unblocked super_admin`; `allows demoting a super_admin while another unblocked one remains`; `two concurrent demotions of the only two super_admins: exactly one succeeds` (Promise.all of two `changeAccountRole` calls → one `'changed'`, one `'last_super_admin'`); `a blocked super_admin does not count`; `blocking deletes every session of the account`; `searchAccounts finds by part of the email or name, filters by role and blocked, newest first`; `replaceRolePermissions replaces the role's grants`.
- [x] **Step 3: Run** unit and integration — expect FAIL.
- [x] **Step 4: Implement** the three files to the interfaces above. The repository does not call `checkRolePermissions`; the controller does (Task 8).
- [x] **Step 5: Run** — expect PASS. **Commit** `feat: add permission keys, access rules and the access repository`

### Task 4: Role in the session, and blocked accounts at sign-in

**Files:**
- Modify: `src/server/services/auth/customer-session-service.ts`, `src/server/repositories/auth/customer-session-repository.ts`, `src/server/repositories/auth/customer-repository.ts`, `src/server/services/auth/customer-auth-service.ts`, `src/server/controllers/auth/customer-auth-controller.ts`, `src/server/controllers/auth/google-sign-in-controller.ts`, `src/app/[locale]/(shop)/(auth)/_components/AuthNotice.tsx`, `messages/th.json`, `messages/en.json`
- Test: the `.test.ts` beside each modified service and controller

**Interfaces:**
- Produces: `CurrentCustomer = { id; firstName; email; roleKey: RoleKey; permissions: readonly PermissionKey[] }`. The session `find` returns the customer with `roleKey`, `permissions` and `blockedAt`.
- Produces: `startSessionFromTokens` returns `SignedIn | 'email_taken' | 'blocked'`; `signIn` maps `'blocked'` to the error `auth.account_blocked` / `shop.auth.error.accountBlocked`; the Google callback maps it to `/{locale}/sign-in?error=blocked`, shown by `AuthNotice`.
- Copy: `shop.auth.error.accountBlocked` = "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อร้าน" / "This account is suspended. Please contact the shop." (spec §6). New accounts are upserted with the `customer` role.

- [x] **Step 1: Write the failing tests:** session read returns `roleKey` and `permissions`; `a blocked account reads as signed out and its session row is deleted`; `a role change shows on the next read` (fake repository returns a new role on the second call); password sign-in of a blocked account → `formError: shop.auth.error.accountBlocked`, no session, refresh token revoked (as `email_taken` does); Google callback of a blocked account → location `/th/sign-in?error=blocked`; `AuthNotice` renders the blocked message for `error=blocked`.
- [x] **Step 2: Run** `npm test` on those files — expect FAIL.
- [x] **Step 3: Implement.** The blocked check in `startSessionFromTokens` runs after the upsert (which returns `blockedAt`) and before the session insert.
- [x] **Step 4: Run** `npm test` and `npm run typecheck` — expect PASS. **Commit** `feat: carry the role in the session and refuse blocked accounts`

### Task 5: The `account-role` job

**Files:**
- Create: `src/app/api/jobs/account-role/route.ts`, `src/server/controllers/access/account-role-job-controller.ts` (+ `.test.ts`)
- Modify: `scripts/run-job.mjs`, `package.json`, `src/server/composition-root.ts`, `docs/16-local-setup.md`

**Interfaces:**
- Consumes: `findAccountByEmail`, `changeAccountRole` (Task 3).
- Produces: `POST /api/jobs/account-role`, `Authorization: Bearer <JOB_SECRET>` (the existing job check), JSON body `{ email: string, role: RoleKey }`; answers `200 { result: 'changed' | 'unchanged', role }`, `404 { error: 'unknown_account' }`, `409 { error: 'last_super_admin' }`, `400` on a bad body or `role: 'guest'`, `401` without the secret. Works in production (unlike `catalogue-activate`). Logs the account id, old and new role (D-242).
- Produces: `npm run account:set-role -- <email> <role>` → `node --env-file=.env scripts/run-job.mjs account-role <email> <role>`; `run-job.mjs` sends the two arguments as the JSON body for this job only and prints the email masked (`abc…@domain`).

- [ ] **Step 1: Write the failing controller tests** for each answer above, and that the log never contains the email.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5:** Add the command to `docs/16-local-setup.md` ("make yourself Top-level Admin after your first sign-in"). **Commit** `feat: add the account-role job to set the first Top-level Admin`

### Task 6: News authoring service and repository

**Files:**
- Create: `src/server/services/news/news-admin-service.ts` (+ `.test.ts`), `src/server/repositories/news/news-admin-repository.ts`
- Modify: `src/server/repositories/news/news-repository.ts` (`upsertNewsArticle`), `src/server/services/news/news-import-service.ts` (summary), `src/server/composition-root.ts`
- Test: `tests/integration/news/news-admin-repository.test.ts`, `tests/integration/news/news-import-staff-edit.test.ts`

**Interfaces:**
- Produces (service): `type NewsAdminStatus = 'draft' | 'scheduled' | 'published'` (derived); `listAdminArticles(deps, { query, status: NewsAdminStatus | 'trash' | null, categoryId: string | null, page }) → { total, rows: AdminArticleRow[] }` (20 per page, newest `updated_at` first; `trash` lists `deleted_at IS NOT NULL`, every other filter excludes them); `getAdminArticle(deps, id)`; `saveArticle(deps, { id: string | null; editorId: string; input: ArticleInput; action: 'draft' | 'publish' | 'unpublish'; publishAt: Date | null; now: Date }) → Result<{ id: string; slug: string }>`; `trashArticle(deps, id, editorId)`; `restoreArticle(deps, id, editorId)`.
- `ArticleInput = { slug: string | null; th: { title; excerpt; bodyHtml }; en: { title; excerpt; bodyHtml } | null; categoryIds: string[]; tagNames: string[]; productIds: string[]; bylineName: string }`. Thai title and body required; English all-or-nothing (title and body both, or `null`); no limit on tags or products (D-239).
- Rules the tests pin: `publish` with `publishAt` null sets `status = published`, `published_at = now`; with a future `publishAt` it schedules; `unpublish` sets `draft` and keeps `published_at`; slug from the Thai title on first save when `slug` is null, decoded and lower-cased, with spaces to `-`, unique by appending `-2`, `-3`…; every body through the injected `sanitize(html) → html`; `created_by_staff_id` and `author_staff_id` set on create, `updated_by_staff_id` on every save; tags normalised (trim, collapse spaces, dedupe case-insensitively) and created on first use; `bylineName` empty → the editor's first name; trash sets `deleted_at`, restore clears it.
- Produces (import): `upsertNewsArticle` returns `'skipped_staff_edit'` when the stored row has `source_id` and `updated_by_staff_id IS NOT NULL`, also under `full`; `NewsImportSummary` gains `skippedStaffEdits: number` (D-236).

- [x] **Step 1: Write the failing unit tests** for each rule above, plus `an <img> in an imported body survives a save` and `a body with a script is sanitised before it is stored`.
- [x] **Step 2: Write the failing integration tests:** save, publish, schedule, unpublish, trash, restore round-trips; the slug clash suffix; tags and product links replaced on save; `the import skips a staff-edited article on a normal run and on ?full=1 and counts it`.
- [x] **Step 3: Run** — FAIL. **Step 4: Implement.** **Step 5: Run** unit, integration, typecheck — PASS.
- [x] **Step 6: Commit** `feat: add news authoring, trash and restore, and keep the import off staff edits`

### Task 7: Back-office shell and the access gate

**Files:**
- Create: `src/app/[locale]/(admin)/admin/layout.tsx`, `src/app/[locale]/(admin)/admin/page.tsx`, `src/app/[locale]/(admin)/admin/_components/AdminShell.tsx`, `SideNav.tsx`, `NoAccess.tsx`, `src/app/[locale]/(admin)/admin/_lib/require-permission.ts` (+ tests)
- Modify: `src/app/[locale]/(shop)/_components/AccountMenu.tsx` (+ its test), `messages/th.json`, `messages/en.json`

**Interfaces:**
- Produces: `requirePermission(locale: string, path: string, key: PermissionKey): Promise<CurrentCustomer>` — signed out → redirect to `signInPath(locale, path)`; signed in without `key` → redirect to `/{locale}/admin/no-access`, a page outside the gate that renders `NoAccess` ("คุณไม่มีสิทธิ์เข้าหน้านี้" / "You do not have access to this page", with a link home) and never names the page asked for. Menus use `can` from Task 3.
- Layout, from `admin/index.html` and `css/admin.css`: navy side menu (sections: ภาพรวม → แดชบอร์ด; เนื้อหา → ข่าวและบทความ; ระบบ → ผู้ใช้และสิทธิ์), each item shown only with its permission; the account's name and translated role at the foot with sign-out and "ดูหน้าร้าน"; top bar with the TH/EN switch. The mockup's search box, notification bell, counts and every menu item not in stage 1 are left out.
- Home page: the greeting "สวัสดี คุณ{name}" and, for an account whose menu is empty beyond home (a Sale-manager in stage 1), the line `admin.home.moreLater` ("เครื่องมือเพิ่มเติมจะมาในรอบถัดไป" / "More tools arrive in later stages").
- `AccountMenu` shows "หลังบ้าน" / "Back office" linking to `/{locale}/admin` when `can(customer, 'backoffice.enter')`.

- [x] **Step 1: Write the failing tests:** `requirePermission` redirects a signed-out visitor to sign-in with `returnTo`, refuses a Customer, passes a Blogger for `backoffice.enter`; `SideNav` shows only permitted items (Blogger: dashboard and news; super_admin: all three); the account menu link appears only with `backoffice.enter`.
- [x] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `npm test`, typecheck — PASS. **Commit** `feat: add the back-office shell, menu and permission gate`

### Task 8: Accounts and role permissions pages

**Files:**
- Create: `src/app/[locale]/(admin)/admin/users/page.tsx`, `src/app/[locale]/(admin)/admin/users/actions.ts`, `_components/AccountTable.tsx`, `_components/RolePermissionGrid.tsx`, `src/server/controllers/access/account-admin-controller.ts` (+ tests)
- Modify: `messages/th.json`, `messages/en.json`, `src/server/composition-root.ts`

**Interfaces:**
- Consumes: Task 3's repository and rules, Task 7's `requirePermission`.
- Produces (actions, each re-checking its permission): `changeAccountRoleAction(formData)` (`account.manage`; fields `accountId`, `roleKey` ∈ `ASSIGNABLE_ROLE_KEYS`); `setAccountBlockedAction(formData)` (`account.manage`; `accountId`, `blocked`); `saveRolePermissionsAction(formData)` (`role.manage`; `roleKey`, `keys[]`, validated by `checkRolePermissions`). Errors map to `admin.error.lastSuperAdmin`, `superAdminLocked`, `backOfficeKeyForCustomer`, `forbidden`, `unknownAccount`. Each change is logged with the actor id, target, old and new value (D-242).
- Page (from `users.html`): tabs "บัญชีทั้งหมด" and "ตำแหน่งและสิทธิ์" (the mockup's separate staff and customer tabs become one list with a role filter); search box (email or name); role and status filters (active, blocked); table columns name, email, role (a select, `account.manage` only), status, created; row action block or unblock with a confirm dialog; 20 per page. Left out from the mockup: add user, delete, export, bulk selection, phone, order count, total spent, last visit, the email-code banner, "awaiting email confirmation".
- Grid: rows are the four permission keys with translated descriptions (`admin.permission.<key>`); columns are the six roles; `super_admin` column ticked and disabled; back-office cells for `customer` and `guest` disabled; one save button per grid.

- [ ] **Step 1: Write the failing tests:** each action refuses without its permission; `roleKey: 'guest'` is refused; the last-admin and lock errors come back as their message keys; the grid renders disabled cells exactly as above; the table hides the role select for an account without `account.manage` (defensive; the page itself needs it).
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS. **Commit** `feat: add the accounts page and the role permissions grid`

### Task 9: News list and editor pages

**Files:**
- Create: `src/app/[locale]/(admin)/admin/news/page.tsx`, `news/new/page.tsx`, `news/[id]/page.tsx`, `news/[id]/preview/page.tsx`, `news/actions.ts`, `news/_components/ArticleTable.tsx`, `ArticleEditor.tsx` (client), `RichTextEditor.tsx` (client), `TagInput.tsx`, `ProductPicker.tsx`, `src/server/controllers/news/news-admin-controller.ts` (+ tests)
- Modify: `package.json` (the editor dependency), `messages/th.json`, `messages/en.json`, `src/server/composition-root.ts`

**Interfaces:**
- Consumes: Task 6's service; Task 7's gate (`news.manage` on every page and action).
- Produces (actions): `saveArticleAction(formData)` with `action` ∈ `draft | publish | unpublish` and optional `publishAt` (Asia/Bangkok local time → UTC); `trashArticleAction`, `restoreArticleAction`; `searchProductsAction(query)` returning `{ id, name, sku, imageUrl }[]` (10 at most, active products, name or SKU contains).
- List (from `posts.html`): status tabs ทั้งหมด / เผยแพร่แล้ว / ตั้งเวลา / ฉบับร่าง with counts, plus "ถังขยะ (n)"; search by title; category filter; columns title, categories, author byline, languages present (TH/EN), status, date; row link to the editor; in trash, a restore button instead. Left out: "รอตรวจ" (D-129), reader counts (D-239).
- Editor (from `post-edit.html`): language switch ไทย/English; title; slug field under it (`/news/`); the rich-text toolbar (paragraph style ย่อหน้า/หัวข้อ 2/หัวข้อ 3/ข้อความอ้างอิง, bold, italic, link, bulleted and numbered list, YouTube, product card); a byline field (ผู้เขียน) prefilled with the editor's first name; side panels การเผยแพร่ (status, publish now or schedule with a date-time), หมวดหมู่ (checkboxes of listed categories), แท็ก (`TagInput`), สินค้าที่เกี่ยวข้อง (`ProductPicker`); buttons ดูตัวอย่าง, บันทึกร่าง, เผยแพร่ (or อัปเดต when published), ยกเลิกการเผยแพร่, ย้ายไปถังขยะ (confirm). Left out: image button and featured-image upload (D-237; an imported article shows its existing featured image read-only), meta description and Google preview, visibility, edit history, ส่งตรวจ.
- **Editor dependency (D-244):** the builder picks one maintained rich-text library with an MIT or similar licence that outputs plain HTML, supports a custom inline-block node (for the product card) and an image node to enable later; pinned exact version in `package.json`; recorded as D-244 with licence and version. It must not be loaded on any storefront page.
- Preview (`news/[id]/preview`): renders the saved draft with the storefront's `NewsArticleView`, behind `news.manage`, with `robots: noindex`.

- [ ] **Step 1: Write the failing tests:** controller validation (Thai title/body required; English all-or-nothing; a past `publishAt` publishes now; unknown category or product ids refused); each action refuses without `news.manage`; the list derives "ตั้งเวลา" from a future `published_at`; the editor shows no image control; the preview page refuses a Customer.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `npm test`, typecheck — PASS. **Commit** `feat: add the news list and editor to the back office`

### Task 10: Product cards in articles and related news on product pages

**Files:**
- Modify: `src/server/adapters/wordpress/sanitize.ts` (+ test), `src/app/[locale]/(shop)/news/[slug]/_components/ArticleBody.tsx` (+ test), `src/server/services/news/news-read-service.ts`, `src/server/repositories/news/news-repository.ts`, `src/app/[locale]/(shop)/product/[productId]/detail/page.tsx`, `src/server/composition-root.ts`
- Create: `src/server/services/news/product-card-embed.ts` (+ test), `src/app/[locale]/(shop)/news/[slug]/_components/ArticleProductCard.tsx`, `src/app/[locale]/(shop)/product/[productId]/detail/_components/RelatedNews.tsx`

**Interfaces:**
- Produces: `PRODUCT_CARD_TAG = 'tinz-product'` (D-245); the sanitiser allows `<tinz-product data-id="…"></tinz-product>` only, keeps `data-id` only when it is a uuid, drops the element otherwise, and keeps it empty; `splitAtProductCards(html: string): Array<{ kind: 'html'; html: string } | { kind: 'product'; productId: string }>`; `productIdsIn(html: string): string[]`.
- The article page loads the cards' products in one read (current name, first image, price range, stock status, active), renders `ArticleProductCard` in place of each placeholder (the storefront `ProductCard` look, linking to `/product/{id}/detail`), and nothing for an unknown or inactive product.
- `listRelatedNewsForProduct(deps, { productId, locale }) → NewsCardData[]`: every live article linked to the product, newest first, no limit (D-239); the product page shows them under "ข่าวที่เกี่ยวข้อง" / "Related news" with the existing `NewsCard`, and nothing when there are none.

- [ ] **Step 1: Write the failing tests:** the sanitiser keeps a valid card, strips `onclick` and any other attribute, drops a card with a non-uuid id, drops children inside the tag; `splitAtProductCards` splits around two cards and keeps surrounding HTML intact; the article renders a card with the current price and nothing for an inactive product; the product page lists related news and renders nothing without links.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `npm test`, `npm run test:integration`, typecheck — PASS. **Commit** `feat: render product cards in articles and related news on product pages`

### Task 11: Whole-branch check and the manual checklist

- [ ] **Step 1:** `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run build` — all pass; record the counts in *Outcome*.
- [ ] **Step 2:** Walk the pre-merge checklist in `docs/08-security-testing.md` for the new actions and the job.
- [ ] **Step 3:** Confirm every doc listed in spec §12 changed; update `docs/07-frontend-components.md` with the `(admin)` components and `AccountMenu`'s link; update this plan's *Status* and *Outcome*.
- [ ] **Step 4: Commit** `docs: record plan 016's outcome`

## Manual test checklist

Run by a person on the dev pool. Never tick a box for a check nobody performed.

- [ ] Sign up a new account and sign in: it is a Customer; `/th/admin` shows the no-access page; the account menu has no "หลังบ้าน".
- [ ] `npm run account:set-role -- <your email> super_admin`: the next page load shows "หลังบ้าน", and `/th/admin` opens with all three menu sections.
- [ ] Make a second account Blogger: it sees only แดชบอร์ด and ข่าวและบทความ; opening `/th/admin/users` directly shows no access.
- [ ] Make an account Sale-manager: it sees the home page with the "more tools later" line.
- [ ] Try to demote yourself while you are the only Top-level Admin: refused with the message; promote another, then it works.
- [ ] Block an account that is signed in elsewhere: its next page load is signed out; signing in again (password, then Google) shows "บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อร้าน"; unblock, and it signs in.
- [ ] In the grid, untick `news.manage` for Blogger and save: a Blogger loses the news menu on the next page load; tick it back.
- [ ] As a Blogger: write an article in Thai, save draft (not on `/th/news`), preview it, publish it (on the site), edit it (the site changes), schedule another for 5 minutes ahead (appears after), unpublish, trash and restore.
- [ ] Add tags, link two products and insert a product card: the card shows the current price; the product page lists the article under related news.
- [ ] Edit an imported article, then run `npm run job:news-import` (and `-- --full`): the edit stays, and the summary counts one skipped staff edit.
- [ ] Everything above works in English (`/en/admin`) and the back office is usable at 1024px wide.

## Outcome

Task 7 (the shell and the gate) is built: `requirePermission`, the layout and side menu, the home page, the no-access page and the account-menu link. Structure learned while building it (D-249): the layout cannot be the check (it does not know the path, and does not re-run on a client-side move), so it draws the frame only for an account holding `backoffice.enter` and every page calls `requirePermission` itself; the no-access page sits in a sibling route group `(admin-open)` so the layout does not wrap it and it cannot loop. Every later page under `/admin` goes in `(admin)/admin/` and calls `requirePermission` first. The integration test of the real `findCustomerSession` query (role key, permission keys, `blockedAt`) was added, deferred from Task 4's review.

## Not in this plan

Image upload (Q-063, D-237); reader counts, SEO description, edit history, members-only visibility (D-239); the mockup's dashboard figures, orders, slips, products, Excel, Shopee and audit screens (later stages); the PROD maintenance mode (plan 017); AWS hosting (Q-063).
