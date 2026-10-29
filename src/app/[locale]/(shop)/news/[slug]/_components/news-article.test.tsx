import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { NewsArticleDetail, NewsCardData } from '@/server/services/news/news-read-service';
import en from '../../../../../../../messages/en.json';
import th from '../../../../../../../messages/th.json';
import NewsCardSection from '../../_components/NewsCardSection';
import SiteHeader from '../../../_components/SiteHeader';
import { lazyEmbeds, titleIframes } from './ArticleBody';
import NewsArticleView from './NewsArticleView';

function render(node: ReactNode, locale: 'th' | 'en' = 'th'): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'th' ? th : en} timeZone="Asia/Bangkok">
      {node}
    </NextIntlClientProvider>,
  );
}

const text = (html: string): string => html.replace(/<[^>]+>/g, '');

function card(n: number): NewsCardData {
  return {
    slug: `post-${n}`,
    title: `ข่าว ${n}`,
    excerpt: `สรุป ${n}`,
    bylineName: 'Invented Writer',
    publishedAt: new Date('2026-09-22T03:00:00Z'),
    featuredImageUrl: null,
    categoryName: 'News',
  };
}

function detail(overrides: Partial<NewsArticleDetail> = {}): NewsArticleDetail {
  return {
    slug: 'รีวิว-เกม',
    title: 'รีวิว <Switch 2> & อื่นๆ',
    excerpt: 'สรุป',
    bylineName: 'Invented Writer',
    publishedAt: new Date('2026-09-22T03:00:00Z'),
    featuredImageUrl: 'https://old.example/hero.jpg',
    bodyHtml: '<p>ย่อหน้า <strong>หนา</strong></p><iframe src="https://www.youtube.com/embed/abc" allowfullscreen></iframe>',
    categories: [
      { slug: 'news', name: 'News' },
      { slug: 'บทความ', name: 'บท<ความ>' },
    ],
    related: [card(1), card(2), card(3)],
    ...overrides,
  };
}

describe('NewsArticleView', () => {
  it('shows "โดย {bylineName}", or the fallback byline when there is none', () => {
    expect(text(render(<NewsArticleView article={detail()} />))).toContain('โดย Invented Writer');
    expect(text(render(<NewsArticleView article={detail({ bylineName: null })} />))).toContain('โดย ทีม Tinzshop');
    expect(text(render(<NewsArticleView article={detail({ bylineName: null })} />, 'en'))).toContain(
      'By the Tinzshop team',
    );
  });

  it('renders the stored body as HTML, and every other field as escaped text', () => {
    const html = render(<NewsArticleView article={detail()} />);
    expect(html).toContain('<p>ย่อหน้า <strong>หนา</strong></p>');
    expect(html).toContain('<h1');
    expect(html).toContain('รีวิว &lt;Switch 2&gt; &amp; อื่นๆ');
    expect(html).not.toContain('<Switch 2>');
    expect(html).toContain('บท&lt;ความ&gt;');
  });

  it('loads the featured image eagerly and lazy-loads embeds in the body', () => {
    const html = render(<NewsArticleView article={detail()} />);
    expect(html).toMatch(/<img[^>]*src="https:\/\/old.example\/hero.jpg"[^>]*loading="eager"|<img[^>]*loading="eager"[^>]*src="https:\/\/old.example\/hero.jpg"/);
    expect(html).toMatch(/<iframe loading="lazy"[^>]*src="https:\/\/www.youtube.com\/embed\/abc"/);
    expect(render(<NewsArticleView article={detail({ featuredImageUrl: null })} />)).not.toContain('loading="eager"');
  });

  it('shows the date with the Buddhist year on /th, the breadcrumb and the category links', () => {
    const html = render(<NewsArticleView article={detail()} />);
    expect(text(html)).toContain('2569');
    expect(html).toContain('href="/th/news"');
    expect(html).toContain('href="/th/news/category/news"');
    expect(html).toContain(`href="/th/news/category/${encodeURIComponent('บทความ')}"`);
    expect(html).toMatch(/aria-current="page"[^>]*>รีวิว &lt;Switch 2&gt;/);
    // The nav marks "ข่าวเกม" as current on an article.
    expect(html).toMatch(/<a aria-current="page"[^>]*href="\/th\/news"|<a[^>]*href="\/th\/news"[^>]*aria-current="page"/);
  });

  it('lists the related articles, and leaves the section out when there are none', () => {
    const html = render(<NewsArticleView article={detail()} />);
    expect(text(html)).toContain(th.shop.news.related.title);
    for (const n of [1, 2, 3]) expect(html).toContain(`href="/th/news/post-${n}"`);
    expect(text(render(<NewsArticleView article={detail({ related: [] })} />))).not.toContain(
      th.shop.news.related.title,
    );
  });
});

describe('lazyEmbeds', () => {
  it('adds loading="lazy" to every image and iframe, and nothing else', () => {
    expect(lazyEmbeds('<p>a &lt;img b</p><img src="x" alt="y"><IMG src="z"><iframe src="v"></iframe><imgx>')).toBe(
      '<p>a &lt;img b</p><img loading="lazy" src="x" alt="y"><IMG loading="lazy" src="z"><iframe loading="lazy" src="v"></iframe><imgx>',
    );
    expect(lazyEmbeds('')).toBe('');
  });
});

describe('titleIframes', () => {
  it('gives every iframe the title, escaped, and touches nothing else', () => {
    expect(titleIframes('<p>&lt;iframe</p><iframe src="v"></iframe><IFRAME src="w"></IFRAME><img src="x">', 'A "b" & <c>')).toBe(
      '<p>&lt;iframe</p><iframe title="A &quot;b&quot; &amp; &lt;c&gt;" src="v"></iframe><IFRAME title="A &quot;b&quot; &amp; &lt;c&gt;" src="w"></IFRAME><img src="x">',
    );
  });

  it('titles the body\'s YouTube iframes from the message on the article page', () => {
    expect(render(<NewsArticleView article={detail()} />)).toMatch(
      new RegExp(`<iframe[^>]*title="${th.shop.news.videoTitle}"[^>]*src="https://www.youtube.com/embed/abc"`),
    );
    expect(render(<NewsArticleView article={detail()} />, 'en')).toContain(`title="${en.shop.news.videoTitle}"`);
  });
});

describe('NewsCardSection on the landing page', () => {
  it('renders the news section with 3 cards and a link to every article', () => {
    const html = render(
      <NewsCardSection id="news" title={th.shop.news.landing.title} cards={[card(1), card(2), card(3)]} moreHref="/th/news" />,
    );
    expect(text(html)).toContain('ข่าวเกมล่าสุด');
    expect(html.match(/<li/g)).toHaveLength(3);
    expect(html).toContain('href="/th/news"');
    expect(text(html)).toContain(th.shop.news.landing.more);
    expect(html).toContain('aria-labelledby="news-title"');
  });

  it('hides the section when there are no articles', () => {
    expect(render(<NewsCardSection id="news" title="x" cards={[]} moreHref="/th/news" />)).toBe('');
  });
});

describe('SiteHeader news link', () => {
  it('links "ข่าวเกม" to the news list and marks it current only on news routes', () => {
    const plain = render(<SiteHeader path="/" />);
    expect(plain).toContain('href="/th/news"');
    expect(plain).not.toContain('aria-current="page"');
    const onNews = render(<SiteHeader path="/news" activeNav="news" />, 'en');
    expect(onNews).toMatch(/<a aria-current="page"[^>]*href="\/en\/news"|<a[^>]*href="\/en\/news"[^>]*aria-current="page"/);
    expect(onNews.match(/aria-current="page"/g)).toHaveLength(1);
  });
});
