import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { safeReturnTo } from '@/server/services/auth/return-to';
import { readArticlesMenu } from '../../_components/read-articles-menu';
import { readCurrentCustomer } from '../../_components/read-current-customer';
import { readPendingEmail } from '../auth-cookies';
import { forgotPasswordAction, resendResetCodeAction, resetPasswordAction } from '../actions';
import { firstParam, startAuthPage, type AuthSearchParams } from '../auth-page';
import AuthCard, { AUTH_LINK_CLASS } from '../_components/AuthCard';
import AuthForm from '../_components/AuthForm';
import AuthNotice from '../_components/AuthNotice';
import AuthShell from '../_components/AuthShell';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: AuthSearchParams;
};

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'shop.auth.forgot' });
  return { title: t('title') };
}

/**
 * `/{locale}/forgot-password` (plan 014): the email step, then the code and a new password. The email step's action
 * redirects to `?step=reset`, so the code step survives a reload and needs no client-side swap (the pending cookie is
 * set in the same response). `?step=reset` is also where the verify page's link goes (Q-060, D-179) and sends no new
 * code; with no pending email it shows the email step. The code step has "Send a new code", so an expired code is
 * never a dead end, and `&setPassword=1` (a verify on an account not created in this browser, Q-061, D-186) explains
 * that a second code was sent to set the password. `?returnTo=` from the sign-in page's link is sent with the email.
 */
export default async function ForgotPasswordPage({ params, searchParams }: Props) {
  const locale = await startAuthPage(params);
  const query = await searchParams;
  const pendingEmail = firstParam(query.step) === 'reset' ? await readPendingEmail() : null;
  const returnTo = safeReturnTo(firstParam(query.returnTo));
  const withReturn = returnTo === '/' ? '' : `?returnTo=${encodeURIComponent(returnTo)}`;
  const [t, articlesMenu, customer] = await Promise.all([
    getTranslations({ locale, namespace: 'shop.auth' }),
    readArticlesMenu(locale),
    readCurrentCustomer(),
  ]);

  const resetForm = (
    <>
      <AuthForm
        action={resetPasswordAction}
        submitKey="forgot.resetSubmit"
        introKey="forgot.codeIntro"
        fields={[
          { name: 'code', labelKey: 'field.code', type: 'text', autoComplete: 'one-time-code', inputMode: 'numeric', maxLength: 6 },
          { name: 'password', labelKey: 'field.newPassword', type: 'password', autoComplete: 'new-password', showPasswordRules: true },
          { name: 'passwordConfirm', labelKey: 'field.newPasswordConfirm', type: 'password', autoComplete: 'new-password', confirmsField: 'password' },
        ]}
      />
      <div className="mt-3">
        <AuthForm action={resendResetCodeAction} submitKey="forgot.resend" variant="secondary" fields={[]} />
      </div>
    </>
  );

  return (
    <AuthShell
      path={`/forgot-password${pendingEmail !== null ? '?step=reset' : ''}`}
      articlesMenu={articlesMenu}
      customer={customer}
      breadcrumb={t('forgot.title')}
      perks={null}
    >
      <AuthCard
        title={t('forgot.title')}
        description={t('forgot.description')}
        switchPrompt={
          <Link href={`/${locale}/sign-in${withReturn}`} className={AUTH_LINK_CLASS}>
            {t('forgot.switchLink')}
          </Link>
        }
      >
        {firstParam(query.expired) === '1' && <AuthNotice tone="info">{t('notice.expired')}</AuthNotice>}
        {pendingEmail !== null && firstParam(query.setPassword) === '1' && (
          <AuthNotice tone="info">{t('forgot.setPassword')}</AuthNotice>
        )}
        {pendingEmail !== null ? (
          resetForm
        ) : (
          <AuthForm
            action={forgotPasswordAction}
            submitKey="forgot.submit"
            introKey="forgot.emailIntro"
            hidden={returnTo === '/' ? undefined : { returnTo }}
            fields={[{ name: 'email', labelKey: 'field.email', type: 'email', autoComplete: 'email', maxLength: 254, placeholderKey: 'field.emailPlaceholder' }]}
          />
        )}
      </AuthCard>
    </AuthShell>
  );
}
