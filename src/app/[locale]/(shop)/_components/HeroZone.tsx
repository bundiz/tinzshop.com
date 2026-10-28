import { useTranslations } from 'next-intl';
import Icon, { type IconName } from '@/components/ui/Icon';
import Hero from './Hero';

export type HeroZoneProps = {
  /** Passed to the hero's "shop now" button. */
  shopNowTarget: string | null;
};

const RAIL_CATEGORIES: { key: 'switch' | 'ps5' | 'gadgets' | 'preOrder'; icon: IconName }[] = [
  { key: 'switch', icon: 'switch' },
  { key: 'ps5', icon: 'disc' },
  { key: 'gadgets', icon: 'cpu' },
  { key: 'preOrder', icon: 'calendar' },
];

const RAIL_POPULAR: { key: 'controllers' | 'games' | 'headsets' | 'keyboards' | 'mice'; icon: IconName }[] = [
  { key: 'controllers', icon: 'gamepad' },
  { key: 'games', icon: 'disc' },
  { key: 'headsets', icon: 'headphones' },
  { key: 'keyboards', icon: 'keyboard' },
  { key: 'mice', icon: 'mouse' },
];

const QUICK_LINKS: { key: 'orders' | 'wishlist' | 'preOrders' | 'contact'; icon: IconName }[] = [
  { key: 'orders', icon: 'package' },
  { key: 'wishlist', icon: 'heart' },
  { key: 'preOrders', icon: 'calendar' },
  { key: 'contact', icon: 'chat' },
];

/**
 * The design's hero zone: the category rail, the hero with the two promo tiles under it, and the
 * welcome panel. Three columns from 1100px; below that only the hero and tiles show, as designed.
 * Every rail link, tile, button and quick link is inert until its page exists (D-124).
 */
export default function HeroZone({ shopNowTarget }: HeroZoneProps) {
  const t = useTranslations('shop.home');

  return (
    <section aria-label={t('hero.label')} className="grid grid-cols-1 gap-3 lg:grid-cols-[232px_minmax(0,1fr)_220px]">
      <CategoryRail />
      <div className="grid min-w-0 gap-3">
        <Hero shopNowTarget={shopNowTarget} />
        <PromoTiles />
      </div>
      <WelcomePanel />
    </section>
  );
}

function CategoryRail() {
  const t = useTranslations('shop.home.rail');
  const tCategory = useTranslations('shop.category');
  const link = 'flex items-center gap-2.5 px-4 py-[7px] text-sm leading-[1.5] hover:bg-primary-soft hover:text-primary';

  return (
    <nav aria-label={t('label')} className="hidden rounded-(--radius) bg-bg py-2 lg:block">
      <p className="px-4 pt-1 pb-2 text-[13px] font-bold text-text-muted">{t('categoriesTitle')}</p>
      <ul>
        {RAIL_CATEGORIES.map(({ key, icon }) => (
          <li key={key}>
            <a href="#" className={link}>
              <Icon name={icon} className="size-5 text-primary" />
              {tCategory(key)}
              <Icon name="chevRight" className="ml-auto size-4 text-text-subtle" />
            </a>
          </li>
        ))}
      </ul>
      <div className="mx-4 my-1.5 h-px bg-border" />
      <p className="px-4 pt-1 pb-2 text-[13px] font-bold text-text-muted">{t('popularTitle')}</p>
      <ul>
        {RAIL_POPULAR.map(({ key, icon }) => (
          <li key={key}>
            <a href="#" className={link}>
              <Icon name={icon} className="size-5 text-primary" />
              {t(key)}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function PromoTiles() {
  const t = useTranslations('shop.home.promo');
  const tile =
    'relative flex min-h-[118px] flex-col justify-between gap-2 overflow-hidden rounded-(--radius) px-4 py-3.5';

  return (
    <div className="grid grid-cols-2 gap-3">
      <a href="#" className={`${tile} bg-[linear-gradient(135deg,#fff2d1_0%,#ffd98a_100%)] text-[#5a3a00]`}>
        <div>
          <p className="text-xs font-bold opacity-85">{t('preOrder.kicker')}</p>
          <p className="text-base leading-[1.4] font-extrabold">{t('preOrder.title')}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-[13px] font-bold">
          {t('preOrder.link')} <Icon name="chevRight" className="size-4" />
        </span>
        <Icon name="calendar" strokeWidth={1.2} className="absolute -right-3 -bottom-3 size-[84px] opacity-16" />
      </a>
      <a href="#" className={`${tile} bg-[linear-gradient(135deg,#1b1b24_0%,#34344a_100%)] text-white`}>
        <div>
          <p className="text-xs font-bold opacity-85">{t('gadgets.kicker')}</p>
          <p className="text-base leading-[1.4] font-extrabold">{t('gadgets.title')}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-[13px] font-bold text-accent">
          {t('gadgets.link')} <Icon name="chevRight" className="size-4" />
        </span>
        <Icon name="headphones" strokeWidth={1.2} className="absolute -right-3 -bottom-3 size-[84px] opacity-16" />
      </a>
    </div>
  );
}

function WelcomePanel() {
  const t = useTranslations('shop.home.welcome');
  const button =
    'inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full border px-5 text-[15px] leading-[1.3] font-bold transition-colors';

  return (
    <aside aria-label={t('label')} className="hidden flex-col gap-3 rounded-(--radius) bg-bg px-4 py-[18px] lg:flex">
      <div className="flex items-center gap-2.5">
        <span className="grid size-11 flex-none place-items-center rounded-full bg-primary-soft text-primary">
          <Icon name="user" />
        </span>
        <div>
          <strong className="block text-[15px]">{t('hello')}</strong>
          <span className="text-xs text-text-subtle">{t('text')}</span>
        </div>
      </div>
      <div className="grid gap-2">
        <button type="button" className={`${button} border-transparent bg-primary text-white hover:bg-primary-dark`}>
          {t('signIn')}
        </button>
        <button type="button" className={`${button} border-primary bg-bg text-primary hover:bg-primary-soft`}>
          {t('signUp')}
        </button>
      </div>
      <p className="text-center text-xs leading-[1.5] text-text-subtle">{t('note')}</p>
      <ul className="grid grid-cols-2 gap-2 border-t border-border pt-3">
        {QUICK_LINKS.map(({ key, icon }) => (
          <li key={key} className="min-w-0">
            <a
              href="#"
              className="flex h-full flex-col items-center gap-1 rounded-(--radius-sm) bg-bg-subtle px-1 py-2.5 text-center text-xs leading-[1.4] hover:bg-primary-soft hover:text-primary"
            >
              <Icon name={icon} className="size-5 text-primary" />
              {t(key)}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
