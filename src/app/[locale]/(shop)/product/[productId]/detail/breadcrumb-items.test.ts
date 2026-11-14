import { describe, expect, it } from 'vitest';
import { breadcrumbItems } from './breadcrumb-items';

const labels = { home: 'หน้าแรก', allProducts: 'สินค้าทั้งหมด' };

describe('breadcrumbItems', () => {
  it('links home, the platform and the type to the listing, then names the product', () => {
    expect(
      breadcrumbItems('th', labels, {
        productName: 'Astro Bot',
        platformCategory: { slug: 'playstation-5', name: 'PlayStation 5' },
        productType: { slug: 'playstation-5-game', name: 'แผ่นเกม' },
      }),
    ).toEqual([
      { label: 'หน้าแรก', href: '/th' },
      { label: 'PlayStation 5', href: '/th/product?category=playstation-5' },
      { label: 'แผ่นเกม', href: '/th/product?category=playstation-5&type=playstation-5-game' },
      { label: 'Astro Bot' },
    ]);
  });

  it('links a platform alone when the product has no type', () => {
    const items = breadcrumbItems('th', labels, {
      productName: 'Astro Bot',
      platformCategory: { slug: 'playstation-5', name: 'PlayStation 5' },
      productType: null,
    });
    expect(items.map((item) => item.href)).toEqual(['/th', '/th/product?category=playstation-5', undefined]);
  });

  it('falls back to all products for an uncategorised product', () => {
    expect(
      breadcrumbItems('th', labels, { productName: 'Astro Bot', platformCategory: null, productType: null }),
    ).toEqual([
      { label: 'หน้าแรก', href: '/th' },
      { label: 'สินค้าทั้งหมด', href: '/th/product' },
      { label: 'Astro Bot' },
    ]);
  });
});
