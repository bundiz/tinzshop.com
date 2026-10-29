import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import th from '../../../../../../../../messages/th.json';
import Breadcrumb, { type BreadcrumbProps } from './Breadcrumb';

function render(props: BreadcrumbProps): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="th" messages={th} timeZone="Asia/Bangkok">
      <Breadcrumb {...props} />
    </NextIntlClientProvider>,
  );
}

/** Each crumb as `[text, href]`; the last one has no link. */
function crumbs(html: string): [string, string | null][] {
  const decode = (text: string) => text.replaceAll('&amp;', '&');
  return [...html.matchAll(/<li[^>]*>(.*?)<\/li>/g)].map(([, inner = '']) => {
    const href = /href="([^"]*)"/.exec(inner)?.[1];
    return [decode(inner.replace(/<svg.*<\/svg>/, '').replace(/<[^>]+>/g, '')), href === undefined ? null : decode(href)];
  });
}

describe('Breadcrumb', () => {
  it('links home, the platform and the type to the listing, then names the product', () => {
    const html = render({
      productName: 'Astro Bot',
      platformCategory: { slug: 'playstation-5', name: 'PlayStation 5' },
      productType: { slug: 'playstation-5-game', name: 'แผ่นเกม' },
    });
    expect(crumbs(html)).toEqual([
      [th.shop.product.breadcrumb.home, '/th'],
      ['PlayStation 5', '/th/product?category=playstation-5'],
      ['แผ่นเกม', '/th/product?category=playstation-5&type=playstation-5-game'],
      ['Astro Bot', null],
    ]);
    expect(html).toContain('aria-current="page"');
  });

  it('links a platform alone when the product has no type', () => {
    const html = render({
      productName: 'Astro Bot',
      platformCategory: { slug: 'playstation-5', name: 'PlayStation 5' },
      productType: null,
    });
    expect(crumbs(html).map(([, href]) => href)).toEqual(['/th', '/th/product?category=playstation-5', null]);
  });

  it('falls back to all products for an uncategorised product', () => {
    const html = render({ productName: 'Astro Bot', platformCategory: null, productType: null });
    expect(crumbs(html)).toEqual([
      [th.shop.product.breadcrumb.home, '/th'],
      [th.shop.product.breadcrumb.allProducts, '/th/product'],
      ['Astro Bot', null],
    ]);
  });
});
