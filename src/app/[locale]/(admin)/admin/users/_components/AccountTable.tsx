'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useActionState, useCallback, useEffect, useRef, useState, type RefObject } from 'react';

import { buttonClass } from '@/components/ui/button-class';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Drawer from '@/components/ui/Drawer';
import RowActionsMenu from '@/components/ui/RowActionsMenu';
import Select from '@/components/ui/Select';
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
  /** The viewer's permission keys. The row menus show only with `account.manage` (the page itself needs it too). */
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

/** A refused block or unblock, shown by the row. */
export function ErrorLine({ state }: { state: AccountAdminState }) {
  const t = useTranslations('admin');
  return state.status === 'error' ? (
    <p role="alert" className="mt-1 ml-auto max-w-[260px] text-left text-sm font-medium whitespace-normal text-sale">
      {t(`error.${state.errorKey}`)}
    </p>
  ) : null;
}

type Actions = NonNullable<AccountTableProps['actions']>;

function StatusPill({ blocked }: { blocked: boolean }) {
  const t = useTranslations('admin.users');
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-[13px] font-semibold ${blocked ? 'bg-ns-soft text-ns-ink' : 'bg-ok-soft text-ok-ink'}`}>
      {t(blocked ? 'status.blocked' : 'status.active')}
    </span>
  );
}

/**
 * The edit drawer (the mockup's `.sheet`): the account read-only and its role as the one editable field, saved through
 * `changeAccountRoleAction`. Mounted only while open, so a refusal from an earlier opening is not shown again. A refusal
 * (the last Top-level Admin guard) shows inside; a saved change closes it, and the revalidated page shows the new role.
 */
function EditDrawer({
  locale,
  row,
  action,
  onClose,
  returnFocusRef,
}: {
  locale: string;
  row: AccountTableRow;
  action: Actions['changeRole'];
  onClose: () => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const t = useTranslations('admin');
  const format = useFormatter();
  const [state, formAction, pending] = useActionState(action, IDLE);
  const formId = `edit-${row.id}`;
  const roleId = `${formId}-role`;
  useEffect(() => {
    if (state.status === 'ok') onClose();
  }, [state, onClose]);
  const field = 'grid gap-1';
  const label = 'text-sm text-muted';
  return (
    <Drawer
      open
      onClose={onClose}
      title={t('users.edit.title')}
      closeLabel={t('users.edit.close')}
      returnFocusRef={returnFocusRef}
      footer={
        <>
          <button type="button" onClick={onClose} className={buttonClass({ variant: 'line', size: 'admin' })}>
            {t('users.confirm.cancel')}
          </button>
          <button
            type="submit"
            form={formId}
            disabled={pending}
            className={`${buttonClass({ variant: 'brand', size: 'admin' })} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {t('users.saveRole')}
          </button>
        </>
      }
    >
      <form id={formId} action={formAction} className="grid gap-4">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="accountId" value={row.id} />
        <dl className="grid gap-4">
          <div className={field}>
            <dt className={label}>{t('users.columns.name')}</dt>
            <dd className="font-semibold text-ink">{displayName(row)}</dd>
          </div>
          <div className={field}>
            <dt className={label}>{t('users.columns.email')}</dt>
            <dd className="break-all text-ink">{row.email}</dd>
          </div>
          <div className={field}>
            <dt className={label}>{t('users.columns.status')}</dt>
            <dd>
              <StatusPill blocked={row.blocked} />
            </dd>
          </div>
          <div className={field}>
            <dt className={label}>{t('users.columns.created')}</dt>
            <dd className="text-ink">{format.dateTime(new Date(row.createdAt), { dateStyle: 'medium' })}</dd>
          </div>
        </dl>
        <div className="grid gap-1.5">
          <label htmlFor={roleId} className="text-sm font-semibold text-ink">
            {t('users.columns.role')}
          </label>
          <Select
            id={roleId}
            name="roleKey"
            size="md"
            defaultValue={row.roleKey}
            className="w-full"
            options={ASSIGNABLE_ROLE_KEYS.map((roleKey) => ({ value: roleKey, label: t(`role.${roleKey}`) }))}
          />
        </div>
        {state.status === 'error' ? (
          <p role="alert" className="text-sm font-medium text-sale">
            {t(`error.${state.errorKey}`)}
          </p>
        ) : null}
      </form>
    </Drawer>
  );
}

/**
 * A row's "⋯" menu (D-261): แก้ไข opens the edit drawer; ระงับ (or ยกเลิกการระงับ on a blocked account) asks in a
 * `ConfirmDialog` and then posts the row's block form through `setAccountBlockedAction`.
 */
function RowActions({ locale, row, actions }: { locale: string; row: AccountTableRow; actions: Actions }) {
  const t = useTranslations('admin.users');
  const [state, formAction, pending] = useActionState(actions.setBlocked, IDLE);
  const [dialog, setDialog] = useState<'edit' | 'block' | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const closeDialog = useCallback(() => setDialog(null), []);
  // The confirm stays up while the action runs, so its submit button is still in the page when the browser submits; it closes on the result.
  useEffect(() => {
    if (state.status !== 'idle') setDialog((open) => (open === 'block' ? null : open));
  }, [state]);
  const name = displayName(row);
  const kind = row.blocked ? 'unblock' : 'block';
  const formId = `block-${row.id}`;
  return (
    <>
      <form id={formId} action={formAction}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="accountId" value={row.id} />
        <input type="hidden" name="blocked" value={row.blocked ? 'false' : 'true'} />
      </form>
      <RowActionsMenu
        label={t('menu.label', { name })}
        buttonRef={menuButton}
        items={[
          { key: 'edit', label: t('menu.edit'), icon: 'edit', onSelect: () => setDialog('edit') },
          row.blocked
            ? { key: 'unblock', label: t('unblock'), icon: 'undo', onSelect: () => setDialog('block') }
            : { key: 'block', label: t('block'), icon: 'lock', tone: 'danger', onSelect: () => setDialog('block') },
        ]}
      />
      <ErrorLine state={state} />
      {dialog === 'edit' ? <EditDrawer locale={locale} row={row} action={actions.changeRole} onClose={closeDialog} returnFocusRef={menuButton} /> : null}
      <ConfirmDialog
        open={dialog === 'block'}
        onClose={closeDialog}
        title={t(`confirm.${kind}Title`)}
        text={t(`confirm.${kind}Text`, { name })}
        // The action's own word, not a generic "ยืนยัน": the button says what pressing it does.
        confirmLabel={t(kind)}
        cancelLabel={t('confirm.cancel')}
        tone={row.blocked ? 'default' : 'danger'}
        icon={row.blocked ? 'undo' : 'lock'}
        form={formId}
        pending={pending}
        returnFocusRef={menuButton}
      />
    </>
  );
}

/**
 * The accounts table (the mockup's `.tbl`): name, email, role, status, created, and for a viewer with `account.manage` a
 * narrow column of row menus (D-261); the Server Actions re-check the permission either way (D-243). The mockup's checkbox
 * column, phone, order count, total spent and last visit are left out (plan 016, Task 8).
 */
export default function AccountTable({ locale, rows, permissions, actions }: AccountTableProps) {
  const t = useTranslations('admin');
  const format = useFormatter();
  const manage = can({ permissions }, 'account.manage');
  const rowActions: Actions = { changeRole: actions?.changeRole ?? changeAccountRoleAction, setBlocked: actions?.setBlocked ?? setAccountBlockedAction };

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
              <th scope="col" className="w-px p-3">
                <span className="sr-only">{t('users.columns.actions')}</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-line align-middle last:border-b-0">
              <th scope="row" className="p-3 font-semibold text-ink">
                {displayName(row)}
              </th>
              <td className="p-3 break-all text-ink-2">{row.email}</td>
              <td className="p-3 text-ink">{t(`role.${row.roleKey}`)}</td>
              <td className="p-3">
                <StatusPill blocked={row.blocked} />
              </td>
              <td className="p-3 whitespace-nowrap text-ink-2">{format.dateTime(new Date(row.createdAt), { dateStyle: 'medium' })}</td>
              {manage ? (
                <td className="py-2 pr-2 pl-3 text-right">
                  <RowActions locale={locale} row={row} actions={rowActions} />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
