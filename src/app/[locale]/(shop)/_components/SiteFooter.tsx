import { useLocale, useNow, useTimeZone, useTranslations } from 'next-intl';
import Link from 'next/link';

/** The storefront footer: logo, the shop's description and the copyright line. No link columns until those pages exist. */
export default function SiteFooter() {
  const t = useTranslations('shop');
  const locale = useLocale();
  const timeZone = useTimeZone();
  const now = useNow();

  return (
    <footer className="mt-6 bg-[#16161f] text-sm text-[#b9b9c8]">
      <div className="mx-auto max-w-[1280px] px-4 pt-9 pb-7 min-[900px]:px-6">
        <Link href={`/${locale}`} aria-label={t('header.logo.label')} className="inline-flex min-h-11 items-center gap-2.5">
          <img src="/logo-mark.png" alt="" width={40} height={40} className="size-10" />
          <span className="text-[22px] leading-none font-extrabold tracking-[-0.02em] text-white">
            {t('header.logo.wordLead')}
            <b className="text-accent">{t('header.logo.wordTail')}</b>
          </span>
        </Link>
        <p className="mt-3 max-w-[340px] leading-[1.7]">{t('footer.about')}</p>
      </div>
      <div className="border-t border-white/8">
        <div className="mx-auto max-w-[1280px] px-4 py-[18px] min-[900px]:px-6">
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
