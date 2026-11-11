import { createTranslator, NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PASSWORD_RESET_CODE_PATH } from '@/server/controllers/auth/customer-auth-controller';
import en from '../../../../../messages/en.json';
import th from '../../../../../messages/th.json';

const request = vi.hoisted(() => ({
  customer: null as { id: string; firstName: string; email: string } | null,
  pendingEmail: null as string | null,
}));

vi.mock('next-intl/server', () => ({
  setRequestLocale: () => {},
  getTranslations: async ({ locale, namespace }: { locale: 'th' | 'en'; namespace?: string }) =>
    createTranslator({ locale, messages: locale === 'th' ? th : en, namespace: namespace as never }),
}));
vi.mock('../_components/read-articles-menu', () => ({ readArticlesMenu: async () => [] }));
vi.mock('../_components/read-current-customer', () => ({ readCurrentCustomer: async () => request.customer }));
vi.mock('./auth-cookies', () => ({ readPendingEmail: async () => request.pendingEmail }));
// The Server Actions pull in the whole server graph; a render test only needs them to exist.
vi.mock('./actions', () => {
  const action = async () => ({});
  return {
    signInAction: action,
    registerAction: action,
    verifyAction: action,
    resendCodeAction: action,
    forgotPasswordAction: action,
    resetPasswordAction: action,
    signOutAction: action,
  };
});

const { default: SignInPage } = await import('./sign-in/page');
const { default: RegisterPage } = await import('./register/page');
const { default: VerifyPage } = await import('./register/verify/page');
const { default: ForgotPasswordPage } = await import('./forgot-password/page');

type Query = { [key: string]: string | string[] | undefined };
const params = (locale: string) => Promise.resolve({ locale });

function html(node: ReactNode, locale: 'th' | 'en' = 'th'): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={locale === 'th' ? th : en} timeZone="Asia/Bangkok">
      {node}
    </NextIntlClientProvider>,
  );
}

/** The `digest` of the error `redirect()` throws: `NEXT_REDIRECT;replace;{url};307;`. */
async function redirectOf(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    const digest = (error as { digest?: string }).digest ?? '';
    if (!digest.startsWith('NEXT_REDIRECT')) throw error;
    return digest.split(';')[2] ?? null;
  }
}

/** The card's header: the title block and the other page's link at the top right. */
const cardHeader = (page: string): string => page.match(/<header class="flex items-start[\s\S]*?<\/header>/)?.[0] ?? '';
const signIn = async (query: Query = {}, locale: 'th' | 'en' = 'th') =>
  html(await SignInPage({ params: params(locale), searchParams: Promise.resolve(query) }), locale);
const register = async (query: Query = {}, locale: 'th' | 'en' = 'th') =>
  html(await RegisterPage({ params: params(locale), searchParams: Promise.resolve(query) }), locale);
const verify = async () => html(await VerifyPage({ params: params('th') }));
const forgot = async (query: Query = {}) =>
  html(await ForgotPasswordPage({ params: params('th'), searchParams: Promise.resolve(query) }));

beforeEach(() => {
  request.customer = null;
  request.pendingEmail = null;
});

describe('the sign-in page', () => {
  it('shows email and password, the forgot link on the password label row, Google, and the register link at the top right', async () => {
    const page = await signIn();
    expect(page).toContain(`>${th.shop.auth.field.email}</label>`);
    expect(page.toLowerCase()).toContain('autocomplete="email"');
    expect(page.toLowerCase()).toContain('autocomplete="current-password"');
    // "ลืมรหัสผ่าน?" is in the same row as the password label, after it.
    expect(page).toMatch(
      new RegExp(`<label for="auth-password"[^>]*>${th.shop.auth.field.password}</label><a [^>]*href="/th/forgot-password"[^>]*>ลืมรหัสผ่าน\\?</a>`),
    );
    expect(page).toContain('href="/api/auth/google?returnTo=%2F&amp;locale=th"');
    expect(page).toContain('<svg');
    expect(cardHeader(page)).toContain('href="/th/register"');
    expect(cardHeader(page)).toContain(th.shop.auth.signIn.switchLink);
    expect(page).toContain('max-w-sm');
  });

  it('keeps the page the customer came from, and drops a returnTo that is not a path on this site', async () => {
    const path = `/product/abc/detail`;
    const page = await signIn({ returnTo: path });
    expect(page).toContain(`name="returnTo" value="${path}"`);
    expect(page).toContain(`href="/th/register?returnTo=${encodeURIComponent(path)}"`);
    expect(page).toContain(`returnTo=${encodeURIComponent(path)}&amp;locale=th`);
    for (const bad of ['//evil.test', 'https://evil.test', '/TH/product']) {
      expect(await signIn({ returnTo: bad }), bad).toContain('name="returnTo" value="/"');
    }
  });

  it('shows the notice a redirect carries and prefills the email from the pending cookie', async () => {
    request.pendingEmail = 'pending@example.test';
    const confirmed = await signIn({ confirmed: '1' });
    expect(confirmed).toContain(th.shop.auth.verify.confirmed);
    expect(confirmed).toContain('value="pending@example.test"');
    expect(await signIn({ reset: '1' })).toContain(th.shop.auth.signIn.reset);
    expect(await signIn({ error: 'google' })).toContain(th.shop.auth.signIn.googleFailed);
    // Without the flag the pending email is not put on the page.
    const plain = await signIn();
    expect(plain).not.toContain('pending@example.test');
    expect(plain).not.toContain(th.shop.auth.verify.confirmed);
    expect(await signIn({ error: 'google' }, 'en')).toContain(en.shop.auth.signIn.googleFailed);
  });

  it('signed-in customer opening sign-in goes home', async () => {
    request.customer = { id: 'c1', firstName: 'Test', email: 'test@example.test' };
    expect(await redirectOf(() => signIn())).toBe('/th');
    expect(await redirectOf(() => signIn({}, 'en'))).toBe('/en');
    expect(await redirectOf(() => register())).toBe('/th');
  });

  it('every auth form has a server action, so it works before hydration and puts nothing in the URL', async () => {
    request.pendingEmail = 'pending@example.test';
    const pages = [await signIn(), await register(), await verify(), await forgot(), await forgot({ step: 'reset' })];
    for (const page of pages) {
      const forms = [...page.matchAll(/<form\b[^>]*>/g)].map((m) => m[0]).filter((tag) => !tag.includes('role="search"'));
      expect(forms.length).toBeGreaterThan(0);
      for (const tag of forms) {
        expect(tag).toMatch(/\baction=/);
        expect(tag).not.toMatch(/method="get"/i);
      }
    }
  });

  it('keeps returnTo on the language switch', async () => {
    const path = '/product/abc/detail';
    const page = await signIn({ returnTo: path });
    expect(page).toContain(`href="/en/sign-in?returnTo=${encodeURIComponent(path)}"`);
    expect(await register({ returnTo: path })).toContain(`href="/en/register?returnTo=${encodeURIComponent(path)}"`);
  });

  it('answers an unknown locale with a 404', async () => {
    await expect(SignInPage({ params: params('fr'), searchParams: Promise.resolve({}) })).rejects.toMatchObject({
      digest: expect.stringContaining('404'),
    });
  });
});

describe('the register page', () => {
  it('shows the five fields with the right autocomplete, the password rules, Google, and the sign-in link at the top right', async () => {
    const page = await register();
    for (const key of ['firstName', 'lastName', 'email', 'password', 'passwordConfirm'] as const) {
      expect(page).toContain(`>${th.shop.auth.field[key]}</label>`);
    }
    for (const autocomplete of ['given-name', 'family-name', 'email', 'new-password']) {
      expect(page.toLowerCase()).toContain(`autocomplete="${autocomplete}"`);
    }
    // The five rules come from the one policy (D-177).
    for (const rule of Object.values(th.shop.auth.password.rule)) expect(page).toContain(rule);
    expect(page).toMatch(/aria-describedby="auth-password-hint"/);
    expect(page).toContain('href="/api/auth/google');
    expect(cardHeader(page)).toContain('href="/th/sign-in"');
    expect(page).not.toContain('forgot-password');
  });

  it('sends returnTo with the registration, as a hidden field', async () => {
    expect(await register({ returnTo: '/product/abc/detail' })).toContain('name="returnTo" value="/product/abc/detail"');
    expect(await register({ returnTo: '//evil.test' })).toContain('name="returnTo" value="/"');
  });

  it('explains a timed-out verify step', async () => {
    expect(await register({ expired: '1' })).toContain(th.shop.auth.notice.expired);
    expect(await register()).not.toContain(th.shop.auth.notice.expired);
  });
});

describe('the verify page', () => {
  it('shows the code field, a resend button, and always the link to the reset step', async () => {
    request.pendingEmail = 'pending@example.test';
    const page = await verify();
    expect(page.toLowerCase()).toContain('autocomplete="one-time-code"');
    expect(page.toLowerCase()).toContain('inputmode="numeric"');
    expect(page).toContain('pending@example.test');
    expect(page).toContain(th.shop.auth.verify.resend);
    expect(page).toContain(`href="/th${PASSWORD_RESET_CODE_PATH}"`);
    expect(page).toContain('ได้รับอีเมลรีเซ็ตรหัสผ่านแทน? ตั้งรหัสผ่านใหม่');
    expect(en.shop.auth.verify.resetInstead).toBe('Got a password-reset email instead? Set a new password');
  });

  it('shows the signed-in customer\'s name in the header', async () => {
    request.pendingEmail = 'pending@example.test';
    request.customer = { id: 'c1', firstName: 'Tester', email: 'test@example.test' };
    expect(await verify()).toContain('Tester');
    expect(await forgot()).toContain('Tester');
  });

  it('sends a visitor with no pending email back to register with a notice', async () => {
    expect(await redirectOf(() => verify())).toBe('/th/register?expired=1');
  });
});

describe('the forgot-password page', () => {
  it('starts with the email step', async () => {
    const page = await forgot();
    expect(page).toContain(`>${th.shop.auth.field.email}</label>`);
    expect(page.toLowerCase()).toContain('autocomplete="email"');
    expect(page).not.toContain(`>${th.shop.auth.field.code}</label>`);
    expect(cardHeader(page)).toContain('href="/th/sign-in"');
  });

  it('?step=reset shows the code and new-password fields for the email in the pending cookie', async () => {
    request.pendingEmail = 'pending@example.test';
    const page = await forgot({ step: 'reset' });
    expect(page).toContain(`>${th.shop.auth.field.code}</label>`);
    expect(page).toContain(`>${th.shop.auth.field.newPassword}</label>`);
    expect(page).toContain(`>${th.shop.auth.field.newPasswordConfirm}</label>`);
    expect(page.toLowerCase()).toContain('autocomplete="one-time-code"');
    expect(page.toLowerCase()).toContain('autocomplete="new-password"');
    for (const rule of Object.values(th.shop.auth.password.rule)) expect(page).toContain(rule);
    expect(page).not.toContain(`>${th.shop.auth.field.email}</label>`);
  });

  it('?step=reset without a pending email shows the email step', async () => {
    const page = await forgot({ step: 'reset' });
    expect(page).toContain(`>${th.shop.auth.field.email}</label>`);
    expect(page).not.toContain(`>${th.shop.auth.field.code}</label>`);
  });

  it('explains a timed-out reset step', async () => {
    expect(await forgot({ expired: '1' })).toContain(th.shop.auth.notice.expired);
  });
});
