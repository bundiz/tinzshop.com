import { describe, expect, it, vi } from 'vitest';

import { sanitizeArticleHtml } from '@/server/adapters/wordpress/sanitize';

import {
  buildArticlePreview,
  createNewsCategory,
  getAdminArticle,
  listAdminArticles,
  parseFeaturedImage,
  restoreArticle,
  saveArticle,
  trashArticle,
  type AdminArticleFilter,
  type AdminArticleListRecord,
  type AdminArticleRecord,
  type ArticleInput,
  type ArticlePreviewDeps,
  type ArticlePreviewDraft,
  type NewsCategoryWrite,
  type NewsAdminDeps,
} from './news-admin-service';

const NOW = new Date('2026-11-14T10:00:00Z');
const EDITOR = '11111111-1111-4111-8111-111111111111';
const CATEGORY = '22222222-2222-4222-8222-222222222222';
const PRODUCT = '33333333-3333-4333-8333-333333333333';
const ARTICLE = '44444444-4444-4444-8444-444444444444';
const MEDIA_BASE = 'https://media.example.com';
const KEY = 'news/2026/11/0f8fad5b-d9cb-469f-a165-70867728950e.jpg';

function input(overrides: Partial<ArticleInput> = {}): ArticleInput {
  return {
    slug: null,
    th: { title: 'ข่าว เกม ใหม่', excerpt: 'สรุป', bodyHtml: '<p>เนื้อหา</p>' },
    en: null,
    categoryIds: [CATEGORY],
    tagNames: [],
    productIds: [],
    bylineName: 'Writer',
    featuredImage: { kind: 'unchanged' },
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
    featuredImageKey: null,
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
    findListedCategoryIds: vi.fn(async (ids: readonly string[]) => [...ids]),
    findExistingProductIds: vi.fn(async (ids: readonly string[]) => [...ids]),
    findEditorFirstName: vi.fn(async () => 'Editor'),
    saveArticle: vi.fn(async (write: { id: string | null; slug: string | null }) => ({
      id: write.id ?? ARTICLE,
      slug: write.slug ?? 'kept',
    })),
    setArticleDeleted: vi.fn(async () => true),
    createNewsCategory: vi.fn(async (write: NewsCategoryWrite) => ({
      status: 'created' as const,
      category: { id: CATEGORY, slug: write.slug, isListed: true, names: { th: write.th, ...(write.en === null ? {} : { en: write.en }) } },
    })),
  };
  const deps: NewsAdminDeps = { news, sanitize: vi.fn((html: string) => html), now: () => NOW, mediaBaseUrl: MEDIA_BASE };
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

  it('re-publishing an article already live (publishAt null) keeps its publish date', async () => {
    const live = new Date('2026-01-01T00:00:00Z');
    const { deps, news } = setup(record({ status: 'published', publishedAt: live }));
    await save(deps, { id: ARTICLE, action: 'publish', publishAt: null });
    expect(written(news)).toMatchObject({ status: 'published', publishedAt: live });
  });

  it('publish on a scheduled article with no publishAt publishes now', async () => {
    const { deps, news } = setup(record({ status: 'published', publishedAt: new Date('2026-12-01T00:00:00Z') }));
    await save(deps, { id: ARTICLE, action: 'publish', publishAt: null });
    expect(written(news)).toMatchObject({ status: 'published', publishedAt: NOW });
  });

  it('publish on a live article with a past publishAt keeps its date (an update)', async () => {
    const live = new Date('2026-01-01T00:00:00Z');
    const { deps, news } = setup(record({ status: 'published', publishedAt: live }));
    await save(deps, { id: ARTICLE, action: 'publish', publishAt: new Date('2026-05-05T00:00:00Z') });
    expect(written(news)).toMatchObject({ status: 'published', publishedAt: live });
  });

  it('publish on a live article with a future publishAt schedules it', async () => {
    const later = new Date('2027-01-01T00:00:00Z');
    const { deps, news } = setup(record({ status: 'published', publishedAt: new Date('2026-01-01T00:00:00Z') }));
    await save(deps, { id: ARTICLE, action: 'publish', publishAt: later });
    expect(written(news)).toMatchObject({ publishedAt: later });
  });

  it('draft on a published article makes it a draft and keeps published_at', async () => {
    const live = new Date('2026-01-01T00:00:00Z');
    const { deps, news } = setup(record({ status: 'published', publishedAt: live }));
    await save(deps, { id: ARTICLE, action: 'draft' });
    expect(written(news)).toMatchObject({ status: 'draft', publishedAt: live });
  });

  it('unpublish sets draft and keeps published_at', async () => {
    const live = new Date('2026-01-01T00:00:00Z');
    const { deps, news } = setup(record({ status: 'published', publishedAt: live }));
    await save(deps, { id: ARTICLE, action: 'unpublish' });
    expect(written(news)).toMatchObject({ status: 'draft', publishedAt: live });
  });
});

describe('saveArticle: required fields (R9)', () => {
  const thWith = (over: Partial<ArticleInput['th']>) => input({ th: { title: 'a', excerpt: 'e', bodyHtml: '<p>b</p>', ...over } });
  const fieldOf = (result: Awaited<ReturnType<typeof save>>) =>
    result.ok ? null : (result.error.details as { field: string }).field;

  it('a draft needs only the Thai title and a body with content', async () => {
    const { deps, news } = setup();
    expect((await save(deps, { input: input({ th: { title: 'a', excerpt: '', bodyHtml: '<p>b</p>' }, categoryIds: [] }) })).ok).toBe(true);
    expect(news.saveArticle).toHaveBeenCalledTimes(1);
  });

  it('a body that sanitises to nothing is empty, on a draft too', async () => {
    const { deps, news } = setup();
    vi.mocked(deps.sanitize).mockImplementation((html) => html.replace(/<script>.*?<\/script>/g, ''));
    expect(fieldOf(await save(deps, { input: thWith({ bodyHtml: '<script>x()</script>' }) }))).toBe('th.bodyHtml');
    expect(fieldOf(await save(deps, { input: thWith({ bodyHtml: '<p> </p>' }) }))).toBe('th.bodyHtml');
    expect(news.saveArticle).not.toHaveBeenCalled();
  });

  it('publish needs a Thai excerpt', async () => {
    const { deps, news } = setup();
    expect(fieldOf(await save(deps, { action: 'publish', input: thWith({ excerpt: '  ' }) }))).toBe('th.excerpt');
    expect(news.saveArticle).not.toHaveBeenCalled();
  });

  it('publish needs at least one category', async () => {
    const { deps, news } = setup();
    expect(fieldOf(await save(deps, { action: 'publish', input: input({ categoryIds: [] }) }))).toBe('categoryIds');
    expect(news.saveArticle).not.toHaveBeenCalled();
  });

  it('publish refuses a newly linked category that is not listed, but keeps one already linked', async () => {
    const { deps, news } = setup(record({ categoryIds: [CATEGORY] }));
    news.findListedCategoryIds.mockImplementation(async () => []);
    // Already linked (an imported article's unlisted category): allowed to stay.
    expect((await save(deps, { id: ARTICLE, action: 'publish' })).ok).toBe(true);
    expect(news.findListedCategoryIds).not.toHaveBeenCalled();

    const other = '55555555-5555-4555-8555-555555555555';
    const refused = await save(deps, { id: ARTICLE, action: 'publish', input: input({ categoryIds: [CATEGORY, other] }) });
    expect(fieldOf(refused)).toBe('categoryIds');
    expect(news.findListedCategoryIds).toHaveBeenCalledWith([other]);
  });

  it('a draft may link an unlisted category', async () => {
    const { deps, news } = setup();
    news.findListedCategoryIds.mockImplementation(async () => []);
    expect((await save(deps, { action: 'draft' })).ok).toBe(true);
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

  it('caps the slug at 300 characters, so it can never outgrow the unique index, and keeps no trailing hyphen', async () => {
    const { deps, news } = setup();
    await save(deps, { input: input({ th: { title: `${'ก'.repeat(299)} ${'ข'.repeat(50)}`, excerpt: '', bodyHtml: '<p>x</p>' } }) });
    expect(written(news).slug).toBe('ก'.repeat(299));
    const second = setup();
    await save(second.deps, { input: input({ slug: 'a'.repeat(1000) }) });
    expect([...(written(second.news).slug ?? '')]).toHaveLength(300);
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

describe('saveArticle: the cover image (plan 017, D-277, D-278)', () => {
  it.each([
    [{ kind: 'unchanged' } as const],
    [{ kind: 'none' } as const],
    [{ kind: 'media', key: KEY } as const],
  ])('passes %o to the write', async (featuredImage) => {
    const { deps, news } = setup();
    expect((await save(deps, { input: input({ featuredImage }) })).ok).toBe(true);
    expect(written(news).featuredImage).toEqual(featuredImage);
  });

  it.each([
    '../secret.txt',
    'news/2026/11/0F8FAD5B-D9CB-469F-A165-70867728950E.jpg',
    `${KEY}?x=1`,
    `https://media.example.com/${KEY}`,
    'private/2026/11/0f8fad5b-d9cb-469f-a165-70867728950e.jpg',
  ])('refuses the key %s and writes nothing', async (key) => {
    const { deps, news } = setup();
    const result = await save(deps, { input: input({ featuredImage: { kind: 'media', key } }) });
    expect(result).toMatchObject({ ok: false, error: { code: 'news.invalid', details: { field: 'featuredImage' } } });
    expect(news.saveArticle).not.toHaveBeenCalled();
  });

  it('replaces and removes an imported article\'s cover (call 7)', async () => {
    const imported = record({ isImported: true, featuredImageUrl: 'https://old-site.test/cover.jpg' });
    for (const featuredImage of [{ kind: 'media', key: KEY } as const, { kind: 'none' } as const]) {
      const { deps, news } = setup(imported);
      expect((await save(deps, { id: ARTICLE, input: input({ featuredImage }) })).ok).toBe(true);
      expect(written(news).featuredImage).toEqual(featuredImage);
    }
  });
});

describe('saveArticle: uploaded images in the body (plan 017)', () => {
  const realSanitize = (html: string) => sanitizeArticleHtml(html).html;

  it('refuses a keyed image with an alt over 300 characters', async () => {
    const { deps, news } = setup();
    const image = `<img data-media-key="${KEY}" alt="${'ก'.repeat(301)}">`;
    const result = await save({ ...deps, sanitize: realSanitize }, { input: input({ th: { title: 'ข่าว', excerpt: '', bodyHtml: `<p>x</p>${image}` } }) });
    expect(result).toMatchObject({ ok: false, error: { code: 'news.invalid', details: { field: 'body' } } });
    expect(news.saveArticle).not.toHaveBeenCalled();
  });

  it('refuses one in the English body too', async () => {
    const { deps } = setup();
    const result = await save(
      { ...deps, sanitize: realSanitize },
      { input: input({ en: { title: 'News', excerpt: '', bodyHtml: `<img data-media-key="${KEY}" alt="${'a'.repeat(301)}">` } }) },
    );
    expect(result).toMatchObject({ ok: false, error: { details: { field: 'body' } } });
  });

  // The alt text is optional (D-284): the editor writes an empty alt when staff leave it blank.
  it.each([
    ['an empty alt', `<img data-media-key="${KEY}" alt="">`, `<img data-media-key="${KEY}" alt="" />`],
    ['a blank alt', `<img data-media-key="${KEY}" alt="   ">`, `<img data-media-key="${KEY}" alt="   " />`],
    ['no alt', `<img data-media-key="${KEY}">`, `<img data-media-key="${KEY}" />`],
  ])('accepts a keyed image with %s', async (_, image, stored) => {
    const { deps, news } = setup();
    const result = await save({ ...deps, sanitize: realSanitize }, { input: input({ th: { title: 'ข่าว', excerpt: '', bodyHtml: `<p>x</p>${image}` } }) });
    expect(result.ok).toBe(true);
    expect(written(news).th.bodyHtml).toBe(`<p>x</p>${stored}`);
  });

  it('accepts a keyed image with alt up to 300 characters, entities counted as one', async () => {
    const { deps, news } = setup();
    const alt = `${'ก'.repeat(299)}&amp;`;
    const result = await save({ ...deps, sanitize: realSanitize }, { input: input({ th: { title: 'ข่าว', excerpt: '', bodyHtml: `<img data-media-key="${KEY}" alt="${alt}">` } }) });
    expect(result.ok).toBe(true);
    expect(written(news).th.bodyHtml).toBe(`<img data-media-key="${KEY}" alt="${alt}" />`);
  });

  it('accepts an imported image without alt', async () => {
    const { deps } = setup();
    const result = await save({ ...deps, sanitize: realSanitize }, { input: input({ th: { title: 'ข่าว', excerpt: '', bodyHtml: '<img src="https://old.test/a.jpg">' } }) });
    expect(result.ok).toBe(true);
  });

  it('stores the key, never a src, for a keyed image the editor sent with a display src', async () => {
    const { deps, news } = setup();
    await save(
      { ...deps, sanitize: realSanitize },
      { input: input({ th: { title: 'ข่าว', excerpt: '', bodyHtml: `<img src="${MEDIA_BASE}/${KEY}" data-media-key="${KEY}" alt="a">` } }) },
    );
    expect(written(news).th.bodyHtml).toBe(`<img data-media-key="${KEY}" alt="a" />`);
  });
});

describe('parseFeaturedImage', () => {
  it.each([
    ['', { kind: 'unchanged' }],
    ['unchanged', { kind: 'unchanged' }],
    ['none', { kind: 'none' }],
    [`media:${KEY}`, { kind: 'media', key: KEY }],
  ])('reads %j', (value, expected) => {
    expect(parseFeaturedImage(value)).toEqual(expected);
  });

  it.each(['media:', 'media:../x', 'NONE', 'remove', `url:${KEY}`, ` media:${KEY}`])('refuses %j', (value) => {
    expect(parseFeaturedImage(value)).toBeNull();
  });
});

describe('reads, trash and restore', () => {
  it('gives the editor a keyed cover as its built URL, with the key, and an imported one as stored', async () => {
    expect(await getAdminArticle(setup(record({ featuredImageKey: KEY })).deps, ARTICLE)).toMatchObject({
      featuredImageKey: KEY,
      featuredImageUrl: `${MEDIA_BASE}/${KEY}`,
    });
    expect(await getAdminArticle(setup(record({ featuredImageUrl: 'https://old-site.test/c.jpg' })).deps, ARTICLE)).toMatchObject({
      featuredImageKey: null,
      featuredImageUrl: 'https://old-site.test/c.jpg',
    });
    const { deps } = setup(record({ featuredImageKey: KEY }));
    expect(await getAdminArticle({ ...deps, mediaBaseUrl: null }, ARTICLE)).toMatchObject({ featuredImageKey: KEY, featuredImageUrl: null });
  });


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

describe('createNewsCategory (D-254)', () => {
  it('trims and collapses the names, makes the slug from the English name, and asks for the Thai name lower-cased as the key', async () => {
    const { deps, news } = setup();
    const result = await createNewsCategory(deps, { thName: '  ข่าว\t เกม  ', enName: ' Game   News ' });
    expect(news.createNewsCategory).toHaveBeenCalledWith({ slug: 'game-news', th: 'ข่าว เกม', en: 'Game News', nameKey: 'ข่าว เกม' });
    expect(result).toEqual({ ok: true, data: { id: CATEGORY, slug: 'game-news', isListed: true, names: { th: 'ข่าว เกม', en: 'Game News' } } });
  });

  it('makes the slug from the Thai name when there is no English one, and lower-cases the key', async () => {
    const { deps, news } = setup();
    await createNewsCategory(deps, { thName: 'รีวิว PS5', enName: '   ' });
    expect(news.createNewsCategory).toHaveBeenCalledWith({ slug: 'รีวิว-ps5', th: 'รีวิว PS5', en: null, nameKey: 'รีวิว ps5' });
  });

  it('requires the Thai name and caps both names at 100 characters (code points), writing nothing', async () => {
    const { deps, news } = setup();
    expect(await createNewsCategory(deps, { thName: ' \n ', enName: 'News' })).toMatchObject({
      ok: false,
      error: { code: 'news.invalid', details: { field: 'thName', reason: 'required' } },
    });
    expect(await createNewsCategory(deps, { thName: 'ก'.repeat(101), enName: '' })).toMatchObject({
      ok: false,
      error: { details: { field: 'thName', reason: 'too_long' } },
    });
    expect(await createNewsCategory(deps, { thName: 'ข่าว', enName: 'a'.repeat(101) })).toMatchObject({
      ok: false,
      error: { details: { field: 'enName', reason: 'too_long' } },
    });
    expect(news.createNewsCategory).not.toHaveBeenCalled();

    // 100 Thai characters with combining marks is 100 code points, not more.
    expect((await createNewsCategory(deps, { thName: 'กิ'.repeat(50), enName: '😀'.repeat(100) })).ok).toBe(true);
  });

  it('refuses a duplicate Thai name as news.category_exists and returns the category that holds it', async () => {
    const { deps, news } = setup();
    const existing = { id: CATEGORY, slug: 'reviews', isListed: true, names: { th: 'รีวิว' } };
    news.createNewsCategory.mockResolvedValueOnce({ status: 'duplicate', category: existing } as never);
    expect(await createNewsCategory(deps, { thName: 'รีวิว', enName: '' })).toMatchObject({
      ok: false,
      error: { code: 'news.category_exists', details: { category: existing } },
    });
  });
});

describe('buildArticlePreview (D-253)', () => {
  const LISTED = '55555555-5555-4555-8555-555555555555';
  const UNKNOWN = '66666666-6666-4666-8666-666666666666';

  function draft(overrides: Partial<ArticlePreviewDraft> = {}): ArticlePreviewDraft {
    return {
      articleId: null,
      contentLanguage: 'th',
      slug: '',
      title: '  ข่าว ใหม่ ',
      excerpt: ' สรุป ',
      bodyHtml: '<p>เนื้อหา</p>',
      bylineName: '',
      categoryIds: [CATEGORY, LISTED, UNKNOWN],
      publishedAt: null,
      featuredImage: 'unchanged',
      ...overrides,
    };
  }

  function previewSetup(featuredImageUrl: string | null = null, featuredImageKey: string | null = null) {
    const deps = {
      news: {
        findAdminArticle: vi.fn(async () => record({ featuredImageUrl, featuredImageKey })),
        listNewsCategories: vi.fn(async () => [
          { id: LISTED, slug: 'b', parentId: null, position: 2, names: { th: 'ข่าว', en: 'News' }, isListed: true },
          { id: CATEGORY, slug: 'a', parentId: null, position: 1, names: { th: 'รีวิว' }, isListed: true },
        ]),
      },
      productCards: vi.fn(async () => []),
      sanitize: vi.fn((html: string) => `[s]${html}`),
      now: () => NOW,
      mediaBaseUrl: MEDIA_BASE as string | null,
    } satisfies ArticlePreviewDeps;
    return deps;
  }

  it('sanitises the body as a save does and reads the product cards for the sanitised body in the content language', async () => {
    const deps = previewSetup();
    const detail = await buildArticlePreview(deps, { draft: draft({ contentLanguage: 'en' }), locale: 'th', editorFirstName: 'Nok' });
    expect(detail.bodyHtml).toBe('[s]<p>เนื้อหา</p>');
    expect(deps.productCards).toHaveBeenCalledWith('[s]<p>เนื้อหา</p>', 'en');
    expect(detail).toMatchObject({ title: 'ข่าว ใหม่', excerpt: 'สรุป', slug: 'ข่าว-ใหม่', related: [], featuredImageUrl: null });
    expect(deps.news.findAdminArticle).not.toHaveBeenCalled();
  });

  it('keeps the chosen categories that exist, in position order, named in the page language with a Thai fallback', async () => {
    const deps = previewSetup();
    const en = await buildArticlePreview(deps, { draft: draft(), locale: 'en', editorFirstName: 'Nok' });
    expect(en.categories).toEqual([
      { slug: 'a', name: 'รีวิว' },
      { slug: 'b', name: 'News' },
    ]);
  });

  it('falls back to the editor\'s first name for an empty byline, and to now for no date', async () => {
    const deps = previewSetup();
    const fallback = await buildArticlePreview(deps, { draft: draft({ bylineName: '  ' }), locale: 'th', editorFirstName: 'Nok' });
    expect(fallback.bylineName).toBe('Nok');
    expect(fallback.publishedAt).toEqual(NOW);

    const given = await buildArticlePreview(deps, {
      draft: draft({ bylineName: ' Writer ', publishedAt: '2026-12-01T02:00:00.000Z' }),
      locale: 'th',
      editorFirstName: 'Nok',
    });
    expect(given.bylineName).toBe('Writer');
    expect(given.publishedAt).toEqual(new Date('2026-12-01T02:00:00.000Z'));
  });

  it('uses a given slug, and shows an existing article\'s stored featured image', async () => {
    const deps = previewSetup('https://old-site.test/cover.jpg');
    const detail = await buildArticlePreview(deps, { draft: draft({ articleId: ARTICLE, slug: 'My Slug' }), locale: 'th', editorFirstName: 'Nok' });
    expect(detail.slug).toBe('my-slug');
    expect(detail.featuredImageUrl).toBe('https://old-site.test/cover.jpg');
    expect(deps.news.findAdminArticle).toHaveBeenCalledWith(ARTICLE);
  });

  it('draws an uploaded body image from its key, and leaves it out with no base URL', async () => {
    const deps = { ...previewSetup(), sanitize: (html: string) => sanitizeArticleHtml(html).html };
    const body = `<p>x</p><img data-media-key="${KEY}" alt="a">`;
    const detail = await buildArticlePreview(deps, { draft: draft({ bodyHtml: body }), locale: 'th', editorFirstName: 'Nok' });
    expect(detail.bodyHtml).toBe(`<p>x</p><img src="${MEDIA_BASE}/${KEY}" alt="a" />`);
    const unset = await buildArticlePreview({ ...deps, mediaBaseUrl: null }, { draft: draft({ bodyHtml: body }), locale: 'th', editorFirstName: 'Nok' });
    expect(unset.bodyHtml).toBe('<p>x</p>');
  });

  it('shows the cover the editor has chosen but not saved: a new upload, none, or the stored keyed one', async () => {
    const deps = previewSetup('https://old-site.test/cover.jpg');
    const chosen = await buildArticlePreview(deps, { draft: draft({ articleId: ARTICLE, featuredImage: `media:${KEY}` }), locale: 'th', editorFirstName: 'Nok' });
    expect(chosen.featuredImageUrl).toBe(`${MEDIA_BASE}/${KEY}`);
    const removed = await buildArticlePreview(deps, { draft: draft({ articleId: ARTICLE, featuredImage: 'none' }), locale: 'th', editorFirstName: 'Nok' });
    expect(removed.featuredImageUrl).toBeNull();
    const stored = previewSetup(null, KEY);
    const kept = await buildArticlePreview(stored, { draft: draft({ articleId: ARTICLE }), locale: 'th', editorFirstName: 'Nok' });
    expect(kept.featuredImageUrl).toBe(`${MEDIA_BASE}/${KEY}`);
    const bad = await buildArticlePreview(deps, { draft: draft({ articleId: ARTICLE, featuredImage: 'media:../x' }), locale: 'th', editorFirstName: 'Nok' });
    expect(bad.featuredImageUrl).toBe('https://old-site.test/cover.jpg');
  });
});
