// @vitest-environment jsdom
import type { Editor } from '@tiptap/core';
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '../../../../../../../messages/en.json';
import RichTextEditor from './RichTextEditor';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no layout: ProseMirror measures a Range when it scrolls the selection into view (after focus() from the block
// type list), and jsdom's Range has no getClientRects. Give it empty boxes so the scroll is a no-op instead of an
// uncaught error that fails the run.
const emptyRect = () => ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) }) as DOMRect;
Range.prototype.getClientRects ??= function getClientRects() {
  return [] as unknown as DOMRectList;
};
Range.prototype.getBoundingClientRect ??= emptyRect;

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

  it('draws every toolbar button as a named icon with a tooltip, not a text glyph (D-257)', async () => {
    await mount(() => {});
    const toolbar = container.querySelector('[role="toolbar"]')!;
    // The block type is the themed Select (D-258), a combobox button with its label as text.
    const buttons = [...toolbar.querySelectorAll<HTMLButtonElement>('button:not([role="combobox"])')];
    expect(buttons).toHaveLength(7);
    for (const button of buttons) {
      expect(button.getAttribute('aria-label')).toBeTruthy();
      expect(button.title).toContain(button.getAttribute('aria-label'));
      expect(button.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
      expect(button.textContent?.trim()).toBe('');
    }
    const bold = toolbar.querySelector<HTMLButtonElement>('button[aria-label="Bold"]')!;
    expect(bold.title).toBe('Bold (Ctrl+B)');
    expect(bold.getAttribute('aria-keyshortcuts')).toBe('Control+B Meta+B');
  });

  it('marks bold as pressed while the selection is bold', async () => {
    const editor = await mount(() => {});
    const bold = () => container.querySelector<HTMLButtonElement>('button[aria-label="Bold"]')!;
    expect(bold().getAttribute('aria-pressed')).toBe('false');
    await act(async () => {
      editor.chain().focus().setTextSelection({ from: 1, to: 6 }).toggleBold().run();
    });
    expect(bold().getAttribute('aria-pressed')).toBe('true');
  });

  it('chooses the block type from the themed list, labelled, and returns focus to the writing area (D-258)', async () => {
    const onChange = vi.fn();
    const editor = await mount(onChange, '<p>Hello</p>');
    const block = container.querySelector<HTMLButtonElement>('[role="toolbar"] [role="combobox"]')!;
    expect(container.querySelector('select')).toBeNull();
    expect([...block.labels].map((label) => label.textContent)).toEqual(['Paragraph style']);
    expect(block.textContent).toContain('Paragraph');
    await act(async () => {
      editor.commands.setTextSelection(2);
    });
    await act(async () => block.click());
    expect([...document.querySelectorAll('[role="option"]')].map((option) => option.textContent)).toEqual(['Paragraph', 'Heading 2', 'Heading 3', 'Quote']);
    await act(async () => document.querySelectorAll<HTMLElement>('[role="option"]')[1]!.click());
    expect(onChange.mock.calls.at(-1)?.[0]).toContain('<h2>Hello</h2>');
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(block.querySelector('[data-select-label]')?.textContent).toBe('Heading 2');
    // Tiptap moves focus on the next frame.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(container.querySelector('.ProseMirror')!.contains(document.activeElement)).toBe(true);
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
