import { handleShopeeAuthorizationCallback } from '@/server/controllers/shopee-authorization-controller';

// Shopee redirects the seller's browser here after shop authorization.
export function GET(request: Request): Response {
  return handleShopeeAuthorizationCallback(request);
}
