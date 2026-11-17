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

describe('saveRolePermissionsCommand (the whole grid at once, D-262)', () => {
  /** A grid form: each role listed under `roleKey`, its ticked keys under `keys.{roleKey}`. */
  function grid(roles: Record<string, string[]>, extra: [string, string][] = []): FormData {
    const entries: [string, string][] = [];
    for (const [roleKey, keys] of Object.entries(roles)) {
      entries.push(['roleKey', roleKey]);
      for (const key of keys) entries.push([`keys.${roleKey}`, key]);
    }
    return form([...entries, ...extra]);
  }

  it('refuses an actor without role.manage', async () => {
    const d = deps();
    const actor = { id: 'a', permissions: ['account.manage'] as PermissionKey[] };
    expect(await saveRolePermissionsCommand(d, actor, grid({ blogger: [] }))).toEqual({ status: 'error', errorKey: 'forbidden' });
    expect(d.replaceRolePermissions).not.toHaveBeenCalled();
  });

  it('refuses an unknown permission key in any role before anything is saved', async () => {
    const d = deps();
    const result = await saveRolePermissionsCommand(d, superAdmin, grid({ blogger: ['news.manage'], admin: ['news.manage', 'order.refund'] }));
    expect(result).toEqual({ status: 'error', errorKey: 'invalid' });
    expect(d.replaceRolePermissions).not.toHaveBeenCalled();
  });

  it('refuses an unknown role key, a repeated role, no role at all, and keys for a role the save does not list', async () => {
    const d = deps();
    expect(await saveRolePermissionsCommand(d, superAdmin, grid({ blogger: [], owner: [] }))).toEqual({ status: 'error', errorKey: 'invalid' });
    expect(await saveRolePermissionsCommand(d, superAdmin, form([['roleKey', 'blogger'], ['roleKey', 'blogger']]))).toEqual({
      status: 'error',
      errorKey: 'invalid',
    });
    expect(await saveRolePermissionsCommand(d, superAdmin, form([]))).toEqual({ status: 'error', errorKey: 'invalid' });
    expect(await saveRolePermissionsCommand(d, superAdmin, grid({ blogger: [] }, [['keys.admin', 'news.manage']]))).toEqual({
      status: 'error',
      errorKey: 'invalid',
    });
    expect(await saveRolePermissionsCommand(d, superAdmin, grid({ blogger: [] }, [['keys.owner', 'news.manage']]))).toEqual({
      status: 'error',
      errorKey: 'invalid',
    });
    expect(d.replaceRolePermissions).not.toHaveBeenCalled();
  });

  it('refuses the per-role form of a page loaded before D-262, rather than emptying the role', async () => {
    const d = deps();
    const stale = form([['roleKey', 'blogger'], ['keys', 'backoffice.enter'], ['keys', 'news.manage']]);
    expect(await saveRolePermissionsCommand(d, superAdmin, stale)).toEqual({ status: 'error', errorKey: 'invalid' });
    expect(d.replaceRolePermissions).not.toHaveBeenCalled();
  });

  it('returns superAdminLocked when the Top-level Admin would lose a key, and saves no other role either', async () => {
    const d = deps();
    const result = await saveRolePermissionsCommand(d, superAdmin, grid({ blogger: ['backoffice.enter'], super_admin: ['news.manage'] }));
    expect(result).toEqual({ status: 'error', errorKey: 'superAdminLocked' });
    expect(d.replaceRolePermissions).not.toHaveBeenCalled();
  });

  it('never writes the Top-level Admin, even when it is listed with every key', async () => {
    const d = deps();
    const every = ['backoffice.enter', 'news.manage', 'account.manage', 'role.manage'];
    expect(await saveRolePermissionsCommand(d, superAdmin, grid({ super_admin: every, blogger: ['backoffice.enter'] }))).toEqual({ status: 'ok' });
    expect(d.replaceRolePermissions).toHaveBeenCalledWith([{ roleKey: 'blogger', permissionKeys: ['backoffice.enter'] }]);
  });

  it('returns backOfficeKeyForCustomer for a back-office key given to customer or guest, and saves no other role', async () => {
    const d = deps();
    for (const roleKey of ['customer', 'guest']) {
      expect(await saveRolePermissionsCommand(d, superAdmin, grid({ admin: [], [roleKey]: ['news.manage'] }))).toEqual({
        status: 'error',
        errorKey: 'backOfficeKeyForCustomer',
      });
    }
    expect(d.replaceRolePermissions).not.toHaveBeenCalled();
  });

  it('saves every listed role in one call, keys deduplicated and in key order, roles in role order', async () => {
    const d = deps();
    const result = await saveRolePermissionsCommand(
      d,
      superAdmin,
      grid({
        admin: ['news.manage', 'backoffice.enter'],
        sale_manager: ['backoffice.enter', 'news.manage', 'news.manage'],
        blogger: [],
      }),
    );
    expect(result).toEqual({ status: 'ok' });
    expect(d.replaceRolePermissions).toHaveBeenCalledTimes(1);
    expect(d.replaceRolePermissions).toHaveBeenCalledWith([
      { roleKey: 'blogger', permissionKeys: [] },
      { roleKey: 'sale_manager', permissionKeys: ['backoffice.enter', 'news.manage'] },
      { roleKey: 'admin', permissionKeys: ['backoffice.enter', 'news.manage'] },
    ]);
  });

  it('logs the old and new keys of each role whose set changed, and nothing for an unchanged one', async () => {
    const d = deps();
    await saveRolePermissionsCommand(d, superAdmin, grid({ blogger: [], sale_manager: ['backoffice.enter', 'news.manage'], admin: ['backoffice.enter', 'news.manage'] }));
    expect(d.log).toHaveBeenCalledTimes(2);
    expect(d.log).toHaveBeenCalledWith('role.permissions_changed', {
      actor: 'actor-1',
      role: 'blogger',
      from: ['backoffice.enter', 'news.manage'],
      to: [],
    });
    expect(d.log).toHaveBeenCalledWith('role.permissions_changed', {
      actor: 'actor-1',
      role: 'sale_manager',
      from: ['backoffice.enter'],
      to: ['backoffice.enter', 'news.manage'],
    });
  });

  it('logs nothing when the repository throws', async () => {
    const d = deps({ replaceRolePermissions: vi.fn(async () => Promise.reject(new Error('db down'))) });
    await expect(saveRolePermissionsCommand(d, superAdmin, grid({ blogger: [] }))).rejects.toThrow('db down');
    expect(d.log).not.toHaveBeenCalled();
  });
});
