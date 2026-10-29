import { describe, expect, it, vi } from 'vitest';

import type { NewsArticlePage, NewsArticleSnapshot, NewsCategorySnapshot, NewsSource } from './news-snapshot';
import { NewsSourceError, runNewsImport, type NewsImportDeps } from './news-import-service';

function article(sourceId: bigint, modified = '2026-01-01T00:00:00Z', removedEmbeds = 0): NewsArticleSnapshot {
  return {
    sourceId,
    slug: `post-${sourceId}`,
    sourceUrl: `https://old-site.test/post-${sourceId}/`,
    sourceModifiedAt: new Date(modified),
    status: 'published',
    publishedAt: new Date('2025-12-01T00:00:00Z'),
    bylineName: 'Invented Writer',
    featuredImageUrl: null,
    categorySourceIds: [5n],
    translation: { locale: 'th', title: 'หัวข้อ', excerpt: 'สรุป', bodyHtml: '<p>เนื้อหา</p>' },
    removedEmbeds,
  };
}

const CATEGORY: NewsCategorySnapshot = {
  sourceId: 5n,
  parentSourceId: null,
  slug: 'news',
  translation: { locale: 'th', name: 'News' },
  isListed: true,
  isExcluded: false,
};

const EXCLUDED: NewsCategorySnapshot = {
  sourceId: 7n,
  parentSourceId: null,
  slug: 'excluded',
  translation: { locale: 'th', name: 'Excluded' },
  isListed: false,
  isExcluded: true,
};

const UNLISTED: NewsCategorySnapshot = {
  sourceId: 1n,
  parentSourceId: null,
  slug: 'unlisted',
  translation: { locale: 'th', name: 'Unlisted' },
  isListed: false,
  isExcluded: false,
};

function setup(options: {
  categories?: () => Promise<NewsCategorySnapshot[]>;
  pages?: NewsArticlePage[];
  upsert?: NewsImportDeps['news']['upsertNewsArticle'];
  states?: Map<bigint, Date | null>;
  acquired?: boolean;
}) {
  const pages = options.pages ?? [];
  const source: NewsSource = {
    listCategories: options.categories ?? (async () => [CATEGORY]),
    listArticlesPage: vi.fn(async (page: number, _isUnchanged: (sourceId: bigint, modifiedAt: Date) => boolean) => {
      const found = pages[page - 1];
      if (found === undefined) throw new Error(`page ${page} was not expected`);
      return found;
    }),
  };
  const news: NewsImportDeps['news'] = {
    upsertNewsCategories: vi.fn(async (snapshots: readonly NewsCategorySnapshot[]) => snapshots.length),
    upsertNewsArticle: vi.fn(options.upsert ?? (async () => 'created' as const)),
    findArticleSourceStates: vi.fn(async () => options.states ?? new Map<bigint, Date | null>()),
    applyExcludedNewsCategories: vi.fn(async (_excluded: readonly bigint[]) => {}),
  };
  const deps: NewsImportDeps = {
    source,
    news,
    lock: async <T>(task: () => Promise<T>) =>
      options.acquired === false ? { acquired: false as const } : { acquired: true as const, value: await task() },
    logError: vi.fn(),
  };
  return { deps, source, news };
}

describe('runNewsImport', () => {
  it('imports categories first, then every page of posts', async () => {
    const { deps, news, source } = setup({
      pages: [
        { articles: [article(1n), article(2n, undefined, 2)], failures: [], skipped: 0, totalPages: 2 },
        { articles: [article(3n)], failures: [], skipped: 0, totalPages: 2 },
      ],
    });

    const summary = await runNewsImport(deps);

    expect(summary).toEqual({
      outcome: 'succeeded',
      categories: 1,
      created: 3,
      updated: 0,
      unchanged: 0,
      failed: 0,
      failedPosts: [],
      removedEmbeds: 2,
    });
    expect(news.upsertNewsCategories).toHaveBeenCalledWith([CATEGORY]);
    expect(source.listArticlesPage).toHaveBeenCalledTimes(2);
    expect(vi.mocked(news.upsertNewsCategories).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(source.listArticlesPage).mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('applies the excluded categories to stored articles before reading posts', async () => {
    const { deps, news, source } = setup({
      categories: async () => [CATEGORY, EXCLUDED, UNLISTED],
      pages: [{ articles: [], failures: [], skipped: 0, totalPages: 1 }],
    });

    await runNewsImport(deps);

    expect(news.applyExcludedNewsCategories).toHaveBeenCalledWith([7n]);
    const order = (fn: unknown) => vi.mocked(fn as () => unknown).mock.invocationCallOrder[0] ?? 0;
    expect(order(news.upsertNewsCategories)).toBeLessThan(order(news.applyExcludedNewsCategories));
    expect(order(news.applyExcludedNewsCategories)).toBeLessThan(order(source.listArticlesPage));
  });

  it('never links an excluded category, and hides an article whose categories are all excluded', async () => {
    const withCategories = (id: bigint, categorySourceIds: bigint[]) => ({ ...article(id), categorySourceIds });
    const { deps, news } = setup({
      categories: async () => [CATEGORY, EXCLUDED, UNLISTED],
      pages: [
        {
          articles: [
            withCategories(1n, [5n, 7n]),
            withCategories(2n, [7n]),
            withCategories(3n, [1n]),
            withCategories(4n, []),
          ],
          failures: [],
          skipped: 0,
          totalPages: 1,
        },
      ],
    });

    await runNewsImport(deps);

    const calls = vi.mocked(news.upsertNewsArticle).mock.calls.map(([snapshot, options]) => [
      snapshot.sourceId,
      snapshot.categorySourceIds,
      options,
    ]);
    expect(calls).toEqual([
      [1n, [5n], { hidden: false }],
      [2n, [], { hidden: true }],
      [3n, [1n], { hidden: false }],
      [4n, [], { hidden: false }],
    ]);
  });

  it('counts a failed post and continues', async () => {
    const { deps, news } = setup({
      pages: [
        {
          articles: [article(1n), article(2n), article(3n)],
          failures: [{ sourceId: 9n, reason: 'invalid_response' }],
          skipped: 0,
          totalPages: 1,
        },
      ],
      upsert: async (snapshot) => {
        if (snapshot.sourceId === 2n) throw new Error('save failed');
        return snapshot.sourceId === 3n ? 'updated' : 'created';
      },
    });

    const summary = await runNewsImport(deps);

    expect(summary).toMatchObject({
      outcome: 'succeeded',
      created: 1,
      updated: 1,
      failed: 2,
      failedPosts: [
        { sourceId: '9', reason: 'invalid_response' },
        { sourceId: '2', reason: 'save_failed' },
      ],
    });
    expect(news.upsertNewsArticle).toHaveBeenCalledTimes(3);
    expect(deps.logError).toHaveBeenCalledWith('news import: post 2 save_failed: Error');
  });

  it('counts an unchanged post without writing it', async () => {
    const { deps, news } = setup({
      pages: [
        {
          articles: [article(1n, '2026-01-01T00:00:00Z'), article(2n, '2026-02-02T00:00:00Z')],
          failures: [],
          skipped: 4,
          totalPages: 1,
        },
      ],
      states: new Map([
        [1n, new Date('2026-01-01T00:00:00Z')],
        [2n, new Date('2026-01-01T00:00:00Z')],
      ]),
      upsert: async () => 'updated',
    });

    const summary = await runNewsImport(deps);

    expect(summary).toMatchObject({ outcome: 'succeeded', created: 0, updated: 1, unchanged: 5 });
    expect(news.upsertNewsArticle).toHaveBeenCalledTimes(1);
  });

  it('tells the source which posts are unchanged, by source id and modified time', async () => {
    const { deps, source } = setup({
      pages: [{ articles: [], failures: [], skipped: 0, totalPages: 1 }],
      states: new Map([[1n, new Date('2026-01-01T00:00:00Z')]]),
    });

    await runNewsImport(deps);

    const isUnchanged = vi.mocked(source.listArticlesPage).mock.calls[0]?.[1];
    expect(isUnchanged?.(1n, new Date('2026-01-01T00:00:00Z'))).toBe(true);
    expect(isUnchanged?.(1n, new Date('2026-01-02T00:00:00Z'))).toBe(false);
    expect(isUnchanged?.(2n, new Date('2026-01-01T00:00:00Z'))).toBe(false);
  });

  it('fails the run when the category list cannot be read', async () => {
    const { deps, news, source } = setup({
      categories: async () => {
        throw new NewsSourceError('http_error', '/categories');
      },
    });

    const summary = await runNewsImport(deps);

    expect(summary).toEqual({
      outcome: 'failed',
      categories: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      failed: 0,
      failedPosts: [],
      removedEmbeds: 0,
      errorCode: 'http_error',
    });
    expect(deps.logError).toHaveBeenCalledWith('news import failed: NewsSourceError: News source failed: http_error — /categories');
    expect(news.upsertNewsCategories).not.toHaveBeenCalled();
    expect(source.listArticlesPage).not.toHaveBeenCalled();
  });

  it('fails the run on an unreadable page but keeps what it counted', async () => {
    const { deps } = setup({ pages: [{ articles: [article(1n)], failures: [], skipped: 0, totalPages: 3 }] });

    const summary = await runNewsImport(deps);

    expect(summary).toMatchObject({ outcome: 'failed', created: 1, errorCode: 'unexpected' });
    expect(deps.logError).toHaveBeenCalledWith('news import failed: Error');
  });

  it('logs an unexpected error by name and code, never its message', async () => {
    class PrismaClientKnownRequestError extends Error {
      readonly code = 'P2002';
      constructor(message: string) {
        super(message);
        this.name = 'PrismaClientKnownRequestError';
      }
    }
    const leak = 'Invalid invocation: { bodyHtml: "SECRET_BODY", sourceUrl: "https://old-site.test/SECRET_BODY" }';
    const { deps } = setup({
      pages: [{ articles: [article(1n)], failures: [], skipped: 0, totalPages: 1 }],
      upsert: async () => {
        throw new PrismaClientKnownRequestError(leak);
      },
    });
    deps.news.upsertNewsCategories = vi.fn(async () => {
      throw new TypeError(leak);
    });

    await runNewsImport(deps);
    deps.news.upsertNewsCategories = vi.fn(async () => 1);
    await runNewsImport(deps);

    const lines = vi.mocked(deps.logError).mock.calls.map(([line]) => line);
    expect(lines).toEqual([
      'news import failed: TypeError',
      'news import: post 1 save_failed: PrismaClientKnownRequestError P2002',
    ]);
    expect(lines.join('\n')).not.toContain('SECRET_BODY');
  });

  it('handles a source with no posts', async () => {
    const { deps } = setup({ pages: [{ articles: [], failures: [], skipped: 0, totalPages: 0 }] });

    expect(await runNewsImport(deps)).toMatchObject({ outcome: 'succeeded', created: 0 });
  });

  it('is skipped when another run holds the lock', async () => {
    const { deps, news } = setup({ acquired: false });

    expect(await runNewsImport(deps)).toEqual({ outcome: 'skipped' });
    expect(news.upsertNewsCategories).not.toHaveBeenCalled();
  });
});
