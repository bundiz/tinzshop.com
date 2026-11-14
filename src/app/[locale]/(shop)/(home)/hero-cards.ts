import type { LandingCatalogue, LandingProductCard } from '@/server/services/catalogue/landing-catalogue-service';

const MINI_COUNT = 3;

/**
 * Which products the landing hero shows (R9, D-215): the feature card is the first kit (the best-selling one,
 * since the read sorts kits by sales), or none when there is no kit; the minis are the first three best
 * sellers that are not the feature product.
 */
export function pickHeroCards(catalogue: Pick<LandingCatalogue, 'bundles' | 'bestSellers'>): {
  feature: LandingProductCard | null;
  minis: LandingProductCard[];
} {
  const feature = catalogue.bundles[0] ?? null;
  const minis = catalogue.bestSellers
    .filter((card) => card.productId !== feature?.productId)
    .slice(0, MINI_COUNT);
  return { feature, minis };
}
