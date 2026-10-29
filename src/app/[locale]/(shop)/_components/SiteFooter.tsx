import { useLocale, useNow, useTimeZone, useTranslations } from 'next-intl';
import Link from 'next/link';

const COLUMNS = [
  { key: 'shopping', links: ['switch', 'ps5', 'gadgets', 'preOrder'] },
  { key: 'help', links: ['howToOrder', 'payment', 'shipping', 'trackOrder'] },
  { key: 'aboutUs', links: ['story', 'news', 'contact'] },
  { key: 'policy', links: ['privacy', 'terms', 'claims'] },
] as const;

/**
 * The storefront footer from the design: logo and description, four link columns, the K-Payment and DBD
 * badges and the copyright line. The column links are inert until their pages exist (D-124); "ข่าวเกม" goes to
 * the news list.
 */
export default function SiteFooter() {
  const t = useTranslations('shop');
  const locale = useLocale();
  const timeZone = useTimeZone();
  const now = useNow();

  return (
    <footer className="mt-6 bg-[#16161f] text-sm text-[#b9b9c8]">
      <div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-x-5 gap-y-7 px-4 pt-9 pb-7 sm:grid-cols-3 md:grid-cols-[1.6fr_repeat(4,minmax(0,1fr))] md:px-6">
        <div className="col-span-full md:col-auto">
          <Link href={`/${locale}`} aria-label={t('header.logo.label')} className="inline-flex items-center gap-2.5">
            <img src="/logo-mark.png" alt="" width={40} height={40} className="size-10" />
            <span className="text-[22px] leading-none font-extrabold tracking-[-0.02em] text-white">
              {t('header.logo.wordLead')}
              <b className="text-accent">{t('header.logo.wordTail')}</b>
            </span>
          </Link>
          <p className="mt-3 max-w-[340px] leading-[1.7]">{t('footer.about')}</p>
        </div>
        {COLUMNS.map((column) => (
          <div key={column.key}>
            <h2 className="mb-2.5 text-[15px] text-white">
              {column.key === 'shopping' ? t('footer.shopping.title') : t(`footer.${column.key}.title`)}
            </h2>
            <ul>
              {column.links.map((link) => (
                <li key={link} className="mb-1.5">
                  <Link href={link === 'news' ? `/${locale}/news` : '#'} className="hover:text-accent">
                    {column.key === 'shopping' ? t(`category.${link}`) : t(`footer.${column.key}.${link}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/8">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-3.5 px-4 py-[18px] md:flex-row md:items-center md:justify-between md:px-6">
          <div className="flex flex-wrap gap-2.5">
            <PayBadge mark={t('footer.payBadge.mark')} title={t('footer.payBadge.title')} text={t('footer.payBadge.text')} tone="kpay" />
            <PayBadge mark={t('footer.dbdBadge.mark')} title={t('footer.dbdBadge.title')} text={t('footer.dbdBadge.text')} tone="dbd" />
          </div>
          <p className="text-xs text-[#7c7c8e]">
            {t('footer.copyright', { year: calendarYear(now, locale, timeZone) })}
          </p>
        </div>
      </div>
    </footer>
  );
}

/** The year in the locale's own calendar, in the shop's time zone: Buddhist era on `/th` (2569), Gregorian on `/en` (2026). */
function calendarYear(now: Date, locale: string, timeZone: string | undefined): string {
  const parts = new Intl.DateTimeFormat(locale, { year: 'numeric', timeZone }).formatToParts(now);
  return parts.find((part) => part.type === 'year')?.value ?? String(now.getFullYear());
}

function PayBadge({ mark, title, text, tone }: { mark: string; title: string; text: string; tone: 'kpay' | 'dbd' }) {
  const markTone = tone === 'kpay' ? 'bg-[#0f9d58] text-[13px] text-white' : 'bg-white text-[10px] leading-[1.2] text-[#16161f]';
  return (
    <span className="inline-flex items-center gap-2.5 rounded-(--radius-sm) border border-white/10 bg-white/6 px-3 py-2 text-xs leading-[1.45]">
      <span aria-hidden="true" className={`grid size-[34px] flex-none place-items-center rounded-lg text-center font-extrabold ${markTone}`}>
        {mark}
      </span>
      <span>
        <strong className="block text-[13px] text-white">{title}</strong>
        {text}
      </span>
    </span>
  );
}
