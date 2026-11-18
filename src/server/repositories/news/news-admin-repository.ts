import { Prisma } from '@/generated/prisma/client';
import { NEWS_CATEGORY_LOCK_KEY } from '@/server/repositories/shared/advisory-lock';
import { getPrisma } from '@/server/repositories/shared/prisma';
import type {
  AdminArticleFilter,
  AdminArticleListRecord,
  AdminArticleRecord,
  ArticleTranslationInput,
  ArticleWrite,
  NewsCategoryCreateOutcome,
  NewsCategoryOption,
  NewsCategoryWrite,
} from '@/server/services/news/news-admin-service';

const TRANSACTION_TIMEOUT_MS = 20_000;
/** A save that loses a slug race to another save at the same moment is retried with the new picture. */
const SAVE_ATTEMPTS = 3;
/** Serialises slug allocation between staff saves (transaction-level, released at commit); distinct from the import's key. */
const NEWS_SLUG_LOCK_KEY = 6_251_016;

function where(filter: AdminArticleFilter): Prisma.NewsArticleWhereInput {
  const clauses: Prisma.NewsArticleWhereInput[] = [
    filter.status === 'trash' ? { deletedAt: { not: null } } : { deletedAt: null },
  ];
  if (filter.status === 'draft') clauses.push({ status: 'draft' });
  if (filter.status === 'published') clauses.push({ status: 'published', publishedAt: { lte: filter.now } });
  if (filter.status === 'scheduled') clauses.push({ status: 'published', publishedAt: { gt: filter.now } });
  if (filter.categoryId !== null) clauses.push({ categories: { some: { categoryId: filter.categoryId } } });
  if (filter.query !== '') clauses.push({ translations: { some: { title: { contains: filter.query, mode: 'insensitive' } } } });
  return { AND: clauses };
}

/** One page of articles, newest `updated_at` first (then id, so pages never overlap), and the total. */
export async function listAdminArticles(
  filter: AdminArticleFilter,
): Promise<{ total: number; rows: AdminArticleListRecord[] }> {
  const prisma = getPrisma();
  const [total, rows] = await Promise.all([
    prisma.newsArticle.count({ where: where(filter) }),
    prisma.newsArticle.findMany({
      where: where(filter),
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      skip: filter.skip,
      take: filter.take,
      select: {
        id: true,
        slug: true,
        status: true,
        publishedAt: true,
        bylineName: true,
        sourceId: true,
        updatedAt: true,
        deletedAt: true,
        updatedBy: { select: { firstName: true } },
        translations: { select: { locale: true, title: true } },
        categories: { select: { categoryId: true } },
      },
    }),
  ]);
  return {
    total,
    rows: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      status: row.status,
      publishedAt: row.publishedAt,
      titles: Object.fromEntries(row.translations.map((t) => [t.locale, t.title])),
      categoryIds: row.categories.map((link) => link.categoryId),
      bylineName: row.bylineName,
      lastEditorName: row.updatedBy?.firstName ?? null,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      isImported: row.sourceId !== null,
    })),
  };
}

/** One article with its bodies, tags and links, trashed or not; null when there is none. */
export async function findAdminArticle(id: string): Promise<AdminArticleRecord | null> {
  const row = await getPrisma().newsArticle.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      status: true,
      publishedAt: true,
      bylineName: true,
      featuredImageUrl: true,
      featuredImageKey: true,
      sourceId: true,
      deletedAt: true,
      updatedAt: true,
      updatedBy: { select: { firstName: true } },
      translations: { select: { locale: true, title: true, excerpt: true, bodyHtml: true } },
      categories: { select: { categoryId: true } },
      tags: { select: { tag: { select: { name: true } } } },
      products: { select: { productId: true } },
    },
  });
  if (row === null) return null;
  const translation = (locale: 'th' | 'en'): ArticleTranslationInput | null => {
    const found = row.translations.find((t) => t.locale === locale);
    return found === undefined ? null : { title: found.title, excerpt: found.excerpt, bodyHtml: found.bodyHtml };
  };
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    publishedAt: row.publishedAt,
    bylineName: row.bylineName,
    featuredImageUrl: row.featuredImageUrl,
    featuredImageKey: row.featuredImageKey,
    isImported: row.sourceId !== null,
    deletedAt: row.deletedAt,
    updatedAt: row.updatedAt,
    lastEditorName: row.updatedBy?.firstName ?? null,
    th: translation('th'),
    en: translation('en'),
    categoryIds: row.categories.map((link) => link.categoryId),
    tagNames: row.tags.map((link) => link.tag.name).sort((a, b) => a.localeCompare(b)),
    productIds: row.products.map((link) => link.productId),
  };
}

export async function findExistingCategoryIds(ids: readonly string[]): Promise<string[]> {
  const rows = await getPrisma().newsCategory.findMany({ where: { id: { in: [...ids] } }, select: { id: true } });
  return rows.map((row) => row.id);
}

export async function findListedCategoryIds(ids: readonly string[]): Promise<string[]> {
  const rows = await getPrisma().newsCategory.findMany({ where: { id: { in: [...ids] }, isListed: true }, select: { id: true } });
  return rows.map((row) => row.id);
}

export async function findExistingProductIds(ids: readonly string[]): Promise<string[]> {
  const rows = await getPrisma().product.findMany({ where: { id: { in: [...ids] } }, select: { id: true } });
  return rows.map((row) => row.id);
}

export async function findEditorFirstName(editorId: string): Promise<string | null> {
  const row = await getPrisma().customer.findUnique({ where: { id: editorId }, select: { firstName: true } });
  return row?.firstName ?? null;
}

/**
 * The slug to store: `base`, or `base-2`, `base-3`, … the first no other article holds, imported or not
 * (staff slugs take `-2`, `-3`; the import's own `-{source_id}` rule, D-136, is separate). The article's
 * own current slug counts as free.
 */
async function uniqueSlug(tx: Prisma.TransactionClient, base: string, ownId: string | null): Promise<string> {
  const holders = await tx.newsArticle.findMany({
    where: { slug: { startsWith: base }, ...(ownId === null ? {} : { id: { not: ownId } }) },
    select: { slug: true },
  });
  const taken = new Set(holders.map((row) => row.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** The ids of the tags with these names, creating the ones that are new; `name_key` is computed by the database. */
async function tagIdsFor(tx: Prisma.TransactionClient, names: readonly string[]): Promise<string[]> {
  if (names.length === 0) return [];
  const list = [...names];
  await tx.$executeRaw`
    INSERT INTO news_tag (name, name_key)
    SELECT n, lower(n) FROM unnest(${list}::text[]) AS n
    ON CONFLICT (name_key) DO NOTHING`;
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id::text AS id FROM news_tag
    WHERE name_key IN (SELECT lower(n) FROM unnest(${list}::text[]) AS n)`;
  return rows.map((row) => row.id);
}

/**
 * The cover columns a save writes (plan 017, D-277, D-278): an uploaded key clears an imported URL, `none` clears both,
 * `unchanged` writes neither (a new article then has none). Never deletes an object from storage (D-279).
 */
function coverFields(choice: ArticleWrite['featuredImage']): { featuredImageKey?: string | null; featuredImageUrl?: null } {
  if (choice.kind === 'media') return { featuredImageKey: choice.key, featuredImageUrl: null };
  if (choice.kind === 'none') return { featuredImageKey: null, featuredImageUrl: null };
  return {};
}

async function saveOnce(write: ArticleWrite): Promise<{ id: string; slug: string } | null> {
  return getPrisma().$transaction(
    async (tx) => {
      // Two saves at once would both pick the same free slug; this makes the second wait and see the first.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${NEWS_SLUG_LOCK_KEY}::bigint)`;
      let id = write.id;
      if (id !== null) {
        const current = await tx.newsArticle.findFirst({ where: { id, deletedAt: null }, select: { slug: true } });
        if (current === null) return null;
      }
      const slug = write.slug === null && id !== null
        ? (await tx.newsArticle.findUniqueOrThrow({ where: { id }, select: { slug: true } })).slug
        : await uniqueSlug(tx, write.slug ?? 'news', id);

      const fields = {
        slug,
        status: write.status,
        publishedAt: write.publishedAt,
        bylineName: write.bylineName,
        updatedByStaffId: write.editorId,
        ...coverFields(write.featuredImage),
      };
      if (id === null) {
        const created = await tx.newsArticle.create({
          data: { ...fields, createdByStaffId: write.editorId, authorStaffId: write.editorId },
          select: { id: true },
        });
        id = created.id;
      } else {
        await tx.newsArticle.update({ where: { id }, data: fields });
      }

      for (const [locale, translation] of [['th', write.th], ['en', write.en]] as const) {
        if (translation === null) {
          await tx.newsArticleTranslation.deleteMany({ where: { articleId: id, locale } });
          continue;
        }
        await tx.newsArticleTranslation.upsert({
          where: { articleId_locale: { articleId: id, locale } },
          create: { articleId: id, locale, ...translation },
          update: translation,
        });
      }

      await tx.newsArticleCategory.deleteMany({ where: { articleId: id, categoryId: { notIn: write.categoryIds } } });
      await tx.newsArticleCategory.createMany({
        data: write.categoryIds.map((categoryId) => ({ articleId: id as string, categoryId })),
        skipDuplicates: true,
      });

      const tagIds = await tagIdsFor(tx, write.tagNames);
      await tx.newsArticleTag.deleteMany({ where: { articleId: id, tagId: { notIn: tagIds } } });
      await tx.newsArticleTag.createMany({
        data: tagIds.map((tagId) => ({ articleId: id as string, tagId })),
        skipDuplicates: true,
      });

      await tx.newsArticleProduct.deleteMany({ where: { articleId: id, productId: { notIn: write.productIds } } });
      await tx.newsArticleProduct.createMany({
        data: write.productIds.map((productId) => ({ articleId: id as string, productId })),
        skipDuplicates: true,
      });

      return { id, slug };
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );
}

/**
 * Saves an article, its two translations, categories, tags and product links in one transaction; a link
 * not in the write is removed. Sets `updated_by_staff_id`, and `created_by_staff_id` and `author_staff_id`
 * on create. An imported article's `source_id` and `source_url` are never touched; its cover changes only when the
 * write's `featuredImage` says so (D-278). Returns
 * null for an id that names no live article. A lost slug race (two saves at once) is retried.
 */
export async function saveArticle(write: ArticleWrite): Promise<{ id: string; slug: string } | null> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await saveOnce(write);
    } catch (error) {
      const raceOnSlug = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
      if (!raceOnSlug || attempt >= SAVE_ATTEMPTS) throw error;
    }
  }
}

/**
 * Sets (`deletedAt` given) or clears (null) `deleted_at` and records the editor in `updated_by_staff_id`,
 * so the import leaves a trashed or restored imported article alone (D-236). False when there is no such article.
 */
export async function setArticleDeleted(id: string, editorId: string, deletedAt: Date | null): Promise<boolean> {
  const result = await getPrisma().newsArticle.updateMany({
    where: { id },
    data: { deletedAt, updatedByStaffId: editorId },
  });
  return result.count > 0;
}

/** The `-2`, `-3`, … rule of article slugs, among categories: the first of `base`, `base-2`, … no category holds. */
async function uniqueCategorySlug(tx: Prisma.TransactionClient, base: string): Promise<string> {
  const holders = await tx.newsCategory.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } });
  const taken = new Set(holders.map((row) => row.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}

function categoryOption(row: {
  id: string;
  slug: string;
  isListed: boolean;
  translations: { locale: 'th' | 'en'; name: string }[];
}): NewsCategoryOption {
  const name = (locale: 'th' | 'en') => row.translations.find((t) => t.locale === locale)?.name;
  const en = name('en');
  return { id: row.id, slug: row.slug, isListed: row.isListed, names: { th: name('th') ?? '', ...(en === undefined ? {} : { en }) } };
}

async function createCategoryOnce(write: NewsCategoryWrite): Promise<NewsCategoryCreateOutcome> {
  return getPrisma().$transaction(
    async (tx) => {
      // Two creates at once would both pass the duplicate check and pick the same slug and position; the second waits.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${NEWS_CATEGORY_LOCK_KEY}::bigint)`;
      // The stored name compared as the service compares a new one: spacing collapsed, trimmed, lower-cased.
      const [duplicate] = await tx.$queryRaw<{ id: string }[]>`
        SELECT c.id::text AS id
        FROM news_category c
        JOIN news_category_translation t ON t.category_id = c.id AND t.locale = 'th'
        WHERE lower(btrim(regexp_replace(t.name, '[[:space:]]+', ' ', 'g'))) = ${write.nameKey}
        ORDER BY c.is_listed DESC, c.position ASC
        LIMIT 1`;
      const select = { id: true, slug: true, isListed: true, translations: { select: { locale: true, name: true } } } as const;
      if (duplicate !== undefined) {
        const row = await tx.newsCategory.findUniqueOrThrow({ where: { id: duplicate.id }, select });
        return { status: 'duplicate', category: categoryOption(row) };
      }

      const slug = await uniqueCategorySlug(tx, write.slug);
      const { _max } = await tx.newsCategory.aggregate({ _max: { position: true } });
      const row = await tx.newsCategory.create({
        data: {
          slug,
          parentId: null,
          position: (_max.position ?? 0) + 1,
          sourceId: null,
          isListed: true,
          translations: {
            create: [{ locale: 'th', name: write.th }, ...(write.en === null ? [] : [{ locale: 'en' as const, name: write.en }])],
          },
        },
        select,
      });
      return { status: 'created', category: categoryOption(row) };
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );
}

/**
 * Creates a staff-made news category (D-254) in one transaction under `NEWS_CATEGORY_LOCK_KEY`: listed, top level, last
 * (`position` = the highest + 1), `source_id` null so the import, which matches by `source_id`, never touches it, with its
 * Thai name and, when given, its English one. A category whose Thai name has `nameKey` is returned as a duplicate and
 * nothing is written. The slug is `slug`, else `slug-2`, `slug-3`, …; the import does not take this lock, so a slug it
 * takes at the same moment is a unique violation, and the create is retried.
 */
export async function createNewsCategory(write: NewsCategoryWrite): Promise<NewsCategoryCreateOutcome> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await createCategoryOnce(write);
    } catch (error) {
      const raceOnSlug = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
      if (!raceOnSlug || attempt >= SAVE_ATTEMPTS) throw error;
    }
  }
}
