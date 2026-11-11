'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useActionState, useEffect, useRef, type HTMLInputAutoCompleteAttribute } from 'react';
import type { AuthFormState } from '@/server/controllers/auth/customer-auth-controller';
import AuthField from './AuthField';

/** One field, as plain data a Server Component can hand to this client form. Label keys are relative to `shop.auth`. */
export type AuthFieldSpec = {
  name: string;
  labelKey: string;
  type: 'text' | 'email' | 'password';
  autoComplete: HTMLInputAutoCompleteAttribute;
  inputMode?: 'numeric';
  defaultValue?: string;
  maxLength?: number;
  /** A link on the label's row, aligned right; `labelKey` is relative to `shop.auth`. */
  labelLink?: { href: string; labelKey: string };
  /** Show the password rules under this field. */
  showPasswordRules?: boolean;
};

export type AuthFormProps = {
  action: (previous: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  fields: AuthFieldSpec[];
  /** The submit button's text, a key relative to `shop.auth`. */
  submitKey: string;
  /** Extra hidden inputs, such as `returnTo`. The locale is always sent. */
  hidden?: Record<string, string>;
  /** A short line above the fields, a key relative to `shop.auth`. */
  introKey?: string;
  /** Values for ICU placeholders in the intro, such as the email. */
  introValues?: Record<string, string>;
  /** The password rules' message keys, shown by a field with `showPasswordRules` (from `PASSWORD_RULES`, D-177). */
  passwordRuleKeys?: string[];
  /** The primary button fills the card; the secondary is an outline button for a lesser action such as resend. */
  variant?: 'primary' | 'secondary';
};

const KEY_PREFIX = 'shop.auth.';

/** The first field with an error, in the order the fields are drawn. */
export function firstInvalidField(fields: { name: string }[], fieldErrors: Record<string, string> | undefined): string | null {
  return fields.find((field) => fieldErrors?.[field.name] !== undefined)?.name ?? null;
}

/**
 * An auth form wired to a Server Action with `useActionState` as a real `<form action>`, so it works before the page
 * has hydrated and a password or code can never end up in the URL. React 19 resets the inputs after an action; the
 * controller echoes the non-secret fields (`state.values`) and they re-seed the inputs, while passwords and codes
 * come back empty (D-181): field errors beside their inputs, the form-wide
 * error and notices in one polite live region, and a pending state on the button. Every message arrives as a
 * `shop.auth.*` key from the controller and is translated here, so Cognito's text is never shown (D-032).
 */
export default function AuthForm({
  action,
  fields,
  submitKey,
  hidden,
  introKey,
  introValues,
  passwordRuleKeys = [],
  variant = 'primary',
}: AuthFormProps) {
  const t = useTranslations('shop.auth');
  const locale = useLocale();
  const [state, formAction, isPending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  /** A controller key to text; a key this catalogue does not hold reads as the generic fault, never as raw text. */
  const message = (key: string | undefined): string | undefined => {
    if (key === undefined) return undefined;
    const relative = key.startsWith(KEY_PREFIX) ? key.slice(KEY_PREFIX.length) : 'error.unavailable';
    return t.has(relative) ? t(relative) : t('error.unavailable');
  };

  const invalid = firstInvalidField(fields, state.fieldErrors);
  useEffect(() => {
    if (invalid !== null) formRef.current?.querySelector<HTMLInputElement>(`[name="${invalid}"]`)?.focus();
  }, [invalid, state]);

  const note = message(state.formError) ?? message(state.notice);
  const buttonStyle =
    variant === 'primary'
      ? 'border-transparent bg-primary text-white hover:bg-primary-dark'
      : 'border-primary bg-bg text-primary hover:bg-primary-soft';

  return (
    <form ref={formRef} action={formAction} noValidate className="grid gap-4">
      <input type="hidden" name="locale" value={locale} />
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {introKey !== undefined && <p className="text-sm text-text-muted">{t(introKey, introValues)}</p>}
      {/* Always in the page, so a screen reader is already watching it when the message arrives; empty, it takes no room. */}
      <div role="status" aria-live="polite" className={note === undefined ? 'sr-only' : undefined}>
        {note !== undefined && (
          <p
            className={`rounded-(--radius-sm) border px-3 py-2 text-sm ${
              state.formError ? 'border-danger/40 bg-danger/5 text-danger' : 'border-primary/30 bg-primary-soft'
            }`}
          >
            {note}
          </p>
        )}
      </div>
      {fields.map((field) => (
        <AuthField
          // A new echoed value remounts the input, so React's reset after the action shows what was typed, not a blank.
          key={`${field.name}:${state.values?.[field.name] ?? ''}`}
          name={field.name}
          label={t(field.labelKey)}
          type={field.type}
          autoComplete={field.autoComplete}
          inputMode={field.inputMode}
          defaultValue={state.values?.[field.name] ?? field.defaultValue}
          maxLength={field.maxLength}
          error={message(state.fieldErrors?.[field.name])}
          labelAction={
            field.labelLink && (
              <Link
                href={field.labelLink.href}
                className="inline-flex min-h-11 items-center text-[13px] font-semibold text-primary hover:text-primary-dark"
              >
                {t(field.labelLink.labelKey)}
              </Link>
            )
          }
          hint={
            field.showPasswordRules && passwordRuleKeys.length > 0 ? (
              <>
                <p>{t('password.rulesLabel')}</p>
                <ul className="mt-0.5 list-disc pl-5">
                  {passwordRuleKeys.map((key) => (
                    <li key={key}>{message(key)}</li>
                  ))}
                </ul>
              </>
            ) : undefined
          }
        />
      ))}
      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className={`inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-full border px-5 text-[15px] leading-[1.3] font-bold transition-colors disabled:cursor-wait disabled:opacity-70 ${buttonStyle}`}
      >
        {isPending ? t('pending') : t(submitKey)}
      </button>
    </form>
  );
}
