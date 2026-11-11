import { getTranslations } from 'next-intl/server';
import NotFoundPanel from '../_components/NotFoundPanel';
import { readRequestArticlesMenu } from '../_components/read-articles-menu';
import { readCurrentCustomer } from '../_components/read-current-customer';

/**
 * Invalid listing params or a page past the end: the site's own 404 in the locale (R2, D-120). The `<title>`
 * stays the layout's "สินค้าทั้งหมด", which cannot see the search params; the status and noindex are correct.
 */
export default async function ProductListNotFound() {
  const [t, articlesMenu, customer] = await Promise.all([
    getTranslations('shop.notFound'),
    readRequestArticlesMenu(),
    readCurrentCustomer(),
  ]);
  return <NotFoundPanel title={t('title')} text={t('text')} backHome={t('backHome')} articlesMenu={articlesMenu} customer={customer} />;
}
