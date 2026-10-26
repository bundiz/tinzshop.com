import { createShopeeAuthorizationCallbackHandler } from '@/server/controllers/shopee-authorization-controller';
import { getChannelAuthorizationService } from '@/server/composition-root';

// Shopee redirects the seller's browser here after shop authorization.
export async function GET(request: Request): Promise<Response> {
  const handler = createShopeeAuthorizationCallbackHandler({
    connectShop: (input) => getChannelAuthorizationService().connectShop(input),
  });
  return handler(request);
}
