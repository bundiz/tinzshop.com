// @vitest-environment jsdom
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccountAdminState } from '@/server/controllers/access/account-admin-controller';
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

describe('AccountTable role picker (D-258)', () => {
  it('offers every role but guest in the themed list, and posts the chosen role under roleKey', async () => {
    const changeRole = vi.fn(async (_previous: AccountAdminState, _formData: FormData): Promise<AccountAdminState> => ({ status: 'ok' }));
    const setBlocked = vi.fn(async (): Promise<AccountAdminState> => ({ status: 'ok' }));
    act(() =>
      root.render(
        <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Bangkok">
          <AccountTable locale="en" rows={[row]} permissions={['account.manage']} actions={{ changeRole, setBlocked }} />
        </NextIntlClientProvider>,
      ),
    );
    const trigger = container.querySelector<HTMLButtonElement>('[role="combobox"]')!;
    expect(container.querySelector('select')).toBeNull();
    expect(trigger.getAttribute('aria-label')).toBe('Role of Somchai');

    act(() => trigger.click());
    const labels = [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent);
    expect(labels).toEqual(['Customer', 'Blogger', 'Sale manager', 'Admin', 'Top-level Admin']);

    act(() => (document.querySelectorAll<HTMLElement>('[role="option"]')[3]!).click());
    await act(async () => container.querySelector<HTMLButtonElement>('form button[type="submit"]')!.click());
    expect(changeRole).toHaveBeenCalledTimes(1);
    const data = changeRole.mock.calls[0]![1];
    expect(data.get('roleKey')).toBe('admin');
    expect(data.get('accountId')).toBe(row.id);
  });
});
