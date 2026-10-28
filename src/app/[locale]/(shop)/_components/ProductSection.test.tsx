import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LandingProductCard } from '@/server/services/catalogue/landing-catalogue-service';
import th from '../../../../../messages/th.json';
import ProductSection from './ProductSection';

function render(node: ReactNode): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="th" messages={th} timeZone="Asia/Bangkok">
      {node}
    </NextIntlClientProvider>,
  );
}

const card: LandingProductCard = {
  productId: '0b8e2f0e-1d7c-4f55-9a43-5d1a6a0c2f11',
  name: 'จอย DualSense Wireless Controller',
  imageUrl: null,
  priceSatang: 229000n,
  originalPriceSatang: null,
  isPriceRange: false,
  stockStatus: 'out_of_stock',
  isKit: false,
  isPreOrder: false,
  releaseDate: null,
};

describe('ProductSection', () => {
  it('omits a section with no products', () => {
    expect(render(<ProductSection titleKey="bestSellers.title" cards={[]} />)).toBe('');
  });

  it('renders the title and each card with price, stock and the image placeholder', () => {
    const html = render(<ProductSection titleKey="bestSellers.title" cards={[card]} />);
    expect(html).toContain(th.shop.home.bestSellers.title);
    expect(html).toContain(card.name);
    expect(html).toContain('2,290');
    expect(html).toContain(th.shop.product.stock.out_of_stock);
    expect(html).toContain(th.shop.product.imagePlaceholderAlt);
  });

  it('shows the product image with the name as alt text', () => {
    const html = render(
      <ProductSection
        titleKey="preOrders.title"
        cards={[{ ...card, imageUrl: 'https://example.test/a.jpg', isPreOrder: true }]}
      />,
    );
    expect(html).toContain('src="https://example.test/a.jpg"');
    expect(html).toContain(`alt="${card.name}"`);
    expect(html).toContain('loading="lazy"');
    expect(html).toContain(th.shop.product.badge.preOrder);
  });
});
