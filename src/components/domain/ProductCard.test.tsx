import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LandingProductCard } from '@/server/services/catalogue/landing-catalogue-service';
import en from '../../../messages/en.json';
import ProductCard from './ProductCard';

const card: LandingProductCard = {
  productId: '0b8e2f0e-1d7c-4f55-9a43-5d1a6a0c2f11',
  name: 'Sandbox SSD',
  imageUrl: null,
  priceSatang: 289000n,
  originalPriceSatang: null,
  isPriceRange: false,
  stockStatus: 'in_stock',
  isKit: false,
  isPreOrder: false,
  releaseDate: null,
};

describe('ProductCard', () => {
  it('links the product name to its product page in the current locale', () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Bangkok">
        <ProductCard card={card} />
      </NextIntlClientProvider>,
    );
    expect(html).toMatch(/<a[^>]*href="\/en\/products\/0b8e2f0e-1d7c-4f55-9a43-5d1a6a0c2f11"[^>]*>Sandbox SSD<\/a>/);
    expect(html).toContain(en.shop.product.imagePlaceholderAlt);
  });
});
