import { beforeEach, describe, expect, it } from 'vitest';

import type { WordPressClient } from '@/server/adapters/wordpress/client';
import { createWordPressNewsSource } from '@/server/adapters/wordpress/news-source';
import type { WpCategory, WpPost } from '@/server/adapters/wordpress/schemas';
import {
  applyExcludedNewsCategories,
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
import { getNewsReader } from '@/server/composition-root';
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

function fakeClient(state: {
  posts: WpPost[];
  perPage?: number;
  categories?: WpCategory[];
  mediaReads?: number[];
}): WordPressClient {
  return {
    listCategories: async () => state.categories ?? CATEGORIES,
    listPostsPage: async (page) => {
      const perPage = state.perPage ?? 100;
      const totalPages = Math.ceil(state.posts.length / perPage);
      return { posts: state.posts.slice((page - 1) * perPage, page * perPage), totalPages };
    },
    listAuthors: async () => AUTHORS,
    getMedia: async (id) => {
      state.mediaReads?.push(id);
      return id === 0 ? null : { sourceUrl: `https://old-site.test/media/${id}.jpg` };
    },
  };
}

function run(client: WordPressClient): Promise<NewsImportSummary> {
  return runNewsImport({
    source: createWordPressNewsSource(client),
    news: { upsertNewsCategories, upsertNewsArticle, findArticleSourceStates, applyExcludedNewsCategories },
    lock: (task) => tryWithAdvisoryLock(NEWS_IMPORT_LOCK_KEY, task),
    logError: () => {},
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
      failedPosts: [],
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
    const state = {
      posts: [post(101, { featured_media: 77 }), post(102, { categories: [14], featured_media: 78 }), post(103)],
      mediaReads: [] as number[],
    };
    await run(fakeClient(state));
    expect(state.mediaReads).toEqual([77, 78]);
    state.mediaReads = [];
    const before = await prisma().newsArticle.findMany({ orderBy: { sourceId: 'asc' } });
    const categoriesBefore = await prisma().newsCategory.findMany({ orderBy: { sourceId: 'asc' } });

    const again = await run(fakeClient(state));

    expect(again).toMatchObject({ outcome: 'succeeded', created: 0, updated: 0, unchanged: 3, failed: 0, removedEmbeds: 0 });
    // Unchanged posts are neither mapped nor have their images read again.
    expect(state.mediaReads).toEqual([]);
    const after = await prisma().newsArticle.findMany({ orderBy: { sourceId: 'asc' } });
    expect(after.map((a) => [a.id, a.updatedAt.getTime()])).toEqual(before.map((a) => [a.id, a.updatedAt.getTime()]));
    const categoriesAfter = await prisma().newsCategory.findMany({ orderBy: { sourceId: 'asc' } });
    expect(categoriesAfter.map((c) => [c.id, c.updatedAt.getTime()])).toEqual(
      categoriesBefore.map((c) => [c.id, c.updatedAt.getTime()]),
    );

    // Post 102 changed upstream: new title and categories. Post 103 is gone from the source.
    state.posts = [
      post(101, { featured_media: 77 }),
      post(102, { modified_gmt: '2026-01-05T08:00:00', title: { rendered: 'แก้ไขแล้ว' }, categories: [3, 5] }),
    ];
    const third = await run(fakeClient(state));

    expect(third).toMatchObject({ outcome: 'succeeded', created: 0, updated: 1, unchanged: 1, failed: 0, removedEmbeds: 1 });
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

  it('never stores a category parent cycle, on the first run or a later one', async () => {
    const cycle: WpCategory[] = [
      { id: 61, parent: 62, count: 0, slug: 'cycle-a', name: 'A' },
      { id: 62, parent: 61, count: 0, slug: 'cycle-b', name: 'B' },
    ];
    const state = { posts: [], categories: cycle };

    const parents = async () =>
      (await prisma().newsCategory.findMany({ orderBy: { sourceId: 'asc' }, include: { parent: true } })).map(
        (c) => [c.sourceId, c.parent?.sourceId ?? null],
      );

    expect(await run(fakeClient(state))).toMatchObject({ outcome: 'succeeded', categories: 2 });
    const first = await parents();
    expect(first).toEqual([
      [61n, 62n],
      [62n, null],
    ]);

    expect(await run(fakeClient(state))).toMatchObject({ outcome: 'succeeded' });
    expect(await parents()).toEqual(first);
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

// The old site's review tree and Uncategorized, as the dev database held them after the first import.
const SITE_CATEGORIES: WpCategory[] = [
  { id: 1, parent: 0, count: 1, slug: 'uncategorized', name: 'Uncategorized' },
  { id: 5, parent: 0, count: 2, slug: 'news', name: 'News' },
  { id: 7, parent: 0, count: 3, slug: 'reviews', name: 'Reviews' },
  { id: 15, parent: 7, count: 1, slug: 'nintendo-reviews', name: 'Nintendo' },
  { id: 17, parent: 7, count: 1, slug: 'ps5', name: 'PS5' },
];

const MODIFIED = '2025-10-24T01:00:00';

/** The "before" state: every category listed and every source category linked, nothing deleted. */
async function seedFirstImport(posts: { id: number; categories: number[] }[]): Promise<void> {
  const ids = new Map<number, string>();
  for (const [index, c] of SITE_CATEGORIES.entries()) {
    const row = await prisma().newsCategory.create({
      data: {
        slug: c.slug,
        position: index + 1,
        sourceId: BigInt(c.id),
        parentId: c.parent === 0 ? null : (ids.get(c.parent) ?? null),
        translations: { create: { locale: 'th', name: c.name } },
      },
      select: { id: true },
    });
    ids.set(c.id, row.id);
  }
  for (const p of posts) {
    await prisma().newsArticle.create({
      data: {
        slug: `post-${p.id}`,
        sourceId: BigInt(p.id),
        sourceUrl: `https://old-site.test/post-${p.id}/`,
        sourceModifiedAt: new Date(`${MODIFIED}Z`),
        status: 'published',
        publishedAt: new Date(Date.UTC(2025, 9, 1, 0, p.id - 300)),
        translations: { create: { locale: 'th', title: `ข่าว ${p.id}` } },
        categories: { create: p.categories.map((id) => ({ categoryId: ids.get(id) as string })) },
      },
    });
  }
}

async function linkedSourceIds(sourceId: bigint): Promise<bigint[]> {
  const row = await prisma().newsArticle.findUniqueOrThrow({
    where: { sourceId },
    include: { categories: { include: { category: true } } },
  });
  return row.categories.map((link) => link.category.sourceId as bigint).sort(bySourceId);
}

describe('news import: excluded and unlisted categories (Q-048, 2026-10-29)', () => {
  const SITE_POSTS = [
    { id: 301, categories: [5, 7] },
    { id: 302, categories: [7] },
    { id: 303, categories: [15, 7] },
    { id: 304, categories: [17] },
    { id: 305, categories: [1] },
    { id: 306, categories: [5] },
  ];
  const sitePosts = () => SITE_POSTS.map((p) => post(p.id, { categories: p.categories, modified_gmt: MODIFIED }));

  it('fixes a database imported before the rule, without re-reading unchanged posts', async () => {
    await seedFirstImport(SITE_POSTS);
    const state = { posts: sitePosts(), categories: SITE_CATEGORIES, mediaReads: [] as number[] };

    const summary = await run(fakeClient(state));

    expect(summary).toMatchObject({ outcome: 'succeeded', categories: 5, created: 0, updated: 0, unchanged: 6, failed: 0 });

    // No category row is deleted; the review tree and Uncategorized are unlisted.
    const categories = await prisma().newsCategory.findMany({ orderBy: { sourceId: 'asc' } });
    expect(categories.map((c) => [c.sourceId, c.isListed])).toEqual([
      [1n, false],
      [5n, true],
      [7n, false],
      [15n, false],
      [17n, false],
    ]);

    // Every link to the review tree is gone; Uncategorized's link is kept.
    expect(await linkedSourceIds(301n)).toEqual([5n]);
    expect(await linkedSourceIds(302n)).toEqual([]);
    expect(await linkedSourceIds(303n)).toEqual([]);
    expect(await linkedSourceIds(304n)).toEqual([]);
    expect(await linkedSourceIds(305n)).toEqual([1n]);

    // The review-only articles are soft-deleted, the rest stay live; no article row is deleted.
    const articles = await prisma().newsArticle.findMany({ orderBy: { sourceId: 'asc' } });
    expect(articles.map((a) => [a.sourceId, a.deletedAt !== null])).toEqual([
      [301n, false],
      [302n, true],
      [303n, true],
      [304n, true],
      [305n, false],
      [306n, false],
    ]);

    // ทั้งหมด lists the News and the Uncategorized articles; there is no tab for Uncategorized or Reviews.
    const all = await getNewsReader()({ locale: 'th', page: 1 });
    expect(all?.items.map((item) => item.slug).sort()).toEqual(['post-301', 'post-305', 'post-306']);
    expect(all?.categories).toEqual([{ slug: 'news', name: 'News', count: 2 }]);
    expect(all?.items.find((item) => item.slug === 'post-305')?.categoryName).toBeNull();
    for (const slug of ['reviews', 'nintendo-reviews', 'ps5', 'uncategorized']) {
      expect(await getNewsReader()({ locale: 'th', categorySlug: slug, page: 1 })).toBeNull();
    }

    // A second run changes nothing.
    const before = await prisma().newsArticle.findMany({ orderBy: { sourceId: 'asc' } });
    expect(await run(fakeClient(state))).toMatchObject({ outcome: 'succeeded', created: 0, updated: 0, unchanged: 6 });
    const after = await prisma().newsArticle.findMany({ orderBy: { sourceId: 'asc' } });
    expect(after.map((a) => [a.id, a.updatedAt.getTime(), a.deletedAt?.getTime()])).toEqual(
      before.map((a) => [a.id, a.updatedAt.getTime(), a.deletedAt?.getTime()]),
    );
    expect(state.mediaReads).toEqual([]);
  });

  it('applies the rule to new and changed posts, and restores one that gains a news category', async () => {
    const state = {
      categories: SITE_CATEGORIES,
      posts: [post(401, { categories: [5, 15] }), post(402, { categories: [17] }), post(403, { categories: [1] })],
    };

    await run(fakeClient(state));

    expect(await linkedSourceIds(401n)).toEqual([5n]);
    expect(await linkedSourceIds(402n)).toEqual([]);
    expect(await linkedSourceIds(403n)).toEqual([1n]);
    const deleted = async (id: bigint) =>
      (await prisma().newsArticle.findUniqueOrThrow({ where: { sourceId: id } })).deletedAt;
    expect(await deleted(401n)).toBeNull();
    const hiddenAt = await deleted(402n);
    expect(hiddenAt).not.toBeNull();
    expect(await deleted(403n)).toBeNull();

    // 402 changes but is still review-only: its deleted_at is kept as it was.
    state.posts = [post(402, { categories: [7, 17], modified_gmt: '2026-01-01T00:00:00' })];
    expect(await run(fakeClient(state))).toMatchObject({ updated: 1 });
    expect(await deleted(402n)).toEqual(hiddenAt);

    // 402 gains News on the source: it is news again. 401 loses News: it is hidden.
    state.posts = [
      post(401, { categories: [15], modified_gmt: '2026-02-01T00:00:00' }),
      post(402, { categories: [7, 5], modified_gmt: '2026-02-01T00:00:00' }),
    ];
    expect(await run(fakeClient(state))).toMatchObject({ updated: 2 });
    expect(await deleted(402n)).toBeNull();
    expect(await linkedSourceIds(402n)).toEqual([5n]);
    expect(await deleted(401n)).not.toBeNull();
    expect(await linkedSourceIds(401n)).toEqual([]);
  });

  it('is a no-op when the source has no excluded category', async () => {
    const noExcluded = SITE_CATEGORIES.filter((c) => c.id !== 7 && c.parent !== 7);
    await seedFirstImport([]);
    const news = await prisma().newsCategory.findUniqueOrThrow({ where: { sourceId: 5n } });
    const reviews = await prisma().newsCategory.findUniqueOrThrow({ where: { sourceId: 7n } });
    const otherwiseDeleted = new Date('2026-03-01T00:00:00Z');
    for (const [id, categoryId] of [
      [501n, news.id],
      [502n, reviews.id],
    ] as const) {
      await prisma().newsArticle.create({
        data: {
          slug: `post-${id}`,
          sourceId: id,
          sourceModifiedAt: new Date(`${MODIFIED}Z`),
          status: 'published',
          publishedAt: new Date('2026-01-01T00:00:00Z'),
          deletedAt: otherwiseDeleted,
          translations: { create: { locale: 'th', title: `ข่าว ${id}` } },
          categories: { create: [{ categoryId }] },
        },
      });
    }
    const links = await prisma().newsArticleCategory.count();

    await run(
      fakeClient({ posts: [post(501, { modified_gmt: MODIFIED }), post(502, { categories: [7], modified_gmt: MODIFIED })], categories: noExcluded }),
    );

    expect(await prisma().newsArticleCategory.count()).toBe(links);
    for (const id of [501n, 502n]) {
      expect((await prisma().newsArticle.findUniqueOrThrow({ where: { sourceId: id } })).deletedAt).toEqual(otherwiseDeleted);
    }
  });

  it('never un-deletes an imported article soft-deleted for another reason', async () => {
    await seedFirstImport([{ id: 601, categories: [5, 7] }]);
    const otherwiseDeleted = new Date('2026-03-01T00:00:00Z');
    await prisma().newsArticle.update({ where: { sourceId: 601n }, data: { deletedAt: otherwiseDeleted } });

    await run(fakeClient({ posts: [post(601, { categories: [5, 7], modified_gmt: MODIFIED })], categories: SITE_CATEGORIES }));

    const row = await prisma().newsArticle.findUniqueOrThrow({ where: { sourceId: 601n } });
    expect(row.deletedAt).toEqual(otherwiseDeleted);
    expect(await linkedSourceIds(601n)).toEqual([5n]);
  });

  it('never touches deleted_at of an article that was not imported', async () => {
    await seedFirstImport([]);
    const reviews = await prisma().newsCategory.findUniqueOrThrow({ where: { sourceId: 7n } });
    const staffDeleted = new Date('2026-03-01T00:00:00Z');
    await prisma().newsArticle.create({
      data: {
        slug: 'staff-written',
        status: 'published',
        publishedAt: new Date('2026-01-01T00:00:00Z'),
        translations: { create: { locale: 'th', title: 'ข่าวของร้าน' } },
        categories: { create: [{ categoryId: reviews.id }] },
      },
    });
    await prisma().newsArticle.create({
      data: {
        slug: 'staff-deleted',
        status: 'published',
        publishedAt: new Date('2026-01-01T00:00:00Z'),
        deletedAt: staffDeleted,
        translations: { create: { locale: 'th', title: 'ข่าวที่ลบ' } },
        categories: { create: [{ categoryId: (await prisma().newsCategory.findUniqueOrThrow({ where: { sourceId: 5n } })).id }] },
      },
    });

    await run(fakeClient({ posts: [], categories: SITE_CATEGORIES }));

    expect((await prisma().newsArticle.findUniqueOrThrow({ where: { slug: 'staff-written' } })).deletedAt).toBeNull();
    expect((await prisma().newsArticle.findUniqueOrThrow({ where: { slug: 'staff-deleted' } })).deletedAt).toEqual(
      staffDeleted,
    );
  });
});
