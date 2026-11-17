import { BACK_OFFICE_KEYS, PERMISSION_KEYS, type PermissionKey, type RoleKey } from './permission-keys';

export type AccessError =
  | 'access.forbidden'
  | 'access.last_super_admin'
  | 'access.super_admin_locked'
  | 'access.back_office_key_for_customer'
  | 'access.unknown_account';

/** One role's whole permission set, as the role permissions grid saves it (D-262). */
export type RoleGrant = { roleKey: RoleKey; permissionKeys: PermissionKey[] };

/** Whether the viewer holds the permission. A null viewer (nobody signed in) holds none. */
export function can(viewer: { permissions: readonly PermissionKey[] } | null, key: PermissionKey): boolean {
  return viewer !== null && viewer.permissions.includes(key);
}

/** Rules a role's grant set must obey: super_admin holds every key; customer and guest hold no back-office key. */
export function checkRolePermissions(
  roleKey: RoleKey,
  keys: readonly PermissionKey[],
): { ok: true } | { ok: false; reason: 'super_admin_locked' | 'back_office_key_for_customer' } {
  if (roleKey === 'super_admin') {
    const held = new Set(keys);
    return PERMISSION_KEYS.every((key) => held.has(key)) && held.size === PERMISSION_KEYS.length
      ? { ok: true }
      : { ok: false, reason: 'super_admin_locked' };
  }
  if ((roleKey === 'customer' || roleKey === 'guest') && keys.some((key) => BACK_OFFICE_KEYS.has(key))) {
    return { ok: false, reason: 'back_office_key_for_customer' };
  }
  return { ok: true };
}
