import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import th from '../../../../../../../../messages/th.json';
import ServicePanel from './ServicePanel';

const html = renderToStaticMarkup(
  <NextIntlClientProvider locale="th" messages={th} timeZone="Asia/Bangkok">
    <ServicePanel />
  </NextIntlClientProvider>,
);

describe('ServicePanel', () => {
  it('shows the four assurances and an inert LINE button with ink text and no handle', () => {
    for (const key of ['shipping', 'warranty', 'invoice', 'cancel'] as const) {
      expect(html).toContain(th.shop.product.assure[key].title);
      expect(html).toContain(th.shop.product.assure[key].text);
    }
    expect(html).toContain(th.shop.product.ask.title);
    expect(html).toContain(th.shop.product.ask.text);
    const button = /<a[^>]*>(?:(?!<\/a>).)*ถามทาง LINE<\/a>/.exec(html)?.[0] ?? '';
    expect(button).toContain('href="#"');
    expect(button).toContain('bg-line-app');
    expect(button).toContain('text-ink');
    expect(button).not.toContain('text-white');
    expect(html).not.toMatch(/@[a-z0-9_.-]{3,}/i);
    expect(html).not.toContain('line.me');
  });

  it('keeps the old payment chips and store blurb out', () => {
    expect(html).not.toContain('PromptPay');
    expect(html).not.toContain('K-Payment');
    expect(html).not.toContain('สะพานเหล็ก');
  });
});
