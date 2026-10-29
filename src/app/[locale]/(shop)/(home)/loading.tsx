import { useTranslations } from 'next-intl';

const CARD_COUNT = 10;

/**
 * The landing page's loading state: a skeleton of the hero zone and a card grid, so content arrives without a jump.
 * It sits in the `(home)` group so it covers only `/{locale}`: a boundary above the product page would start
 * streaming before `notFound()` and turn its 404 into a 200 (D-120).
 */
export default function ShopLoading() {
  const t = useTranslations('shop.loading');

  return (
    <main aria-busy="true" className="mx-auto max-w-[1280px] px-4 pt-4 pb-10 md:px-6">
      <p role="status" className="sr-only">
        {t('label')}
      </p>
      <div aria-hidden="true">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[232px_minmax(0,1fr)_220px]">
          <div className="hidden animate-pulse rounded-(--radius) bg-bg lg:block" />
          <div className="grid gap-3">
            <div className="min-h-[260px] animate-pulse rounded-(--radius) bg-primary-soft lg:min-h-[300px]" />
            <div className="grid grid-cols-2 gap-3">
              <div className="min-h-[118px] animate-pulse rounded-(--radius) bg-accent-soft" />
              <div className="min-h-[118px] animate-pulse rounded-(--radius) bg-bg" />
            </div>
          </div>
          <div className="hidden animate-pulse rounded-(--radius) bg-bg lg:block" />
        </div>
        <div className="mt-4 h-[70px] animate-pulse rounded-(--radius) bg-bg" />
        <div className="mt-4 rounded-(--radius) bg-bg p-4 md:p-5">
          <div className="mb-3.5 h-7 w-40 animate-pulse rounded-sm bg-bg-subtle" />
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: CARD_COUNT }, (_, index) => (
              <li
                key={index}
                data-skeleton="card"
                className="overflow-hidden rounded-(--radius) border border-border bg-bg"
              >
                <div className="aspect-square animate-pulse bg-bg-subtle" />
                <div className="flex flex-col gap-2 px-3 pt-2.5 pb-3">
                  <div className="h-4 animate-pulse rounded-sm bg-bg-subtle" />
                  <div className="h-4 w-2/3 animate-pulse rounded-sm bg-bg-subtle" />
                  <div className="mt-2 h-5 w-1/2 animate-pulse rounded-sm bg-bg-subtle" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
