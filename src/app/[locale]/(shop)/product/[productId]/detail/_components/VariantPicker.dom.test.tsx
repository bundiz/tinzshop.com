// @vitest-environment jsdom
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ProductDetail } from '@/server/services/catalogue/product-detail-service';
import th from '../../../../../../../../messages/th.json';
import VariantPicker from './VariantPicker';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const optionTypes: ProductDetail['optionTypes'] = [
  { id: 'capacity', name: 'Capacity', values: [{ id: '1tb', value: '1TB' }, { id: '2tb', value: '2TB' }] },
];
const variants: ProductDetail['variants'] = [
  { variantId: 'v-1tb', optionValueIds: ['1tb'], priceSatang: 289000n, originalPriceSatang: null, stockStatus: 'in_stock' },
  { variantId: 'v-2tb', optionValueIds: ['2tb'], priceSatang: 459000n, originalPriceSatang: 499000n, stockStatus: 'in_stock' },
];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root.render(
      <NextIntlClientProvider locale="th" messages={th} timeZone="Asia/Bangkok">
        <VariantPicker optionTypes={optionTypes} variants={variants} defaultVariantId="v-1tb" />
      </NextIntlClientProvider>,
    ),
  );
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const bar = () => container.querySelector('[data-buy-bar]')!.textContent ?? '';

describe('VariantPicker buy bar', () => {
  it("the phone buy bar shows the chosen variant's price and follows a new choice", () => {
    expect(bar()).toContain('฿2,890');
    expect(bar()).toContain('1TB');
    act(() => container.querySelector<HTMLInputElement>('input[value="2tb"]')!.click());
    expect(bar()).toContain('฿4,590');
    expect(bar()).not.toContain('฿2,890');
    expect(bar()).toContain('2TB');
    // The sale's struck price is the picker's, not the bar's.
    expect(bar()).not.toContain('฿4,990');
    act(() => container.querySelector<HTMLInputElement>('input[value="1tb"]')!.click());
    expect(bar()).toContain('฿2,890');
  });
});
