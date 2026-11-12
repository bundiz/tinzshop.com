'use client';

import { useTranslations } from 'next-intl';
import { buttonClass } from '@/components/ui/button-class';

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
    <main id="main" className="wrap py-10">
      <section role="alert" className="rounded-lg border border-line bg-surface p-[18px] text-center sm:p-8">
        <h1 className="text-[19px]">{t('title')}</h1>
        <p className="mt-2 text-muted">{t('text')}</p>
        <button
          type="button"
          onClick={() => retry()}
          className={`${buttonClass({ variant: 'brand' })} mt-5`}
        >
          {t('retry')}
        </button>
      </section>
    </main>
  );
}
