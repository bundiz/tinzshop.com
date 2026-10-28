import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ProductDetail } from '@/server/services/catalogue/product-detail-service';
import th from '../../../../../../../messages/th.json';
import VariantPicker from './VariantPicker';

function render(node: ReactNode): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="th" messages={th} timeZone="Asia/Bangkok">
      {node}
    </NextIntlClientProvider>,
  );
}

/** The SSD shape: 2 capacities × 2 colours, with 2TB Blue missing and 1TB Black sold out. */
const optionTypes: ProductDetail['optionTypes'] = [
  {
    id: 'capacity',
    name: 'Capacity',
    values: [
      { id: '1tb', value: '1TB' },
      { id: '2tb', value: '2TB' },
    ],
  },
  {
    id: 'colour',
    name: 'Colour',
    values: [
      { id: 'black', value: 'Black' },
      { id: 'blue', value: 'Blue' },
    ],
  },
];

const variants: ProductDetail['variants'] = [
  { variantId: 'v-1tb-black', optionValueIds: ['1tb', 'black'], priceSatang: 269000n, originalPriceSatang: null, stockStatus: 'out_of_stock' },
  { variantId: 'v-1tb-blue', optionValueIds: ['1tb', 'blue'], priceSatang: 289000n, originalPriceSatang: null, stockStatus: 'in_stock' },
  { variantId: 'v-2tb-black', optionValueIds: ['2tb', 'black'], priceSatang: 459000n, originalPriceSatang: 499000n, stockStatus: 'in_stock' },
];

function inputFor(html: string, valueId: string): string {
  const match = html.match(new RegExp(`<input[^>]*value="${valueId}"[^>]*>`));
  if (match === null) throw new Error(`no input for ${valueId}`);
  return match[0];
}

describe('VariantPicker', () => {
  it('marks sold-out and missing combinations', () => {
    const html = render(<VariantPicker optionTypes={optionTypes} variants={variants} defaultVariantId="v-2tb-black" />);

    // With 2TB Black chosen, 1TB keeps Black, and 1TB Black is sold out.
    expect(html).toContain(th.shop.product.option.soldOut.replace('{value}', '1TB'));
    expect(inputFor(html, '1tb')).not.toContain('disabled');
    // 2TB Blue does not exist, so Blue cannot be chosen.
    expect(inputFor(html, 'blue')).toContain('disabled');
    expect(inputFor(html, '2tb')).toContain('checked');
    expect(inputFor(html, 'black')).toContain('checked');
  });

  it("shows the chosen variant's price and stock status", () => {
    const html = render(<VariantPicker optionTypes={optionTypes} variants={variants} defaultVariantId="v-2tb-black" />);
    expect(html).toContain('4,590');
    expect(html).toContain('4,990');
    expect(html).toContain(th.shop.product.stock.in_stock);
    expect(html).toContain('<strong>2TB</strong>');
  });

  it('renders price and stock alone for a product with no options', () => {
    const html = render(
      <VariantPicker
        optionTypes={[]}
        variants={[{ variantId: 'only', optionValueIds: [], priceSatang: 159000n, originalPriceSatang: null, stockStatus: 'out_of_stock' }]}
        defaultVariantId="only"
      />,
    );
    expect(html).toContain('1,590');
    expect(html).toContain(th.shop.product.stock.out_of_stock);
    expect(html).not.toContain('<fieldset');
  });
});
