import { useTranslations } from 'next-intl';
import Icon, { type IconName } from '@/components/ui/Icon';

const PERKS: readonly { key: 'orders' | 'invoice' | 'preOrder' | 'warranty'; icon: IconName; hasText: boolean }[] = [
  { key: 'orders', icon: 'package', hasText: true },
  { key: 'invoice', icon: 'receipt', hasText: true },
  { key: 'preOrder', icon: 'calendar', hasText: false },
  { key: 'warranty', icon: 'wrench', hasText: true },
];

/**
 * The navy panel beside the sign-in and register cards (the mockup's `.auth__perks`): what a member gets. The
 * wishlist, the tracking number and the pre-order reminders are left out because the shop does not offer them (R5).
 */
export default function AuthPerks({ variant }: { variant: 'signIn' | 'register' }) {
  const t = useTranslations('shop.auth.perks');

  return (
    <aside
      data-auth-perks
      aria-labelledby="perks-title"
      className="relative flex flex-col overflow-hidden rounded-[16px] bg-navy p-[clamp(28px,3.4vw,48px)] text-on-navy sm:rounded-xl lg:sticky lg:top-[140px]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(60%_60%_at_100%_0%,rgba(11,95,208,.35),transparent_60%),radial-gradient(50%_50%_at_0%_100%,rgba(254,166,1,.14),transparent_60%),linear-gradient(rgba(255,255,255,.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.03)_1px,transparent_1px)] bg-[length:auto,auto,40px_40px,40px_40px]"
      />
      <p className="relative inline-flex items-center gap-2 text-[13px] leading-none font-semibold tracking-[.06em] uppercase text-on-navy-2">
        {t('eyebrow')}
      </p>
      <h2 id="perks-title" className="relative mt-3 max-w-[16em] text-[clamp(24px,2.4vw,32px)] font-bold text-white">
        {variant === 'signIn' ? t('signInTitle') : t('registerTitle')}
      </h2>
      <ul className="relative mt-7 grid gap-3.5 sm:gap-[18px]">
        {PERKS.map((perk) => (
          <li key={perk.key} className="grid grid-cols-[44px_1fr] items-start gap-3.5">
            <span className="flex size-11 items-center justify-center rounded-[12px] bg-white/8 text-accent">
              <Icon name={perk.icon} className="size-[22px]" />
            </span>
            <span className="text-[15px] text-on-navy-2">
              <b className="block font-semibold text-white">{t(`${perk.key}.title`)}</b>
              {perk.hasText && t(`${perk.key}.text`)}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
