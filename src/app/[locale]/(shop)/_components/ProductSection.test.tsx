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
    expect(render(<ProductSection id="bestSellers" titleKey="home.bestSellers.title" cards={[]} />)).toBe('');
  });

  it('renders the title and each card with price, stock and the image placeholder', () => {
    const html = render(<ProductSection id="bestSellers" titleKey="home.bestSellers.title" cards={[card]} />);
    expect(html).toContain(th.shop.home.bestSellers.title);
    expect(html).toContain('id="bestSellers"');
    expect(html).toContain(card.name);
    expect(html).toContain('2,290');
    expect(html).toContain(th.shop.product.stock.out_of_stock);
    expect(html).toContain(th.shop.product.imagePlaceholderAlt);
  });

  it('shows the product image with the name as alt text', () => {
    const html = render(
      <ProductSection
        id="preOrders"
        titleKey="home.preOrders.title"
        cards={[{ ...card, imageUrl: 'https://example.test/a.jpg', isPreOrder: true }]}
      />,
    );
    expect(html).toContain('src="https://example.test/a.jpg"');
    expect(html).toContain(`alt="${card.name}"`);
    expect(html).toContain('loading="lazy"');
    expect(html).toContain(th.shop.product.badge.preOrder);
  });

  it('carries the design\'s "view all" link in the section head', () => {
    const html = render(<ProductSection id="bestSellers" titleKey="home.bestSellers.title" cards={[card]} />);
    expect(html).toMatch(new RegExp(`<a href="#"[^>]*>${th.shop.home.section.more}`));
  });

  it('renders the bundles section as a warm rail with subtitle, view-all and kit badges', () => {
    const kits = [1, 2, 3].map((n) => ({ ...card, productId: `kit-${n}`, name: `ชุด ${n}`, isKit: true }));
    const html = render(
      <ProductSection
        id="bundles"
        titleKey="home.bundles.title"
        subtitleKey="home.bundles.subtitle"
        cards={kits}
        layout="rail"
        tone="warm"
      />,
    );
    expect(html).toContain('id="bundles"');
    expect(html).toContain(th.shop.home.bundles.title);
    expect(html).toContain(th.shop.home.bundles.subtitle);
    expect(html).toContain(th.shop.home.section.more);
    expect(html).toContain('var(--color-accent-soft)');
    expect(html).toContain('lg:auto-cols-[calc((100%-50px)/6)]');
    expect(html.match(new RegExp(`whitespace-nowrap[^>]*>${th.shop.product.badge.bundle}<`, 'g'))).toHaveLength(3);
  });

  it('omits the bundles section when there are no kits', () => {
    expect(
      render(<ProductSection id="bundles" titleKey="home.bundles.title" subtitleKey="home.bundles.subtitle" cards={[]} />),
    ).toBe('');
  });
});
