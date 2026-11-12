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

  it('links "ข่าวเกม" to the news list and leaves the other column links inert', () => {
    const html = render('th', new Date('2026-10-28T05:00:00Z'));
    expect(html).toContain(`href="/th/news">${th.shop.footer.aboutUs.news}<`);
    expect(html).toContain(`href="#">${th.shop.footer.aboutUs.story}<`);
  });

  it('renders the three columns, the LINE link, and the five payment chips', () => {
    const html = render('th', new Date('2026-10-28T05:00:00Z'));
    const headings = [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map((match) => match[1]);
    expect(headings).toEqual([th.shop.footer.help.title, th.shop.footer.aboutUs.title, th.shop.footer.contact.title]);
    expect(html).not.toContain('<h4');
    expect(html).toMatch(new RegExp(`<a[^>]*href="#"[^>]*>${th.shop.footer.contact.line}</a>`));
    expect(html).toContain(`aria-label="${th.shop.footer.contact.line}"`);
    const chips = [...html.matchAll(/<li class="inline-flex h-8[^>]*>([^<]+)<\/li>/g)].map((match) => match[1]);
    expect(chips).toEqual(['ชำระผ่าน K-Payment', 'บัตรเครดิต / เดบิต', 'ผ่อนชำระ', 'PromptPay QR', 'DBD Registered']);
    const english = render('en', new Date('2026-10-28T05:00:00Z'));
    expect([...english.matchAll(/<li class="inline-flex h-8[^>]*>([^<]+)<\/li>/g)]).toHaveLength(5);
  });

  it('keeps the logo link at least 44px tall below sm, with a ring from a token class', () => {
    const html = render('th', new Date('2026-10-28T05:00:00Z'));
    expect(html).toMatch(/<a aria-label="Tinzshop หน้าแรก" class="inline-flex min-h-11 [^"]*" href="\/th">/);
    expect(html).toContain('ring-2 ring-white');
    expect(html).not.toContain('rgba(');
  });

  it('shows no phone number, email, opening hours or placeholder text', () => {
    for (const locale of ['th', 'en'] as const) {
      const html = render(locale, new Date('2026-10-28T05:00:00Z'));
      const text = html.replace(/<[^>]*>/g, ' ');
      expect(text).not.toMatch(/\d{2,3}[- ]?\d{3}[- ]?\d{4}/);
      expect(text).not.toMatch(/@/);
      expect(text).not.toContain('เบอร์ร้าน');
      expect(text).not.toContain('รอข้อมูลจากร้าน');
      expect(text).not.toContain('เวลาทำการ');
      expect(text).not.toContain('อีเมลร้าน');
      expect(text).not.toContain('โทร');
      expect(text.toLowerCase()).not.toContain('opening hours');
      expect(text.toLowerCase()).not.toContain('phone');
      expect(text.toLowerCase()).not.toContain('email');
    }
  });
});
