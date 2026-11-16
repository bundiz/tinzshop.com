import { PRODUCT_CARD_TAG } from '@/server/adapters/wordpress/sanitize';

export { PRODUCT_CARD_TAG };

export type ArticleSegment = { kind: 'html'; html: string } | { kind: 'product'; productId: string };

/**
 * The stored form of a card, as the sanitiser writes it (D-245): an empty `tinz-product` whose only attribute is
 * a uuid `data-id`. The body is sanitised before it is stored, so this is the only shape that can occur.
 */
const CARD = /<tinz-product data-id="([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"><\/tinz-product>/gi;

/**
 * A stored body cut at its product cards, in order: the HTML between them and a `product` segment for each. Empty
 * HTML segments are left out. Pure; the page renders each `product` segment from the live product, and the HTML
 * segments as the body (D-245).
 */
export function splitAtProductCards(html: string): ArticleSegment[] {
  const segments: ArticleSegment[] = [];
  let last = 0;
  for (const match of html.matchAll(CARD)) {
    if (match.index > last) segments.push({ kind: 'html', html: html.slice(last, match.index) });
    segments.push({ kind: 'product', productId: (match[1] as string).toLowerCase() });
    last = match.index + match[0].length;
  }
  if (last < html.length) segments.push({ kind: 'html', html: html.slice(last) });
  return segments;
}

/** The product ids of the body's cards, each once, in the order they first appear. */
export function productIdsIn(html: string): string[] {
  const ids = splitAtProductCards(html).flatMap((segment) => (segment.kind === 'product' ? [segment.productId] : []));
  return [...new Set(ids)];
}
