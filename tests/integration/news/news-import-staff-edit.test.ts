import { beforeEach, describe, expect, it } from 'vitest';

import type { WordPressClient } from '@/server/adapters/wordpress/client';
import { createWordPressNewsSource } from '@/server/adapters/wordpress/news-source';
import type { WpPost } from '@/server/adapters/wordpress/schemas';
import { getNewsAdmin } from '@/server/composition-root';
import {
  applyExcludedNewsCategories,
  findArticleSourceStates,
  upsertNewsArticle,
  upsertNewsCategories,
} from '@/server/repositories/news/news-repository';
import { NEWS_IMPORT_LOCK_KEY, tryWithAdvisoryLock } from '@/server/repositories/shared/advisory-lock';
import { getPrisma } from '@/server/repositories/shared/prisma';
import { runNewsImport, type NewsImportSummary } from '@/server/services/news/news-import-service';
import { resetDatabase } from '../setup/database';

beforeEach(async () => {
  await resetDatabase();
});

const prisma = () => getPrisma();

// Invented names only (hard rule 2).
function post(id: number, overrides: Partial<WpPost> = {}): WpPost {
  return {
    id,
    date_gmt: '2025-10-23T16:16:00',
    modified_gmt: '2025-10-24T01:00:00',
    slug: `post-${id}`,
    link: `https://old-site.test/post-${id}/`,
    title: { rendered: `ข่าว ${id}` },
    excerpt: { rendered: '<p>สรุป</p>' },
    content: { rendered: '<p>เนื้อหา</p><img src="https://old-site.test/media/1.jpg" alt="a">' },
    categories: [5],
    featured_media: 0,
    author: 1,
    ...overrides,
  };
}

function fakeClient(posts: WpPost[]): WordPressClient {
  return {
    listCategories: async () => [{ id: 5, parent: 0, count: 2, slug: 'news', name: 'News' }],
    listPostsPage: async () => ({ posts, totalPages: 1 }),
    listAuthors: async () => new Map([[1, 'Invented Writer']]),
    getMedia: async () => null,
  };
}

function run(posts: WpPost[], full = false): Promise<NewsImportSummary> {
  return runNewsImport(
    {
      source: createWordPressNewsSource(fakeClient(posts)),
      news: { upsertNewsCategories, upsertNewsArticle, findArticleSourceStates, applyExcludedNewsCategories },
      lock: (task) => tryWithAdvisoryLock(NEWS_IMPORT_LOCK_KEY, task),
      logError: () => {},
    },
    { full },
  );
}

async function editor(): Promise<string> {
  const row = await prisma().customer.create({
    data: { cognitoSub: 'sub-editor', email: 'editor@example.test', firstName: 'Invented' },
    select: { id: true },
  });
  return row.id;
}

describe('the import and a staff edit (D-236)', () => {
  it('the import skips a staff-edited article on a normal run and on ?full=1 and counts it', async () => {
    await run([post(101), post(102)]);
    const imported = await prisma().newsArticle.findUniqueOrThrow({ where: { sourceId: 101n }, select: { id: true } });
    const editorId = await editor();

    const saved = await getNewsAdmin().save({
      id: imported.id,
      editorId,
      action: 'draft',
      publishAt: null,
      now: new Date(),
      input: {
        slug: null,
        th: { title: 'แก้โดยทีมงาน', excerpt: 'สรุป', bodyHtml: '<p>แก้แล้ว</p>' },
        en: null,
        categoryIds: [],
        tagNames: [],
        productIds: [],
        bylineName: 'ทีมงาน',
      },
    });
    expect(saved.ok).toBe(true);

    // Nothing changed on the old site: the early exit still says unchanged.
    expect(await run([post(101), post(102)])).toMatchObject({ created: 0, updated: 0, unchanged: 2, skippedStaffEdits: 0 });

    // The old site changes both posts: the edited one is skipped, the other updated.
    const changed = [
      post(101, { modified_gmt: '2026-02-01T00:00:00', title: { rendered: 'จากเว็บเก่า' } }),
      post(102, { modified_gmt: '2026-02-01T00:00:00', title: { rendered: 'จากเว็บเก่า 2' } }),
    ];
    expect(await run(changed)).toMatchObject({ outcome: 'succeeded', created: 0, updated: 1, unchanged: 0, skippedStaffEdits: 1 });

    // The full re-import writes every other post again, and still skips the edited one.
    expect(await run(changed, true)).toMatchObject({ outcome: 'succeeded', updated: 1, skippedStaffEdits: 1 });

    const kept = await prisma().newsArticle.findUniqueOrThrow({
      where: { id: imported.id },
      include: { translations: true },
    });
    expect(kept.translations[0]).toMatchObject({ title: 'แก้โดยทีมงาน', bodyHtml: '<p>แก้แล้ว</p>' });
    expect(kept).toMatchObject({ status: 'draft', bylineName: 'ทีมงาน', updatedByStaffId: editorId, sourceId: 101n });
    const other = await prisma().newsArticle.findUniqueOrThrow({ where: { sourceId: 102n }, include: { translations: true } });
    expect(other.translations[0]?.title).toBe('จากเว็บเก่า 2');
  });

  it('trashing an imported article counts as a staff edit, so the import does not bring it back', async () => {
    await run([post(101)]);
    const imported = await prisma().newsArticle.findUniqueOrThrow({ where: { sourceId: 101n }, select: { id: true } });
    const editorId = await editor();

    expect((await getNewsAdmin().trash(imported.id, editorId)).ok).toBe(true);
    const summary = await run([post(101, { modified_gmt: '2026-02-01T00:00:00' })], true);

    expect(summary).toMatchObject({ updated: 0, skippedStaffEdits: 1 });
    expect((await prisma().newsArticle.findUniqueOrThrow({ where: { id: imported.id } })).deletedAt).not.toBeNull();
  });
});
