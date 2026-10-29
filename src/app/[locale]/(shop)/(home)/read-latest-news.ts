import type { NewsCardData } from '@/server/services/news/news-read-service';

/**
 * The landing page's news read, which must never break the landing page (D-138): on failure the section is
 * hidden and only the error's name is logged, never its message, which can carry connection details.
 */
export async function readLatestNewsOrNone(
  read: () => Promise<NewsCardData[]>,
  logError: (message: string) => void = (message) => console.error(message),
): Promise<NewsCardData[]> {
  try {
    return await read();
  } catch (error) {
    logError(`landing news read failed: ${error instanceof Error ? error.name : 'unknown'}`);
    return [];
  }
}
