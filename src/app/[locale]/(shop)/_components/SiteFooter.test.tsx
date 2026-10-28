import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import en from '../../../../../messages/en.json';
import th from '../../../../../messages/th.json';
import SiteFooter from './SiteFooter';

function render(locale: 'th' | 'en', now: Date): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'th' ? th : en}
      timeZone="Asia/Bangkok"
      now={now}
    >
      <SiteFooter />
    </NextIntlClientProvider>,
  );
}

describe('SiteFooter', () => {
  it('shows the Buddhist year on /th and the Gregorian year on /en', () => {
    const now = new Date('2026-10-28T05:00:00Z');
    expect(render('th', now)).toContain('© 2569 Tinzshop');
    expect(render('en', now)).toContain('© 2026 Tinzshop');
  });

  it('takes the year in Bangkok time, not UTC', () => {
    // 18:00 UTC on 31 December is already 1 January in Bangkok.
    const now = new Date('2026-12-31T18:00:00Z');
    expect(render('th', now)).toContain('© 2570 Tinzshop');
    expect(render('en', now)).toContain('© 2027 Tinzshop');
  });
});
