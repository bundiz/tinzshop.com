import Link from 'next/link';
import Icon from '@/components/ui/Icon';

export type BreadcrumbItem = { label: string; href?: string };

export type BreadcrumbsProps = {
  /** The landmark's accessible name, from a message key. */
  label: string;
  /** An item with `href` is a link; the last item has none and is the current page. */
  items: readonly BreadcrumbItem[];
  /** `plain` (default): the storefront's trail above the page. `bar`: the back office's, inside a box its page bar draws. */
  variant?: 'plain' | 'bar';
};

const NAV_CLASS = {
  plain: 'pt-[18px] pb-1 text-sm text-muted',
  bar: 'min-w-0 text-sm text-muted',
} as const;

/** The mockup's `.crumbs`: a trail of links ending in the current page (plan 015). */
export default function Breadcrumbs({ label, items, variant = 'plain' }: BreadcrumbsProps) {
  return (
    <nav aria-label={label} className={NAV_CLASS[variant]}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, index) => (
          <li key={`${index}-${item.label}`} className="flex items-center gap-1.5">
            {index > 0 && <Icon name="chevRight" className="size-3.5" />}
            {item.href !== undefined ? (
              <Link
                href={item.href}
                className="inline-flex min-h-11 items-center text-ink-2 underline-offset-[3px] hover:text-ink hover:underline sm:min-h-8"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className={`[overflow-wrap:anywhere]${variant === 'bar' ? ' text-ink' : ''}`}>
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
