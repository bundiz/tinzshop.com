import { beforeEach, describe, expect, it } from 'vitest';

import { getLatestNewsReader, getNewsArticleReader, getNewsReader } from '@/server/composition-root';
import { decodeSlugParam, newsArticlePath } from '@/app/[locale]/(shop)/news/news-routes';
import { getPrisma } from '@/server/repositories/shared/prisma';
import { resetDatabase } from '../setup/database';

beforeEach(async () => {
  await resetDatabase();
});

const prisma = () => getPrisma();
const listNews = getNewsReader();
const getNewsArticle = getNewsArticleReader();
const listLatestNews = getLatestNewsReader();

async function category(slug: string, name: string, position: number, parentId: string | null = null, isListed = true) {
  const row = await prisma().newsCategory.create({
    data: { slug, position, parentId, isListed, translations: { create: { locale: 'th', name } } },
    select: { id: true },
  });
  return row.id;
}

let sequence = 0;

async function article(
  categoryIds: string[],
  overrides: {
    status?: 'draft' | 'published';
    publishedAt?: Date | null;
    deletedAt?: Date | null;
    en?: string;
    slug?: string;
    bodyHtml?: string;
  } = {},
) {
  sequence += 1;
  const slug = overrides.slug ?? `post-${sequence}`;
  const publishedAt =
    overrides.publishedAt === undefined ? new Date(Date.UTC(2026, 0, 1, 0, sequence)) : overrides.publishedAt;
  const translations: { locale: 'th' | 'en'; title: string; excerpt: string; bodyHtml?: string }[] = [
    { locale: 'th', title: `ข่าว ${sequence}`, excerpt: `สรุป ${sequence}`, bodyHtml: overrides.bodyHtml },
  ];
  if (overrides.en !== undefined) translations.push({ locale: 'en', title: overrides.en, excerpt: 'en' });
  await prisma().newsArticle.create({
    data: {
      slug,
      status: overrides.status ?? 'published',
      publishedAt,
      deletedAt: overrides.deletedAt ?? null,
      bylineName: 'Invented Writer',
      translations: { create: translations },
      categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
    },
  });
  return slug;
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

describe('unlisted categories against the database', () => {
  it('gives them no tab, no card tag, no breadcrumb and a 404 route, and keeps their articles under ทั้งหมด', async () => {
    const news = await category('news', 'News', 2);
    const uncategorized = await category('uncategorized', 'Uncategorized', 1, null, false);
    await category('reviews', 'Reviews', 3, null, false);
    const onlyUnlisted = await article([uncategorized]);
    const both = await article([uncategorized, news]);

    const all = await listNews({ locale: 'th', page: 1 });

    expect(all?.items.map((item) => item.slug)).toEqual([both, onlyUnlisted]);
    expect(all?.categories).toEqual([{ slug: 'news', name: 'News', count: 1 }]);
    expect(all?.items.map((item) => item.categoryName)).toEqual(['News', null]);
    expect(await listNews({ locale: 'th', categorySlug: 'uncategorized', page: 1 })).toBeNull();
    expect(await listNews({ locale: 'th', categorySlug: 'reviews', page: 1 })).toBeNull();

    const detail = await getNewsArticle({ locale: 'th', slug: both });
    expect(detail?.categories).toEqual([{ slug: 'news', name: 'News' }]);
  });
});

describe('a listed parent with an unlisted child', () => {
  it("leaves the unlisted child's articles out of the parent's page and tab count", async () => {
    const news = await category('news', 'News', 1);
    const hiddenChild = await category('hidden-child', 'Hidden', 2, news, false);
    const direct = await article([news]);
    await article([hiddenChild]);

    const page = await listNews({ locale: 'th', categorySlug: 'news', page: 1 });

    expect(page?.items.map((item) => item.slug)).toEqual([direct]);
    expect(page?.total).toBe(1);
    expect(page?.categories).toEqual([{ slug: 'news', name: 'News', count: 1 }]);
  });
});

describe('getNewsArticle against the database', () => {
  it('opens an article by a Thai slug', async () => {
    const news = await category('news', 'News', 1);
    const slug = await article([news], { slug: 'รีวิว-เกม-ใหม่', bodyHtml: '<p>เนื้อหา <strong>จริง</strong></p>' });

    // The link encodes the slug once; the route decodes it once; the read finds the stored, decoded slug.
    const segment = newsArticlePath('th', slug).split('/').pop() as string;
    expect(segment).toBe(encodeURIComponent('รีวิว-เกม-ใหม่'));
    const detail = await getNewsArticle({ locale: 'th', slug: decodeSlugParam(segment) as string });

    expect(detail).toMatchObject({
      slug: 'รีวิว-เกม-ใหม่',
      bylineName: 'Invented Writer',
      bodyHtml: '<p>เนื้อหา <strong>จริง</strong></p>',
      categories: [{ slug: 'news', name: 'News' }],
    });
  });

  it('returns null for an unknown slug, and for a draft, scheduled or deleted one', async () => {
    const news = await category('news', 'News', 1);
    const draft = await article([news], { status: 'draft', publishedAt: null });
    const scheduled = await article([news], { publishedAt: new Date(Date.now() + 86_400_000) });
    const deleted = await article([news], { deletedAt: new Date('2026-02-01T00:00:00Z') });

    for (const slug of ['does-not-exist', draft, scheduled, deleted]) {
      expect(await getNewsArticle({ locale: 'th', slug })).toBeNull();
    }
  });

  it('related excludes the article itself, max 3', async () => {
    const news = await category('news', 'News', 1);
    const reviews = await category('reviews', 'Reviews', 2);
    const older = await article([news]);
    const others = [await article([news]), await article([news])];
    const self = await article([news, reviews]);
    const newer = await article([news]);
    const reviewsOnly = await article([reviews]);
    await article([news], { status: 'draft', publishedAt: null });
    const unrelated = await category('other', 'Other', 3);
    await article([unrelated]);

    const detail = await getNewsArticle({ locale: 'th', slug: self });

    // Both are leaves: News (position 1) first, newest first, live, not itself; Reviews is not needed.
    expect(detail?.related.map((card) => card.slug)).toEqual([newer, others[1], others[0]]);
    expect(detail?.related.map((card) => card.slug)).not.toContain(reviewsOnly);
    expect(detail?.related).toHaveLength(3);
    expect(detail?.related.map((card) => card.slug)).not.toContain(self);
    expect(detail?.related.map((card) => card.slug)).not.toContain(older);
  });
  it('relates by the most specific category first, then fills up from the parent', async () => {
    const news = await category('news', 'News', 1);
    const nintendo = await category('nintendo', 'NINTENDO', 2, news);
    const leafOlder = await article([news, nintendo]);
    const self = await article([news, nintendo]);
    const leafNewer = await article([news, nintendo]);
    const parentOnly = [await article([news]), await article([news]), await article([news])];

    const detail = await getNewsArticle({ locale: 'th', slug: self });

    // NINTENDO's two others first, although News has three newer ones; then News's newest.
    expect(detail?.related.map((card) => card.slug)).toEqual([leafNewer, leafOlder, parentOnly[2]]);
  });
});

describe('listLatestNews against the database', () => {
  it('lists the 3 newest live articles', async () => {
    const news = await category('news', 'News', 1);
    await article([news]);
    const expected = [await article([news]), await article([news]), await article([news])].reverse();
    await article([news], { publishedAt: new Date(Date.now() + 86_400_000) });

    const cards = await listLatestNews({ locale: 'th', limit: 3 });

    expect(cards.map((card) => card.slug)).toEqual(expected);
  });
});
