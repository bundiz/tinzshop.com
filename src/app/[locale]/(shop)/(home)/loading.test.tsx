import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import th from '../../../../../messages/th.json';
import ShopLoading from './loading';

describe('the shop loading state', () => {
  it('renders a busy skeleton of the card grid with the loading label', () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="th" messages={th} timeZone="Asia/Bangkok">
        <ShopLoading />
      </NextIntlClientProvider>,
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain(th.shop.loading.label);
    expect(html.match(/data-skeleton="card"/g)?.length).toBeGreaterThanOrEqual(4);
  });
});
