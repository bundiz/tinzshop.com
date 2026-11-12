import { useTranslations } from 'next-intl';

const CARD_COUNT = 10;

/**
 * The landing page's loading state: a skeleton of the navy hero and a `g-5` card grid, so content arrives without a
 * jump. It sits in the `(home)` group so it covers only `/{locale}`: a boundary above the product page would start
 * streaming before `notFound()` and turn its 404 into a 200 (D-120).
 */
export default function ShopLoading() {
  const t = useTranslations('shop.loading');

  return (
    <main id="main" aria-busy="true">
      <p role="status" className="sr-only">
        {t('label')}
      </p>
      <div aria-hidden="true">
        <div className="bg-navy">
          <div className="wrap grid grid-cols-1 gap-8 py-11 lg:grid-cols-[1.05fr_.95fr] lg:py-14">
            <div className="flex flex-col gap-4">
              <div className="h-4 w-56 animate-pulse rounded-sm bg-navy-2" />
              <div className="h-14 animate-pulse rounded-sm bg-navy-2" />
              <div className="h-14 w-2/3 animate-pulse rounded-sm bg-navy-2" />
              <div className="mt-4 h-[54px] w-48 animate-pulse rounded-sm bg-navy-2" />
            </div>
            <div className="hidden min-h-[320px] animate-pulse rounded-xl bg-navy-2 lg:block" />
          </div>
        </div>
        <div className="wrap pt-[clamp(48px,6vw,80px)]">
          <div className="mb-6 h-8 w-56 animate-pulse rounded-sm bg-sunk" />
          <ul className="grid grid-cols-2 gap-2.5 sm:gap-4 md:grid-cols-4 xl:grid-cols-5 md:max-xl:[&>*:nth-child(n+9)]:hidden">
            {Array.from({ length: CARD_COUNT }, (_, index) => (
              <li key={index} data-skeleton="card" className="overflow-hidden rounded-lg border border-line bg-surface p-3">
                <div className="aspect-square animate-pulse rounded-md bg-sunk" />
                <div className="flex flex-col gap-2 px-1 pt-3.5 pb-1">
                  <div className="h-4 animate-pulse rounded-sm bg-sunk" />
                  <div className="h-4 w-2/3 animate-pulse rounded-sm bg-sunk" />
                  <div className="mt-2 h-5 w-1/2 animate-pulse rounded-sm bg-sunk" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
