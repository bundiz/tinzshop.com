import { describe, expect, it, vi } from 'vitest';
import type { NewsCardData } from '@/server/services/news/news-read-service';
import { readLatestNewsOrNone } from './read-latest-news';

const card = { slug: 'post-1' } as NewsCardData;

describe('readLatestNewsOrNone', () => {
  it('returns the cards when the read succeeds', async () => {
    const logError = vi.fn();
    expect(await readLatestNewsOrNone(async () => [card], logError)).toEqual([card]);
    expect(logError).not.toHaveBeenCalled();
  });

  it('hides the news section when the read fails, logging the error name only', async () => {
    const logError = vi.fn();
    const failure = new TypeError('connection to postgresql://secret@host failed');

    expect(await readLatestNewsOrNone(async () => Promise.reject(failure), logError)).toEqual([]);
    expect(logError).toHaveBeenCalledWith('landing news read failed: TypeError');
    expect(String(logError.mock.calls[0]?.[0])).not.toContain('secret');
  });

  it('logs a thrown non-error as unknown', async () => {
    const logError = vi.fn();
    expect(await readLatestNewsOrNone(async () => Promise.reject('boom'), logError)).toEqual([]);
    expect(logError).toHaveBeenCalledWith('landing news read failed: unknown');
  });
});
