import { beforeEach, describe, expect, it } from 'vitest';

import type { WordPressClient } from '@/server/adapters/wordpress/client';
import { createWordPressNewsSource } from '@/server/adapters/wordpress/news-source';
import type { WpCategory, WpPost } from '@/server/adapters/wordpress/schemas';
import {
  findArticleSourceStates,
  upsertNewsArticle,
  upsertNewsCategories,
} from '@/server/repositories/news/news-repository';
import {
  CATALOGUE_SYNC_LOCK_KEY,
  NEWS_IMPORT_LOCK_KEY,
  tryWithAdvisoryLock,
} from '@/server/repositories/shared/advisory-lock';
import { getPrisma } from '@/server/repositories/shared/prisma';
import { runNewsImport, type NewsImportSummary } from '@/server/services/news/news-import-service';
import { resetDatabase } from '../setup/database';

beforeEach(async () => {
  await resetDatabase();
});

const prisma = () => getPrisma();

const bySourceId = (a: bigint | null, b: bigint | null): number => Number((a ?? 0n) - (b ?? 0n));

// Invented names only (hard rule 2).
const AUTHORS = new Map([[1, 'Invented Writer']]);

// Out of id order, and a child (3) whose parent (5) has a higher id and comes later in the list.
const CATEGORIES: WpCategory[] = [
  { id: 3, parent: 5, count: 1, slug: '%e0%b8%9a%e0%b8%97%e0%b8%84%e0%b8%a7%e0%b8%b2%e0%b8%a1', name: 'บทความ' },
  { id: 14, parent: 5, count: 1, slug: 'nintendo', name: 'NINTENDO' },
  { id: 5, parent: 0, count: 2, slug: 'news', name: 'News' },
  { id: 1, parent: 0, count: 0, slug: 'uncategorized', name: 'Uncategorized' },
];

function post(id: number, overrides: Partial<WpPost> = {}): WpPost {
  return {
    id,
    date_gmt: '2025-10-23T16:16:00',
    modified_gmt: '2025-10-24T01:00:00',
    slug: `post-${id}`,
    link: `https://old-site.test/post-${id}/`,
    title: { rendered: `ข่าว ${id}` },
    excerpt: { rendered: '<p>สรุป &amp; ย่อ</p>' },
    content: { rendered: '<p>เนื้อหา</p><script>x()</script>' },
    categories: [5],
    featured_media: 0,
    author: 1,
    ...overrides,
  };
}

function fakeClient(state: { posts: WpPost[]; perPage?: number }): WordPressClient {
  return {
    listCategories: async () => CATEGORIES,
    listPostsPage: async (page) => {
      const perPage = state.perPage ?? 100;
      const totalPages = Math.ceil(state.posts.length / perPage);
      return { posts: state.posts.slice((page - 1) * perPage, page * perPage), totalPages };
    },
    listAuthors: async () => AUTHORS,
    getMedia: async (id) => (id === 0 ? null : { sourceUrl: `https://old-site.test/media/${id}.jpg` }),
  };
}

function run(client: WordPressClient): Promise<NewsImportSummary> {
  return runNewsImport({
    source: createWordPressNewsSource(client),
    news: { upsertNewsCategories, upsertNewsArticle, findArticleSourceStates },
    lock: (task) => tryWithAdvisoryLock(NEWS_IMPORT_LOCK_KEY, task),
  });
}

describe('news import', () => {
  it('imports categories with parents and articles with links', async () => {
    const state = {
      perPage: 2,
      posts: [
        post(101, { categories: [5, 14], featured_media: 77 }),
        post(102, { categories: [3], author: 42 }),
        post(103, { categories: [] }),
      ],
    };

    const summary = await run(fakeClient(state));

    expect(summary).toEqual({
      outcome: 'succeeded',
      categories: 4,
      created: 3,
      updated: 0,
      unchanged: 0,
      failed: 0,
      removedEmbeds: 3,
    });

    const categories = await prisma().newsCategory.findMany({
      include: { translations: true, parent: true },
      orderBy: { position: 'asc' },
    });
    // Ruling R2: position follows the source id order.
    expect(categories.map((c) => [c.sourceId, c.position, c.parent?.sourceId ?? null])).toEqual([
      [1n, 1, null],
      [3n, 2, 5n],
      [5n, 3, null],
      [14n, 4, 5n],
    ]);
    expect(categories.find((c) => c.sourceId === 3n)?.slug).toBe('บทความ');
    expect(categories.find((c) => c.sourceId === 3n)?.translations).toEqual([
      expect.objectContaining({ locale: 'th', name: 'บทความ' }),
    ]);

    const first = await prisma().newsArticle.findUniqueOrThrow({
      where: { sourceId: 101n },
      include: { translations: true, categories: { include: { category: true } } },
    });
    expect(first).toMatchObject({
      slug: 'post-101',
      status: 'published',
      publishedAt: new Date('2025-10-23T16:16:00Z'),
      sourceModifiedAt: new Date('2025-10-24T01:00:00Z'),
      sourceUrl: 'https://old-site.test/post-101/',
      bylineName: 'Invented Writer',
      featuredImageUrl: 'https://old-site.test/media/77.jpg',
      authorStaffId: null,
      deletedAt: null,
    });
    expect(first.translations).toEqual([
      expect.objectContaining({ locale: 'th', title: 'ข่าว 101', excerpt: 'สรุป & ย่อ', bodyHtml: '<p>เนื้อหา</p>' }),
    ]);
    expect(first.categories.map((link) => link.category.sourceId).sort(bySourceId)).toEqual([5n, 14n]);

    const second = await prisma().newsArticle.findUniqueOrThrow({
      where: { sourceId: 102n },
      include: { categories: { include: { category: true } } },
    });
    expect(second.bylineName).toBeNull();
    expect(second.featuredImageUrl).toBeNull();
    expect(second.categories.map((link) => link.category.sourceId)).toEqual([3n]);

    const third = await prisma().newsArticle.findUniqueOrThrow({ where: { sourceId: 103n }, include: { categories: true } });
    expect(third.categories).toEqual([]);
  });

  it('is idempotent and updates only changed posts', async () => {
    const state = { posts: [post(101), post(102, { categories: [14] }), post(103)] };
    await run(fakeClient(state));
    const before = await prisma().newsArticle.findMany({ orderBy: { sourceId: 'asc' } });
    const categoriesBefore = await prisma().newsCategory.findMany({ orderBy: { sourceId: 'asc' } });

    const again = await run(fakeClient(state));

    expect(again).toMatchObject({ outcome: 'succeeded', created: 0, updated: 0, unchanged: 3, failed: 0 });
    const after = await prisma().newsArticle.findMany({ orderBy: { sourceId: 'asc' } });
    expect(after.map((a) => [a.id, a.updatedAt.getTime()])).toEqual(before.map((a) => [a.id, a.updatedAt.getTime()]));
    const categoriesAfter = await prisma().newsCategory.findMany({ orderBy: { sourceId: 'asc' } });
    expect(categoriesAfter.map((c) => [c.id, c.updatedAt.getTime()])).toEqual(
      categoriesBefore.map((c) => [c.id, c.updatedAt.getTime()]),
    );

    // Post 102 changed upstream: new title and categories. Post 103 is gone from the source.
    state.posts = [
      post(101),
      post(102, { modified_gmt: '2026-01-05T08:00:00', title: { rendered: 'แก้ไขแล้ว' }, categories: [3, 5] }),
    ];
    const third = await run(fakeClient(state));

    expect(third).toMatchObject({ outcome: 'succeeded', created: 0, updated: 1, unchanged: 1, failed: 0 });
    const changed = await prisma().newsArticle.findUniqueOrThrow({
      where: { sourceId: 102n },
      include: { translations: true, categories: { include: { category: true } } },
    });
    expect(changed.id).toBe(before[1]?.id);
    expect(changed.sourceModifiedAt).toEqual(new Date('2026-01-05T08:00:00Z'));
    expect(changed.translations.map((t) => t.title)).toEqual(['แก้ไขแล้ว']);
    expect(changed.categories.map((link) => link.category.sourceId).sort(bySourceId)).toEqual([3n, 5n]);

    // Nothing is ever deleted.
    expect(await prisma().newsArticle.count()).toBe(3);
    expect((await prisma().newsArticle.findUniqueOrThrow({ where: { sourceId: 103n } })).deletedAt).toBeNull();
  });

  it('makes a colliding decoded slug unique with the source id, the same way on every run', async () => {
    // Two different source slugs that decode to the same text.
    const state = {
      posts: [post(201, { slug: '%e0%b8%82%e0%b9%88%e0%b8%b2%e0%b8%a7' }), post(202, { slug: '%E0%B8%82%E0%B9%88%E0%B8%B2%E0%B8%A7' })],
    };

    await run(fakeClient(state));
    state.posts = state.posts.map((p) => ({ ...p, modified_gmt: '2026-02-01T00:00:00' }));
    const second = await run(fakeClient(state));

    expect(second).toMatchObject({ updated: 2, failed: 0 });
    const articles = await prisma().newsArticle.findMany({ orderBy: { sourceId: 'asc' } });
    expect(articles.map((a) => a.slug)).toEqual(['ข่าว', 'ข่าว-202']);
  });

  it('is skipped while another import holds the lock, and not blocked by the catalogue sync', async () => {
    const client = fakeClient({ posts: [post(101)] });

    const nested = await tryWithAdvisoryLock(NEWS_IMPORT_LOCK_KEY, () => run(client));
    expect(nested).toEqual({ acquired: true, value: { outcome: 'skipped' } });
    expect(await prisma().newsArticle.count()).toBe(0);

    const alongside = await tryWithAdvisoryLock(CATALOGUE_SYNC_LOCK_KEY, () => run(client));
    expect(alongside).toMatchObject({ acquired: true, value: { outcome: 'succeeded', created: 1 } });
  });
});
