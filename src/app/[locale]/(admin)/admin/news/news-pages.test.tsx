import { createTranslator, NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PermissionKey, RoleKey } from '@/server/services/access/permission-keys';
import type { CurrentCustomer } from '@/server/services/auth/customer-session-service';
import {
  type AdminArticleListRecord,
  type AdminArticleRecord,
  type NewsAdminDeps,
} from '@/server/services/news/news-admin-service';
import en from '../../../../../../messages/en.json';
import th from '../../../../../../messages/th.json';

const NOW = new Date('2026-11-14T10:00:00Z');
const ID = '44444444-4444-4444-8444-444444444444';
const CATEGORY = '22222222-2222-4222-8222-222222222222';

const request = vi.hoisted(() => ({
  customer: null as CurrentCustomer | null,
  rows: [] as unknown[],
  article: null as unknown,
}));

vi.mock('next-intl/server', () => ({
  setRequestLocale: () => {},
  getTranslations: async ({ locale, namespace }: { locale: 'th' | 'en'; namespace?: string }) =>
    createTranslator({ locale, messages: locale === 'th' ? th : en, namespace: namespace as never }),
}));
vi.mock('../../../(shop)/_components/read-current-customer', () => ({ readCurrentCustomer: async () => request.customer }));
vi.mock('../../../(shop)/_components/read-articles-menu', () => ({ readArticlesMenu: async () => [] }));
vi.mock('../../../(shop)/(auth)/actions', () => ({ signOutAction: async () => {} }));
vi.mock('./actions', () => ({
  saveArticleAction: async () => ({ status: 'idle' }),
  trashArticleAction: async () => ({ status: 'idle' }),
  restoreArticleAction: async () => ({ status: 'idle' }),
  searchProductsAction: async () => [],
  createCategoryAction: async () => ({ status: 'error', errorKey: 'invalid' }),
}));
vi.mock('next/navigation', async (original) => ({
  ...(await original<object>()),
  usePathname: () => '/th/admin/news',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: () => {}, push: () => {} }),
}));
vi.mock('@/server/composition-root', async () => {
  const service = await import('@/server/services/news/news-admin-service');
  return {
    getArticleProductCardsReader: () => async () => [],
    getNewsAdmin: () => ({
      // The real service over a fake repository, so the derived status is the service's own.
      list: (input: Parameters<typeof service.listAdminArticles>[1]) =>
        service.listAdminArticles(
          {
            news: { listAdminArticles: async () => ({ total: request.rows.length, rows: request.rows }) },
            now: () => new Date('2026-11-14T10:00:00Z'),
          } as unknown as NewsAdminDeps,
          input,
        ),
      get: async () => request.article,
      categories: async () => [
        { id: CATEGORY, slug: 'reviews', parentId: null, position: 1, names: { th: 'รีวิวสินค้า', en: 'Reviews' }, isListed: true },
      ],
      productsByIds: async () => [{ id: 'p1', name: 'Nintendo Switch 2', sku: 'NS2', imageUrl: null }],
    }),
  };
});

const { default: NewsListPage } = await import('./page');
const { default: NewNewsPage } = await import('./new/page');
const { default: EditNewsPage } = await import('./[id]/page');
const previewModule = await import('../../../(admin-preview)/admin/news/preview/page');
const PreviewPage = previewModule.default;

function params(locale: string): Promise<{ locale: string }>;
function params(locale: string, id: string): Promise<{ locale: string; id: string }>;
function params(locale: string, id?: string) {
  return Promise.resolve(id === undefined ? { locale } : { locale, id });
}
const search = (value: Record<string, string> = {}) => Promise.resolve(value);

function account(roleKey: RoleKey, permissions: PermissionKey[]): CurrentCustomer {
  return { id: 'c1', firstName: 'Nok', email: 'nok@example.com', roleKey, permissions };
}
const blogger = () => account('blogger', ['backoffice.enter', 'news.manage']);

function html(node: ReactNode, locale: 'th' | 'en' = 'th'): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'th' ? th : en} timeZone="Asia/Bangkok">
      {node}
    </NextIntlClientProvider>,
  );
}

async function redirectOf(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    const digest = (error as { digest?: string }).digest ?? '';
    if (!digest.startsWith('NEXT_REDIRECT')) throw error;
    return digest.split(';')[2] ?? null;
  }
}

function listRow(overrides: Partial<AdminArticleListRecord> = {}): AdminArticleListRecord {
  return {
    id: ID,
    slug: 'a',
    status: 'published',
    publishedAt: new Date('2026-11-01T02:00:00Z'),
    titles: { th: 'ข่าวทดสอบ', en: 'Test news' },
    categoryIds: [CATEGORY],
    bylineName: 'Nok',
    lastEditorName: null,
    updatedAt: NOW,
    deletedAt: null,
    isImported: false,
    ...overrides,
  };
}

function record(overrides: Partial<AdminArticleRecord & { derivedStatus: string }> = {}) {
  return {
    id: ID,
    slug: 'a',
    status: 'draft',
    derivedStatus: 'draft',
    publishedAt: null,
    bylineName: 'Nok',
    featuredImageUrl: null,
    isImported: false,
    deletedAt: null,
    updatedAt: NOW,
    lastEditorName: null,
    th: { title: 'ข่าวทดสอบ', excerpt: 'สรุป', bodyHtml: '<p>เนื้อหา</p>' },
    en: null,
    categoryIds: [CATEGORY],
    tagNames: ['Switch'],
    productIds: ['p1'],
    ...overrides,
  };
}

beforeEach(() => {
  request.customer = blogger();
  request.rows = [];
  request.article = null;
});

describe('the news list page', () => {
  it('redirects a signed-out visitor to sign-in and a Customer to no-access', async () => {
    request.customer = null;
    expect(await redirectOf(() => NewsListPage({ params: params('th'), searchParams: search() }))).toContain('/th/sign-in');
    request.customer = account('customer', []);
    expect(await redirectOf(() => NewsListPage({ params: params('th'), searchParams: search() }))).toBe('/th/admin/no-access');
    request.customer = account('sale_manager', ['backoffice.enter']);
    expect(await redirectOf(() => NewsListPage({ params: params('th'), searchParams: search() }))).toBe('/th/admin/no-access');
  });

  it('shows the four status tabs and the trash with counts, and none of the left-out ones', async () => {
    const markup = html(await NewsListPage({ params: params('th'), searchParams: search() }));
    for (const label of ['ทั้งหมด', 'เผยแพร่แล้ว', 'ตั้งเวลา', 'ฉบับร่าง', 'ถังขยะ']) expect(markup).toContain(label);
    expect(markup).not.toContain('รอตรวจ');
    expect(markup).not.toContain('ผู้อ่าน');
  });

  it('derives "ตั้งเวลา" from a future published_at, and "เผยแพร่แล้ว" from a past one', async () => {
    request.rows = [
      listRow({ id: ID, titles: { th: 'ข่าวอนาคต' }, publishedAt: new Date('2026-12-28T02:00:00Z') }),
      listRow({ id: '55555555-5555-4555-8555-555555555555', titles: { th: 'ข่าวเก่า' }, publishedAt: new Date('2026-11-01T02:00:00Z') }),
    ];
    const markup = html(await NewsListPage({ params: params('th'), searchParams: search() }));
    const future = markup.slice(markup.indexOf('ข่าวอนาคต'), markup.indexOf('ข่าวเก่า'));
    expect(future).toContain('ตั้งเวลาไว้');
    expect(markup.slice(markup.indexOf('ข่าวเก่า'))).toContain('เผยแพร่แล้ว');
  });

  it('shows the categories, the byline, the languages present and a link to the editor', async () => {
    request.rows = [listRow()];
    const markup = html(await NewsListPage({ params: params('th'), searchParams: search() }));
    expect(markup).toContain('รีวิวสินค้า');
    expect(markup).toContain('Nok');
    expect(markup).toContain('TH');
    expect(markup).toContain('EN');
    expect(markup).toContain(`href="/th/admin/news/${ID}"`);
  });

  it('gives each row a "⋯" menu named for the article (D-261)', async () => {
    request.rows = [listRow()];
    const markup = html(await NewsListPage({ params: params('th'), searchParams: search() }));
    expect(markup).toMatch(/aria-label="จัดการ [^"]+" aria-haspopup="menu"/);
    expect(markup).toContain(`<form id="trash-${ID}"`);
  });

  it('in the trash, has no editor link and a restore form behind the row menu', async () => {
    request.rows = [listRow({ deletedAt: NOW })];
    const markup = html(await NewsListPage({ params: params('th'), searchParams: search({ status: 'trash' }) }));
    expect(markup).toContain(`<form id="restore-${ID}"`);
    expect(markup).not.toContain(`<form id="trash-${ID}"`);
    expect(markup).toContain('aria-haspopup="menu"');
    expect(markup).not.toContain(`href="/th/admin/news/${ID}"`);
  });
});

describe('the news editor pages', () => {
  it('refuses a Customer', async () => {
    request.customer = account('customer', []);
    expect(await redirectOf(async () => html(await NewNewsPage({ params: params('th') })))).toBe('/th/admin/no-access');
    request.article = record();
    expect(await redirectOf(async () => html(await EditNewsPage({ params: params('th', ID) })))).toBe('/th/admin/no-access');
  });

  it('opens a new article with the editor first name as the byline and a draft button set', async () => {
    const markup = html(await NewNewsPage({ params: params('th') }));
    expect(markup).toContain('value="Nok"');
    expect(markup).toContain('บันทึกร่าง');
    expect(markup).toContain('>เผยแพร่<');
    expect(markup).not.toContain('ยกเลิกการเผยแพร่');
    expect(markup).not.toContain('ย้ายไปถังขยะ');
  });

  it('shows no image control: no image button, no file input, no cover upload, no left-out panels', async () => {
    request.article = record();
    const markup = html(await EditNewsPage({ params: params('th', ID) }));
    expect(markup).not.toContain('type="file"');
    expect(markup).not.toContain('รูปภาพ');
    expect(markup).not.toContain('ภาพหน้าปก');
    expect(markup).not.toContain('Meta description');
    expect(markup).not.toContain('ส่งตรวจ');
    expect(markup).not.toContain('ประวัติการแก้ไข');
    expect(markup).toContain('หมวดหมู่');
    expect(markup).toContain('แท็ก');
    expect(markup).toContain('สินค้าที่เกี่ยวข้อง');
    expect(markup).toContain('Nintendo Switch 2');
  });

  it('gives a draft "บันทึกร่าง" and "เผยแพร่" and a trash button', async () => {
    request.article = record();
    const markup = html(await EditNewsPage({ params: params('th', ID) }));
    expect(markup).toContain('บันทึกร่าง');
    expect(markup).toContain('>เผยแพร่<');
    expect(markup).toContain('ย้ายไปถังขยะ');
    expect(markup).not.toContain('>อัปเดต<');
    expect(markup).not.toContain('ยกเลิกการเผยแพร่');
  });

  it.each(['published', 'scheduled'])(
    'gives a %s article "อัปเดต" and "ยกเลิกการเผยแพร่", and never "บันทึกร่าง" (R7)',
    async (derivedStatus) => {
      request.article = record({
        status: 'published',
        derivedStatus,
        publishedAt: new Date(derivedStatus === 'scheduled' ? '2026-12-28T02:00:00Z' : '2026-11-01T02:00:00Z'),
      });
      const markup = html(await EditNewsPage({ params: params('th', ID) }));
      expect(markup).toContain('>อัปเดต<');
      expect(markup).toContain('ยกเลิกการเผยแพร่');
      expect(markup).not.toContain('บันทึกร่าง');
      expect(markup).not.toContain('>เผยแพร่<');
    },
  );

  it('is not found for an unknown article, and goes to the trash list for a trashed one', async () => {
    request.article = null;
    await expect(EditNewsPage({ params: params('th', ID) })).rejects.toBeDefined();
    request.article = record({ deletedAt: NOW });
    expect(await redirectOf(() => EditNewsPage({ params: params('th', ID) }))).toBe('/th/admin/news?status=trash');
  });
});

describe('the live preview page (D-253)', () => {
  const SESSION = '99999999-9999-4999-8999-999999999999';
  const previewSearch = (session?: string) => Promise.resolve(session === undefined ? {} : { session });

  it('refuses a Customer and sends a signed-out visitor to sign-in and back to the same session', async () => {
    request.customer = account('customer', []);
    expect(await redirectOf(() => PreviewPage({ params: params('th'), searchParams: previewSearch(SESSION) }))).toBe('/th/admin/no-access');
    request.customer = null;
    const signIn = await redirectOf(() => PreviewPage({ params: params('th'), searchParams: previewSearch(SESSION) }));
    expect(signIn).toContain('/th/sign-in');
    expect(decodeURIComponent(signIn ?? '')).toContain(`/admin/news/preview?session=${SESSION}`);
  });

  it('draws the live preview for news.manage: the unsaved-preview bar, waiting for the editor', async () => {
    const markup = html(await PreviewPage({ params: params('th'), searchParams: previewSearch(SESSION) }));
    expect(markup).toContain('role="status"');
    expect(markup).toContain('กำลังรอข้อมูลจากหน้าแก้ไข');
  });

  it('says to open it from the editor when the session is missing or not a uuid', async () => {
    for (const session of [undefined, 'not-a-uuid']) {
      const markup = html(await PreviewPage({ params: params('th'), searchParams: previewSearch(session) }));
      expect(markup).toContain('เปิดหน้านี้จากปุ่ม');
      expect(markup).toContain('href="/th/admin/news"');
      expect(markup).not.toContain('กำลังรอข้อมูลจากหน้าแก้ไข');
    }
  });

  it('marks the page noindex', async () => {
    expect(await previewModule.generateMetadata({ params: params('th'), searchParams: previewSearch(SESSION) })).toMatchObject({
      robots: { index: false, follow: false },
    });
  });
});
