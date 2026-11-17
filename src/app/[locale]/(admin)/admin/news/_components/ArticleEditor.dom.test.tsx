// @vitest-environment jsdom
import type { Editor } from '@tiptap/core';
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '../../../../../../../messages/en.json';
import ArticleEditor, { type EditorArticle } from './ArticleEditor';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => {} }) }));

const ARTICLE_ID = '77777777-7777-4777-8777-777777777777';
const STORED = '<p>Kept</p><dl><dt>Term</dt><dd>Meaning</dd></dl>';
let article: EditorArticle = {
  id: '44444444-4444-4444-8444-444444444444',
  slug: 'a',
  status: 'draft',
  publishedAt: null,
  bylineName: 'Nok',
  featuredImageUrl: null,
  th: { title: 'T', excerpt: 'E', bodyHtml: STORED },
  en: null,
  categoryIds: [],
  tagNames: [],
  products: [],
};

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function withBody(bodyHtml: string): void {
  article = { ...article, th: { ...article.th, bodyHtml } };
}

async function mount(
  save: (previous: unknown, formData: FormData) => Promise<never>,
  options: {
    article?: EditorArticle | null;
    categories?: { id: string; name: string; unlisted?: boolean }[];
    createCategory?: (locale: string, input: { thName: string; enName: string }) => Promise<never>;
  } = {},
) {
  await act(async () => {
    root.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Bangkok">
        <ArticleEditor locale="en" article={options.article === undefined ? article : options.article} categories={options.categories ?? []} defaultByline="Nok" actions={{ save: save as never, trash: async () => ({ status: 'idle' }), search: async () => [], createCategory: options.createCategory }} />
      </NextIntlClientProvider>,
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

describe('ArticleEditor', () => {
  it('submits a locked body exactly as stored, with the rest of the form editable', async () => {
    const save = vi.fn(async () => ({ status: 'idle' }) as never);
    await mount(save);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect((container.querySelector('input[name="thBodyHtml"]') as HTMLInputElement).value).toBe(STORED);
    expect((container.querySelector('#th-title') as HTMLInputElement).disabled).toBe(false);
    await act(async () => container.querySelector<HTMLButtonElement>('button[value="draft"]')!.click());
    const sent = (save.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(sent.get('thBodyHtml')).toBe(STORED);
  });

  it('sends an empty English body as empty, and disables the buttons while a save runs', async () => {
    let finish: () => void = () => {};
    const save = vi.fn(() => new Promise<never>((resolve) => { finish = () => resolve({ status: 'idle' } as never); }));
    await mount(save);
    await act(async () => container.querySelector<HTMLButtonElement>('button[value="draft"]')!.click());
    expect((save.mock.calls[0] as unknown as [unknown, FormData])[1].get('enBodyHtml')).toBe('');
    expect(container.querySelector<HTMLButtonElement>('button[value="draft"]')!.disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('button[value="publish"]')!.disabled).toBe(true);
    await act(async () => finish());
    expect(container.querySelector<HTMLButtonElement>('button[value="draft"]')!.disabled).toBe(false);
  });

  // A locked body must be saved as stored even when the editor itself changes: StarterKit's trailing-node rule and a split
  // figure both rewrite the document on a selection-only transaction.
  it.each([
    ['a table with thead and tfoot', '<p>Intro text</p><table><thead><tr><th>H</th></tr></thead><tbody><tr><td>B</td></tr></tbody><tfoot><tr><td>F</td></tr></tfoot></table>'],
    ['a figure with two pictures', '<figure><img src="https://old.example/1.jpg" alt="1"><img src="https://old.example/2.jpg" alt="2"></figure>'],
  ])('submits %s exactly as stored after a click or a selection inside it', async (_name, stored) => {
    withBody(stored);
    const save = vi.fn(async () => ({ status: 'idle' }) as never);
    await mount(save);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    const editor = (container.querySelector('.ProseMirror') as unknown as { editor: Editor }).editor;
    await act(async () => {
      editor.commands.selectAll();
      editor.commands.setTextSelection({ from: 1, to: 3 });
      editor.commands.setNodeSelection(1);
      editor.commands.focus('end');
      document.dispatchEvent(new Event('selectionchange'));
    });
    await act(async () => container.querySelector<HTMLButtonElement>('button[value="draft"]')!.click());
    expect((save.mock.calls[0] as unknown as [unknown, FormData])[1].get('thBodyHtml')).toBe(stored);
  });

  it('writes in Thai only (D-260): no language switch, no English fields, and a stored English version is sent back unchanged', async () => {
    const stored = { title: 'English title', excerpt: 'English summary', bodyHtml: '<p>English body</p>' };
    const save = vi.fn(async () => ({ status: 'idle' }) as never);
    await mount(save, { article: { ...article, th: { title: 'T', excerpt: 'E', bodyHtml: '<p>Thai</p>' }, en: stored } });
    expect(container.querySelector('[aria-label="Article language"], #en-title, #en-excerpt')).toBeNull();
    expect(container.textContent).not.toContain('English');
    expect(container.querySelectorAll('.ProseMirror')).toHaveLength(1);
    await act(async () => container.querySelector<HTMLButtonElement>('button[value="draft"]')!.click());
    const sent = (save.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect([sent.get('enTitle'), sent.get('enExcerpt'), sent.get('enBodyHtml')]).toEqual([stored.title, stored.excerpt, stored.bodyHtml]);
  });

  it('marks the fields publishing needs with a red star and a spoken note: the Thai summary and the categories', async () => {
    await mount(vi.fn(async () => ({ status: 'idle' }) as never));
    const note = 'Required to publish';
    const thLabel = container.querySelector('label[for="th-excerpt"]')!;
    const categoriesHeading = [...container.querySelectorAll('h2')].find((h) => h.textContent?.startsWith('Categories'))!;
    for (const marked of [thLabel, categoriesHeading]) {
      expect(marked.querySelector('[aria-hidden="true"]')?.textContent).toBe('*');
      expect(marked.querySelector('.sr-only')?.textContent).toBe(note);
    }
    expect((container.querySelector('#th-excerpt') as HTMLTextAreaElement).required).toBe(false);
  });

  it('keeps an article\'s unlisted categories: shown checked and marked, submitted unless unticked, never offered otherwise', async () => {
    const LISTED = '55555555-5555-4555-8555-555555555555';
    const UNLISTED = '66666666-6666-4666-8666-666666666666';
    article = { ...article, categoryIds: [UNLISTED] };
    const save = vi.fn(async () => ({ status: 'idle' }) as never);
    await mount(save, { categories: [{ id: LISTED, name: 'News' }, { id: UNLISTED, name: 'Uncategorized', unlisted: true }] });
    const boxes = [...container.querySelectorAll<HTMLInputElement>('input[name="categoryId"]')];
    expect(boxes.map((box) => [box.value, box.checked])).toEqual([[LISTED, false], [UNLISTED, true]]);
    expect(container.textContent).toContain('Uncategorized (not listed)');
    await act(async () => container.querySelector<HTMLButtonElement>('button[value="draft"]')!.click());
    expect((save.mock.calls[0] as unknown as [unknown, FormData])[1].getAll('categoryId')).toEqual([UNLISTED]);
  });

  it('shows a scheduled article time in Bangkok and submits it unchanged when untouched', async () => {
    const scheduled: EditorArticle = { ...article, status: 'scheduled', publishedAt: '2026-12-28T02:07:00.000Z', categoryIds: [] };
    const save = vi.fn(async () => ({ status: 'idle' }) as never);
    await mount(save, { article: scheduled });
    const later = container.querySelector<HTMLInputElement>('input[type="radio"][name="when"][value="later"]')!;
    expect(later.checked).toBe(true);
    expect(container.querySelector('#publish-at')!.textContent).toContain('28 Dec 2026 · 09:07');
    await act(async () => container.querySelector<HTMLButtonElement>('button[value="publish"]')!.click());
    const sent = (save.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(sent.get('when')).toBe('later');
    expect(sent.get('publishAt')).toBe('2026-12-28T09:07');
  });

  it('sends "publish later" with the date left empty, so the server can refuse it, and caps title and slug at 300', async () => {
    article = { ...article, status: 'draft', categoryIds: [] };
    const save = vi.fn(async () => ({ status: 'idle' }) as never);
    await mount(save);
    // A two-choice switch of radio buttons (no dropdown), "now" picked first, labelled by its group.
    const group = container.querySelector('[role="radiogroup"]')!;
    expect(group.getAttribute('aria-labelledby')).not.toBeNull();
    const choices = [...group.querySelectorAll<HTMLInputElement>('input[type="radio"][name="when"]')];
    expect(choices.map((choice) => [choice.value, choice.checked])).toEqual([['now', true], ['later', false]]);
    expect(container.querySelector('select#when')).toBeNull();
    expect(container.querySelector('#publish-at')).toBeNull();
    await act(async () => choices[1]!.click());
    // The date and time come from the calendar popover (DateTimePicker, D-256), not a native date-time input.
    const picker = container.querySelector<HTMLButtonElement>('#publish-at')!;
    expect(picker.tagName).toBe('BUTTON');
    expect(picker.getAttribute('aria-labelledby')).toBe('publish-at-label publish-at');
    expect(container.querySelector('input[type="datetime-local"]')).toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('button[value="publish"]')!.click());
    const sent = (save.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(sent.get('when')).toBe('later');
    expect(sent.get('publishAt')).toBe('');
    expect(container.querySelector<HTMLInputElement>('#th-title')!.maxLength).toBe(300);
    expect(container.querySelector<HTMLInputElement>('#slug')!.maxLength).toBe(300);
  });

  it('keeps the buttons disabled after a new article is created, until the page moves on', async () => {
    const save = vi.fn(async () => ({ status: 'saved', id: ARTICLE_ID, slug: 's', action: 'draft' }) as never);
    await mount(save, { article: null });
    await act(async () => container.querySelector<HTMLButtonElement>('button[value="draft"]')!.click());
    expect(save).toHaveBeenCalledTimes(1);
    expect(container.querySelector<HTMLButtonElement>('button[value="draft"]')!.disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('button[value="publish"]')!.disabled).toBe(true);
  });
});

/** A stand-in for the browser's `BroadcastChannel`: records what the editor posts, and lets a test speak as the preview tab. */
class FakeChannel {
  static all: FakeChannel[] = [];
  posted: unknown[] = [];
  closed = false;
  onmessage: ((event: MessageEvent) => void) | null = null;
  constructor(readonly name: string) {
    FakeChannel.all.push(this);
  }
  postMessage(data: unknown): void {
    this.posted.push(data);
  }
  close(): void {
    this.closed = true;
  }
  /** A message from the preview tab. */
  receive(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent);
  }
}

const SESSION = '99999999-9999-4999-8999-999999999999';
const wait = (ms: number) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)));

function type(input: HTMLInputElement, value: string): Promise<void> {
  return act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const previewButton = () => [...container.querySelectorAll('button')].find((button) => button.textContent === 'Preview')!;
const drafts = (channel: FakeChannel) => channel.posted.filter((message) => (message as { type: string }).type === 'draft') as { draft: Record<string, unknown> }[];

describe('ArticleEditor: the live preview (D-253)', () => {
  let open: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    FakeChannel.all = [];
    window.sessionStorage.clear();
    vi.stubGlobal('BroadcastChannel', FakeChannel);
    open = vi.fn(() => null);
    vi.stubGlobal('open', open);
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(SESSION);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('offers "Preview" on a new article as a button, and opens no channel before it is pressed', async () => {
    await mount(vi.fn(async () => ({ status: 'idle' }) as never), { article: null });
    expect(previewButton().getAttribute('type')).toBe('button');
    expect(container.querySelector('a[href*="/preview"]')).toBeNull();
    expect(FakeChannel.all).toHaveLength(0);
  });

  it('opens the named preview tab, answers "ready" at once, sends a draft 500 ms after typing stops, and says "closed" on unmount', async () => {
    await mount(vi.fn(async () => ({ status: 'idle' }) as never), { article: null });
    await act(async () => previewButton().click());
    expect(open).toHaveBeenCalledWith(`/en/admin/news/preview?session=${SESSION}`, `tinz-preview-${SESSION}`);
    const [channel] = FakeChannel.all;
    expect(channel!.name).toBe(`tinz-news-preview:${SESSION}`);
    expect(window.sessionStorage.getItem('tinz-news-preview-session')).toBe(SESSION);

    channel!.receive({ type: 'ready' });
    expect(drafts(channel!)).toEqual([
      {
        type: 'draft',
        draft: { articleId: null, contentLanguage: 'th', slug: '', title: '', excerpt: '', bodyHtml: '', bylineName: 'Nok', categoryIds: [], publishedAt: null },
      },
    ]);

    const title = container.querySelector<HTMLInputElement>('#th-title')!;
    await type(title, 'Hel');
    await wait(200);
    await type(title, 'Hello');
    await wait(200);
    expect(drafts(channel!)).toHaveLength(1);
    await wait(450);
    expect(drafts(channel!)).toHaveLength(2);
    expect(drafts(channel!)[1]!.draft).toMatchObject({ title: 'Hello', contentLanguage: 'th' });

    // A second press reuses the same session and the same named tab.
    await act(async () => previewButton().click());
    expect(open).toHaveBeenLastCalledWith(`/en/admin/news/preview?session=${SESSION}`, `tinz-preview-${SESSION}`);
    expect(FakeChannel.all).toHaveLength(1);

    act(() => root.unmount());
    root = createRoot(container);
    expect(channel!.posted.at(-1)).toEqual({ type: 'closed' });
    expect(channel!.closed).toBe(true);
  });

  it('sends a saved article\'s stored body when it is locked, and the article id', async () => {
    withBody(STORED);
    await mount(vi.fn(async () => ({ status: 'idle' }) as never));
    await act(async () => previewButton().click());
    FakeChannel.all[0]!.receive({ type: 'ready' });
    expect(drafts(FakeChannel.all[0]!)[0]!.draft).toMatchObject({ articleId: article.id, bodyHtml: STORED, title: 'T' });
  });

  it('picks up a session made earlier in this browser tab, so an open preview follows the editor to the saved article', async () => {
    window.sessionStorage.setItem('tinz-news-preview-session', SESSION);
    await mount(vi.fn(async () => ({ status: 'idle' }) as never));
    expect(FakeChannel.all.map((channel) => channel.name)).toEqual([`tinz-news-preview:${SESSION}`]);
    await wait(550);
    expect(drafts(FakeChannel.all[0]!)).toHaveLength(1);
    expect(open).not.toHaveBeenCalled();
  });
});

describe('ArticleEditor: add a category (D-254)', () => {
  const LISTED = '55555555-5555-4555-8555-555555555555';
  const NEW = '88888888-8888-4888-8888-888888888888';
  const addButton = () => [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Add category'))!;
  const fields = () => container.querySelectorAll<HTMLInputElement>('[role="group"][aria-label="Add category"] input');

  function press(input: HTMLInputElement, key: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    act(() => {
      input.dispatchEvent(event);
    });
    return event;
  }

  beforeEach(() => {
    article = { ...article, th: { ...article.th, bodyHtml: '<p>Body</p>' }, categoryIds: [] };
  });

  it('opens an inline form that is not a nested form and posts nothing with the article; Enter adds, lists and ticks the new category', async () => {
    const created = { status: 'created', category: { id: NEW, slug: 'guides', isListed: true, names: { th: 'คู่มือ', en: 'Guides' } } };
    const createCategory = vi.fn(async () => created as never);
    const save = vi.fn(async () => ({ status: 'idle' }) as never);
    await mount(save, { categories: [{ id: LISTED, name: 'News' }], createCategory });

    expect(addButton().getAttribute('aria-expanded')).toBe('false');
    await act(async () => addButton().click());
    expect(addButton().getAttribute('aria-expanded')).toBe('true');
    const [th, en] = [...fields()];
    expect(document.activeElement).toBe(th);
    expect(container.querySelectorAll('form form')).toHaveLength(0);
    expect([...fields()].every((input) => !input.hasAttribute('name'))).toBe(true);
    expect(th!.closest('[role="group"]')!.querySelectorAll('button[type="submit"], button:not([type])')).toHaveLength(0);

    await type(th!, ' คู่มือ ');
    await type(en!, 'Guides');
    let enter!: KeyboardEvent;
    await act(async () => {
      enter = press(en!, 'Enter');
    });
    await wait(0);
    expect(enter.defaultPrevented).toBe(true);
    expect(createCategory).toHaveBeenCalledWith('en', { thName: ' คู่มือ ', enName: 'Guides' });
    expect(save).not.toHaveBeenCalled();

    const boxes = [...container.querySelectorAll<HTMLInputElement>('input[name="categoryId"]')];
    expect(boxes.map((box) => [box.value, box.checked])).toEqual([[LISTED, false], [NEW, true]]);
    expect(container.textContent).toContain('Guides');
    expect(fields()).toHaveLength(0);
    expect(document.activeElement).toBe(addButton());
    expect(container.textContent).toContain('Added the category “Guides” and chose it for this article.');

    await act(async () => container.querySelector<HTMLButtonElement>('button[value="draft"]')!.click());
    const sent = (save.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(sent.getAll('categoryId')).toEqual([NEW]);
    expect([...sent.keys()].some((key) => /name/i.test(key) && key !== 'bylineName')).toBe(false);
  });

  it('shows a refusal inline as an alert and keeps the form open; Escape cancels and returns focus', async () => {
    const createCategory = vi.fn(async () => ({ status: 'error', errorKey: 'categoryNameRequired' }) as never);
    await mount(vi.fn(async () => ({ status: 'idle' }) as never), { createCategory });
    await act(async () => addButton().click());
    const add = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Add')!;
    await act(async () => add.click());
    await wait(0);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Enter the category's Thai name.");
    expect(fields()).toHaveLength(2);

    press(fields()[0]!, 'Escape');
    await wait(0);
    expect(fields()).toHaveLength(0);
    expect(document.activeElement).toBe(addButton());
  });

  it('ticks a listed category that already has the name instead of listing it twice', async () => {
    const existing = { status: 'exists', category: { id: LISTED, slug: 'news', isListed: true, names: { th: 'ข่าว', en: 'News' } } };
    await mount(vi.fn(async () => ({ status: 'idle' }) as never), {
      categories: [{ id: LISTED, name: 'News' }],
      createCategory: vi.fn(async () => existing as never),
    });
    await act(async () => addButton().click());
    await type(fields()[0]!, 'ข่าว');
    press(fields()[0]!, 'Enter');
    await wait(0);
    const boxes = [...container.querySelectorAll<HTMLInputElement>('input[name="categoryId"]')];
    expect(boxes.map((box) => [box.value, box.checked])).toEqual([[LISTED, true]]);
    expect(container.textContent).toContain('The category “News” already exists; chose it for this article.');
  });
});
