import Link from 'next/link';
import Icon from '@/components/ui/Icon';

export type BreadcrumbItem = { label: string; href?: string };

export type BreadcrumbsProps = {
  /** The landmark's accessible name, from a message key. */
  label: string;
  /** An item with `href` is a link; the last item has none and is the current page. */
  items: readonly BreadcrumbItem[];
};

/** The mockup's `.crumbs`: a trail of links ending in the current page (plan 015). */
export default function Breadcrumbs({ label, items }: BreadcrumbsProps) {
  return (
    <nav aria-label={label} className="pt-[18px] pb-1 text-sm text-muted">
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
              <span aria-current="page" className="[overflow-wrap:anywhere]">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
