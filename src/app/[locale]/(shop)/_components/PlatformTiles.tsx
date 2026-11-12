import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import Icon, { type IconName } from '@/components/ui/Icon';
import { listingHref, NAV_CATEGORY_SLUGS } from '../product/listing-url';

type Tile = {
  key: 'ps5' | 'switch' | 'gadgets' | 'preOrder' | 'bundles' | 'sale';
  icon: IconName;
  /** The icon square's tint and ink: the six one-off art colours of `_build.mjs` L198-205. */
  tint: string;
};

const TILES: readonly Tile[] = [
  { key: 'ps5', icon: 'artConsole', tint: 'bg-[#E7F0FC] text-[#0B4FAE]' },
  { key: 'switch', icon: 'artHandheld', tint: 'bg-[#FDE8EC] text-[#B5001F]' },
  { key: 'gadgets', icon: 'artKey', tint: 'bg-[#E2F5F2] text-[#0A6E62]' },
  { key: 'preOrder', icon: 'calendar', tint: 'bg-[#E9ECF2] text-[#10141C]' },
  { key: 'bundles', icon: 'artBox', tint: 'bg-[#FFF0E8] text-[#C24410]' },
  { key: 'sale', icon: 'tag', tint: 'bg-[#FCE9E7] text-[#B42318]' },
];

function href(locale: string, key: Tile['key']): string {
  switch (key) {
    case 'ps5':
    case 'switch':
    case 'gadgets':
      return listingHref(locale, { category: NAV_CATEGORY_SLUGS[key] });
    case 'preOrder':
      return listingHref(locale, { preOrder: true });
    case 'bundles':
      return listingHref(locale, { kit: true });
    case 'sale':
      // No sale filter exists yet; the tile is drawn as designed and goes nowhere (R5, D-124).
      return '#';
  }
}

/**
 * The six platform tiles under the hero (the mockup's `.plats`): the three platforms, pre-orders and kits link
 * to the product listing; "ลดราคา" is inert. The line under each name is the mockup's, without its claims
 * about savings (R5).
 */
export default function PlatformTiles() {
  const t = useTranslations('shop.home.platforms');
  const tCategory = useTranslations('shop.category');
  const locale = useLocale();

  const title = (key: Tile['key']) => (key === 'sale' ? t('saleTitle') : tCategory(key));
  const sub = (key: Tile['key']) => {
    switch (key) {
      case 'ps5':
      case 'switch':
        return t('consoleGames');
      case 'gadgets':
        return t('gadgets');
      case 'preOrder':
        return t('preOrder');
      case 'bundles':
        return t('bundles');
      case 'sale':
        return t('sale');
    }
  };

  return (
    <nav aria-label={t('label')} className="-mt-px border-b border-line bg-surface">
      <div className="wrap">
        <ul className="grid grid-cols-2 gap-px border-x border-line bg-line sm:grid-cols-3 xl:grid-cols-6">
          {TILES.map(({ key, icon, tint }) => (
            <li key={key} className="bg-surface">
              <Link
                href={href(locale, key)}
                className="group flex min-h-[72px] items-center gap-3 p-3 leading-[1.35] transition-colors hover:bg-page sm:min-h-[84px] sm:p-3.5"
              >
                <span
                  className={`grid size-11 flex-none place-items-center rounded-md transition-transform duration-200 ease-soft group-hover:-translate-y-0.5 ${tint}`}
                >
                  <Icon name={icon} strokeWidth={1.6} className="size-[22px]" />
                </span>
                <span className="min-w-0">
                  <b className="block text-[15px] font-semibold sm:text-base">{title(key)}</b>
                  <small className="text-[13px] text-muted">{sub(key)}</small>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
