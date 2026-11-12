import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LandingProductCard } from '@/server/services/catalogue/landing-catalogue-service';
import en from '../../../messages/en.json';
import th from '../../../messages/th.json';
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

function renderTh(value: LandingProductCard): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="th" messages={th} timeZone="Asia/Bangkok">
      <ProductCard card={value} />
    </NextIntlClientProvider>,
  );
}

describe('ProductCard', () => {
  it('links the product name to its product page in the current locale', () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Bangkok">
        <ProductCard card={card} />
      </NextIntlClientProvider>,
    );
    expect(html).toMatch(/<a[^>]*href="\/en\/product\/0b8e2f0e-1d7c-4f55-9a43-5d1a6a0c2f11\/detail"[^>]*>Sandbox SSD<\/a>/);
    expect(html).toContain(en.shop.product.imagePlaceholderAlt);
  });

  it('the heart and the cart button are inert buttons naming the product, with no aria-pressed', () => {
    const html = renderTh(card);
    expect(html).toContain(`<button type="button" aria-label="เพิ่ม Sandbox SSD ในรายการที่ชอบ"`);
    expect(html).toContain(`<button type="button" aria-label="ใส่ Sandbox SSD ลงตะกร้า"`);
    expect(html).not.toContain('aria-pressed');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('★');
  });

  it("an out-of-stock card's cart button is disabled and labelled สินค้าหมด", () => {
    const html = renderTh({ ...card, stockStatus: 'out_of_stock' });
    expect(html).toMatch(/<button type="button" disabled=""[^>]*aria-label="สินค้าหมด"/);
    expect(html).not.toContain('ใส่ Sandbox SSD ลงตะกร้า');
    expect(html).toContain('grayscale-[.9]');
  });

  it('shows ลดราคา and the red price only when the original is above the price', () => {
    const onSale = renderTh({ ...card, originalPriceSatang: 349000n });
    expect(onSale).toContain('ลดราคา');
    expect(onSale).toContain('sm:text-xl text-sale');
    for (const original of [null, 289000n, 200000n]) {
      const html = renderTh({ ...card, originalPriceSatang: original });
      expect(html).not.toContain('ลดราคา');
      expect(html).not.toContain('sm:text-xl text-sale');
    }
  });

  it('shows no category line, no instalment line and no rating', () => {
    const html = renderTh(card);
    expect(html).not.toContain('★');
    expect(html).not.toMatch(/ผ่อน|\/เดือน|installment|per month/i);
    expect(html).not.toMatch(/review|รีวิว|rating|คะแนน/i);
    // The title is the first text after the image: no line above it names a platform or category.
    expect(html.match(/<h3/g)).toHaveLength(1);
    expect(html).not.toContain('card__plat');
  });

  it('puts the kit and pre-order tags in the corner', () => {
    const html = renderTh({ ...card, isKit: true, isPreOrder: true });
    expect(html).toContain('ชุดโปรโมชั่น');
    expect(html).toContain('พรีออเดอร์');
  });
});
