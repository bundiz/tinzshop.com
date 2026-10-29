import { useTranslations } from 'next-intl';
import NotFoundPanel from '../_components/NotFoundPanel';

/** Any URL under a locale that matches no page: the site's own 404, in the locale (D-031, D-032, D-122). */
export default function PageNotFound() {
  const t = useTranslations('shop.notFound');
  return <NotFoundPanel title={t('title')} text={t('text')} backHome={t('backHome')} />;
}
