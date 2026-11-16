// @vitest-environment jsdom
import type { Editor } from '@tiptap/core';
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '../../../../../../../messages/en.json';
import RichTextEditor from './RichTextEditor';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PRODUCT = '33333333-3333-4333-8333-333333333333';
const BODY = `<p>Hello</p><tinz-product data-id="${PRODUCT}"></tinz-product><p><img src="https://old.example/a.jpg" alt="old"></p>`;

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

async function mount(onChange: (html: string) => void, body: string = BODY) {
  await act(async () => {
    root.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Bangkok">
        <RichTextEditor label="Body" initialHtml={body} onChange={onChange} searchProducts={async () => []} />
      </NextIntlClientProvider>,
    );
  });
  // The editor mounts after the first render (no server render of it).
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  return (container.querySelector('.ProseMirror') as unknown as { editor: Editor }).editor;
}

describe('RichTextEditor', () => {
  it('offers the brief toolbar and no image control', async () => {
    await mount(() => {});
    const labels = [...container.querySelectorAll('button')].map((button) => button.getAttribute('aria-label'));
    expect(labels).toEqual(
      expect.arrayContaining(['Bold', 'Italic', 'Insert link', 'Bulleted list', 'Numbered list', 'Insert YouTube video', 'Insert product card']),
    );
    expect(labels.join(' ').toLowerCase()).not.toContain('image');
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });

  it('shows a stored product card node, and writes one it inserts as the placeholder element (R2)', async () => {
    const onChange = vi.fn();
    const editor = await mount(onChange);
    expect(container.querySelector('tinz-product')?.getAttribute('data-id')).toBe(PRODUCT);
    // The body sanitiser keeps a card with a uuid id (D-245), so a stored card no longer locks the body.
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(editor.isEditable).toBe(true);
    editor.commands.insertContentAt(0, { type: 'productCard', attrs: { id: PRODUCT, name: 'Switch' } });
    expect(editor.getHTML()).toContain(`<tinz-product data-id="${PRODUCT}"></tinz-product>`);
    expect(editor.getHTML()).not.toContain('Switch');
  });

  it('keeps an imported inline image through an edit (D-237)', async () => {
    const onChange = vi.fn();
    const editor = await mount(onChange, '<p>Hello</p><p><img src="https://old.example/a.jpg" alt="old"></p>');
    expect(container.querySelector('[role="alert"]')).toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Bulleted list"]')!.click());
    const html = onChange.mock.calls.at(-1)?.[0] as string;
    expect(html).toContain('<img src="https://old.example/a.jpg" alt="old">');
    expect(html).toContain('<ul>');
    expect(editor.isEditable).toBe(true);
  });
});
