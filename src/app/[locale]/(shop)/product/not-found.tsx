import { getTranslations } from 'next-intl/server';
import DocumentTitle from '../_components/DocumentTitle';
import NotFoundPanel from '../_components/NotFoundPanel';
import { readRequestArticlesMenu } from '../_components/read-articles-menu';

/** Invalid listing params or a page past the end: the site's own 404 in the locale (R2, D-120). */
export default async function ProductListNotFound() {
  const [t, articlesMenu] = await Promise.all([getTranslations('shop.notFound'), readRequestArticlesMenu()]);
  return (
    <>
      {/* The layout's "สินค้าทั้งหมด" title cannot see the search params that made this a 404 (M9). */}
      <DocumentTitle title={t('meta.title')} />
      <NotFoundPanel title={t('title')} text={t('text')} backHome={t('backHome')} articlesMenu={articlesMenu} />
    </>
  );
}
