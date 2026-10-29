-- CreateEnum
CREATE TYPE "news_article_status" AS ENUM ('draft', 'published');

-- CreateTable
CREATE TABLE "news_category" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "parent_id" UUID,
    "position" INTEGER NOT NULL,
    "source_id" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_category_translation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "locale" "locale" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "news_category_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_article" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "featured_image_url" TEXT,
    "source_id" BIGINT,
    "source_url" TEXT,
    "source_modified_at" TIMESTAMPTZ(6),
    "status" "news_article_status" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMPTZ(6),
    "byline_name" TEXT,
    "author_staff_id" UUID,
    "created_by_staff_id" UUID,
    "updated_by_staff_id" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_article_translation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "article_id" UUID NOT NULL,
    "locale" "locale" NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL DEFAULT '',
    "body_html" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "news_article_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_article_category" (
    "article_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "news_article_category_pkey" PRIMARY KEY ("article_id","category_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "news_category_slug_key" ON "news_category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "news_category_source_id_key" ON "news_category"("source_id");

-- CreateIndex
CREATE INDEX "news_category_parent_id_idx" ON "news_category"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "news_category_translation_category_id_locale_key" ON "news_category_translation"("category_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "news_article_slug_key" ON "news_article"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "news_article_source_id_key" ON "news_article"("source_id");

-- CreateIndex
CREATE INDEX "news_article_status_published_at_idx" ON "news_article"("status", "published_at" DESC) WHERE "deleted_at" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "news_article_translation_article_id_locale_key" ON "news_article_translation"("article_id", "locale");

-- CreateIndex
CREATE INDEX "news_article_category_category_id_idx" ON "news_article_category"("category_id");

-- AddForeignKey
ALTER TABLE "news_category" ADD CONSTRAINT "news_category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "news_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_category_translation" ADD CONSTRAINT "news_category_translation_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "news_category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_article_translation" ADD CONSTRAINT "news_article_translation_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "news_article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_article_category" ADD CONSTRAINT "news_article_category_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "news_article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "news_article_category" ADD CONSTRAINT "news_article_category_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "news_category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A published article must have a publication time (a future time means scheduled).
ALTER TABLE "news_article"
  ADD CONSTRAINT "news_article_published_requires_published_at"
  CHECK ("status" <> 'published' OR "published_at" IS NOT NULL);
