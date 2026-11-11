import { getTranslations } from 'next-intl/server';
import NotFoundPanel from '../_components/NotFoundPanel';
import { readRequestArticlesMenu } from '../_components/read-articles-menu';
import { readCurrentCustomer } from '../_components/read-current-customer';

/** Any URL under a locale that matches no page: the site's own 404, in the locale (D-031, D-032, D-122). */
export default async function PageNotFound() {
  const [t, articlesMenu, customer] = await Promise.all([
    getTranslations('shop.notFound'),
    readRequestArticlesMenu(),
    readCurrentCustomer(),
  ]);
  return (
    <NotFoundPanel title={t('title')} text={t('text')} backHome={t('backHome')} articlesMenu={articlesMenu} customer={customer} />
  );
}
