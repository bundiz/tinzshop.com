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
  options: { article?: EditorArticle | null; categories?: { id: string; name: string; unlisted?: boolean }[] } = {},
) {
  await act(async () => {
    root.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Bangkok">
        <ArticleEditor locale="en" article={options.article === undefined ? article : options.article} categories={options.categories ?? []} defaultByline="Nok" actions={{ save: save as never, trash: async () => ({ status: 'idle' }), search: async () => [] }} />
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

  it('sends "publish later" with the date left empty, so the server can refuse it, and caps title and slug at 300', async () => {
    article = { ...article, status: 'draft', categoryIds: [] };
    const save = vi.fn(async () => ({ status: 'idle' }) as never);
    await mount(save);
    const when = container.querySelector<HTMLSelectElement>('select#when')!;
    expect(when.name).toBe('when');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(when, 'later');
      when.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => container.querySelector<HTMLButtonElement>('button[value="publish"]')!.click());
    const sent = (save.mock.calls[0] as unknown as [unknown, FormData])[1];
    expect(sent.get('when')).toBe('later');
    expect(sent.get('publishAt')).toBe('');
    expect(container.querySelector<HTMLInputElement>('#th-title')!.maxLength).toBe(300);
    expect(container.querySelector<HTMLInputElement>('#en-title')!.maxLength).toBe(300);
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
