import { useTranslations } from 'next-intl';
import NotFoundPanel from '../../_components/NotFoundPanel';

/** A malformed, unknown or hidden product id: said plainly, with a way back (07 Loading, empty and error). */
export default function ProductNotFound() {
  const t = useTranslations('shop.product.notFound');
  return <NotFoundPanel title={t('title')} text={t('text')} backHome={t('backHome')} />;
}
