import { describe, expect, it, vi } from 'vitest';
import { readListedCategoriesOrNone } from './read-articles-menu';

describe('readListedCategoriesOrNone', () => {
  it('returns the listed categories when the read succeeds', async () => {
    const logError = vi.fn();
    const listed = [{ slug: 'reviews', name: 'Reviews' }];
    expect(await readListedCategoriesOrNone(async () => listed, logError)).toEqual(listed);
    expect(logError).not.toHaveBeenCalled();
  });

  it('gives no category when the read fails, logging the error name only, so the header still renders', async () => {
    const logError = vi.fn();
    const failure = new TypeError('connection to postgresql://secret@host failed');
    expect(await readListedCategoriesOrNone(async () => Promise.reject(failure), logError)).toEqual([]);
    expect(logError).toHaveBeenCalledWith('articles menu read failed: TypeError');
    expect(String(logError.mock.calls[0]?.[0])).not.toContain('secret');
  });

  it('logs a thrown non-error as unknown', async () => {
    const logError = vi.fn();
    expect(await readListedCategoriesOrNone(async () => Promise.reject('boom'), logError)).toEqual([]);
    expect(logError).toHaveBeenCalledWith('articles menu read failed: unknown');
  });
});
