import { useTranslations } from 'next-intl';

/** The product page's loading state: a skeleton of the gallery and buy box, so content arrives without a jump. */
export default function ProductLoading() {
  const t = useTranslations('shop.loading');

  return (
    <main aria-busy="true" className="mx-auto max-w-[1280px] px-4 pb-10 min-[900px]:px-6">
      <p role="status" className="sr-only">
        {t('label')}
      </p>
      <div aria-hidden="true">
        <div className="my-3 h-5 w-48 animate-pulse rounded-sm bg-bg" />
        <div className="grid grid-cols-1 items-start gap-4 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_280px]">
          <div data-skeleton="gallery" className="rounded-(--radius) bg-bg p-4">
            <div className="aspect-square animate-pulse rounded-(--radius) bg-bg-subtle" />
          </div>
          <div data-skeleton="buy-box" className="flex flex-col gap-3 rounded-(--radius) bg-bg p-4">
            <div className="h-7 animate-pulse rounded-sm bg-bg-subtle" />
            <div className="h-7 w-2/3 animate-pulse rounded-sm bg-bg-subtle" />
            <div className="mt-2 h-24 animate-pulse rounded-(--radius) bg-accent-soft" />
            <div className="mt-2 h-11 w-1/2 animate-pulse rounded-(--radius-sm) bg-bg-subtle" />
          </div>
          <div className="h-48 animate-pulse rounded-(--radius) bg-bg min-[900px]:col-span-full min-[1100px]:col-auto" />
        </div>
      </div>
    </main>
  );
}
