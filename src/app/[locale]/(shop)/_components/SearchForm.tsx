'use client';

import { useTranslations } from 'next-intl';
import { useId, type FormEvent } from 'react';
import Icon from '@/components/ui/Icon';

export type SearchFormProps = {
  /** Lays the form into the header grid (it sits on its own row on a phone). */
  className?: string;
};

/**
 * The header search box from the design: the icon, the input and the "ค้นหา" button. Search is not built yet
 * (REQ-002, plan 003), so the form is inert: it has no action, the button is `type="button"` and pressing Enter
 * does nothing (D-124, R7).
 */
export default function SearchForm({ className = '' }: SearchFormProps) {
  const t = useTranslations('shop.header.search');
  const inputId = useId();

  return (
    <form
      role="search"
      onSubmit={preventSubmit}
      className={`flex h-12 min-w-0 items-center rounded-sm border-[1.5px] border-transparent bg-sunk transition-colors duration-[180ms] focus-within:border-brand focus-within:bg-white ${className}`}
    >
      <Icon name="search" className="ml-3.5 size-5 text-muted" />
      <label className="sr-only" htmlFor={inputId}>
        {t('label')}
      </label>
      <input
        id={inputId}
        type="search"
        placeholder={t('placeholder')}
        autoComplete="off"
        className="h-full min-w-0 flex-1 border-0 bg-transparent px-3 text-base focus:outline-none"
      />
      <button
        type="button"
        className="mr-1 h-10 cursor-pointer rounded-[6px] border-0 bg-brand px-[18px] font-semibold text-white transition-colors duration-[180ms] hover:bg-brand-dark"
      >
        {t('submit')}
      </button>
    </form>
  );
}

/** Keeps the inert search form from submitting (a lone text input submits on Enter otherwise). */
export function preventSubmit(event: Pick<FormEvent, 'preventDefault'>): void {
  event.preventDefault();
}
