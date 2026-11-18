import { parseEmbedWidth, PRODUCT_CARD_TAG } from '@/server/adapters/wordpress/sanitize';

export { PRODUCT_CARD_TAG };

/** A card segment's `width` is its stored embed width (40 to 99, D-273); absent means full width. */
export type ArticleSegment = { kind: 'html'; html: string } | { kind: 'product'; productId: string; width?: number };

/**
 * The stored form of a card, as the sanitiser writes it (D-245, D-273): an empty `tinz-product` with a uuid `data-id`
 * and, optionally, a `data-width` after it. The body is sanitised before it is stored, so this is the only shape that
 * can occur; the width is still re-read through `parseEmbedWidth`.
 */
const CARD = /<tinz-product data-id="([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"(?: data-width="([^"]*)")?><\/tinz-product>/gi;

const TAG = /<(\/?)([a-z][a-z0-9-]*)(\s[^>]*)?>/gi;
const VOID = new Set(['br', 'img']);

/** The element depth of any position in the HTML, counting every tag but the card itself. */
function depths(html: string): (index: number) => number {
  const at: { index: number; depth: number }[] = [];
  let depth = 0;
  for (const match of html.matchAll(TAG)) {
    const name = (match[2] ?? '').toLowerCase();
    if (name === PRODUCT_CARD_TAG) continue;
    if (match[1] === '/') depth = Math.max(0, depth - 1);
    else if (!VOID.has(name) && !match[0].endsWith('/>')) depth += 1;
    at.push({ index: match.index, depth });
  }
  return (index) => {
    let result = 0;
    for (const entry of at) {
      if (entry.index >= index) break;
      result = entry.depth;
    }
    return result;
  };
}

/**
 * A stored body cut at its product cards, in order: the HTML between them and a `product` segment for each. Empty
 * HTML segments are left out. Only a card at the top level of the body is a cut point (R16): the sanitiser drops any
 * other, and a cut inside a list, quote or cell would unbalance the HTML either side, so one that reaches here is left
 * in the HTML segment (where the browser ignores the unknown, empty element). Pure; the page renders each `product` segment from the live product, and the HTML
 * segments as the body (D-245).
 */
export function splitAtProductCards(html: string): ArticleSegment[] {
  const segments: ArticleSegment[] = [];
  let last = 0;
  const depthAt = depths(html);
  for (const match of html.matchAll(CARD)) {
    if (depthAt(match.index) !== 0) continue;
    if (match.index > last) segments.push({ kind: 'html', html: html.slice(last, match.index) });
    const productId = (match[1] as string).toLowerCase();
    const width = parseEmbedWidth(match[2]);
    segments.push(width === null ? { kind: 'product', productId } : { kind: 'product', productId, width });
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
