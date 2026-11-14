import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Icon, { type IconName } from '@/components/ui/Icon';
import { can } from '@/server/services/access/access-service';
import type { PermissionKey } from '@/server/services/access/permission-keys';
import { signOutAction } from '../../../(shop)/(auth)/actions';

export type SideNavProps = {
  locale: string;
  /** The signed-in account's permission keys; an item shows only when it holds the item's key. */
  permissions: readonly PermissionKey[];
  /** The current path with the locale, e.g. `/th/admin/news`, to mark the current item. */
  pathname: string;
  name: string;
  /** The account's role, already translated. */
  roleLabel: string;
  /** Runs when a link is followed, so the narrow-width drawer can close. */
  onNavigate?: () => void;
};

type Item = {
  key: 'dashboard' | 'news' | 'users';
  path: string;
  /** The item shows when the account holds any of these keys. */
  permission: PermissionKey[];
  icon: IconName;
};
type Section = { key: 'overview' | 'content' | 'system'; items: Item[] };

/** The stage 1 menu, in the mockup's order. Later plans add their items here, each with its key. */
const SECTIONS: Section[] = [
  { key: 'overview', items: [{ key: 'dashboard', path: '', permission: ['backoffice.enter'], icon: 'grid' }] },
  { key: 'content', items: [{ key: 'news', path: '/news', permission: ['news.manage'], icon: 'list' }] },
  { key: 'system', items: [{ key: 'users', path: '/users', permission: ['account.manage', 'role.manage'], icon: 'user' }] },
];

const ITEM =
  'flex min-h-[42px] items-center gap-3 rounded-[9px] px-3 font-medium text-on-navy-2 transition-colors hover:bg-white/6 hover:text-white aria-[current=page]:bg-white/10 aria-[current=page]:text-white aria-[current=page]:shadow-[inset_3px_0_0_var(--color-accent)]';

/** The dashboard is current only on its own path; the others on their path and below it. */
function isCurrent(pathname: string, href: string, isHome: boolean): boolean {
  return isHome ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The back office's navy side menu (the mockup's `.side-nav`): the sections and items the account's permissions allow
 * (`can`), and at the foot the account's name and role, "ดูหน้าร้าน" and sign-out. Hiding an item is not the check
 * (D-243); every page checks its own key. The mockup's counts and its items for later stages are left out.
 */
export default function SideNav({ locale, permissions, pathname, name, roleLabel, onNavigate }: SideNavProps) {
  const t = useTranslations('admin');
  const viewer = { permissions };
  const base = `/${locale}/admin`;

  return (
    <>
      <Link href={base} aria-label={t('brand.label')} onClick={onNavigate} className="flex items-center gap-2.5 px-2 pt-1 pb-[18px]">
        <img src="/logo-mark.png" alt="" width={34} height={34} className="size-[34px] flex-none rounded-full" />
        <span>
          <span className="block font-head text-xl leading-none font-bold text-white">{t('brand.word')}</span>
          <span className="mt-1 block text-[11px] leading-none font-semibold tracking-[.08em] text-on-navy-2 uppercase">
            {t('brand.tag')}
          </span>
        </span>
      </Link>
      {SECTIONS.map((section) => {
        const items = section.items.filter((item) => item.permission.some((key) => can(viewer, key)));
        if (items.length === 0) return null;
        return (
          <div key={section.key} className="mt-3.5">
            <p className="px-3 pb-2 text-[11.5px] leading-none font-semibold tracking-[.08em] text-on-navy-2 uppercase">
              {t(`nav.${section.key}`)}
            </p>
            <ul>
              {items.map((item) => {
                const href = `${base}${item.path}`;
                const linkTo = item.key === 'users' && !can(viewer, 'account.manage') ? `${href}?tab=roles` : href;
                return (
                  <li key={item.key}>
                    <Link
                      href={linkTo}
                      onClick={onNavigate}
                      aria-current={isCurrent(pathname, href, item.path === '') ? 'page' : undefined}
                      className={ITEM}
                    >
                      <Icon name={item.icon} className="size-[19px]" />
                      <span>{t(`nav.${item.key}`)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <div className="mt-auto border-t border-white/8 pt-4">
        <Link href={`/${locale}`} className={ITEM}>
          <Icon name="store" className="size-[19px]" />
          <span>{t('nav.viewShop')}</span>
        </Link>
        <div className="flex items-center gap-2.5 p-2">
          <span
            aria-hidden="true"
            className="grid size-9 flex-none place-items-center rounded-full bg-navy-3 text-sm font-bold text-white"
          >
            {Array.from(name)[0]?.toUpperCase()}
          </span>
          <div className="min-w-0">
            <b className="block truncate text-sm leading-[1.3] font-semibold text-white">{name}</b>
            <small className="block text-[12.5px] text-on-navy-2">{roleLabel}</small>
          </div>
        </div>
        <form action={signOutAction}>
          <input type="hidden" name="locale" value={locale} />
          <button type="submit" className={`${ITEM} w-full cursor-pointer text-left`}>
            <span>{t('nav.signOut')}</span>
          </button>
        </form>
      </div>
    </>
  );
}
