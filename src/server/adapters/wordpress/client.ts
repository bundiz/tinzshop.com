import { WordPressApiError } from "./errors";
import {
  wpCategoryListSchema,
  wpMediaSchema,
  wpPostListSchema,
  wpUserListSchema,
  type WpCategory,
  type WpPost,
} from "./schemas";

/** Sent with every request, so the old site's owner can tell the import apart (D-133). */
export const NEWS_IMPORT_USER_AGENT = "TinzshopNewsImport/1.0";
const API_PREFIX = "/wp-json/wp/v2";
const PER_PAGE = 100;
const DEFAULT_TIMEOUT_MS = 20_000;

export interface WordPressClientOptions {
  /** The old site's origin, e.g. from `NEWS_IMPORT_SOURCE_URL`. */
  baseUrl: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export interface WordPressClient {
  /** Every category, all pages. */
  listCategories(): Promise<WpCategory[]>;
  /** One page of published posts, and how many pages there are. */
  listPostsPage(page: number, perPage?: number): Promise<{ posts: WpPost[]; totalPages: number }>;
  /** Every author id with its public display name. */
  listAuthors(): Promise<Map<number, string>>;
  /** A media item's file address; null when the id is 0 or the item does not exist. */
  getMedia(id: number): Promise<{ sourceUrl: string } | null>;
}

interface Parser<T> {
  safeParse(
    data: unknown,
  ):
    | { success: true; data: T }
    | { success: false; error: { issues: readonly { path: readonly PropertyKey[]; code: string }[] } };
}

/**
 * Reads the old site's public REST API. Requests run strictly one after another (callers await
 * each), 100 per page. Every response is validated; a failure is a WordPressApiError.
 */
export function createWordPressClient(options: WordPressClientOptions): WordPressClient {
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const base = options.baseUrl.replace(/\/+$/, "");

  async function get(
    path: string,
    query: Record<string, number>,
  ): Promise<{ status: number; headers: Headers; json: unknown }> {
    const url = new URL(`${base}${API_PREFIX}${path}`);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));

    let response: Response;
    let text: string;
    try {
      response = await doFetch(url, {
        method: "GET",
        headers: { "User-Agent": NEWS_IMPORT_USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      text = await response.text();
    } catch (error) {
      // The original error text may contain the URL, so it is not chained.
      const timedOut = error instanceof Error && error.name === "TimeoutError";
      throw new WordPressApiError({ path: errorPath(path), reason: timedOut ? "timeout" : "network_error", httpStatus: 0 });
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new WordPressApiError({
        path: errorPath(path),
        reason: response.ok ? "non_json_response" : "http_error",
        httpStatus: response.status,
      });
    }
    return { status: response.status, headers: response.headers, json };
  }

  function errorPath(path: string): string {
    return `${API_PREFIX}${path}`;
  }

  function requireOk(path: string, status: number): void {
    if (status < 200 || status > 299) {
      throw new WordPressApiError({ path: errorPath(path), reason: "http_error", httpStatus: status });
    }
  }

  function parse<T>(schema: Parser<T>, path: string, status: number, data: unknown): T {
    const result = schema.safeParse(data);
    if (!result.success) {
      const detail = result.error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.map(String).join(".") || "response"}: ${issue.code}`)
        .join("; ");
      throw new WordPressApiError({ path: errorPath(path), reason: "invalid_response", httpStatus: status, detail });
    }
    return result.data;
  }

  function totalPagesOf(path: string, status: number, headers: Headers): number {
    const raw = headers.get("X-WP-TotalPages");
    const n = raw === null ? NaN : Number(raw);
    if (!Number.isSafeInteger(n) || n < 0) {
      throw new WordPressApiError({ path: errorPath(path), reason: "missing_total_pages", httpStatus: status });
    }
    return n;
  }

  async function getPage<T>(
    path: string,
    schema: Parser<T[]>,
    page: number,
    perPage: number,
  ): Promise<{ items: T[]; totalPages: number }> {
    const { status, headers, json } = await get(path, { per_page: perPage, page });
    requireOk(path, status);
    const items = parse(schema, path, status, json);
    return { items, totalPages: totalPagesOf(path, status, headers) };
  }

  async function getAll<T>(path: string, schema: Parser<T[]>): Promise<T[]> {
    const all: T[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const result = await getPage(path, schema, page, PER_PAGE);
      all.push(...result.items);
      totalPages = result.totalPages;
      page += 1;
    } while (page <= totalPages);
    return all;
  }

  return {
    listCategories() {
      return getAll("/categories", wpCategoryListSchema);
    },

    async listPostsPage(page, perPage = PER_PAGE) {
      const { items, totalPages } = await getPage("/posts", wpPostListSchema, page, perPage);
      return { posts: items, totalPages };
    },

    async listAuthors() {
      const users = await getAll("/users", wpUserListSchema);
      return new Map(users.map((user) => [user.id, user.name]));
    },

    async getMedia(id) {
      if (!Number.isSafeInteger(id) || id <= 0) return null;
      const path = `/media/${id}`;
      const { status, json } = await get(path, {});
      if (status === 404) return null;
      requireOk(path, status);
      const media = parse(wpMediaSchema, path, status, json);
      return { sourceUrl: media.source_url };
    },
  };
}
