'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useActionState, useEffect, useRef, useState } from 'react';

import { buttonClass } from '@/components/ui/button-class';
import { useModalDialog } from '@/components/ui/use-modal-dialog';
import type { AccountAdminState } from '@/server/controllers/access/account-admin-controller';
import { can } from '@/server/services/access/access-service';
import { ASSIGNABLE_ROLE_KEYS, type PermissionKey, type RoleKey } from '@/server/services/access/permission-keys';
import { changeAccountRoleAction, setAccountBlockedAction } from '../actions';

/** One account as the table shows it; the date is an ISO string so it crosses from the server page. */
export type AccountTableRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  roleKey: RoleKey;
  blocked: boolean;
  createdAt: string;
};

export type AccountTableProps = {
  locale: string;
  rows: AccountTableRow[];
  /** The viewer's permission keys. The role select and block button show only with `account.manage` (the page itself needs it too). */
  permissions: readonly PermissionKey[];
  /** Override the Server Actions in tests. */
  actions?: {
    changeRole: (previous: AccountAdminState, formData: FormData) => Promise<AccountAdminState>;
    setBlocked: (previous: AccountAdminState, formData: FormData) => Promise<AccountAdminState>;
  };
};

const IDLE: AccountAdminState = { status: 'idle' };

function displayName(row: AccountTableRow): string {
  return [row.firstName, row.lastName].filter((part) => part !== null && part !== '').join(' ');
}

function ErrorLine({ state }: { state: AccountAdminState }) {
  const t = useTranslations('admin.error');
  return state.status === 'error' ? (
    <p role="alert" className="mt-1 max-w-[260px] text-sm font-medium text-sale">
      {t(state.errorKey)}
    </p>
  ) : null;
}

function RoleForm({ locale, row, action }: { locale: string; row: AccountTableRow; action: NonNullable<AccountTableProps['actions']>['changeRole'] }) {
  const t = useTranslations('admin');
  const [state, formAction] = useActionState(action, IDLE);
  return (
    <form action={formAction}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="accountId" value={row.id} />
      <div className="flex items-center gap-2">
        <select
          name="roleKey"
          defaultValue={row.roleKey}
          aria-label={t('users.roleSelect', { name: displayName(row) })}
          className="min-h-11 rounded-sm border-[1.5px] border-line-2 bg-surface px-2.5 text-ink"
        >
          {ASSIGNABLE_ROLE_KEYS.map((roleKey) => (
            <option key={roleKey} value={roleKey}>
              {t(`role.${roleKey}`)}
            </option>
          ))}
        </select>
        <button type="submit" className={`${buttonClass({ variant: 'line' })} min-h-11 px-3.5 text-sm`}>
          {t('users.saveRole')}
        </button>
      </div>
      <ErrorLine state={state} />
    </form>
  );
}

/** The row's block or unblock button and its confirm dialog (R8's modal behaviour). */
function BlockForm({ locale, row, action }: { locale: string; row: AccountTableRow; action: NonNullable<AccountTableProps['actions']>['setBlocked'] }) {
  const t = useTranslations('admin.users');
  const [state, formAction] = useActionState(action, IDLE);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  useModalDialog({ open, onClose: () => setOpen(false), containerRef: dialog, returnFocusRef: opener });
  // The dialog stays up while the action runs, so its submit button is still in the page when the browser submits; it closes on the result.
  useEffect(() => {
    if (state.status !== 'idle') setOpen(false);
  }, [state]);
  const name = displayName(row);
  const kind = row.blocked ? 'unblock' : 'block';
  const titleId = `confirm-${row.id}`;
  const formId = `block-${row.id}`;
  return (
    <>
      <form id={formId} action={formAction}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="accountId" value={row.id} />
        <input type="hidden" name="blocked" value={row.blocked ? 'false' : 'true'} />
      </form>
      <button ref={opener} type="button" onClick={() => setOpen(true)} className={`${buttonClass({ variant: 'line' })} min-h-11 px-3.5 text-sm`}>
        {t(kind)}
      </button>
      <ErrorLine state={state} />
      {open ? (
        <div className="fixed inset-0 z-60 grid place-items-center bg-ink/50 p-4">
          <div ref={dialog} role="alertdialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-[420px] rounded-md bg-surface p-5 shadow-1">
            <h2 id={titleId} className="font-head text-xl font-bold text-ink">
              {t(`confirm.${kind}Title`)}
            </h2>
            <p className="mt-2 text-ink-2">{t(`confirm.${kind}Text`, { name })}</p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button type="button" onClick={() => setOpen(false)} className={buttonClass({ variant: 'line' })}>
                {t('confirm.cancel')}
              </button>
              <button type="submit" form={formId} className={buttonClass({ variant: row.blocked ? 'brand' : 'buy' })}>
                {t(kind)}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/**
 * The accounts table (the mockup's `.tbl`): name, email, role, status, created, and the row actions. The role select and the
 * block button show only for a viewer with `account.manage`; the Server Actions re-check it either way (D-243). The mockup's
 * checkbox column, phone, order count, total spent and last visit are left out (plan 016, Task 8).
 */
export default function AccountTable({ locale, rows, permissions, actions }: AccountTableProps) {
  const t = useTranslations('admin');
  const format = useFormatter();
  const manage = can({ permissions }, 'account.manage');
  const changeRole = actions?.changeRole ?? changeAccountRoleAction;
  const setBlocked = actions?.setBlocked ?? setAccountBlockedAction;

  if (rows.length === 0) return <p className="rounded-md border border-line bg-surface p-6 text-center text-muted">{t('users.empty')}</p>;

  return (
    <div className="overflow-x-auto rounded-md border border-line bg-surface">
      <table className="w-full min-w-[820px] border-collapse text-left">
        <thead>
          <tr className="border-b border-line bg-sunk text-sm text-muted">
            {(['name', 'email', 'role', 'status', 'created'] as const).map((column) => (
              <th key={column} scope="col" className="p-3 font-semibold">
                {t(`users.columns.${column}`)}
              </th>
            ))}
            {manage ? (
              <th scope="col" className="p-3 font-semibold">
                {t('users.columns.actions')}
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-line align-top last:border-b-0">
              <th scope="row" className="p-3 font-semibold text-ink">
                {displayName(row)}
              </th>
              <td className="p-3 break-all text-ink-2">{row.email}</td>
              <td className="p-3">
                {manage ? <RoleForm locale={locale} row={row} action={changeRole} /> : <span>{t(`role.${row.roleKey}`)}</span>}
              </td>
              <td className="p-3">
                <span
                  className={`inline-block rounded-full px-2.5 py-1 text-[13px] font-semibold ${
                    row.blocked ? 'bg-ns-soft text-ns-ink' : 'bg-ok-soft text-ok-ink'
                  }`}
                >
                  {t(row.blocked ? 'users.status.blocked' : 'users.status.active')}
                </span>
              </td>
              <td className="p-3 whitespace-nowrap text-ink-2">{format.dateTime(new Date(row.createdAt), { dateStyle: 'medium' })}</td>
              {manage ? (
                <td className="p-3">
                  <BlockForm locale={locale} row={row} action={setBlocked} />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
