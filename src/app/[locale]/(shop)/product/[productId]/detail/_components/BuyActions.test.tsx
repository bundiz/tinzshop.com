import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import th from '../../../../../../../../messages/th.json';
import BuyActions from './BuyActions';
import ServicePanel from './ServicePanel';

function render(node: React.ReactNode): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="th" messages={th} timeZone="Asia/Bangkok">
      {node}
    </NextIntlClientProvider>,
  );
}

describe('BuyActions', () => {
  it('renders the stepper, cart and buy-now controls inert, at quantity 1', () => {
    const html = render(<BuyActions />);
    expect(html).not.toContain('<form');
    expect(html).not.toContain('type="submit"');
    expect(html.match(/<button type="button"/g)?.length).toBe(4);
    expect(html).toContain('value="1"');
    expect(html).toContain('readOnly=""');
    expect(html).toContain(th.shop.product.addToCart);
    expect(html).toContain(th.shop.product.buyNow);
  });
});

describe('ServicePanel', () => {
  it('shows the K-Payment block with its three chips', () => {
    const html = render(<ServicePanel />);
    expect(html).toContain(th.shop.product.service.payment.title);
    for (const chip of ['card', 'instalment', 'promptPay'] as const) {
      expect(html).toContain(th.shop.product.service.payment[chip]);
    }
  });
});
