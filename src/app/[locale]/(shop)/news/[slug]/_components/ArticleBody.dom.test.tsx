// @vitest-environment jsdom
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LandingProductCard } from '@/server/services/catalogue/landing-catalogue-service';
import th from '../../../../../../../messages/th.json';
import ArticleBody from './ArticleBody';

const ID = '7d1b0a52-3a8e-4f0c-9b8a-2a7c1e4d5f60';
const placeholder = `<tinz-product data-id="${ID}"></tinz-product>`;
const product: LandingProductCard = {
  productId: ID,
  name: 'Astro Bot',
  imageUrl: null,
  priceSatang: 129900n,
  originalPriceSatang: null,
  isPriceRange: false,
  stockStatus: 'in_stock',
  isKit: false,
  isPreOrder: false,
  releaseDate: null,
};

const parse = (body: string) =>
  new DOMParser().parseFromString(
    renderToStaticMarkup(
      <NextIntlClientProvider locale="th" messages={th} timeZone="Asia/Bangkok">
        <ArticleBody html={body} productCards={[product]} />
      </NextIntlClientProvider>,
    ),
    'text/html',
  );

describe('ArticleBody around product cards (R16)', () => {
  it('keeps lists, quotes and tables balanced around top-level cards', () => {
    const doc = parse(
      `<ol><li>one</li><li>two</li></ol>${placeholder}<blockquote><p>quote</p></blockquote>${placeholder}<table><tbody><tr><td>cell</td></tr></tbody></table>`,
    );
    expect([...(doc.querySelector('ol')?.children ?? [])].map((li) => li.tagName + li.textContent)).toEqual(['LIone', 'LItwo']);
    expect(doc.querySelectorAll('li')).toHaveLength(2);
    expect(doc.querySelector('blockquote')?.textContent).toBe('quote');
    expect(doc.querySelector('td')?.textContent).toBe('cell');
    expect(doc.querySelectorAll(`a[href="/th/product/${ID}/detail"]`)).toHaveLength(2);
    expect(doc.querySelector('td a, li a, blockquote a')).toBeNull();
  });

  it('does not cut a list at a nested card that somehow reached the render', () => {
    const doc = parse(`<ol><li>one</li><li>two${placeholder}</li><li>three</li></ol>`);
    expect(doc.querySelectorAll('ol')).toHaveLength(1);
    expect(doc.querySelectorAll('ol > li')).toHaveLength(3);
    expect(doc.querySelector(`a[href="/th/product/${ID}/detail"]`)).toBeNull();
  });
});
