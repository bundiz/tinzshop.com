import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';

import { can } from '@/server/services/access/access-service';
import { buttonClass } from '@/components/ui/button-class';
import Select from '@/components/ui/Select';
import { getAccountAdmin } from '@/server/composition-root';
import { ROLE_KEYS, type RoleKey } from '@/server/services/access/permission-keys';
import { readCurrentCustomer } from '../../../(shop)/_components/read-current-customer';
import { requirePermission } from '../_lib/require-permission';
import AccountTable from './_components/AccountTable';
import RolePermissionGrid from './_components/RolePermissionGrid';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

const PAGE_SIZE = 20;

const first = (value: string | string[] | undefined): string => (Array.isArray(value) ? (value[0] ?? '') : (value ?? ''));

/** The query a link keeps: only the non-empty filters. */
function href(locale: string, params: Record<string, string>): string {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== ''));
  const text = query.toString();
  return `/${locale}/admin/users${text === '' ? '' : `?${text}`}`;
}

const TAB = 'inline-flex min-h-11 items-center rounded-sm px-4 font-semibold text-ink-2 aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-dark';
// The admin mockup's filter bar (`.fbar`): 42px fields from `sm`, 44px on a phone (D-221, D-257).
const FIELD = 'min-h-11 rounded-sm border-[1.5px] border-line-2 bg-surface px-3 text-ink sm:min-h-[42px]';

/**
 * `/{locale}/admin/users` (plan 016, Task 8): two tabs. "All accounts" needs `account.manage`; "Roles and permissions"
 * (`?tab=roles`) needs `role.manage`. Each is checked here, never left to the layout (D-243).
 */
export default async function UsersPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: 'admin' });
  const viewer = await readCurrentCustomer();
  const canAccounts = can(viewer, 'account.manage');
  const canRoles = can(viewer, 'role.manage');
  // A viewer holding only role.manage lands on the roles tab; the server checks below still run for whoever asks.
  const rolesTab = first(query.tab) === 'roles' || (!canAccounts && canRoles);

  const header = (
    <div className="mb-4">
      <h1 className="font-head text-[24px] font-bold text-ink md:text-[28px]">{t('users.title')}</h1>
      <p className="mt-1 text-muted">{t('users.subtitle')}</p>
    </div>
  );

  const tabs = (
    <nav aria-label={t('users.tabsLabel')} className="mb-4 flex gap-1 border-b border-line pb-2">
      {canAccounts ? (
        <Link href={href(locale, {})} aria-current={rolesTab ? undefined : 'page'} className={TAB}>
          {t('users.tabAccounts')}
        </Link>
      ) : null}
      {canRoles ? (
        <Link href={href(locale, { tab: 'roles' })} aria-current={rolesTab ? 'page' : undefined} className={TAB}>
          {t('users.tabRoles')}
        </Link>
      ) : null}
    </nav>
  );

  if (rolesTab) {
    await requirePermission(locale, '/admin/users?tab=roles', 'role.manage');
    const grants = await getAccountAdmin().listRoleGrants();
    return (
      <>
        {header}
        {tabs}
        <RolePermissionGrid locale={locale} grants={grants} />
      </>
    );
  }

  const account = await requirePermission(locale, '/admin/users', 'account.manage');
  const q = first(query.q).trim().slice(0, 100);
  const roleParam = first(query.role);
  const roleKey: RoleKey | null = (ROLE_KEYS as readonly string[]).includes(roleParam) ? (roleParam as RoleKey) : null;
  const statusParam = first(query.status);
  const status = statusParam === 'active' || statusParam === 'blocked' ? statusParam : '';
  const requested = Number.parseInt(first(query.page), 10);
  const requestedPage = Number.isInteger(requested) && requested >= 1 ? requested : 1;

  const { total, rows } = await getAccountAdmin().searchAccounts({
    query: q,
    roleKey,
    blocked: status === '' ? null : status === 'blocked',
    skip: (requestedPage - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(requestedPage, pages);
  const keep = { q, role: roleKey ?? '', status };

  return (
    <>
      {header}
      {tabs}
      <form method="get" action={`/${locale}/admin/users`} className="mb-4 flex flex-wrap items-center gap-2.5">
        <label htmlFor="users-q" className="sr-only">
          {t('users.search.label')}
        </label>
        <input id="users-q" type="search" name="q" defaultValue={q} placeholder={t('users.search.placeholder')} className={`${FIELD} min-w-[220px] flex-1`} />
        <label htmlFor="users-role" className="sr-only">
          {t('users.filter.role')}
        </label>
        <Select
          id="users-role"
          name="role"
          size="compact"
          defaultValue={roleKey ?? ''}
          options={[{ value: '', label: t('users.filter.allRoles') }, ...ROLE_KEYS.map((key) => ({ value: key, label: t(`role.${key}`) }))]}
        />
        <label htmlFor="users-status" className="sr-only">
          {t('users.filter.status')}
        </label>
        <Select
          id="users-status"
          name="status"
          size="compact"
          defaultValue={status}
          options={[
            { value: '', label: t('users.filter.allStatuses') },
            { value: 'active', label: t('users.status.active') },
            { value: 'blocked', label: t('users.status.blocked') },
          ]}
        />
        <button type="submit" className={buttonClass({ variant: 'brand', size: 'admin' })}>
          {t('users.search.submit')}
        </button>
        <p className="ml-auto text-muted" role="status">
          {t('users.count', { count: total })}
        </p>
      </form>
      <AccountTable
        locale={locale}
        permissions={account.permissions}
        rows={rows.map((row) => ({
          id: row.id,
          email: row.email,
          firstName: row.firstName,
          lastName: row.lastName,
          roleKey: row.roleKey,
          blocked: row.blockedAt !== null,
          createdAt: row.createdAt.toISOString(),
        }))}
      />
      {pages > 1 ? (
        <nav aria-label={t('users.pager.label')} className="mt-4 flex items-center justify-center gap-3">
          {current > 1 ? (
            <Link href={href(locale, { ...keep, page: String(current - 1) })} rel="prev" className={buttonClass({ variant: 'line', size: 'adminSm' })}>
              {t('users.pager.prev')}
            </Link>
          ) : null}
          <span className="text-muted">{t('users.pager.range', { page: current, pages })}</span>
          {current < pages ? (
            <Link href={href(locale, { ...keep, page: String(current + 1) })} rel="next" className={buttonClass({ variant: 'line', size: 'adminSm' })}>
              {t('users.pager.next')}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
