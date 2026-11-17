// @vitest-environment jsdom
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccountAdminState } from '@/server/controllers/access/account-admin-controller';
import type { PermissionKey } from '@/server/services/access/permission-keys';
import en from '../../../../../../../messages/en.json';
import AccountTable, { type AccountTableRow } from './AccountTable';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const row: AccountTableRow = {
  id: '0b8f6c1e-5d2a-4c3b-9e4f-1a2b3c4d5e6f',
  email: 'somchai@example.com',
  firstName: 'Somchai',
  lastName: null,
  roleKey: 'blogger',
  blocked: false,
  createdAt: '2026-11-01T03:00:00.000Z',
};

type Action = (previous: AccountAdminState, formData: FormData) => Promise<AccountAdminState>;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.style.overflow = '';
});

function render({
  rows = [row],
  permissions = ['account.manage'],
  changeRole = vi.fn<Action>(async () => ({ status: 'ok' })),
  setBlocked = vi.fn<Action>(async () => ({ status: 'ok' })),
}: { rows?: AccountTableRow[]; permissions?: PermissionKey[]; changeRole?: Action; setBlocked?: Action } = {}) {
  act(() =>
    root.render(
      <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Bangkok">
        <AccountTable locale="en" rows={rows} permissions={permissions} actions={{ changeRole, setBlocked }} />
      </NextIntlClientProvider>,
    ),
  );
}

const menuButton = (name = 'Somchai') => container.querySelector<HTMLButtonElement>(`button[aria-label="Manage ${name}"]`)!;
const menuItems = () => [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')];
const choose = (label: string) => {
  act(() => menuButton().click());
  act(() => menuItems().find((item) => item.textContent === label)!.click());
};
const drawer = () => document.querySelector<HTMLElement>('[role="dialog"]');
const confirmDialog = () => document.querySelector<HTMLElement>('[role="alertdialog"]');
const buttonIn = (panel: HTMLElement, text: string) => [...panel.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === text)!;

describe('AccountTable row menu (D-261)', () => {
  it('offers Edit and Block on an active account, Edit and Unblock on a blocked one', () => {
    render({ rows: [row, { ...row, id: 'b', firstName: 'Nok', blocked: true }] });
    act(() => menuButton().click());
    expect(menuItems().map((item) => item.textContent)).toEqual(['Edit', 'Block']);
    expect(menuItems()[1]!.className).toContain('text-sale');
    act(() => menuButton().click());
    act(() => menuButton('Nok').click());
    expect(menuItems().map((item) => item.textContent)).toEqual(['Edit', 'Unblock']);
    expect(menuItems()[1]!.className).not.toContain('text-sale');
  });

  it('shows no menu without account.manage', () => {
    render({ permissions: ['backoffice.enter'] });
    expect(container.querySelector('[aria-haspopup="menu"]')).toBeNull();
    expect(container.textContent).toContain('Blogger');
  });
});

describe('AccountTable edit drawer (D-261)', () => {
  it('shows the account read-only and the role as a labelled Select, and posts the chosen role under roleKey', async () => {
    const changeRole = vi.fn<Action>(async () => ({ status: 'ok' }));
    render({ changeRole });
    choose('Edit');
    const panel = drawer()!;
    expect(panel.getAttribute('aria-labelledby')).not.toBeNull();
    expect(document.getElementById(panel.getAttribute('aria-labelledby')!)!.textContent).toBe('Edit user');
    expect(panel.textContent).toContain('Somchai');
    expect(panel.textContent).toContain('somchai@example.com');
    expect(panel.textContent).toContain('Active');
    expect(panel.textContent).toContain('Nov 1, 2026');
    expect(panel.querySelectorAll('input:not([type="hidden"])')).toHaveLength(0);

    const select = panel.querySelector<HTMLButtonElement>('[role="combobox"]')!;
    expect(select.labels?.[0]?.textContent).toBe('Role');
    act(() => select.click());
    const labels = [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent);
    expect(labels).toEqual(['Customer', 'Blogger', 'Sale manager', 'Admin', 'Top-level Admin']);
    act(() => document.querySelectorAll<HTMLElement>('[role="option"]')[3]!.click());

    await act(async () => buttonIn(panel, 'Save').click());
    expect(changeRole).toHaveBeenCalledTimes(1);
    const data = changeRole.mock.calls[0]![1];
    expect(data.get('roleKey')).toBe('admin');
    expect(data.get('accountId')).toBe(row.id);
    expect(data.get('locale')).toBe('en');
    // Saved: the drawer closes and focus is back on the row's menu button.
    expect(drawer()).toBeNull();
    expect(document.activeElement).toBe(menuButton());
  });

  it('keeps a refused change open with the reason inside the drawer, and cancel closes it', async () => {
    const changeRole = vi.fn<Action>(async () => ({ status: 'error', errorKey: 'lastSuperAdmin' }));
    render({ rows: [{ ...row, roleKey: 'super_admin' }], changeRole });
    choose('Edit');
    await act(async () => buttonIn(drawer()!, 'Save').click());
    const alert = drawer()!.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('at least one Top-level Admin');
    act(() => buttonIn(drawer()!, 'Cancel').click());
    expect(drawer()).toBeNull();
    // Opened again, the old refusal is gone.
    choose('Edit');
    expect(drawer()!.querySelector('[role="alert"]')).toBeNull();
  });

  it('disables Save while the change runs', async () => {
    let finish: (state: AccountAdminState) => void = () => {};
    const changeRole = vi.fn<Action>(() => new Promise((resolve) => (finish = resolve)));
    render({ changeRole });
    choose('Edit');
    await act(async () => buttonIn(drawer()!, 'Save').click());
    expect(buttonIn(drawer()!, 'Save').disabled).toBe(true);
    await act(async () => finish({ status: 'ok' }));
    expect(drawer()).toBeNull();
  });
});

describe('AccountTable block and unblock (D-261)', () => {
  it('asks to confirm a block, then posts blocked=true and closes on the result', async () => {
    const setBlocked = vi.fn<Action>(async () => ({ status: 'ok' }));
    render({ setBlocked });
    choose('Block');
    const panel = confirmDialog()!;
    expect(panel.textContent).toContain('Block this account?');
    expect(panel.textContent).toContain('Somchai will be signed out everywhere');
    expect(setBlocked).not.toHaveBeenCalled();
    await act(async () => buttonIn(panel, 'Block').click());
    expect(setBlocked).toHaveBeenCalledTimes(1);
    const data = setBlocked.mock.calls[0]![1];
    expect(data.get('blocked')).toBe('true');
    expect(data.get('accountId')).toBe(row.id);
    expect(confirmDialog()).toBeNull();
    expect(document.activeElement).toBe(menuButton());
  });

  it('asks to confirm an unblock, then posts blocked=false', async () => {
    const setBlocked = vi.fn<Action>(async () => ({ status: 'ok' }));
    render({ rows: [{ ...row, blocked: true }], setBlocked });
    choose('Unblock');
    expect(confirmDialog()!.textContent).toContain('Unblock this account?');
    await act(async () => buttonIn(confirmDialog()!, 'Unblock').click());
    expect(setBlocked.mock.calls[0]![1].get('blocked')).toBe('false');
  });

  it('cancel posts nothing; a refused block shows its reason by the row', async () => {
    const setBlocked = vi.fn<Action>(async () => ({ status: 'error', errorKey: 'lastSuperAdmin' }));
    render({ setBlocked });
    choose('Block');
    act(() => buttonIn(confirmDialog()!, 'Cancel').click());
    expect(setBlocked).not.toHaveBeenCalled();
    choose('Block');
    await act(async () => buttonIn(confirmDialog()!, 'Block').click());
    expect(confirmDialog()).toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('at least one Top-level Admin');
  });
});
