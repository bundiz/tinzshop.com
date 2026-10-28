import { createHmac } from "node:crypto";

interface PublicSignInput {
  partnerKey: string;
  partnerId: number;
  path: string;
  timestamp: number;
}

interface ShopSignInput extends PublicSignInput {
  accessToken: string;
  shopId: bigint;
}

function hmac(partnerKey: string, base: string): string {
  return createHmac("sha256", partnerKey).update(base).digest("hex");
}

/** Public (auth) calls: sign base string is partner_id + path + timestamp. */
export function signPublicRequest(input: PublicSignInput): string {
  return hmac(input.partnerKey, `${input.partnerId}${input.path}${input.timestamp}`);
}

/** Shop calls: partner_id + path + timestamp + access_token + shop_id. */
export function signShopRequest(input: ShopSignInput): string {
  return hmac(
    input.partnerKey,
    `${input.partnerId}${input.path}${input.timestamp}${input.accessToken}${input.shopId}`,
  );
}
