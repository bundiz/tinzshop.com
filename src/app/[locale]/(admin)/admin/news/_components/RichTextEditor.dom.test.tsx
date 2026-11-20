// @vitest-environment jsdom
import type { Editor } from '@tiptap/core';
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '../../../../../../../messages/en.json';
import th from '../../../../../../../messages/th.json';
import type { LandingProductCard } from '@/server/services/catalogue/landing-catalogue-service';
import type { ProductSearch } from './ProductPicker';
import type { ImageUpload } from './ImageDialog';
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

/** Types into a search box and waits past its 250 ms pause. */
async function typeInto(input: HTMLInputElement, text: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
}

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
  options: {
    loadProductCards?: ProductCardsLoader;
    searchProducts?: ProductSearch;
    onProductCardInserted?: (hit: { id: string }) => void;
    onProductCardsChange?: (change: { added: string[]; removed: string[] }) => void;
  } = {},
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
          onProductCardsChange={options.onProductCardsChange}
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
  it('offers the brief toolbar plus the image button (plan 017), and no file field until the image dialog opens', async () => {
    await mount(() => {});
    const labels = [...container.querySelectorAll('button')].map((button) => button.getAttribute('aria-label'));
    expect(labels).toEqual(
      expect.arrayContaining(['Bold', 'Italic', 'Insert link', 'Bulleted list', 'Numbered list', 'Insert YouTube video', 'Image', 'Insert product card']),
    );
    expect(container.querySelector('input[type="file"]')).toBeNull();
  });

  it('draws every toolbar button as a named icon with a tooltip, not a text glyph (D-257)', async () => {
    await mount(() => {});
    const toolbar = container.querySelector('[role="toolbar"]')!;
    // The block type is the themed Select (D-258), a combobox button with its label as text.
    const buttons = [...toolbar.querySelectorAll<HTMLButtonElement>('button:not([role="combobox"])')];
    expect(buttons).toHaveLength(8);
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
    await act(async () => document.querySelector<HTMLButtonElement>('[role="dialog"] button[aria-haspopup="listbox"]')!.click());
    await typeInto(document.querySelector<HTMLInputElement>('[role="dialog"] input[type="search"]')!, 'switch');
    await act(async () => document.querySelector<HTMLElement>('[role="dialog"] [role="option"]')!.click());
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
  it('picks the card from a select-style field in the dialog: focused on open, a popup inside the dialog, Escape closes only the popup (D-272)', async () => {
    const all = [
      { id: PRODUCT, name: 'Nintendo Switch 2', sku: 'NS2', imageUrl: null },
      { id: '44444444-4444-4444-8444-444444444444', name: 'Portable SSD', sku: 'SSD', imageUrl: null },
    ];
    const search = vi.fn(async (query: string) => all.filter((hit) => hit.name.toLowerCase().includes(query.toLowerCase())));
    const inserted = vi.fn();
    const editor = await mount(() => {}, '<p>Hello</p>', { searchProducts: search, onProductCardInserted: inserted });
    await act(async () => {
      editor.commands.setTextSelection(2);
    });
    await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Insert product card"]')!.click());
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    const field = dialog.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!;
    // The field takes focus, closed: nothing is asked and no always-open list shows.
    expect(document.activeElement).toBe(field);
    expect(field.getAttribute('aria-expanded')).toBe('false');
    expect(field.textContent).toContain('Choose a product');
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(search).not.toHaveBeenCalled();

    await act(async () => field.click());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(search).toHaveBeenCalledWith('');
    const popup = document.querySelector<HTMLElement>('[data-product-combobox-popup]')!;
    // Portalled into the dialog (so it is inside the modal for a screen reader and the focus trap), above it, fixed.
    expect(dialog.contains(popup)).toBe(true);
    expect(popup.style.position).toBe('fixed');
    expect(popup.className.split(' ')).toContain('z-80');
    const box = popup.querySelector<HTMLInputElement>('input[type="search"]')!;
    expect(document.activeElement).toBe(box);
    const names = () => [...document.querySelectorAll('[role="option"] b')].map((name) => name.textContent);
    expect(names()).toEqual(['Nintendo Switch 2', 'Portable SSD']);

    // Escape closes the popup, not the dialog; focus goes back to the field.
    await act(async () => {
      box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
    expect(document.querySelector('[data-product-combobox-popup]')).toBeNull();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.activeElement).toBe(field);

    // Open again, narrow, and pick with the keyboard: the card goes in, the callback runs, the dialog closes.
    await act(async () => field.click());
    const again = document.querySelector<HTMLInputElement>('[data-product-combobox-popup] input[type="search"]')!;
    await typeInto(again, 'ssd');
    expect(names()).toEqual(['Portable SSD']);
    // A press inside the popup is not outside anything: it stays open, focus stays in its search box.
    await act(async () => again.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
    expect(document.querySelector('[data-product-combobox-popup]')).not.toBeNull();
    expect(document.activeElement).toBe(again);
    await act(async () => {
      again.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    });
    await act(async () => {
      again.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    expect(inserted).toHaveBeenCalledWith(all[1]);
    expect(editor.getHTML()).toContain(`data-id="${all[1]!.id}"`);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('reports a product whose last card leaves the body, and comes back with undo (D-268); a second card of it keeps it', async () => {
    const changes = vi.fn();
    const editor = await mount(() => {}, `<p>a</p>${card(PRODUCT)}<p>b</p>${card(PRODUCT)}`, { onProductCardsChange: changes });
    await settle();
    expect(changes).not.toHaveBeenCalled();
    const firstCardAt = () => {
      let at = -1;
      editor.state.doc.forEach((child, offset) => {
        if (at === -1 && child.type.name === 'productCard') at = offset;
      });
      return at;
    };
    await act(async () => {
      editor.commands.setNodeSelection(firstCardAt());
      editor.commands.deleteSelection();
    });
    expect(changes).not.toHaveBeenCalled();
    await act(async () => {
      editor.commands.setNodeSelection(firstCardAt());
      editor.commands.deleteSelection();
    });
    expect(editor.getHTML()).not.toContain('tinz-product');
    expect(changes).toHaveBeenLastCalledWith({ added: [], removed: [PRODUCT] });
    await act(async () => {
      editor.commands.undo();
    });
    expect(changes).toHaveBeenLastCalledWith({ added: [PRODUCT], removed: [] });
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

describe('RichTextEditor: resizing a card or a video by its corner (D-273)', () => {
  const SRC = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
  const card = (width?: number) => `<tinz-product data-id="${PRODUCT}"${width === undefined ? '' : ` data-width="${width}"`}></tinz-product>`;
  const video = (width?: number) => `<iframe src="${SRC}" allowfullscreen=""${width === undefined ? '' : ` data-width="${width}"`}></iframe>`;
  const settle = () =>
    act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  const sliders = () => [...container.querySelectorAll<HTMLElement>('.ProseMirror [role="slider"]')];
  const slider = (name: string) => sliders().find((element) => element.getAttribute('aria-label') === name)!;
  const press = (element: HTMLElement, key: string) =>
    act(async () => {
      element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    });
  const pointer = (element: HTMLElement, type: string, clientX: number) =>
    act(async () => {
      element.dispatchEvent(new MouseEvent(type, { clientX, button: 0, bubbles: true, cancelable: true }));
    });

  it('offers a focusable slider on a card and a top-level video, at its stored width, named in Thai first', async () => {
    await mount(() => {}, `<p>a</p>${card(60)}${video()}<figure>${video(50)}</figure>`, { loadProductCards: async () => ({ [PRODUCT]: SWITCH }) });
    await settle();
    // Two handles: the card and the top-level video; the video in a figure has none.
    expect(sliders()).toHaveLength(2);
    const onCard = slider('Resize product card');
    expect(onCard.tabIndex).toBe(0);
    expect(onCard.getAttribute('aria-valuemin')).toBe('40');
    expect(onCard.getAttribute('aria-valuemax')).toBe('100');
    expect(onCard.getAttribute('aria-valuenow')).toBe('60');
    expect(onCard.getAttribute('aria-valuetext')).toBe('60%');
    expect(onCard.getAttribute('draggable')).toBe('false');
    expect(slider('Resize video').getAttribute('aria-valuenow')).toBe('100');
    // The card's frame is drawn at its width, centred; the full-width video has no width of its own.
    expect(onCard.parentElement!.style.width).toBe('60%');
    expect(onCard.parentElement!.style.marginInline).toBe('auto');
    expect(slider('Resize video').parentElement!.style.width).toBe('');
    // Shown on hover, focus or selection, always on a touch screen, like the card's remove button.
    expect(onCard.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['opacity-0', 'group-hover/embed:opacity-100', 'group-focus-within/embed:opacity-100', '[@media(hover:none)]:opacity-100']),
    );
    expect(onCard.parentElement!.className).toContain('group/embed');
    expect((th.admin.news.editor as { resize: { card: string; video: string } }).resize).toEqual({ card: 'ปรับขนาดการ์ดสินค้า', video: 'ปรับขนาดวิดีโอ' });
  });

  it('changes the width by 5% with the arrow keys and to 40% or 100% with Home and End; 100% writes no attribute', async () => {
    const onChange = vi.fn();
    const editor = await mount(onChange, `<p>a</p>${card()}${video(50)}<p>b</p>`, { loadProductCards: async () => ({ [PRODUCT]: SWITCH }) });
    await settle();
    const onCard = slider('Resize product card');
    await press(onCard, 'ArrowLeft');
    expect(editor.getHTML()).toContain(`data-id="${PRODUCT}" data-width="95"`);
    await press(slider('Resize product card'), 'ArrowDown');
    expect(editor.getHTML()).toContain('data-width="90"');
    await press(slider('Resize product card'), 'ArrowUp');
    await press(slider('Resize product card'), 'ArrowRight');
    expect(editor.getHTML()).toContain(`${card()}<iframe`);
    expect(slider('Resize product card').getAttribute('aria-valuenow')).toBe('100');
    await press(slider('Resize product card'), 'Home');
    expect(editor.getHTML()).toContain(card(40));
    await press(slider('Resize product card'), 'ArrowLeft');
    expect(editor.getHTML()).toContain(card(40));
    await press(slider('Resize product card'), 'End');
    expect(editor.getHTML()).toContain(card());
    await press(slider('Resize video'), 'ArrowRight');
    expect(editor.getHTML()).toContain(video(55));
    await press(slider('Resize video'), 'End');
    expect(editor.getHTML()).toContain(`${video()}<p>b</p>`);
    expect(onChange.mock.calls.at(-1)?.[0]).toBe(editor.getHTML());
  });

  it('resizes on a corner drag, centred, clamped to 40–100% and rounded, in one undoable step', async () => {
    const editor = await mount(() => {}, `<p>a</p>${video()}<p>b</p>`);
    const handle = slider('Resize video');
    const frame = handle.parentElement!;
    // The column (the node view's own element) is 1000px wide from x = 100: its centre is x = 600.
    frame.parentElement!.getBoundingClientRect = () => ({ x: 100, y: 0, left: 100, right: 1100, top: 0, bottom: 500, width: 1000, height: 500, toJSON: () => ({}) }) as DOMRect;
    await pointer(handle, 'pointerdown', 1100);
    await pointer(handle, 'pointermove', 901);
    // A live readout while dragging; the document is not changed until the release.
    expect(frame.style.width).toBe('60%');
    expect(frame.textContent).toContain('60%');
    expect(editor.getHTML()).toContain(video());
    await pointer(handle, 'pointermove', 610);
    expect(frame.style.width).toBe('40%');
    await pointer(handle, 'pointermove', 1500);
    expect(frame.style.width).toBe('');
    await pointer(handle, 'pointermove', 872.4);
    await pointer(handle, 'pointerup', 872.4);
    expect(editor.getHTML()).toContain(video(54));
    expect(frame.textContent).not.toContain('%');
    await act(async () => {
      editor.commands.undo();
    });
    expect(editor.getHTML()).toContain(video());
    // A move with no button pressed first changes nothing.
    await pointer(slider('Resize video'), 'pointermove', 700);
    await pointer(slider('Resize video'), 'pointerup', 700);
    expect(editor.getHTML()).toContain(video());
  });

  it('keeps the drag away from ProseMirror, so it never starts the node’s drag-to-move', async () => {
    await mount(() => {}, `<p>a</p>${card()}`, { loadProductCards: async () => ({ [PRODUCT]: SWITCH }) });
    await settle();
    const handle = slider('Resize product card');
    const seen = vi.fn();
    container.querySelector('.ProseMirror')!.addEventListener('mousedown', seen);
    container.querySelector('.ProseMirror')!.addEventListener('pointerdown', seen);
    const down = new MouseEvent('pointerdown', { clientX: 10, button: 0, bubbles: true, cancelable: true });
    const mouse = new MouseEvent('mousedown', { clientX: 10, button: 0, bubbles: true, cancelable: true });
    await act(async () => {
      handle.dispatchEvent(down);
      handle.dispatchEvent(mouse);
    });
    expect(seen).not.toHaveBeenCalled();
    expect(down.defaultPrevented).toBe(true);
    const drag = new Event('dragstart', { bubbles: true, cancelable: true });
    await act(async () => {
      handle.parentElement!.dispatchEvent(drag);
    });
    expect(drag.defaultPrevented).toBe(true);
    await pointer(handle, 'pointerup', 10);
  });

  it('offers no handle in a read-only (locked) body', async () => {
    await mount(() => {}, `<p>x</p>${card(60)}${video(50)}<dl><dt>t</dt><dd>d</dd></dl>`, { loadProductCards: async () => ({ [PRODUCT]: SWITCH }) });
    await settle();
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(sliders()).toHaveLength(0);
  });
});

describe('RichTextEditor: images (plan 017, D-277, D-278)', () => {
  const BASE = 'https://media.example.com';
  const KEY = 'news/2026/11/0f8fad5b-d9cb-469f-a165-70867728950e.jpg';
  type Upload = ImageUpload;

  async function mountWithImages(
    body: string,
    options: { upload?: Upload; mediaBaseUrl?: string | null; onChange?: (html: string) => void } = {},
  ) {
    await act(async () => {
      root.render(
        <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Bangkok">
          <RichTextEditor
            label="Body"
            initialHtml={body}
            onChange={options.onChange ?? (() => {})}
            searchProducts={async () => []}
            mediaBaseUrl={options.mediaBaseUrl === undefined ? BASE : options.mediaBaseUrl}
            uploadImage={options.upload ?? (async () => ({ status: 'uploaded', key: KEY, url: `${BASE}/${KEY}` }))}
          />
        </NextIntlClientProvider>,
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    return (container.querySelector('.ProseMirror') as unknown as { editor: Editor }).editor;
  }

  const imageButton = () => container.querySelector<HTMLButtonElement>('[role="toolbar"] button[aria-label="Image"]')!;
  const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
  const insertButton = () => [...dialog()!.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Insert image')!;

  async function chooseFile(file: File) {
    const input = dialog()!.querySelector<HTMLInputElement>('input[type="file"]')!;
    await act(async () => {
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  async function typeAlt(text: string) {
    const input = dialog()!.querySelector<HTMLInputElement>('input[name="alt"], #image-alt, input[type="text"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'photo.jpg', { type: 'image/jpeg' });

  it('opens the image dialog from a button that never submits a form', async () => {
    await mountWithImages('<p>Hello</p>');
    expect(imageButton().type).toBe('button');
    expect(imageButton().disabled).toBe(false);
    await act(async () => imageButton().click());
    expect(dialog()).not.toBeNull();
    expect(dialog()!.querySelector<HTMLInputElement>('input[type="file"]')!.accept).toBe('image/jpeg,image/png,image/webp,image/gif');
    // The dialog's fields are never posted with the article.
    expect(dialog()!.querySelector('input[type="file"]')!.hasAttribute('name')).toBe(false);
  });

  it('keeps "Insert image" pressable and says what is missing: the file, then the alt text, each beside its field and focused', async () => {
    const upload = vi.fn<Upload>(async () => ({ status: 'uploaded', key: KEY, url: `${BASE}/${KEY}` }));
    await mountWithImages('<p>Hello</p>', { upload });
    await act(async () => imageButton().click());
    expect(insertButton().disabled).toBe(false);
    const file = () => dialog()!.querySelector<HTMLInputElement>('input[type="file"]')!;
    const alt = () => dialog()!.querySelector<HTMLInputElement>('input[type="text"]')!;
    await act(async () => insertButton().click());
    expect(file().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(file());
    expect(dialog()!.textContent).toContain(en.admin.news.editor.imageDialog.fileMissing);
    await chooseFile(jpeg());
    await typeAlt('   ');
    await act(async () => insertButton().click());
    expect(alt().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(alt());
    expect(dialog()!.textContent).toContain(en.admin.news.editor.imageDialog.altMissing);
    expect(upload).not.toHaveBeenCalled();
    await typeAlt('A game box');
    expect(alt().getAttribute('aria-invalid')).toBeNull();
    await act(async () => insertButton().click());
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a file over 5 MB', new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.jpg', { type: 'image/jpeg' }), 'The image file is over 5 MB.'],
    ['an SVG', new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }), 'Only JPEG, PNG, WebP and GIF files are accepted.'],
  ])('refuses %s in the browser with its message, without calling the upload', async (_, file, message) => {
    const upload = vi.fn<Upload>();
    await mountWithImages('<p>Hello</p>', { upload });
    await act(async () => imageButton().click());
    await chooseFile(file);
    await typeAlt('alt');
    expect(dialog()!.querySelector('[role="alert"]')?.textContent).toBe(message);
    await act(async () => insertButton().click());
    expect(upload).not.toHaveBeenCalled();
  });

  it('uploads, then inserts the picture as its own paragraph after the current block, stored as a key with no src', async () => {
    const upload = vi.fn<Upload>(async () => ({ status: 'uploaded', key: KEY, url: `${BASE}/${KEY}` }));
    const onChange = vi.fn();
    const editor = await mountWithImages('<p>Hello</p><p>World</p>', { upload, onChange });
    await act(async () => {
      editor.commands.setTextSelection(3);
    });
    await act(async () => imageButton().click());
    await chooseFile(jpeg());
    await typeAlt('ภาพปกเกม');
    await act(async () => insertButton().click());
    expect(upload).toHaveBeenCalledTimes(1);
    expect((upload.mock.calls[0]![0].get('file') as File).name).toBe('photo.jpg');
    expect(dialog()).toBeNull();
    const html = editor.getHTML();
    expect(html).toBe(`<p>Hello</p><p><img data-media-key="${KEY}" alt="ภาพปกเกม"></p><p>World</p>`);
    expect(onChange.mock.calls.at(-1)?.[0]).toBe(html);
    // The editor shows it from the built URL, which is never saved.
    // (ProseMirror adds its own separator <img> after an inline node, hence the attribute in the selector.)
    expect(container.querySelector('.ProseMirror img[data-media-key]')?.getAttribute('src')).toBe(`${BASE}/${KEY}`);
  });

  it('shows an upload refusal and inserts nothing; a rejected call shows the upload failure', async () => {
    const upload = vi.fn<Upload>(async () => ({ status: 'error', errorKey: 'imageType' }));
    const editor = await mountWithImages('<p>Hello</p>', { upload });
    await act(async () => imageButton().click());
    await chooseFile(jpeg());
    await typeAlt('alt');
    await act(async () => insertButton().click());
    expect(dialog()!.querySelector('[role="alert"]')?.textContent).toBe('Only JPEG, PNG, WebP and GIF files are accepted.');
    upload.mockRejectedValueOnce(new Error('network'));
    await act(async () => insertButton().click());
    expect(dialog()!.querySelector('[role="alert"]')?.textContent).toBe('The image could not be uploaded. Please try again.');
    expect(editor.getHTML()).toBe('<p>Hello</p>');
  });

  it('edits the alt text of a selected picture, without uploading', async () => {
    const upload = vi.fn<Upload>();
    const editor = await mountWithImages(`<p>a</p><p><img data-media-key="${KEY}" alt="old"></p>`, { upload });
    let at = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image') at = pos;
    });
    await act(async () => {
      editor.commands.setNodeSelection(at);
    });
    await act(async () => imageButton().click());
    expect(dialog()!.querySelector('input[type="file"]')).toBeNull();
    await typeAlt('new words');
    const save = [...dialog()!.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Save')!;
    await act(async () => save.click());
    expect(editor.getHTML()).toBe(`<p>a</p><p><img data-media-key="${KEY}" alt="new words"></p>`);
    expect(upload).not.toHaveBeenCalled();
  });

  it('disables the image button when media storage is not configured, and says why', async () => {
    await mountWithImages('<p>Hello</p>', { mediaBaseUrl: null });
    expect(imageButton().disabled).toBe(true);
    expect(imageButton().title).toContain('Image storage is not set up');
  });
});
