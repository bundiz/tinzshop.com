import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ProductDetail } from '@/server/services/catalogue/product-detail-service';
import th from '../../../../../../../messages/th.json';
import VariantPicker, { selectValue } from './VariantPicker';

function render(node: ReactNode): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="th" messages={th} timeZone="Asia/Bangkok">
      {node}
    </NextIntlClientProvider>,
  );
}

/** The SSD shape: 2 capacities × 3 colours, with 2TB Blue missing, no Red at all, and 1TB Black sold out. */
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
      { id: 'red', value: 'Red' },
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
    // No active variant is Red, so Red cannot be chosen.
    expect(inputFor(html, 'red')).toContain('disabled');
    // 2TB Blue does not exist, but 1TB Blue does: Blue stays choosable.
    expect(inputFor(html, 'blue')).not.toContain('disabled');
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

  it('moves the other options to a variant that has a value picked with no match under the current choices', () => {
    // 2TB Blue does not exist; picking Blue on 2TB Black lands on 1TB Blue.
    expect(selectValue(optionTypes, variants, { capacity: '2tb', colour: 'black' }, 'colour', 'blue')).toEqual({
      capacity: '1tb',
      colour: 'blue',
    });
    // A value that matches under the current choices changes only that option.
    expect(selectValue(optionTypes, variants, { capacity: '2tb', colour: 'black' }, 'capacity', '1tb')).toEqual({
      capacity: '1tb',
      colour: 'black',
    });
  });

  describe('a diagonal set (only 1TB Black and 2TB White are active)', () => {
    const diagonalTypes: ProductDetail['optionTypes'] = [
      optionTypes[0]!,
      {
        id: 'colour',
        name: 'Colour',
        values: [
          { id: 'black', value: 'Black' },
          { id: 'white', value: 'White' },
        ],
      },
    ];
    const diagonal: ProductDetail['variants'] = [
      { variantId: 'v-1tb-black', optionValueIds: ['1tb', 'black'], priceSatang: 269000n, originalPriceSatang: null, stockStatus: 'in_stock' },
      { variantId: 'v-2tb-white', optionValueIds: ['2tb', 'white'], priceSatang: 459000n, originalPriceSatang: null, stockStatus: 'in_stock' },
    ];

    it('keeps 2TB and White choosable from 1TB Black', () => {
      const html = render(<VariantPicker optionTypes={diagonalTypes} variants={diagonal} defaultVariantId="v-1tb-black" />);
      expect(inputFor(html, '2tb')).not.toContain('disabled');
      expect(inputFor(html, 'white')).not.toContain('disabled');
    });

    it('reaches 2TB White by picking either 2TB or White', () => {
      const from = { capacity: '1tb', colour: 'black' };
      const reached = { capacity: '2tb', colour: 'white' };
      expect(selectValue(diagonalTypes, diagonal, from, 'capacity', '2tb')).toEqual(reached);
      expect(selectValue(diagonalTypes, diagonal, from, 'colour', 'white')).toEqual(reached);
    });
  });

  it('moves to the in-stock variant first, then the cheapest', () => {
    const types: ProductDetail['optionTypes'] = [
      { id: 'size', name: 'Size', values: [{ id: 's', value: 'S' }, { id: 'l', value: 'L' }] },
      { id: 'colour', name: 'Colour', values: [{ id: 'a', value: 'A' }, { id: 'b', value: 'B' }, { id: 'c', value: 'C' }, { id: 'd', value: 'D' }] },
    ];
    const set: ProductDetail['variants'] = [
      { variantId: 's-a', optionValueIds: ['s', 'a'], priceSatang: 100n, originalPriceSatang: null, stockStatus: 'in_stock' },
      { variantId: 'l-b', optionValueIds: ['l', 'b'], priceSatang: 100n, originalPriceSatang: null, stockStatus: 'out_of_stock' },
      { variantId: 'l-c', optionValueIds: ['l', 'c'], priceSatang: 300n, originalPriceSatang: null, stockStatus: 'in_stock' },
      { variantId: 'l-d', optionValueIds: ['l', 'd'], priceSatang: 200n, originalPriceSatang: null, stockStatus: 'in_stock' },
    ];
    expect(selectValue(types, set, { size: 's', colour: 'a' }, 'size', 'l')).toEqual({ size: 'l', colour: 'd' });
  });
});
