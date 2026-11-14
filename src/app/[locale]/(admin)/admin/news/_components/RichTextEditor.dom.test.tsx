// @vitest-environment jsdom
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

async function mount(onChange: (html: string) => void) {
  await act(async () => {
    root.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Bangkok">
        <RichTextEditor label="Body" initialHtml={BODY} onChange={onChange} searchProducts={async () => []} />
      </NextIntlClientProvider>,
    );
  });
  // The editor mounts after the first render (no server render of it).
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
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

  it('shows a product card node and keeps it, and an imported image, through an edit (R2, D-237)', async () => {
    const onChange = vi.fn();
    await mount(onChange);
    expect(container.querySelector('tinz-product')?.getAttribute('data-id')).toBe(PRODUCT);
    expect(container.querySelector('img[src]')?.getAttribute('src')).toBe('https://old.example/a.jpg');

    const bullet = container.querySelector<HTMLButtonElement>('button[aria-label="Bulleted list"]')!;
    await act(async () => bullet.click());

    const html = onChange.mock.calls.at(-1)?.[0] as string;
    expect(html).toContain(`<tinz-product data-id="${PRODUCT}"></tinz-product>`);
    expect(html).toContain('<img src="https://old.example/a.jpg" alt="old">');
    expect(html).toContain('<ul>');
    expect(html).not.toContain('contenteditable');
  });
});
