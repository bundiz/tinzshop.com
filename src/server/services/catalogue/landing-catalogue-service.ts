export type Locale = 'th' | 'en';

export type StorefrontVariant = {
  priceSatang: bigint;
  originalPriceSatang: bigint;
  stockQuantity: number;
  isActive: boolean;
};

/** One mirrored product as the storefront read returns it; plain data, no Prisma types. */
export type StorefrontCandidate = {
  productId: string;
  isActive: boolean;
  externalStatus: string;
  names: { th?: string; en?: string };
  imageUrl: string | null;
  isKit: boolean;
  salesCount: number | null;
  isPreOrder: boolean;
  releaseDate: Date | null;
  variants: StorefrontVariant[];
};

export type LandingProductCard = {
  productId: string;
  name: string;
  imageUrl: string | null;
  priceSatang: bigint;
  originalPriceSatang: bigint | null;
  isPriceRange: boolean;
  stockStatus: 'in_stock' | 'out_of_stock';
  isKit: boolean;
  isPreOrder: boolean;
  releaseDate: Date | null;
};

export type LandingCatalogue = {
  bestSellers: LandingProductCard[];
  bundles: LandingProductCard[];
  preOrders: LandingProductCard[];
};

const BEST_SELLER_LIMIT = 8;
const BUNDLE_LIMIT = 6;
const PRE_ORDER_LIMIT = 4;

/** Spec §5.3: active product, Shopee status NORMAL, and at least one active variant. */
export function isStorefrontVisible(
  candidate: Pick<StorefrontCandidate, 'isActive' | 'externalStatus'> & { variants: { isActive: boolean }[] },
): boolean {
  return (
    candidate.isActive &&
    candidate.externalStatus === 'NORMAL' &&
    candidate.variants.some((variant) => variant.isActive)
  );
}

/**
 * The `en` name on `/en`, else the `th` one (Q-018 residual); the single place this is decided.
 * The product page passes its descriptions through it too, so a description falls back the same way.
 */
export function pickProductName(candidate: Pick<StorefrontCandidate, 'names'>, locale: Locale): string {
  const { th, en } = candidate.names;
  if (locale === 'en' && en !== undefined && en !== '') return en;
  return th ?? en ?? '';
}

export function toLandingProductCard(candidate: StorefrontCandidate, locale: Locale): LandingProductCard {
  const active = candidate.variants.filter((variant) => variant.isActive);
  const cheapest = active.reduce<StorefrontVariant | undefined>(
    (best, variant) => (best === undefined || variant.priceSatang < best.priceSatang ? variant : best),
    undefined,
  );
  const priceSatang = cheapest?.priceSatang ?? 0n;
  const original = cheapest?.originalPriceSatang ?? null;
  return {
    productId: candidate.productId,
    name: pickProductName(candidate, locale),
    imageUrl: candidate.imageUrl,
    priceSatang,
    originalPriceSatang: original !== null && original > priceSatang ? original : null,
    isPriceRange: active.some((variant) => variant.priceSatang !== priceSatang),
    stockStatus: active.some((variant) => variant.stockQuantity > 0) ? 'in_stock' : 'out_of_stock',
    isKit: candidate.isKit,
    isPreOrder: candidate.isPreOrder,
    releaseDate: candidate.releaseDate,
  };
}

type Entry = { candidate: StorefrontCandidate; card: LandingProductCard };

function bySalesThenName(a: Entry, b: Entry): number {
  const salesA = a.candidate.salesCount;
  const salesB = b.candidate.salesCount;
  if (salesA !== salesB) {
    if (salesA === null) return 1;
    if (salesB === null) return -1;
    return salesB - salesA;
  }
  return a.card.name.localeCompare(b.card.name);
}

function byReleaseDate(a: Entry, b: Entry): number {
  const dateA = a.candidate.releaseDate;
  const dateB = b.candidate.releaseDate;
  if (dateA === null && dateB === null) return bySalesThenName(a, b);
  if (dateA === null) return 1;
  if (dateB === null) return -1;
  return dateA.getTime() - dateB.getTime() || bySalesThenName(a, b);
}

export function buildLandingCatalogue(candidates: StorefrontCandidate[], locale: Locale): LandingCatalogue {
  const visible: Entry[] = candidates
    .filter(isStorefrontVisible)
    .map((candidate) => ({ candidate, card: toLandingProductCard(candidate, locale) }));
  const cards = (entries: Entry[], limit: number): LandingProductCard[] =>
    entries.slice(0, limit).map((entry) => entry.card);
  const bySales = [...visible].sort(bySalesThenName);
  return {
    bestSellers: cards(bySales, BEST_SELLER_LIMIT),
    bundles: cards(
      bySales.filter((entry) => entry.candidate.isKit),
      BUNDLE_LIMIT,
    ),
    preOrders: cards(
      visible.filter((entry) => entry.candidate.isPreOrder).sort(byReleaseDate),
      PRE_ORDER_LIMIT,
    ),
  };
}

/**
 * The repository sorts and limits each section in SQL (plan 013), keeping ties at each cutoff, and passes
 * only those rows; the sections are built here with the same rules, so the output is what the full
 * visible list would give.
 */
export async function getLandingCatalogue(
  deps: { listStorefrontCandidates: () => Promise<StorefrontCandidate[]> },
  locale: Locale,
): Promise<LandingCatalogue> {
  return buildLandingCatalogue(await deps.listStorefrontCandidates(), locale);
}
