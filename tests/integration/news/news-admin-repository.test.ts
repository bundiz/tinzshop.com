import { Client } from 'pg';
import { beforeEach, describe, expect, it } from 'vitest';

import { getNewsAdmin } from '@/server/composition-root';
import { getDatabaseUrl } from '@/server/config';
import { getPrisma } from '@/server/repositories/shared/prisma';
import type { ArticleInput } from '@/server/services/news/news-admin-service';
import { resetDatabase } from '../setup/database';

let defaultCategoryId: string | null = null;

beforeEach(async () => {
  await resetDatabase();
  defaultCategoryId = null;
});

const prisma = () => getPrisma();
const admin = getNewsAdmin();
const NOW = new Date();
const HOUR = 3_600_000;

async function editor(sub = 'editor'): Promise<string> {
  return (
    await prisma().customer.create({
      data: { cognitoSub: `sub-${sub}`, email: `${sub}@example.test`, firstName: `Name-${sub}` },
      select: { id: true },
    })
  ).id;
}

async function category(slug: string): Promise<string> {
  return (
    await prisma().newsCategory.create({
      data: { slug, position: 1, translations: { create: { locale: 'th', name: slug } } },
      select: { id: true },
    })
  ).id;
}

async function product(): Promise<string> {
  return (await prisma().product.create({ data: {}, select: { id: true } })).id;
}

function input(overrides: Partial<ArticleInput> = {}): ArticleInput {
  return {
    slug: null,
    th: { title: 'ข่าว ใหม่', excerpt: 'สรุป', bodyHtml: '<p>เนื้อหา</p>' },
    en: null,
    categoryIds: [],
    tagNames: [],
    productIds: [],
    bylineName: '',
    ...overrides,
  };
}

async function save(
  editorId: string,
  over: { id?: string | null; input?: ArticleInput; action?: 'draft' | 'publish' | 'unpublish'; publishAt?: Date | null; now?: Date } = {},
) {
  const body = over.input ?? input();
  // Publishing needs a category (R9): give the default input one.
  if (over.action === 'publish' && body.categoryIds.length === 0) {
    defaultCategoryId ??= await category('default-category');
    body.categoryIds = [defaultCategoryId];
  }
  const result = await admin.save({
    id: over.id ?? null,
    editorId,
    input: body,
    action: over.action ?? 'draft',
    publishAt: over.publishAt ?? null,
    now: over.now ?? new Date(),
  });
  if (!result.ok) throw new Error(`save failed: ${result.error.code}`);
  return result.data;
}

describe('news authoring against the database', () => {
  it('saves a new draft with the staff columns, a slug from the title and the editor name as byline', async () => {
    const who = await editor();
    const { id, slug } = await save(who);

    expect(slug).toBe('ข่าว-ใหม่');
    const row = await prisma().newsArticle.findUniqueOrThrow({ where: { id }, include: { translations: true } });
    expect(row).toMatchObject({
      status: 'draft',
      publishedAt: null,
      bylineName: 'Name-editor',
      authorStaffId: who,
      createdByStaffId: who,
      updatedByStaffId: who,
      deletedAt: null,
      sourceId: null,
    });
    expect(row.translations).toEqual([expect.objectContaining({ locale: 'th', title: 'ข่าว ใหม่', bodyHtml: '<p>เนื้อหา</p>' })]);
  });

  it('publish, unpublish and re-publish round-trip', async () => {
    const who = await editor();
    const { id } = await save(who, { action: 'publish' });
    const published = await prisma().newsArticle.findUniqueOrThrow({ where: { id } });
    expect(published.status).toBe('published');
    expect(published.publishedAt).not.toBeNull();

    await save(who, { id, action: 'unpublish' });
    const draft = await prisma().newsArticle.findUniqueOrThrow({ where: { id } });
    expect(draft.status).toBe('draft');
    expect(draft.publishedAt).toEqual(published.publishedAt);

    // Republishing a draft that was live goes live now (R8)...
    const later = new Date(NOW.getTime() + HOUR);
    await save(who, { id, action: 'publish', now: later });
    const again = await prisma().newsArticle.findUniqueOrThrow({ where: { id } });
    expect(again.status).toBe('published');
    expect(again.publishedAt).toEqual(later);

    // ...and saving it again while live is an update that keeps the date, even with a past publishAt.
    await save(who, { id, action: 'publish', now: new Date(later.getTime() + HOUR) });
    await save(who, { id, action: 'publish', publishAt: new Date(NOW.getTime() - HOUR), now: new Date(later.getTime() + 2 * HOUR) });
    expect((await prisma().newsArticle.findUniqueOrThrow({ where: { id } })).publishedAt).toEqual(later);
  });

  it('schedules a future publish, which the list shows as scheduled and the live rule does not yet', async () => {
    const who = await editor();
    const later = new Date(NOW.getTime() + 48 * HOUR);
    const { id } = await save(who, { action: 'publish', publishAt: later });

    const row = await prisma().newsArticle.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ status: 'published', publishedAt: later });
    const scheduled = await admin.list({ query: '', status: 'scheduled', categoryId: null, page: 1 });
    expect(scheduled.rows.map((r) => [r.id, r.status])).toEqual([[id, 'scheduled']]);
    expect((await admin.list({ query: '', status: 'published', categoryId: null, page: 1 })).total).toBe(0);
    expect((await admin.get(id))?.derivedStatus).toBe('scheduled');
  });

  it('trash and restore round-trip, listing in the trash only', async () => {
    const who = await editor();
    const { id } = await save(who, { action: 'publish' });

    expect((await admin.trash(id, who)).ok).toBe(true);
    expect((await prisma().newsArticle.findUniqueOrThrow({ where: { id } })).deletedAt).not.toBeNull();
    expect((await admin.list({ query: '', status: null, categoryId: null, page: 1 })).total).toBe(0);
    expect((await admin.list({ query: '', status: 'published', categoryId: null, page: 1 })).total).toBe(0);
    expect((await admin.list({ query: '', status: 'trash', categoryId: null, page: 1 })).rows.map((r) => r.id)).toEqual([id]);

    // A trashed article cannot be saved until it is restored.
    const refused = await admin.save({ id, editorId: who, input: input(), action: 'draft', publishAt: null, now: new Date() });
    expect(refused).toMatchObject({ ok: false, error: { code: 'news.not_found' } });

    expect((await admin.restore(id, who)).ok).toBe(true);
    const restored = await prisma().newsArticle.findUniqueOrThrow({ where: { id } });
    expect(restored).toMatchObject({ deletedAt: null, status: 'published' });
    expect((await admin.list({ query: '', status: null, categoryId: null, page: 1 })).total).toBe(1);
  });

  it('gives a clashing slug the suffix -2, -3, and keeps an article\'s own slug on re-save', async () => {
    const who = await editor();
    await prisma().newsArticle.create({ data: { slug: 'ข่าว-ใหม่' } });
    const first = await save(who);
    const second = await save(who);
    const third = await save(who, { input: input({ slug: 'ข่าว-ใหม่' }) });

    expect([first.slug, second.slug, third.slug]).toEqual(['ข่าว-ใหม่-2', 'ข่าว-ใหม่-3', 'ข่าว-ใหม่-4']);
    const again = await save(who, { id: second.id, input: input({ slug: 'ข่าว-ใหม่-3' }) });
    expect(again.slug).toBe('ข่าว-ใหม่-3');
    const keep = await save(who, { id: second.id });
    expect(keep.slug).toBe('ข่าว-ใหม่-3');
  });

  it('two saves with the same title at the same moment get different slugs', async () => {
    const who = await editor();
    const results = await Promise.all(Array.from({ length: 4 }, () => save(who)));
    expect(new Set(results.map((r) => r.slug)).size).toBe(4);
  });

  it('replaces categories, tags and product links on save and shares tags case-insensitively', async () => {
    const who = await editor();
    const [c1, c2] = [await category('c1'), await category('c2')];
    const [p1, p2] = [await product(), await product()];
    const { id } = await save(who, {
      input: input({ categoryIds: [c1, c2], tagNames: ['PS5', ' new  games '], productIds: [p1, p2] }),
    });
    const other = await save(who, { input: input({ tagNames: ['ps5'] }) });

    expect(await prisma().newsTag.findMany({ select: { name: true, nameKey: true }, orderBy: { name: 'asc' } })).toEqual([
      { name: 'new games', nameKey: 'new games' },
      { name: 'PS5', nameKey: 'ps5' },
    ]);
    expect((await admin.get(other.id))?.tagNames).toEqual(['PS5']);

    await save(who, { id, input: input({ categoryIds: [c2], tagNames: ['PS5', 'Xbox'], productIds: [p2] }) });
    const detail = await admin.get(id);
    expect(detail?.categoryIds).toEqual([c2]);
    expect(detail?.tagNames).toEqual(['PS5', 'Xbox']);
    expect(detail?.productIds).toEqual([p2]);
    expect(await prisma().newsArticleProduct.count({ where: { articleId: id } })).toBe(1);
  });

  it('refuses unknown category and product ids and a non-uuid id without a database error', async () => {
    const who = await editor();
    const unknown = '99999999-9999-4999-8999-999999999999';
    for (const bad of [input({ categoryIds: [unknown] }), input({ productIds: [unknown] }), input({ categoryIds: ['x'] })]) {
      const result = await admin.save({ id: null, editorId: who, input: bad, action: 'draft', publishAt: null, now: new Date() });
      expect(result).toMatchObject({ ok: false, error: { code: 'news.invalid' } });
    }
    expect(await admin.get('not-a-uuid')).toBeNull();
    expect(await admin.get(unknown)).toBeNull();
    expect(await admin.trash('not-a-uuid', who)).toMatchObject({ ok: false });
    expect(await admin.restore(unknown, who)).toMatchObject({ ok: false });
    expect(await prisma().newsArticle.count()).toBe(0);
  });

  it('stores the English translation as a set, and removes it when it is cleared', async () => {
    const who = await editor();
    const en = { title: 'English title', excerpt: 'x', bodyHtml: '<p>en</p>' };
    const { id } = await save(who, { input: input({ en }) });
    expect((await admin.get(id))?.en).toEqual(en);

    await save(who, { id, input: input({ en: null }) });
    expect((await admin.get(id))?.en).toBeNull();
  });

  it('sanitises the body, and an <img> in an imported-style body survives a save', async () => {
    const who = await editor();
    const body = '<p>x</p><img src="https://old-site.test/media/1.jpg" alt="a"><script>steal()</script>';
    const { id } = await save(who, { input: input({ th: { title: 'a', excerpt: '', bodyHtml: body } }) });
    const stored = (await admin.get(id))?.th?.bodyHtml ?? '';

    expect(stored).toContain('<img src="https://old-site.test/media/1.jpg"');
    expect(stored).not.toContain('script');
  });

  it('lists newest updated first with the derived status, a title search, a category filter and 20 per page', async () => {
    const who = await editor();
    const cat = await category('news');
    const a = await save(who, { input: input({ th: { title: 'Alpha ข่าว', excerpt: '', bodyHtml: '<p>a</p>' }, categoryIds: [cat] }) });
    const b = await save(who, { input: input({ th: { title: 'Beta', excerpt: 'e', bodyHtml: '<p>b</p>' } }), action: 'publish' });

    const all = await admin.list({ query: '', status: null, categoryId: null, page: 1 });
    expect(all.rows.map((r) => [r.id, r.status])).toEqual([[b.id, 'published'], [a.id, 'draft']]);
    expect(all.rows[0]?.lastEditorName).toBe('Name-editor');
    expect((await admin.list({ query: 'alpha', status: null, categoryId: null, page: 1 })).rows.map((r) => r.id)).toEqual([a.id]);
    expect((await admin.list({ query: '', status: null, categoryId: cat, page: 1 })).rows.map((r) => r.id)).toEqual([a.id]);
    expect((await admin.list({ query: '', status: 'draft', categoryId: null, page: 1 })).rows.map((r) => r.id)).toEqual([a.id]);

    for (let i = 0; i < 21; i += 1) await prisma().newsArticle.create({ data: { slug: `bulk-${i}` } });
    const page1 = await admin.list({ query: '', status: null, categoryId: null, page: 1 });
    const page2 = await admin.list({ query: '', status: null, categoryId: null, page: 2 });
    expect([page1.total, page1.rows.length, page2.rows.length]).toEqual([23, 20, 3]);
    expect(new Set([...page1.rows, ...page2.rows].map((r) => r.id)).size).toBe(23);
  });

  it('never changes an imported article\'s source columns or featured image on a staff save', async () => {
    const who = await editor();
    const imported = await prisma().newsArticle.create({
      data: {
        slug: 'imported',
        sourceId: 7n,
        sourceUrl: 'https://old-site.test/7/',
        featuredImageUrl: 'https://old-site.test/media/7.jpg',
        status: 'published',
        publishedAt: new Date('2025-01-01T00:00:00Z'),
        translations: { create: { locale: 'th', title: 'เก่า', bodyHtml: '<p>x</p>' } },
      },
    });
    await save(who, { id: imported.id, action: 'publish' });

    const row = await prisma().newsArticle.findUniqueOrThrow({ where: { id: imported.id } });
    expect(row).toMatchObject({
      slug: 'imported',
      sourceId: 7n,
      sourceUrl: 'https://old-site.test/7/',
      featuredImageUrl: 'https://old-site.test/media/7.jpg',
      publishedAt: new Date('2025-01-01T00:00:00Z'),
      updatedByStaffId: who,
      createdByStaffId: null,
    });
  });
});

describe('staff-made news categories against the database (D-254)', () => {
  const create = (thName: string, enName = '') => admin.createCategory({ thName, enName });

  it('creates a listed, top-level category last in order, with no source id and both names', async () => {
    await prisma().newsCategory.create({ data: { slug: 'old', position: 7, sourceId: 12n, translations: { create: { locale: 'th', name: 'เก่า' } } } });
    const result = await create(' คู่มือ เกม ', 'Game Guides');
    expect(result).toMatchObject({ ok: true, data: { slug: 'game-guides', isListed: true, names: { th: 'คู่มือ เกม', en: 'Game Guides' } } });

    const row = await prisma().newsCategory.findUniqueOrThrow({ where: { slug: 'game-guides' }, include: { translations: true } });
    expect(row).toMatchObject({ parentId: null, position: 8, sourceId: null, isListed: true });
    expect(row.translations.map((t) => [t.locale, t.name]).sort()).toEqual([
      ['en', 'Game Guides'],
      ['th', 'คู่มือ เกม'],
    ]);
    // It is offered to the editor and the storefront at once: listed, in the category read.
    expect((await admin.categories()).at(-1)).toMatchObject({ slug: 'game-guides', isListed: true });
  });

  it('gives a clashing slug -2, -3, from the Thai name when there is no English one', async () => {
    await prisma().newsCategory.create({ data: { slug: 'guides', position: 1, translations: { create: { locale: 'th', name: 'ไกด์' } } } });
    expect(await create('คู่มือ', 'Guides')).toMatchObject({ ok: true, data: { slug: 'guides-2' } });
    expect(await create('คู่มือใหม่', 'Guides')).toMatchObject({ ok: true, data: { slug: 'guides-3' } });
    expect(await create('รีวิว เกม')).toMatchObject({ ok: true, data: { slug: 'รีวิว-เกม', names: { th: 'รีวิว เกม' } } });
  });

  it('refuses a Thai name an existing category has, ignoring case and spacing, listed or not, and writes nothing', async () => {
    const hidden = await prisma().newsCategory.create({
      data: { slug: 'uncategorized', position: 1, isListed: false, translations: { create: { locale: 'th', name: 'Uncategorized' } } },
      select: { id: true },
    });
    await create('ข่าว  PS5', 'PS5');
    const before = await prisma().newsCategory.count();

    expect(await create('ข่าว ps5')).toMatchObject({ ok: false, error: { code: 'news.category_exists', details: { category: { slug: 'ps5', isListed: true } } } });
    expect(await create(' uncategorized ')).toMatchObject({
      ok: false,
      error: { code: 'news.category_exists', details: { category: { id: hidden.id, isListed: false } } },
    });
    expect(await prisma().newsCategory.count()).toBe(before);
  });

  /**
   * Starts the creates while another session holds `news_category_translation` exclusively, waits until all of them are
   * blocked (on that table, or on the category lock behind it), then lets them go at once. Without the category lock they
   * would all pass the duplicate check and read the same highest position together.
   */
  async function raceCreates<T>(start: () => Promise<T>[]): Promise<T[]> {
    const holder = new Client({ connectionString: getDatabaseUrl() });
    const watcher = new Client({ connectionString: getDatabaseUrl() });
    await Promise.all([holder.connect(), watcher.connect()]);
    try {
      await holder.query('BEGIN');
      await holder.query('LOCK TABLE news_category_translation IN ACCESS EXCLUSIVE MODE');
      const calls = start();
      const deadline = Date.now() + 10_000;
      for (;;) {
        const waiting = await watcher.query<{ n: number }>(
          "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'",
        );
        if (waiting.rows[0]!.n >= calls.length) break;
        if (Date.now() > deadline) throw new Error('the creates never all waited on a lock');
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      await holder.query('COMMIT');
      return await Promise.all(calls);
    } finally {
      await holder.query('ROLLBACK').catch(() => undefined);
      await Promise.all([holder.end(), watcher.end()]);
    }
  }

  // Creates with different slugs never meet on the unique slug index, so only the lock keeps them apart.
  it('creates at once with different slugs take different positions', async () => {
    const results = await raceCreates(() => [create('หนึ่ง', 'One'), create('สอง', 'Two'), create('สาม', 'Three')]);
    expect(results.every((result) => result.ok)).toBe(true);
    const rows = await prisma().newsCategory.findMany({ select: { position: true } });
    expect(rows.map((row) => row.position).sort()).toEqual([1, 2, 3]);
  });

  it('creates at once with the same Thai name and different English names make one row; the others are told it exists', async () => {
    const twins = await raceCreates(() => [create('ซ้ำ', 'Alpha'), create('ซ้ำ', 'Beta'), create('ซ้ำ', 'Gamma')]);
    expect(twins.filter((result) => result.ok)).toHaveLength(1);
    expect(twins.filter((result) => !result.ok && result.error.code === 'news.category_exists')).toHaveLength(2);
    expect(await prisma().newsCategoryTranslation.count({ where: { name: 'ซ้ำ' } })).toBe(1);
  });

  it('creates at once with the same slug get it and -2', async () => {
    const [a, b] = await raceCreates(() => [create('ข่าวหนึ่ง', 'Same'), create('ข่าวสอง', 'Same')]);
    expect(a.ok && b.ok).toBe(true);
    const rows = await prisma().newsCategory.findMany({ select: { slug: true } });
    expect(rows.map((row) => row.slug).sort()).toEqual(['same', 'same-2']);
  });
});
