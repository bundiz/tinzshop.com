import { useTranslations } from 'next-intl';
import NotFoundPanel from '../_components/NotFoundPanel';

/** An unknown news category, or a page past the end: the site's own 404 in the locale (D-120, D-122). */
export default function NewsNotFound() {
  const t = useTranslations('shop.notFound');
  return <NotFoundPanel title={t('title')} text={t('text')} backHome={t('backHome')} />;
}
