import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { NewsCardData } from '@/server/services/news/news-read-service';
import NewsCard from './NewsCard';

export type NewsGridProps = {
  cards: NewsCardData[];
  /** Shown in place of the grid when there are no cards. */
  emptyText: string;
  /** Leave the section out entirely when there are no cards (page 1 with 3 or fewer articles). */
  hideWhenEmpty?: boolean;
  /** The pagination, below the grid inside the section. */
  children?: ReactNode;
};

/** The "ข่าวล่าสุด" section: the section head and a grid of `.ncard`s, 1 column and 2 from `sm` (R14). */
export default function NewsGrid({ cards, emptyText, hideWhenEmpty = false, children }: NewsGridProps) {
  const t = useTranslations('shop.news.latest');
  if (cards.length === 0 && hideWhenEmpty) return null;

  return (
    <section aria-labelledby="latest-title" className="min-w-0">
      <div className="mb-6">
        <h2 id="latest-title" className="text-[clamp(24px,2.4vw,32px)] font-bold">
          {t('title')}
        </h2>
      </div>
      {cards.length === 0 ? (
        <p className="py-6 text-center text-muted">{emptyText}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {cards.map((card) => (
            <li key={card.slug} className="min-w-0">
              <NewsCard card={card} />
            </li>
          ))}
        </ul>
      )}
      {children}
    </section>
  );
}
