import { describe, expect, it, vi } from 'vitest';

import {
  NEWS_PAGE_SIZE,
  RELATED_NEWS_LIMIT,
  getNewsArticle,
  listLatestNews,
  listListedNewsCategories,
  listNews,
  type NewsArticleDetailRow,
  type NewsArticleRow,
  type NewsCategoryRow,
  type NewsListFilter,
  type NewsReadDeps,
} from './news-read-service';

const NOW = new Date('2026-10-29T05:00:00Z');

// A tree like the old site's: News > NINTENDO, News > บทความ; SONY and an unlisted category on their own.
const CATEGORIES: NewsCategoryRow[] = [
  { id: 'c-news', slug: 'news', parentId: null, position: 2, names: { th: 'News' }, isListed: true },
  { id: 'c-nintendo', slug: 'nintendo', parentId: 'c-news', position: 3, names: { th: 'NINTENDO' }, isListed: true },
  { id: 'c-article', slug: 'บทความ', parentId: 'c-news', position: 1, names: { th: 'บทความ' }, isListed: true },
  { id: 'c-sony', slug: 'sony', parentId: null, position: 4, names: { th: 'SONY', en: 'SONY EN' }, isListed: true },
  { id: 'c-empty', slug: 'empty', parentId: null, position: 5, names: { th: 'ว่าง' }, isListed: true },
  { id: 'c-uncat', slug: 'uncategorized', parentId: null, position: 0, names: { th: 'Uncategorized' }, isListed: false },
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
  /** Live articles per category, subtree included, as the repository counts them. */
  counts?: Record<string, number>;
}) {
  const count = vi.fn(async (_filter: Omit<NewsListFilter, 'skip' | 'take'>) => options.total ?? 0);
  const list = vi.fn(async (_filter: NewsListFilter) => options.rows ?? []);
  const deps: NewsReadDeps = {
    news: {
      listNewsCategories: async () => CATEGORIES,
      countLiveNewsArticlesByCategory: async () => new Map(Object.entries(options.counts ?? {})),
      countLiveNewsArticles: count,
      listLiveNewsArticles: list,
    },
    now: () => NOW,
  };
  return { deps, count, list };
}

describe('listNews', () => {
  it('includes descendant categories without duplicates', async () => {
    // The repository's counts: a1 in both News and its child NINTENDO counts once for News.
    const counts = { 'c-news': 2, 'c-nintendo': 1, 'c-article': 1, 'c-sony': 1 };
    const { deps, count, list } = setup({ total: 2, rows: [row(2), row(1)], counts });

    const result = await listNews(deps, { locale: 'th', categorySlug: 'news', page: 1 });

    const filter = list.mock.calls[0]?.[0];
    expect(new Set(filter?.categoryIds)).toEqual(new Set(['c-news', 'c-nintendo', 'c-article']));
    expect(filter).toMatchObject({ now: NOW, skip: 0, take: NEWS_PAGE_SIZE });
    expect(count.mock.calls[0]?.[0].categoryIds).toEqual(filter?.categoryIds);
    expect(result?.categories).toEqual([
      { slug: 'news', name: 'News', count: 2 },
      { slug: 'บทความ', name: 'บทความ', count: 1 },
      { slug: 'nintendo', name: 'NINTENDO', count: 1 },
      { slug: 'sony', name: 'SONY', count: 1 },
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
        row(1, { titles: { th: 'หัวข้อไทย' }, excerpts: { th: 'สรุปไทย' }, categoryIds: ['c-sony'] }),
        row(2, { titles: { th: 'ไทย', en: 'English' }, excerpts: { th: 'ไทย', en: 'English excerpt' } }),
      ],
      counts: { 'c-sony': 1 },
    });
    const result = await listNews(deps, { locale: 'en', page: 1 });
    expect(result?.items[0]).toMatchObject({ title: 'หัวข้อไทย', excerpt: 'สรุปไทย', categoryName: 'SONY EN' });
    expect(result?.items[1]).toMatchObject({ title: 'English', excerpt: 'English excerpt' });
    expect(result?.categories).toEqual([{ slug: 'sony', name: 'SONY EN', count: 1 }]);
  });

  it("tags a card with the article's most specific category", async () => {
    const { deps } = setup({
      total: 3,
      rows: [
        row(1, { categoryIds: ['c-news', 'c-nintendo'] }),
        row(2, { categoryIds: ['c-sony', 'c-article'] }),
        row(3, { categoryIds: [] }),
      ],
    });
    const result = await listNews(deps, { locale: 'th', page: 1 });
    expect(result?.items.map((item) => item.categoryName)).toEqual(['NINTENDO', 'บทความ', null]);
  });

  it('gives no tab to an unlisted category, and returns null for its slug', async () => {
    const counts = { 'c-uncat': 2, 'c-news': 1 };
    const { deps, list } = setup({ total: 2, rows: [row(2), row(1, { categoryIds: ['c-uncat'] })], counts });

    const all = await listNews(deps, { locale: 'th', page: 1 });

    // Its articles are still under ทั้งหมด.
    expect(all?.items.map((item) => item.slug)).toEqual(['post-2', 'post-1']);
    expect(all?.categories).toEqual([{ slug: 'news', name: 'News', count: 1 }]);
    list.mockClear();
    expect(await listNews(deps, { locale: 'th', categorySlug: 'uncategorized', page: 1 })).toBeNull();
    expect(list).not.toHaveBeenCalled();
  });

  it("rolls an unlisted child's articles up into its listed parent's page and tab count (D-141)", async () => {
    const withHiddenChild: NewsCategoryRow[] = [
      ...CATEGORIES,
      { id: 'c-hidden', slug: 'hidden', parentId: 'c-news', position: 6, names: { th: 'Hidden' }, isListed: false },
    ];
    // The repository rolls the hidden child's a1 up into News: News 2, the hidden child 1.
    const counts = { 'c-news': 2, 'c-hidden': 1 };
    const { deps, list, count } = setup({ total: 2, rows: [row(2), row(1, { categoryIds: ['c-hidden'] })], counts });
    deps.news.listNewsCategories = async () => withHiddenChild;

    const result = await listNews(deps, { locale: 'th', categorySlug: 'news', page: 1 });

    expect(new Set(list.mock.calls[0]?.[0].categoryIds)).toContain('c-hidden');
    expect(new Set(count.mock.calls[0]?.[0].categoryIds)).toContain('c-hidden');
    // News counts a1 (only in the unlisted child) and a2; the unlisted child has no tab.
    expect(result?.categories).toEqual([{ slug: 'news', name: 'News', count: 2 }]);
    list.mockClear();
    expect(await listNews(deps, { locale: 'th', categorySlug: 'hidden', page: 1 })).toBeNull();
    expect(list).not.toHaveBeenCalled();
  });

  it("falls a card's tag back to the listed parent when its only category is an unlisted child", async () => {
    const withHiddenChild: NewsCategoryRow[] = [
      ...CATEGORIES,
      { id: 'c-hidden', slug: 'hidden', parentId: 'c-news', position: 6, names: { th: 'Hidden' }, isListed: false },
    ];
    const { deps } = setup({
      total: 2,
      rows: [row(1, { categoryIds: ['c-hidden'] }), row(2, { categoryIds: ['c-hidden', 'c-nintendo'] })],
    });
    deps.news.listNewsCategories = async () => withHiddenChild;
    const result = await listNews(deps, { locale: 'th', page: 1 });
    // Never tagged with the unlisted child: News for the article only in it, the next listed leaf for the other.
    expect(result?.items.map((item) => item.categoryName)).toEqual(['News', 'NINTENDO']);
  });

  it('never tags a card with an unlisted category', async () => {
    const { deps } = setup({
      total: 2,
      rows: [row(1, { categoryIds: ['c-uncat'] }), row(2, { categoryIds: ['c-uncat', 'c-news'] })],
    });
    const result = await listNews(deps, { locale: 'th', page: 1 });
    expect(result?.items.map((item) => item.categoryName)).toEqual([null, 'News']);
  });

  it('keeps plain-text titles as given, markup characters and all', async () => {
    const { deps } = setup({ total: 1, rows: [row(1, { titles: { th: 'A <b> & "C"' } })] });
    const result = await listNews(deps, { locale: 'th', page: 1 });
    expect(result?.items[0]?.title).toBe('A <b> & "C"');
  });

  it('survives a category cycle in the stored tree', async () => {
    const cyclic: NewsCategoryRow[] = [
      { id: 'x', slug: 'x', parentId: 'y', position: 1, names: { th: 'X' }, isListed: true },
      { id: 'y', slug: 'y', parentId: 'x', position: 2, names: { th: 'Y' }, isListed: true },
    ];
    const { deps, list } = setup({ total: 0 });
    deps.news.listNewsCategories = async () => cyclic;
    await listNews(deps, { locale: 'th', categorySlug: 'x', page: 1 });
    expect(new Set(list.mock.calls[0]?.[0].categoryIds)).toEqual(new Set(['x', 'y']));
  });
});

function detailRow(n: number, overrides: Partial<NewsArticleDetailRow> = {}): NewsArticleDetailRow {
  return { ...row(n), bodies: { th: `<p>เนื้อหา ${n}</p>` }, ...overrides };
}

function setupArticle(options: { article?: NewsArticleDetailRow | null; related?: NewsArticleRow[] }) {
  const find = vi.fn(async (_slug: string, _now: Date) => options.article ?? null);
  const list = vi.fn(async (_filter: NewsListFilter) => options.related ?? []);
  const deps = {
    news: { listNewsCategories: async () => CATEGORIES, findLiveNewsArticle: find, listLiveNewsArticles: list },
    now: () => NOW,
  };
  return { deps, find, list };
}

describe('getNewsArticle', () => {
  it('opens an article by a Thai slug', async () => {
    const article = detailRow(7, { slug: 'รีวิว-เกม', categoryIds: ['c-nintendo', 'c-news'] });
    const { deps, find } = setupArticle({ article });

    const detail = await getNewsArticle(deps, { locale: 'th', slug: 'รีวิว-เกม' });

    // The repository gets the decoded slug as given, and the live-article clock.
    expect(find).toHaveBeenCalledWith('รีวิว-เกม', NOW);
    expect(detail).toMatchObject({
      slug: 'รีวิว-เกม',
      title: 'ข่าว 7',
      excerpt: 'สรุป 7',
      bylineName: 'Invented Writer',
      publishedAt: article.publishedAt,
      featuredImageUrl: null,
      bodyHtml: '<p>เนื้อหา 7</p>',
    });
    // Categories in `position` order.
    expect(detail?.categories).toEqual([
      { slug: 'news', name: 'News' },
      { slug: 'nintendo', name: 'NINTENDO' },
    ]);
  });

  it('shows and relates by listed categories only', async () => {
    const article = detailRow(5, { categoryIds: ['c-uncat', 'c-news'] });
    const { deps, list } = setupArticle({ article, related: [row(9)] });

    const detail = await getNewsArticle(deps, { locale: 'th', slug: 'post-5' });

    expect(detail?.categories).toEqual([{ slug: 'news', name: 'News' }]);
    expect(list.mock.calls.map(([filter]) => filter.categoryIds)).toEqual([['c-news']]);

    const onlyUnlisted = setupArticle({ article: detailRow(6, { categoryIds: ['c-uncat'] }) });
    const hidden = await getNewsArticle(onlyUnlisted.deps, { locale: 'th', slug: 'post-6' });
    expect(hidden?.categories).toEqual([]);
    expect(onlyUnlisted.list).not.toHaveBeenCalled();
  });

  it('returns null for an unknown slug', async () => {
    const { deps, list } = setupArticle({ article: null });
    expect(await getNewsArticle(deps, { locale: 'th', slug: 'nope' })).toBeNull();
    expect(list).not.toHaveBeenCalled();
  });

  it('related excludes the article itself, max 3', async () => {
    const article = detailRow(5, { categoryIds: ['c-sony'] });
    const related = [row(9), row(5), row(8), row(7), row(6)];
    const { deps, list } = setupArticle({ article, related: related.slice(0, RELATED_NEWS_LIMIT + 1) });

    const detail = await getNewsArticle(deps, { locale: 'th', slug: 'post-5' });

    expect(RELATED_NEWS_LIMIT).toBe(3);
    expect(list).toHaveBeenCalledWith({ categoryIds: ['c-sony'], now: NOW, skip: 0, take: RELATED_NEWS_LIMIT + 1 });
    expect(detail?.related.map((card) => card.slug)).toEqual(['post-9', 'post-8', 'post-7']);
    expect(detail?.related[0]?.categoryName).toBe('News');
  });

  it('relates an article in News + NINTENDO by NINTENDO first', async () => {
    const article = detailRow(5, { categoryIds: ['c-news', 'c-nintendo'] });
    const nintendo = [row(9, { categoryIds: ['c-news', 'c-nintendo'] }), row(5), row(8), row(7)];
    const { deps, list } = setupArticle({ article });
    list.mockImplementation(async (filter: NewsListFilter) =>
      filter.categoryIds?.includes('c-nintendo') ? nintendo : [row(20), row(19), row(18), row(17)],
    );

    const detail = await getNewsArticle(deps, { locale: 'th', slug: 'post-5' });

    expect(list).toHaveBeenCalledTimes(1);
    expect(list.mock.calls[0]?.[0].categoryIds).toEqual(['c-nintendo']);
    expect(detail?.related.map((card) => card.slug)).toEqual(['post-9', 'post-8', 'post-7']);
  });

  it('fills up from the parent category when the leaf has fewer than 3', async () => {
    const article = detailRow(5, { categoryIds: ['c-news', 'c-nintendo'] });
    const { deps, list } = setupArticle({ article });
    list.mockImplementation(async (filter: NewsListFilter) =>
      filter.categoryIds?.includes('c-nintendo')
        ? [row(9), row(5)]
        : [row(20), row(9), row(5), row(19), row(18)],
    );

    const detail = await getNewsArticle(deps, { locale: 'th', slug: 'post-5' });

    expect(list.mock.calls.map(([filter]) => filter.categoryIds)).toEqual([['c-nintendo'], ['c-news']]);
    // Leaf articles first, then the parent's newest; never the article itself, never twice.
    expect(detail?.related.map((card) => card.slug)).toEqual(['post-9', 'post-20', 'post-19']);
  });

  it('takes one leaf at a time, the card tag first, so a broad leaf does not crowd it out', async () => {
    // NINTENDO (position 3) and SONY (position 4) are both leaves of this article.
    const article = detailRow(5, { categoryIds: ['c-news', 'c-nintendo', 'c-sony'] });
    const { deps, list } = setupArticle({ article });
    list.mockImplementation(async (filter: NewsListFilter) =>
      filter.categoryIds?.[0] === 'c-nintendo' ? [row(3), row(5)] : [row(30), row(29), row(3)],
    );

    const detail = await getNewsArticle(deps, { locale: 'th', slug: 'post-5' });

    expect(list.mock.calls.map(([filter]) => filter.categoryIds)).toEqual([['c-nintendo'], ['c-sony']]);
    expect(detail?.related.map((card) => card.slug)).toEqual(['post-3', 'post-30', 'post-29']);
  });

  it('has no related articles when the article has no category', async () => {
    const { deps, list } = setupArticle({ article: detailRow(1, { categoryIds: [] }) });
    const detail = await getNewsArticle(deps, { locale: 'th', slug: 'post-1' });
    expect(detail?.related).toEqual([]);
    expect(detail?.categories).toEqual([]);
    expect(list).not.toHaveBeenCalled();
  });

  it('falls back to the th title and body on en, and keeps a null byline', async () => {
    const thaiOnly = detailRow(2, { bylineName: null });
    const { deps } = setupArticle({ article: thaiOnly });
    const detail = await getNewsArticle(deps, { locale: 'en', slug: 'post-2' });
    expect(detail).toMatchObject({ title: 'ข่าว 2', bodyHtml: '<p>เนื้อหา 2</p>', bylineName: null });

    const both = detailRow(3, {
      titles: { th: 'ไทย', en: 'English' },
      bodies: { th: '<p>ไทย</p>', en: '<p>English</p>' },
    });
    const english = await getNewsArticle(setupArticle({ article: both }).deps, { locale: 'en', slug: 'post-3' });
    expect(english).toMatchObject({ title: 'English', bodyHtml: '<p>English</p>' });
  });
});

describe('listLatestNews', () => {
  it('returns the newest live articles as cards, at most the limit', async () => {
    const list = vi.fn(async (_filter: NewsListFilter) => [row(3), row(2), row(1)]);
    const deps = { news: { listNewsCategories: async () => CATEGORIES, listLiveNewsArticles: list }, now: () => NOW };

    const cards = await listLatestNews(deps, { locale: 'th', limit: 3 });

    expect(list).toHaveBeenCalledWith({ categoryIds: null, now: NOW, skip: 0, take: 3 });
    expect(cards.map((card) => card.slug)).toEqual(['post-3', 'post-2', 'post-1']);
    expect(cards[0]).toMatchObject({ title: 'ข่าว 3', categoryName: 'News' });
  });
});

describe('listListedNewsCategories', () => {
  it('returns every listed category, slug and name in the locale, in position order, and no unlisted one', async () => {
    const deps = { news: { listNewsCategories: async () => CATEGORIES } };
    expect(await listListedNewsCategories(deps, { locale: 'en' })).toEqual([
      { slug: 'บทความ', name: 'บทความ' },
      { slug: 'news', name: 'News' },
      { slug: 'nintendo', name: 'NINTENDO' },
      { slug: 'sony', name: 'SONY EN' },
      { slug: 'empty', name: 'ว่าง' },
    ]);
  });
});
