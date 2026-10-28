import { z } from "zod";

/** A Shopee id: a JSON number that is a safe integer, parsed to bigint. */
const shopeeId = z
  .number()
  .refine((n) => Number.isSafeInteger(n), "id is not a safe integer")
  .transform((n) => BigInt(n));

const priceInfo = z.looseObject({
  currency: z.string().optional(),
  current_price: z.number(),
  original_price: z.number().optional(),
});

const stockInfoV2 = z.looseObject({
  summary_info: z.looseObject({
    total_reserved_stock: z.number().optional(),
    total_available_stock: z.number(),
  }),
  seller_stock: z
    .array(
      z.looseObject({
        location_id: z.string().optional(),
        stock: z.number(),
        if_saleable: z.boolean().optional(),
      }),
    )
    .optional(),
});

const weight = z.union([z.string(), z.number()]);

export const shopeeItemListPageSchema = z.looseObject({
  // A page with nothing in it may come without `item` (suspected cause of the 2026-10-28 sandbox failures).
  item: z.array(
    z.looseObject({
      item_id: shopeeId,
      item_status: z.string(),
      update_time: z.number(),
    }),
  ).default([]),
  total_count: z.number(),
  has_next_page: z.boolean(),
  next_offset: z.number().optional(),
});

export const shopeeItemBaseInfoSchema = z.looseObject({
  item_id: shopeeId,
  category_id: shopeeId,
  item_name: z.string(),
  item_sku: z.string().optional(),
  item_status: z.string(),
  has_model: z.boolean(),
  create_time: z.number().optional(),
  update_time: z.number(),
  description: z.string().optional(),
  weight: weight.optional(),
  condition: z.string().optional(),
  price_info: z.array(priceInfo).optional(),
  stock_info_v2: stockInfoV2.optional(),
  image: z
    .looseObject({ image_url_list: z.array(z.string()).optional() })
    .optional(),
});

export const shopeeItemBaseInfoResponseSchema = z.looseObject({
  item_list: z.array(shopeeItemBaseInfoSchema),
});

/** The envelope only: elements are parsed one by one, so one bad element never fails its batch. */
export const shopeeItemBaseInfoEnvelopeSchema = z.looseObject({
  item_list: z.array(z.unknown()),
});

export const shopeeModelSchema = z.looseObject({
  model_id: shopeeId,
  model_name: z.string().optional(),
  model_sku: z.string().optional(),
  model_status: z.string().optional(),
  tier_index: z.array(z.number()).optional(),
  weight: weight.optional(),
  price_info: z.array(priceInfo).optional(),
  stock_info_v2: stockInfoV2.optional(),
});

export const shopeeModelListSchema = z.looseObject({
  tier_variation: z.array(
    z.looseObject({
      name: z.string(),
      option_list: z.array(z.looseObject({ option: z.string() })),
    }),
  ),
  model: z.array(shopeeModelSchema),
});

export const shopeeItemExtraInfoSchema = z.looseObject({
  item_id: shopeeId,
  sale: z.number().optional(),
  views: z.number().optional(),
  likes: z.number().optional(),
  rating_star: z.number().optional(),
  comment_count: z.number().optional(),
});

export const shopeeItemExtraInfoResponseSchema = z.looseObject({
  item_list: z.array(shopeeItemExtraInfoSchema),
});

export const shopeeTokenResponseSchema = z.looseObject({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expire_in: z.number(),
});

export type ShopeeItemListPage = z.infer<typeof shopeeItemListPageSchema>;
export type ShopeeItemBaseInfo = z.infer<typeof shopeeItemBaseInfoSchema>;
export type ShopeeModelList = z.infer<typeof shopeeModelListSchema>;
export type ShopeeItemExtraInfo = z.infer<typeof shopeeItemExtraInfoSchema>;

/** One get_item_base_info call: the elements that parsed, and the ids of those that did not (null = no readable id). */
export interface ShopeeItemBaseInfoBatch {
  items: ShopeeItemBaseInfo[];
  invalid: (bigint | null)[];
}

export interface ShopeeTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

export interface ShopeeShopCredentials {
  accessToken: string;
  shopId: bigint;
}

/** The statuses this project requests; parsed `item_status` stays a plain string. */
export type ShopeeItemStatus = "NORMAL" | "UNLIST";
