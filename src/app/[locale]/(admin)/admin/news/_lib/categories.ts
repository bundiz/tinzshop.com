import type { NewsCategoryRow } from '@/server/services/news/news-read-service';

/** The category's name in the viewer's language, or the other one. */
export function categoryName(names: NewsCategoryRow['names'], locale: string): string {
  return (locale === 'en' ? (names.en ?? names.th) : (names.th ?? names.en)) ?? '';
}

/** The editor's checkboxes: the listed categories only (D-139), already in `position` order. */
export function listedCategoryOptions(categories: readonly NewsCategoryRow[], locale: string): { id: string; name: string }[] {
  return categories.filter((category) => category.isListed).map((category) => ({ id: category.id, name: categoryName(category.names, locale) }));
}
