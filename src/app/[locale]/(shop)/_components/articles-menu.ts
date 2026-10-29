import type { ListedNewsCategory } from '@/server/services/news/news-read-service';
import { newsCategoryPath, newsListPath } from '../news/news-routes';

/** A label under `shop.header.articles`. */
export type ArticlesMenuLabelKey = 'reviews' | 'products' | 'news';

/**
 * One item of the header's "บทความ" menu: a message key and the news category slug it opens. `slug` null
 * is the list of every article (`/{locale}/news`), which always exists; `children` are category slugs
 * named from the database.
 */
export type ArticlesMenuConfigItem = {
  labelKey: ArticlesMenuLabelKey;
  slug: string | null;
  children?: readonly string[];
};

/** The owner's "บทความ" menu (2026-10-29, D-140): รีวิวสินค้า, สินค้า, and News › with three of its categories. */
export const ARTICLES_MENU: readonly ArticlesMenuConfigItem[] = [
  { labelKey: 'reviews', slug: 'reviews' },
  { labelKey: 'products', slug: 'products' },
  { labelKey: 'news', slug: null, children: ['nintendo-switch-2', 'nintendo', 'sony-playstation'] },
];

/** One menu item ready to render: its label key, its link and its submenu links with database names. */
export type ArticlesMenuEntry = {
  labelKey: ArticlesMenuLabelKey;
  href: string;
  children: { name: string; href: string }[];
};

/**
 * The menu from the listed categories: an item or submenu link whose category is missing or unlisted is
 * left out, so a link never 404s. With no category at all (the read failed) only News is left.
 */
export function buildArticlesMenu(
  listed: readonly ListedNewsCategory[],
  locale: string,
  config: readonly ArticlesMenuConfigItem[] = ARTICLES_MENU,
): ArticlesMenuEntry[] {
  const nameBySlug = new Map(listed.map((category) => [category.slug, category.name]));
  const entries: ArticlesMenuEntry[] = [];
  for (const item of config) {
    if (item.slug !== null && !nameBySlug.has(item.slug)) continue;
    const children = (item.children ?? []).flatMap((slug) => {
      const name = nameBySlug.get(slug);
      return name === undefined ? [] : [{ name, href: newsCategoryPath(locale, slug) }];
    });
    entries.push({
      labelKey: item.labelKey,
      href: item.slug === null ? newsListPath(locale) : newsCategoryPath(locale, item.slug),
      children,
    });
  }
  return entries;
}
