// @vitest-environment jsdom
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LandingProductCard } from '@/server/services/catalogue/landing-catalogue-service';
import th from '../../../../../../../messages/th.json';
import ArticleBody, { sizeEmbeds } from './ArticleBody';

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

describe('ArticleBody: the embed width of a card or a video (D-273)', () => {
  const SRC = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
  const sizedCard = (width: string) => `<tinz-product data-id="${ID}" data-width="${width}"></tinz-product>`;
  const iframeClasses = (doc: Document) => doc.querySelector('iframe')!.parentElement!.className.split(/\s+/);

  it('draws a card with a stored width centred at that width from sm, full width below', () => {
    const doc = parse(`<p>a</p>${sizedCard('60')}<p>b</p>`);
    const card = doc.querySelector('article')!;
    const frame = card.parentElement!;
    expect(frame.getAttribute('style')).toBe('--embed-w:60%');
    expect(frame.className.split(/\s+/)).toEqual(expect.arrayContaining(['sm:mx-auto', 'sm:w-(--embed-w)']));
    expect(frame.className).not.toMatch(/(^|\s)(w-|mx-)/);
  });

  it('draws a card without a width, or with one the sanitiser would drop, as before', () => {
    for (const body of [placeholder, sizedCard('100'), sizedCard('30')]) {
      const card = parse(body).querySelector('article')!;
      expect(card.parentElement!.getAttribute('style'), body).toBeNull();
      expect(card.parentElement!.className, body).not.toContain('--embed-w');
    }
  });

  it('gives a top-level video with a stored width the centred width from sm, and its column the rule', () => {
    for (const withCard of [false, true]) {
      const doc = parse(`<p>a</p><iframe src="${SRC}" allowfullscreen data-width="75"></iframe>${withCard ? placeholder : ''}`);
      const frame = doc.querySelector('iframe')!;
      expect(frame.getAttribute('style')).toBe('--embed-w:75%');
      expect(frame.getAttribute('title')).not.toBeNull();
      expect(frame.getAttribute('loading')).toBe('lazy');
      expect(iframeClasses(doc)).toEqual(expect.arrayContaining(['sm:[&>iframe[style]]:mx-auto', 'sm:[&>iframe[style]]:w-(--embed-w)']));
    }
  });

  it('leaves a video without a width, with an invalid one, or inside a figure without the width style', () => {
    for (const body of [
      `<iframe src="${SRC}" allowfullscreen></iframe>`,
      `<iframe src="${SRC}" data-width="100"></iframe>`,
      `<iframe src="${SRC}" data-width="60%"></iframe>`,
      `<figure><iframe src="${SRC}" data-width="60"></iframe></figure>`,
    ]) {
      expect(parse(body).querySelector('iframe')!.hasAttribute('style'), body).toBe(false);
    }
  });
});

describe('sizeEmbeds (D-273)', () => {
  it('adds the width style to top-level iframes only, and changes nothing else', () => {
    const SRC = 'https://www.youtube.com/embed/x';
    expect(sizeEmbeds(`<p>a</p><iframe src="${SRC}" data-width="60"></iframe>`)).toBe(
      `<p>a</p><iframe style="--embed-w:60%" src="${SRC}" data-width="60"></iframe>`,
    );
    for (const body of [
      '<p>a</p>',
      `<iframe src="${SRC}"></iframe>`,
      `<figure><iframe src="${SRC}" data-width="60"></iframe></figure>`,
      `<p>x<br>y</p><iframe src="${SRC}" data-width="9"></iframe>`,
    ]) {
      expect(sizeEmbeds(body), body).toBe(body);
    }
    expect(sizeEmbeds(`<p>x<br>y<img src="z" /></p><iframe src="${SRC}" data-width="45"></iframe>`)).toContain('style="--embed-w:45%"');
  });
});

describe('ArticleBody: the embed width of an uploaded image (D-283)', () => {
  const URL_ = 'https://media.example.com/news/2026/11/0f8fad5b-d9cb-469f-a165-70867728950e.jpg';
  const image = (width: string) => `<img src="${URL_}" alt="a" data-width="${width}" />`;

  it('draws an image alone in a top-level paragraph centred at its stored width from sm, keeping its shape', () => {
    for (const withCard of [false, true]) {
      const doc = parse(`<p>a</p><p>${image('60')}</p>${withCard ? placeholder : ''}`);
      const img = doc.querySelector('img')!;
      expect(img.getAttribute('style')).toBe('--embed-w:60%');
      expect(img.getAttribute('src')).toBe(URL_);
      expect(img.getAttribute('loading')).toBe('lazy');
      expect(img.closest('p')!.parentElement!.className.split(/\s+/)).toEqual(
        expect.arrayContaining(['sm:[&>p>img[style]]:block', 'sm:[&>p>img[style]]:mx-auto', 'sm:[&>p>img[style]]:w-(--embed-w)', '[&_img]:h-auto']),
      );
    }
  });

  it('leaves an image with an invalid width, beside text, or in a list, quote or figure without the width style', () => {
    for (const body of [
      `<p>${image('100')}</p>`,
      `<p>${image('6O')}</p>`,
      `<p>x${image('60')}</p>`,
      `<p>${image('60')} y</p>`,
      `<ul><li><p>${image('60')}</p></li></ul>`,
      `<blockquote><p>${image('60')}</p></blockquote>`,
      `<figure>${image('60')}</figure>`,
      `<p><img src="${URL_}" alt="a" /></p>`,
    ]) {
      expect(parse(body).querySelector('img')!.hasAttribute('style'), body).toBe(false);
    }
  });
});

describe('sizeEmbeds: images (D-283)', () => {
  it('styles only an image alone in a top-level paragraph', () => {
    expect(sizeEmbeds('<p><img src="https://m.example/a.jpg" alt="a" data-width="45" /></p>')).toBe(
      '<p><img style="--embed-w:45%" src="https://m.example/a.jpg" alt="a" data-width="45" /></p>',
    );
    const nested = '<blockquote><p><img src="https://m.example/a.jpg" data-width="45" /></p></blockquote>';
    expect(sizeEmbeds(nested)).toBe(nested);
  });
});
