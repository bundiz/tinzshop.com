import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import Icon, { type IconName } from '@/components/ui/Icon';
import type { ProductTypeKey } from '@/server/services/catalogue/categorise-by-name';
import { listingHref, NAV_CATEGORY_SLUGS } from '../product/listing-url';

type Banner = {
  platform: 'ps' | 'switch';
  slug: (typeof NAV_CATEGORY_SLUGS)[keyof typeof NAV_CATEGORY_SLUGS];
  kinds: readonly ProductTypeKey[];
  /** Only the Switch banner has the inert fourth link (R5). */
  casesFilm: boolean;
  icon: IconName;
  /** The two banner gradients of style.css L261-262. */
  gradient: string;
};

const BANNERS: readonly Banner[] = [
  {
    platform: 'ps',
    slug: NAV_CATEGORY_SLUGS.ps5,
    kinds: ['console', 'game', 'controller', 'accessory'],
    casesFilm: false,
    icon: 'artConsole',
    gradient: 'bg-[linear-gradient(135deg,#0A3F8F,#0B5FD0)]',
  },
  {
    platform: 'switch',
    slug: NAV_CATEGORY_SLUGS.switch,
    kinds: ['console', 'game', 'controller'],
    casesFilm: true,
    icon: 'artHandheld',
    gradient: 'bg-[linear-gradient(135deg,#A6001E,#E4002B)]',
  },
];

/**
 * The two platform banners (the mockup's `.pbanner`): the banner and each type link go to the product
 * listing for that platform, with the type where there is one. "เคส & ฟิล์ม" has no data behind it, so it is
 * inert (R5). Text stays full white on the banner colours for contrast.
 */
export default function PlatformBanners() {
  const t = useTranslations('shop.home.banners');
  const tCategory = useTranslations('shop.category');
  const tType = useTranslations('shop.listing.type');
  const locale = useLocale();
  const chip =
    'relative z-[2] inline-flex min-h-11 items-center rounded-full bg-white/14 px-3.5 text-[14.5px] font-medium transition-colors duration-[180ms] hover:bg-white/26 sm:min-h-10';

  return (
    <section aria-labelledby="banners-title" className="wrap pt-[clamp(48px,6vw,80px)]">
      <h2 id="banners-title" className="sr-only">
        {t('label')}
      </h2>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {BANNERS.map(({ platform, slug, kinds, casesFilm, icon, gradient }) => (
          <div
            key={platform}
            className={`relative grid min-h-0 grid-cols-1 items-center gap-3 overflow-hidden rounded-xl p-[22px] text-white transition-[transform,box-shadow] duration-[250ms] ease-soft hover:-translate-y-0.5 hover:shadow-2 sm:min-h-[300px] sm:grid-cols-[1fr_44%] sm:p-7 ${gradient}`}
          >
            <div>
              <p className="text-[13px] leading-none font-semibold tracking-[.06em] text-white uppercase">
                {tCategory(platform === 'ps' ? 'ps5' : 'switch')}
              </p>
              <h3 className="mt-2 text-[clamp(24px,2.4vw,32px)] font-bold">
                <Link
                  href={listingHref(locale, { category: slug })}
                  className="after:absolute after:inset-0 after:content-['']"
                >
                  {t(`${platform}.title`)}
                </Link>
              </h3>
              <p className="mt-2 text-white">{t(`${platform}.text`)}</p>
              <ul className="mt-[18px] flex flex-wrap gap-2">
                {kinds.map((kind) => (
                  <li key={kind}>
                    <Link href={listingHref(locale, { category: slug, types: [`${slug}-${kind}`] })} className={chip}>
                      {tType(kind)}
                    </Link>
                  </li>
                ))}
                {casesFilm && (
                  <li>
                    <a href="#" className={chip}>
                      {t('casesFilm')}
                    </a>
                  </li>
                )}
              </ul>
            </div>
            <div
              aria-hidden="true"
              className="hidden aspect-square place-items-center rounded-lg bg-white/10 text-white sm:grid"
            >
              <Icon name={icon} strokeWidth={0.9} className="size-[56%] opacity-90" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
