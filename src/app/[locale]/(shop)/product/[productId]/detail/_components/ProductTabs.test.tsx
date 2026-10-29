import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import th from '../../../../../../../../messages/th.json';
import ProductTabs from './ProductTabs';

function render(node: ReactNode): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="th" messages={th} timeZone="Asia/Bangkok">
      {node}
    </NextIntlClientProvider>,
  );
}

describe('ProductTabs', () => {
  it('renders the description as plain text with its line breaks kept', () => {
    const html = render(
      <ProductTabs description={'บรรทัดหนึ่ง\n<b>ไม่ใช่ HTML</b>'} brandName="NoBrand" shippingSizeTier="large" />,
    );
    expect(html).toContain('whitespace-pre-line');
    expect(html).toContain('&lt;b&gt;ไม่ใช่ HTML&lt;/b&gt;');
    expect(html).not.toContain('<b>');
    expect(html).toContain(th.shop.product.tabs.description);
    expect(html).toContain(th.shop.product.tabs.spec);
    expect(html).toContain('NoBrand');
    expect(html).toContain(th.shop.product.spec.shippingSizeTier.large);
  });

  it('leaves out the shipping size row when it is not set', () => {
    const html = render(<ProductTabs description="d" brandName="NoBrand" shippingSizeTier={null} />);
    expect(html).not.toContain(th.shop.product.spec.shippingSize);
  });

  it('always has a reviews tab, whose panel is an empty state with no scores or counts', () => {
    const html = render(<ProductTabs description="" brandName={null} shippingSizeTier={null} />);
    expect(html).toContain(`>${th.shop.product.tabs.reviews}</button>`);
    expect(html).toContain(th.shop.product.reviews.empty);
    expect(html).not.toContain('★');
  });
});
