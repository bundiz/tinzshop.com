import { useTranslations } from 'next-intl';
import type { CSSProperties } from 'react';
import { parseEmbedWidth } from '@/server/adapters/wordpress/sanitize';
import type { LandingProductCard } from '@/server/services/catalogue/landing-catalogue-service';
import { splitAtProductCards } from '@/server/services/news/product-card-embed';
import ArticleProductCard from './ArticleProductCard';

/**
 * Adds `loading="lazy"` to every `<img>` and `<iframe>` start tag of the stored body, at render time; the
 * stored value is never changed. The body is sanitised HTML, in which a literal `<` in text or an attribute
 * is always escaped (`&lt;`), so `<img` and `<iframe` only ever start a real tag.
 */
export function lazyEmbeds(html: string): string {
  return html.replace(/<(img|iframe)(?=[\s/>])/gi, '<$1 loading="lazy"');
}

const TAG = /<(\/?)([a-z][a-z0-9-]*)(\s[^>]*)?>/gi;
const VOID_TAGS = new Set(['br', 'img']);

/**
 * Gives every top-level `<iframe>` with a valid stored `data-width` (D-273), and every `<img>` with one that stands alone
 * in a top-level `<p>` (an uploaded image as the editor inserts it, D-283; the sanitiser keeps the width on no other
 * image), the style `--embed-w:NN%`, at render time, for the reading styles' rules (`PROSE`) that draw it centred at
 * that width from `sm`. The width is re-read through `parseEmbedWidth`, so only a whole number from 40 to 99 ever
 * reaches the style; a video or image anywhere else is left as stored. Safe on the same grounds as `lazyEmbeds`: in
 * sanitised HTML a tag never contains `>` or `<`, and the sanitiser keeps no `style`, so none is doubled.
 */
export function sizeEmbeds(html: string): string {
  let depth = 0;
  return html.replace(TAG, (tag: string, slash: string, rawName: string, attributes: string | undefined, offset: number) => {
    const name = rawName.toLowerCase();
    if (slash === '/') {
      depth = Math.max(0, depth - 1);
      return tag;
    }
    // The depth this tag opens at: an image right after `<p>` at depth 1 is in a top-level paragraph.
    const at = depth;
    if (!VOID_TAGS.has(name) && !tag.endsWith('/>')) depth += 1;
    const sizable =
      (name === 'iframe' && at === 0) ||
      (name === 'img' && at === 1 && html.slice(offset - 3, offset) === '<p>' && html.startsWith('</p>', offset + tag.length));
    if (!sizable) return tag;
    const width = parseEmbedWidth(/\sdata-width="([^"]*)"/.exec(attributes ?? '')?.[1]);
    return width === null ? tag : `<${rawName} style="--embed-w:${width}%"${tag.slice(rawName.length + 1)}`;
  });
}

/** A card or a top-level video with a stored width (D-273): full width below `sm`, centred at `--embed-w` from `sm`. */
const EMBED_WIDTH = 'sm:mx-auto sm:w-(--embed-w)';

const ATTRIBUTE_ESCAPES: Record<string, string> = { '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' };

/**
 * Gives every `<iframe>` of the stored body a `title` (the accessible name of the embedded video), at render
 * time, on the same grounds as `lazyEmbeds`: the sanitiser keeps no `title` on an iframe (D-135), so none is
 * duplicated, and in sanitised HTML `<iframe` only ever starts a real tag. The title is escaped for an attribute.
 */
export function titleIframes(html: string, title: string): string {
  const escaped = title.replace(/[&"<>]/g, (character) => ATTRIBUTE_ESCAPES[character] ?? character);
  return html.replace(/<iframe(?=[\s/>])/gi, (tag) => `${tag} title="${escaped}"`);
}

// Reading styles for the body's allow-listed elements (D-135); Tailwind's preflight resets them all.
const PROSE = [
  'text-base leading-[1.8] [overflow-wrap:anywhere]',
  '[&_p]:my-4 [&_br]:leading-[1.8]',
  '[&_h1]:mt-8 [&_h1]:mb-3 [&_h1]:text-2xl [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl',
  '[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-lg [&_h4]:mt-6 [&_h4]:mb-2 [&_h4]:text-base',
  '[&_h5]:mt-4 [&_h5]:mb-2 [&_h5]:text-base [&_h6]:mt-4 [&_h6]:mb-2 [&_h6]:text-sm',
  '[&_a]:text-brand [&_a]:underline [&_a:hover]:text-brand-dark',
  '[&_strong]:font-bold [&_em]:italic',
  '[&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1',
  '[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-accent [&_blockquote]:bg-page [&_blockquote]:px-4 [&_blockquote]:py-2',
  '[&_img]:my-4 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-md',
  '[&_figure]:my-4 [&_figure_img]:my-0 [&_figcaption]:mt-1.5 [&_figcaption]:text-center [&_figcaption]:text-[13px] [&_figcaption]:text-muted',
  '[&_iframe]:my-4 [&_iframe]:aspect-video [&_iframe]:h-auto [&_iframe]:w-full [&_iframe]:rounded-md',
  // A top-level video given a width by `sizeEmbeds` (the only iframes with a `style`) is centred at it from `sm` (D-273).
  'sm:[&>iframe[style]]:mx-auto sm:[&>iframe[style]]:w-(--embed-w)',
  // An uploaded image alone in a top-level paragraph, given a width the same way, keeps its shape (`h-auto`) (D-283).
  'sm:[&>p>img[style]]:block sm:[&>p>img[style]]:mx-auto sm:[&>p>img[style]]:w-(--embed-w)',
  '[&_table]:my-4 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:border-collapse',
  '[&_td]:border [&_td]:border-line [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-line [&_th]:bg-page [&_th]:px-2 [&_th]:py-1',
  // A cell keeps its words whole; a wide table scrolls sideways inside itself instead.
  '[&_td]:[overflow-wrap:normal] [&_th]:[overflow-wrap:normal]',
].join(' ');

/**
 * The article body: the stored `body_html`, already sanitised to the allow-list at import (D-133, D-135). This is
 * the only place the site renders HTML from data; every other field is escaped text. Its iframes are titled
 * with `shop.news.videoTitle`, and its images and iframes lazy-loaded, at render time.
 *
 * A product card placeholder (`<tinz-product data-id>`, D-245) is replaced by an `ArticleProductCard` of the live
 * product in `productCards`; one with no entry there (unknown, inactive or hidden) renders nothing. The HTML
 * around the cards is processed segment by segment, exactly as a body without cards is. A card or a top-level video
 * with a stored width (D-273), or an uploaded image alone in a top-level paragraph with one (D-283), is centred at that
 * width from `sm` and drawn as at full width below it.
 */
export default function ArticleBody({ html, productCards = [] }: { html: string; productCards?: LandingProductCard[] }) {
  const t = useTranslations('shop.news');
  const title = t('videoTitle');
  const byId = new Map(productCards.map((card) => [card.productId, card]));
  const segments = splitAtProductCards(html);
  if (!segments.some((segment) => segment.kind === 'product')) {
    return <div className={PROSE} dangerouslySetInnerHTML={{ __html: lazyEmbeds(titleIframes(sizeEmbeds(html), title)) }} />;
  }
  return (
    <div>
      {segments.map((segment, index) => {
        if (segment.kind === 'html') {
          return <div key={index} className={PROSE} dangerouslySetInnerHTML={{ __html: lazyEmbeds(titleIframes(sizeEmbeds(segment.html), title)) }} />;
        }
        const card = byId.get(segment.productId);
        if (card === undefined) return null;
        if (segment.width === undefined) return <ArticleProductCard key={index} card={card} />;
        return (
          <div key={index} className={EMBED_WIDTH} style={{ '--embed-w': `${segment.width}%` } as CSSProperties}>
            <ArticleProductCard card={card} />
          </div>
        );
      })}
    </div>
  );
}
