import { beforeEach, describe, expect, it } from 'vitest';

import { getPrisma } from '@/server/repositories/shared/prisma';
import { resetDatabase } from '../setup/database';

beforeEach(async () => {
  await resetDatabase();
});

const prisma = () => getPrisma();

describe('news schema', () => {
  it('stores an article with translations and categories', async () => {
    const category = await prisma().newsCategory.create({
      data: { slug: 'reviews', position: 1, translations: { create: [{ locale: 'th', name: 'รีวิว' }] } },
    });
    const article = await prisma().newsArticle.create({
      data: {
        slug: 'sample-article',
        status: 'published',
        publishedAt: new Date('2026-10-01T00:00:00Z'),
        bylineName: 'Sample Writer',
        sourceId: 123n,
        translations: { create: [{ locale: 'th', title: 'หัวข้อ', excerpt: 'สรุป', bodyHtml: '<p>เนื้อหา</p>' }] },
        categories: { create: [{ categoryId: category.id }] },
      },
      include: { translations: true, categories: true },
    });

    expect(article.translations).toHaveLength(1);
    expect(article.categories[0]?.categoryId).toBe(category.id);
    expect(article.deletedAt).toBeNull();
  });

  it('rejects a duplicate slug on an article and on a category', async () => {
    await prisma().newsArticle.create({ data: { slug: 'dup', status: 'draft' } });
    await expect(prisma().newsArticle.create({ data: { slug: 'dup', status: 'draft' } })).rejects.toThrow();

    await prisma().newsCategory.create({ data: { slug: 'dup', position: 1 } });
    await expect(prisma().newsCategory.create({ data: { slug: 'dup', position: 2 } })).rejects.toThrow();
  });

  it('rejects a duplicate source_id', async () => {
    await prisma().newsArticle.create({ data: { slug: 'a', status: 'draft', sourceId: 7n } });
    await expect(prisma().newsArticle.create({ data: { slug: 'b', status: 'draft', sourceId: 7n } })).rejects.toThrow();

    await prisma().newsCategory.create({ data: { slug: 'c1', position: 1, sourceId: 9n } });
    await expect(prisma().newsCategory.create({ data: { slug: 'c2', position: 2, sourceId: 9n } })).rejects.toThrow();
  });

  it('allows a category tree via parent_id', async () => {
    const parent = await prisma().newsCategory.create({ data: { slug: 'parent', position: 1 } });
    const child = await prisma().newsCategory.create({ data: { slug: 'child', position: 2, parentId: parent.id } });

    const loaded = await prisma().newsCategory.findUniqueOrThrow({ where: { id: parent.id }, include: { children: true } });
    expect(loaded.children.map((c) => c.id)).toEqual([child.id]);
  });

  it('rejects a published article without published_at', async () => {
    await expect(prisma().newsArticle.create({ data: { slug: 'no-date', status: 'published' } })).rejects.toThrow(
      /news_article_published_requires_published_at/,
    );
    await expect(prisma().newsArticle.create({ data: { slug: 'draft-ok', status: 'draft' } })).resolves.toBeTruthy();
  });
});
