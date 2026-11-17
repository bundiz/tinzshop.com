// @vitest-environment jsdom
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NewsAdminState } from '@/server/controllers/news/news-admin-controller';
import en from '../../../../../../../messages/en.json';
import ArticleTable, { type ArticleTableRow } from './ArticleTable';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ID = '44444444-4444-4444-8444-444444444444';
const row: ArticleTableRow = {
  id: ID,
  title: 'Switch 2 review',
  categoryNames: ['Reviews'],
  bylineName: 'Nok',
  languages: ['th'],
  status: 'published',
  publishedAt: '2026-11-01T02:00:00.000Z',
  trashed: false,
};

type Action = (previous: NewsAdminState, formData: FormData) => Promise<NewsAdminState>;

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
  document.body.style.overflow = '';
});

function render(rows: ArticleTableRow[], trash: Action = vi.fn<Action>(async () => ({ status: 'done' })), restore: Action = vi.fn<Action>(async () => ({ status: 'done' }))) {
  act(() =>
    root.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Bangkok">
        <ArticleTable locale="en" rows={rows} actions={{ trash, restore }} />
      </NextIntlClientProvider>,
    ),
  );
}

const menuButton = () => container.querySelector<HTMLButtonElement>('button[aria-label="Manage Switch 2 review"]')!;
const menuItems = () => [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];
const confirmDialog = () => document.querySelector<HTMLElement>('[role="alertdialog"]');
const buttonIn = (panel: HTMLElement, text: string) => [...panel.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === text)!;

describe('ArticleTable row menu (D-261)', () => {
  it('keeps the title a link to the editor, and offers Edit (a link) and Move to trash (danger)', () => {
    render([row]);
    expect(container.querySelector(`th a[href="/en/admin/news/${ID}"]`)?.textContent).toBe('Switch 2 review');
    act(() => menuButton().click());
    expect(menuItems().map((item) => item.textContent)).toEqual(['Edit', 'Move to trash']);
    expect(menuItems()[0]!.tagName).toBe('A');
    expect(menuItems()[0]!.getAttribute('href')).toBe(`/en/admin/news/${ID}`);
    expect(menuItems()[1]!.className).toContain('text-sale');
  });

  it('asks to confirm the trash with the editor copy, then posts the id', async () => {
    const trash = vi.fn<Action>(async () => ({ status: 'done' }));
    render([row], trash);
    act(() => menuButton().click());
    act(() => menuItems()[1]!.click());
    const panel = confirmDialog()!;
    expect(panel.textContent).toContain('Move this article to the trash?');
    expect(trash).not.toHaveBeenCalled();
    await act(async () => buttonIn(panel, 'Move to trash').click());
    expect(trash).toHaveBeenCalledTimes(1);
    expect(trash.mock.calls[0]![1].get('id')).toBe(ID);
    expect(trash.mock.calls[0]![1].get('locale')).toBe('en');
    expect(confirmDialog()).toBeNull();
  });

  it('shows a refused trash by the row', async () => {
    render([row], vi.fn<Action>(async () => ({ status: 'error', errorKey: 'notFound' })));
    act(() => menuButton().click());
    act(() => menuItems()[1]!.click());
    await act(async () => buttonIn(confirmDialog()!, 'Move to trash').click());
    expect(confirmDialog()).toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('This article was not found.');
  });

  it('in the trash offers only Restore, which posts the id without a confirm', async () => {
    const restore = vi.fn<Action>(async () => ({ status: 'done' }));
    render([{ ...row, trashed: true }], undefined, restore);
    expect(container.querySelector('th a')).toBeNull();
    act(() => menuButton().click());
    expect(menuItems().map((item) => item.textContent)).toEqual(['Restore']);
    await act(async () => menuItems()[0]!.click());
    expect(confirmDialog()).toBeNull();
    expect(restore).toHaveBeenCalledTimes(1);
    expect(restore.mock.calls[0]![1].get('id')).toBe(ID);
  });
});
