import { ShopeeApiError } from '@/server/adapters/shopee/errors';
import {
  acceptShopeeAuthorization,
  shopeeAuthorizationCallbackSchema,
} from '@/server/services/shopee-authorization-service';

// The callback carries a one-time credential; nothing may cache any response.
const NO_STORE = { 'Cache-Control': 'no-store' };

export function createShopeeAuthorizationCallbackHandler(deps: {
  connectShop: (input: { code: string; externalShopId: bigint }) => Promise<void>;
}): (request: Request) => Promise<Response> {
  return async (request) => {
    const query = Object.fromEntries(new URL(request.url).searchParams);
    const parsed = shopeeAuthorizationCallbackSchema.safeParse(query);

    if (!parsed.success) {
      return Response.json(
        {
          error: {
            code: 'shopee.authorization.invalid_callback',
            messageKey: 'error.shopee.authorization.invalidCallback',
            details: parsed.error.issues.map((issue) => ({
              path: issue.path.map(String).join('.'),
              message: issue.message,
            })),
          },
        },
        { status: 400, headers: NO_STORE },
      );
    }

    const grant = acceptShopeeAuthorization(parsed.data);

    if (grant.accountType === 'main_account') {
      return Response.json(
        {
          error: {
            code: 'shopee.authorization.main_account_unsupported',
            messageKey: 'error.shopee.authorization.mainAccountUnsupported',
          },
        },
        { status: 422, headers: NO_STORE },
      );
    }

    try {
      await deps.connectShop({ code: grant.code, externalShopId: BigInt(grant.shopId) });
    } catch (error) {
      if (error instanceof ShopeeApiError) {
        return Response.json(
          {
            error: {
              code: 'shopee.authorization.token_exchange_failed',
              messageKey: 'error.shopee.authorization.tokenExchangeFailed',
            },
          },
          { status: 502, headers: NO_STORE },
        );
      }
      throw error;
    }

    return Response.json(
      { data: { accountType: 'shop', shopId: grant.shopId, connected: true } },
      { headers: NO_STORE },
    );
  };
}
