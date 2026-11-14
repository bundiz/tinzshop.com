/** The six system roles, in menu order (D-062). */
export const ROLE_KEYS = ['guest', 'customer', 'blogger', 'sale_manager', 'admin', 'super_admin'] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

/** The stage 1 permission keys (D-241). */
export const PERMISSION_KEYS = ['backoffice.enter', 'news.manage', 'account.manage', 'role.manage'] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

/** Every stage 1 key is a back-office key. */
export const BACK_OFFICE_KEYS: ReadonlySet<PermissionKey> = new Set<PermissionKey>(PERMISSION_KEYS);

export const STAFF_ROLE_KEYS = ['blogger', 'sale_manager', 'admin', 'super_admin'] as const satisfies readonly RoleKey[];

/** The roles an account can be given: every role except guest. */
export const ASSIGNABLE_ROLE_KEYS = ['customer', 'blogger', 'sale_manager', 'admin', 'super_admin'] as const satisfies readonly RoleKey[];
