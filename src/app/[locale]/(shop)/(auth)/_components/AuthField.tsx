import type { HTMLInputAutoCompleteAttribute, ReactNode } from 'react';

export type AuthFieldProps = {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password';
  autoComplete: HTMLInputAutoCompleteAttribute;
  inputMode?: 'numeric';
  defaultValue?: string;
  maxLength?: number;
  /** An already translated field error. */
  error?: string;
  /** Shown on the label's row, aligned right ("ลืมรหัสผ่าน?"). */
  labelAction?: ReactNode;
  /** Help under the input, such as the password rules; tied to the input by `aria-describedby`. */
  hint?: ReactNode;
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
  error,
  labelAction,
  hint,
}: AuthFieldProps) {
  const id = `auth-${name}`;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        {labelAction}
      </div>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        inputMode={inputMode}
        defaultValue={defaultValue}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        className={`mt-1 block min-h-11 w-full rounded-(--radius-sm) border bg-bg px-3 text-[15px] outline-offset-0 focus:outline-2 focus:outline-primary ${
          error ? 'border-danger' : 'border-border'
        }`}
      />
      {error && (
        <p id={errorId} className="mt-1 text-[13px] text-danger">
          {error}
        </p>
      )}
      {hint && (
        <div id={hintId} className="mt-1 text-[13px] text-text-muted">
          {hint}
        </div>
      )}
    </div>
  );
}
