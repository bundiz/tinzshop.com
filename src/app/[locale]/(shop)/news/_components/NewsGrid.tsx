import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import type { NewsCardData } from '@/server/services/news/news-read-service';
import NewsCard, { type NewsCardProps } from './NewsCard';

export type NewsGridProps = {
  cards: NewsCardData[];
  /** Shown in place of the grid when there are no cards. */
  emptyText: string;
  /** Leave the section out entirely when there are no cards (page 1 with 3 or fewer articles). */
  hideWhenEmpty?: boolean;
  /** The pagination, below the grid inside the section. */
  children?: ReactNode;
};

// The design's placeholder tints, in its order.
const TONES: NonNullable<NewsCardProps['tone']>[] = ['deep', 'warm', 'cool', 'default', 'warm', 'deep'];

/** The design's "ข่าวล่าสุด" section: a white panel with the accent-bar title and a 1 / 2 / 3 column grid. */
export default function NewsGrid({ cards, emptyText, hideWhenEmpty = false, children }: NewsGridProps) {
  const t = useTranslations('shop.news.latest');
  if (cards.length === 0 && hideWhenEmpty) return null;

  return (
    <section aria-labelledby="latest-title" className="rounded-(--radius) bg-bg p-4 md:p-5">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <h2
          id="latest-title"
          className="flex items-center gap-2.5 text-[19px] before:h-5 before:w-1 before:shrink-0 before:rounded-[2px] before:bg-accent before:content-['']"
        >
          {t('title')}
        </h2>
      </div>
      {cards.length === 0 ? (
        <p className="py-6 text-center text-text-muted">{emptyText}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {cards.map((card, index) => (
            <li key={card.slug} className="min-w-0">
              <NewsCard card={card} tone={TONES[index % TONES.length]} />
            </li>
          ))}
        </ul>
      )}
      {children}
    </section>
  );
}
