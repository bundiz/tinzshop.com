import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { routing } from '@/i18n/routing';

export type SiteHeaderProps = {
  /** The current page's path without the locale, e.g. `/`; the language switch links to it in the other locale. */
  path: string;
};

type AppLocale = (typeof routing.locales)[number];

const LANGUAGE_NAME_KEY: Record<AppLocale, 'language.thName' | 'language.enName'> = {
  th: 'language.thName',
  en: 'language.enName',
};

/** The storefront header: tagline, language switch and logo. No search, cart, sign-in or menus yet. */
export default function SiteHeader({ path }: SiteHeaderProps) {
  const t = useTranslations('shop.header');
  const locale = useLocale();

  return (
    <>
      <div className="bg-primary-deep text-[13px] text-[#d6e3fa]">
        <div className="mx-auto flex min-h-9 max-w-[1280px] items-center justify-between gap-4 px-4 min-[900px]:px-6">
          <p className="min-w-0 truncate">{t('tagline')}</p>
          <nav aria-label={t('language.label')} className="flex-none">
            <ul className="inline-flex rounded-full border border-white/25 text-xs font-semibold">
              {routing.locales.map((target) => (
                <li key={target}>
                  {target === locale ? (
                    <span
                      aria-current="true"
                      lang={target}
                      className="block rounded-full bg-accent px-2.5 py-px text-text"
                    >
                      {t(`language.${target}`)}
                    </span>
                  ) : (
                    <Link
                      href={localePath(target, path)}
                      hrefLang={target}
                      lang={target}
                      aria-label={t(LANGUAGE_NAME_KEY[target])}
                      // The hit area grows past the small pill to a 44px tap target (07 Responsive).
                      className="relative block rounded-full px-2.5 py-px after:absolute after:-inset-x-1 after:-inset-y-3 after:content-[''] hover:text-white"
                    >
                      {t(`language.${target}`)}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
      <header className="sticky top-0 z-20 border-b border-border bg-bg">
        <div className="mx-auto flex max-w-[1280px] items-center px-4 py-3 min-[900px]:px-6 min-[900px]:py-4">
          <Link href={`/${locale}`} aria-label={t('logo.label')} className="flex min-h-11 items-center gap-2.5">
            <img src="/logo-mark.png" alt="" width={40} height={40} className="size-10" />
            <span>
              <span className="block text-[22px] leading-none font-extrabold tracking-[-0.02em] text-primary">
                {t('logo.wordLead')}
                <b className="text-accent">{t('logo.wordTail')}</b>
              </span>
              <span className="mt-[3px] hidden text-[11px] leading-[1.3] text-text-subtle min-[900px]:block">
                {t('logo.sub')}
              </span>
            </span>
          </Link>
        </div>
      </header>
    </>
  );
}

function localePath(locale: string, path: string): string {
  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}
