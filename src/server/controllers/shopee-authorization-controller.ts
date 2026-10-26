import {
  acceptShopeeAuthorization,
  shopeeAuthorizationCallbackSchema,
} from '@/server/services/shopee-authorization-service';

// The code in this response is a one-time credential valid for 10 minutes; nothing may cache it.
const NO_STORE = { 'Cache-Control': 'no-store' };

export function handleShopeeAuthorizationCallback(request: Request): Response {
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

  return Response.json({ data: acceptShopeeAuthorization(parsed.data) }, { headers: NO_STORE });
}
