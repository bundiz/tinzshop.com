import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { PermissionKey, RoleKey } from '@/server/services/access/permission-keys';
import en from '../../../../../../messages/en.json';
import th from '../../../../../../messages/th.json';
import AccountTable, { ErrorLine, type AccountTableRow } from './_components/AccountTable';
import RolePermissionGrid from './_components/RolePermissionGrid';

function html(node: React.ReactNode, locale: 'th' | 'en' = 'en'): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'th' ? th : en} timeZone="Asia/Bangkok">
      {node}
    </NextIntlClientProvider>,
  );
}

const row: AccountTableRow = {
  id: '0b8f6c1e-5d2a-4c3b-9e4f-1a2b3c4d5e6f',
  email: 'somchai@example.com',
  firstName: 'Somchai',
  lastName: null,
  roleKey: 'blogger',
  blocked: false,
  createdAt: '2026-11-01T03:00:00.000Z',
};

describe('AccountTable', () => {
  it('shows the role select, the block button and the action column with account.manage', () => {
    const out = html(<AccountTable locale="en" rows={[row, { ...row, id: 'x', blocked: true }]} permissions={['backoffice.enter', 'account.manage']} />);
    expect(out).toContain('<select');
    expect(out).toContain('Role of Somchai');
    expect(out).toContain('>Block<');
    expect(out).toContain('>Unblock<');
    expect(out).toContain('somchai@example.com');
  });

  it('hides the role select and the row actions without account.manage', () => {
    const out = html(<AccountTable locale="en" rows={[row]} permissions={['backoffice.enter']} />);
    expect(out).not.toContain('<select');
    expect(out).not.toContain('>Block<');
    expect(out).not.toContain('Actions');
    expect(out).toContain('Blogger');
  });

  it('offers every role but guest in the select', () => {
    const out = html(<AccountTable locale="en" rows={[row]} permissions={['account.manage']} />);
    expect(out).not.toContain('value="guest"');
    for (const key of ['customer', 'blogger', 'sale_manager', 'admin', 'super_admin']) expect(out).toContain(`value="${key}"`);
  });

  it('names the account in the block and unblock buttons', () => {
    const out = html(<AccountTable locale="en" rows={[row, { ...row, id: 'x', blocked: true }]} permissions={['account.manage']} />);
    expect(out).toContain('aria-label="Block: Somchai"');
    expect(out).toContain('aria-label="Unblock: Somchai"');
  });

  it('shows a short saved line after a successful role change, and the error key text on a refusal', () => {
    expect(html(<ErrorLine state={{ status: 'ok' }} showSaved />)).toContain('Saved');
    expect(html(<ErrorLine state={{ status: 'ok' }} />)).toBe('');
    expect(html(<ErrorLine state={{ status: 'error', errorKey: 'lastSuperAdmin' }} />)).toContain('at least one Top-level Admin');
  });

  it('shows the empty message for no rows', () => {
    expect(html(<AccountTable locale="en" rows={[]} permissions={['account.manage']} />)).toContain('No accounts match.');
  });
});

const grants: Record<RoleKey, PermissionKey[]> = {
  guest: [],
  customer: [],
  blogger: ['backoffice.enter', 'news.manage'],
  sale_manager: ['backoffice.enter'],
  admin: ['backoffice.enter', 'news.manage'],
  super_admin: ['backoffice.enter', 'news.manage', 'account.manage', 'role.manage'],
};

/** The checkbox inputs of a role's column, in the order the keys are drawn. */
function boxes(out: string, roleKey: string) {
  return [...out.matchAll(new RegExp(`<input[^>]*form="role-permissions-${roleKey}"[^>]*>`, 'g'))].map((m) => m[0]);
}

describe('RolePermissionGrid', () => {
  const out = html(<RolePermissionGrid locale="en" grants={grants} />);

  it('draws four permission rows by six role columns, with translated descriptions', () => {
    expect(out.match(/<tbody>[\s\S]*<\/tbody>/)![0].match(/<tr/g)).toHaveLength(4);
    for (const role of ['Guest', 'Customer', 'Blogger', 'Sale manager', 'Admin', 'Top-level Admin']) expect(out).toContain(role);
    expect(out).toContain('Open the back office and see its home page');
    expect(out).not.toContain('>backoffice.enter<');
  });

  it('ticks and disables every super_admin cell', () => {
    const cells = boxes(out, 'super_admin');
    expect(cells).toHaveLength(4);
    for (const cell of cells) {
      expect(cell).toContain('checked=""');
      expect(cell).toContain('disabled=""');
    }
  });

  it('disables every back-office cell for customer and guest, unticked', () => {
    for (const role of ['customer', 'guest']) {
      const cells = boxes(out, role);
      expect(cells).toHaveLength(4);
      for (const cell of cells) {
        expect(cell).toContain('disabled=""');
        expect(cell).not.toContain('checked=""');
      }
    }
  });

  it('leaves the staff roles enabled and ticked as granted', () => {
    const sale = boxes(out, 'sale_manager');
    expect(sale.map((c) => c.includes('disabled=""'))).toEqual([false, false, false, false]);
    expect(sale.map((c) => c.includes('checked=""'))).toEqual([true, false, false, false]);
    expect(boxes(out, 'blogger').map((c) => c.includes('checked=""'))).toEqual([true, true, false, false]);
  });

  it('has a save button for each editable role and none for the locked ones', () => {
    for (const role of ['blogger', 'sale_manager', 'admin']) expect(out).toContain(`form="role-permissions-${role}"`);
    expect(out.match(/<button/g)).toHaveLength(3);
  });
});
