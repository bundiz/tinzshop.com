-- Plan 016: roles, permissions, an account's role and block flag, and the news tag and product links.
-- Order matters: role tables and seeds first, then customer.role_id (nullable, backfilled, then not null with a default).

-- CreateTable
CREATE TABLE "role" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,

    CONSTRAINT "permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permission" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_key_key" ON "role"("key");

-- CreateIndex
CREATE UNIQUE INDEX "permission_key_key" ON "permission"("key");

-- CreateIndex
CREATE INDEX "role_permission_permission_id_idx" ON "role_permission"("permission_id");

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: the six system roles (D-062), with fixed ids so the customer default below can name one.
INSERT INTO "role" ("id", "key") VALUES
  ('fb0272b4-0546-4333-9784-822496b14e96', 'guest'),
  ('886e46c9-1e85-49be-af5d-187abe1d920f', 'customer'),
  ('97c461c4-4c1a-4363-9fe2-3a41d4b97ce4', 'blogger'),
  ('f936d656-75ad-461c-8b35-08338f8de09b', 'sale_manager'),
  ('1fb5df27-ce80-4fa2-83ad-e9f8a021b7fb', 'admin'),
  ('666bd6b3-4d62-4d7d-90ec-a335f3b7b821', 'super_admin');

-- Seed: the four stage 1 permissions (D-241).
INSERT INTO "permission" ("key") VALUES
  ('backoffice.enter'),
  ('news.manage'),
  ('account.manage'),
  ('role.manage');

-- Seed: the default grants. Customer and Guest hold no back-office key.
INSERT INTO "role_permission" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM (VALUES
  ('backoffice.enter', 'blogger'),
  ('backoffice.enter', 'sale_manager'),
  ('backoffice.enter', 'admin'),
  ('backoffice.enter', 'super_admin'),
  ('news.manage', 'blogger'),
  ('news.manage', 'admin'),
  ('news.manage', 'super_admin'),
  ('account.manage', 'super_admin'),
  ('role.manage', 'super_admin')
) AS g ("permission_key", "role_key")
JOIN "permission" p ON p."key" = g."permission_key"
JOIN "role" r ON r."key" = g."role_key";

-- AlterTable: every account gets a role. Existing rows become Customer; new rows default to it.
ALTER TABLE "customer" ADD COLUMN "role_id" UUID, ADD COLUMN "blocked_at" TIMESTAMPTZ(6);
UPDATE "customer" SET "role_id" = '886e46c9-1e85-49be-af5d-187abe1d920f';
ALTER TABLE "customer" ALTER COLUMN "role_id" SET NOT NULL;
ALTER TABLE "customer" ALTER COLUMN "role_id" SET DEFAULT '886e46c9-1e85-49be-af5d-187abe1d920f';

-- CreateIndex
CREATE INDEX "customer_role_id_idx" ON "customer"("role_id");

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The news staff ids were plain uuids; an id that matches no customer is cleared before the keys go on.
UPDATE "news_article" SET "author_staff_id" = NULL WHERE "author_staff_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "customer" c WHERE c."id" = "news_article"."author_staff_id");
UPDATE "news_article" SET "created_by_staff_id" = NULL WHERE "created_by_staff_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "customer" c WHERE c."id" = "news_article"."created_by_staff_id");
UPDATE "news_article" SET "updated_by_staff_id" = NULL WHERE "updated_by_staff_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "customer" c WHERE c."id" = "news_article"."updated_by_staff_id");

-- AddForeignKey
ALTER TABLE "news_article" ADD CONSTRAINT "news_article_author_staff_id_fkey" FOREIGN KEY ("author_staff_id") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_article" ADD CONSTRAINT "news_article_created_by_staff_id_fkey" FOREIGN KEY ("created_by_staff_id") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_article" ADD CONSTRAINT "news_article_updated_by_staff_id_fkey" FOREIGN KEY ("updated_by_staff_id") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "news_tag" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "name_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_article_tag" (
    "article_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,

    CONSTRAINT "news_article_tag_pkey" PRIMARY KEY ("article_id","tag_id")
);

-- CreateTable
CREATE TABLE "news_article_product" (
    "article_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,

    CONSTRAINT "news_article_product_pkey" PRIMARY KEY ("article_id","product_id")
);

-- The tag name key is the lower-cased, trimmed name; the unique index below makes tag names unique ignoring case and padding.
ALTER TABLE "news_tag" ADD CONSTRAINT "news_tag_name_key_check" CHECK ("name_key" = lower(btrim("name")));

-- CreateIndex
CREATE UNIQUE INDEX "news_tag_name_key_key" ON "news_tag"("name_key");

-- CreateIndex
CREATE INDEX "news_article_tag_tag_id_idx" ON "news_article_tag"("tag_id");

-- CreateIndex
CREATE INDEX "news_article_product_product_id_idx" ON "news_article_product"("product_id");

-- AddForeignKey
ALTER TABLE "news_article_tag" ADD CONSTRAINT "news_article_tag_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "news_article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_article_tag" ADD CONSTRAINT "news_article_tag_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "news_tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_article_product" ADD CONSTRAINT "news_article_product_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "news_article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_article_product" ADD CONSTRAINT "news_article_product_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
