// @vitest-environment jsdom
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthFormState } from '@/server/controllers/auth/customer-auth-controller';
import th from '../../../../../../messages/th.json';
import AuthForm, { firstInvalidField, type AuthFieldSpec } from './AuthForm';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FIELDS: AuthFieldSpec[] = [
  { name: 'email', labelKey: 'field.email', type: 'email', autoComplete: 'email' },
  { name: 'password', labelKey: 'field.password', type: 'password', autoComplete: 'current-password' },
];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

type Action = (previous: AuthFormState, formData: FormData) => Promise<AuthFormState>;

function mount(action: Action, extra: Partial<Parameters<typeof AuthForm>[0]> = {}) {
  act(() =>
    root.render(
      <NextIntlClientProvider locale="th" messages={th} timeZone="Asia/Bangkok">
        <AuthForm action={action} fields={FIELDS} submitKey="signIn.submit" hidden={{ returnTo: '/product' }} {...extra} />
      </NextIntlClientProvider>,
    ),
  );
}

const field = (name: string) => container.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
const type = (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const submit = async () => {
  await act(async () => {
    container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
};

describe('AuthForm', () => {
  it('sends the fields, the locale and the hidden values to the action', async () => {
    const action = vi.fn<Action>(async () => ({}));
    mount(action);
    type(field('email'), 'a@example.test');
    type(field('password'), 'secret');
    await submit();
    const data = action.mock.calls[0]![1];
    expect(Object.fromEntries(data.entries())).toEqual({
      locale: 'th',
      returnTo: '/product',
      email: 'a@example.test',
      password: 'secret',
    });
  });

  it('shows a field error beside its input, linked with aria-describedby, and keeps what was typed', async () => {
    mount(async () => ({ fieldErrors: { password: 'shop.auth.error.passwordRequired' } }));
    type(field('email'), 'a@example.test');
    await submit();
    const password = field('password');
    const error = container.querySelector(`#${password.getAttribute('aria-describedby')}`)!;
    expect(error.textContent).toBe(th.shop.auth.error.passwordRequired);
    expect(password.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(password);
    expect(field('email').value).toBe('a@example.test');
  });

  it('puts the form error in a polite live region, in our words', async () => {
    mount(async () => ({ formError: 'shop.auth.error.invalidCredentials' }));
    await submit();
    const live = container.querySelector('[aria-live="polite"]')!;
    expect(live.textContent).toBe(th.shop.auth.error.invalidCredentials);
  });

  it('never shows a message that is not one of our shop.auth keys', async () => {
    mount(async () => ({ formError: 'Cognito says: UserNotFoundException' }));
    await submit();
    expect(container.querySelector('[aria-live="polite"]')!.textContent).toBe(th.shop.auth.error.unavailable);
  });

  it('shows a notice such as "code sent again"', async () => {
    mount(async () => ({ notice: 'shop.auth.verify.resent' }), { fields: [], submitKey: 'verify.resend' });
    await submit();
    expect(container.querySelector('[aria-live="polite"]')!.textContent).toBe(th.shop.auth.verify.resent);
  });

  it('disables the button and says it is working while the action runs', async () => {
    let finish: (state: AuthFormState) => void = () => {};
    mount(() => new Promise<AuthFormState>((resolve) => (finish = resolve)));
    await submit();
    const button = container.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe(th.shop.auth.pending);
    await act(async () => finish({}));
    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe(th.shop.auth.signIn.submit);
  });

  it('replaces itself with the reset step when the action answers step "reset"', async () => {
    mount(async () => ({ step: 'reset' }), { resetStep: <p id="next">next</p> });
    await submit();
    expect(container.querySelector('#next')).not.toBeNull();
    expect(container.querySelector('form')).toBeNull();
  });
});

describe('firstInvalidField', () => {
  it('is the first drawn field that has an error', () => {
    expect(firstInvalidField(FIELDS, { password: 'x', email: 'y' })).toBe('email');
    expect(firstInvalidField(FIELDS, undefined)).toBeNull();
    expect(firstInvalidField(FIELDS, { other: 'x' })).toBeNull();
  });
});
