import { useTranslations } from 'next-intl';

const CARD_COUNT = 10;

/**
 * The landing page's loading state: a skeleton of the hero and a card grid, so content arrives without a jump.
 * It sits in the `(home)` group so it covers only `/{locale}`: a boundary above the product page would start
 * streaming before `notFound()` and turn its 404 into a 200 (D-120).
 */
export default function ShopLoading() {
  const t = useTranslations('shop.loading');

  return (
    <main aria-busy="true" className="mx-auto max-w-[1280px] px-4 pt-4 pb-10 min-[900px]:px-6">
      <p role="status" className="sr-only">
        {t('label')}
      </p>
      <div aria-hidden="true">
        <div className="min-h-[260px] animate-pulse rounded-(--radius) bg-primary-soft min-[1100px]:min-h-[300px]" />
        <div className="mt-4 h-[70px] animate-pulse rounded-(--radius) bg-bg" />
        <div className="mt-4 rounded-(--radius) bg-bg p-4 min-[900px]:p-5">
          <div className="mb-3.5 h-7 w-40 animate-pulse rounded-sm bg-bg-subtle" />
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 min-[900px]:grid-cols-4 min-[1100px]:grid-cols-5">
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
