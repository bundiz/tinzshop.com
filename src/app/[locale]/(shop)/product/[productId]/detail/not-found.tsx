import { getTranslations } from 'next-intl/server';
import NotFoundPanel from '../../../_components/NotFoundPanel';
import { readRequestArticlesMenu } from '../../../_components/read-articles-menu';

/** A malformed, unknown or hidden product id: said plainly, with a way back (07 Loading, empty and error). */
export default async function ProductNotFound() {
  const [t, articlesMenu] = await Promise.all([getTranslations('shop.product.notFound'), readRequestArticlesMenu()]);
  return (
    <NotFoundPanel title={t('title')} text={t('text')} backHome={t('backHome')} articlesMenu={articlesMenu} />
  );
}
