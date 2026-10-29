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
    listArticlesPage: vi.fn(async (page: number) => {
      const found = pages[page - 1];
      if (found === undefined) throw new Error(`page ${page} was not expected`);
      return found;
    }),
  };
  const news: NewsImportDeps['news'] = {
    upsertNewsCategories: vi.fn(async (snapshots: readonly NewsCategorySnapshot[]) => snapshots.length),
    upsertNewsArticle: vi.fn(options.upsert ?? (async () => 'created' as const)),
    findArticleSourceStates: vi.fn(async () => options.states ?? new Map<bigint, Date | null>()),
  };
  const deps: NewsImportDeps = {
    source,
    news,
    lock: async <T>(task: () => Promise<T>) =>
      options.acquired === false ? { acquired: false as const } : { acquired: true as const, value: await task() },
  };
  return { deps, source, news };
}

describe('runNewsImport', () => {
  it('imports categories first, then every page of posts', async () => {
    const { deps, news, source } = setup({
      pages: [
        { articles: [article(1n), article(2n, undefined, 2)], failures: [], totalPages: 2 },
        { articles: [article(3n)], failures: [], totalPages: 2 },
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
      removedEmbeds: 2,
    });
    expect(news.upsertNewsCategories).toHaveBeenCalledWith([CATEGORY]);
    expect(source.listArticlesPage).toHaveBeenCalledTimes(2);
    expect(vi.mocked(news.upsertNewsCategories).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(source.listArticlesPage).mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('counts a failed post and continues', async () => {
    const { deps, news } = setup({
      pages: [
        {
          articles: [article(1n), article(2n), article(3n)],
          failures: [{ sourceId: 9n, reason: 'invalid_response' }],
          totalPages: 1,
        },
      ],
      upsert: async (snapshot) => {
        if (snapshot.sourceId === 2n) throw new Error('save failed');
        return snapshot.sourceId === 3n ? 'updated' : 'created';
      },
    });

    const summary = await runNewsImport(deps);

    expect(summary).toMatchObject({ outcome: 'succeeded', created: 1, updated: 1, failed: 2 });
    expect(news.upsertNewsArticle).toHaveBeenCalledTimes(3);
  });

  it('counts an unchanged post without writing it', async () => {
    const { deps, news } = setup({
      pages: [{ articles: [article(1n, '2026-01-01T00:00:00Z'), article(2n, '2026-02-02T00:00:00Z')], failures: [], totalPages: 1 }],
      states: new Map([
        [1n, new Date('2026-01-01T00:00:00Z')],
        [2n, new Date('2026-01-01T00:00:00Z')],
      ]),
      upsert: async () => 'updated',
    });

    const summary = await runNewsImport(deps);

    expect(summary).toMatchObject({ outcome: 'succeeded', created: 0, updated: 1, unchanged: 1 });
    expect(news.upsertNewsArticle).toHaveBeenCalledTimes(1);
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
      removedEmbeds: 0,
      errorCode: 'http_error',
    });
    expect(news.upsertNewsCategories).not.toHaveBeenCalled();
    expect(source.listArticlesPage).not.toHaveBeenCalled();
  });

  it('fails the run on an unreadable page but keeps what it counted', async () => {
    const { deps } = setup({ pages: [{ articles: [article(1n)], failures: [], totalPages: 3 }] });

    const summary = await runNewsImport(deps);

    expect(summary).toMatchObject({ outcome: 'failed', created: 1, errorCode: 'unexpected' });
  });

  it('handles a source with no posts', async () => {
    const { deps } = setup({ pages: [{ articles: [], failures: [], totalPages: 0 }] });

    expect(await runNewsImport(deps)).toMatchObject({ outcome: 'succeeded', created: 0 });
  });

  it('is skipped when another run holds the lock', async () => {
    const { deps, news } = setup({ acquired: false });

    expect(await runNewsImport(deps)).toEqual({ outcome: 'skipped' });
    expect(news.upsertNewsCategories).not.toHaveBeenCalled();
  });
});
