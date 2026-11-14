import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import ProductBadge from '@/components/domain/ProductBadge';
import Icon from '@/components/ui/Icon';
import type { NewsCardData } from '@/server/services/news/news-read-service';
import { newsArticlePath } from '../news-routes';

export type NewsFeatureProps = {
  /** The 3 newest articles, on page 1 only (ruling R1, D-134). */
  cards: NewsCardData[];
};

type Variant = 'main' | 'side';

// A card without an image keeps a navy ground (the mockup's `.nbig`); the side cards alternate navy-2 and navy.
const GROUND = ['bg-navy', 'bg-navy-2', 'bg-navy'] as const;

function FeatureCard({ card, variant, ground }: { card: NewsCardData; variant: Variant; ground: string }) {
  const t = useTranslations('shop.news');
  const locale = useLocale();
  const hasImage = card.featuredImageUrl !== null;
  const main = variant === 'main';
  const date = <time dateTime={card.publishedAt.toISOString()}>{t('date', { date: card.publishedAt })}</time>;

  return (
    <Link
      href={newsArticlePath(locale, card.slug)}
      className={`group relative flex flex-col justify-end gap-2.5 overflow-hidden rounded-xl p-[22px] text-white transition-transform duration-200 hover:-translate-y-0.5 ${ground} ${
        main ? 'min-h-[340px] sm:min-h-[420px] sm:p-8' : 'min-h-[200px] sm:p-8'
      }`}
    >
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- old-site URL, no image pipeline yet (D-127)
        <img src={card.featuredImageUrl ?? undefined} alt="" loading="eager" className="absolute inset-0 size-full object-cover" />
      ) : (
        <Icon
          name="artNews"
          strokeWidth={0.9}
          className="absolute top-1/2 left-1/2 size-[40%] -translate-x-1/2 -translate-y-1/2 text-on-navy opacity-35"
        />
      )}
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(transparent_30%,rgba(8,14,26,.88))]"
      />
      {card.categoryName !== null && (
        <span className="relative self-start">
          <ProductBadge tone="other">{card.categoryName}</ProductBadge>
        </span>
      )}
      <h2
        className={`relative max-w-[22em] font-bold [overflow-wrap:anywhere] group-hover:underline ${
          main ? 'text-[clamp(24px,2.6vw,34px)]' : 'text-[21px]'
        }`}
      >
        {card.title}
      </h2>
      {main && card.excerpt !== '' && (
        <p className="relative line-clamp-3 max-w-[36em] text-on-navy-2">{card.excerpt}</p>
      )}
      <p className="relative text-sm text-on-navy-2">
        {main ? (
          <>
            {t('byline', { name: card.bylineName ?? t('bylineFallback') })} · {date}
          </>
        ) : (
          date
        )}
      </p>
    </Link>
  );
}

/** The mockup's `.nfeat`: one column, then one large card and two stacked beside it from `lg` (1.5fr / 1fr). */
export default function NewsFeature({ cards }: NewsFeatureProps) {
  const t = useTranslations('shop.news.feature');
  const [main, ...side] = cards;
  if (main === undefined) return null;

  return (
    <section aria-label={t('label')} className="mb-3 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <FeatureCard card={main} variant="main" ground={GROUND[0]} />
      {side.length > 0 && (
        <div className="grid gap-4">
          {side.slice(0, 2).map((card, index) => (
            <FeatureCard key={card.slug} card={card} variant="side" ground={GROUND[index + 1]} />
          ))}
        </div>
      )}
    </section>
  );
}
