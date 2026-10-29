import { useTranslations } from 'next-intl';

export type HeroProps = {
  /** The `id` of the section "shop now" scrolls to; `null` when there is none, and the button goes nowhere. */
  shopNowTarget: string | null;
};

const DOT_COUNT = 4;

/**
 * The landing banner: static text from the message catalogue, "shop now" (scrolls to the best sellers),
 * "view all products" and the carousel dots, the last two inert until a category page and banners exist (D-124).
 */
export default function Hero({ shopNowTarget }: HeroProps) {
  const t = useTranslations('shop.home.hero');

  return (
    <div className="relative flex min-h-[260px] flex-col justify-center overflow-hidden rounded-(--radius) bg-[radial-gradient(circle_at_82%_30%,rgba(254,166,1,0.35)_0,rgba(254,166,1,0)_32%),radial-gradient(circle_at_70%_110%,rgba(61,134,240,0.9)_0,rgba(61,134,240,0)_55%),linear-gradient(120deg,var(--color-primary-deep)_0%,var(--color-primary)_62%,#3d86f0_100%)] px-6 pt-7 pb-11 text-white lg:min-h-[300px] lg:px-10 lg:pt-9 lg:pb-[52px]">
      <div
        aria-hidden="true"
        className="absolute inset-0 [mask-image:linear-gradient(90deg,transparent_30%,#000_100%)] bg-[radial-gradient(rgba(255,255,255,0.14)_1px,transparent_1px)] bg-[length:18px_18px]"
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="absolute -right-10 -bottom-[30px] size-[260px] fill-none stroke-current opacity-[0.18]"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8.5 6.5h7a5.5 5.5 0 0 1 5.4 6.6l-.7 3.4A2.6 2.6 0 0 1 16 17.6L14.7 16H9.3L8 17.6a2.6 2.6 0 0 1-4.2-1.1l-.7-3.4A5.5 5.5 0 0 1 8.5 6.5Z" />
        <path d="M6.5 11h3.5M8.25 9.25v3.5M15.5 10.4h.01M17.6 12.6h.01" />
      </svg>
      <div className="relative max-w-[460px]">
        <span className="inline-flex items-center rounded-full bg-accent px-3 py-0.5 text-xs font-bold text-text">
          {t('eyebrow')}
        </span>
        <h1 className="mt-3 text-[28px] leading-[1.35] font-extrabold sm:text-[34px] lg:text-[38px]">
          {t.rich('title', {
            br: () => <br />,
            em: (chunks) => <em className="text-accent not-italic">{chunks}</em>,
          })}
        </h1>
        <p className="mt-2 text-[15px] text-[#d6e3fa]">{t('text')}</p>
        <div className="mt-[18px] flex flex-wrap gap-2.5">
          <a
            href={shopNowTarget === null ? '#' : `#${shopNowTarget}`}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-transparent bg-accent px-5 text-[15px] leading-[1.3] font-bold text-text transition-colors hover:bg-accent-dark"
          >
            {t('shopNow')}
          </a>
          <a
            href="#"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/40 bg-white/12 px-5 text-[15px] leading-[1.3] font-bold text-white transition-colors hover:bg-white/22"
          >
            {t('viewAll')}
          </a>
        </div>
      </div>
      <div aria-hidden="true" className="absolute bottom-4 left-6 flex gap-1.5 lg:left-10">
        {Array.from({ length: DOT_COUNT }, (_, index) => (
          <span
            key={index}
            className={`h-2 rounded-full ${index === 0 ? 'w-6 bg-accent' : 'w-2 bg-white/45'}`}
          />
        ))}
      </div>
    </div>
  );
}
