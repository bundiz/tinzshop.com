-- CreateEnum
CREATE TYPE "shipping_size_tier" AS ENUM ('small', 'medium', 'large');

-- CreateEnum
CREATE TYPE "locale" AS ENUM ('th', 'en');

-- CreateTable
CREATE TABLE "category" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "parent_id" UUID,
    "slug" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_translation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "locale" "locale" NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "category_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "parent_sku" TEXT,
    "brand_name" TEXT,
    "weight_grams" INTEGER,
    "primary_category_id" UUID,
    "shipping_size_tier" "shipping_size_tier",
    "is_pre_order" BOOLEAN NOT NULL DEFAULT false,
    "release_date" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_translation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "locale" "locale" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "product_translation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_image" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "external_image_id" TEXT NOT NULL,

    CONSTRAINT "product_image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_category" (
    "product_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "product_category_pkey" PRIMARY KEY ("product_id","category_id")
);

-- CreateTable
CREATE TABLE "option_type" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "option_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "option_value" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "option_type_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "option_value_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "model_sku" TEXT,
    "price_satang" BIGINT NOT NULL,
    "original_price_satang" BIGINT NOT NULL,
    "stock_quantity" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_option_value" (
    "variant_id" UUID NOT NULL,
    "option_value_id" UUID NOT NULL,

    CONSTRAINT "variant_option_value_pkey" PRIMARY KEY ("variant_id","option_value_id")
);

-- CreateTable
CREATE TABLE "shipping_size_tier_rate" (
    "tier" "shipping_size_tier" NOT NULL,
    "price_satang" BIGINT NOT NULL,

    CONSTRAINT "shipping_size_tier_rate_pkey" PRIMARY KEY ("tier")
);

-- CreateTable
CREATE TABLE "channel_item" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "external_item_id" BIGINT NOT NULL,
    "external_status" TEXT NOT NULL,
    "external_category_id" BIGINT NOT NULL,
    "is_kit" BOOLEAN NOT NULL,
    "external_created_at" TIMESTAMPTZ(6) NOT NULL,
    "external_updated_at" TIMESTAMPTZ(6) NOT NULL,
    "sales_count" INTEGER NOT NULL,
    "rating_star" DECIMAL(2,1) NOT NULL,
    "rating_count" INTEGER NOT NULL,
    "last_synced_at" TIMESTAMPTZ(6) NOT NULL,
    "raw_payload" JSONB NOT NULL,

    CONSTRAINT "channel_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_listing" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "variant_id" UUID NOT NULL,
    "channel_item_id" UUID NOT NULL,
    "external_model_id" BIGINT,
    "external_status" TEXT,
    "last_synced_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "channel_listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_authorization" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "channel" TEXT NOT NULL,
    "external_shop_id" BIGINT NOT NULL,
    "access_token_ciphertext" TEXT NOT NULL,
    "refresh_token_ciphertext" TEXT NOT NULL,
    "access_token_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "refresh_token_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "authorization_expires_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_authorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_run" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "channel" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "finished_at" TIMESTAMPTZ(6),
    "outcome" TEXT NOT NULL,
    "window_from" TIMESTAMPTZ(6),
    "window_to" TIMESTAMPTZ(6),
    "items_seen" INTEGER NOT NULL DEFAULT 0,
    "items_created" INTEGER NOT NULL DEFAULT 0,
    "items_updated" INTEGER NOT NULL DEFAULT 0,
    "items_deactivated" INTEGER NOT NULL DEFAULT 0,
    "api_calls" INTEGER NOT NULL DEFAULT 0,
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "error_code" TEXT,
    "error_detail" TEXT,

    CONSTRAINT "sync_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_slug_key" ON "category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "category_translation_category_id_locale_key" ON "category_translation"("category_id", "locale");

-- CreateIndex
CREATE INDEX "product_parent_sku_idx" ON "product"("parent_sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_translation_product_id_locale_key" ON "product_translation"("product_id", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "product_image_product_id_position_key" ON "product_image"("product_id", "position");

-- CreateIndex
CREATE INDEX "variant_model_sku_idx" ON "variant"("model_sku");

-- CreateIndex
CREATE UNIQUE INDEX "channel_item_product_id_key" ON "channel_item"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_item_channel_external_item_id_key" ON "channel_item"("channel", "external_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_listing_variant_id_key" ON "channel_listing"("variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "channel_authorization_channel_external_shop_id_key" ON "channel_authorization"("channel", "external_shop_id");

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_translation" ADD CONSTRAINT "category_translation_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "product_primary_category_id_fkey" FOREIGN KEY ("primary_category_id") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_translation" ADD CONSTRAINT "product_translation_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_category" ADD CONSTRAINT "product_category_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_category" ADD CONSTRAINT "product_category_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_type" ADD CONSTRAINT "option_type_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "option_value" ADD CONSTRAINT "option_value_option_type_id_fkey" FOREIGN KEY ("option_type_id") REFERENCES "option_type"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant" ADD CONSTRAINT "variant_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_option_value" ADD CONSTRAINT "variant_option_value_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_option_value" ADD CONSTRAINT "variant_option_value_option_value_id_fkey" FOREIGN KEY ("option_value_id") REFERENCES "option_value"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_item" ADD CONSTRAINT "channel_item_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_listing" ADD CONSTRAINT "channel_listing_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_listing" ADD CONSTRAINT "channel_listing_channel_item_id_fkey" FOREIGN KEY ("channel_item_id") REFERENCES "channel_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written constraints Prisma cannot express (spec 5.2, 5.3, 5.4)
ALTER TABLE variant ADD CONSTRAINT variant_stock_quantity_non_negative CHECK (stock_quantity >= 0);
ALTER TABLE channel_item ADD CONSTRAINT channel_item_channel_known CHECK (channel = 'shopee');
ALTER TABLE channel_authorization ADD CONSTRAINT channel_authorization_channel_known CHECK (channel = 'shopee');
CREATE UNIQUE INDEX channel_listing_item_model_key ON channel_listing (channel_item_id, external_model_id) NULLS NOT DISTINCT;
INSERT INTO shipping_size_tier_rate (tier, price_satang) VALUES ('small', 5000), ('medium', 10000), ('large', 0);
