import { cache } from 'react';
import type { routing } from '@/i18n/routing';
import { getProductDetailReader } from '@/server/composition-root';

/** The product read, memoised per request so the layout's metadata and the page share one query. */
export const readProduct = cache((productId: string, locale: (typeof routing.locales)[number]) =>
  getProductDetailReader()(productId, locale),
);
