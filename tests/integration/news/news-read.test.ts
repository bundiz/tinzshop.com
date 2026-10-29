import { beforeEach, describe, expect, it } from 'vitest';

import { getNewsReader } from '@/server/composition-root';
import { getPrisma } from '@/server/repositories/shared/prisma';
import { resetDatabase } from '../setup/database';

beforeEach(async () => {
  await resetDatabase();
});

const prisma = () => getPrisma();
const listNews = getNewsReader();

async function category(slug: string, name: string, position: number, parentId: string | null = null) {
  const row = await prisma().newsCategory.create({
    data: { slug, position, parentId, translations: { create: { locale: 'th', name } } },
    select: { id: true },
  });
  return row.id;
}

let sequence = 0;

async function article(
  categoryIds: string[],
  overrides: { status?: 'draft' | 'published'; publishedAt?: Date | null; deletedAt?: Date | null; en?: string } = {},
) {
  sequence += 1;
  const publishedAt =
    overrides.publishedAt === undefined ? new Date(Date.UTC(2026, 0, 1, 0, sequence)) : overrides.publishedAt;
  const translations: { locale: 'th' | 'en'; title: string; excerpt: string }[] = [
    { locale: 'th', title: `ข่าว ${sequence}`, excerpt: `สรุป ${sequence}` },
  ];
  if (overrides.en !== undefined) translations.push({ locale: 'en', title: overrides.en, excerpt: 'en' });
  await prisma().newsArticle.create({
    data: {
      slug: `post-${sequence}`,
      status: overrides.status ?? 'published',
      publishedAt,
      deletedAt: overrides.deletedAt ?? null,
      bylineName: 'Invented Writer',
      translations: { create: translations },
      categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
    },
  });
  return `post-${sequence}`;
}

describe('listNews against the database', () => {
  it('includes descendant categories without duplicates', async () => {
    const news = await category('news', 'News', 1);
    const nintendo = await category('nintendo', 'NINTENDO', 2, news);
    const thai = await category('บทความ', 'บทความ', 3, news);
    const reviews = await category('reviews', 'Reviews', 4);
    const both = await article([news, nintendo]);
    const child = await article([thai]);
    const other = await article([reviews]);

    const page = await listNews({ locale: 'th', categorySlug: 'news', page: 1 });

    expect(page?.items.map((item) => item.slug)).toEqual([child, both]);
    expect(page?.total).toBe(2);
    expect(page?.items.map((item) => item.slug)).not.toContain(other);
    expect(page?.categories).toEqual([
      { slug: 'news', name: 'News', count: 2 },
      { slug: 'nintendo', name: 'NINTENDO', count: 1 },
      { slug: 'บทความ', name: 'บทความ', count: 1 },
      { slug: 'reviews', name: 'Reviews', count: 1 },
    ]);
    // The Thai slug, stored decoded, finds its category.
    expect((await listNews({ locale: 'th', categorySlug: 'บทความ', page: 1 }))?.items.map((i) => i.slug)).toEqual([
      child,
    ]);
  });

  it('hides drafts, scheduled and deleted articles', async () => {
    const news = await category('news', 'News', 1);
    const live = await article([news]);
    await article([news], { status: 'draft', publishedAt: null });
    await article([news], { status: 'draft', publishedAt: new Date('2026-01-01T00:00:00Z') });
    await article([news], { publishedAt: new Date(Date.now() + 86_400_000) });
    await article([news], { deletedAt: new Date('2026-02-01T00:00:00Z') });

    for (const filter of [{}, { categorySlug: 'news' }]) {
      const page = await listNews({ locale: 'th', page: 1, ...filter });
      expect(page?.items.map((item) => item.slug)).toEqual([live]);
      expect(page?.total).toBe(1);
      expect(page?.categories).toEqual([{ slug: 'news', name: 'News', count: 1 }]);
    }
  });

  it('returns null past the last page, and for an unknown category', async () => {
    const news = await category('news', 'News', 1);
    for (let n = 0; n < 13; n += 1) await article([news]);

    const first = await listNews({ locale: 'th', page: 1 });
    expect(first).toMatchObject({ page: 1, totalPages: 2, total: 13 });
    expect(first?.items).toHaveLength(12);
    expect(first?.items[0]?.slug).toBe(`post-${sequence}`);
    const second = await listNews({ locale: 'th', page: 2 });
    expect(second?.items.map((item) => item.slug)).toEqual([`post-${sequence - 12}`]);
    expect(await listNews({ locale: 'th', page: 3 })).toBeNull();
    expect(await listNews({ locale: 'th', categorySlug: 'nope', page: 1 })).toBeNull();
  });

  it('falls back to the th title on en', async () => {
    const news = await category('news', 'News', 1);
    const thaiOnly = await article([news]);
    const both = await article([news], { en: 'English title' });

    const page = await listNews({ locale: 'en', page: 1 });

    expect(page?.items.find((item) => item.slug === thaiOnly)?.title).toMatch(/^ข่าว /);
    expect(page?.items.find((item) => item.slug === both)?.title).toBe('English title');
  });
});
