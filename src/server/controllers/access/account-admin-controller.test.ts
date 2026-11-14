import { describe, expect, it, vi } from 'vitest';

import {
  changeAccountRoleCommand,
  saveRolePermissionsCommand,
  setAccountBlockedCommand,
  type AccountAdminDeps,
} from './account-admin-controller';
import type { PermissionKey } from '@/server/services/access/permission-keys';

const ID = '0b8f6c1e-5d2a-4c3b-9e4f-1a2b3c4d5e6f';

const superAdmin = { id: 'actor-1', permissions: ['backoffice.enter', 'account.manage', 'role.manage'] as PermissionKey[] };
const staffOnly = { id: 'actor-2', permissions: ['backoffice.enter'] as PermissionKey[] };

function deps(overrides: Partial<AccountAdminDeps> = {}): AccountAdminDeps {
  return {
    findAccount: vi.fn(async () => ({ roleKey: 'customer' as const, blocked: false })),
    changeAccountRole: vi.fn(async () => 'changed' as const),
    setAccountBlocked: vi.fn(async () => 'changed' as const),
    listRoleGrants: vi.fn(async () => ({
      guest: [],
      customer: [],
      blogger: ['backoffice.enter', 'news.manage'],
      sale_manager: ['backoffice.enter'],
      admin: ['backoffice.enter', 'news.manage'],
      super_admin: ['backoffice.enter', 'news.manage', 'account.manage', 'role.manage'],
    })) as AccountAdminDeps['listRoleGrants'],
    replaceRolePermissions: vi.fn(async () => {}),
    log: vi.fn(),
    ...overrides,
  };
}

function form(entries: [string, string][]): FormData {
  const data = new FormData();
  for (const [name, value] of entries) data.append(name, value);
  return data;
}

describe('changeAccountRoleCommand', () => {
  it('refuses an actor without account.manage and changes nothing', async () => {
    const d = deps();
    const result = await changeAccountRoleCommand(d, staffOnly, form([['accountId', ID], ['roleKey', 'admin']]));
    expect(result).toEqual({ status: 'error', errorKey: 'forbidden' });
    expect(d.changeAccountRole).not.toHaveBeenCalled();
  });

  it('refuses guest as a role', async () => {
    const d = deps();
    const result = await changeAccountRoleCommand(d, superAdmin, form([['accountId', ID], ['roleKey', 'guest']]));
    expect(result).toEqual({ status: 'error', errorKey: 'invalid' });
    expect(d.changeAccountRole).not.toHaveBeenCalled();
  });

  it('refuses an accountId that is not a uuid before the repository is reached', async () => {
    const d = deps();
    const result = await changeAccountRoleCommand(d, superAdmin, form([['accountId', 'not-a-uuid'], ['roleKey', 'admin']]));
    expect(result).toEqual({ status: 'error', errorKey: 'invalid' });
    expect(d.findAccount).not.toHaveBeenCalled();
    expect(d.changeAccountRole).not.toHaveBeenCalled();
  });

  it('changes the role and logs ids and keys only', async () => {
    const d = deps();
    const result = await changeAccountRoleCommand(d, superAdmin, form([['accountId', ID], ['roleKey', 'admin']]));
    expect(result).toEqual({ status: 'ok' });
    expect(d.changeAccountRole).toHaveBeenCalledWith(ID, 'admin');
    expect(d.log).toHaveBeenCalledWith('account.role_changed', { actor: 'actor-1', account: ID, from: 'customer', to: 'admin' });
  });

  it.each([
    ['last_super_admin', 'lastSuperAdmin'],
    ['unknown_account', 'unknownAccount'],
  ] as const)('maps %s to the message key %s', async (repoResult, key) => {
    const d = deps({ changeAccountRole: vi.fn(async () => repoResult) });
    const result = await changeAccountRoleCommand(d, superAdmin, form([['accountId', ID], ['roleKey', 'customer']]));
    expect(result).toEqual({ status: 'error', errorKey: key });
    expect(d.log).not.toHaveBeenCalled();
  });

  it('treats an unchanged role as success without logging a change', async () => {
    const d = deps({ changeAccountRole: vi.fn(async () => 'unchanged' as const) });
    expect(await changeAccountRoleCommand(d, superAdmin, form([['accountId', ID], ['roleKey', 'customer']]))).toEqual({ status: 'ok' });
    expect(d.log).not.toHaveBeenCalled();
  });
});

describe('setAccountBlockedCommand', () => {
  it('refuses an actor without account.manage', async () => {
    const d = deps();
    expect(await setAccountBlockedCommand(d, staffOnly, form([['accountId', ID], ['blocked', 'true']]))).toEqual({
      status: 'error',
      errorKey: 'forbidden',
    });
    expect(d.setAccountBlocked).not.toHaveBeenCalled();
  });

  it('refuses a non-uuid accountId and a blocked value that is not true or false', async () => {
    const d = deps();
    expect(await setAccountBlockedCommand(d, superAdmin, form([['accountId', '12'], ['blocked', 'true']]))).toEqual({ status: 'error', errorKey: 'invalid' });
    expect(await setAccountBlockedCommand(d, superAdmin, form([['accountId', ID], ['blocked', 'maybe']]))).toEqual({ status: 'error', errorKey: 'invalid' });
    expect(d.setAccountBlocked).not.toHaveBeenCalled();
  });

  it('blocks and logs the old and new value', async () => {
    const d = deps();
    expect(await setAccountBlockedCommand(d, superAdmin, form([['accountId', ID], ['blocked', 'true']]))).toEqual({ status: 'ok' });
    expect(d.setAccountBlocked).toHaveBeenCalledWith(ID, true);
    expect(d.log).toHaveBeenCalledWith('account.blocked_changed', { actor: 'actor-1', account: ID, from: false, to: true });
  });

  it('maps the last-admin refusal to its message key', async () => {
    const d = deps({ setAccountBlocked: vi.fn(async () => 'last_super_admin' as const) });
    expect(await setAccountBlockedCommand(d, superAdmin, form([['accountId', ID], ['blocked', 'true']]))).toEqual({
      status: 'error',
      errorKey: 'lastSuperAdmin',
    });
  });
});

describe('saveRolePermissionsCommand', () => {
  it('refuses an actor without role.manage', async () => {
    const d = deps();
    const actor = { id: 'a', permissions: ['account.manage'] as PermissionKey[] };
    expect(await saveRolePermissionsCommand(d, actor, form([['roleKey', 'blogger']]))).toEqual({ status: 'error', errorKey: 'forbidden' });
    expect(d.replaceRolePermissions).not.toHaveBeenCalled();
  });

  it('refuses an unknown permission key before anything is saved', async () => {
    const d = deps();
    const result = await saveRolePermissionsCommand(d, superAdmin, form([['roleKey', 'blogger'], ['keys', 'news.manage'], ['keys', 'order.refund']]));
    expect(result).toEqual({ status: 'error', errorKey: 'invalid' });
    expect(d.replaceRolePermissions).not.toHaveBeenCalled();
  });

  it('refuses an unknown role key', async () => {
    const d = deps();
    expect(await saveRolePermissionsCommand(d, superAdmin, form([['roleKey', 'owner']]))).toEqual({ status: 'error', errorKey: 'invalid' });
  });

  it('returns superAdminLocked when the Top-level Admin would lose a key', async () => {
    const d = deps();
    const result = await saveRolePermissionsCommand(d, superAdmin, form([['roleKey', 'super_admin'], ['keys', 'news.manage']]));
    expect(result).toEqual({ status: 'error', errorKey: 'superAdminLocked' });
    expect(d.replaceRolePermissions).not.toHaveBeenCalled();
  });

  it('returns backOfficeKeyForCustomer for a back-office key given to customer or guest', async () => {
    const d = deps();
    for (const roleKey of ['customer', 'guest']) {
      expect(await saveRolePermissionsCommand(d, superAdmin, form([['roleKey', roleKey], ['keys', 'news.manage']]))).toEqual({
        status: 'error',
        errorKey: 'backOfficeKeyForCustomer',
      });
    }
    expect(d.replaceRolePermissions).not.toHaveBeenCalled();
  });

  it('saves the keys (deduplicated) and logs the old and new keys', async () => {
    const d = deps();
    const result = await saveRolePermissionsCommand(d, superAdmin, form([['roleKey', 'sale_manager'], ['keys', 'backoffice.enter'], ['keys', 'news.manage'], ['keys', 'news.manage']]));
    expect(result).toEqual({ status: 'ok' });
    expect(d.replaceRolePermissions).toHaveBeenCalledWith('sale_manager', ['backoffice.enter', 'news.manage']);
    expect(d.log).toHaveBeenCalledWith('role.permissions_changed', {
      actor: 'actor-1',
      role: 'sale_manager',
      from: ['backoffice.enter'],
      to: ['backoffice.enter', 'news.manage'],
    });
  });

  it('saves an empty set when no key is ticked', async () => {
    const d = deps();
    expect(await saveRolePermissionsCommand(d, superAdmin, form([['roleKey', 'blogger']]))).toEqual({ status: 'ok' });
    expect(d.replaceRolePermissions).toHaveBeenCalledWith('blogger', []);
  });
});
