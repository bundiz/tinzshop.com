import type {
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
  /** Embeds the body allow-list removed, summed over every post read this run. */
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
  };
  lock: <T>(task: () => Promise<T>) => Promise<{ acquired: true; value: T } | { acquired: false }>;
};

function errorCodeOf(error: unknown): string {
  return error instanceof NewsSourceError ? error.code : 'unexpected';
}

async function execute(deps: NewsImportDeps): Promise<Exclude<NewsImportSummary, { outcome: 'skipped' }>> {
  const { source, news } = deps;
  const counts: NewsImportCounts = { categories: 0, created: 0, updated: 0, unchanged: 0, failed: 0, removedEmbeds: 0 };

  try {
    // Categories first, so every parent and every linked category exists before the posts.
    const categories = await source.listCategories();
    counts.categories = await news.upsertNewsCategories(categories);

    const known = await news.findArticleSourceStates();
    let page = 1;
    let totalPages = 1;
    do {
      const result = await source.listArticlesPage(page);
      totalPages = result.totalPages;
      counts.failed += result.failures.length;

      for (const article of result.articles) {
        counts.removedEmbeds += article.removedEmbeds;
        // A post whose source time has not moved is not written at all.
        if (known.get(article.sourceId)?.getTime() === article.sourceModifiedAt.getTime()) {
          counts.unchanged += 1;
          continue;
        }
        try {
          counts[await news.upsertNewsArticle(article)] += 1;
        } catch {
          counts.failed += 1;
        }
      }
      page += 1;
    } while (page <= totalPages);

    return { outcome: 'succeeded', ...counts };
  } catch (error) {
    // Posts saved before the failure stay; a re-run picks up the rest. Nothing is ever deleted.
    return { outcome: 'failed', ...counts, errorCode: errorCodeOf(error) };
  }
}

/** One news import run (spec 2026-10-29 §5): categories, then every page of posts, under a lock. */
export async function runNewsImport(deps: NewsImportDeps): Promise<NewsImportSummary> {
  const result = await deps.lock(() => execute(deps));
  return result.acquired ? result.value : { outcome: 'skipped' };
}
