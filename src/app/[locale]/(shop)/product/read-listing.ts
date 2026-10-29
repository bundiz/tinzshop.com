import { cache } from 'react';
import type { routing } from '@/i18n/routing';
import { getStorefrontListingReader } from '@/server/composition-root';
import type {
  StorefrontListing,
  StorefrontListingSearchParams,
} from '@/server/services/catalogue/storefront-listing-service';

/** A stable key for a request's search params, so the page and its metadata share one read. */
export function searchParamsKey(searchParams: StorefrontListingSearchParams): string {
  return JSON.stringify(
    Object.keys(searchParams)
      .sort()
      .map((key) => [key, searchParams[key]]),
  );
}

const readByKey = cache(
  (locale: (typeof routing.locales)[number], key: string): Promise<StorefrontListing | null> =>
    getStorefrontListingReader()(
      Object.fromEntries(JSON.parse(key) as [string, string | string[] | undefined][]),
      locale,
    ),
);

/** The listing read for the URL's search params, memoised per request; `null` is a 404 (R2). */
export function readProductListing(
  locale: (typeof routing.locales)[number],
  searchParams: StorefrontListingSearchParams,
): Promise<StorefrontListing | null> {
  return readByKey(locale, searchParamsKey(searchParams));
}
