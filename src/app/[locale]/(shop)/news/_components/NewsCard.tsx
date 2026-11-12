import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import ImagePlaceholder from '@/components/domain/ImagePlaceholder';
import ProductBadge from '@/components/domain/ProductBadge';
import type { NewsCardData } from '@/server/services/news/news-read-service';
import { newsArticlePath } from '../news-routes';

export type NewsCardProps = {
  card: NewsCardData;
  /** The list pages show the excerpt; the landing page and related articles do not (`design/index.html`). */
  showExcerpt?: boolean;
};

/**
 * The mockup's `.ncard` (plan 015): a 16:9 image (or the neutral placeholder), the category tag, title, excerpt
 * and date, the whole card one link. The tag is always the neutral tone, since mapping news categories to
 * platforms would hard-code slugs (R14). Title and excerpt are plain text.
 */
export default function NewsCard({ card, showExcerpt = true }: NewsCardProps) {
  const t = useTranslations('shop.news');
  const locale = useLocale();

  return (
    <Link
      href={newsArticlePath(locale, card.slug)}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-2"
    >
      {card.featuredImageUrl === null ? (
        <ImagePlaceholder label={t('imagePlaceholderAlt')} art="news" className="aspect-video!" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- old-site URL, no image pipeline yet (D-127)
        <img src={card.featuredImageUrl} alt="" loading="lazy" className="aspect-video w-full bg-sunk object-cover" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-2 px-5 pt-[18px] pb-5">
        {card.categoryName !== null && (
          <span className="self-start">
            <ProductBadge tone="other">{card.categoryName}</ProductBadge>
          </span>
        )}
        <h3 className="font-body text-lg leading-[1.45] font-semibold [overflow-wrap:anywhere] group-hover:text-brand">
          {card.title}
        </h3>
        {showExcerpt && card.excerpt !== '' && (
          <p className="line-clamp-2 text-[15px] text-ink-2">{card.excerpt}</p>
        )}
        <time dateTime={card.publishedAt.toISOString()} className="mt-auto pt-1.5 text-sm text-muted">
          {t('date', { date: card.publishedAt })}
        </time>
      </div>
    </Link>
  );
}
