import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import th from '../../../../../../../../messages/th.json';
import ProductHeading, { type ProductHeadingProps } from './ProductHeading';

const BASE: ProductHeadingProps = {
  name: 'ชุด PS5',
  isKit: false,
  isPreOrder: false,
  releaseDate: null,
  platform: null,
  productType: null,
};

function render(props: Partial<ProductHeadingProps>): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="th" messages={th} timeZone="Asia/Bangkok">
      <ProductHeading {...BASE} {...props} />
    </NextIntlClientProvider>,
  );
}

describe('ProductHeading', () => {
  it('shows the promotion-set badge next to the title for a kit', () => {
    const html = render({ isKit: true });
    expect(html).toContain(th.shop.product.badge.bundle);
    expect(html).toContain('id="product-title"');
    expect(html).toContain('ชุด PS5');
  });

  it('shows no badge for a normal product', () => {
    const html = render({});
    expect(html).not.toContain(th.shop.product.badge.bundle);
    expect(html).not.toContain(th.shop.product.badge.preOrder);
    expect(html).toContain('ชุด PS5');
  });

  it('shows the pre-order badge, and the release date only for a pre-order', () => {
    const html = render({ isPreOrder: true, releaseDate: new Date('2026-12-01') });
    expect(html).toContain(th.shop.product.badge.preOrder);
    expect(html).toContain('วางจำหน่าย');
    expect(html).toMatch(/text-warn[^>]*>[^<]*วางจำหน่าย/);
    expect(render({ isPreOrder: false, releaseDate: new Date('2026-12-01') })).not.toContain('วางจำหน่าย');
  });

  it('shows the platform tag "{platform} · {type}" in the platform\'s tone, and none without a platform', () => {
    const html = render({
      platform: { slug: 'playstation-5', name: 'PlayStation 5' },
      productType: { slug: 'playstation-5-console', name: 'เครื่องเกม' },
    });
    expect(html).toMatch(/<span[^>]*bg-ps-soft[^>]*>PlayStation 5 · เครื่องเกม<\/span>/);
    const switchHtml = render({ platform: { slug: 'nintendo-switch', name: 'Nintendo Switch' }, productType: null });
    expect(switchHtml).toMatch(/<span[^>]*bg-ns-soft[^>]*>Nintendo Switch<\/span>/);
    expect(render({})).not.toContain('bg-ps-soft');
    expect(render({})).not.toContain(' · ');
  });
});
