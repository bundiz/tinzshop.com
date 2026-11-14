import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import ImagePlaceholder from '@/components/domain/ImagePlaceholder';
import PriceDisplay from '@/components/domain/PriceDisplay';
import ProductBadge from '@/components/domain/ProductBadge';
import StockBadge from '@/components/domain/StockBadge';
import { buttonClass } from '@/components/ui/button-class';
import Icon from '@/components/ui/Icon';
import type { LandingProductCard } from '@/server/services/catalogue/landing-catalogue-service';
import { listingHref } from '../product/listing-url';

export type HeroProps = {
  /** The first kit; `null` when there is none, and the card (with the minis) is left out. */
  feature: LandingProductCard | null;
  /** The first three best sellers that are not the feature. */
  minis: readonly LandingProductCard[];
  /** Signed in: "สมัครสมาชิก" is then left out. */
  signedIn: boolean;
};

const FACTS = [
  { key: 'shipping', icon: 'truck' },
  { key: 'payment', icon: 'card' },
  { key: 'invoice', icon: 'receipt' },
] as const;

// The hero backdrop of style.css L202-206: two glows and a faint 48px grid, on navy.
const BACKDROP =
  'bg-[radial-gradient(60%_80%_at_85%_10%,rgba(24,99,220,.55),transparent_60%),radial-gradient(50%_70%_at_70%_100%,rgba(254,166,1,.14),transparent_60%),linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] bg-[length:auto,auto,48px_48px,48px_48px]';

const detailHref = (locale: string, card: LandingProductCard) => `/${locale}/product/${card.productId}/detail`;

/**
 * The landing hero (the mockup's `.hero`, plan 015 R9): the pitch, the three facts, "เลือกซื้อสินค้า" to the
 * product listing and, signed out, "สมัครสมาชิก"; beside them the first kit as a feature card with three
 * best sellers under it. Everything shown comes from the mirror or the message catalogue.
 */
export default function Hero({ feature, minis, signedIn }: HeroProps) {
  const t = useTranslations('shop.home.hero');
  const locale = useLocale();
  const cta = 'w-full sm:w-auto';

  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-navy text-on-navy">
      <div aria-hidden="true" className={`absolute inset-0 -z-10 ${BACKDROP}`} />
      <div
        className={`wrap grid grid-cols-1 items-center gap-8 py-11 lg:min-h-[min(640px,calc(100svh-170px))] lg:gap-12 lg:py-14 ${feature === null ? '' : 'lg:grid-cols-[1.05fr_.95fr]'}`}
      >
        <div className="animate-enter">
          <p className="inline-flex items-center gap-2 text-[13px] leading-none font-semibold tracking-[.06em] text-on-navy-2 uppercase">
            {t('eyebrow')}
          </p>
          <h1
            id="hero-title"
            className="mt-3.5 text-[clamp(34px,4.4vw,58px)] leading-[1.14] font-bold tracking-[-.015em] text-white"
          >
            {t.rich('title', { em: (chunks) => <em className="not-italic text-accent">{chunks}</em> })}
          </h1>
          <p className="mt-[18px] max-w-[34em] text-[clamp(17px,1.4vw,19px)] text-on-navy-2">{t('lead')}</p>
          <ul className="mt-[22px] flex flex-wrap gap-x-[22px] gap-y-2.5">
            {FACTS.map(({ key, icon }) => (
              <li key={key} className="flex items-center gap-2 font-medium text-on-navy">
                <Icon name={icon} className="size-[22px] flex-none text-accent" />
                {t(`facts.${key}`)}
              </li>
            ))}
          </ul>
          <div className="mt-[30px] flex flex-wrap gap-3">
            <Link href={listingHref(locale)} className={`${buttonClass({ variant: 'buy', size: 'lg' })} ${cta}`}>
              {t('shop')}
              <Icon name="chevRight" />
            </Link>
            {!signedIn && (
              <Link href={`/${locale}/register`} className={`${buttonClass({ variant: 'ghost', size: 'lg' })} ${cta}`}>
                <Icon name="user" />
                {t('register')}
              </Link>
            )}
          </div>
        </div>
        {feature !== null && <FeatureCard feature={feature} minis={minis} locale={locale} />}
      </div>
    </section>
  );
}

function FeatureCard({
  feature,
  minis,
  locale,
}: {
  feature: LandingProductCard;
  minis: readonly LandingProductCard[];
  locale: string;
}) {
  const t = useTranslations('shop.home.hero');
  const tProduct = useTranslations('shop.product');

  return (
    <article className="animate-enter relative w-full max-w-[620px] rounded-xl border border-white/8 bg-navy-2 p-4 shadow-[0_30px_80px_-30px_rgba(0,0,0,.6)] transition-transform duration-[250ms] ease-soft [animation-delay:.12s] hover:-translate-y-0.5 lg:max-w-none">
      <div className="absolute top-[30px] left-[30px] z-[2]">
        <ProductBadge tone="bundle">{t('feature.tag')}</ProductBadge>
      </div>
      {feature.imageUrl !== null ? (
        // A plain <img>: the live Shopee image hosts are not known, so no next/image remote config.
        <img
          src={feature.imageUrl}
          alt=""
          loading="eager"
          className="aspect-[5/4] w-full rounded-[14px] bg-surface object-contain"
        />
      ) : (
        <ImagePlaceholder
          label={tProduct('imagePlaceholderAlt')}
          tone="dark"
          art="box"
          className="aspect-[5/4]! rounded-[14px]"
        />
      )}
      <div className="flex items-end justify-between gap-4 px-1.5 pt-4 pb-1">
        <div className="min-w-0">
          <h2 className="font-head text-[20px] font-semibold text-white">
            <Link
              href={detailHref(locale, feature)}
              className="after:absolute after:inset-0 after:z-[1] after:rounded-[inherit] after:content-['']"
            >
              {feature.name}
            </Link>
          </h2>
          <div className="mt-1">
            <StockBadge status={feature.stockStatus} onDark />
          </div>
        </div>
        <PriceDisplay
          satang={feature.priceSatang}
          original={feature.originalPriceSatang}
          isRange={feature.isPriceRange}
          size="feature"
        />
      </div>
      {minis.length > 0 && (
        <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {minis.map((mini, index) => (
            <li key={mini.productId} className={`${index === 0 ? 'flex' : 'hidden sm:flex'} min-w-0`}>
              <Link
                href={detailHref(locale, mini)}
                className="relative z-[2] flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-md border border-white/6 bg-white/5 p-2.5 transition-[background-color,transform] duration-[180ms] ease-soft hover:-translate-y-0.5 hover:bg-white/10"
              >
                <MiniThumb card={mini} />
                <div className="min-w-0 text-[13px] leading-[1.35] text-on-navy">
                  <b className="line-clamp-2 font-semibold text-white [overflow-wrap:anywhere]">{mini.name}</b>
                  <PriceDisplay
                    satang={mini.priceSatang}
                    original={mini.originalPriceSatang}
                    isRange={mini.isPriceRange}
                    size="mini"
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/** The 44px thumbnail; decoration beside the name, so the placeholder has no label of its own. */
function MiniThumb({ card }: { card: LandingProductCard }) {
  const box = 'size-11 flex-none rounded-sm';

  return card.imageUrl !== null ? (
    <img src={card.imageUrl} alt="" loading="lazy" className={`${box} bg-surface object-contain`} />
  ) : (
    <ImagePlaceholder tone="dark" art="box" className={`${box} aspect-auto!`} />
  );
}
