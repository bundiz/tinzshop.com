import { createShopeeAuthorizationCallbackHandler } from '@/server/controllers/channel/shopee-authorization-controller';
import { getServerConfig } from '@/server/config';
import { getChannelAuthorizationService } from '@/server/composition-root';

// Shopee redirects the seller's browser here after shop authorization.
export async function GET(request: Request): Promise<Response> {
  const handler = createShopeeAuthorizationCallbackHandler({
    connectShop: (input) => getChannelAuthorizationService().connectShop(input),
    expectedShopId: getServerConfig().shopee.shopId,
  });
  return handler(request);
}
