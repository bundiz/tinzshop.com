import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { LandingProductCard } from '@/server/services/catalogue/landing-catalogue-service';
import type {
  StorefrontListing,
  StorefrontListingParams,
} from '@/server/services/catalogue/storefront-listing-service';
import en from '../../../../../../messages/en.json';
import th from '../../../../../../messages/th.json';
import { DEFAULT_LISTING } from '../listing-url';
import { parseBahtInput } from './ListingControls';
import ProductListingView, { PRICE_PRESETS, listingNav } from './ProductListingView';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

function card(n: number): LandingProductCard {
  return {
    productId: `p${n}`,
    name: `สินค้า ${n}`,
    imageUrl: null,
    priceSatang: 129000n,
    originalPriceSatang: null,
    isPriceRange: false,
    stockStatus: 'in_stock',
    isKit: false,
    isPreOrder: false,
    releaseDate: null,
  };
}

const FACETS: StorefrontListing['facets'] = {
  categories: [
    { slug: 'nintendo-switch', name: 'Nintendo Switch', count: 124 },
    { slug: 'playstation-5', name: 'PlayStation 5', count: 248 },
    { slug: 'it-gadgets', name: 'IT Gadgets', count: 310 },
  ],
  types: [
    { slug: 'nintendo-switch-console', parentSlug: 'nintendo-switch', name: 'เครื่องเกม', count: 9 },
    { slug: 'playstation-5-console', parentSlug: 'playstation-5', name: 'เครื่องเกม', count: 18 },
    { slug: 'playstation-5-game', parentSlug: 'playstation-5', name: 'แผ่นเกม', count: 142 },
    { slug: 'playstation-5-controller', parentSlug: 'playstation-5', name: 'จอย', count: 27 },
    { slug: 'playstation-5-accessory', parentSlug: 'playstation-5', name: 'อุปกรณ์เสริม', count: 49 },
    { slug: 'it-gadgets-accessory', parentSlug: 'it-gadgets', name: 'อุปกรณ์เสริม', count: 310 },
  ],
  inStock: 200,
  kit: 12,
  preOrder: 36,
};

function listing(active: Partial<StorefrontListingParams> = {}, overrides: Partial<StorefrontListing> = {}): StorefrontListing {
  return {
    cards: [card(1), card(2)],
    total: 248,
    page: 1,
    totalPages: 11,
    facets: FACETS,
    active: { ...DEFAULT_LISTING, ...active },
    ...overrides,
  };
}

function render(value: StorefrontListing, locale: 'th' | 'en' = 'th'): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'th' ? th : en} timeZone="Asia/Bangkok">
      <ProductListingView listing={value} articlesMenu={[]} />
    </NextIntlClientProvider>,
  );
}

const between = (html: string, start: string, end: string): string => {
  const from = html.indexOf(start) + start.length;
  return html.slice(from, html.indexOf(end, from));
};
const tabs = (html: string) => between(html, `aria-label="${th.shop.listing.tabs.label}" class="`, '</nav>').replace(/^[^>]*>/, '');
const sidebar = (html: string) => between(html, 'id="listing-filters"', 'class="fixed inset-x-0 bottom-0');
const text = (html: string) => html.replace(/<[^>]+>/g, '');
const decode = (html: string) => html.replace(/&amp;/g, '&');

describe('ProductListingView', () => {
  it('marks the active tab and the active category, and scopes the type tabs to it', () => {
    const html = decode(render(listing({ category: 'playstation-5', types: ['playstation-5-game'] })));
    const strip = tabs(html);
    expect(text(strip)).toBe(
      'ทั้งหมดเครื่องเกม18 รายการแผ่นเกม142 รายการจอย27 รายการอุปกรณ์เสริม49 รายการชุดโปรโมชั่น12 รายการ',
    );
    expect(strip.match(/aria-current="page"/g)).toHaveLength(1);
    expect(strip).toMatch(/href="\/th\/product\?category=playstation-5&type=playstation-5-game"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/th\/product\?category=playstation-5&type=playstation-5-game"/);
    expect(strip).toContain('href="/th/product?category=playstation-5&kit=1"');
    // The hero and breadcrumb name the category.
    expect(html).toMatch(/<h1[^>]*>PlayStation 5<\/h1>/);
    expect(html).toContain('เครื่องเกม แผ่นเกม จอย และอุปกรณ์เสริมสำหรับ PlayStation 5 · 248 รายการ');
    // In the sidebar the active platform is current and links back to all platforms, keeping the kind.
    expect(sidebar(html)).toMatch(/aria-current="true"[^>]*>PlayStation 5</);
    expect(sidebar(html)).toMatch(/href="\/th\/product\?type=playstation-5-game">PlayStation 5</);
  });

  it('marks ทั้งหมด on the unfiltered listing and still renders with no categories', () => {
    const html = render(
      listing({}, { facets: { categories: [], types: [], inStock: 0, kit: 0, preOrder: 0 }, total: 8, totalPages: 1 }),
    );
    expect(text(tabs(html))).toBe('ทั้งหมด8 รายการชุดโปรโมชั่น0 รายการ');
    expect(tabs(html)).toMatch(/^<a [^>]*aria-current="page"[\s\S]*?<span>ทั้งหมด</);
    expect(html).toMatch(/<h1[^>]*>สินค้าทั้งหมด<\/h1>/);
    expect(text(html)).toContain('แสดง 1–8 จาก 8 รายการ');
    // The head agrees with the toolbar even when no product has a category (D-223).
    expect(text(html)).toContain('ทุกแพลตฟอร์ม · 8 รายการ');
    expect(html).not.toContain(`aria-label="${th.shop.news.pagination.label}"`);
  });

  it('shows each sidebar count from the facets', () => {
    const side = sidebar(decode(render(listing())));
    expect(side).toMatch(/>PlayStation 5<\/a><span[^>]*>248<\/span>/);
    expect(side).toMatch(/>พรีออเดอร์<\/a><span[^>]*>36<\/span>/);
    // With no platform chosen a kind sums its types across platforms.
    expect(side).toMatch(/เครื่องเกม<span[^>]*>27<\/span>/);
    expect(side).toMatch(/ชุดโปรโมชั่น<span[^>]*>12<\/span>/);
    expect(side).toContain('href="/th/product?category=playstation-5"');
    expect(text(side)).not.toContain('คะแนนรีวิว');
  });

  it('lists the active filters as removable chips with ล้างทั้งหมด', () => {
    const html = decode(
      render(listing({ category: 'playstation-5', minBaht: 1000, maxBaht: 20000, inStock: true, sort: 'price_asc', page: 2 })),
    );
    const chips = between(html, '<span>ตัวกรองที่ใช้:</span>', '</div>');
    expect(text(chips)).toBe('PlayStation 5฿1,000 – ฿20,000มีสินค้าล้างทั้งหมด');
    expect(chips).toContain('aria-label="ลบตัวกรอง ฿1,000 – ฿20,000"');
    expect(chips).toContain('href="/th/product?category=playstation-5&in_stock=1&sort=price_asc"');
    expect(chips).toContain('href="/th/product?min=1000&max=20000&in_stock=1&sort=price_asc"');
    expect(chips).toMatch(/href="\/th\/product\?sort=price_asc"[^>]*>ล้างทั้งหมด</);
    expect(render(listing())).not.toContain('ล้างทั้งหมด');
  });

  it('keeps the filters in the pagination links', () => {
    const html = decode(render(listing({ category: 'playstation-5', inStock: true, view: 'list' }, { page: 2 })));
    const pages = between(html, `aria-label="${th.shop.news.pagination.label}"`, '</nav>');
    expect(pages).toContain('href="/th/product?category=playstation-5&in_stock=1&view=list"');
    expect(pages).toContain('href="/th/product?category=playstation-5&in_stock=1&view=list&page=3"');
    expect(pages).toContain('href="/th/product?category=playstation-5&in_stock=1&view=list&page=11"');
  });

  it('renders the same cards side by side in the list view', () => {
    const grid = render(listing());
    const list = render(listing({ view: 'list' }));
    expect(grid).toMatch(/data-view="grid" class="[^"]*lg:grid-cols-4/);
    expect(list).toMatch(/data-view="list" class="grid grid-cols-1/);
    expect(list.match(/<article class="[^"]*flex-row/g)).toHaveLength(2);
    expect(grid).not.toMatch(/<article class="[^"]*flex-row/);
    expect(list).toMatch(/aria-label="มุมมองรายการ" aria-pressed="true"/);
  });

  it('says so with ล้างทั้งหมด when nothing matches, instead of a blank grid', () => {
    const html = decode(render(listing({ kit: true, minBaht: 1 }, { cards: [], total: 0, totalPages: 1 })));
    expect(text(html)).toContain(th.shop.listing.empty);
    expect(html).toMatch(/href="\/th\/product"[^>]*>ล้างทั้งหมด</);
    expect(html).not.toContain('data-view=');
  });

  it('groups the filters as open details, the checkbox groups labelled by their summary', () => {
    const side = sidebar(render(listing()));
    expect(side.match(/<details open=""/g)).toHaveLength(4);
    expect(side.match(/<summary[^>]*>.*?<\/summary>/g)?.map(text)).toEqual(['หมวดหมู่', 'สถานะสินค้า', 'ประเภทสินค้า', 'ช่วงราคา (บาท)']);
    expect(side.match(/role="group" aria-labelledby="filter-(status|types)"/g)).toHaveLength(2);
  });

  it('has the ตัวกรอง button for narrow screens, controlling the closed filter sheet', () => {
    const html = render(listing());
    expect(html).toMatch(/<button type="button" aria-expanded="false" aria-controls="listing-filters" aria-haspopup="dialog"/);
    // Closed: hidden below lg, no dialog role, a complementary region from lg.
    expect(html).toMatch(/<div id="listing-filters" tabindex="-1" role="complementary" aria-label="ตัวกรองสินค้า" class="hidden [^"]*lg:block/);
    expect(html).not.toContain('role="dialog"');
    expect(html).toContain(`aria-label="${th.shop.listing.filters.close}"`);
    expect(text(html)).toContain('แสดง 248 รายการ');
  });

  it('the presets link to max=1999, min=2000&max=9999 and min=10000', () => {
    expect(PRICE_PRESETS.map(({ minBaht, maxBaht }) => [minBaht, maxBaht])).toEqual([
      [null, 1999],
      [2000, 9999],
      [10000, null],
    ]);
    const side = sidebar(decode(render(listing())));
    expect(side).toMatch(/href="\/th\/product\?max=1999"[^>]*>ต่ำกว่า ฿2,000</);
    expect(side).toMatch(/href="\/th\/product\?min=2000&max=9999"[^>]*>฿2,000–10,000</);
    expect(side).toMatch(/href="\/th\/product\?min=10000"[^>]*>มากกว่า ฿10,000</);
    expect(side).not.toContain('max=999"');
    const current = sidebar(decode(render(listing({ minBaht: 2000, maxBaht: 9999 }))));
    expect(current).toMatch(/aria-current="true"[^>]*>฿2,000–10,000</);
  });

  it("the toolbar says แสดง 1–24 จาก N รายการ, and the last page's range ends at N", () => {
    expect(text(render(listing()))).toContain('แสดง 1–24 จาก 248 รายการ');
    expect(text(render(listing({}, { page: 11 })))).toContain('แสดง 241–248 จาก 248 รายการ');
    expect(text(render(listing({}, { page: 2 }), 'en'))).toContain('Showing 25–48 of 248 items');
  });

  it('the head shows the description with the count', () => {
    expect(text(render(listing()))).toContain('เครื่องเกม แผ่นเกม จอย และอุปกรณ์เสริมทุกแพลตฟอร์ม · 248 รายการ');
    expect(text(render(listing({ category: 'playstation-5' })))).toContain('สำหรับ PlayStation 5 · 248 รายการ');
  });

  it('the type tiles carry their counts', () => {
    const strip = tabs(render(listing({ category: 'playstation-5' })));
    expect(strip.match(/<small[^>]*>[^<]*<\/small>/g)?.map(text)).toEqual([
      '248 รายการ',
      '18 รายการ',
      '142 รายการ',
      '27 รายการ',
      '49 รายการ',
      '12 รายการ',
    ]);
    // The art follows the active platform's tone.
    expect(strip).toContain('#D8E6FA');
    expect(tabs(render(listing({ category: 'nintendo-switch' })))).toContain('#F8D9DF');
  });

  it('shows a count on ทั้งหมด only while it is the active tile (D-223)', () => {
    const all = (html: string) => text(tabs(html)).startsWith('ทั้งหมด248 รายการ');
    expect(all(render(listing()))).toBe(true);
    expect(all(render(listing({ types: ['playstation-5-game'] })))).toBe(false);
    expect(all(render(listing({ kit: true })))).toBe(false);
  });

  it('the active-filter chip carries no conflicting size utilities', () => {
    const html = render(listing({ inStock: true }));
    const chip = html.match(/<a [^>]*data-active-filter=""[^>]*>/)?.[0] ?? '';
    expect(chip).toContain('min-h-11');
    expect(chip).toContain('px-3');
    expect(chip).toContain('sm:min-h-9');
    expect(chip).not.toMatch(/px-4|text-\[14\.5px\]|sm:min-h-10/);
  });

  it('renders in English from the same keys', () => {
    const html = render(listing({ category: 'playstation-5' }), 'en');
    expect(text(html)).toContain('Showing 1–24 of 248 items');
    expect(text(html)).toContain('Consoles, Games, Controllers, and Accessories for PlayStation 5 · 248 items');
    expect(html).toContain('href="/en/product?category=playstation-5&amp;kit=1"');
  });
});

describe('listingNav', () => {
  it('marks the nav entry the filters match', () => {
    expect(listingNav({ ...DEFAULT_LISTING, category: 'playstation-5' })).toBe('ps5');
    expect(listingNav({ ...DEFAULT_LISTING, preOrder: true })).toBe('preOrder');
    expect(listingNav({ ...DEFAULT_LISTING, kit: true })).toBe('bundles');
    expect(listingNav(DEFAULT_LISTING)).toBeUndefined();
  });
});

describe('parseBahtInput', () => {
  it('reads whole baht and drops anything else', () => {
    expect(parseBahtInput(' 1500 ')).toBe(1500);
    for (const value of ['', 'abc', '-5', '1.5', '1e3']) expect(parseBahtInput(value)).toBeNull();
  });
});
