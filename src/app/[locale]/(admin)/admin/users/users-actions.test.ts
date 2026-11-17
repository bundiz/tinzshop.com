import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  changeRole: vi.fn(async () => ({ status: 'ok' })),
  setBlocked: vi.fn(async () => ({ status: 'ok' })),
  saveRolePermissions: vi.fn(async () => ({ status: 'ok' })),
  revalidatePath: vi.fn(),
}));

vi.mock('../_lib/require-permission', () => ({ requirePermission: mocks.requirePermission }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/server/composition-root', () => ({
  getAccountAdmin: () => ({
    changeRole: mocks.changeRole,
    setBlocked: mocks.setBlocked,
    saveRolePermissions: mocks.saveRolePermissions,
  }),
}));

const { changeAccountRoleAction, saveRolePermissionsAction, setAccountBlockedAction } = await import('./actions');

const idle = { status: 'idle' } as const;
const ACTOR = { id: 'actor-1', permissions: ['account.manage', 'role.manage'] };

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) data.append(name, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePermission.mockResolvedValue(ACTOR);
});

describe('the accounts and roles Server Actions', () => {
  it.each([
    ['changeAccountRoleAction', changeAccountRoleAction, 'account.manage', mocks.changeRole],
    ['setAccountBlockedAction', setAccountBlockedAction, 'account.manage', mocks.setBlocked],
    ['saveRolePermissionsAction', saveRolePermissionsAction, 'role.manage', mocks.saveRolePermissions],
  ] as const)('%s checks %s on the server and stops when it is refused', async (_name, action, key, command) => {
    mocks.requirePermission.mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(action(idle, form({ locale: 'en' }))).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.requirePermission).toHaveBeenCalledWith('en', expect.stringContaining('/admin/users'), key);
    expect(command).not.toHaveBeenCalled();
  });

  it('passes the signed-in actor and the form to the controller, and revalidates after a change', async () => {
    const data = form({ locale: 'en', accountId: 'a', roleKey: 'admin' });
    expect(await changeAccountRoleAction(idle, data)).toEqual({ status: 'ok' });
    expect(mocks.changeRole).toHaveBeenCalledWith(ACTOR, data);
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/en/admin/users');
  });

  it('does not revalidate when the controller refuses, and returns its error key', async () => {
    mocks.setBlocked.mockResolvedValueOnce({ status: 'error', errorKey: 'lastSuperAdmin' } as never);
    expect(await setAccountBlockedAction(idle, form({ locale: 'th' }))).toEqual({ status: 'error', errorKey: 'lastSuperAdmin' });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('passes the whole grid form to the controller in one call, and revalidates after a save (D-262)', async () => {
    const data = form({ locale: 'th', roleKey: 'blogger' });
    data.append('roleKey', 'admin');
    data.append('keys.admin', 'news.manage');
    expect(await saveRolePermissionsAction(idle, data)).toEqual({ status: 'ok' });
    expect(mocks.saveRolePermissions).toHaveBeenCalledTimes(1);
    expect(mocks.saveRolePermissions).toHaveBeenCalledWith(ACTOR, data);
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/th/admin/users');
  });

  it('falls back to Thai for an unknown locale field', async () => {
    await saveRolePermissionsAction(idle, form({ locale: 'xx' }));
    expect(mocks.requirePermission).toHaveBeenCalledWith('th', expect.any(String), 'role.manage');
  });
});
