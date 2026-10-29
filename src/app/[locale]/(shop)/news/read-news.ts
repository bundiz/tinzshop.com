import { cache } from 'react';
import type { routing } from '@/i18n/routing';
import { getNewsReader } from '@/server/composition-root';

/** The news list read, memoised per request so a layout's metadata and its page share one read. */
export const readNewsList = cache(
  (locale: (typeof routing.locales)[number], categorySlug: string | undefined, page: number) =>
    getNewsReader()({ locale, categorySlug, page }),
);
