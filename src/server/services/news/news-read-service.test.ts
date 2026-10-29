import { describe, expect, it, vi } from 'vitest';

import {
  NEWS_PAGE_SIZE,
  listNews,
  type NewsArticleRow,
  type NewsCategoryRow,
  type NewsListFilter,
  type NewsReadDeps,
} from './news-read-service';

const NOW = new Date('2026-10-29T05:00:00Z');

// A tree like the old site's: News > NINTENDO, News > บทความ; Reviews on its own.
const CATEGORIES: NewsCategoryRow[] = [
  { id: 'c-news', slug: 'news', parentId: null, position: 2, names: { th: 'News' } },
  { id: 'c-nintendo', slug: 'nintendo', parentId: 'c-news', position: 3, names: { th: 'NINTENDO' } },
  { id: 'c-article', slug: 'บทความ', parentId: 'c-news', position: 1, names: { th: 'บทความ' } },
  { id: 'c-reviews', slug: 'reviews', parentId: null, position: 4, names: { th: 'Reviews', en: 'Reviews EN' } },
  { id: 'c-empty', slug: 'empty', parentId: null, position: 5, names: { th: 'ว่าง' } },
];

function row(n: number, overrides: Partial<NewsArticleRow> = {}): NewsArticleRow {
  return {
    id: `a${n}`,
    slug: `post-${n}`,
    publishedAt: new Date(Date.UTC(2026, 0, n)),
    bylineName: 'Invented Writer',
    featuredImageUrl: null,
    titles: { th: `ข่าว ${n}` },
    excerpts: { th: `สรุป ${n}` },
    categoryIds: ['c-news'],
    ...overrides,
  };
}

function setup(options: {
  total?: number;
  rows?: NewsArticleRow[];
  links?: { articleId: string; categoryId: string }[];
}) {
  const count = vi.fn(async (_filter: Omit<NewsListFilter, 'skip' | 'take'>) => options.total ?? 0);
  const list = vi.fn(async (_filter: NewsListFilter) => options.rows ?? []);
  const deps: NewsReadDeps = {
    news: {
      listNewsCategories: async () => CATEGORIES,
      listLiveNewsCategoryLinks: async () => options.links ?? [],
      countLiveNewsArticles: count,
      listLiveNewsArticles: list,
    },
    now: () => NOW,
  };
  return { deps, count, list };
}

describe('listNews', () => {
  it('includes descendant categories without duplicates', async () => {
    // a1 sits in both News and its child NINTENDO: it counts once for News.
    const links = [
      { articleId: 'a1', categoryId: 'c-news' },
      { articleId: 'a1', categoryId: 'c-nintendo' },
      { articleId: 'a2', categoryId: 'c-article' },
      { articleId: 'a3', categoryId: 'c-reviews' },
    ];
    const { deps, count, list } = setup({ total: 2, rows: [row(2), row(1)], links });

    const result = await listNews(deps, { locale: 'th', categorySlug: 'news', page: 1 });

    const filter = list.mock.calls[0]?.[0];
    expect(new Set(filter?.categoryIds)).toEqual(new Set(['c-news', 'c-nintendo', 'c-article']));
    expect(filter).toMatchObject({ now: NOW, skip: 0, take: NEWS_PAGE_SIZE });
    expect(count.mock.calls[0]?.[0].categoryIds).toEqual(filter?.categoryIds);
    expect(result?.categories).toEqual([
      { slug: 'news', name: 'News', count: 2 },
      { slug: 'บทความ', name: 'บทความ', count: 1 },
      { slug: 'nintendo', name: 'NINTENDO', count: 1 },
      { slug: 'reviews', name: 'Reviews', count: 1 },
    ]);
    expect(result?.activeCategorySlug).toBe('news');
    expect(result?.activeCategoryName).toBe('News');
  });

  it('lists every live article with no category filter', async () => {
    const { deps, list } = setup({ total: 1, rows: [row(1)] });
    const result = await listNews(deps, { locale: 'th', page: 1 });
    expect(list.mock.calls[0]?.[0].categoryIds).toBeNull();
    expect(result).toMatchObject({ page: 1, totalPages: 1, total: 1, activeCategorySlug: null, activeCategoryName: null });
    expect(result?.items.map((item) => item.slug)).toEqual(['post-1']);
  });

  it('returns null for an unknown category', async () => {
    const { deps, list } = setup({ total: 3 });
    expect(await listNews(deps, { locale: 'th', categorySlug: 'nope', page: 1 })).toBeNull();
    expect(list).not.toHaveBeenCalled();
  });

  it('returns null past the last page', async () => {
    const { deps, list } = setup({ total: 25 });
    expect(await listNews(deps, { locale: 'th', page: 4 })).toBeNull();
    expect(await listNews(deps, { locale: 'th', page: 0 })).toBeNull();
    expect(await listNews(deps, { locale: 'th', page: 1.5 })).toBeNull();
    expect(list).not.toHaveBeenCalled();

    const last = await listNews(deps, { locale: 'th', page: 3 });
    expect(last).toMatchObject({ page: 3, totalPages: 3, total: 25 });
    expect(list.mock.calls[0]?.[0]).toMatchObject({ skip: 24, take: 12 });
  });

  it('keeps page 1 of an empty list, and an existing category with no articles', async () => {
    const { deps } = setup({ total: 0 });
    expect(await listNews(deps, { locale: 'th', page: 1 })).toMatchObject({ page: 1, totalPages: 1, total: 0, items: [] });
    expect(await listNews(deps, { locale: 'th', page: 2 })).toBeNull();
    expect(await listNews(deps, { locale: 'en', categorySlug: 'empty', page: 1 })).toMatchObject({
      activeCategorySlug: 'empty',
      activeCategoryName: 'ว่าง',
      categories: [],
    });
  });

  it('falls back to the th title on en', async () => {
    const { deps } = setup({
      total: 2,
      rows: [
        row(1, { titles: { th: 'หัวข้อไทย' }, excerpts: { th: 'สรุปไทย' }, categoryIds: ['c-reviews'] }),
        row(2, { titles: { th: 'ไทย', en: 'English' }, excerpts: { th: 'ไทย', en: 'English excerpt' } }),
      ],
      links: [{ articleId: 'a1', categoryId: 'c-reviews' }],
    });
    const result = await listNews(deps, { locale: 'en', page: 1 });
    expect(result?.items[0]).toMatchObject({ title: 'หัวข้อไทย', excerpt: 'สรุปไทย', categoryName: 'Reviews EN' });
    expect(result?.items[1]).toMatchObject({ title: 'English', excerpt: 'English excerpt' });
    expect(result?.categories).toEqual([{ slug: 'reviews', name: 'Reviews EN', count: 1 }]);
  });

  it("tags a card with the article's most specific category", async () => {
    const { deps } = setup({
      total: 3,
      rows: [
        row(1, { categoryIds: ['c-news', 'c-nintendo'] }),
        row(2, { categoryIds: ['c-reviews', 'c-article'] }),
        row(3, { categoryIds: [] }),
      ],
    });
    const result = await listNews(deps, { locale: 'th', page: 1 });
    expect(result?.items.map((item) => item.categoryName)).toEqual(['NINTENDO', 'บทความ', null]);
  });

  it('keeps plain-text titles as given, markup characters and all', async () => {
    const { deps } = setup({ total: 1, rows: [row(1, { titles: { th: 'A <b> & "C"' } })] });
    const result = await listNews(deps, { locale: 'th', page: 1 });
    expect(result?.items[0]?.title).toBe('A <b> & "C"');
  });

  it('survives a category cycle in the stored tree', async () => {
    const cyclic: NewsCategoryRow[] = [
      { id: 'x', slug: 'x', parentId: 'y', position: 1, names: { th: 'X' } },
      { id: 'y', slug: 'y', parentId: 'x', position: 2, names: { th: 'Y' } },
    ];
    const { deps, list } = setup({ total: 0 });
    deps.news.listNewsCategories = async () => cyclic;
    await listNews(deps, { locale: 'th', categorySlug: 'x', page: 1 });
    expect(new Set(list.mock.calls[0]?.[0].categoryIds)).toEqual(new Set(['x', 'y']));
  });
});
