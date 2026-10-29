import { notFound } from 'next/navigation';

/**
 * Catches every URL under a locale that no other page matches, so it gets the site's
 * not-found screen in the locale instead of Next's built-in English one (D-122).
 * Every other route is more specific and wins; `/api/**` never reaches it.
 */
export default function CatchAllPage(): never {
  notFound();
}
