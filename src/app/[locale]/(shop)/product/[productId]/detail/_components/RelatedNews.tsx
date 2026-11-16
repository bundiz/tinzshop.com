import { useTranslations } from 'next-intl';
import type { NewsCardData } from '@/server/services/news/news-read-service';
import NewsCardSection from '../../../../news/_components/NewsCardSection';

/**
 * "ข่าวที่เกี่ยวข้อง" on a product page: every live article linked to the product in the back office (D-239), newest
 * first, as the news section's own cards. Nothing at all when there are none.
 */
export default function RelatedNews({ cards }: { cards: NewsCardData[] }) {
  const t = useTranslations('shop.news');
  if (cards.length === 0) return null;
  return (
    <div className="pt-[clamp(48px,6vw,80px)]">
      <NewsCardSection id="related-news" title={t('related.title')} cards={cards} />
    </div>
  );
}
