import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

const ITEMS: { key: 'shipping' | 'payment' | 'store' | 'taxInvoice'; icon: ReactNode }[] = [
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
    key: 'payment',
    icon: (
      <>
        <rect x="3" y="5.5" width="18" height="13" rx="2" />
        <path d="M3 10h18M7 15h3" />
      </>
    ),
  },
  {
    key: 'store',
    icon: (
      <path d="M4 9.5 5.5 4h13L20 9.5M4 9.5h16M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M5.5 12v8h13v-8M10 20v-4.5h4V20" />
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
];

/** The four service blurbs under the hero. */
export default function TrustStrip() {
  const t = useTranslations('shop.home.trust');

  return (
    <section aria-label={t('label')} className="mt-4">
      <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-(--radius) bg-border min-[480px]:grid-cols-2 sm:grid-cols-4">
        {ITEMS.map(({ key, icon }) => (
          <li key={key} className="flex items-center gap-3 bg-bg p-3.5">
            <span className="grid size-[42px] flex-none place-items-center rounded-full bg-primary-soft text-primary">
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
            <div className="min-w-0 leading-[1.45]">
              <strong className="block text-sm">{t(`${key}.title`)}</strong>
              <span className="block text-xs text-text-subtle">{t(`${key}.text`)}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
