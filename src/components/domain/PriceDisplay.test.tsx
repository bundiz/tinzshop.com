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
});
