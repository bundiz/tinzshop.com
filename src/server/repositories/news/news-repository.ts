import type { Prisma } from '@/generated/prisma/client';
import { getPrisma } from '@/server/repositories/shared/prisma';
import type {
  NewsArticleDetailRow,
  NewsArticleRow,
  NewsCategoryRow,
  NewsListFilter,
} from '@/server/services/news/news-read-service';
import type { NewsArticleSnapshot, NewsCategorySnapshot } from '@/server/services/news/news-snapshot';

const TRANSACTION_TIMEOUT_MS = 20_000;

export type NewsArticleUpsertResult = 'created' | 'updated' | 'unchanged';

function compareSourceIds(a: bigint, b: bigint): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The slug to store: the snapshot's own, unless another row already holds it, in which case the
 * source id is appended. The same inputs always give the same slug, so a re-run never renames.
 */
function slugFor(snapshot: { slug: string; sourceId: bigint }, holderId: string | null, ownId: string | undefined): string {
  return holderId === null || holderId === ownId ? snapshot.slug : `${snapshot.slug}-${snapshot.sourceId}`;
}

/**
 * Parents before children, whatever order the source listed them in; otherwise source id order. A
 * cycle is cut where it is found (the writer also refuses a parent that would close a loop), and a
 * category that names itself as parent is top level.
 */
function parentsFirst(snapshots: readonly NewsCategorySnapshot[]): NewsCategorySnapshot[] {
  const sorted = [...snapshots].sort((a, b) => compareSourceIds(a.sourceId, b.sourceId));
  const bySourceId = new Map(sorted.map((snapshot) => [snapshot.sourceId, snapshot]));
  const ordered: NewsCategorySnapshot[] = [];
  const seen = new Set<bigint>();
  const visit = (snapshot: NewsCategorySnapshot): void => {
    if (seen.has(snapshot.sourceId)) return;
    seen.add(snapshot.sourceId);
    const parent = snapshot.parentSourceId === null ? undefined : bySourceId.get(snapshot.parentSourceId);
    if (parent !== undefined) visit(parent);
    ordered.push(snapshot);
  };
  for (const snapshot of sorted) visit(snapshot);
  return ordered;
}

/**
 * Saves the source's categories in one transaction, matched by `source_id`, parents first. A new
 * category's `position` is its rank in source id order (ruling R2); an existing one keeps its
 * position, so a later reorder is not undone. A category is written only when its slug, parent,
 * `is_listed` or name changed. Nothing is deleted. Returns how many categories were given.
 */
export async function upsertNewsCategories(snapshots: readonly NewsCategorySnapshot[]): Promise<number> {
  const ordered = parentsFirst(snapshots);
  const position = new Map(
    [...snapshots].sort((a, b) => compareSourceIds(a.sourceId, b.sourceId)).map((s, index) => [s.sourceId, index + 1]),
  );

  await getPrisma().$transaction(
    async (tx) => {
      const existing = await tx.newsCategory.findMany({
        where: { sourceId: { not: null } },
        select: { id: true, sourceId: true, slug: true, parentId: true, isListed: true, translations: true },
      });
      const bySourceId = new Map(existing.map((row) => [row.sourceId as bigint, row]));
      const idBySourceId = new Map(existing.map((row) => [row.sourceId as bigint, row.id]));
      // Every category's parent as it stands in this transaction, to refuse a cycle on any run.
      const parentById = new Map(
        (await tx.newsCategory.findMany({ select: { id: true, parentId: true } })).map((row) => [row.id, row.parentId]),
      );
      const wouldCycle = (id: string, parentId: string): boolean => {
        const visited = new Set<string>();
        for (let at: string | null = parentId; at !== null; at = parentById.get(at) ?? null) {
          if (at === id || visited.has(at)) return true;
          visited.add(at);
        }
        return false;
      };

      for (const snapshot of ordered) {
        const current = bySourceId.get(snapshot.sourceId);
        const wantedParentId =
          snapshot.parentSourceId === null || snapshot.parentSourceId === snapshot.sourceId
            ? null
            : (idBySourceId.get(snapshot.parentSourceId) ?? null);
        // A parent whose ancestors include this category would close a loop: store it top level.
        const parentId =
          wantedParentId !== null && current !== undefined && wouldCycle(current.id, wantedParentId)
            ? null
            : wantedParentId;
        const holder = await tx.newsCategory.findUnique({ where: { slug: snapshot.slug }, select: { id: true } });
        const slug = slugFor(snapshot, holder?.id ?? null, current?.id);
        const { locale, name } = snapshot.translation;

        if (current === undefined) {
          const created = await tx.newsCategory.create({
            data: {
              slug,
              parentId,
              position: position.get(snapshot.sourceId) ?? ordered.length,
              sourceId: snapshot.sourceId,
              isListed: snapshot.isListed,
              translations: { create: { locale, name } },
            },
            select: { id: true },
          });
          idBySourceId.set(snapshot.sourceId, created.id);
          parentById.set(created.id, parentId);
          continue;
        }

        if (current.slug !== slug || current.parentId !== parentId || current.isListed !== snapshot.isListed) {
          await tx.newsCategory.update({
            where: { id: current.id },
            data: { slug, parentId, isListed: snapshot.isListed },
          });
          parentById.set(current.id, parentId);
        }
        if (current.translations.find((t) => t.locale === locale)?.name !== name) {
          await tx.newsCategoryTranslation.upsert({
            where: { categoryId_locale: { categoryId: current.id, locale } },
            create: { categoryId: current.id, locale, name },
            update: { name },
          });
        }
      }
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );
  return snapshots.length;
}

function articleFields(snapshot: NewsArticleSnapshot, slug: string) {
  return {
    slug,
    sourceUrl: snapshot.sourceUrl,
    sourceModifiedAt: snapshot.sourceModifiedAt,
    status: snapshot.status,
    publishedAt: snapshot.publishedAt,
    bylineName: snapshot.bylineName,
    featuredImageUrl: snapshot.featuredImageUrl,
  };
}

/**
 * Saves one post in one transaction, matched by `source_id`: an unchanged `source_modified_at`
 * writes nothing; a changed one updates the article and its `th` translation and re-links its
 * categories; a new one is created. Categories the database does not hold are not linked.
 * `hidden` is the excluded-category rule (D-139): true sets `deleted_at` (an already-set one is kept),
 * false clears it; the import owns `deleted_at` of imported rows before go-live. No staff column is
 * touched, and no article row is ever deleted.
 */
export async function upsertNewsArticle(
  snapshot: NewsArticleSnapshot,
  options: { hidden: boolean },
): Promise<NewsArticleUpsertResult> {
  return getPrisma().$transaction(
    async (tx) => {
      const current = await tx.newsArticle.findUnique({
        where: { sourceId: snapshot.sourceId },
        select: { id: true, sourceModifiedAt: true, deletedAt: true },
      });
      if (current !== null && current.sourceModifiedAt?.getTime() === snapshot.sourceModifiedAt.getTime()) {
        return 'unchanged';
      }

      const holder = await tx.newsArticle.findUnique({ where: { slug: snapshot.slug }, select: { id: true } });
      const slug = slugFor(snapshot, holder?.id ?? null, current?.id);
      const categories = await tx.newsCategory.findMany({
        where: { sourceId: { in: [...snapshot.categorySourceIds] } },
        select: { id: true },
      });
      const categoryIds = categories.map((category) => category.id);
      const { locale, title, excerpt, bodyHtml } = snapshot.translation;

      if (current === null) {
        await tx.newsArticle.create({
          data: {
            ...articleFields(snapshot, slug),
            sourceId: snapshot.sourceId,
            deletedAt: options.hidden ? new Date() : null,
            translations: { create: { locale, title, excerpt, bodyHtml } },
            categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
          },
        });
        return 'created';
      }

      await tx.newsArticle.update({
        where: { id: current.id },
        data: { ...articleFields(snapshot, slug), deletedAt: options.hidden ? (current.deletedAt ?? new Date()) : null },
      });
      await tx.newsArticleTranslation.upsert({
        where: { articleId_locale: { articleId: current.id, locale } },
        create: { articleId: current.id, locale, title, excerpt, bodyHtml },
        update: { title, excerpt, bodyHtml },
      });
      await tx.newsArticleCategory.deleteMany({
        where: { articleId: current.id, categoryId: { notIn: categoryIds } },
      });
      await tx.newsArticleCategory.createMany({
        data: categoryIds.map((categoryId) => ({ articleId: current.id, categoryId })),
        skipDuplicates: true,
      });
      return 'updated';
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );
}

/**
 * The excluded-category rule (D-139) over what is stored, in one transaction, so a re-run corrects
 * articles it skips as unchanged: an imported article whose every category link is to an excluded
 * category gets `deleted_at` (an already-set one is kept); an imported, deleted article with a link to
 * any other category has it cleared; then every link to an excluded category is removed. Only imported
 * rows (`source_id` set) have `deleted_at` touched. No category or article row is deleted. A second run
 * changes nothing.
 */
export async function applyExcludedNewsCategories(excludedSourceIds: readonly bigint[]): Promise<void> {
  await getPrisma().$transaction(
    async (tx) => {
      const excludedIds = (
        await tx.newsCategory.findMany({ where: { sourceId: { in: [...excludedSourceIds] } }, select: { id: true } })
      ).map((category) => category.id);
      await tx.newsArticle.updateMany({
        where: {
          sourceId: { not: null },
          deletedAt: null,
          categories: { some: { categoryId: { in: excludedIds } }, none: { categoryId: { notIn: excludedIds } } },
        },
        data: { deletedAt: new Date() },
      });
      await tx.newsArticle.updateMany({
        where: {
          sourceId: { not: null },
          deletedAt: { not: null },
          categories: { some: { categoryId: { notIn: excludedIds } } },
        },
        data: { deletedAt: null },
      });
      await tx.newsArticleCategory.deleteMany({ where: { categoryId: { in: excludedIds } } });
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );
}

/** Every imported article's `source_modified_at`, by `source_id`, so a re-run can skip unchanged posts. */
export async function findArticleSourceStates(): Promise<ReadonlyMap<bigint, Date | null>> {
  const rows = await getPrisma().newsArticle.findMany({
    where: { sourceId: { not: null } },
    select: { sourceId: true, sourceModifiedAt: true },
  });
  return new Map(rows.map((row) => [row.sourceId as bigint, row.sourceModifiedAt]));
}

// ---- Reads for the storefront news pages (plan 012 Task 5) ----

/** The live-article rule (D-130): published, `published_at` reached, not deleted. */
function liveArticle(now: Date): Prisma.NewsArticleWhereInput {
  return { status: 'published', publishedAt: { lte: now }, deletedAt: null };
}

function liveArticleIn(filter: Pick<NewsListFilter, 'categoryIds' | 'now'>): Prisma.NewsArticleWhereInput {
  return filter.categoryIds === null
    ? liveArticle(filter.now)
    : { ...liveArticle(filter.now), categories: { some: { categoryId: { in: filter.categoryIds } } } };
}

function byLocale<T extends { locale: string }>(rows: readonly T[], value: (row: T) => string): { th?: string; en?: string } {
  return Object.fromEntries(rows.map((row) => [row.locale, value(row)]));
}

/** Every news category with its names and whether it is listed, in `position` order. */
export async function listNewsCategories(): Promise<NewsCategoryRow[]> {
  const rows = await getPrisma().newsCategory.findMany({
    orderBy: [{ position: 'asc' }, { slug: 'asc' }],
    select: {
      id: true,
      slug: true,
      parentId: true,
      position: true,
      isListed: true,
      translations: { select: { locale: true, name: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    parentId: row.parentId,
    position: row.position,
    names: byLocale(row.translations, (t) => t.name),
    isListed: row.isListed,
  }));
}

/** Every (article, category) link of a live article, for the tab counts. */
export async function listLiveNewsCategoryLinks(now: Date): Promise<{ articleId: string; categoryId: string }[]> {
  return getPrisma().newsArticleCategory.findMany({
    where: { article: liveArticle(now) },
    select: { articleId: true, categoryId: true },
  });
}

/** How many live articles match; an article in several of the categories counts once. */
export async function countLiveNewsArticles(filter: Pick<NewsListFilter, 'categoryIds' | 'now'>): Promise<number> {
  return getPrisma().newsArticle.count({ where: liveArticleIn(filter) });
}

/** One page of live articles, newest `published_at` first (then id, so pages never overlap), each once. */
export async function listLiveNewsArticles(filter: NewsListFilter): Promise<NewsArticleRow[]> {
  const rows = await getPrisma().newsArticle.findMany({
    where: liveArticleIn(filter),
    orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
    skip: filter.skip,
    take: filter.take,
    select: {
      id: true,
      slug: true,
      publishedAt: true,
      bylineName: true,
      featuredImageUrl: true,
      translations: { select: { locale: true, title: true, excerpt: true } },
      categories: { select: { categoryId: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    // A live article always has one: the filter requires `published_at <= now`.
    publishedAt: row.publishedAt as Date,
    bylineName: row.bylineName,
    featuredImageUrl: row.featuredImageUrl,
    titles: byLocale(row.translations, (t) => t.title),
    excerpts: byLocale(row.translations, (t) => t.excerpt),
    categoryIds: row.categories.map((link) => link.categoryId),
  }));
}

// ---- Read for the article page (plan 012 Task 6) ----

/** The live article with this decoded slug, with its bodies, or null when there is none or it is not live (D-130). */
export async function findLiveNewsArticle(slug: string, now: Date): Promise<NewsArticleDetailRow | null> {
  const row = await getPrisma().newsArticle.findFirst({
    where: { ...liveArticle(now), slug },
    select: {
      id: true,
      slug: true,
      publishedAt: true,
      bylineName: true,
      featuredImageUrl: true,
      translations: { select: { locale: true, title: true, excerpt: true, bodyHtml: true } },
      categories: { select: { categoryId: true } },
    },
  });
  if (row === null) return null;
  return {
    id: row.id,
    slug: row.slug,
    // A live article always has one: the filter requires `published_at <= now`.
    publishedAt: row.publishedAt as Date,
    bylineName: row.bylineName,
    featuredImageUrl: row.featuredImageUrl,
    titles: byLocale(row.translations, (t) => t.title),
    excerpts: byLocale(row.translations, (t) => t.excerpt),
    bodies: byLocale(row.translations, (t) => t.bodyHtml),
    categoryIds: row.categories.map((link) => link.categoryId),
  };
}
