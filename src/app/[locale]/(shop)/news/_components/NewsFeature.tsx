import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import Icon, { type IconName } from '@/components/ui/Icon';
import type { NewsCardData } from '@/server/services/news/news-read-service';
import { newsArticlePath } from '../news-routes';

export type NewsFeatureProps = {
  /** The 3 newest articles, on page 1 only (ruling R1, D-134). */
  cards: NewsCardData[];
};

type Variant = 'main' | 'warm' | 'dark';

const BACKGROUND: Record<Variant, string> = {
  main: 'bg-[linear-gradient(120deg,var(--color-primary-deep)_0%,var(--color-primary)_70%,#3d86f0_100%)] text-white',
  warm: 'bg-[linear-gradient(135deg,#ffe2a3_0%,var(--color-accent)_100%)] text-[#3d2800]',
  dark: 'bg-[linear-gradient(135deg,#1b1b24_0%,#34344a_100%)] text-white',
};

const ICON: Record<Variant, IconName> = { main: 'gamepad', warm: 'calendar', dark: 'switch' };

function FeatureCard({ card, variant }: { card: NewsCardData; variant: Variant }) {
  const t = useTranslations('shop.news');
  const locale = useLocale();
  const hasImage = card.featuredImageUrl !== null;
  // Over a photo, text is white on a dark wash whatever the card's colour (D-137).
  const colours = hasImage ? 'bg-primary-deep text-white' : BACKGROUND[variant];
  const date = (
    <time dateTime={card.publishedAt.toISOString()}>{t('date', { date: card.publishedAt })}</time>
  );

  return (
    <Link
      href={newsArticlePath(locale, card.slug)}
      className={`group relative flex min-h-[200px] flex-col justify-end gap-1.5 overflow-hidden rounded-(--radius) p-5 ${colours} ${
        variant === 'main' ? 'md:min-h-full' : ''
      }`}
    >
      {hasImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- old-site URL, no image pipeline yet (D-127) */}
          <img
            src={card.featuredImageUrl ?? undefined}
            alt=""
            loading="eager"
            className="absolute inset-0 size-full object-cover"
          />
          <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,46,111,0.1)_0%,rgba(11,20,40,0.85)_100%)]" />
        </>
      ) : (
        <Icon name={ICON[variant]} strokeWidth={1} className="absolute -top-4 -right-4 size-[170px] opacity-[0.16]" />
      )}
      {card.categoryName !== null && (
        <span
          className={`relative self-start rounded-full px-2.5 py-px text-xs font-bold ${
            variant === 'warm' && !hasImage ? 'bg-black/[0.08]' : 'bg-white/20'
          }`}
        >
          {card.categoryName}
        </span>
      )}
      <h2
        className={`relative text-[19px] [overflow-wrap:anywhere] group-hover:underline ${
          variant === 'main' ? 'md:text-[26px]' : ''
        }`}
      >
        {card.title}
      </h2>
      {variant === 'main' && card.excerpt !== '' && (
        <p className="relative line-clamp-3 text-[13px] opacity-85">{card.excerpt}</p>
      )}
      <p className="relative text-[13px] opacity-85">
        {variant === 'main' ? (
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

/** The design's `.news-feature`: one large card and two stacked beside it from `md` (1.7fr / 1fr). */
export default function NewsFeature({ cards }: NewsFeatureProps) {
  const t = useTranslations('shop.news.feature');
  const [main, ...side] = cards;
  if (main === undefined) return null;

  return (
    <section aria-label={t('label')} className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <FeatureCard card={main} variant="main" />
      {side.length > 0 && (
        <div className="grid gap-3">
          {side.slice(0, 2).map((card, index) => (
            <FeatureCard key={card.slug} card={card} variant={index === 0 ? 'warm' : 'dark'} />
          ))}
        </div>
      )}
    </section>
  );
}
