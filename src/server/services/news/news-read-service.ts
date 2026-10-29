import { pickProductName } from '@/server/services/catalogue/landing-catalogue-service';
import type { NewsLocale } from './news-snapshot';

/** Articles per list page (spec 2026-10-29 §6); on page 1 the first 3 are the feature block (ruling R1, D-134). */
export const NEWS_PAGE_SIZE = 12;

type LocalisedText = { th?: string; en?: string };

/** One news category as the repository returns it; plain data, no Prisma types. */
export type NewsCategoryRow = {
  id: string;
  slug: string;
  parentId: string | null;
  position: number;
  names: LocalisedText;
  /** false: no tab, never a tag or breadcrumb, and its category route is a 404 (D-139). */
  isListed: boolean;
};

/** One live article as the list read returns it. */
export type NewsArticleRow = {
  id: string;
  slug: string;
  publishedAt: Date;
  bylineName: string | null;
  featuredImageUrl: string | null;
  titles: LocalisedText;
  excerpts: LocalisedText;
  categoryIds: string[];
};

/** Which live articles a list read wants: `categoryIds` null means every category, and none. */
export type NewsListFilter = { categoryIds: string[] | null; now: Date; skip: number; take: number };

export type NewsReadRepository = {
  listNewsCategories: () => Promise<NewsCategoryRow[]>;
  /** Every (article, category) link of a live article. */
  listLiveNewsCategoryLinks: (now: Date) => Promise<{ articleId: string; categoryId: string }[]>;
  countLiveNewsArticles: (filter: Omit<NewsListFilter, 'skip' | 'take'>) => Promise<number>;
  /** Live articles, newest `published_at` first, each once. */
  listLiveNewsArticles: (filter: NewsListFilter) => Promise<NewsArticleRow[]>;
};

export type NewsReadDeps = { news: NewsReadRepository; now: () => Date };

/** One article as a card on the list pages (and, in Task 6, the landing page and related articles). */
export type NewsCardData = {
  slug: string;
  /** Plain text: render escaped, never as HTML. */
  title: string;
  /** Plain text. */
  excerpt: string;
  /** Null when the article has none; the page shows `shop.news.bylineFallback`. */
  bylineName: string | null;
  publishedAt: Date;
  featuredImageUrl: string | null;
  /** The article's most specific category, for the card's tag; null when it has none. */
  categoryName: string | null;
};

export type NewsTab = { slug: string; name: string; count: number };

export type NewsListPage = {
  items: NewsCardData[];
  page: number;
  totalPages: number;
  total: number;
  /** Listed categories with at least one live article (their descendants' included), most articles first. */
  categories: NewsTab[];
  activeCategorySlug: string | null;
  /** The active category's name, even when it has no live article (the page heading and title). */
  activeCategoryName: string | null;
};

export type ListNewsInput = { locale: NewsLocale; categorySlug?: string; page: number };

/** The `en` text on `/en`, else the `th` one: the same rule as product names (Q-018 residual). */
function pick(text: LocalisedText, locale: NewsLocale): string {
  return pickProductName({ names: text }, locale);
}

/** Each category's id with the ids of all its descendants; a cycle in the stored tree is cut. */
function subtrees(categories: readonly NewsCategoryRow[]): Map<string, Set<string>> {
  const children = new Map<string, string[]>();
  for (const category of categories) {
    if (category.parentId === null) continue;
    children.set(category.parentId, [...(children.get(category.parentId) ?? []), category.id]);
  }
  const result = new Map<string, Set<string>>();
  for (const category of categories) {
    const seen = new Set<string>();
    const stack = [category.id];
    while (stack.length > 0) {
      const id = stack.pop() as string;
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...(children.get(id) ?? []));
    }
    result.set(category.id, seen);
  }
  return result;
}

/** The article's listed categories (D-139): an unlisted one is never a tag, a breadcrumb or a related key. */
function listedCategories(categoryIds: readonly string[], byId: ReadonlyMap<string, NewsCategoryRow>): NewsCategoryRow[] {
  return categoryIds.map((id) => byId.get(id)).filter((c): c is NewsCategoryRow => c !== undefined && c.isListed);
}

/**
 * The article's most specific listed categories (D-137, D-138, D-139): those that are no ancestor of another
 * of its listed categories, in `position` order; all of them when none qualifies. The one place this rule
 * lives, used for a card's tag and for related articles.
 */
function leafCategories(
  categoryIds: readonly string[],
  byId: ReadonlyMap<string, NewsCategoryRow>,
  tree: ReadonlyMap<string, Set<string>>,
): NewsCategoryRow[] {
  const own = listedCategories(categoryIds, byId);
  const leaves = own.filter(
    (candidate) => !own.some((other) => other.id !== candidate.id && tree.get(candidate.id)?.has(other.id)),
  );
  return [...(leaves.length > 0 ? leaves : own)].sort((a, b) => a.position - b.position);
}

/** Of an article's categories, the most specific one; by `position` when several are. */
function mostSpecific(
  categoryIds: readonly string[],
  byId: ReadonlyMap<string, NewsCategoryRow>,
  tree: ReadonlyMap<string, Set<string>>,
): NewsCategoryRow | null {
  return leafCategories(categoryIds, byId, tree)[0] ?? null;
}

/** One article row as a card, tagged with its most specific category. */
function toCard(
  row: NewsArticleRow,
  byId: ReadonlyMap<string, NewsCategoryRow>,
  tree: ReadonlyMap<string, Set<string>>,
  locale: NewsLocale,
): NewsCardData {
  const tag = mostSpecific(row.categoryIds, byId, tree);
  return {
    slug: row.slug,
    title: pick(row.titles, locale),
    excerpt: pick(row.excerpts, locale),
    bylineName: row.bylineName,
    publishedAt: row.publishedAt,
    featuredImageUrl: row.featuredImageUrl,
    categoryName: tag === null ? null : pick(tag.names, locale),
  };
}

/**
 * One page of the news list (spec 2026-10-29 §6): live articles only, newest first, `NEWS_PAGE_SIZE`
 * a page, optionally filtered to a category and its descendants. Returns `null` for an unknown
 * category or a page that does not exist (past the end, below 1, not an integer); page 1 always
 * exists, empty or not.
 */
export async function listNews(deps: NewsReadDeps, input: ListNewsInput): Promise<NewsListPage | null> {
  if (!Number.isInteger(input.page) || input.page < 1) return null;
  const now = deps.now();
  const categories = await deps.news.listNewsCategories();
  const byId = new Map(categories.map((category) => [category.id, category]));
  const tree = subtrees(categories);

  let active: NewsCategoryRow | null = null;
  if (input.categorySlug !== undefined) {
    // An unlisted category has no page: the same 404 as an unknown one.
    active = categories.find((category) => category.isListed && category.slug === input.categorySlug) ?? null;
    if (active === null) return null;
  }
  const categoryIds = active === null ? null : [...(tree.get(active.id) ?? [active.id])];

  const total = await deps.news.countLiveNewsArticles({ categoryIds, now });
  const totalPages = Math.max(1, Math.ceil(total / NEWS_PAGE_SIZE));
  if (input.page > totalPages) return null;

  const [rows, links] = await Promise.all([
    deps.news.listLiveNewsArticles({
      categoryIds,
      now,
      skip: (input.page - 1) * NEWS_PAGE_SIZE,
      take: NEWS_PAGE_SIZE,
    }),
    deps.news.listLiveNewsCategoryLinks(now),
  ]);

  const articlesByCategory = new Map<string, Set<string>>();
  for (const link of links) {
    const set = articlesByCategory.get(link.categoryId) ?? new Set<string>();
    set.add(link.articleId);
    articlesByCategory.set(link.categoryId, set);
  }
  const tabs = categories
    .filter((category) => category.isListed)
    .map((category) => {
      const articles = new Set<string>();
      for (const id of tree.get(category.id) ?? []) {
        for (const articleId of articlesByCategory.get(id) ?? []) articles.add(articleId);
      }
      return { category, count: articles.size };
    })
    .filter((tab) => tab.count > 0)
    .sort((a, b) => b.count - a.count || a.category.position - b.category.position)
    .map(({ category, count }) => ({ slug: category.slug, name: pick(category.names, input.locale), count }));

  return {
    items: rows.map((row) => toCard(row, byId, tree, input.locale)),
    page: input.page,
    totalPages,
    total,
    categories: tabs,
    activeCategorySlug: active?.slug ?? null,
    activeCategoryName: active === null ? null : pick(active.names, input.locale),
  };
}

// ---- One article, and the landing page's newest (plan 012 Task 6) ----

/** At most this many related articles under an article ("ข่าวที่เกี่ยวข้อง", spec 2026-10-29 §6). */
export const RELATED_NEWS_LIMIT = 3;

/** One live article with its body, as the article read returns it. */
export type NewsArticleDetailRow = NewsArticleRow & {
  /** The stored, already-sanitised `body_html` per locale. */
  bodies: LocalisedText;
};

export type NewsArticleReadDeps = {
  news: Pick<NewsReadRepository, 'listNewsCategories' | 'listLiveNewsArticles'> & {
    /** The live article with this (decoded) slug, or null. */
    findLiveNewsArticle: (slug: string, now: Date) => Promise<NewsArticleDetailRow | null>;
  };
  now: () => Date;
};

export type NewsArticleDetail = {
  slug: string;
  /** Plain text: render escaped, never as HTML. */
  title: string;
  /** Plain text, for the page's meta description. */
  excerpt: string;
  /** Null when the article has none; the page shows `shop.news.bylineFallback`. */
  bylineName: string | null;
  publishedAt: Date;
  featuredImageUrl: string | null;
  /** The stored, already-sanitised body: the only HTML from data the site renders. */
  bodyHtml: string;
  /** The article's own listed categories, in `position` order. */
  categories: { slug: string; name: string }[];
  /** Up to `RELATED_NEWS_LIMIT` other live articles sharing a category, newest first. */
  related: NewsCardData[];
};

export type GetNewsArticleInput = { locale: NewsLocale; slug: string };

/**
 * Up to `RELATED_NEWS_LIMIT` other live articles (D-138): newest first from each of the article's most
 * specific categories in turn, in `position` order (so the card's tag first), then, only when that gives too
 * few, from its other (parent) categories. Almost
 * every post also carries the top-level category, so relating by all of them would show the same newest
 * articles everywhere. Never the article itself, never one twice.
 */
async function relatedArticles(
  deps: NewsArticleReadDeps,
  row: NewsArticleDetailRow,
  byId: ReadonlyMap<string, NewsCategoryRow>,
  tree: ReadonlyMap<string, Set<string>>,
  now: Date,
): Promise<NewsArticleRow[]> {
  const leafIds = leafCategories(row.categoryIds, byId, tree).map((category) => category.id);
  const parentIds = listedCategories(row.categoryIds, byId)
    .map((category) => category.id)
    .filter((id) => !leafIds.includes(id));
  const picked: NewsArticleRow[] = [];
  const seen = new Set([row.id]);
  // One leaf at a time, the card's tag first: a broad leaf such as an "articles" category, carried by most
  // posts, would otherwise crowd out the specific one in a single query.
  for (const categoryIds of [...leafIds.map((id) => [id]), parentIds]) {
    if (picked.length >= RELATED_NEWS_LIMIT || categoryIds.length === 0) continue;
    // Enough to cover the article itself and every one already picked, and still fill the list.
    const candidates = await deps.news.listLiveNewsArticles({
      categoryIds,
      now,
      skip: 0,
      take: RELATED_NEWS_LIMIT + 1,
    });
    for (const candidate of candidates) {
      if (picked.length >= RELATED_NEWS_LIMIT || seen.has(candidate.id)) continue;
      seen.add(candidate.id);
      picked.push(candidate);
    }
  }
  return picked;
}

/**
 * One live article by its decoded slug (spec 2026-10-29 §6), or `null` for an unknown, draft, scheduled or
 * deleted one. Title and body come from the same translation: the `en` one on `/en` when it has a title,
 * else `th` (Q-018 residual).
 */
export async function getNewsArticle(
  deps: NewsArticleReadDeps,
  input: GetNewsArticleInput,
): Promise<NewsArticleDetail | null> {
  const now = deps.now();
  const row = await deps.news.findLiveNewsArticle(input.slug, now);
  if (row === null) return null;

  const categories = await deps.news.listNewsCategories();
  const byId = new Map(categories.map((category) => [category.id, category]));
  const tree = subtrees(categories);
  const useEn = input.locale === 'en' && row.titles.en !== undefined && row.titles.en !== '';
  const fromTranslation = (text: LocalisedText): string => (useEn ? (text.en ?? '') : (text.th ?? text.en ?? ''));

  const related = await relatedArticles(deps, row, byId, tree, now);
  return {
    slug: row.slug,
    title: fromTranslation(row.titles),
    excerpt: fromTranslation(row.excerpts),
    bylineName: row.bylineName,
    publishedAt: row.publishedAt,
    featuredImageUrl: row.featuredImageUrl,
    bodyHtml: fromTranslation(row.bodies),
    categories: listedCategories(row.categoryIds, byId)
      .sort((a, b) => a.position - b.position)
      .map((category) => ({ slug: category.slug, name: pick(category.names, input.locale) })),
    related: related.map((candidate) => toCard(candidate, byId, tree, input.locale)),
  };
}

export type LatestNewsDeps = {
  news: Pick<NewsReadRepository, 'listNewsCategories' | 'listLiveNewsArticles'>;
  now: () => Date;
};

/** The newest live articles as cards, at most `limit`: the landing page's "ข่าวเกมล่าสุด" (D-124). */
export async function listLatestNews(
  deps: LatestNewsDeps,
  input: { locale: NewsLocale; limit: number },
): Promise<NewsCardData[]> {
  const now = deps.now();
  const [categories, rows] = await Promise.all([
    deps.news.listNewsCategories(),
    deps.news.listLiveNewsArticles({ categoryIds: null, now, skip: 0, take: input.limit }),
  ]);
  const byId = new Map(categories.map((category) => [category.id, category]));
  const tree = subtrees(categories);
  return rows.map((row) => toCard(row, byId, tree, input.locale));
}
