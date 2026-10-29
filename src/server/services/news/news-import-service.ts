import type {
  applyExcludedNewsCategories,
  findArticleSourceStates,
  upsertNewsArticle,
  upsertNewsCategories,
} from '@/server/repositories/news/news-repository';
import type { NewsSource } from './news-snapshot';

/** A failure of the news source as a whole (the system behind it is not named here). The code is safe to return. */
export class NewsSourceError extends Error {
  readonly code: string;

  /** `detail` must be as safe as the code: an API path at most, never a URL, query or body. */
  constructor(code: string, detail?: string) {
    super(`News source failed: ${code}${detail === undefined ? '' : ` — ${detail}`}`);
    this.name = 'NewsSourceError';
    this.code = code;
  }
}

type NewsImportCounts = {
  /** Categories read from the source and saved. */
  categories: number;
  created: number;
  updated: number;
  /** Posts whose `source_modified_at` matched, so nothing was written. */
  unchanged: number;
  /** Posts that failed to map or to save; the run carried on without them. */
  failed: number;
  /** Which posts failed and why: the source's fixed reason, or `save_failed`. */
  failedPosts: { sourceId: string; reason: string }[];
  /** Embeds the body allow-list removed from the posts created or updated this run. */
  removedEmbeds: number;
};

export type NewsImportSummary =
  | { outcome: 'skipped' }
  | (NewsImportCounts & { outcome: 'succeeded' })
  /** The run stopped: the source could not be read, or a write failed outside a single post. */
  | (NewsImportCounts & { outcome: 'failed'; errorCode: string });

export type NewsImportDeps = {
  source: NewsSource;
  news: {
    upsertNewsCategories: typeof upsertNewsCategories;
    upsertNewsArticle: typeof upsertNewsArticle;
    findArticleSourceStates: typeof findArticleSourceStates;
    applyExcludedNewsCategories: typeof applyExcludedNewsCategories;
  };
  lock: <T>(task: () => Promise<T>) => Promise<{ acquired: true; value: T } | { acquired: false }>;
  /** Server log; given an error's name and message only, never a URL, query or response body. */
  logError: (message: string) => void;
};

function errorCodeOf(error: unknown): string {
  return error instanceof NewsSourceError ? error.code : 'unexpected';
}

/**
 * What may be logged about an error. Our own `NewsSourceError` message is a fixed code and an API
 * path, so it is kept. Any other error (a database error can embed its query arguments, such as a
 * post's body or URL) is logged by name and, when it has one, its string `code` only, never its message.
 */
function describe(error: unknown): string {
  if (error instanceof NewsSourceError) return `${error.name}: ${error.message}`;
  if (!(error instanceof Error)) return 'non-Error thrown';
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(code) ? `${error.name} ${code}` : error.name;
}

/** `full`: the full re-import (D-140); no post is skipped as unchanged, so every post is read and saved again. */
export type NewsImportOptions = { full: boolean };

async function execute(
  deps: NewsImportDeps,
  { full }: NewsImportOptions,
): Promise<Exclude<NewsImportSummary, { outcome: 'skipped' }>> {
  const { source, news } = deps;
  const counts: NewsImportCounts = {
    categories: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
    failedPosts: [],
    removedEmbeds: 0,
  };
  const fail = (sourceId: bigint, reason: string): void => {
    counts.failed += 1;
    counts.failedPosts.push({ sourceId: sourceId.toString(), reason });
  };

  try {
    // Categories first, so every parent and every linked category exists before the posts.
    const categories = await source.listCategories();
    counts.categories = await news.upsertNewsCategories(categories);
    // The excluded-category rule (D-139) for what is already stored, unchanged posts included, so a
    // re-run corrects them without reading them again. New and changed posts get it below.
    const excluded = new Set(categories.filter((category) => category.isExcluded).map((c) => c.sourceId));
    await news.applyExcludedNewsCategories([...excluded]);

    // A full run treats every post as changed: each is mapped, its image read, saved and re-linked.
    const known = full ? new Map<bigint, Date | null>() : await news.findArticleSourceStates();
    const isUnchanged = (sourceId: bigint, modifiedAt: Date): boolean =>
      !full && known.get(sourceId)?.getTime() === modifiedAt.getTime();

    let page = 1;
    let totalPages = 1;
    do {
      const batch = await source.listArticlesPage(page, isUnchanged);
      totalPages = batch.totalPages;
      counts.unchanged += batch.skipped;
      for (const failure of batch.failures) fail(failure.sourceId, failure.reason);

      for (const article of batch.articles) {
        // A post whose source time has not moved is not written at all.
        if (isUnchanged(article.sourceId, article.sourceModifiedAt)) {
          counts.unchanged += 1;
          continue;
        }
        // Never linked to an excluded category; in excluded categories only, it is not news and is hidden.
        const kept = article.categorySourceIds.filter((sourceId) => !excluded.has(sourceId));
        const hidden = article.categorySourceIds.length > 0 && kept.length === 0;
        try {
          const result = await news.upsertNewsArticle({ ...article, categorySourceIds: kept }, { hidden, full });
          counts[result] += 1;
          if (result !== 'unchanged') counts.removedEmbeds += article.removedEmbeds;
        } catch (error) {
          deps.logError(`news import: post ${article.sourceId} save_failed: ${describe(error)}`);
          fail(article.sourceId, 'save_failed');
        }
      }
      page += 1;
    } while (page <= totalPages);

    return { outcome: 'succeeded', ...counts };
  } catch (error) {
    // Posts saved before the failure stay; a re-run picks up the rest. No row is ever deleted.
    deps.logError(`news import failed: ${describe(error)}`);
    return { outcome: 'failed', ...counts, errorCode: errorCodeOf(error) };
  }
}

/**
 * One news import run (spec 2026-10-29 §5): categories, the excluded-category rule over stored articles
 * (D-139), then every page of posts, under a lock. `full` (D-140) skips no post as unchanged.
 */
export async function runNewsImport(
  deps: NewsImportDeps,
  options: NewsImportOptions = { full: false },
): Promise<NewsImportSummary> {
  const result = await deps.lock(() => execute(deps, options));
  return result.acquired ? result.value : { outcome: 'skipped' };
}
