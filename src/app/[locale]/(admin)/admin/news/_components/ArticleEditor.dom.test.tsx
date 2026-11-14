// @vitest-environment jsdom
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '../../../../../../../messages/en.json';
import ArticleEditor, { type EditorArticle } from './ArticleEditor';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => {} }) }));

const STORED = '<p>Kept</p><dl><dt>Term</dt><dd>Meaning</dd></dl>';
const article: EditorArticle = {
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

async function mount(save: (previous: unknown, formData: FormData) => Promise<never>) {
  await act(async () => {
    root.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Bangkok">
        <ArticleEditor locale="en" article={article} categories={[]} defaultByline="Nok" actions={{ save: save as never, trash: async () => ({ status: 'idle' }), search: async () => [] }} />
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
});
