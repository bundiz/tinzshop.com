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

  it('shows a field error beside its input, linked with aria-describedby, and keeps the echoed email', async () => {
    mount(async () => ({ fieldErrors: { password: 'shop.auth.error.passwordRequired' }, values: { email: 'a@example.test' } }));
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

  it('re-seeds the email and names after an error, and leaves password fields empty', async () => {
    mount(async () => ({ fieldErrors: { password: 'shop.auth.error.passwordRequired' }, values: { email: 'kept@example.test', firstName: 'Kept' } }), {
      fields: [
        { name: 'firstName', labelKey: 'field.firstName', type: 'text', autoComplete: 'given-name' },
        ...FIELDS,
      ],
    });
    type(field('firstName'), 'Typed');
    type(field('email'), 'typed@example.test');
    type(field('password'), 'secret');
    await submit();
    expect(field('email').value).toBe('kept@example.test');
    expect(field('firstName').value).toBe('Kept');
    expect(field('password').value).toBe('');
  });

  it('keeps the page-given default (the pending email) until the server answers with values', () => {
    mount(async () => ({}), { fields: [{ ...FIELDS[0]!, defaultValue: 'pending@example.test' }, FIELDS[1]!] });
    expect(field('email').value).toBe('pending@example.test');
  });

  it('always renders the live region, with no display:none, empty or not', async () => {
    mount(async () => ({ formError: 'shop.auth.error.invalidCredentials' }));
    const region = () => container.querySelector('[role="status"][aria-live="polite"]')!;
    expect(region()).not.toBeNull();
    expect(region().hasAttribute('hidden')).toBe(false);
    expect(region().className).not.toMatch(/(^|\s)hidden(\s|$)/);
    const before = region();
    await submit();
    expect(region()).toBe(before);
    expect(region().textContent).toBe(th.shop.auth.error.invalidCredentials);
  });

  describe('password rules checklist', () => {
    const RULE_FIELDS: AuthFieldSpec[] = [
      { name: 'password', labelKey: 'field.password', type: 'password', autoComplete: 'new-password', showPasswordRules: true },
      { name: 'passwordConfirm', labelKey: 'field.passwordConfirm', type: 'password', autoComplete: 'new-password' },
    ];
    const rules = () => [...container.querySelectorAll<HTMLLIElement>('[data-password-rule]')];
    const met = () => rules().filter((rule) => rule.dataset.met === 'true').map((rule) => rule.dataset.passwordRule);

    it('shows every rule as not met while the password is empty', () => {
      mount(async () => ({}), { fields: RULE_FIELDS });
      expect(rules().map((rule) => rule.dataset.passwordRule)).toEqual(['length', 'number', 'lowercase', 'uppercase', 'special']);
      expect(met()).toEqual([]);
    });

    it('marks each rule met as the password is typed', () => {
      mount(async () => ({}), { fields: RULE_FIELDS });
      type(field('password'), 'abc');
      expect(met()).toEqual(['lowercase']);
      type(field('password'), 'abcDEF12');
      expect(met()).toEqual(['length', 'number', 'lowercase', 'uppercase']);
      type(field('password'), 'abcDEF12!');
      expect(met()).toEqual(['length', 'number', 'lowercase', 'uppercase', 'special']);
    });

    it('tells a screen reader which rules are met', () => {
      mount(async () => ({}), { fields: RULE_FIELDS });
      type(field('password'), 'abc');
      const lowercase = rules().find((rule) => rule.dataset.passwordRule === 'lowercase')!;
      const length = rules().find((rule) => rule.dataset.passwordRule === 'length')!;
      expect(lowercase.textContent).toContain(th.shop.auth.password.ruleMet);
      expect(length.textContent).not.toContain(th.shop.auth.password.ruleMet);
    });

    it('ignores typing in the other password field', () => {
      mount(async () => ({}), { fields: RULE_FIELDS });
      type(field('passwordConfirm'), 'abcDEF12!');
      expect(met()).toEqual([]);
    });

    it('goes back to not met after the action clears the password', async () => {
      mount(async () => ({ formError: 'shop.auth.error.passwordPolicy' }), { fields: RULE_FIELDS });
      type(field('password'), 'abcDEF12!');
      await submit();
      expect(field('password').value).toBe('');
      expect(met()).toEqual([]);
    });
  });

  describe('confirm password match tick', () => {
    const CONFIRM_FIELDS: AuthFieldSpec[] = [
      { name: 'password', labelKey: 'field.password', type: 'password', autoComplete: 'new-password', showPasswordRules: true },
      { name: 'passwordConfirm', labelKey: 'field.passwordConfirm', type: 'password', autoComplete: 'new-password', confirmsField: 'password' },
    ];
    const tick = () => container.querySelector('[data-confirm-match]');

    it('shows no tick while either field is empty', () => {
      mount(async () => ({}), { fields: CONFIRM_FIELDS });
      expect(tick()).toBeNull();
      type(field('password'), 'abcDEF12!');
      expect(tick()).toBeNull();
    });

    it('shows a tick beside the confirm label once both passwords are the same', () => {
      mount(async () => ({}), { fields: CONFIRM_FIELDS });
      type(field('password'), 'abcDEF12!');
      type(field('passwordConfirm'), 'abcDEF12');
      expect(tick()).toBeNull();
      type(field('passwordConfirm'), 'abcDEF12!');
      const label = container.querySelector('label[for="auth-passwordConfirm"]')!;
      expect(label.parentElement!.contains(tick())).toBe(true);
      expect(tick()!.textContent).toContain(th.shop.auth.password.confirmMatch);
    });

    it('removes the tick when the first password changes again', () => {
      mount(async () => ({}), { fields: CONFIRM_FIELDS });
      type(field('password'), 'abcDEF12!');
      type(field('passwordConfirm'), 'abcDEF12!');
      type(field('password'), 'abcDEF12!x');
      expect(tick()).toBeNull();
    });

    it('hides the stale mismatch error once the passwords match', async () => {
      mount(async () => ({ fieldErrors: { passwordConfirm: 'shop.auth.error.passwordMismatch' } }), { fields: CONFIRM_FIELDS });
      await submit();
      expect(container.textContent).toContain(th.shop.auth.error.passwordMismatch);
      type(field('password'), 'abcDEF12!');
      type(field('passwordConfirm'), 'abcDEF12!');
      expect(container.textContent).not.toContain(th.shop.auth.error.passwordMismatch);
      expect(field('passwordConfirm').hasAttribute('aria-invalid')).toBe(false);
    });

    it('clears the tick after the action resets the form', async () => {
      mount(async () => ({ formError: 'shop.auth.error.unavailable' }), { fields: CONFIRM_FIELDS });
      type(field('password'), 'abcDEF12!');
      type(field('passwordConfirm'), 'abcDEF12!');
      await submit();
      expect(tick()).toBeNull();
    });
  });
});

describe('show and hide password', () => {
  const RULE_FIELDS: AuthFieldSpec[] = [
    { name: 'password', labelKey: 'field.password', type: 'password', autoComplete: 'new-password', showPasswordRules: true },
    { name: 'passwordConfirm', labelKey: 'field.passwordConfirm', type: 'password', autoComplete: 'new-password', confirmsField: 'password' },
  ];
  const reveal = (name: string) => container.querySelector<HTMLButtonElement>(`[aria-controls="auth-${name}"]`)!;
  const click = (button: HTMLButtonElement) => act(() => button.click());
  const met = () => [...container.querySelectorAll<HTMLElement>('[data-password-rule]')].filter((rule) => rule.dataset.met === 'true').length;

  it('the show button reveals and hides the password, is type=button and never submits', () => {
    const action = vi.fn<Action>(async () => ({}));
    mount(action);
    let submitted = false;
    container.querySelector('form')!.addEventListener('submit', () => (submitted = true));
    const button = reveal('password');
    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.getAttribute('aria-label')).toBe(th.shop.auth.password.showLabel);
    expect(button.textContent).toBe(th.shop.auth.password.show);
    expect(field('password').type).toBe('password');
    type(field('password'), 'secret');
    click(button);
    expect(field('password').type).toBe('text');
    expect(field('password').value).toBe('secret');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe(th.shop.auth.password.hideLabel);
    expect(button.textContent).toBe(th.shop.auth.password.hide);
    click(button);
    expect(field('password').type).toBe('password');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(submitted).toBe(false);
    expect(action).not.toHaveBeenCalled();
    // Only password fields have one.
    expect(reveal('email')).toBeNull();
  });

  it('after an action resets the form, the password field is hidden again and the ticks clear', async () => {
    mount(async () => ({ formError: 'shop.auth.error.passwordPolicy' }), { fields: RULE_FIELDS });
    type(field('password'), 'abcDEF12!');
    type(field('passwordConfirm'), 'abcDEF12!');
    click(reveal('password'));
    expect(field('password').type).toBe('text');
    expect(met()).toBe(5);
    await submit();
    expect(field('password').value).toBe('');
    expect(field('password').type).toBe('password');
    expect(reveal('password').getAttribute('aria-pressed')).toBe('false');
    expect(met()).toBe(0);
    expect(container.querySelector('[data-confirm-match]')).toBeNull();
  });

  it('revealing the password does not stop the rule ticks', () => {
    mount(async () => ({}), { fields: RULE_FIELDS });
    click(reveal('password'));
    type(field('password'), 'abc');
    expect(met()).toBe(1);
    type(field('password'), 'abcDEF12!');
    expect(met()).toBe(5);
    type(field('passwordConfirm'), 'abcDEF12!');
    expect(container.querySelector('[data-confirm-match]')).not.toBeNull();
    click(reveal('password'));
    expect(met()).toBe(5);
  });
});

describe('firstInvalidField', () => {
  it('is the first drawn field that has an error', () => {
    expect(firstInvalidField(FIELDS, { password: 'x', email: 'y' })).toBe('email');
    expect(firstInvalidField(FIELDS, undefined)).toBeNull();
    expect(firstInvalidField(FIELDS, { other: 'x' })).toBeNull();
  });
});
