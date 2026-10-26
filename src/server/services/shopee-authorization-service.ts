import { z } from 'zod';

// Shopee puts ids in the redirect URL as decimal strings. Reject anything Number() would
// silently reinterpret ("0x1F", "1e3") or round (above 2^53), rather than store a wrong id.
const shopeeId = z
  .string()
  .regex(/^[1-9]\d*$/, { message: 'Must be a positive decimal integer' })
  .transform(Number)
  .refine(Number.isSafeInteger, { message: 'Exceeds the safe integer range' });

// The redirect after authorization carries code plus either shop_id (shop account) or
// main_account_id (main account), never both. Source: open.shopee.com/developer-guide/20.
export const shopeeAuthorizationCallbackSchema = z
  .object({
    code: z.string().min(1),
    shop_id: shopeeId.optional(),
    main_account_id: shopeeId.optional(),
    state: z.string().optional(),
  })
  .refine((query) => (query.shop_id === undefined) !== (query.main_account_id === undefined), {
    message: 'Exactly one of shop_id or main_account_id is required',
    path: ['shop_id'],
  });

export type ShopeeAuthorizationCallback = z.infer<typeof shopeeAuthorizationCallbackSchema>;

export type ShopeeAuthorizationGrant =
  | {
      readonly accountType: 'shop';
      readonly shopId: number;
      readonly code: string;
      readonly state: string | null;
    }
  | {
      readonly accountType: 'main_account';
      readonly mainAccountId: number;
      readonly code: string;
      readonly state: string | null;
    };

export function acceptShopeeAuthorization(
  callback: ShopeeAuthorizationCallback,
): ShopeeAuthorizationGrant {
  const state = callback.state ?? null;

  if (callback.shop_id !== undefined) {
    return { accountType: 'shop', shopId: callback.shop_id, code: callback.code, state };
  }
  if (callback.main_account_id !== undefined) {
    return {
      accountType: 'main_account',
      mainAccountId: callback.main_account_id,
      code: callback.code,
      state,
    };
  }
  throw new Error('Unreachable: the callback schema guarantees exactly one Shopee id');
}
