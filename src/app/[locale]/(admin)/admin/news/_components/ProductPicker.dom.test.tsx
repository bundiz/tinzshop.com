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

function Harness({ search, initial }: { search: (query: string) => Promise<ProductPickerHit[]>; initial: ProductPickerHit[] }) {
  const [selected, setSelected] = useState(initial);
  return <ProductPicker selected={selected} onChange={setSelected} search={search} />;
}

async function mount(initial: ProductPickerHit[] = []) {
  const search = vi.fn(async (query: string) => [SSD, ZELDA].filter((hit) => hit.name.toLowerCase().includes(query.toLowerCase())));
  await act(async () => {
    root.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Bangkok">
        <Harness search={search} initial={initial} />
      </NextIntlClientProvider>,
    );
  });
  return search;
}

const box = () => container.querySelector<HTMLInputElement>('input[type="search"]')!;
const options = () => [...container.querySelectorAll('[role="listbox"] li b')].map((name) => name.textContent);
const wait = (ms: number) => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, ms));
});

describe('ProductPicker as a dropdown (D-270)', () => {
  it('puts the search box above the chosen products, and shows no list until the box is clicked', async () => {
    const search = await mount([SSD]);
    const chosen = container.querySelector('input[name="productId"]')!;
    expect(box().compareDocumentPosition(chosen) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await wait(20);
    expect(search).not.toHaveBeenCalled();
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(box().getAttribute('aria-expanded')).toBe('false');
  });

  it('opens a floating list of products on click (chosen ones left out), narrows it as you type, and closes on a pick', async () => {
    const search = await mount([SSD]);
    await act(async () => box().click());
    await wait(20);
    expect(search).toHaveBeenCalledWith('');
    expect(box().getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('[role="listbox"]')!.className).toContain('absolute');
    expect(options()).toEqual(['Zelda']);
    await act(async () => container.querySelector<HTMLButtonElement>('[role="listbox"] li button')!.click());
    expect([...container.querySelectorAll<HTMLInputElement>('input[name="productId"]')].map((input) => input.value)).toEqual([SSD.id, ZELDA.id]);
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(box().value).toBe('');
  });

  it('closes on Escape and on a press outside', async () => {
    await mount();
    await act(async () => box().click());
    await wait(20);
    expect(options()).toEqual(['Portable SSD', 'Zelda']);
    await act(async () => box().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    await act(async () => box().click());
    await wait(20);
    await act(async () => document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });
});
