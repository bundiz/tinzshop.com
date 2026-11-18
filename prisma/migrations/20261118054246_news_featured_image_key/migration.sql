-- Plan 017 (D-277): an uploaded cover is stored as its media key, never as a URL. No backfill: no article has one yet.

-- AlterTable
ALTER TABLE "news_article" ADD COLUMN     "featured_image_key" TEXT;

-- The media key pattern, the same as NEWS_MEDIA_KEY_PATTERN in src/server/adapters/wordpress/sanitize.ts.
ALTER TABLE "news_article" ADD CONSTRAINT "news_article_featured_image_key_check"
  CHECK ("featured_image_key" ~ '^news/[0-9]{4}/(0[1-9]|1[0-2])/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp|gif)$');

-- An article's cover is either an uploaded one (the key) or an imported one (the old site's URL, D-127), never both.
ALTER TABLE "news_article" ADD CONSTRAINT "news_article_one_featured_image_check"
  CHECK ("featured_image_key" IS NULL OR "featured_image_url" IS NULL);
