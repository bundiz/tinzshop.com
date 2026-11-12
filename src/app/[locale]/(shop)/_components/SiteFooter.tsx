import { useLocale, useNow, useTimeZone, useTranslations } from 'next-intl';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';

const COLUMNS = [
  { key: 'help', links: ['myOrders', 'howToOrder', 'shipping', 'warranty', 'cancellation'] },
  { key: 'aboutUs', links: ['story', 'news', 'warrantyPolicy', 'privacy', 'terms'] },
  { key: 'contact', links: ['line'] },
] as const;

const PAYMENTS = ['kpayment', 'card', 'instalment', 'promptPay', 'dbd'] as const;

const LINK =
  'inline-flex min-h-11 items-center text-on-navy-2 transition-colors duration-[180ms] hover:text-white hover:underline hover:underline-offset-[3px] sm:min-h-9';

/**
 * The storefront footer from the redesign (plan 015): the about block with the LINE button, the three link columns
 * (ช่วยเหลือ, เกี่ยวกับเรา, ติดต่อร้าน), the five payment chips and the copyright line. The links are inert until their
 * pages exist (D-124); "ข่าวเกม" goes to the news list. "ติดต่อร้าน" holds only the LINE link: no phone number,
 * email or opening hours is on record (REQ-045).
 */
export default function SiteFooter() {
  const t = useTranslations('shop');
  const locale = useLocale();
  const timeZone = useTimeZone();
  const now = useNow();

  return (
    <footer className="mt-[clamp(48px,6vw,80px)] bg-navy text-[15px] text-on-navy-2">
      <div className="wrap grid grid-cols-1 gap-8 pt-14 pb-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="sm:col-span-2 lg:col-span-1">
          <Link href={`/${locale}`} aria-label={t('header.logo.label')} className="inline-flex min-h-11 items-center gap-2.5">
            <img
              src="/logo-mark.png"
              alt=""
              width={40}
              height={40}
              className="size-10 flex-none rounded-full ring-2 ring-white"
            />
            <span className="font-head text-[22px] leading-none font-bold tracking-[-.02em] text-white">{t('header.logo.word')}</span>
          </Link>
          <p className="mt-3.5 max-w-[26em]">{t('footer.about')}</p>
          <div className="mt-[18px] flex gap-2">
            <a
              href="#"
              aria-label={t('footer.contact.line')}
              className="grid size-11 place-items-center rounded-[10px] bg-white/7 text-white transition-[background-color,transform] duration-[180ms] ease-soft hover:-translate-y-0.5 hover:bg-white/16"
            >
              <Icon name="chat" className="size-5" />
            </a>
          </div>
        </div>
        {COLUMNS.map((column) => (
          <div key={column.key}>
            <h2 className="mb-3 font-body text-base leading-[1.3] font-semibold text-white">{t(`footer.${column.key}.title`)}</h2>
            <ul>
              {column.links.map((link) => (
                <li key={link}>
                  <Link href={link === 'news' ? `/${locale}/news` : '#'} className={LINK}>
                    {t(`footer.${column.key}.${link}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/8">
        <div className="wrap flex flex-wrap justify-between gap-4 py-5">
          <ul aria-label={t('footer.pay.label')} className="flex flex-wrap gap-2">
            {PAYMENTS.map((payment) => (
              <li
                key={payment}
                className="inline-flex h-8 items-center rounded-[6px] bg-white/7 px-3 text-[13px] font-medium text-on-navy"
              >
                {t(`footer.pay.${payment}`)}
              </li>
            ))}
          </ul>
          {/* On its own row below `sm` (R16). */}
          <p className="basis-full sm:basis-auto">{t('footer.copyright', { year: calendarYear(now, locale, timeZone) })}</p>
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
