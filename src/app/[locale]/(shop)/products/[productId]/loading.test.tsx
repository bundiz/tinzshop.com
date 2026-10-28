import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import th from '../../../../../../messages/th.json';
import ProductLoading from './loading';

describe('the product page loading state', () => {
  it('renders a busy skeleton of the gallery and buy box with the loading label', () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="th" messages={th} timeZone="Asia/Bangkok">
        <ProductLoading />
      </NextIntlClientProvider>,
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain(th.shop.loading.label);
    expect(html).toContain('data-skeleton="gallery"');
    expect(html).toContain('data-skeleton="buy-box"');
  });
});
