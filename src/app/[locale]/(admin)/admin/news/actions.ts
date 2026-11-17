'use server';

import { hasLocale } from 'next-intl';
import { revalidatePath } from 'next/cache';

import { routing } from '@/i18n/routing';
import { getNewsAdminCommands } from '@/server/composition-root';
import type { NewsAdminState, NewsCategoryState } from '@/server/controllers/news/news-admin-controller';
import type { LandingProductCard } from '@/server/services/catalogue/landing-catalogue-service';
import type { ProductPickerHit } from '@/server/services/catalogue/product-search-service';
import { requirePermission } from '../_lib/require-permission';

/** The locale comes from a hidden form field; anything else falls back to the default, Thai. */
function localeOf(value: FormDataEntryValue | string | null | undefined): string {
  return typeof value === 'string' && hasLocale(routing.locales, value) ? value : routing.defaultLocale;
}

function refresh(locale: string, state: NewsAdminState): NewsAdminState {
  if (state.status === 'saved' || state.status === 'done') revalidatePath(`/${locale}/admin/news`);
  // The editor page shows the derived status and the button set, so it is read again after a save.
  if (state.status === 'saved') revalidatePath(`/${locale}/admin/news/${state.id}`);
  return state;
}

/**
 * Creates or updates an article: `action` is `draft`, `publish` or `unpublish`, and `publishAt` (Bangkok local time)
 * may schedule a publish. Re-checks `news.manage` itself; the page's check does not cover an action (D-243).
 */
export async function saveArticleAction(_previous: NewsAdminState, formData: FormData): Promise<NewsAdminState> {
  const locale = localeOf(formData.get('locale'));
  const actor = await requirePermission(locale, '/admin/news', 'news.manage');
  return refresh(locale, await getNewsAdminCommands().save(actor, formData));
}

/** Moves an article to the trash. Re-checks `news.manage`. */
export async function trashArticleAction(_previous: NewsAdminState, formData: FormData): Promise<NewsAdminState> {
  const locale = localeOf(formData.get('locale'));
  const actor = await requirePermission(locale, '/admin/news', 'news.manage');
  return refresh(locale, await getNewsAdminCommands().trash(actor, formData));
}

/** Takes an article out of the trash. Re-checks `news.manage`. */
export async function restoreArticleAction(_previous: NewsAdminState, formData: FormData): Promise<NewsAdminState> {
  const locale = localeOf(formData.get('locale'));
  const actor = await requirePermission(locale, '/admin/news?status=trash', 'news.manage');
  return refresh(locale, await getNewsAdminCommands().restore(actor, formData));
}

/** The editor's product picker: up to ten active products whose name or SKU contains the query. Re-checks `news.manage`. */
export async function searchProductsAction(query: string, locale?: string): Promise<ProductPickerHit[]> {
  const actor = await requirePermission(localeOf(locale), '/admin/news', 'news.manage');
  return getNewsAdminCommands().searchProducts(actor, query);
}

/**
 * The editor's product cards (D-266): each id's storefront card, or null where the article page would draw nothing, so
 * the editor draws every card as readers see it. Returns data, never a rendered element (D-265). Re-checks `news.manage`;
 * the ids are validated by the controller (up to 100 uuids).
 */
export async function productCardsAction(ids: unknown, locale?: string): Promise<Record<string, LandingProductCard | null>> {
  const pageLocale = typeof locale === 'string' && hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const actor = await requirePermission(pageLocale, '/admin/news', 'news.manage');
  return getNewsAdminCommands().productCards(actor, ids, pageLocale);
}

/**
 * The editor's "add category" (D-254): `{ thName, enName }` from the inline form, not a form post (the editor is one form
 * already). Re-checks `news.manage`. A new category is listed at once; the storefront's news pages are rendered per
 * request, so only the back office's own news pages are revalidated, in both languages.
 */
export async function createCategoryAction(locale: string, input: { thName: string; enName: string }): Promise<NewsCategoryState> {
  const actor = await requirePermission(localeOf(locale), '/admin/news', 'news.manage');
  const state = await getNewsAdminCommands().createCategory(actor, input);
  if (state.status === 'created') {
    for (const each of routing.locales) {
      revalidatePath(`/${each}/admin/news`);
      revalidatePath(`/${each}/admin/news/new`);
    }
  }
  return state;
}
