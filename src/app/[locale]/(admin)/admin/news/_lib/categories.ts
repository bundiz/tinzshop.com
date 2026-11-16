import type { NewsCategoryRow } from '@/server/services/news/news-read-service';

/** The category's name in the viewer's language, or the other one. */
export function categoryName(names: NewsCategoryRow['names'], locale: string): string {
  return (locale === 'en' ? (names.en ?? names.th) : (names.th ?? names.en)) ?? '';
}

/**
 * The editor's checkboxes: the listed categories (D-139), already in `position` order, then the article's own unlisted
 * ones (`linkedIds`, D-141) marked `unlisted`, so a save keeps them. An unlisted category the article does not hold is never
 * offered (D-248).
 */
export function listedCategoryOptions(
  categories: readonly NewsCategoryRow[],
  locale: string,
  linkedIds: readonly string[] = [],
): { id: string; name: string; unlisted?: boolean }[] {
  const listed = categories.filter((category) => category.isListed).map((category) => ({ id: category.id, name: categoryName(category.names, locale) }));
  const kept = categories
    .filter((category) => !category.isListed && linkedIds.includes(category.id))
    .map((category) => ({ id: category.id, name: categoryName(category.names, locale), unlisted: true }));
  return [...listed, ...kept];
}
