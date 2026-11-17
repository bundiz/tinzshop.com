'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { buttonClass } from '@/components/ui/button-class';
import { useToast } from '@/components/ui/Toast';
import type { AccountAdminState } from '@/server/controllers/access/account-admin-controller';
import { BACK_OFFICE_KEYS, PERMISSION_KEYS, ROLE_KEYS, type PermissionKey, type RoleKey } from '@/server/services/access/permission-keys';
import { saveRolePermissionsAction } from '../actions';

export type RolePermissionGridProps = {
  locale: string;
  grants: Record<RoleKey, readonly PermissionKey[]>;
  /** Overrides the Server Action in tests. */
  action?: (previous: AccountAdminState, formData: FormData) => Promise<AccountAdminState>;
};

const IDLE: AccountAdminState = { status: 'idle' };

/** The grid's cell rules (spec section 5): Top-level Admin always holds every key; customer and guest never hold a back-office one. */
export function isCellLocked(roleKey: RoleKey, key: PermissionKey): boolean {
  return roleKey === 'super_admin' || ((roleKey === 'customer' || roleKey === 'guest') && BACK_OFFICE_KEYS.has(key));
}

/** The roles the grid saves: every role whose column has a cell that can change. */
export const EDITABLE_ROLE_KEYS = ROLE_KEYS.filter((roleKey) => PERMISSION_KEYS.some((key) => !isCellLocked(roleKey, key)));

/**
 * The role permissions grid (the mockup's `.tbl.perm`): the permission keys down the side, the six roles across. The Top-level
 * Admin column is ticked and disabled; the back-office cells of Customer and Guest are disabled. Server-side checks refuse the
 * same cells (`checkRolePermissions`), so disabling is a courtesy and never the check (D-243). The whole grid is one form with
 * one บันทึก button (D-262): it lists every editable role under `roleKey` and posts each one's ticked keys under
 * `keys.{roleKey}`, so a role with nothing ticked is saved as empty, and the server saves them all or none. A saved grid shows
 * the success toast; a refusal shows its reason by the button.
 */
export default function RolePermissionGrid({ locale, grants, action = saveRolePermissionsAction }: RolePermissionGridProps) {
  const t = useTranslations('admin');
  const toast = useToast();
  const [state, formAction, pending] = useActionState(async (previous: AccountAdminState, formData: FormData) => {
    const next = await action(previous, formData);
    if (next.status === 'ok') toast.success(t('roles.saved'));
    return next;
  }, IDLE);
  return (
    <form action={formAction}>
      <input type="hidden" name="locale" value={locale} />
      {EDITABLE_ROLE_KEYS.map((roleKey) => (
        <input key={roleKey} type="hidden" name="roleKey" value={roleKey} />
      ))}
      <p className="mb-3.5 rounded-sm border border-line bg-brand-soft p-3.5 text-ink-2">{t('roles.hint')}</p>
      <div className="overflow-hidden rounded-md border border-line bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line bg-sunk text-sm text-muted">
                <th scope="col" className="p-3 font-semibold">{t('roles.permission')}</th>
                {ROLE_KEYS.map((roleKey) => (
                  <th key={roleKey} scope="col" className="p-3 text-center font-semibold text-ink">
                    {t(`role.${roleKey}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_KEYS.map((key) => (
                <tr key={key} className="border-b border-line last:border-b-0">
                  <th scope="row" className="p-3 font-medium text-ink">
                    {t(`permission.${key}`)}
                  </th>
                  {ROLE_KEYS.map((roleKey) => {
                    const locked = isCellLocked(roleKey, key);
                    const checked = roleKey === 'super_admin' || (!locked && grants[roleKey].includes(key));
                    return (
                      <td key={roleKey} className="p-3 text-center">
                        <input
                          type="checkbox"
                          name={`keys.${roleKey}`}
                          value={key}
                          defaultChecked={checked}
                          disabled={locked}
                          aria-label={t('roles.cell', { permission: t(`permission.${key}`), role: t(`role.${roleKey}`) })}
                          className="size-5 cursor-pointer accent-brand disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* The footer bar sits outside the scrolling table, so the button stays in view on a narrow screen. */}
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-line bg-sunk p-3">
          {state.status === 'error' ? (
            <p role="alert" className="text-sm font-medium text-sale">
              {t(`error.${state.errorKey}`)}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending}
            className={`${buttonClass({ variant: 'brand', size: 'admin' })} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {t('roles.save')}
          </button>
        </div>
      </div>
    </form>
  );
}
