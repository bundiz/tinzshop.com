import { Client } from 'pg';
import { beforeEach, describe, expect, it } from 'vitest';

import type { WordPressClient } from '@/server/adapters/wordpress/client';
import type { NewsCategorySlugRules } from '@/server/adapters/wordpress/map-post';
import { getDatabaseUrl } from '@/server/config';
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

function run(posts: WpPost[], full = false, rules?: NewsCategorySlugRules): Promise<NewsImportSummary> {
  return runNewsImport(
    {
      source: createWordPressNewsSource(fakeClient(posts), rules),
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

  it('the excluded-category pass leaves a staff-edited article and a staff-written one alone (D-236)', async () => {
    await run([post(101), post(102)]);
    const edited = await prisma().newsArticle.findUniqueOrThrow({ where: { sourceId: 101n }, select: { id: true } });
    const who = await editor();
    const category = await prisma().newsCategory.findUniqueOrThrow({ where: { sourceId: 5n }, select: { id: true } });
    const saved = await getNewsAdmin().save({
      id: edited.id,
      editorId: who,
      action: 'draft',
      publishAt: null,
      now: new Date(),
      input: {
        slug: null,
        th: { title: 'แก้', excerpt: 'ส', bodyHtml: '<p>x</p>' },
        en: null,
        categoryIds: [category.id],
        tagNames: [],
        productIds: [],
        bylineName: 'ทีมงาน',
      },
    });
    expect(saved.ok).toBe(true);
    const written = await getNewsAdmin().save({
      id: null,
      editorId: who,
      action: 'draft',
      publishAt: null,
      now: new Date(),
      input: {
        slug: null,
        th: { title: 'เขียนเอง', excerpt: 'ส', bodyHtml: '<p>x</p>' },
        en: null,
        categoryIds: [category.id],
        tagNames: [],
        productIds: [],
        bylineName: 'ทีมงาน',
      },
    });
    expect(written.ok).toBe(true);

    // The old site's news category becomes excluded; the sources are unchanged.
    expect(await run([post(101), post(102)], false, { excluded: ['news'], unlisted: [] })).toMatchObject({ outcome: 'succeeded' });

    const untouched = await prisma().newsArticle.findUniqueOrThrow({ where: { id: edited.id }, include: { categories: true } });
    expect(untouched.deletedAt).toBeNull();
    expect(untouched.categories).toHaveLength(1);
    const own = await prisma().newsArticle.findUniqueOrThrow({ where: { id: (written as { data: { id: string } }).data.id }, include: { categories: true } });
    expect(own.categories).toHaveLength(1);
    // The unedited imported article is hidden and unlinked, as before.
    const plain = await prisma().newsArticle.findUniqueOrThrow({ where: { sourceId: 102n }, include: { categories: true } });
    expect(plain.deletedAt).not.toBeNull();
    expect(plain.categories).toHaveLength(0);
  });

  it('a staff save committing while the import runs is not overwritten (the row is locked first)', async () => {
    await run([post(101)]);
    const imported = await prisma().newsArticle.findUniqueOrThrow({ where: { sourceId: 101n }, select: { id: true } });
    const editorId = await editor();

    const holder = new Client({ connectionString: getDatabaseUrl() });
    await holder.connect();
    try {
      // The "staff save": holds the row, then commits its edit after the import has started.
      await holder.query('BEGIN');
      await holder.query('SELECT id FROM news_article WHERE id = $1 FOR UPDATE', [imported.id]);
      const importing = run([post(101, { modified_gmt: '2026-02-01T00:00:00', title: { rendered: 'จากเว็บเก่า' } })]);
      const deadline = Date.now() + 10_000;
      for (;;) {
        const waiting = await prisma().$queryRaw<{ n: number }[]>`
          SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`;
        if ((waiting[0]?.n ?? 0) >= 1) break;
        if (Date.now() > deadline) throw new Error('the import never waited on the row');
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      await holder.query(
        `UPDATE news_article_translation SET title = 'แก้โดยทีมงาน' WHERE article_id = $1`,
        [imported.id],
      );
      await holder.query('UPDATE news_article SET updated_by_staff_id = $2 WHERE id = $1', [imported.id, editorId]);
      await holder.query('COMMIT');

      expect(await importing).toMatchObject({ updated: 0, skippedStaffEdits: 1 });
    } finally {
      await holder.query('ROLLBACK').catch(() => undefined);
      await holder.end();
    }
    const kept = await prisma().newsArticle.findUniqueOrThrow({ where: { id: imported.id }, include: { translations: true } });
    expect(kept.translations[0]?.title).toBe('แก้โดยทีมงาน');
  });
});
