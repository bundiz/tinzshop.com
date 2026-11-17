// @vitest-environment jsdom
import type { Editor } from '@tiptap/core';
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '../../../../../../../messages/en.json';
import type { LandingProductCard } from '@/server/services/catalogue/landing-catalogue-service';
import type { ProductSearch } from './ProductPicker';
import RichTextEditor, { type ProductCardsLoader } from './RichTextEditor';

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

const SWITCH: LandingProductCard = {
  productId: PRODUCT,
  name: 'Nintendo Switch 2',
  imageUrl: 'https://img.example/switch.jpg',
  priceSatang: 1_699_000n,
  originalPriceSatang: null,
  isPriceRange: true,
  stockStatus: 'in_stock',
  isKit: false,
  isPreOrder: false,
  releaseDate: null,
};

async function mount(
  onChange: (html: string) => void,
  body: string = BODY,
  options: { loadProductCards?: ProductCardsLoader; searchProducts?: ProductSearch; onProductCardInserted?: (hit: { id: string }) => void } = {},
) {
  await act(async () => {
    root.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Bangkok">
        <RichTextEditor
          label="Body"
          initialHtml={body}
          onChange={onChange}
          searchProducts={options.searchProducts ?? (async () => [])}
          loadProductCards={options.loadProductCards}
          onProductCardInserted={options.onProductCardInserted}
        />
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
    const editor = await mount(onChange, BODY, { loadProductCards: async () => ({ [PRODUCT]: SWITCH }) });
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

describe('RichTextEditor: product cards drawn as the storefront card (D-266)', () => {
  const OTHER = '44444444-4444-4444-8444-444444444444';
  const GONE = '55555555-5555-4555-8555-555555555555';
  const card = (id: string) => `<tinz-product data-id="${id}"></tinz-product>`;
  const settle = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  const view = (id: string) => container.querySelector<HTMLElement>(`.ProseMirror tinz-product[data-id="${id}"]`)!;

  it('draws a stored card as the storefront card, with the name, price and stock the loader returned, not clickable', async () => {
    await mount(() => {}, `<p>a</p>${card(PRODUCT)}`, { loadProductCards: async () => ({ [PRODUCT]: SWITCH }) });
    await settle();
    const node = view(PRODUCT);
    const article = node.querySelector('article')!;
    expect(article).not.toBeNull();
    expect(article.textContent).toContain('Nintendo Switch 2');
    expect(article.textContent).toContain('From ฿16,990');
    expect(article.textContent).toContain('In stock');
    expect(article.querySelector('img')?.getAttribute('src')).toBe('https://img.example/switch.jpg');
    // The storefront card's link is there, but the editor's copy is inert: a click selects the node, never navigates.
    const inert = article.closest('[inert]')!;
    expect(inert).not.toBeNull();
    expect(inert.className).toContain('pointer-events-none');
    expect(node.getAttribute('contenteditable')).toBe('false');
    expect(node.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Product card: Nintendo Switch 2');
  });

  it('asks for every card in the body in ONE call, each id once', async () => {
    const load = vi.fn<ProductCardsLoader>(async () => ({ [PRODUCT]: SWITCH, [OTHER]: { ...SWITCH, productId: OTHER, name: 'PS5' } }));
    await mount(() => {}, `${card(PRODUCT)}<p>a</p>${card(OTHER)}<p>b</p>${card(PRODUCT)}`, { loadProductCards: load });
    await settle();
    expect(load).toHaveBeenCalledTimes(1);
    expect(load.mock.calls[0]![0]).toEqual([PRODUCT, OTHER]);
    expect(view(OTHER).textContent).toContain('PS5');
  });

  it('shows a card-shaped skeleton while the card loads, with no text', async () => {
    await mount(() => {}, card(PRODUCT), { loadProductCards: () => new Promise(() => {}) });
    const skeleton = view(PRODUCT).querySelector('[data-card-skeleton]')!;
    expect(skeleton).not.toBeNull();
    expect(skeleton.textContent).toBe('');
    expect(view(PRODUCT).querySelector('article')).toBeNull();
  });

  it('shows a notice for a product readers no longer see, so staff can delete the card', async () => {
    await mount(() => {}, card(GONE), { loadProductCards: async () => ({ [GONE]: null }) });
    await settle();
    const node = view(GONE);
    expect(node.querySelector('article')).toBeNull();
    expect(node.textContent).toContain('This product is no longer shown on the site');
    expect(node.textContent).toContain(en.admin.news.editor.productCardGone.hint);
  });

  it('draws a card inserted from the picker once its data arrives, and saves only the placeholder element', async () => {
    const load = vi.fn<ProductCardsLoader>(async (ids) => Object.fromEntries(ids.map((id) => [id, id === PRODUCT ? SWITCH : null])));
    const onChange = vi.fn();
    const inserted = vi.fn();
    const editor = await mount(onChange, '<p>Hello</p>', {
      loadProductCards: load,
      searchProducts: async () => [{ id: PRODUCT, name: 'Nintendo Switch 2', sku: 'NS2', imageUrl: null }],
      onProductCardInserted: inserted,
    });
    expect(load).not.toHaveBeenCalled();
    await act(async () => {
      editor.commands.setTextSelection(2);
    });
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Insert product card"]')!.click());
    const search = document.querySelector<HTMLInputElement>('[role="dialog"] input[type="search"]')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(search, 'switch');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    await act(async () => document.querySelector<HTMLButtonElement>('[role="dialog"] li button')!.click());
    await settle();
    expect(load).toHaveBeenCalledTimes(1);
    expect(load.mock.calls[0]![0]).toEqual([PRODUCT]);
    // The article adds the picked product to its related products (D-267).
    expect(inserted).toHaveBeenCalledWith({ id: PRODUCT, name: 'Nintendo Switch 2', sku: 'NS2', imageUrl: null });
    expect(view(PRODUCT).querySelector('article')?.textContent).toContain('Nintendo Switch 2');
    // Only the placeholder is saved (the editor adds its usual empty paragraph after a card at the end).
    for (const html of [editor.getHTML(), onChange.mock.calls.at(-1)?.[0] as string]) {
      expect(html).toBe(`<p>Hello</p>${card(PRODUCT)}<p></p>`);
    }
  });

  it('outlines a selected card, and Delete removes it', async () => {
    const onChange = vi.fn();
    const editor = await mount(onChange, `<p>a</p>${card(PRODUCT)}<p>b</p>`, { loadProductCards: async () => ({ [PRODUCT]: SWITCH }) });
    await settle();
    const group = () => view(PRODUCT).querySelector<HTMLElement>('[role="group"]')!;
    expect(group().className).not.toContain('outline-brand');
    await act(async () => {
      editor.commands.setNodeSelection(3);
    });
    expect(group().className).toContain('outline-brand');
    await act(async () => {
      editor.commands.deleteSelection();
    });
    expect(editor.getHTML()).toBe('<p>a</p><p>b</p>');
  });
  it('keeps the writing area\'s text styles off the card, so its name is not drawn as a blue underlined link', async () => {
    await mount(() => {}, `<p>See <a href="https://example.com/x">this</a></p>${card(PRODUCT)}`, { loadProductCards: async () => ({ [PRODUCT]: SWITCH }) });
    await settle();
    const root = container.querySelector<HTMLElement>('.ProseMirror')!;
    // Each `[&_…]:` rule of the writing area, as the selector Tailwind writes for it (`_` is a space).
    const rules = root.className
      .split(/\s+/)
      .filter((token) => token.startsWith('[&_'))
      .map((token) => token.slice(3, token.indexOf(']:')).replace(/_/g, ' '));
    expect(rules.length).toBeGreaterThan(5);
    const cardView = view(PRODUCT);
    expect(cardView.querySelector('a h3, h3 a, p')).not.toBeNull();
    for (const selector of rules) {
      const reached = [...root.querySelectorAll(selector)].filter((element) => cardView.contains(element));
      expect(reached, selector).toEqual([]);
    }
    // The article text's link still takes the link style.
    const linkRules = root.className.split(/\s+/).filter((token) => token.endsWith(']:underline'));
    expect(linkRules).toHaveLength(1);
    const textLink = root.querySelector('p > a')!;
    expect(textLink.matches(linkRules[0]!.slice(3, linkRules[0]!.indexOf(']:')).replace(/_/g, ' '))).toBe(true);
  });

  it('removes a card with its corner button, as one undoable step, shown on hover, focus or selection, on the notice but not the skeleton', async () => {
    const onChange = vi.fn();
    const editor = await mount(onChange, `<p>a</p>${card(PRODUCT)}<p>b</p>${card(GONE)}<p>c</p>`, {
      loadProductCards: async () => ({ [PRODUCT]: SWITCH, [GONE]: null }),
    });
    await settle();
    const remove = (id: string) => view(id).querySelector<HTMLButtonElement>('button')!;
    expect(remove(PRODUCT).getAttribute('aria-label')).toBe('Remove product card: Nintendo Switch 2');
    expect(remove(PRODUCT).type).toBe('button');
    expect(remove(PRODUCT).tabIndex).toBe(0);
    expect(remove(PRODUCT).closest('[inert]')).toBeNull();
    expect(remove(PRODUCT).querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(remove(GONE).getAttribute('aria-label')).toBe('Remove product card');
    // Hidden until the card is hovered, holds focus or is selected; always shown on a screen with no hover (owner,
    // 2026-11-17). Inside the card's top-right corner, never straddling its edge.
    const classes = () => remove(PRODUCT).className.split(/\s+/);
    expect(classes()).toEqual(
      expect.arrayContaining([
        'opacity-0',
        'pointer-events-none',
        'group-hover/card:opacity-100',
        'group-focus-within/card:opacity-100',
        '[@media(hover:none)]:opacity-100',
        '[@media(hover:none)]:pointer-events-auto',
        'motion-reduce:transition-none',
        'top-3',
        'right-3',
      ]),
    );
    expect(classes().some((name) => name.startsWith('-top') || name.startsWith('-right'))).toBe(false);
    expect(view(PRODUCT).querySelector('[role="group"]')!.className).toContain('group/card');
    await act(async () => {
      editor.commands.setNodeSelection(3);
    });
    expect(classes()).not.toContain('opacity-0');
    expect(classes()).not.toContain('pointer-events-none');
    await act(async () => remove(GONE).click());
    expect(editor.getHTML()).toBe(`<p>a</p>${card(PRODUCT)}<p>b</p><p>c</p>`);
    await act(async () => remove(PRODUCT).click());
    expect(editor.getHTML()).toBe('<p>a</p><p>b</p><p>c</p>');
    expect(onChange.mock.calls.at(-1)?.[0]).toBe('<p>a</p><p>b</p><p>c</p>');
    await act(async () => {
      editor.commands.undo();
    });
    expect(editor.getHTML()).toBe(`<p>a</p>${card(PRODUCT)}<p>b</p><p>c</p>`);

    act(() => root.unmount());
    root = createRoot(container);
    await mount(() => {}, card(PRODUCT), { loadProductCards: () => new Promise(() => {}) });
    expect(view(PRODUCT).querySelector('button')).toBeNull();
  });

  it('offers no remove button in a read-only (locked) body', async () => {
    await mount(() => {}, `<p>x</p>${card(PRODUCT)}<dl><dt>t</dt><dd>d</dd></dl>`, { loadProductCards: async () => ({ [PRODUCT]: SWITCH }) });
    await settle();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(view(PRODUCT).querySelector('article')).not.toBeNull();
    expect(view(PRODUCT).querySelector('button')).toBeNull();
  });
});
