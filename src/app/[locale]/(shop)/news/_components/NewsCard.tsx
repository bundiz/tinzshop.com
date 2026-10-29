import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import ImagePlaceholder from '@/components/domain/ImagePlaceholder';
import type { NewsCardData } from '@/server/services/news/news-read-service';
import { newsArticlePath } from '../news-routes';

export type NewsCardProps = {
  card: NewsCardData;
  /** The design varies the placeholder tint from card to card. */
  tone?: 'default' | 'warm' | 'cool' | 'deep';
};

/**
 * The design's `.news-card`: image (or the placeholder), category tag, title, two lines of excerpt and the
 * date. Image beside the text on narrow screens, above it from `md`. Title and excerpt are plain text.
 */
export default function NewsCard({ card, tone = 'default' }: NewsCardProps) {
  const t = useTranslations('shop.news');
  const locale = useLocale();

  return (
    <Link
      href={newsArticlePath(locale, card.slug)}
      className="group grid grid-cols-[120px_1fr] items-start gap-3 md:grid-cols-1"
    >
      {card.featuredImageUrl === null ? (
        <ImagePlaceholder label={t('imagePlaceholderAlt')} tone={tone} className="aspect-[4/3]! rounded-(--radius-sm)" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- old-site URL, no image pipeline yet (D-127)
        <img
          src={card.featuredImageUrl}
          alt=""
          loading="lazy"
          className="aspect-[4/3] w-full rounded-(--radius-sm) bg-bg-subtle object-cover"
        />
      )}
      <div className="min-w-0">
        {card.categoryName !== null && <p className="text-xs font-bold text-primary">{card.categoryName}</p>}
        <h3 className="text-[15px] leading-[1.55] [overflow-wrap:anywhere] group-hover:text-primary">{card.title}</h3>
        {card.excerpt !== '' && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-[1.6] text-text-muted">{card.excerpt}</p>
        )}
        <time dateTime={card.publishedAt.toISOString()} className="text-xs text-text-subtle">
          {t('date', { date: card.publishedAt })}
        </time>
      </div>
    </Link>
  );
}
