import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import type { NewsCardData } from '@/server/services/news/news-read-service';
import NewsCard, { type NewsCardProps } from './NewsCard';

export type NewsCardSectionProps = {
  /** The section's element `id`; its heading is `{id}-title`. */
  id: 'news' | 'related-news';
  /** The section heading, already translated. */
  title: string;
  cards: NewsCardData[];
  /** Where the design's "อ่านทั้งหมด" link goes; no link when absent. */
  moreHref?: string;
};

// The design's placeholder tints on the landing page, in its order.
const TONES: NonNullable<NewsCardProps['tone']>[] = ['deep', 'warm', 'cool'];

/**
 * The design's `.section` of news cards (`design/index.html` "ข่าวเกมล่าสุด"): the accent-bar title, an optional
 * "read all" link and a 1 / 2 / 3 column grid of cards without excerpts. A section with no cards is not rendered.
 */
export default function NewsCardSection({ id, title, cards, moreHref }: NewsCardSectionProps) {
  const t = useTranslations('shop.news.landing');
  if (cards.length === 0) return null;
  const titleId = `${id}-title`;

  return (
    <section id={id} aria-labelledby={titleId} className="mt-4 rounded-(--radius) bg-bg p-4 md:p-5">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <h2
          id={titleId}
          className="flex items-center gap-2.5 text-[19px] before:h-5 before:w-1 before:shrink-0 before:rounded-[2px] before:bg-accent before:content-['']"
        >
          {title}
        </h2>
        {moreHref !== undefined && (
          <Link
            href={moreHref}
            className="inline-flex min-h-11 items-center gap-0.5 text-sm font-semibold whitespace-nowrap text-primary hover:underline"
          >
            {t('more')}
            <Icon name="chevRight" className="size-4" />
          </Link>
        )}
      </div>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {cards.map((card, index) => (
          <li key={card.slug} className="min-w-0">
            <NewsCard card={card} tone={TONES[index % TONES.length]} showExcerpt={false} />
          </li>
        ))}
      </ul>
    </section>
  );
}
