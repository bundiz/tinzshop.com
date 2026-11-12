import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import th from '../../../../../../../../messages/th.json';
import BuyActions from './BuyActions';

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

  it('shows no wishlist, share or K-Payment chips', () => {
    const html = render(<BuyActions />);
    expect(html).not.toContain('href="#"');
    expect(html).not.toContain('เพิ่มในรายการที่ชอบ');
    expect(html).not.toContain('แชร์');
    expect(html).not.toContain('K-Payment');
    expect(html).not.toContain('PromptPay');
  });
});
