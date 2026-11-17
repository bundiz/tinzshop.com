// @vitest-environment jsdom
import { NextIntlClientProvider } from 'next-intl';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '../../../../../../../messages/en.json';
import type { ProductPickerHit } from '@/server/services/catalogue/product-search-service';
import ProductPicker from './ProductPicker';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SSD = { id: '11111111-1111-4111-8111-111111111111', name: 'Portable SSD', sku: 'SSD', imageUrl: null };
const ZELDA = { id: '22222222-2222-4222-8222-222222222222', name: 'Zelda', sku: 'ZD', imageUrl: null };
const MARIO = { id: '33333333-3333-4333-8333-333333333333', name: 'Mario Kart', sku: 'MK', imageUrl: null };

let container: HTMLDivElement;
let root: Root;
const realHeight = window.innerHeight;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: realHeight });
});

function Harness({ search, initial }: { search: (query: string) => Promise<ProductPickerHit[]>; initial: ProductPickerHit[] }) {
  const [selected, setSelected] = useState(initial);
  return <ProductPicker selected={selected} onChange={setSelected} search={search} />;
}

async function mount(initial: ProductPickerHit[] = []) {
  const search = vi.fn(async (query: string) => [SSD, ZELDA, MARIO].filter((hit) => hit.name.toLowerCase().includes(query.toLowerCase())));
  await act(async () => {
    root.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Bangkok">
        <Harness search={search} initial={initial} />
      </NextIntlClientProvider>,
    );
  });
  return search;
}

const trigger = () => container.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"]')!;
const popup = () => document.querySelector<HTMLElement>('[data-product-combobox-popup]');
const box = () => popup()!.querySelector<HTMLInputElement>('input')!;
const listbox = () => document.querySelector<HTMLElement>('[role="listbox"]');
const options = () => [...document.querySelectorAll('[role="option"] b')].map((name) => name.textContent);
const chosen = () => [...container.querySelectorAll<HTMLInputElement>('input[name="productId"]')].map((input) => input.value);
const wait = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
const key = (target: HTMLElement, name: string) =>
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
  });
async function open() {
  await act(async () => trigger().click());
  await wait(10);
}

describe('ProductPicker: a select-style searchable dropdown (D-271, D-272)', () => {
  it('shows a select-style trigger above the chosen products, with no list and no search until it is opened', async () => {
    const search = await mount([SSD]);
    expect(trigger().tagName).toBe('BUTTON');
    expect(trigger().type).toBe('button');
    expect(trigger().getAttribute('role')).toBe('combobox');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().textContent).toContain('Choose a product');
    expect(trigger().querySelector('svg')).not.toBeNull();
    expect(container.querySelector('input[type="search"]')).toBeNull();
    const firstChosen = container.querySelector('input[name="productId"]')!;
    expect(trigger().compareDocumentPosition(firstChosen) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await wait(20);
    expect(search).not.toHaveBeenCalled();
    expect(listbox()).toBeNull();
  });

  it('opens a portalled, fixed popup with a focused search box over the first products, the chosen ones left out', async () => {
    const search = await mount([SSD]);
    await open();
    expect(search).toHaveBeenCalledWith('');
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(popup()).not.toBeNull();
    expect(container.contains(popup())).toBe(false);
    expect(popup()!.parentElement).toBe(document.body);
    expect(popup()!.style.position).toBe('fixed');
    expect(document.activeElement).toBe(box());
    expect(box().getAttribute('role')).toBe('combobox');
    expect(box().getAttribute('aria-controls')).toBe(listbox()!.id);
    expect(box().placeholder).toBe('Search by product name or SKU');
    expect(options()).toEqual(['Zelda', 'Mario Kart']);
  });

  it('draws the popup as the owner reference: a search row with a magnifier and a borderless box, a full-width divider, then the rows (D-272)', async () => {
    await mount();
    await open();
    const searchRow = box().parentElement!;
    expect(searchRow.parentElement).toBe(popup());
    expect(searchRow.firstElementChild!.tagName.toLowerCase()).toBe('svg');
    // The row spans the popup: the popup has no side padding, and the row carries the divider.
    expect(popup()!.className.split(' ')).toContain('p-0');
    expect(searchRow.className.split(' ')).toEqual(expect.arrayContaining(['w-full', 'border-b', 'border-line']));
    // No bordered box inside the popup, and no ring of its own.
    expect(box().className).not.toMatch(/border-\[|rounded/);
    expect(box().className.split(' ')).toEqual(expect.arrayContaining(['border-0', 'bg-transparent', 'focus-visible:outline-none']));
    expect(box().placeholder).toBe('Search by product name or SKU');
    expect(listbox()!.parentElement).toBe(popup());
    // A product with no image shows its first letter in the thumb.
    const first = document.querySelector('[role="option"]')!;
    expect(first.querySelector('[data-product-initial]')?.textContent).toBe('P');
  });

  it('narrows the list as you type, after a short wait', async () => {
    const search = await mount();
    await open();
    await act(async () => {
      const input = box();
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setValue.call(input, 'zel');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(search).not.toHaveBeenCalledWith('zel');
    await wait(300);
    expect(search).toHaveBeenCalledWith('zel');
    expect(options()).toEqual(['Zelda']);
  });

  it('picks with ArrowDown and Enter: adds a hidden productId, clears, closes and returns focus to the trigger', async () => {
    await mount([SSD]);
    await open();
    expect(box().hasAttribute('aria-activedescendant')).toBe(false);
    key(box(), 'ArrowDown');
    key(box(), 'ArrowDown');
    expect(document.getElementById(box().getAttribute('aria-activedescendant')!)?.textContent).toContain('Mario Kart');
    key(box(), 'ArrowUp');
    expect(document.getElementById(box().getAttribute('aria-activedescendant')!)?.getAttribute('aria-selected')).toBe('true');
    key(box(), 'Enter');
    expect(chosen()).toEqual([SSD.id, ZELDA.id]);
    expect(popup()).toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger());
    await open();
    expect(box().value).toBe('');
    expect(options()).toEqual(['Mario Kart']);
  });

  it('picks with a click on an option', async () => {
    await mount();
    await open();
    await act(async () => document.querySelectorAll<HTMLElement>('[role="option"]')[1]!.click());
    expect(chosen()).toEqual([ZELDA.id]);
    expect(popup()).toBeNull();
  });

  it('opens from the keyboard with Enter, Space or ArrowDown on the trigger', async () => {
    await mount();
    for (const name of ['Enter', ' ', 'ArrowDown']) {
      act(() => trigger().focus());
      key(trigger(), name);
      expect(trigger().getAttribute('aria-expanded')).toBe('true');
      key(box(), 'Escape');
      expect(popup()).toBeNull();
    }
  });

  it('closes on Escape (focus back on the trigger) and on a press outside', async () => {
    await mount();
    await open();
    key(box(), 'Escape');
    expect(popup()).toBeNull();
    expect(document.activeElement).toBe(trigger());
    await open();
    await act(async () => box().dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
    expect(popup()).not.toBeNull();
    await act(async () => document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
    expect(popup()).toBeNull();
  });

  it('opens above the trigger when there is no room below', async () => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
    await mount();
    vi.spyOn(trigger(), 'getBoundingClientRect').mockReturnValue({
      top: 700,
      bottom: 744,
      left: 20,
      right: 300,
      width: 280,
      height: 44,
      x: 20,
      y: 700,
      toJSON: () => ({}),
    } as DOMRect);
    await open();
    expect(popup()!.style.top).toBe('');
    expect(popup()!.style.bottom).toBe(`${768 - 700 + 6}px`);
    expect(popup()!.style.minWidth).toBe('280px');
  });
});
