import { describe, expect, it } from 'vitest';
import { ARTICLES_MENU, buildArticlesMenu } from './articles-menu';

// Listed categories as the read returns them: slug and name in the locale.
const LISTED = [
  { slug: 'reviews', name: 'Reviews' },
  { slug: 'products', name: 'Products' },
  { slug: 'nintendo-switch-2', name: 'Nintendo Switch 2' },
  { slug: 'nintendo', name: 'NINTENDO' },
  { slug: 'sony-playstation', name: 'SONY Playstation' },
];

describe('ARTICLES_MENU', () => {
  it('is the owner\'s menu: รีวิวสินค้า, สินค้า, and News with its three categories (D-140)', () => {
    expect(ARTICLES_MENU).toEqual([
      { labelKey: 'reviews', slug: 'reviews' },
      { labelKey: 'products', slug: 'products' },
      { labelKey: 'news', slug: null, children: ['nintendo-switch-2', 'nintendo', 'sony-playstation'] },
    ]);
  });
});

describe('buildArticlesMenu', () => {
  it('links every configured item whose category is listed, with the submenu named from the database', () => {
    expect(buildArticlesMenu(LISTED, 'th')).toEqual([
      { labelKey: 'reviews', href: '/th/news/category/reviews', children: [] },
      { labelKey: 'products', href: '/th/news/category/products', children: [] },
      {
        labelKey: 'news',
        href: '/th/news',
        children: [
          { name: 'Nintendo Switch 2', href: '/th/news/category/nintendo-switch-2' },
          { name: 'NINTENDO', href: '/th/news/category/nintendo' },
          { name: 'SONY Playstation', href: '/th/news/category/sony-playstation' },
        ],
      },
    ]);
  });

  it('leaves out an item whose category is missing or unlisted, so a link never 404s', () => {
    const menu = buildArticlesMenu(
      LISTED.filter((c) => c.slug !== 'products' && c.slug !== 'nintendo'),
      'en',
    );
    expect(menu.map((entry) => entry.labelKey)).toEqual(['reviews', 'news']);
    expect(menu[1]?.children.map((child) => child.href)).toEqual([
      '/en/news/category/nintendo-switch-2',
      '/en/news/category/sony-playstation',
    ]);
  });

  it('keeps News, which links to the list of every article, when no category could be read', () => {
    expect(buildArticlesMenu([], 'th')).toEqual([{ labelKey: 'news', href: '/th/news', children: [] }]);
  });

  it('encodes a Thai slug in its link', () => {
    expect(buildArticlesMenu([{ slug: 'รีวิว', name: 'x' }], 'th', [{ labelKey: 'reviews', slug: 'รีวิว' }])).toEqual([
      { labelKey: 'reviews', href: `/th/news/category/${encodeURIComponent('รีวิว')}`, children: [] },
    ]);
  });
});
