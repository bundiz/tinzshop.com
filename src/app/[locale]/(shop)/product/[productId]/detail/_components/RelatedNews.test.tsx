import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { NewsCardData } from '@/server/services/news/news-read-service';
import en from '../../../../../../../../messages/en.json';
import th from '../../../../../../../../messages/th.json';
import RelatedNews from './RelatedNews';

const card = (n: number): NewsCardData => ({
  slug: `post-${n}`,
  title: `ข่าว ${n}`,
  excerpt: '',
  bylineName: null,
  publishedAt: new Date('2026-09-22T03:00:00Z'),
  featuredImageUrl: null,
  categoryName: null,
});

const render = (cards: NewsCardData[], locale: 'th' | 'en' = 'th') =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'th' ? th : en} timeZone="Asia/Bangkok">
      <RelatedNews cards={cards} />
    </NextIntlClientProvider>,
  );

describe('RelatedNews', () => {
  it('lists every article, under ข่าวที่เกี่ยวข้อง / Related news, linked to the article', () => {
    const html = render([card(1), card(2), card(3), card(4)]);
    expect(html).toContain('ข่าวที่เกี่ยวข้อง');
    expect(html).toContain('href="/th/news/post-4"');
    expect(html.match(/<li/g)).toHaveLength(4);
    expect(render([card(1)], 'en')).toContain('Related news');
  });

  it('renders nothing without articles', () => {
    expect(render([])).toBe('');
  });
});
