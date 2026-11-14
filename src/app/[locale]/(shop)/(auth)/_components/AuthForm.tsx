'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Fragment, useActionState, useEffect, useRef, useState, type FormEvent, type HTMLInputAutoCompleteAttribute } from 'react';
import type { AuthFormState } from '@/server/controllers/auth/customer-auth-controller';
import { failedPasswordRules, PASSWORD_RULES } from '@/server/services/auth/password-policy';
import { AUTH_LINK_CLASS } from './AuthCard';
import AuthField from './AuthField';
import { buttonClass } from '@/components/ui/button-class';

/** One field, as plain data a Server Component can hand to this client form. Label keys are relative to `shop.auth`. */
export type AuthFieldSpec = {
  name: string;
  labelKey: string;
  type: 'text' | 'email' | 'password';
  autoComplete: HTMLInputAutoCompleteAttribute;
  inputMode?: 'numeric';
  defaultValue?: string;
  maxLength?: number;
  /** Drawn beside the next `half` field from `sm` (first and last name). */
  half?: boolean;
  /** A placeholder, a key relative to `shop.auth`. */
  placeholderKey?: string;
  /** Help under the input, a key relative to `shop.auth`. */
  hintKey?: string;
  /** A link in a right-aligned row below the field ("ลืมรหัสผ่าน?"); `labelKey` is relative to `shop.auth`. */
  belowLink?: { href: string; labelKey: string };
  /** Show the password rules (`PASSWORD_RULES`, D-177) under this field, each ticked green as the typed password meets it (D-189). */
  showPasswordRules?: boolean;
  /** The name of the field this one must repeat; a green tick shows beside the label once both hold the same text (D-189). */
  confirmsField?: string;
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
  /** The primary button fills the card; the secondary is an outline button for a lesser action such as resend. */
  variant?: 'primary' | 'secondary';
  /** The primary button's colour: `buy` (yellow) for register, `brand` (blue) for the rest. */
  tone?: 'brand' | 'buy';
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
 * come back empty (D-182). A password that breaks the rules or a confirm field that does not match is caught here
 * before sending, so those never cost the customer what they typed (D-224): field errors beside their inputs, the form-wide
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
  variant = 'primary',
  tone = 'brand',
}: AuthFormProps) {
  const t = useTranslations('shop.auth');
  const locale = useLocale();
  const [state, formAction, isPending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  /**
   * What is typed into the fields that drive a live check (the field showing the rules, a confirm field and the field
   * it repeats); kept only in this component's memory, never sent anywhere.
   */
  const [typed, setTyped] = useState<Record<string, string>>({});
  const watched = new Set(
    fields.flatMap((field) => [
      ...(field.showPasswordRules ? [field.name] : []),
      ...(field.confirmsField !== undefined ? [field.name, field.confirmsField] : []),
    ]),
  );
  /**
   * Errors this browser found before sending (D-224): a password that breaks the rules, or a confirm field that does
   * not repeat it. The form is then not sent, so React's post-action reset never empties the passwords; the server
   * still checks both, for a browser without JavaScript.
   */
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  /**
   * The fields edited since the server last answered, tied to that answer: a field error the server gave is stale
   * once its field is changed, so it is hidden until the next answer (D-227). A new answer starts the list afresh.
   */
  const [edited, setEdited] = useState<{ answer: AuthFormState; names: string[] }>({ answer: state, names: [] });
  const editedSinceAnswer = (name: string): boolean => edited.answer === state && edited.names.includes(name);
  const trackTyped = (event: FormEvent<HTMLFormElement>) => {
    const { name, value } = event.target as HTMLInputElement;
    if (watched.has(name)) setTyped((previous) => ({ ...previous, [name]: value }));
    if (state.fieldErrors?.[name] !== undefined && !editedSinceAnswer(name)) {
      setEdited((previous) => ({ answer: state, names: previous.answer === state ? [...previous.names, name] : [name] }));
    }
    if (clientErrors[name] !== undefined) {
      setClientErrors((previous) => {
        const next = { ...previous };
        delete next[name];
        return next;
      });
    }
  };
  const checkBeforeSending = (event: FormEvent<HTMLFormElement>) => {
    const data = new FormData(event.currentTarget);
    const valueOf = (name: string) => {
      const value = data.get(name);
      return typeof value === 'string' ? value : '';
    };
    const errors: Record<string, string> = {};
    for (const field of fields) {
      const value = valueOf(field.name);
      // An empty password is left to the server, which asks for it; there is nothing typed to keep.
      if (field.showPasswordRules && value !== '' && failedPasswordRules(value).length > 0) {
        errors[field.name] = 'shop.auth.error.passwordPolicy';
      }
      if (field.confirmsField !== undefined && valueOf(field.confirmsField) !== '' && value !== valueOf(field.confirmsField)) {
        errors[field.name] = 'shop.auth.error.passwordMismatch';
      }
    }
    setClientErrors(errors);
    const first = firstInvalidField(fields, errors);
    if (first === null) return;
    event.preventDefault();
    formRef.current?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
  };
  /** A confirm field matches when it is not empty and holds exactly what the field it repeats holds. */
  const confirmMatches = (field: AuthFieldSpec): boolean =>
    field.confirmsField !== undefined && (typed[field.name] ?? '') !== '' && typed[field.name] === typed[field.confirmsField];

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
  const buttonStyle = buttonClass({ variant: variant === 'primary' ? tone : 'line', size: 'lg', block: true });

  const renderField = (field: AuthFieldSpec) => {
    const matched = confirmMatches(field);
    return (
      <Fragment key={field.name}>
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
          placeholder={field.placeholderKey === undefined ? undefined : t(field.placeholderKey)}
          revealable={field.type === 'password'}
          // A mismatch error from the last submit is stale once the two passwords match, and a server error once its
          // field is edited (D-227).
          error={
            matched
              ? undefined
              : message(clientErrors[field.name] ?? (editedSinceAnswer(field.name) ? undefined : state.fieldErrors?.[field.name]))
          }
          labelBadge={
            matched ? (
              <span data-confirm-match className="mb-1.5 inline-flex items-center text-ok">
                <CheckIcon />
                <span className="sr-only">{t('password.confirmMatch')}</span>
              </span>
            ) : undefined
          }
          hint={
            field.showPasswordRules ? (
              <>
                {field.hintKey !== undefined && <p>{t(field.hintKey)}</p>}
                <p>{t('password.rulesLabel')}</p>
                <ul className="mt-0.5 grid gap-0.5 text-[13px]">
                  {PASSWORD_RULES.map((rule) => {
                    const met = rule.test(typed[field.name] ?? '');
                    return (
                      <li
                        key={rule.id}
                        data-password-rule={rule.id}
                        data-met={met}
                        className={`flex items-start gap-1.5 ${met ? 'text-ok' : ''}`}
                      >
                        <span aria-hidden="true" className="inline-flex h-[1.4em] w-4 shrink-0 items-center justify-center">
                          {met ? <CheckIcon /> : <span className="size-1.5 rounded-full bg-current" />}
                        </span>
                        <span>
                          {message(rule.messageKey)}
                          {met && <span className="sr-only"> {t('password.ruleMet')}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : field.hintKey !== undefined ? (
              t(field.hintKey)
            ) : undefined
          }
        />
        {field.belowLink && (
          <div className="-mt-2 flex min-h-11 items-center justify-end">
            <Link href={field.belowLink.href} className={AUTH_LINK_CLASS}>
              {t(field.belowLink.labelKey)}
            </Link>
          </div>
        )}
      </Fragment>
    );
  };

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      className="grid gap-4"
      onInput={trackTyped}
      onSubmit={checkBeforeSending}
      // React 19 resets the form after an action, which empties the passwords; the ticks follow them.
      onReset={() => {
        setTyped({});
        setClientErrors({});
      }}
    >
      <input type="hidden" name="locale" value={locale} />
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {introKey !== undefined && <p className="text-ink-2">{t(introKey, introValues)}</p>}
      {/* Always in the page, so a screen reader is already watching it when the message arrives; empty, it takes no room. */}
      <div role="status" aria-live="polite" className={note === undefined ? 'sr-only' : undefined}>
        {note !== undefined && (
          <p className={`rounded-md px-4 py-3.5 text-[14.5px] ${state.formError ? 'bg-sale/8 text-sale' : 'bg-page text-ink-2'}`}>
            {note}
          </p>
        )}
      </div>
      {groupHalves(fields).map((group) =>
        group.length > 1 ? (
          <div key={group.map((field) => field.name).join('+')} className="grid gap-4 sm:grid-cols-2">
            {group.map(renderField)}
          </div>
        ) : (
          renderField(group[0]!)
        ),
      )}
      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className={`${buttonStyle} cursor-pointer disabled:cursor-wait disabled:opacity-70`}
      >
        {isPending ? t('pending') : t(submitKey)}
      </button>
    </form>
  );
}

/** Consecutive `half` fields share a row from `sm`; every other field is a group of one. */
function groupHalves(fields: AuthFieldSpec[]): AuthFieldSpec[][] {
  const groups: AuthFieldSpec[][] = [];
  for (const field of fields) {
    const last = groups[groups.length - 1];
    if (field.half && last?.every((member) => member.half)) last.push(field);
    else groups.push([field]);
  }
  return groups;
}

/** The green tick for a met password rule and a matching confirm field; decorative, the text beside it is what is read. */
function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8.5l3.2 3L13 4.5" />
    </svg>
  );
}
