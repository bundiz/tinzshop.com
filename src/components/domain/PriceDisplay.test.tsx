import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import th from '../../../messages/th.json';
import PriceDisplay from './PriceDisplay';

function render(node: ReactNode): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="th" messages={th} timeZone="Asia/Bangkok">
      {node}
    </NextIntlClientProvider>,
  );
}

describe('PriceDisplay', () => {
  it('PriceDisplay formats satang as baht', () => {
    expect(render(<PriceDisplay satang={299000n} />)).toContain('2,990');

    const range = render(<PriceDisplay satang={299000n} isRange />);
    expect(range).toContain(th.shop.product.price.from.replace(' {price}', ''));
    expect(range).toContain('2,990');
  });

  it('keeps satang when the amount is not whole baht', () => {
    expect(render(<PriceDisplay satang={199050n} />)).toContain('1,990.50');
  });

  it('shows the original price beside a reduced one', () => {
    const html = render(<PriceDisplay satang={299000n} original={349000n} />);
    expect(html).toContain('<s');
    expect(html).toContain('3,490');
  });

  it('labels the struck-through price for screen readers', () => {
    const html = render(<PriceDisplay satang={299000n} original={349000n} />);
    expect(html).toContain(`<span class="sr-only">${th.shop.product.price.original}</span>`);
    expect(render(<PriceDisplay satang={299000n} />)).not.toContain(th.shop.product.price.original);
  });

  it('card is the heading-font price that grows from sm', () => {
    const html = render(<PriceDisplay satang={299000n} size="card" />);
    expect(html).toContain('font-head text-lg font-bold sm:text-xl');
  });

  it('buyBox is the large 36px price', () => {
    expect(render(<PriceDisplay satang={299000n} size="buyBox" />)).toContain('text-[36px]');
  });

  it('feature is the 26px white price for the navy card', () => {
    const html = render(<PriceDisplay satang={299000n} size="feature" />);
    expect(html).toContain('text-[26px]');
    expect(html).toContain('text-white');
  });

  it('mini is the 13px body-font price', () => {
    const html = render(<PriceDisplay satang={299000n} size="mini" />);
    expect(html).toContain('text-[13px] font-normal');
    expect(html).toContain('font-body');
  });

  it('puts a reduced price in red and strikes the original through in muted grey', () => {
    const html = render(<PriceDisplay satang={299000n} original={349000n} />);
    expect(html).toMatch(/<span class="[^"]*text-sale/);
    expect(html).toContain('text-sm text-muted line-through');
  });

  it('shows no sale look when the original is not above the price (D-123)', () => {
    for (const original of [299000n, 250000n]) {
      const html = render(<PriceDisplay satang={299000n} original={original} />);
      expect(html).not.toMatch(/<span class="[^"]*text-sale/);
      expect(html).not.toContain('<s class');
    }
  });

  it('keeps the price white on navy when reduced: red fails 3:1 there, the struck original tells the sale', () => {
    for (const size of ['feature', 'mini'] as const) {
      const html = render(<PriceDisplay satang={299000n} original={349000n} size={size} />);
      expect(html).not.toContain('text-sale');
      expect(html).toContain('text-on-navy-2 line-through');
    }
    expect(render(<PriceDisplay satang={299000n} original={349000n} size="feature" />)).toContain('text-white');
  });

  it('leaves no stray space in a plain price class', () => {
    expect(render(<PriceDisplay satang={299000n} />)).toContain('<span class="font-head text-lg font-bold sm:text-xl">');
  });
});
