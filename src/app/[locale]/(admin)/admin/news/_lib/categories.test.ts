import { describe, expect, it } from 'vitest';

import type { NewsCategoryRow } from '@/server/services/news/news-read-service';
import { listedCategoryOptions } from './categories';

const row = (id: string, isListed: boolean, en: string): NewsCategoryRow =>
  ({ id, isListed, names: { th: null, en }, parentId: null, position: 0 }) as unknown as NewsCategoryRow;

describe('listedCategoryOptions', () => {
  const all = [row('a', true, 'News'), row('b', false, 'Uncategorized'), row('c', false, 'Other')];

  it('offers only the listed categories when the article holds none else', () => {
    expect(listedCategoryOptions(all, 'en')).toEqual([{ id: 'a', name: 'News' }]);
  });

  it('adds the unlisted categories the article already holds, marked, and no other unlisted one', () => {
    expect(listedCategoryOptions(all, 'en', ['b'])).toEqual([
      { id: 'a', name: 'News' },
      { id: 'b', name: 'Uncategorized', unlisted: true },
    ]);
  });
});
