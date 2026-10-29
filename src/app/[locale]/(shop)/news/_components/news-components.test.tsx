import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { NewsCardData } from '@/server/services/news/news-read-service';
import en from '../../../../../../messages/en.json';
import th from '../../../../../../messages/th.json';
import NewsCard from './NewsCard';
import NewsFeature from './NewsFeature';
import NewsSidebar from './NewsSidebar';
import NewsTabs from './NewsTabs';
import Pagination, { pageItems } from './Pagination';

function render(node: ReactNode, locale: 'th' | 'en' = 'th'): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'th' ? th : en} timeZone="Asia/Bangkok">
      {node}
    </NextIntlClientProvider>,
  );
}

const text = (html: string): string => html.replace(/<[^>]+>/g, '');

/** Every opening `<a>` tag whose href is exactly `href`, whatever the attribute order. */
const anchors = (html: string, href: string): string[] =>
  (html.match(/<a\b[^>]*>/g) ?? []).filter((tag) => tag.includes(`href="${href}"`));

const THAI_SLUG = 'บทความ';
const THAI_SLUG_PATH = encodeURIComponent(THAI_SLUG);

const CATEGORIES = [
  { slug: 'news', name: 'News', count: 58 },
  { slug: THAI_SLUG, name: 'บทความ', count: 24 },
];

function card(n: number, overrides: Partial<NewsCardData> = {}): NewsCardData {
  return {
    slug: `post-${n}`,
    title: `ข่าว ${n}`,
    excerpt: `สรุป ${n}`,
    bylineName: 'Invented Writer',
    publishedAt: new Date('2026-09-22T03:00:00Z'),
    featuredImageUrl: null,
    categoryName: 'News',
    ...overrides,
  };
}

describe('NewsTabs', () => {
  it('marks "all" active on the list page and links each category with its count', () => {
    const html = render(<NewsTabs categories={CATEGORIES} activeCategorySlug={null} />);
    expect(anchors(html, '/th/news')[0]).toContain('aria-current="page"');
    expect(html).toMatch(/aria-current="page"[^>]*>ทั้งหมด</);
    expect(html).toContain(`href="/th/news/category/${THAI_SLUG_PATH}"`);
    expect(html).toContain('href="/th/news/category/news"');
    expect(html).toMatch(/News<span[^>]*>58<\/span>/);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it('marks the active category and no other', () => {
    const html = render(<NewsTabs categories={CATEGORIES} activeCategorySlug={THAI_SLUG} />);
    expect(anchors(html, `/th/news/category/${THAI_SLUG_PATH}`)[0]).toContain('aria-current="page"');
    expect(anchors(html, '/th/news')[0]).not.toContain('aria-current');
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it('escapes a category name holding markup characters', () => {
    const html = render(<NewsTabs categories={[{ slug: 'x', name: '<b>A&B</b>', count: 1 }]} activeCategorySlug={null} />);
    expect(html).toContain('&lt;b&gt;A&amp;B&lt;/b&gt;');
    expect(html).not.toContain('<b>');
  });
});

describe('Pagination', () => {
  it('keeps the category in every page link, and page 1 has no query', () => {
    const base = `/th/news/category/${THAI_SLUG_PATH}`;
    const html = render(<Pagination basePath={base} page={2} totalPages={3} />);
    expect(html).toContain(`href="${base}"`);
    expect(html).toContain(`href="${base}?page=3"`);
    expect(html).toMatch(/aria-current="page"[^>]*>2</);
    expect(anchors(html, base).some((tag) => tag.includes('aria-label="หน้าก่อนหน้า"'))).toBe(true);
    expect(anchors(html, `${base}?page=3`).some((tag) => tag.includes('aria-label="หน้าถัดไป"'))).toBe(true);
    expect(html).not.toContain('href="/th/news?');
    expect(html).toContain('aria-label="เลขหน้า"');
  });

  it('disables previous on the first page and next on the last', () => {
    const first = render(<Pagination basePath="/th/news" page={1} totalPages={2} />);
    expect(first).toMatch(/<span[^>]*aria-disabled="true"[^>]*aria-label="หน้าก่อนหน้า"/);
    expect(anchors(first, '/th/news?page=2').some((tag) => tag.includes('aria-label="หน้าถัดไป"'))).toBe(true);
    const last = render(<Pagination basePath="/th/news" page={2} totalPages={2} />);
    expect(last).toMatch(/<span[^>]*aria-disabled="true"[^>]*aria-label="หน้าถัดไป"/);
  });

  it('renders nothing for a single page', () => {
    expect(render(<Pagination basePath="/th/news" page={1} totalPages={1} />)).toBe('');
  });

  it('shows the first and last pages, the neighbours of the current one, and gaps', () => {
    expect(pageItems(1, 12)).toEqual([1, 2, 3, 'gap', 12]);
    expect(pageItems(6, 12)).toEqual([1, 'gap', 5, 6, 7, 'gap', 12]);
    expect(pageItems(12, 12)).toEqual([1, 'gap', 10, 11, 12]);
    expect(pageItems(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('NewsCard', () => {
  it('shows tag, escaped title, excerpt, the Buddhist-era date and a lazy image', () => {
    const html = render(
      <NewsCard card={card(1, { title: 'A <script>x</script> & B', featuredImageUrl: 'https://old.test/a.jpg' })} />,
    );
    expect(html).toContain('href="/th/news/post-1"');
    expect(html).toContain('A &lt;script&gt;x&lt;/script&gt; &amp; B');
    expect(html).not.toContain('<script>');
    expect(html).toContain('สรุป 1');
    expect(html).toContain('22 ก.ย. 2569');
    expect(html).toMatch(/datetime="2026-09-22T03:00:00.000Z"/i);
    expect(html).toContain('src="https://old.test/a.jpg"');
    expect(html).toContain('loading="lazy"');
  });

  it('uses the placeholder without an image and percent-encodes a Thai slug', () => {
    const html = render(<NewsCard card={card(1, { slug: THAI_SLUG })} />, 'en');
    expect(html).toContain(`href="/en/news/${THAI_SLUG_PATH}"`);
    expect(html).toContain(`aria-label="${en.shop.news.imagePlaceholderAlt}"`);
    expect(html).toContain('Sep 22, 2026');
  });
});

describe('NewsFeature', () => {
  it('shows the 3 cards, the main one with excerpt and byline, images eager', () => {
    const html = render(
      <NewsFeature
        cards={[
          card(1, { featuredImageUrl: 'https://old.test/1.jpg', bylineName: null }),
          card(2, { featuredImageUrl: 'https://old.test/2.jpg' }),
          card(3),
        ]}
      />,
    );
    expect(html).toContain('aria-label="ข่าวเด่น"');
    expect(text(html)).toContain('โดย ทีม Tinzshop · 22 ก.ย. 2569');
    expect(html).toContain('สรุป 1');
    expect(html).not.toContain('สรุป 2');
    expect(html.match(/<h2/g)).toHaveLength(3);
    expect(html.match(/loading="eager"/g)).toHaveLength(2);
    expect(html).not.toContain('loading="lazy"');
  });

  it('names the writer when the article has one', () => {
    const html = render(<NewsFeature cards={[card(1)]} />);
    expect(text(html)).toContain('โดย Invented Writer · 22 ก.ย. 2569');
  });

  it('renders nothing without cards', () => {
    expect(render(<NewsFeature cards={[]} />)).toBe('');
  });
});

describe('NewsSidebar', () => {
  it('lists the categories with counts, marks the active one, and shows no popularity ranking', () => {
    const html = render(<NewsSidebar categories={CATEGORIES} activeCategorySlug="news" />);
    expect(html).toContain(th.shop.news.tabs.label);
    expect(anchors(html, '/th/news/category/news')[0]).toContain('aria-current="page"');
    expect(html).toMatch(/>58<\/span>/);
    expect(html).toContain(th.shop.news.sidebar.preOrderAction);
    expect(html).not.toContain('ข่าวยอดนิยม');
  });
});
