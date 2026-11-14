import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import type { NewsCardData } from '@/server/services/news/news-read-service';
import NewsCard from './NewsCard';

export type NewsCardSectionProps = {
  /** The section's element `id`; its heading is `{id}-title`. */
  id: 'news' | 'related-news';
  /** The section heading, already translated. */
  title: string;
  cards: NewsCardData[];
  /** Where the "อ่านทั้งหมด" link goes; no link when absent. */
  moreHref?: string;
};

/**
 * A section of news cards (the home page's "ข่าวเกมล่าสุด" and an article's "ข่าวที่เกี่ยวข้อง"): the section head,
 * an optional "read all" link and a 1 / 2 / 3 column grid of cards without excerpts. A section with no cards is
 * not rendered. Like `ProductSection` it has no outer spacing: the page that places it spaces it.
 */
export default function NewsCardSection({ id, title, cards, moreHref }: NewsCardSectionProps) {
  const t = useTranslations('shop.news.landing');
  if (cards.length === 0) return null;
  const titleId = `${id}-title`;

  return (
    <section id={id} aria-labelledby={titleId}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:flex-nowrap">
        <h2 id={titleId} className="text-[clamp(24px,2.4vw,32px)] font-bold">
          {title}
        </h2>
        {moreHref !== undefined && (
          <Link
            href={moreHref}
            className="inline-flex min-h-11 items-center gap-1.5 font-semibold whitespace-nowrap text-ink bg-[linear-gradient(currentColor,currentColor)] bg-[length:0_1.5px] bg-left-bottom bg-no-repeat hover:bg-[length:100%_1.5px] sm:min-h-0"
          >
            {t('more')}
            <Icon name="chevRight" className="size-4" />
          </Link>
        )}
      </div>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {cards.map((card) => (
          <li key={card.slug} className="min-w-0">
            <NewsCard card={card} showExcerpt={false} />
          </li>
        ))}
      </ul>
    </section>
  );
}
