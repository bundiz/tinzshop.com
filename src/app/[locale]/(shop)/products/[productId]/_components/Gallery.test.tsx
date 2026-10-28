import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import th from '../../../../../../../messages/th.json';
import Gallery from './Gallery';

function render(node: ReactNode): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="th" messages={th} timeZone="Asia/Bangkok">
      {node}
    </NextIntlClientProvider>,
  );
}

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
