import { describe, expect, it, vi } from 'vitest';

import {
  getAdminArticle,
  listAdminArticles,
  restoreArticle,
  saveArticle,
  trashArticle,
  type AdminArticleFilter,
  type AdminArticleListRecord,
  type AdminArticleRecord,
  type ArticleInput,
  type NewsAdminDeps,
} from './news-admin-service';

const NOW = new Date('2026-11-14T10:00:00Z');
const EDITOR = '11111111-1111-4111-8111-111111111111';
const CATEGORY = '22222222-2222-4222-8222-222222222222';
const PRODUCT = '33333333-3333-4333-8333-333333333333';
const ARTICLE = '44444444-4444-4444-8444-444444444444';

function input(overrides: Partial<ArticleInput> = {}): ArticleInput {
  return {
    slug: null,
    th: { title: 'ข่าว เกม ใหม่', excerpt: 'สรุป', bodyHtml: '<p>เนื้อหา</p>' },
    en: null,
    categoryIds: [],
    tagNames: [],
    productIds: [],
    bylineName: 'Writer',
    ...overrides,
  };
}

function record(overrides: Partial<AdminArticleRecord> = {}): AdminArticleRecord {
  return {
    id: ARTICLE,
    slug: 'old-slug',
    status: 'draft',
    publishedAt: null,
    bylineName: 'Writer',
    featuredImageUrl: null,
    isImported: false,
    deletedAt: null,
    updatedAt: NOW,
    lastEditorName: null,
    th: { title: 'เก่า', excerpt: '', bodyHtml: '<p>x</p>' },
    en: null,
    categoryIds: [],
    tagNames: [],
    productIds: [],
    ...overrides,
  };
}

function setup(existing: AdminArticleRecord | null = null) {
  const news = {
    listAdminArticles: vi.fn(async (_filter: AdminArticleFilter): Promise<{ total: number; rows: AdminArticleListRecord[] }> => ({ total: 0, rows: [] })),
    findAdminArticle: vi.fn(async () => existing),
    findExistingCategoryIds: vi.fn(async (ids: readonly string[]) => [...ids]),
    findExistingProductIds: vi.fn(async (ids: readonly string[]) => [...ids]),
    findEditorFirstName: vi.fn(async () => 'Editor'),
    saveArticle: vi.fn(async (write: { id: string | null; slug: string | null }) => ({
      id: write.id ?? ARTICLE,
      slug: write.slug ?? 'kept',
    })),
    setArticleDeleted: vi.fn(async () => true),
  };
  const deps: NewsAdminDeps = { news, sanitize: vi.fn((html: string) => html), now: () => NOW };
  return { deps, news };
}

const save = (deps: NewsAdminDeps, over: Partial<Parameters<typeof saveArticle>[1]> = {}) =>
  saveArticle(deps, { id: null, editorId: EDITOR, input: input(), action: 'draft', publishAt: null, now: NOW, ...over });

function written(news: ReturnType<typeof setup>['news']) {
  return news.saveArticle.mock.calls[0]![0] as unknown as Record<string, any>;
}

describe('saveArticle: validation', () => {
  it('requires a Thai title and a Thai body', async () => {
    const { deps, news } = setup();
    const noTitle = await save(deps, { input: input({ th: { title: '  ', excerpt: '', bodyHtml: '<p>x</p>' } }) });
    const noBody = await save(deps, { input: input({ th: { title: 'a', excerpt: '', bodyHtml: ' ' } }) });

    expect(noTitle).toMatchObject({ ok: false, error: { code: 'news.invalid' } });
    expect(noBody).toMatchObject({ ok: false, error: { code: 'news.invalid' } });
    expect(news.saveArticle).not.toHaveBeenCalled();
  });

  it('takes English as a set: title and body both, or none', async () => {
    const { deps, news } = setup();
    const half = await save(deps, { input: input({ en: { title: 'Title', excerpt: '', bodyHtml: '' } }) });
    expect(half).toMatchObject({ ok: false, error: { code: 'news.invalid' } });

    const none = await save(deps, { input: input({ en: { title: '', excerpt: '', bodyHtml: '' } }) });
    expect(none.ok).toBe(true);
    expect(written(news).en).toBeNull();

    const both = await save(deps, { input: input({ en: { title: 'Title', excerpt: 'x', bodyHtml: '<p>en</p>' } }) });
    expect(both.ok).toBe(true);
    expect(news.saveArticle.mock.calls[1]![0]).toMatchObject({ en: { title: 'Title', bodyHtml: '<p>en</p>' } });
  });

  it('refuses category and product ids that are not uuids or do not exist, without a database error', async () => {
    const { deps, news } = setup();
    expect(await save(deps, { input: input({ categoryIds: ['nope'] }) })).toMatchObject({ ok: false, error: { code: 'news.invalid' } });
    expect(news.findExistingCategoryIds).not.toHaveBeenCalled();

    news.findExistingProductIds.mockResolvedValueOnce([]);
    expect(await save(deps, { input: input({ productIds: [PRODUCT] }) })).toMatchObject({ ok: false, error: { code: 'news.invalid' } });

    news.findExistingCategoryIds.mockResolvedValueOnce([]);
    expect(await save(deps, { input: input({ categoryIds: [CATEGORY] }) })).toMatchObject({ ok: false, error: { code: 'news.invalid' } });
    expect(news.saveArticle).not.toHaveBeenCalled();
  });

  it('treats an id that is not a uuid as not found, and a missing article as not found', async () => {
    const { deps, news } = setup();
    expect(await save(deps, { id: 'abc' })).toMatchObject({ ok: false, error: { code: 'news.not_found' } });
    expect(news.findAdminArticle).not.toHaveBeenCalled();

    expect(await save(deps, { id: ARTICLE })).toMatchObject({ ok: false, error: { code: 'news.not_found' } });
    expect(news.saveArticle).not.toHaveBeenCalled();
  });
});

describe('saveArticle: status', () => {
  it('draft saves status draft without a publish date on a new article', async () => {
    const { deps, news } = setup();
    await save(deps, { action: 'draft' });
    expect(written(news)).toMatchObject({ status: 'draft', publishedAt: null });
  });

  it('publish with no publishAt sets published and published_at to now', async () => {
    const { deps, news } = setup();
    await save(deps, { action: 'publish', publishAt: null });
    expect(written(news)).toMatchObject({ status: 'published', publishedAt: NOW });
  });

  it('publish with a future publishAt schedules it', async () => {
    const { deps, news } = setup();
    const later = new Date('2026-12-01T00:00:00Z');
    await save(deps, { action: 'publish', publishAt: later });
    expect(written(news)).toMatchObject({ status: 'published', publishedAt: later });
  });

  it('publish with a past publishAt publishes at now', async () => {
    const { deps, news } = setup();
    await save(deps, { action: 'publish', publishAt: new Date('2020-01-01T00:00:00Z') });
    expect(written(news)).toMatchObject({ status: 'published', publishedAt: NOW });
  });

  it('re-publishing an article already live keeps its publish date', async () => {
    const live = new Date('2026-01-01T00:00:00Z');
    const { deps, news } = setup(record({ status: 'published', publishedAt: live }));
    await save(deps, { id: ARTICLE, action: 'publish', publishAt: null });
    expect(written(news)).toMatchObject({ status: 'published', publishedAt: live });
  });

  it('unpublish sets draft and keeps published_at', async () => {
    const live = new Date('2026-01-01T00:00:00Z');
    const { deps, news } = setup(record({ status: 'published', publishedAt: live }));
    await save(deps, { id: ARTICLE, action: 'unpublish' });
    expect(written(news)).toMatchObject({ status: 'draft', publishedAt: live });
  });
});

describe('saveArticle: slug', () => {
  it('makes the slug from the Thai title on first save: lower-cased, spaces to hyphens, Thai kept', async () => {
    const { deps, news } = setup();
    await save(deps, { input: input({ th: { title: 'PS5  ข่าว เกม ใหม่', excerpt: '', bodyHtml: '<p>x</p>' } }) });
    expect(written(news).slug).toBe('ps5-ข่าว-เกม-ใหม่');
  });

  it('decodes a percent-encoded title and drops characters that cannot be in a path', async () => {
    const { deps, news } = setup();
    await save(deps, { input: input({ slug: '%E0%B8%82%E0%B9%88%E0%B8%B2%E0%B8%A7/Sale? #1' }) });
    expect(written(news).slug).toBe('ข่าว-sale-1');
  });

  it('normalises a provided slug the same way', async () => {
    const { deps, news } = setup();
    await save(deps, { input: input({ slug: '  My  Slug ' }) });
    expect(written(news).slug).toBe('my-slug');
  });

  it('leaves the slug to the stored one when editing with none given', async () => {
    const { deps, news } = setup(record());
    await save(deps, { id: ARTICLE, input: input({ slug: null }) });
    expect(written(news).slug).toBeNull();
  });
});

describe('saveArticle: bodies, tags, byline, staff', () => {
  it('passes every body through the injected sanitiser', async () => {
    const { deps, news } = setup();
    vi.mocked(deps.sanitize).mockImplementation((html) => `[s]${html}`);
    await save(deps, { input: input({ en: { title: 'T', excerpt: '', bodyHtml: '<p>en</p>' } }) });
    expect(written(news).th.bodyHtml).toBe('[s]<p>เนื้อหา</p>');
    expect(written(news).en.bodyHtml).toBe('[s]<p>en</p>');
  });

  it('a body with a script is sanitised before it is stored', async () => {
    const { deps, news } = setup();
    vi.mocked(deps.sanitize).mockImplementation((html) => html.replace(/<script>.*?<\/script>/g, ''));
    await save(deps, { input: input({ th: { title: 'a', excerpt: '', bodyHtml: '<p>ok</p><script>steal()</script>' } }) });
    expect(written(news).th.bodyHtml).toBe('<p>ok</p>');
  });

  it('an <img> in an imported body survives a save', async () => {
    const imported = '<p>x</p><img src="https://old-site.test/media/1.jpg" alt="a">';
    const { deps, news } = setup(record({ isImported: true, th: { title: 'a', excerpt: '', bodyHtml: imported } }));
    // The real sanitiser keeps absolute http/https images; the composition root wires it in.
    const { sanitizeArticleHtml } = await import('@/server/adapters/wordpress/sanitize');
    const real: NewsAdminDeps = { ...deps, sanitize: (html) => sanitizeArticleHtml(html).html };
    await save(real, { id: ARTICLE, input: input({ th: { title: 'a', excerpt: '', bodyHtml: imported } }) });
    expect(written(news).th.bodyHtml).toContain('<img src="https://old-site.test/media/1.jpg"');
  });

  it('normalises tags: trims, collapses all whitespace, dedupes case-insensitively, drops empties', async () => {
    const { deps, news } = setup();
    await save(deps, { input: input({ tagNames: ['  PS5 ', 'ps5', 'New\t\n  Games', 'new games', ' ', 'Xbox'] }) });
    expect(written(news).tagNames).toEqual(['PS5', 'New Games', 'Xbox']);
  });

  it('puts no limit on tags or products', async () => {
    const { deps, news } = setup();
    const tags = Array.from({ length: 60 }, (_, i) => `tag${i}`);
    const products = Array.from({ length: 30 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
    const result = await save(deps, { input: input({ tagNames: tags, productIds: products }) });
    expect(result.ok).toBe(true);
    expect(written(news).tagNames).toHaveLength(60);
    expect(written(news).productIds).toHaveLength(30);
  });

  it('an empty byline becomes the editor\'s first name', async () => {
    const { deps, news } = setup();
    await save(deps, { input: input({ bylineName: '   ' }) });
    expect(written(news).bylineName).toBe('Editor');
    expect(news.findEditorFirstName).toHaveBeenCalledWith(EDITOR);
  });

  it('records the editor on the write, and returns the id and slug', async () => {
    const { deps, news } = setup();
    const result = await save(deps);
    expect(written(news)).toMatchObject({ id: null, editorId: EDITOR });
    expect(result).toEqual({ ok: true, data: { id: ARTICLE, slug: 'ข่าว-เกม-ใหม่' } });
  });
});

describe('reads, trash and restore', () => {
  it('derives scheduled from a future published_at, and passes the filter and page', async () => {
    const { deps, news } = setup();
    news.listAdminArticles.mockResolvedValueOnce({
      total: 3,
      rows: [
        { id: 'a', slug: 'a', status: 'published', publishedAt: new Date('2026-12-01T00:00:00Z'), titles: { th: 'A' }, categoryIds: [], bylineName: null, lastEditorName: null, updatedAt: NOW, deletedAt: null, isImported: false },
        { id: 'b', slug: 'b', status: 'published', publishedAt: new Date('2026-01-01T00:00:00Z'), titles: { th: 'B', en: 'B' }, categoryIds: [], bylineName: null, lastEditorName: null, updatedAt: NOW, deletedAt: null, isImported: true },
        { id: 'c', slug: 'c', status: 'draft', publishedAt: null, titles: { th: 'C' }, categoryIds: [], bylineName: null, lastEditorName: null, updatedAt: NOW, deletedAt: null, isImported: false },
      ],
    });
    const page = await listAdminArticles(deps, { query: ' ข่าว ', status: 'scheduled', categoryId: null, page: 3 });

    expect(page.total).toBe(3);
    expect(page.rows.map((row) => row.status)).toEqual(['scheduled', 'published', 'draft']);
    expect(news.listAdminArticles).toHaveBeenCalledWith({ query: 'ข่าว', status: 'scheduled', categoryId: null, now: NOW, skip: 40, take: 20 });
  });

  it('gets an article by id, null for a non-uuid or a missing one', async () => {
    const { deps, news } = setup(record());
    expect(await getAdminArticle(deps, 'abc')).toBeNull();
    expect(news.findAdminArticle).not.toHaveBeenCalled();
    expect(await getAdminArticle(deps, ARTICLE)).toMatchObject({ id: ARTICLE, status: 'draft' });
  });

  it('trash and restore set and clear deleted_at, and refuse a non-uuid or missing id', async () => {
    const { deps, news } = setup();
    expect(await trashArticle(deps, ARTICLE, EDITOR)).toEqual({ ok: true, data: { id: ARTICLE } });
    expect(news.setArticleDeleted).toHaveBeenLastCalledWith(ARTICLE, EDITOR, NOW);
    expect(await restoreArticle(deps, ARTICLE, EDITOR)).toEqual({ ok: true, data: { id: ARTICLE } });
    expect(news.setArticleDeleted).toHaveBeenLastCalledWith(ARTICLE, EDITOR, null);

    expect(await trashArticle(deps, 'abc', EDITOR)).toMatchObject({ ok: false, error: { code: 'news.not_found' } });
    news.setArticleDeleted.mockResolvedValueOnce(false);
    expect(await restoreArticle(deps, ARTICLE, EDITOR)).toMatchObject({ ok: false, error: { code: 'news.not_found' } });
  });
});
