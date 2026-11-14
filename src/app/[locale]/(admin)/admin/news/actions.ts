'use server';

import { hasLocale } from 'next-intl';
import { revalidatePath } from 'next/cache';

import { routing } from '@/i18n/routing';
import { getNewsAdminCommands } from '@/server/composition-root';
import type { NewsAdminState } from '@/server/controllers/news/news-admin-controller';
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
