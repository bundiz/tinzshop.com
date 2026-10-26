# 010 — Shopee catalogue mirror: schema and 10-minute sync — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

- **Status:** Not started — 2026-10-26
- **Phase:** 2 (catalogue foundation), as re-scoped by the owner on 2026-10-26
- **Requirements delivered:** REQ-004 (as D-103), REQ-005 (within Shopee's two tiers), REQ-006, REQ-021 (catalogue direction, as D-095)
- **Blocked by:** nothing. The design's §2 *Authority* lifts the Q-013/Q-014 block for this work.
- **Depends on plan:** 001
- **Spec:** `docs/superpowers/specs/2026-10-26-shopee-catalogue-mirror-database-design.md` (approved 2026-10-26). Read it before any task. Section numbers below (§n) refer to it.

**Goal:** Our PostgreSQL holds a complete, current copy of the Shopee shop's catalogue, refreshed by a secret-protected job endpoint, so later plans can build the storefront and admin on top of it without calling Shopee.

**Architecture:** A Shopee adapter signs requests and parses responses into a channel-neutral `CatalogueItemSnapshot`. A framework-free sync service plans each run (time window plus a full stock sweep) and hands snapshots to a Prisma repository, which upserts one item per transaction. A job route calls the service under a PostgreSQL advisory lock. Shopee tokens are stored encrypted.

**Tech Stack:** Next.js 16 route handlers, TypeScript 5.9, Zod 4, Prisma 7.10 with `@prisma/adapter-pg` and `pg`, PostgreSQL 17 (Docker, local only), Vitest 4.

**Not in this plan** (follow-on plans, see end): staff sign-in and admin screens, storefront pages, orders and the manual stock list.

## Global Constraints

- Node `^20.19 || ^22.12 || >=24.0` (Prisma 7.10.0 engines). The team's machines run 20.20.2.
- Pin exactly: `prisma` 7.10.0, `@prisma/client` 7.10.0, `@prisma/adapter-pg` 7.10.0, `pg` 8.23.1, `@types/pg` 8.23.1. Install with `npx npm@11.21.0 install --save-exact …`; npm 10.8.2 crashes on this tree. Afterwards, `npm ci` with npm 10.8 must still work.
- PostgreSQL 17 locally. The minimum is 15, for `NULLS NOT DISTINCT`.
- Database identifiers are `snake_case`, with singular table names, via `@@map` / `@map`. Every one must be in `docs/12-glossary.md` (D-014).
- Money is stored as `BigInt` satang in columns ending `_satang`. `bahtToSatang` is the only place money is rounded (D-010).
- Shopee ids are `BigInt` in the database. Our primary keys are `String @id @default(uuid()) @db.Uuid`.
- Layers (D-101):
  - `src/server/controllers/`, `src/server/services/` and `src/server/repositories/` are the three layers.
  - `src/server/services/**` imports nothing from `next`, `react`, `@prisma/*` or `src/generated/**`.
  - Prisma is imported only in `src/server/repositories/**`.
  - Only `src/server/adapters/shopee/**` may build a Shopee URL or sign a request.
- Never read or print `.env`. Read configuration only through `src/server/config.ts`. A token, the partner key or a signed URL never appears in a log, an error message, a response body or the repository.
- The default Shopee host is `https://openplatform.sandbox.test-stable.shopee.sg`. The live host comes only from production configuration.
- The website never writes stock, and no order status is assumed (D-096, D-018).
- Tests come in two kinds:
  - unit tests in `src/**/*.test.ts` (`npm test`, no database)
  - integration tests in `tests/integration/**/*.test.ts` (`npm run test:integration`, real PostgreSQL)

## Review Focus

These five conditions are implied by the spec, but a careless implementation passes its happy-path tests while getting them wrong. Each one has a pinned test in the task that owns the code.

1. **A Shopee id above 2^53.** `JSON.parse` has already rounded it, so it must be rejected (that item fails), never stored rounded. Owner: Task 5, test `rejects an item_id that is not a safe integer`.
2. **A base-info batch that comes back empty although ids were requested.** It counts as a failure for those ids, never as "not found" or deleted (spec §6 failure rules). Owner: Task 9, test `treats an empty batch response as failures, not as not-found`.
3. **Secrets leaking through errors.** A Shopee error, or a failed sync, must not put the access token, the partner key or the `sign` query into the error message or `sync_run.error_detail`. Owner: Task 5, test `error messages never contain the token or the signature`.
4. **A re-sync wiping admin-owned fields.** `is_active`, categories, shipping size tier, pre-order date and the `en` translation must survive it. Owner: Task 8, test `preserves admin-owned fields across re-sync`.
5. **Shopee removing or re-ordering models between runs.** Surviving models keep their `variant.id`, the option links are rebuilt, and a removed model's variant is set inactive, never deleted. Owner: Task 8, test `keeps variant ids stable and deactivates removed models`.

---

## File map

| File | Responsibility | Task |
| :--- | :--- | :--- |
| `docs/**`, `CLAUDE.md` | Decisions, glossary, scope and doc updates (rule 13) | 1 |
| `compose.yaml`, `docker/postgres/init/01-create-test-database.sql` | Local PostgreSQL 17 with `tinzshop` and `tinzshop_test` databases | 2 |
| `prisma.config.ts`, `prisma/schema.prisma`, `prisma/migrations/**` | Prisma setup, schema, reviewed SQL migrations | 2, 3 |
| `src/server/config.ts` | Zod-validated environment: `getDatabaseUrl()`, `getServerConfig()` | 2 |
| `vitest.config.ts`, `vitest.integration.config.ts`, `tests/integration/setup/*` | Unit and integration test runners, database reset | 2 |
| `src/server/services/money.ts` | `bahtToSatang` | 4 |
| `src/lib/secret-box.ts` | AES-256-GCM `encryptSecret` / `decryptSecret` | 4 |
| `src/server/adapters/shopee/sign.ts`, `errors.ts`, `schemas.ts`, `client.ts`, `__fixtures__/*` | Signed HTTP calls and response parsing | 5 |
| `src/server/services/catalogue-snapshot.ts` | Channel-neutral `CatalogueItemSnapshot`, `ListedItem`, `CatalogueSource` types | 6 |
| `src/server/adapters/shopee/map-item.ts` | Shopee responses → `CatalogueItemSnapshot` | 6 |
| `src/server/repositories/prisma.ts` | Prisma client singleton | 3 |
| `src/server/repositories/channel-authorization-repository.ts` | Token row read and write | 7 |
| `src/server/services/channel-authorization-service.ts` | Connect a shop; hand out a valid access token | 7 |
| `src/server/adapters/shopee/token-issuer.ts` | `TokenIssuer` backed by the Shopee client | 7 |
| `src/server/controllers/shopee-authorization-controller.ts` (modify) | Callback now exchanges the code | 7 |
| `src/server/repositories/catalogue-repository.ts` | Snapshot upsert, known items, not-found marking | 8 |
| `src/server/repositories/sync-run-repository.ts` | `sync_run` rows | 8 |
| `src/server/repositories/advisory-lock.ts` | `tryWithAdvisoryLock` on a dedicated connection | 8 |
| `src/server/adapters/shopee/catalogue-source.ts` | `CatalogueSource` over the Shopee client | 9 |
| `src/server/services/catalogue-sync-service.ts` | `runCatalogueSync` orchestration | 9 |
| `src/server/controllers/catalogue-sync-controller.ts`, `src/app/api/jobs/shopee-sync/route.ts` | Secret-protected job endpoint | 10 |
| `src/server/composition-root.ts` | Wires config, Prisma, client and services for routes | 7, 10 |

---

### Task 1: Record the decisions in the documentation

`docs/**` and `CLAUDE.md` are shared files (`09-coding-guidelines.md` Part 2 Rule 2). **Get the other developer's agreement on this task's diff before merging.**

**Files:**
- Modify: `docs/11-decisions.md`, `docs/12-glossary.md`, `docs/13-open-questions.md`, `docs/02-scope-and-phases.md`, `docs/03-architecture.md`, `docs/04-tech-stack-and-structure.md`, `docs/05-database.md`, `docs/14-integrations.md`, `docs/plans/002-catalogue-stock-and-admin-foundation.md`, `CLAUDE.md`

**Interfaces:**
- Produces: decision ids D-094 – D-103 and question Q-056, which later tasks cite in code comments.

- [x] **Step 1: Add the decision rows to `docs/11-decisions.md`.** Put them in a new section, `## Catalogue mirror (owner, 2026-10-26)`. Every row is `Accepted` and links to the spec.
  - D-094: Shopee is the master for product name, description, photos, options, price and stock. Our admin never edits them (spec O-1).
  - D-095: the catalogue is pulled from the Shopee Open API every 10 minutes, and storefront pages never call Shopee. Supersedes D-081 for the catalogue direction (O-2).
  - D-096: website orders never change stock. Staff update stock in BigSeller by hand from an admin list of paid order lines. Supersedes D-068 and removes REQ-020's no-oversell guarantee (O-3).
  - D-097: photos are shown from Shopee's image URLs until file storage is chosen (O-5).
  - D-098: customers see only our own reviews. Shopee's rating and sales count are stored for sorting only (O-6).
  - D-099: admin assigns products to our own menu categories (O-7).
  - D-100: Shopee's orders are not imported (O-8).
  - D-101: server code is layered controllers → services → repositories, with external systems in adapters. Services are framework-free, and Prisma is imported only in repositories (O-9).
  - D-102: every website product comes from Shopee; there are no website-only products (O-10).
  - D-103: Parent SKU and ModelSKU are stored as Shopee holds them, with no uniqueness constraint. Identity is Shopee's item and model id (spec §5.8).
  - Also set D-068's status to `Superseded — see D-096`, and D-081's to `Superseded for the catalogue — see D-095`.
- [x] **Step 2: Add glossary rows to `docs/12-glossary.md`.** Each needs English, Thai, a definition and the identifier:
  - `product_translation`, `product_image`, `category_translation`, `product_category`, `variant_option_value`
  - `shipping_size_tier_rate`
  - `channel_item`, `channel_listing`, `channel_authorization`, `external_item_id`, `external_model_id`
  - `sync_run`, catalogue sync (`catalogue_sync`), `catalogue_item_snapshot`
  - product activation (`is_active`)
  - manual stock adjustment (ตัดสต๊อกด้วยมือ, `stock_adjustment`)
- [x] **Step 3: Update `docs/13-open-questions.md`.**
  - Q-042 → PARTIALLY RESOLVED: sandbox access has existed since 2026-10-20; the live app still needs go-live and the owner's authorization.
  - Q-043: add a note pointing to D-095.
  - Q-013: add a note that the site mirrors Shopee's two tiers (D-094, spec §2).
  - Add **Q-056**, UNRESOLVED: "What is Shopee's daily API call limit for this app, and does the full stock sweep in plan 010 stay under it at the real catalogue size?" Ask: developers, then Shopee support.
  - Update the status counts table to match.
- [x] **Step 4: Update `docs/02-scope-and-phases.md`.**
  - REQ-004: per D-103.
  - REQ-020: rewrite per D-096.
  - REQ-021: the mechanism is BigSeller → Shopee → our pull (D-095); the site pushes nothing.
  - REQ-036: kept; Shopee fields are read-only.
  - REQ-037: narrowed to inline and bulk editing of site-only fields.
  - REQ-038: moved to *Removed* (D-094).
  - Add plan 010 to the phase 2 text.
- [x] **Step 5: Update the other docs.**
  - `03-architecture.md`: layers per D-101; order flow has no stock lock; invariant 1 per D-096.
  - `04-tech-stack-and-structure.md`: the folder tree per the spec's §4.
  - `05-database.md`: the catalogue and stock sections now point to the spec, with a summary of §5.
  - `14-integrations.md`: Shopee → **RESEARCHED**, citing developer-guide/20, developer-guide/644, `v2.product.add_item`, `v2.product.init_tier_variation`, `v2.bundle_deal.add_bundle_deal`, `v2.product.add_kit_item`, and the sandbox findings of 2026-10-20.
  - `plans/002…`: status line `Superseded in part by plan 010 — 2026-10-26`.
  - `CLAUDE.md` *Current state*: implementation is unblocked for plan 010.
- [x] **Step 6: Verify the references resolve.**
  Run: `for id in D-094 D-095 D-096 D-097 D-098 D-099 D-100 D-101 D-102 D-103 Q-056; do grep -q "$id" docs/11-decisions.md docs/13-open-questions.md || echo "missing $id"; done`
  Expected: no output.
- [x] **Step 7: Commit** — `docs: record catalogue-mirror decisions D-094–D-103 and Q-056`

---

### Task 2: Local PostgreSQL, Prisma wiring, configuration and test runners

**Files:**
- Create: `compose.yaml`, `docker/postgres/init/01-create-test-database.sql`, `prisma.config.ts`, `prisma/schema.prisma`, `src/server/config.ts`, `src/server/config.test.ts`, `vitest.integration.config.ts`, `tests/integration/setup/global-setup.ts`, `tests/integration/setup/database.ts`, `tests/integration/database-connection.test.ts`
- Modify: `package.json`, `.gitignore`, `.env.example`, `vitest.config.ts`

**Interfaces:**
- Produces:
  - `getDatabaseUrl(): string` — validates `DATABASE_URL` only.
  - `parseServerConfig(env: Readonly<Record<string, string | undefined>>): ServerConfig` and `getServerConfig(): ServerConfig` (cached).
  - `type ServerConfig = { readonly shopee: { readonly apiBaseUrl: string; readonly partnerId: number; readonly partnerKey: string }; readonly jobSecret: string; readonly channelTokenEncryptionKey: Buffer }`
  - `resetDatabase(): Promise<void>` (integration tests only).

- [x] **Step 1: Install the dependencies.**
  Run: `npx npm@11.21.0 install --save-exact @prisma/client@7.10.0 @prisma/adapter-pg@7.10.0 pg@8.23.1 && npx npm@11.21.0 install --save-exact -D prisma@7.10.0 @types/pg@8.23.1`
  Expected: `found 0 vulnerabilities`.
  Then run `rm -rf node_modules && npm ci`. Expected: success.
- [x] **Step 2: Add the local database.**
  - `compose.yaml`: one service `postgres`, image `postgres:17` pinned to the exact 17.x tag current at implementation.
    - `POSTGRES_PASSWORD: ${LOCAL_POSTGRES_PASSWORD}`, `POSTGRES_DB: tinzshop`
    - port `5432:5432`, a named volume, and `./docker/postgres/init` mounted at `/docker-entrypoint-initdb.d`
  - The init SQL is `CREATE DATABASE tinzshop_test;`.
  - `.env.example` gains these placeholders, each with a comment:
    - `LOCAL_POSTGRES_PASSWORD`
    - `DATABASE_URL=postgresql://postgres:<password>@localhost:5432/tinzshop`
    - `TEST_DATABASE_URL=postgresql://postgres:<password>@localhost:5432/tinzshop_test`
    - `SHOPEE_API_BASE_URL`, `JOB_SECRET`, `CHANNEL_TOKEN_ENCRYPTION_KEY`
  - Remove the stale "NOT RESEARCHED / stack not chosen" header notes, and keep the existing `SHOPEE_*` lines.
- [x] **Step 3: Set up Prisma.**
  - `prisma/schema.prisma` has `generator client { provider = "prisma-client" output = "../src/generated/prisma" }` and `datasource db { provider = "postgresql" }`.
  - `prisma.config.ts` uses `defineConfig` with `schema: 'prisma/schema.prisma'`, `migrations: { path: 'prisma/migrations' }`, and `datasource: { url: env('DATABASE_URL') }`.
  - It loads `.env` with Node's `process.loadEnvFile('.env')`, wrapped so a missing file is ignored. No `dotenv` dependency.
  - `.gitignore` gains `src/generated/`.
  - `package.json` scripts: `db:up` (`docker compose up -d postgres`), `db:migrate` (`prisma migrate dev`), `db:generate` (`prisma generate`), `test:integration` (`vitest run --config vitest.integration.config.ts`).
  - Run `npm run db:up && npx prisma validate`. Expected: `The schema at prisma/schema.prisma is valid`.
- [x] **Step 4: Write the failing config tests** in `src/server/config.test.ts`. They use the literal env `VALID = { SHOPEE_PARTNER_ID: '1236675', SHOPEE_PARTNER_KEY: 'k'.repeat(64), JOB_SECRET: 'j'.repeat(32), CHANNEL_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64') }`.
  - `parses a valid environment` → `shopee.partnerId === 1236675`, and `channelTokenEncryptionKey.length === 32`.
  - `defaults the Shopee host to the sandbox` → `shopee.apiBaseUrl === 'https://openplatform.sandbox.test-stable.shopee.sg'`.
  - `rejects a missing partner key without echoing secrets` → throws, the message contains `SHOPEE_PARTNER_KEY`, and it does not contain `'j'.repeat(32)`.
  - `rejects an encryption key that is not 32 bytes` → with `Buffer.alloc(31).toString('base64')`, it throws with `CHANNEL_TOKEN_ENCRYPTION_KEY`.
  - `rejects a short job secret` → with `JOB_SECRET: 'short'`, it throws with `JOB_SECRET`.
  - `rejects a non-https Shopee host` → with `SHOPEE_API_BASE_URL: 'http://example.com'`, it throws.
- [x] **Step 5: Run them.** `npx vitest run src/server/config.test.ts` → FAIL, because the module isn't found.
- [x] **Step 6: Implement `src/server/config.ts`.** It has the Produces signatures above, using a Zod schema. Error messages list the variable names only.
- [x] **Step 7: Run them.** `npx vitest run src/server/config.test.ts` → PASS.
- [x] **Step 8: Set up the integration runner.**
  - `vitest.config.ts` includes only `src/**/*.test.ts`.
  - `vitest.integration.config.ts`:
    - include `tests/integration/**/*.test.ts`, with `fileParallelism: false`
    - `globalSetup: 'tests/integration/setup/global-setup.ts'`
    - read `TEST_DATABASE_URL` through Vite's `loadEnv`, and set it as `DATABASE_URL` in `test.env`
  - Global setup runs `npx prisma migrate deploy` against that URL.
  - `resetDatabase()` truncates every application table with `RESTART IDENTITY CASCADE`.
  - Test `database-connection.test.ts` → `connects to the test database`: `SELECT current_database()` returns `'tinzshop_test'`.
- [x] **Step 9: Run both suites.** `npm test && npm run test:integration` → both PASS.
- [x] **Step 10: Commit** — `chore: add local PostgreSQL, Prisma 7 wiring and validated config`

---

### Task 3: Catalogue and channel schema with hand-written constraints

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_catalogue_mirror/migration.sql` (generated, then edited), `src/server/repositories/prisma.ts`, `tests/integration/catalogue-schema.test.ts`

**Interfaces:**
- Produces:
  - Prisma models `Category`, `CategoryTranslation`, `Product`, `ProductTranslation`, `ProductImage`, `ProductCategory`, `OptionType`, `OptionValue`, `Variant`, `VariantOptionValue`, `ShippingSizeTierRate`, `ChannelItem`, `ChannelListing`, `ChannelAuthorization`, `SyncRun`, with the columns of spec §5.2–§5.4.
  - `enum ShippingSizeTier { small medium large }` (maps to `shipping_size_tier`). `enum Locale { th en }`.
  - `getPrisma(): PrismaClient` — a singleton, cached on `globalThis` in development, built with `new PrismaPg({ connectionString: getDatabaseUrl() })`.

- [x] **Step 1: Write the failing constraint tests** in `tests/integration/catalogue-schema.test.ts`. Each test starts from `resetDatabase()`.
  - `rejects negative stock` → updating `variant.stock_quantity` to `-1` throws a check-constraint error.
  - `rejects a second no-model listing for the same item` → two `channel_listing` rows with the same `channel_item_id` and `external_model_id = null` → the second throws a unique violation.
  - `allows distinct model ids for the same item` → `external_model_id` 1n and 2n both insert.
  - `rejects a channel other than shopee` → `channel_item.channel = 'lazada'` throws.
  - `stores int64 ids exactly` → `external_item_id = 9007199254740993n` reads back equal.
- [x] **Step 2: Run them.** `npm run test:integration -- catalogue-schema` → FAIL (the tables don't exist).
- [x] **Step 3: Write the models** in `prisma/schema.prisma`, column for column as in spec §5.2–§5.4. Rules:
  - `@@map` uses snake_case singular names.
  - Money uses `BigInt`, and timestamps use `@db.Timestamptz(6)`.
  - `raw_payload` and `warnings` use `Json`.
  - The only unique constraints are those the spec names: `channel_item (channel, external_item_id)`, `channel_item.product_id`, `channel_listing.variant_id`, `product_translation (product_id, locale)`, `product_image (product_id, position)`, `category.slug`, `channel_authorization (channel, external_shop_id)`.
  - Do **not** declare the `channel_listing (channel_item_id, external_model_id)` unique in Prisma.
  - Add **non-unique** `@@index` on `product.parent_sku` and `variant.model_sku` (spec §5.8, D-103).
- [x] **Step 4: Create the migration without applying it.** Run `npx prisma migrate dev --create-only --name catalogue_mirror`, then append to its `migration.sql`:
  ```sql
  ALTER TABLE variant ADD CONSTRAINT variant_stock_quantity_non_negative CHECK (stock_quantity >= 0);
  ALTER TABLE channel_item ADD CONSTRAINT channel_item_channel_known CHECK (channel = 'shopee');
  ALTER TABLE channel_authorization ADD CONSTRAINT channel_authorization_channel_known CHECK (channel = 'shopee');
  CREATE UNIQUE INDEX channel_listing_item_model_key ON channel_listing (channel_item_id, external_model_id) NULLS NOT DISTINCT;
  INSERT INTO shipping_size_tier_rate (tier, price_satang) VALUES ('small', 5000), ('medium', 10000), ('large', 0);
  ```
  Read the whole SQL file before applying it (D-015).
- [x] **Step 5: Apply and check for drift.** Run `npx prisma migrate dev`, then run `npx prisma migrate dev` again.
  Expected on the second run: "Already in sync" and no new migration. **If Prisma proposes to drop `channel_listing_item_model_key`, stop and report it; don't work around it.**
- [x] **Step 6: Implement `src/server/repositories/prisma.ts`** with the `getPrisma()` signature above, importing `PrismaClient` from `@/generated/prisma/client`.
- [x] **Step 7: Run them.** `npm run test:integration -- catalogue-schema` → PASS. `npm run typecheck` → PASS.
- [x] **Step 8: Commit** — `feat: add catalogue mirror schema with stock and listing constraints`

---

### Task 4: Money conversion and token encryption

**Files:**
- Create: `src/server/services/money.ts`, `src/server/services/money.test.ts`, `src/lib/secret-box.ts`, `src/lib/secret-box.test.ts`

**Interfaces:**
- Produces:
  - `bahtToSatang(baht: number): bigint` — throws `RangeError` for a negative, non-finite, or more-than-2-decimal input (tolerance `1e-6` on `baht * 100`).
  - `encryptSecret(plaintext: string, key: Buffer): string` → `v1.<iv>.<tag>.<ciphertext>`, each part base64url, with a 12-byte IV.
  - `decryptSecret(sealed: string, key: Buffer): string` — throws on a bad format, the wrong key, or tampering.

- [x] **Step 1: Write the failing tests.**
  - `money.test.ts` → table `converts baht to satang`: `1590 → 159000n`, `2990 → 299000n`, `133.33 → 13333n`, `19.99 → 1999n`, `0.1 + 0.2 → 30n`, `0 → 0n`.
  - `money.test.ts` → `rejects impossible amounts`: `-1`, `NaN`, `Infinity` and `1.234` each throw `RangeError`.
  - `secret-box.test.ts` → `round-trips Thai text` (`'โทเค็นทดสอบ'`).
  - `secret-box.test.ts` → `produces different output each time for the same input`.
  - `secret-box.test.ts` → `rejects a tampered ciphertext`: flip one character of the last segment, and it throws.
  - `secret-box.test.ts` → `rejects the wrong key`.
  - `secret-box.test.ts` → `rejects a malformed value`: `'abc'` throws.
- [x] **Step 2: Run them.** `npx vitest run src/server/services/money.test.ts src/lib/secret-box.test.ts` → FAIL.
- [x] **Step 3: Implement both files.** Use `node:crypto` `createCipheriv('aes-256-gcm', …)`, with no new dependency.
- [x] **Step 4: Run them.** Same command → PASS.
- [x] **Step 5: Commit** — `feat: add satang conversion and AES-GCM secret box`

---

### Task 5: Shopee client — signing, calls, response parsing

**Files:**
- Create: `src/server/adapters/shopee/sign.ts`, `errors.ts`, `schemas.ts`, `client.ts`, `client.test.ts`, `sign.test.ts`, `__fixtures__/item-base-info.json`, `__fixtures__/model-list-803947690.json`, `__fixtures__/item-extra-info.json`, `__fixtures__/item-list.json`

**Interfaces:**
- Produces:
  - `signPublicRequest(input: { partnerKey: string; partnerId: number; path: string; timestamp: number }): string`
  - `signShopRequest(input: { partnerKey: string; partnerId: number; path: string; timestamp: number; accessToken: string; shopId: bigint }): string`
  - `class ShopeeApiError extends Error { readonly path: string; readonly shopeeError: string; readonly requestId: string | null; readonly httpStatus: number }`. The message is `` `${path}: ${shopeeError}` ``. A non-JSON body gives `shopeeError = 'non_json_response'`.
  - From `schemas.ts`: Zod schemas and the types `ShopeeItemListPage`, `ShopeeItemBaseInfo`, `ShopeeModelList`, `ShopeeItemExtraInfo`, `ShopeeTokenSet = { accessToken: string; refreshToken: string; expiresInSeconds: number }`, and `ShopeeShopCredentials = { accessToken: string; shopId: bigint }`.
    - Ids are parsed to `bigint` only when `Number.isSafeInteger`; otherwise parsing fails.
    - `weight` accepts a string or a number.
    - Unknown fields are allowed.
  - `createShopeeClient(options: { baseUrl: string; partnerId: number; partnerKey: string; fetch?: typeof fetch; now?: () => Date; timeoutMs?: number }): ShopeeClient`, where `ShopeeClient` has:
    - `getAccessToken({ code, shopId })` → `/api/v2/auth/token/get`
    - `refreshAccessToken({ refreshToken, shopId })` → `/api/v2/auth/access_token/get`
    - `getItemList(credentials, { offset, pageSize, itemStatuses, updateTimeFrom?, updateTimeTo? })`
    - `getItemBaseInfo(credentials, itemIds)`, at most 50 ids, otherwise `RangeError`
    - `getModelList(credentials, itemId)`
    - `getItemExtraInfo(credentials, itemIds)`, at most 50 ids
    - `callCount(): number`
    Public calls are POST with a JSON body. Shop calls are GET with query parameters, and the repeated `item_status` parameter. `ids` lists are comma-joined. Shopee returns `time` values in seconds.

- [x] **Step 1: Create the fixtures** from the newest sandbox dump. It contains no tokens (checked 2026-10-26).
  ```bash
  python3 -I - <<'EOF'
  import json, glob
  d = json.load(open(sorted(glob.glob('.shopee-sandbox/dump-*.json'))[-1]))
  env = lambda r: {"error": "", "message": "", "request_id": "fixture", "response": r}
  infos = [i for i in d['infos']['data'] if i['item_id'] in (803947687, 803947690)]
  base = 'src/server/adapters/shopee/__fixtures__/'
  json.dump(env({"item_list": infos}), open(base + 'item-base-info.json', 'w'), ensure_ascii=False, indent=2)
  json.dump(env(d['models']['data']['803947690']), open(base + 'model-list-803947690.json', 'w'), ensure_ascii=False, indent=2)
  json.dump(env({"item": [i for i in d['items']['data'] if i['item_id'] in (803947687, 803947690)], "total_count": 2, "has_next_page": False, "next_offset": 2}), open(base + 'item-list.json', 'w'), indent=2)
  EOF
  ```
  `item-extra-info.json` is written by hand in the shape seen on 2026-10-20: `{"item_list":[{"item_id":803947687,"sale":5,"views":0,"likes":0,"rating_star":4.5,"comment_count":2},{"item_id":803947690,"sale":0,"views":0,"likes":0,"rating_star":0,"comment_count":0}]}`, wrapped in the same envelope.
- [x] **Step 2: Write the failing tests.** The literal vectors were computed with `openssl`:
  - `sign.test.ts` → `signs a public request`: key `'test-partner-key'`, partnerId `1000001`, path `'/api/v2/auth/token/get'`, timestamp `1700000000` → `'6aab77ee2280e403a38937412ca70e35114f12914ecb2c697ca10a6040598254'`.
  - `sign.test.ts` → `signs a shop request`: same key and partner, path `'/api/v2/product/get_item_list'`, accessToken `'test-access-token'`, shopId `227679200n` → `'e1e83b8cba981a89a0708d4684ab92e756b70e4efee746b95f495f58e79c7160'`.
  - The `client.test.ts` tests use a fake `fetch` that records each request, and `now = () => new Date(1700000000_000)`:
    - `getAccessToken posts code, shop_id and partner_id with a public signature` → URL path `/api/v2/auth/token/get`; query `partner_id=1000001`, `timestamp=1700000000`, `sign=6aab77ee…8254`; JSON body `{ code: 'abc', shop_id: 227679200, partner_id: 1000001 }`. The fake response `{ access_token: 'a', refresh_token: 'r', expire_in: 14400 }` maps to `{ accessToken: 'a', refreshToken: 'r', expiresInSeconds: 14400 }`.
    - `getItemList signs with the shop signature and repeats item_status` → `sign=e1e83b8c…7160`; `searchParams.getAll('item_status')` equals `['NORMAL', 'UNLIST']`; with `updateTimeFrom = new Date(1699999000_000)`, `update_time_from=1699999000`.
    - `parses real sandbox base info` → with `item-base-info.json`, the result has 2 items, and item `803947690n` has `item_sku === 'SBX-IT-SSD'` and `has_model === true`.
    - `rejects an item_id that is not a safe integer` → a fixture copy with `item_id` `9007199254740993` makes `getItemBaseInfo` throw.
    - `refuses more than 50 ids` → 51 ids throw `RangeError`, and no request is sent.
    - `error messages never contain the token or the signature` → the response `{ error: 'error_auth', message: 'Invalid access_token.', request_id: 'r1' }` throws `ShopeeApiError` with `shopeeError === 'error_auth'`; `String(err)` does not contain `'test-access-token'` or `'sign='`.
    - `reports a non-JSON response` → a 502 with an HTML body throws `ShopeeApiError` with `shopeeError === 'non_json_response'`.
    - `counts calls` → after 2 calls, `callCount() === 2`.
- [x] **Step 3: Run them.** `npx vitest run src/server/adapters/shopee` → FAIL.
- [x] **Step 4: Implement** `sign.ts`, `errors.ts`, `schemas.ts` and `client.ts` with the Produces signatures. Use `AbortSignal.timeout(timeoutMs ?? 20000)`. Convert a bigint to a JSON number for request bodies only after checking `Number.isSafeInteger`.
- [x] **Step 5: Run them.** `npx vitest run src/server/adapters/shopee` → PASS.
- [x] **Step 6: Commit** — `feat: add signed Shopee client with defensive response parsing`

---

### Task 6: Channel-neutral snapshot and the Shopee mapper

**Files:**
- Create: `src/server/services/catalogue-snapshot.ts`, `src/server/adapters/shopee/map-item.ts`, `src/server/adapters/shopee/map-item.test.ts`

**Interfaces:**
- Consumes: the Task 5 schema types; `bahtToSatang` (Task 4).
- Produces (types only in `catalogue-snapshot.ts`):
  ```ts
  type CatalogueVariantSnapshot = { externalModelId: bigint | null; modelSku: string | null; priceSatang: bigint; originalPriceSatang: bigint; stockQuantity: number; isActive: boolean; position: number; optionIndexes: readonly number[] }
  type CatalogueItemSnapshot = { externalItemId: bigint; externalStatus: string; externalCategoryId: bigint; isKit: boolean; externalCreatedAt: Date; externalUpdatedAt: Date; parentSku: string | null; name: string; description: string; brandName: string | null; weightGrams: number | null; images: readonly { url: string; externalImageId: string }[]; optionTypes: readonly { name: string; values: readonly string[] }[]; variants: readonly CatalogueVariantSnapshot[]; salesCount: number; ratingStar: number; ratingCount: number; rawPayload: unknown }
  type ListedItem = { externalItemId: bigint; externalStatus: string; isKit: boolean }
  type CatalogueSource = { listItems(window: { from: Date; to: Date } | null): Promise<ListedItem[]>; fetchItems(items: readonly ListedItem[]): Promise<{ snapshots: CatalogueItemSnapshot[]; notFound: bigint[]; failures: { externalItemId: bigint; reason: string }[] }>; apiCallCount(): number }
  ```
  - `mapShopeeItem(input: { baseInfo: ShopeeItemBaseInfo; modelList: ShopeeModelList | null; extraInfo: ShopeeItemExtraInfo | null; isKit: boolean }): CatalogueItemSnapshot`. It throws `CatalogueMappingError` (exported from `map-item.ts`) when `has_model` is true but `modelList` is null, or when a `tier_index` points outside the options.
  - Option names come from `standardise_tier_variation`, falling back to `tier_variation`.
  - A model is active when `model_status === 'MODEL_NORMAL'`.
  - Stock is `stock_info_v2.summary_info.total_available_stock`.
  - Price is `price_info[0].current_price` / `original_price`.
  - An empty `item_sku` / `model_sku` becomes `null`.
  - A no-model item gets one variant with `externalModelId: null` and `modelSku` = `item_sku`.

- [x] **Step 1: Write the failing tests** with the Task 5 fixtures:
  - `maps a two-tier item`: item `803947690n` →
    - `optionTypes` equals `[{ name: 'Capacity', values: ['1TB', '2TB'] }, { name: 'Colour', values: ['Black', 'Blue'] }]`, and there are 4 variants
    - the variant with `externalModelId === 12998741n` has `modelSku 'SBX-IT-SSD-1TB-BLU'`, `priceSatang 299000n`, `stockQuantity 2`, `optionIndexes [0, 1]` and `isActive true`
    - `parentSku 'SBX-IT-SSD'`, `weightGrams 200`, `brandName 'NoBrand'`
    - `images[0].url === 'https://cf.shopee.co.th/file/sg-11134201-81z1k-muj2ro5yyn7mb3'`
    - `externalCreatedAt` equals `new Date(1793004278_000)`
  - `maps an item without models to one variant`: item `803947687n` → `optionTypes []`, and exactly one variant with `externalModelId null`, `modelSku 'SBX-SW-MK8'`, `priceSatang 159000n`, `stockQuantity 12`.
  - `turns an empty SKU into null`: `item_sku: ''` → `parentSku null`.
  - `deactivates a model that is not MODEL_NORMAL`.
  - `uses extra info when present and zero when absent`: with the fixture, item 803947687 has `salesCount 5`, `ratingStar 4.5`, `ratingCount 2`; with `extraInfo: null`, all three are `0`.
  - `parses weight given as text or number`: `'0.2'` and `0.2` both give `200`; `'abc'` gives `null`.
  - `refuses an item marked has_model without a model list`: throws `CatalogueMappingError`.
- [ ] **Step 2: Run them.** `npx vitest run src/server/adapters/shopee/map-item.test.ts` → FAIL. (not run before implementation — see task 6 report; behaviour pinned by mutation checks in review)
- [x] **Step 3: Implement both files.**
- [x] **Step 4: Run them.** Same command → PASS, and `npm run typecheck` → PASS.
- [x] **Step 5: Commit** — `feat: map Shopee items to channel-neutral catalogue snapshots`

---

### Task 7: Shopee authorization — stored tokens and the callback exchange

**Files:**
- Create: `src/server/repositories/channel-authorization-repository.ts`, `src/server/services/channel-authorization-service.ts`, `src/server/services/channel-authorization-service.test.ts`, `src/server/adapters/shopee/token-issuer.ts`, `src/server/composition-root.ts`, `tests/integration/channel-authorization-repository.test.ts`
- Modify: `src/server/controllers/shopee-authorization-controller.ts`, `src/server/controllers/shopee-authorization-controller.test.ts`, `src/app/api/callbacks/shopee/route.ts`

**Interfaces:**
- Consumes: `encryptSecret` / `decryptSecret` (Task 4), `ShopeeClient` (Task 5), `getPrisma` (Task 3), `getServerConfig` (Task 2).
- Produces:
  - `type StoredChannelAuthorization = { channel: 'shopee'; externalShopId: bigint; accessTokenCiphertext: string; refreshTokenCiphertext: string; accessTokenExpiresAt: Date; refreshTokenExpiresAt: Date; authorizationExpiresAt: Date | null }`
  - Repository: `findChannelAuthorization(channel: 'shopee'): Promise<StoredChannelAuthorization | null>` and `saveChannelAuthorization(record: StoredChannelAuthorization): Promise<void>` (an upsert on `(channel, external_shop_id)`).
  - `type IssuedTokens = { accessToken: string; refreshToken: string; expiresInSeconds: number }`
  - `type TokenIssuer = { exchangeCode(input: { code: string; externalShopId: bigint }): Promise<IssuedTokens>; refresh(input: { refreshToken: string; externalShopId: bigint }): Promise<IssuedTokens> }`
  - `createShopeeTokenIssuer(client: ShopeeClient): TokenIssuer`
  - `createChannelAuthorizationService(deps: { issuer: TokenIssuer; repository: { find: typeof findChannelAuthorization; save: typeof saveChannelAuthorization }; encryptionKey: Buffer; now: () => Date })` returns:
    - `connectShop(input: { code: string; externalShopId: bigint }): Promise<void>`
    - `getShopCredentials(): Promise<{ accessToken: string; externalShopId: bigint }>`
    It refreshes when under 5 minutes remain. `refreshTokenExpiresAt` is `now` + 30 days. It throws `ChannelNotConnectedError` (exported from the service) when no row exists. `authorizationExpiresAt` stays `null` in this plan, which the spec allows; filling it from `v2.shop.get_shop_info` → `expire_time` belongs to follow-on plan 1.
  - `createShopeeAuthorizationCallbackHandler(deps: { connectShop: (input: { code: string; externalShopId: bigint }) => Promise<void> }): (request: Request) => Promise<Response>`
  - `composition-root.ts`: `getChannelAuthorizationService()` and `getShopeeClient()`, built lazily from `getServerConfig()`.

- [x] **Step 1: Write the failing unit tests** for the service. They use fakes for the issuer and the repository, and `now = 2026-10-26T00:00:00Z`.
  - `connectShop stores only encrypted tokens with correct expiry`:
    - the issuer returns `{ accessToken: 'acc-1', refreshToken: 'ref-1', expiresInSeconds: 14400 }`
    - the saved record's ciphertexts decrypt to `'acc-1'` and `'ref-1'`, and neither ciphertext contains `'acc-1'`
    - `accessTokenExpiresAt` is `2026-10-26T04:00:00Z`, and `refreshTokenExpiresAt` is `2026-11-25T00:00:00Z`
  - `returns the stored token while more than 5 minutes remain`: with 10 minutes left, `refresh` isn't called.
  - `refreshes and saves the new pair when under 5 minutes remain`: with 4 minutes left, `refresh` is called once with `'ref-1'`, the saved record decrypts to the new pair, and the new access token is returned.
  - `throws ChannelNotConnectedError when no shop is connected`.
- [x] **Step 2: Update the callback tests** (`shopee-authorization-controller.test.ts`) so the handler is built with a fake `connectShop`:
  - shop success → `connectShop` is called with `{ code: '5a54…4653', externalShopId: 602226924n }`, status `200`, body `{ data: { accountType: 'shop', shopId: 602226924, connected: true } }` (with **no `code`**), and `Cache-Control: no-store`
  - main account → `422` with error code `shopee.authorization.main_account_unsupported`
  - `connectShop` rejects with a `ShopeeApiError` → `502` with error code `shopee.authorization.token_exchange_failed`, and the body doesn't contain the code
  - every existing invalid-input test still returns `400`
- [x] **Step 3: Write the failing integration test** `channel-authorization-repository.test.ts`: `saves and reads back one authorization per shop` — saving twice for shop `227679200n` leaves one row, and the second save's values win.
- [x] **Step 4: Run them.** `npx vitest run src/server && npm run test:integration -- channel-authorization` → FAIL.
- [x] **Step 5: Implement** the repository, the service, the token issuer, the handler factory and the composition root with the Produces signatures. The route becomes `export async function GET(request: Request): Promise<Response>`, built from `getChannelAuthorizationService().connectShop`.
- [x] **Step 6: Run them.** Same commands → PASS. `npm run typecheck` → PASS.
- [x] **Step 7: Commit** — `feat: exchange the Shopee callback code and store tokens encrypted`

---

### Task 8: Catalogue persistence — upsert, sync runs, advisory lock

**Files:**
- Create: `src/server/repositories/catalogue-repository.ts`, `src/server/repositories/sync-run-repository.ts`, `src/server/repositories/advisory-lock.ts`, `tests/integration/catalogue-repository.test.ts`, `tests/integration/advisory-lock.test.ts`, `tests/integration/fixtures/snapshots.ts`

**Interfaces:**
- Consumes: `CatalogueItemSnapshot`, `ListedItem` (Task 6); `getPrisma` (Task 3).
- Produces:
  - `upsertCatalogueItem(snapshot: CatalogueItemSnapshot, syncedAt: Date): Promise<'created' | 'updated'>`. It runs in one interactive transaction:
    - **Create:** `product` (`is_active: false`), the `th` translation, images, options, variants, links and listings.
    - **Update:** replaces the `th` translation and the images, rebuilds the options and links, matches variants by `channel_listing.external_model_id` (null to null), creates variants for new models, and sets variants for missing models to `is_active = false` with listing status `'NOT_FOUND'`.
    - It never touches `is_active`, the categories, `shipping_size_tier`, `is_pre_order`, `release_date` or the `en` translation, and never deletes a product or variant.
  - `listKnownItems(): Promise<ListedItem[]>` — every `channel_item` whose `external_status` isn't `'NOT_FOUND'`.
  - `markItemsNotFound(externalItemIds: readonly bigint[], syncedAt: Date): Promise<number>`
  - `startSyncRun(input: { windowFrom: Date | null; windowTo: Date; startedAt: Date }): Promise<string>`
  - `finishSyncRun(id: string, result: { outcome: 'succeeded' | 'failed'; finishedAt: Date; itemsSeen: number; itemsCreated: number; itemsUpdated: number; itemsDeactivated: number; apiCalls: number; warnings: readonly string[]; errorCode?: string; errorDetail?: string }): Promise<void>`
  - `recordSkippedSyncRun(at: Date): Promise<void>`
  - `findLastSucceededSyncRun(): Promise<{ windowTo: Date } | null>`
  - `tryWithAdvisoryLock<T>(lockKey: bigint, task: () => Promise<T>): Promise<{ acquired: true; value: T } | { acquired: false }>`. It uses a dedicated `pg.Client` on `getDatabaseUrl()`, `pg_try_advisory_lock`, and unlock plus `end()` in `finally`.
  - The constant `CATALOGUE_SYNC_LOCK_KEY = 6_251_010n`.

- [ ] **Step 1: Write snapshot builders** in `tests/integration/fixtures/snapshots.ts`: `twoTierSnapshot(overrides?)` and `noModelSnapshot(overrides?)`, with literal values matching the Task 6 expectations (item `803947690n` with 4 models, item `803947687n`).
- [ ] **Step 2: Write the failing tests** in `catalogue-repository.test.ts`, each starting from `resetDatabase()`:
  - `creates an inactive product with its variants`: the result is `'created'`; there's 1 product with `is_active false`, 4 variants, 2 option types, 4 values linked per variant pair, 4 listings and a `th` translation named after the snapshot.
  - `updates in place on the second sync`: change one model's `priceSatang` to `279000n` and `stockQuantity` to `0`. The result is `'updated'`, the variant ids are unchanged, and the new values are stored.
  - `keeps variant ids stable and deactivates removed models` (Review Focus 5): remove one model and reverse the option value order. The 3 surviving variant ids are unchanged, the removed variant still exists with `is_active false`, and the option links match the new indexes.
  - `preserves admin-owned fields across re-sync` (Review Focus 4): set `is_active true`, a category, `shipping_size_tier 'large'`, `release_date`, and an `en` translation. Re-upsert. All of them are unchanged.
  - `keeps exactly one variant for an item without models`: upsert `noModelSnapshot()` twice → 1 variant.
  - `lists known items and marks not-found ones`: `markItemsNotFound([803947687n])` returns `1`, and `listKnownItems()` then contains only `803947690n`.
  - `records sync runs`: start, then finish `succeeded` with `windowTo` T → `findLastSucceededSyncRun()` returns T. A later `failed` run doesn't change it.
- [ ] **Step 3: Write the failing test** `advisory-lock.test.ts` → `second holder is refused while the first holds the lock`: inside a held task, a nested `tryWithAdvisoryLock` with the same key returns `{ acquired: false }`; after the first finishes, a new call returns `{ acquired: true }`.
- [ ] **Step 4: Run them.** `npm run test:integration -- catalogue-repository advisory-lock` → FAIL.
- [ ] **Step 5: Implement the three repositories.**
- [ ] **Step 6: Run them.** Same command → PASS.
- [ ] **Step 7: Commit** — `feat: persist catalogue snapshots, sync runs and the sync lock`

---

### Task 9: The sync — Shopee catalogue source and orchestration service

**Files:**
- Create: `src/server/adapters/shopee/catalogue-source.ts`, `src/server/adapters/shopee/catalogue-source.test.ts`, `src/server/services/catalogue-sync-service.ts`, `tests/integration/catalogue-sync-service.test.ts`

**Interfaces:**
- Consumes: `ShopeeClient` (Task 5), `mapShopeeItem` (Task 6), `getShopCredentials` (Task 7), and the Task 8 repositories and lock.
- Produces:
  - `createShopeeCatalogueSource(deps: { client: ShopeeClient; credentials: () => Promise<{ accessToken: string; externalShopId: bigint }> }): CatalogueSource`
    - `listItems` pages `get_item_list` 50 at a time for `['NORMAL', 'UNLIST']`, passing the window when it's given.
    - `fetchItems` calls base info and extra info in batches of 50, then `get_model_list` for each `has_model` item.
    - An id missing from a batch that returned at least one item → `notFound`.
    - A batch that returned zero items → every id in it goes to `failures` with reason `'empty_batch_response'`.
    - A mapping or model-list error → a failure for that item only.
  - `runCatalogueSync(deps: { source: CatalogueSource; catalogue: { upsertCatalogueItem; listKnownItems; markItemsNotFound }; syncRuns: { startSyncRun; finishSyncRun; recordSkippedSyncRun; findLastSucceededSyncRun }; lock: <T>(task: () => Promise<T>) => Promise<{ acquired: true; value: T } | { acquired: false }>; now: () => Date }): Promise<CatalogueSyncSummary>`
  - `type CatalogueSyncSummary = { outcome: 'skipped' } | { outcome: 'succeeded' | 'failed'; runId: string; itemsSeen: number; itemsCreated: number; itemsUpdated: number; itemsDeactivated: number; apiCalls: number; warnings: string[]; errorCode?: string }`
  - **Run rules (spec §6):**
    - The window is `null` when there's no succeeded run. Otherwise it runs from (the last succeeded `windowTo` − 10 minutes) to `now()`.
    - Items to fetch = the union of `listItems(window)` and `listKnownItems()` (the stock sweep, spec §8 risk 1), de-duplicated by id. A listed item's status and kit flag win.
    - Each snapshot is upserted on its own; an upsert error becomes a warning `item <id>: <message>`.
    - `notFound` → `markItemsNotFound`, and the count goes to `itemsDeactivated`.
    - A thrown error from `listItems` or the credentials finishes the run `failed`: `errorCode` is `ShopeeApiError.shopeeError`, or `'unexpected'`; `errorDetail` is the error message only. No other write happens.
    - Lock not acquired → `recordSkippedSyncRun`, and it returns `{ outcome: 'skipped' }`.

- [ ] **Step 1: Write the failing source tests** in `catalogue-source.test.ts`, with a fake `ShopeeClient` serving the Task 5 fixtures:
  - `fetches base info in batches of 50`: 60 listed ids → `getItemBaseInfo` called twice, with 50 and 10 ids.
  - `reports ids missing from a non-empty batch as not found`.
  - `treats an empty batch response as failures, not as not-found` (Review Focus 2).
  - `isolates a model-list failure to its item`: the other items still produce snapshots.
  - `passes the window to get_item_list and pages until has_next_page is false`.
- [ ] **Step 2: Write the failing service tests** in `catalogue-sync-service.test.ts`: integration tests with a real database, a fake source, and the real repositories and lock.
  - `first run asks for everything and creates products`: the source sees window `null`, `itemsCreated` equals the snapshot count, and the outcome is `succeeded`.
  - `second run uses an overlapping window`: first `now` T1, second `now` T2 → window `{ from: T1 − 10 min, to: T2 }`.
  - `sweeps known items even when the window returns nothing`: on the second run `listItems` returns `[]`, and `fetchItems` still receives both known ids.
  - `records an item failure as a warning and keeps the rest`.
  - `a failed listing leaves existing products untouched`: `listItems` throws `ShopeeApiError('…/get_item_list', 'error_auth')`, the outcome is `failed` with `errorCode 'error_auth'`, and the product rows are unchanged.
  - `skips when another run holds the lock`: the `lock` fake returns `{ acquired: false }` → `{ outcome: 'skipped' }` and one `skipped` row.
- [ ] **Step 3: Run them.** `npx vitest run src/server/adapters/shopee/catalogue-source.test.ts && npm run test:integration -- catalogue-sync-service` → FAIL.
- [ ] **Step 4: Implement** `catalogue-source.ts` and `catalogue-sync-service.ts`.
- [ ] **Step 5: Run them.** Same commands → PASS. `npm test && npm run test:integration && npm run typecheck` → all PASS.
- [ ] **Step 6: Commit** — `feat: add catalogue sync with time window and stock sweep`

---

### Task 10: Job endpoint and a real sandbox run

**Files:**
- Create: `src/server/controllers/catalogue-sync-controller.ts`, `src/server/controllers/catalogue-sync-controller.test.ts`, `src/app/api/jobs/shopee-sync/route.ts`
- Modify: `src/server/composition-root.ts`

**Interfaces:**
- Consumes: `runCatalogueSync` (Task 9) and everything it needs, wired in `composition-root.ts` as `getCatalogueSyncRunner(): () => Promise<CatalogueSyncSummary>`.
- Produces: `createCatalogueSyncJobHandler(deps: { jobSecret: string; runSync: () => Promise<CatalogueSyncSummary> }): (request: Request) => Promise<Response>`, and `POST /api/jobs/shopee-sync`.
  - Auth is `Authorization: Bearer <JOB_SECRET>`, compared with `crypto.timingSafeEqual`; a length mismatch is a failure.
  - `200` for `succeeded` or `skipped`, with the summary as the body.
  - `502` for `failed`, with `{ error: { code: 'catalogue_sync.failed', runId } }`.
  - `401` with no body detail when the auth is missing or wrong.
  - `Cache-Control: no-store`.

- [ ] **Step 1: Write the failing tests** in `catalogue-sync-controller.test.ts`, with a fake `runSync`:
  - `refuses a missing secret` → `401`, and `runSync` isn't called.
  - `refuses a wrong secret of the same length` → `401`.
  - `runs and returns the summary` → `200`, and the body equals the fake summary.
  - `reports a skipped run as 200`.
  - `reports a failed run as 502 without detail` → the body is `{ error: { code: 'catalogue_sync.failed', runId: 'r1' } }`.
- [ ] **Step 2: Run them.** `npx vitest run src/server/controllers/catalogue-sync-controller.test.ts` → FAIL.
- [ ] **Step 3: Implement** the controller, the route (`export async function POST(request: Request): Promise<Response>`) and `getCatalogueSyncRunner()`.
- [ ] **Step 4: Run them.** Same command → PASS. Then `npm test && npm run test:integration && npm run typecheck && npm run build` → all PASS.
- [ ] **Step 5: Commit** — `feat: add secret-protected Shopee catalogue sync job endpoint`

---

## Manual test checklist

Each check is run by a person against the **sandbox**, with the result recorded in *Outcome*. Never tick a box for a check nobody performed.

- [ ] Connect the shop: with `npm run dev` and the ngrok tunnel up, authorize through Console → Authorize. The callback page shows `connected: true` and no code. `channel_authorization` has one row, and its token columns are unreadable ciphertext.
- [ ] First sync: `curl -X POST -H "Authorization: Bearer $JOB_SECRET" http://localhost:3000/api/jobs/shopee-sync` returns `succeeded`. The database then holds every sandbox item (9 on 2026-10-20). Each is inactive, and the SSD has 4 variants.
- [ ] Second sync returns `succeeded` with `itemsCreated 0`. The variant ids are unchanged.
- [ ] Change a variant's price and stock in the sandbox Seller Center, sync, and see the new values in `variant`.
- [ ] Create a Console → Test Order for a seeded item. Sync, and see its stock drop. **Record whether that item's `update_time` changed:** this is spec §8 risk 1, and it decides whether the stock sweep can be removed later.
- [ ] Unlist an item in Seller Center, sync, and see `channel_item.external_status = 'UNLIST'`.
- [ ] Create a kit item in the sandbox (`v2.product.add_kit_item` from two seeded items) and sync. `channel_item.is_kit` is true, and its variants carry a price and stock like any other item. This is spec §8 risk 5; if they don't, record it and stop before relying on kits.
- [ ] Start two syncs at once (two `curl &`). One returns `skipped`.
- [ ] A wrong bearer secret gets `401`.
- [ ] Search the dev-server output and every `sync_run.error_detail` for the access token, the partner key and `sign=`: no matches.
- [ ] Record the `api_calls` of a full run against the sandbox in *Outcome*, as input to Q-056.
- [ ] `rm -rf node_modules && npm ci` works with the system npm 10.8.

## Follow-on plans (not this plan)

1. **Staff sign-in and admin catalogue screens:** email OTP (REQ-032), roles (REQ-034/035), the product list (REQ-036), bulk editing of site-only fields with activation (spec §5.7), categories and size-tier rates.
2. **Storefront from the database:** home, category, product and search pages per spec §7.
3. **Orders and the manual stock list:** with plan 003 (K-Payment). Covers spec §5.5 (the `order_line` stock-adjustment columns and snapshots, the admin list and its Excel export) and §5.6 (refusing out-of-stock carts and orders, and flagging paid lines).
4. **Retire `scripts/shopee-sandbox/`** once these tasks cover what it did.

## Outcome

*Not started.*
