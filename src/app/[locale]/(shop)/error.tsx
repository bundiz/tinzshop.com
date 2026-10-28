'use client';

import { useTranslations } from 'next-intl';

export type ShopErrorProps = {
  /** The thrown value. Never shown: a server error's message is replaced in production, and may carry details. */
  error: unknown;
  /** Next 16: re-fetches and re-renders the segment (unlike `reset`, which only re-renders). */
  retry: () => void;
};

/** The storefront's error state: a message from the catalogue and a way to retry (07 Loading, empty and error). */
export default function ShopError({ retry }: ShopErrorProps) {
  const t = useTranslations('shop.error');

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-10 md:px-6">
      <section role="alert" className="rounded-(--radius) bg-bg p-8 text-center">
        <h1 className="text-[19px]">{t('title')}</h1>
        <p className="mt-2 text-text-muted">{t('text')}</p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-[15px] leading-[1.3] font-bold text-white transition-colors hover:bg-primary-dark"
        >
          {t('retry')}
        </button>
      </section>
    </main>
  );
}
