import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import th from '../../../../../../../messages/th.json';
import ProductHeading from './ProductHeading';

function render(isKit: boolean): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="th" messages={th} timeZone="Asia/Bangkok">
      <ProductHeading name="ชุด PS5" isKit={isKit} />
    </NextIntlClientProvider>,
  );
}

describe('ProductHeading', () => {
  it('shows the promotion-set badge next to the title for a kit', () => {
    const html = render(true);
    expect(html).toContain(th.shop.product.badge.bundle);
    expect(html).toContain('id="product-title"');
    expect(html).toContain('ชุด PS5');
  });

  it('shows no badge for a normal product', () => {
    const html = render(false);
    expect(html).not.toContain(th.shop.product.badge.bundle);
    expect(html).toContain('ชุด PS5');
  });
});
