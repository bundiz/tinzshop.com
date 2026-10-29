import { useTranslations } from 'next-intl';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';

export type PaginationProps = {
  /** The list's own path, category included, without `?page`; page 1 links to it as it is. */
  basePath: string;
  page: number;
  totalPages: number;
};

export type PageItem = number | 'gap';

/** The page numbers to show: the first, the last, the current one and its neighbours, with gaps between. */
export function pageItems(page: number, totalPages: number): PageItem[] {
  const shown = new Set([1, totalPages, page - 1, page, page + 1]);
  // On the first or last page the design shows two neighbours on the inner side (1 2 3 … 12).
  if (page === 1) shown.add(3);
  if (page === totalPages) shown.add(totalPages - 2);
  const numbers = [...shown].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const items: PageItem[] = [];
  numbers.forEach((n, index) => {
    const previous = numbers[index - 1];
    if (previous !== undefined && n - previous > 1) items.push('gap');
    items.push(n);
  });
  return items;
}

function pageHref(basePath: string, page: number): string {
  return page === 1 ? basePath : `${basePath}?page=${page}`;
}

const BOX =
  'grid h-11 min-w-11 place-items-center rounded-(--radius-sm) border px-2 text-sm font-semibold';
const LINK = `${BOX} border-border bg-bg hover:border-primary hover:text-primary`;

/** The design's `.pagination`: previous, numbered pages with gaps, next. Not rendered for a single page. */
export default function Pagination({ basePath, page, totalPages }: PaginationProps) {
  const t = useTranslations('shop.news.pagination');
  if (totalPages <= 1) return null;

  const step = (target: number, label: string, icon: 'chevLeft' | 'chevRight') =>
    target < 1 || target > totalPages ? (
      <span aria-disabled="true" aria-label={label} className={`${BOX} border-border bg-bg text-text-subtle opacity-50`}>
        <Icon name={icon} className="size-4" />
      </span>
    ) : (
      <Link href={pageHref(basePath, target)} aria-label={label} className={LINK}>
        <Icon name={icon} className="size-4" />
      </Link>
    );

  return (
    <nav aria-label={t('label')} className="mt-6 flex flex-wrap justify-center gap-1.5">
      {step(page - 1, t('previous'), 'chevLeft')}
      {pageItems(page, totalPages).map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} aria-hidden="true" className={`${BOX} border-transparent`}>
            …
          </span>
        ) : item === page ? (
          <span key={item} aria-current="page" className={`${BOX} border-primary bg-primary text-white`}>
            {item}
          </span>
        ) : (
          <Link key={item} href={pageHref(basePath, item)} aria-label={t('page', { page: item })} className={LINK}>
            {item}
          </Link>
        ),
      )}
      {step(page + 1, t('next'), 'chevRight')}
    </nav>
  );
}
