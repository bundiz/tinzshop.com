'use client';

import { useTranslations } from 'next-intl';
import { useId, type FormEvent } from 'react';
import Icon from '@/components/ui/Icon';

export type SearchFormProps = {
  /** Lays the form into the header grid (it sits on its own row on a phone). */
  className?: string;
};

/**
 * The header search box from the design: category scope, input and the orange search button.
 * Search is not built yet (REQ-002, plan 003), so the form is inert: it has no action and
 * pressing Enter does nothing (D-124).
 */
export default function SearchForm({ className = '' }: SearchFormProps) {
  const t = useTranslations('shop.header.search');
  const inputId = useId();

  return (
    <form
      role="search"
      onSubmit={preventSubmit}
      className={`flex h-[46px] items-stretch overflow-hidden rounded-full border-2 border-primary bg-bg focus-within:shadow-[0_0_0_4px_rgba(24,99,220,0.15)] ${className}`}
    >
      <button
        type="button"
        className="hidden cursor-pointer items-center gap-1.5 border-0 border-r border-border bg-transparent ps-[18px] pe-3.5 text-sm whitespace-nowrap text-text-muted md:flex"
      >
        {t('scope')}
        <Icon name="chevDown" className="size-4" />
      </button>
      <label className="sr-only" htmlFor={inputId}>
        {t('label')}
      </label>
      <input
        id={inputId}
        type="search"
        placeholder={t('placeholder')}
        className="min-w-0 flex-1 border-0 bg-transparent px-[18px] text-[15px] focus:outline-none"
      />
      <button
        type="button"
        aria-label={t('submit')}
        className="m-[3px] flex cursor-pointer items-center gap-2 rounded-full border-0 bg-accent px-4 font-bold text-text hover:bg-accent-dark md:px-[22px]"
      >
        <Icon name="search" />
        <span className="hidden md:inline">{t('submit')}</span>
      </button>
    </form>
  );
}

/** Keeps the inert search form from submitting (a lone text input submits on Enter otherwise). */
export function preventSubmit(event: Pick<FormEvent, 'preventDefault'>): void {
  event.preventDefault();
}
