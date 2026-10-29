import { getTranslations } from 'next-intl/server';
import NotFoundPanel from '../_components/NotFoundPanel';
import { readRequestArticlesMenu } from '../_components/read-articles-menu';

/** Invalid listing params or a page past the end: the site's own 404 in the locale (R2, D-120). */
export default async function ProductListNotFound() {
  const [t, articlesMenu] = await Promise.all([getTranslations('shop.notFound'), readRequestArticlesMenu()]);
  return (
    <NotFoundPanel title={t('title')} text={t('text')} backHome={t('backHome')} articlesMenu={articlesMenu} />
  );
}
