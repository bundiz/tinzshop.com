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
    expect(render(<ProductSection id="bestSellers" titleKey="home.bestSellers.title" cards={[]} columns={5} />)).toBe('');
  });

  it('renders the title and each card with price, stock and the image placeholder', () => {
    const html = render(<ProductSection id="bestSellers" titleKey="home.bestSellers.title" cards={[card]} columns={5} />);
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
        id="bestSellers"
        titleKey="home.bestSellers.title"
        columns={5}
        cards={[{ ...card, imageUrl: 'https://example.test/a.jpg', isPreOrder: true }]}
      />,
    );
    expect(html).toContain('src="https://example.test/a.jpg"');
    expect(html).toContain(`alt="${card.name}"`);
    expect(html).toContain('loading="lazy"');
    expect(html).toContain(th.shop.product.badge.preOrder);
  });

  it('carries a "view all" link in the section head only when given a destination', () => {
    const none = render(<ProductSection id="bestSellers" titleKey="home.bestSellers.title" cards={[card]} columns={5} />);
    expect(none).not.toContain(th.shop.home.section.more);
    const linked = render(
      <ProductSection
        id="bestSellers"
        titleKey="home.bestSellers.title"
        cards={[card]}
        columns={5}
        moreHref="/th/product?sort=best_selling"
      />,
    );
    expect(linked).toMatch(new RegExp(`<a [^>]*href="/th/product\\?sort=best_selling"[^>]*>${th.shop.home.section.more}`));
  });

  it('renders the bundles section as a 5-column grid with subtitle, ดูชุดทั้งหมด and kit badges', () => {
    const kits = [1, 2, 3].map((n) => ({ ...card, productId: `kit-${n}`, name: `ชุด ${n}`, isKit: true }));
    const html = render(
      <ProductSection
        id="bundles"
        titleKey="home.bundles.title"
        subtitleKey="home.bundles.subtitle"
        cards={kits}
        columns={5}
        moreHref="/th/product?kit=1"
        moreLabelKey="home.bundles.more"
      />,
    );
    expect(html).toContain('id="bundles"');
    expect(html).toContain(th.shop.home.bundles.title);
    expect(html).toContain(th.shop.home.bundles.subtitle);
    expect(html).toMatch(new RegExp(`<a [^>]*href="/th/product\\?kit=1"[^>]*>${th.shop.home.bundles.more}`));
    expect(html).toContain('xl:grid-cols-5');
    expect(html).toContain('md:max-xl:[&amp;&gt;*:nth-child(n+9)]:hidden');
    expect(html).not.toContain('snap-x');
    expect(html.match(new RegExp(`whitespace-nowrap[^>]*>${th.shop.product.badge.bundle}<`, 'g'))).toHaveLength(3);
  });

  it('renders the 4-column grid for columns={4}', () => {
    const html = render(<ProductSection id="related" titleKey="product.related.title" cards={[card]} columns={4} />);
    expect(html).toContain('lg:grid-cols-4');
    expect(html).not.toContain('xl:grid-cols-5');
  });

  it('renders the best-seller chips as links, ทั้งหมด current', () => {
    const html = render(
      <ProductSection
        id="bestSellers"
        titleKey="home.bestSellers.title"
        cards={[card]}
        columns={5}
        filterLabel={th.shop.home.bestSellers.filterLabel}
        filterLinks={[
          { label: 'ทั้งหมด', href: null },
          { label: 'PS5', href: '/th/product?category=playstation-5&sort=best_selling' },
        ]}
      />,
    );
    expect(html).toContain(`aria-label="${th.shop.home.bestSellers.filterLabel}"`);
    expect(html).toMatch(/<span aria-current="true"[^>]*>ทั้งหมด<\/span>/);
    expect(html).toMatch(/<a [^>]*href="\/th\/product\?category=playstation-5&amp;sort=best_selling"[^>]*>PS5<\/a>/);
    expect(html).not.toMatch(/<a [^>]*>ทั้งหมด<\/a>/);
    expect(html).not.toContain('aria-pressed');
  });

  it('omits the bundles section when there are no kits', () => {
    expect(
      render(
        <ProductSection id="bundles" titleKey="home.bundles.title" subtitleKey="home.bundles.subtitle" cards={[]} columns={5} />,
      ),
    ).toBe('');
  });
});
