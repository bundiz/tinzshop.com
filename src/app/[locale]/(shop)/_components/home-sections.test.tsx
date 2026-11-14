import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LandingProductCard } from '@/server/services/catalogue/landing-catalogue-service';
import en from '../../../../../messages/en.json';
import th from '../../../../../messages/th.json';
import { pickHeroCards } from '../(home)/hero-cards';
import ConsultBand from './ConsultBand';
import Hero from './Hero';
import PlatformBanners from './PlatformBanners';
import PlatformTiles from './PlatformTiles';
import Reasons from './Reasons';

function render(node: ReactNode, locale: 'th' | 'en' = 'th'): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'th' ? th : en} timeZone="Asia/Bangkok">
      {node}
    </NextIntlClientProvider>,
  );
}

function card(n: number, overrides: Partial<LandingProductCard> = {}): LandingProductCard {
  return {
    productId: `00000000-0000-4000-8000-00000000000${n}`,
    name: `สินค้า ${n}`,
    imageUrl: null,
    priceSatang: 100000n + BigInt(n) * 100n,
    originalPriceSatang: null,
    isPriceRange: false,
    stockStatus: 'in_stock',
    isKit: false,
    isPreOrder: false,
    releaseDate: null,
    ...overrides,
  };
}

const kit = card(1, { isKit: true, name: 'ชุดพร้อมเล่น PS5', priceSatang: 1949000n });
const minis = [card(2), card(3), card(4)];

describe('pickHeroCards', () => {
  it('takes the first kit as the feature and the first three best sellers that are not it as the minis', () => {
    const kits = [kit, card(5, { isKit: true })];
    const best = [kit, card(2), card(3), card(4), card(6)];
    const picked = pickHeroCards({ bundles: kits, bestSellers: best });
    expect(picked.feature?.productId).toBe(kit.productId);
    expect(picked.minis.map((c) => c.productId)).toEqual(minis.map((c) => c.productId));
  });

  it('has no feature without a kit, and the minis are then the first three best sellers', () => {
    const picked = pickHeroCards({ bundles: [], bestSellers: [card(2), card(3), card(4), card(6)] });
    expect(picked.feature).toBeNull();
    expect(picked.minis).toHaveLength(3);
  });
});

describe('Hero', () => {
  it('links เลือกซื้อสินค้า to the product listing', () => {
    const html = render(<Hero feature={kit} minis={minis} signedIn={false} />);
    expect(html).toMatch(new RegExp(`<a [^>]*href="/th/product"[^>]*>${th.shop.home.hero.shop}`));
    expect(html).toContain('<h1');
    expect(html).toContain('not-italic text-accent');
  });

  it('shows สมัครสมาชิก only when signed out', () => {
    const out = render(<Hero feature={kit} minis={minis} signedIn={false} />);
    expect(out).toMatch(new RegExp(`href="/th/register"[^>]*>(<svg.*?</svg>)?${th.shop.home.hero.register}`));
    const signedIn = render(<Hero feature={kit} minis={minis} signedIn />);
    expect(signedIn).not.toContain('/th/register');
  });

  it('the feature card is the first kit, with its price and stock and no savings line', () => {
    const html = render(<Hero feature={kit} minis={minis} signedIn={false} />);
    expect(html).toContain(th.shop.home.hero.feature.tag);
    expect(html).toContain(kit.name);
    expect(html).toContain(`href="/th/product/${kit.productId}/detail"`);
    expect(html).toContain('19,490');
    expect(html).toContain(th.shop.product.stock.in_stock);
    expect(html).not.toContain('คุ้มกว่า');
    expect(html).not.toContain('790');
  });

  it('shows the kit image when it has one, else the dark placeholder', () => {
    const withImage = render(<Hero feature={{ ...kit, imageUrl: 'https://example.test/k.jpg' }} minis={[]} signedIn={false} />);
    expect(withImage).toContain('src="https://example.test/k.jpg"');
    const without = render(<Hero feature={kit} minis={[]} signedIn={false} />);
    expect(without).toContain(th.shop.product.imagePlaceholderAlt);
  });

  it('without a kit there is no feature card and the text spans the width', () => {
    const html = render(<Hero feature={null} minis={minis} signedIn={false} />);
    expect(html).not.toContain(th.shop.home.hero.feature.tag);
    expect(html).not.toContain('/detail"');
    expect(html).not.toContain('lg:grid-cols-[1.05fr_.95fr]');
    expect(html).toContain(th.shop.home.hero.shop);
  });

  it('draws the minis as links with price, and only the first below sm', () => {
    const html = render(<Hero feature={kit} minis={minis} signedIn={false} />);
    for (const mini of minis) expect(html).toContain(`href="/th/product/${mini.productId}/detail"`);
    expect(html).toContain('sm:grid-cols-3');
    expect(html.match(/hidden sm:flex/g)).toHaveLength(2);
  });

  it('puts no invented line on the screen', () => {
    const html = render(<Hero feature={kit} minis={minis} signedIn={false} />);
    for (const made of ['Switch 2', 'สัปดาห์นี้', 'เลขพัสดุ', 'เบอร์ร้าน']) expect(html).not.toContain(made);
  });
});

describe('PlatformTiles', () => {
  it('links the platforms to the listing, พรีออเดอร์ to pre_order=1 and ชุดโปรโมชั่น to kit=1', () => {
    const html = render(<PlatformTiles />);
    expect(html).toContain('aria-label="เลือกตามแพลตฟอร์ม"');
    expect(html).toContain('href="/th/product?category=playstation-5"');
    expect(html).toContain('href="/th/product?category=nintendo-switch"');
    expect(html).toContain('href="/th/product?category=it-gadgets"');
    expect(html).toContain('href="/th/product?pre_order=1"');
    expect(html).toContain('href="/th/product?kit=1"');
    expect(html).not.toContain('Switch 2');
    expect(html).not.toContain('คุ้มกว่า');
  });

  it('leaves ลดราคา inert', () => {
    const html = render(<PlatformTiles />);
    expect(html).toMatch(new RegExp(`<a [^>]*href="#"[^>]*>.*?${th.shop.home.platforms.saleTitle}`));
    expect(html.match(/href="#"/g)).toHaveLength(1);
  });
});

describe('PlatformBanners', () => {
  it('links each banner and its type links to the listing with category and type', () => {
    const html = render(<PlatformBanners />);
    expect(html).toContain('href="/th/product?category=playstation-5"');
    expect(html).toContain('href="/th/product?category=nintendo-switch"');
    expect(html).toContain('href="/th/product?category=playstation-5&amp;type=playstation-5-console"');
    expect(html).toContain('href="/th/product?category=playstation-5&amp;type=playstation-5-accessory"');
    expect(html).toContain('href="/th/product?category=nintendo-switch&amp;type=nintendo-switch-game"');
    expect(html).toContain(th.shop.home.banners.ps.title);
    expect(html).toContain(th.shop.home.banners.switch.title);
  });

  it('leaves เคส & ฟิล์ม inert and says nothing about a shop warranty', () => {
    const html = render(<PlatformBanners />);
    expect(html).toMatch(/<a [^>]*href="#"[^>]*>เคส &amp; ฟิล์ม/);
    expect(html.match(/href="#"/g)).toHaveLength(1);
    expect(html).not.toContain('เครื่องประกันร้าน');
    expect(html).not.toContain('Switch 2');
  });
});

describe('Reasons', () => {
  it('shows the four reasons', () => {
    const html = render(<Reasons />);
    for (const key of ['store', 'staff', 'warranty', 'documents'] as const) {
      expect(html).toContain(th.shop.home.reasons[key].title);
    }
    expect(html).toContain(th.shop.home.reasons.title);
  });
});

describe('ConsultBand', () => {
  it('its LINE and FAQ buttons are inert', () => {
    const html = render(<ConsultBand />);
    expect(html.match(/<a [^>]*href="#"/g)).toHaveLength(2);
    expect(html).toContain(th.shop.home.consult.line);
    expect(html).toContain(th.shop.home.consult.faq);
  });

  it('the LINE button has ink text', () => {
    const html = render(<ConsultBand />);
    expect(html).toMatch(/<a [^>]*class="[^"]*bg-line-app text-ink[^"]*"[^>]*>/);
    expect(html).not.toMatch(/bg-line-app[^"]*text-white/);
  });

  it('shows no chat sample and no handle', () => {
    const html = render(<ConsultBand />);
    expect(html).not.toContain('@');
    expect(html).not.toContain('ต่างกันยังไง');
    expect(html).not.toContain('ประหยัดกว่า');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('text-[44px]');
    expect(html).toContain('sm:text-[clamp(44px,6.4vw,92px)]');
  });
});
