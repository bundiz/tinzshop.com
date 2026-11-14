import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { PermissionKey } from '@/server/services/access/permission-keys';
import en from '../../../../../../messages/en.json';
import th from '../../../../../../messages/th.json';

vi.mock('../../../(shop)/(auth)/actions', () => ({ signOutAction: async () => {} }));

const { default: SideNav } = await import('./SideNav');

const BLOGGER: PermissionKey[] = ['backoffice.enter', 'news.manage'];
const SUPER_ADMIN: PermissionKey[] = ['backoffice.enter', 'news.manage', 'account.manage', 'role.manage'];

function html(permissions: PermissionKey[], locale: 'th' | 'en' = 'th', pathname = '/th/admin'): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'th' ? th : en} timeZone="Asia/Bangkok">
      <SideNav locale={locale} permissions={permissions} pathname={pathname} name="Tester" roleLabel="Blogger" />
    </NextIntlClientProvider>,
  );
}

describe('SideNav', () => {
  it('shows a Blogger the dashboard and news, and not users and permissions', () => {
    const markup = html(BLOGGER);
    expect(markup).toContain('แดชบอร์ด');
    expect(markup).toContain('ข่าวและบทความ');
    expect(markup).not.toContain('ผู้ใช้และสิทธิ์');
    // The "ระบบ" section heading is gone with its only item ("ออกจากระบบ" at the foot also holds the letters).
    expect(markup).not.toContain('>ระบบ<');
  });

  it('shows a Top-level Admin all three, under their sections', () => {
    const markup = html(SUPER_ADMIN);
    for (const text of ['ภาพรวม', 'แดชบอร์ด', 'เนื้อหา', 'ข่าวและบทความ', 'ผู้ใช้และสิทธิ์']) expect(markup).toContain(text);
    expect(markup).toContain('>ระบบ<');
  });

  it('shows a Sale-manager the dashboard only', () => {
    const markup = html(['backoffice.enter']);
    expect(markup).toContain('แดชบอร์ด');
    expect(markup).not.toContain('ข่าวและบทความ');
    expect(markup).not.toContain('เนื้อหา');
  });

  it('links each item under the locale, and marks the current one', () => {
    const markup = html(SUPER_ADMIN, 'en', '/en/admin/news');
    expect(markup).toContain('href="/en/admin"');
    expect(markup).toContain('href="/en/admin/news"');
    expect(markup).toContain('href="/en/admin/users"');
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
    expect(markup).toMatch(/aria-current="page"[^>]*href="\/en\/admin\/news"|href="\/en\/admin\/news"[^>]*aria-current="page"/);
  });

  it('holds the account name, the role, the shop link and sign-out at the foot', () => {
    const markup = html(BLOGGER);
    expect(markup).toContain('Tester');
    expect(markup).toContain('Blogger');
    expect(markup).toContain('ดูหน้าร้าน');
    expect(markup).toContain('href="/th"');
    expect(markup).toContain('ออกจากระบบ');
  });
});
