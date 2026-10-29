/**
 * The neutral shapes a news source maps its posts and categories to (spec 2026-10-29 §5). The news
 * service reads only these, so it never names the source. Types only: this file imports nothing.
 */

export type NewsLocale = 'th' | 'en';

export type NewsArticleTranslationSnapshot = {
  locale: NewsLocale;
  title: string;
  /** Plain text, no markup. */
  excerpt: string;
  /** Already sanitised to the allow-list; the only HTML the site renders from data. */
  bodyHtml: string;
};

export type NewsArticleSnapshot = {
  /** The source's post id, matched again by a re-run (`source_id`). */
  sourceId: bigint;
  /** Decoded, never percent-encoded. */
  slug: string;
  /** The post's old address (`source_url`), kept for a future redirect map. */
  sourceUrl: string;
  /** The source's last-modified time, UTC (`source_modified_at`). */
  sourceModifiedAt: Date;
  /** Imported posts are always published. */
  status: 'published';
  /** UTC. */
  publishedAt: Date;
  /** The writer's display name; null when the source has none (the page then shows the fallback). */
  bylineName: string | null;
  /** The old site's image address, or null when the post has no featured image. */
  featuredImageUrl: string | null;
  /** The source ids of the post's categories, in the source's order. */
  categorySourceIds: readonly bigint[];
  translation: NewsArticleTranslationSnapshot;
  /** How many iframe, script, object or embed elements sanitising removed from the body. */
  removedEmbeds: number;
};

export type NewsCategorySnapshot = {
  /** The source's category id (`source_id`). */
  sourceId: bigint;
  /** null for a top-level category. */
  parentSourceId: bigint | null;
  /** Decoded, never percent-encoded. */
  slug: string;
  translation: { locale: NewsLocale; name: string };
};

/** One post the source could not turn into a snapshot; `reason` is a fixed code, never a body or URL. */
export type NewsArticleFailure = { sourceId: bigint; reason: string };

/** One page of the source's posts, as snapshots, with the posts that failed to map. */
export type NewsArticlePage = {
  articles: NewsArticleSnapshot[];
  failures: NewsArticleFailure[];
  /** How many pages the source has; 0 when it has no posts. */
  totalPages: number;
};

/**
 * Where the news import reads from (spec 2026-10-29 §5). The adapter implements it; a failure of the
 * source as a whole is a `NewsSourceError`.
 */
export type NewsSource = {
  /** Every category. */
  listCategories(): Promise<NewsCategorySnapshot[]>;
  /** One page of posts, 1-based. */
  listArticlesPage(page: number): Promise<NewsArticlePage>;
};
