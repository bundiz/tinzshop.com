import { describe, expect, it } from 'vitest';

import { buildPreviewDraft, isPreviewMessage, isPreviewSession, type PreviewDraftInput } from './preview-channel';

const ARTICLE = '44444444-4444-4444-8444-444444444444';

function input(overrides: Partial<PreviewDraftInput> = {}): PreviewDraftInput {
  return {
    articleId: ARTICLE,
    language: 'th',
    th: { title: 'หัวข้อ', excerpt: 'สรุป' },
    en: { title: '', excerpt: '' },
    thBodyHtml: '<p>ไทย</p>',
    enBodyHtml: '',
    slug: '',
    bylineName: 'Nok',
    categoryIds: ['c1'],
    status: 'draft',
    storedPublishedAt: null,
    when: 'now',
    publishAt: '',
    featuredImage: 'none',
    ...overrides,
  };
}

describe('buildPreviewDraft (D-253)', () => {
  it('sends the Thai tab as a save would, dated now', () => {
    expect(buildPreviewDraft(input())).toEqual({
      articleId: ARTICLE,
      contentLanguage: 'th',
      slug: '',
      title: 'หัวข้อ',
      excerpt: 'สรุป',
      bodyHtml: '<p>ไทย</p>',
      bylineName: 'Nok',
      categoryIds: ['c1'],
      publishedAt: null,
      featuredImage: 'none',
    });
  });

  it('sends English when the English tab is on show and has a title or a body, else Thai', () => {
    const withTitle = buildPreviewDraft(input({ language: 'en', en: { title: 'Title', excerpt: 'Sum' } }));
    expect(withTitle).toMatchObject({ contentLanguage: 'en', title: 'Title', excerpt: 'Sum', bodyHtml: '' });
    const withBody = buildPreviewDraft(input({ language: 'en', enBodyHtml: '<p>en</p>' }));
    expect(withBody).toMatchObject({ contentLanguage: 'en', bodyHtml: '<p>en</p>' });
    const empty = buildPreviewDraft(input({ language: 'en', en: { title: '  ', excerpt: 'only a summary' } }));
    expect(empty).toMatchObject({ contentLanguage: 'th', title: 'หัวข้อ', bodyHtml: '<p>ไทย</p>' });
  });

  it('dates the draft by the chosen Thailand time, else a published article\'s stored date, else now', () => {
    expect(buildPreviewDraft(input({ when: 'later', publishAt: '2026-12-01T09:30' })).publishedAt).toBe('2026-12-01T02:30:00.000Z');
    expect(buildPreviewDraft(input({ when: 'later', publishAt: '' })).publishedAt).toBeNull();
    const stored = '2026-11-01T02:00:00.000Z';
    expect(buildPreviewDraft(input({ status: 'published', storedPublishedAt: stored })).publishedAt).toBe(stored);
    expect(buildPreviewDraft(input({ status: 'scheduled', storedPublishedAt: stored, when: 'later', publishAt: 'bad' })).publishedAt).toBe(stored);
    // A scheduled article switched to "now" would go live now.
    expect(buildPreviewDraft(input({ status: 'scheduled', storedPublishedAt: stored, when: 'now' })).publishedAt).toBeNull();
  });
});

describe('the preview channel messages', () => {
  it('accepts the three message shapes only, and a uuid session only', () => {
    expect(isPreviewMessage({ type: 'ready' })).toBe(true);
    expect(isPreviewMessage({ type: 'closed' })).toBe(true);
    expect(isPreviewMessage({ type: 'draft', draft: {} })).toBe(true);
    expect(isPreviewMessage({ type: 'draft' })).toBe(false);
    expect(isPreviewMessage({ type: 'other' })).toBe(false);
    expect(isPreviewMessage('ready')).toBe(false);
    expect(isPreviewMessage(null)).toBe(false);
    expect(isPreviewSession(ARTICLE)).toBe(true);
    expect(isPreviewSession('abc')).toBe(false);
    expect(isPreviewSession(undefined)).toBe(false);
  });
});
