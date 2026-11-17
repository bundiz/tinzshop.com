// @vitest-environment jsdom
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '@/components/ui/Toast';
import type { AccountAdminState } from '@/server/controllers/access/account-admin-controller';
import type { PermissionKey, RoleKey } from '@/server/services/access/permission-keys';
import th from '../../../../../../../messages/th.json';
import RolePermissionGrid from './RolePermissionGrid';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Action = (previous: AccountAdminState, formData: FormData) => Promise<AccountAdminState>;

const grants: Record<RoleKey, PermissionKey[]> = {
  guest: [],
  customer: [],
  blogger: ['backoffice.enter', 'news.manage'],
  sale_manager: ['backoffice.enter'],
  admin: ['backoffice.enter', 'news.manage'],
  super_admin: ['backoffice.enter', 'news.manage', 'account.manage', 'role.manage'],
};

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
});

function render(action: Action) {
  act(() =>
    root.render(
      <NextIntlClientProvider locale="th" messages={th} timeZone="Asia/Bangkok">
        <ToastProvider closeLabel="ปิด">
          <RolePermissionGrid locale="th" grants={grants} action={action} />
        </ToastProvider>
      </NextIntlClientProvider>,
    ),
  );
}

const saveButton = () => [...container.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'บันทึก')!;
const cell = (permission: string, role: string) =>
  container.querySelector<HTMLInputElement>(`input[type="checkbox"][aria-label="${permission} — ${role}"]`)!;
const liveRegion = () => document.querySelector<HTMLElement>('[role="status"][aria-live="polite"]')!;

describe('RolePermissionGrid, one save for the whole grid (D-262)', () => {
  it('has one form and one บันทึก button, and no per-role save', () => {
    render(vi.fn<Action>(async () => ({ status: 'ok' })));
    expect(container.querySelectorAll('form')).toHaveLength(1);
    expect(container.querySelectorAll('button')).toHaveLength(1);
    expect(saveButton().type).toBe('submit');
    expect(container.textContent).not.toContain('บันทึกสิทธิ์');
  });

  it("posts every editable role's ticked keys in one call, an emptied role included", async () => {
    const action = vi.fn<Action>(async () => ({ status: 'ok' }));
    render(action);
    const news = th.admin.permission.news.manage;
    const enter = th.admin.permission.backoffice.enter;
    act(() => cell(news, th.admin.role.blogger).click());
    act(() => cell(enter, th.admin.role.blogger).click());
    act(() => cell(news, th.admin.role.sale_manager).click());
    await act(async () => saveButton().click());

    expect(action).toHaveBeenCalledTimes(1);
    const data = action.mock.calls[0]![1];
    expect(data.get('locale')).toBe('th');
    expect(data.getAll('roleKey')).toEqual(['blogger', 'sale_manager', 'admin']);
    expect(data.getAll('keys.blogger')).toEqual([]);
    expect(data.getAll('keys.sale_manager')).toEqual(['backoffice.enter', 'news.manage']);
    expect(data.getAll('keys.admin')).toEqual(['backoffice.enter', 'news.manage']);
    // Locked columns post nothing: the server never writes them.
    for (const role of ['super_admin', 'customer', 'guest']) expect(data.getAll(`keys.${role}`)).toEqual([]);
  });

  it('shows the success toast on a saved grid, and no inline line', async () => {
    render(vi.fn<Action>(async () => ({ status: 'ok' })));
    await act(async () => saveButton().click());
    expect(liveRegion().textContent).toContain('บันทึกการตั้งค่าเรียบร้อยแล้ว');
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows a refusal inline by the button, and no toast', async () => {
    render(vi.fn<Action>(async () => ({ status: 'error', errorKey: 'superAdminLocked' })));
    await act(async () => saveButton().click());
    const alert = container.querySelector('[role="alert"]');
    expect(alert?.textContent).toBe(th.admin.error.superAdminLocked);
    expect(alert?.parentElement).toBe(saveButton().parentElement);
    expect(liveRegion().textContent).toBe('');
  });

  it('disables บันทึก while the save runs', async () => {
    let finish: (state: AccountAdminState) => void = () => {};
    render(vi.fn<Action>(() => new Promise((resolve) => (finish = resolve))));
    await act(async () => saveButton().click());
    expect(saveButton().disabled).toBe(true);
    await act(async () => finish({ status: 'ok' }));
    expect(saveButton().disabled).toBe(false);
  });
});
