import { defineRouting } from 'next-intl/routing';

// The locale is a URL segment and is never guessed from a browser header
// (07 Bilingual, D-031): `/` always goes to the default locale, `/th`, and
// no locale cookie is set, because nothing would read it.
export const routing = defineRouting({
  locales: ['th', 'en'],
  defaultLocale: 'th',
  localePrefix: 'always',
  localeDetection: false,
  localeCookie: false,
});
