/**
 * Adds `loading="lazy"` to every `<img>` and `<iframe>` start tag of the stored body, at render time; the
 * stored value is never changed. The body is sanitised HTML, in which a literal `<` in text or an attribute
 * is always escaped (`&lt;`), so `<img` and `<iframe` only ever start a real tag.
 */
export function lazyEmbeds(html: string): string {
  return html.replace(/<(img|iframe)(?=[\s/>])/gi, '<$1 loading="lazy"');
}

// Reading styles for the body's allow-listed elements (D-135); Tailwind's preflight resets them all.
const PROSE = [
  'text-base leading-[1.8] [overflow-wrap:anywhere]',
  '[&_p]:my-4 [&_br]:leading-[1.8]',
  '[&_h1]:mt-8 [&_h1]:mb-3 [&_h1]:text-2xl [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl',
  '[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-lg [&_h4]:mt-6 [&_h4]:mb-2 [&_h4]:text-base',
  '[&_h5]:mt-4 [&_h5]:mb-2 [&_h5]:text-base [&_h6]:mt-4 [&_h6]:mb-2 [&_h6]:text-sm',
  '[&_a]:text-primary [&_a]:underline [&_a:hover]:text-primary-dark',
  '[&_strong]:font-bold [&_em]:italic',
  '[&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1',
  '[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-accent [&_blockquote]:bg-bg-subtle [&_blockquote]:px-4 [&_blockquote]:py-2',
  '[&_img]:my-4 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-(--radius-sm)',
  '[&_figure]:my-4 [&_figure_img]:my-0 [&_figcaption]:mt-1.5 [&_figcaption]:text-center [&_figcaption]:text-[13px] [&_figcaption]:text-text-subtle',
  '[&_iframe]:my-4 [&_iframe]:aspect-video [&_iframe]:h-auto [&_iframe]:w-full [&_iframe]:rounded-(--radius-sm)',
  '[&_table]:my-4 [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:border-collapse',
  '[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:bg-bg-subtle [&_th]:px-2 [&_th]:py-1',
  // A cell keeps its words whole; a wide table scrolls sideways inside itself instead.
  '[&_td]:[overflow-wrap:normal] [&_th]:[overflow-wrap:normal]',
].join(' ');

/**
 * The article body: the stored `body_html`, already sanitised to the allow-list at import (D-133, D-135). This is
 * the only place the site renders HTML from data; every other field is escaped text.
 */
export default function ArticleBody({ html }: { html: string }) {
  return <div className={PROSE} dangerouslySetInnerHTML={{ __html: lazyEmbeds(html) }} />;
}
