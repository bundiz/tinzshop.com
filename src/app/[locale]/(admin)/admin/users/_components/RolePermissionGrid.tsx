'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { buttonClass } from '@/components/ui/button-class';
import type { AccountAdminState } from '@/server/controllers/access/account-admin-controller';
import { BACK_OFFICE_KEYS, PERMISSION_KEYS, ROLE_KEYS, type PermissionKey, type RoleKey } from '@/server/services/access/permission-keys';
import { saveRolePermissionsAction } from '../actions';

export type RolePermissionGridProps = {
  locale: string;
  grants: Record<RoleKey, readonly PermissionKey[]>;
  /** Overrides the Server Action in tests. */
  action?: (previous: AccountAdminState, formData: FormData) => Promise<AccountAdminState>;
};

/** The grid's cell rules (spec section 5): Top-level Admin always holds every key; customer and guest never hold a back-office one. */
export function isCellLocked(roleKey: RoleKey, key: PermissionKey): boolean {
  return roleKey === 'super_admin' || ((roleKey === 'customer' || roleKey === 'guest') && BACK_OFFICE_KEYS.has(key));
}

const formId = (roleKey: RoleKey) => `role-permissions-${roleKey}`;

/** One role's save form: the hidden fields and its result line. The role's checkboxes sit in the table and join it by `form=`. */
function RoleForm({ locale, roleKey, action }: { locale: string; roleKey: RoleKey; action: NonNullable<RolePermissionGridProps['action']> }) {
  const t = useTranslations('admin');
  const [state, formAction] = useActionState(action, { status: 'idle' } as AccountAdminState);
  return (
    <form id={formId(roleKey)} action={formAction}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="roleKey" value={roleKey} />
      {state.status === 'error' ? (
        <p role="alert" className="mt-2 text-sm font-medium text-sale">
          {t(`role.${roleKey}`)}: {t(`error.${state.errorKey}`)}
        </p>
      ) : null}
      {state.status === 'ok' ? (
        <p role="status" className="mt-2 text-sm font-medium text-ok-ink">
          {t(`role.${roleKey}`)}: {t('roles.saved')}
        </p>
      ) : null}
    </form>
  );
}

/**
 * The role permissions grid (the mockup's `.tbl.perm`): the permission keys down the side, the six roles across. The Top-level
 * Admin column is ticked and disabled; the back-office cells of Customer and Guest are disabled. Server-side checks refuse the
 * same cells (`checkRolePermissions`), so disabling is a courtesy and never the check (D-243). Each editable role saves on its
 * own, as the design says "saved per role"; the checkboxes join the role's form through the `form` attribute.
 */
export default function RolePermissionGrid({ locale, grants, action = saveRolePermissionsAction }: RolePermissionGridProps) {
  const t = useTranslations('admin');
  const editable = ROLE_KEYS.filter((roleKey) => roleKey !== 'super_admin' && roleKey !== 'customer' && roleKey !== 'guest');
  return (
    <>
      <p className="mb-3.5 rounded-sm border border-line bg-brand-soft p-3.5 text-ink-2">{t('roles.hint')}</p>
      <div className="overflow-x-auto rounded-md border border-line bg-surface">
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
                        name="keys"
                        value={key}
                        form={formId(roleKey)}
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
          <tfoot>
            <tr className="border-t border-line bg-sunk">
              <td className="p-3" />
              {ROLE_KEYS.map((roleKey) => (
                <td key={roleKey} className="p-3 text-center">
                  {(editable as readonly RoleKey[]).includes(roleKey) ? (
                    <button
                      type="submit"
                      form={formId(roleKey)}
                      aria-label={t('roles.saveRole', { role: t(`role.${roleKey}`) })}
                      className={`${buttonClass({ variant: 'brand' })} min-h-11 px-3.5 text-sm`}
                    >
                      {t('roles.save')}
                    </button>
                  ) : null}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      {editable.map((roleKey) => (
        <RoleForm key={roleKey} locale={locale} roleKey={roleKey} action={action} />
      ))}
    </>
  );
}
