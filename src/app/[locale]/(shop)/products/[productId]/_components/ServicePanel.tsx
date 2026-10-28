import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

const ITEMS: { key: 'shipping' | 'taxInvoice' | 'store'; icon: ReactNode }[] = [
  {
    key: 'shipping',
    icon: (
      <>
        <path d="M3 6.5h11v9H3zM14 9.5h4l3 3v3h-7" />
        <circle cx="7" cy="17.5" r="1.8" />
        <circle cx="17.5" cy="17.5" r="1.8" />
      </>
    ),
  },
  {
    key: 'taxInvoice',
    icon: (
      <>
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2Z" />
        <path d="M9 8h6M9 12h6M9 16h3" />
      </>
    ),
  },
  {
    key: 'store',
    icon: (
      <path d="M4 9.5 5.5 4h13L20 9.5M4 9.5h16M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M5.5 12v8h13v-8M10 20v-4.5h4V20" />
    ),
  },
];

/**
 * The product page's service blurbs from the design: shipping, tax invoice and store.
 * The design's rate link, contact link and payment chips are left out: nothing behind them exists yet.
 */
export default function ServicePanel() {
  const t = useTranslations('shop.product.service');

  return (
    <aside
      aria-label={t('label')}
      className="rounded-(--radius) bg-bg p-4 min-[900px]:col-span-full min-[1100px]:col-auto"
    >
      <h2 className="mb-3.5 text-[15px]">{t('title')}</h2>
      <ul className="grid gap-3.5">
        {ITEMS.map(({ key, icon }) => (
          <li key={key} className="grid grid-cols-[36px_1fr] items-start gap-2.5">
            <span className="grid size-9 place-items-center rounded-full bg-primary-soft text-primary">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-5 fill-none stroke-current"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {icon}
              </svg>
            </span>
            <div className="min-w-0">
              <strong className="block text-sm leading-[1.5]">{t(`${key}.title`)}</strong>
              <p className="text-[13px] leading-[1.55] text-text-subtle">{t(`${key}.text`)}</p>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
