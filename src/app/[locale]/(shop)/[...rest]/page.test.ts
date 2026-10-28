import { describe, expect, it } from 'vitest';
import CatchAllPage from './page';

describe('the locale catch-all page', () => {
  it('answers notFound() for every unmatched path', () => {
    expect(() => CatchAllPage()).toThrow(expect.objectContaining({ digest: expect.stringContaining('404') }));
  });
});
