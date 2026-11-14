import { describe, expect, it } from 'vitest';

import { can, checkRolePermissions } from './access-service';

describe('can', () => {
  it('is false for nobody signed in', () => {
    expect(can(null, 'backoffice.enter')).toBe(false);
  });
  it('is true when the key is held and false when not', () => {
    const viewer = { permissions: ['news.manage'] as const };
    expect(can(viewer, 'news.manage')).toBe(true);
    expect(can(viewer, 'role.manage')).toBe(false);
  });
});

describe('checkRolePermissions', () => {
  it('locks super_admin to every key', () => {
    expect(checkRolePermissions('super_admin', ['backoffice.enter', 'news.manage', 'account.manage'])).toEqual({
      ok: false,
      reason: 'super_admin_locked',
    });
    expect(
      checkRolePermissions('super_admin', ['backoffice.enter', 'news.manage', 'account.manage', 'role.manage']),
    ).toEqual({ ok: true });
  });
  it('refuses a back-office key for customer and guest', () => {
    expect(checkRolePermissions('customer', ['backoffice.enter'])).toEqual({
      ok: false,
      reason: 'back_office_key_for_customer',
    });
    expect(checkRolePermissions('guest', ['news.manage'])).toEqual({
      ok: false,
      reason: 'back_office_key_for_customer',
    });
    expect(checkRolePermissions('customer', [])).toEqual({ ok: true });
  });
  it('accepts any subset for blogger', () => {
    expect(checkRolePermissions('blogger', [])).toEqual({ ok: true });
    expect(checkRolePermissions('blogger', ['news.manage', 'role.manage'])).toEqual({ ok: true });
  });
});
