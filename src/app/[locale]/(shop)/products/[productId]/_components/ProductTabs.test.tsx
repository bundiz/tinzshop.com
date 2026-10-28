import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import th from '../../../../../../../messages/th.json';
import Gallery from './Gallery';
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
});

describe('Gallery', () => {
  it('shows the placeholder when a product has no image', () => {
    const html = render(<Gallery imageUrls={[]} name="Sandbox SSD" />);
    expect(html).toContain(th.shop.product.imagePlaceholderAlt);
    expect(html).not.toContain('<img');
  });

  it('shows the first image with the product name as alt, and a thumbnail per image', () => {
    const html = render(<Gallery imageUrls={['https://cf.shopee.co.th/file/a', 'https://cf.shopee.co.th/file/b']} name="Sandbox SSD" />);
    expect(html).toMatch(/<img[^>]*src="https:\/\/cf.shopee.co.th\/file\/a"[^>]*alt="Sandbox SSD"/);
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html).toContain('aria-pressed="true"');
  });
});
