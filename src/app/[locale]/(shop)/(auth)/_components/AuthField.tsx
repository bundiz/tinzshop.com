'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type HTMLInputAutoCompleteAttribute, type ReactNode } from 'react';

export type AuthFieldProps = {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password';
  autoComplete: HTMLInputAutoCompleteAttribute;
  inputMode?: 'numeric';
  defaultValue?: string;
  maxLength?: number;
  placeholder?: string;
  /** An already translated field error. */
  error?: string;
  /** Shown right after the label text, such as the green tick on a matching confirm field. */
  labelBadge?: ReactNode;
  /** Help under the input, such as the password rules; tied to the input by `aria-describedby`. */
  hint?: ReactNode;
  /** A "แสดง" / "ซ่อน" button on the input, for password fields. */
  revealable?: boolean;
};

/** One labelled input: the label above it, the error and hint linked to it with `aria-describedby`. */
export default function AuthField({
  name,
  label,
  type,
  autoComplete,
  inputMode,
  defaultValue,
  maxLength,
  placeholder,
  error,
  labelBadge,
  hint,
  revealable = false,
}: AuthFieldProps) {
  const t = useTranslations('shop.auth.password');
  const inputRef = useRef<HTMLInputElement>(null);
  const [revealed, setRevealed] = useState(false);
  const id = `auth-${name}`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  // React 19 resets the form after an action, which empties the password; the field goes back to hidden with it.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!revealable || !form) return;
    const hide = () => setRevealed(false);
    form.addEventListener('reset', hide);
    return () => form.removeEventListener('reset', hide);
  }, [revealable]);

  const labelElement = (
    <label htmlFor={id} className="mb-1.5 block text-[15px] font-semibold">
      {label}
    </label>
  );

  return (
    <div>
      {labelBadge ? (
        <span className="flex items-center gap-1.5">
          {labelElement}
          {labelBadge}
        </span>
      ) : (
        labelElement
      )}
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          name={name}
          type={revealable && revealed ? 'text' : type}
          autoComplete={autoComplete}
          inputMode={inputMode}
          defaultValue={defaultValue}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy === '' ? undefined : describedBy}
          className={`min-h-12 w-full rounded-sm border-[1.5px] bg-surface px-3.5 text-base focus:border-ink ${
            error ? 'border-sale' : 'border-line-2'
          } ${revealable ? 'pr-[84px]' : ''}`}
        />
        {revealable && (
          <button
            type="button"
            aria-controls={id}
            aria-pressed={revealed}
            aria-label={revealed ? t('hideLabel') : t('showLabel')}
            onClick={() => setRevealed((previous) => !previous)}
            className="absolute top-1/2 right-1.5 min-h-9 min-w-16 -translate-y-1/2 cursor-pointer rounded-[6px] bg-sunk px-2.5 text-sm font-semibold transition-colors after:absolute after:inset-x-0 after:-inset-y-1 hover:bg-line"
          >
            {revealed ? t('hide') : t('show')}
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-[13.5px] text-sale">
          {error}
        </p>
      )}
      {hint && (
        <div id={hintId} className="mt-1.5 text-[13.5px] text-muted">
          {hint}
        </div>
      )}
    </div>
  );
}
