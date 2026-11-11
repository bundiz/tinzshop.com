import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PASSWORD_RULES } from '@/server/services/auth/password-policy';
import { readArticlesMenu } from '../../_components/read-articles-menu';
import { readCurrentCustomer } from '../../_components/read-current-customer';
import { readPendingEmail } from '../auth-cookies';
import { forgotPasswordAction, resetPasswordAction } from '../actions';
import { firstParam, startAuthPage, type AuthSearchParams } from '../auth-page';
import AuthCard from '../_components/AuthCard';
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
 * code; with no pending email it shows the email step.
 */
export default async function ForgotPasswordPage({ params, searchParams }: Props) {
  const locale = await startAuthPage(params);
  const query = await searchParams;
  const pendingEmail = firstParam(query.step) === 'reset' ? await readPendingEmail() : null;
  const [t, articlesMenu, customer] = await Promise.all([
    getTranslations({ locale, namespace: 'shop.auth' }),
    readArticlesMenu(locale),
    readCurrentCustomer(),
  ]);

  const resetForm = (
    <AuthForm
      action={resetPasswordAction}
      submitKey="forgot.resetSubmit"
      introKey="forgot.codeIntro"
      passwordRuleKeys={PASSWORD_RULES.map((rule) => rule.messageKey)}
      fields={[
        { name: 'code', labelKey: 'field.code', type: 'text', autoComplete: 'one-time-code', inputMode: 'numeric', maxLength: 6 },
        { name: 'password', labelKey: 'field.newPassword', type: 'password', autoComplete: 'new-password', showPasswordRules: true },
        { name: 'passwordConfirm', labelKey: 'field.newPasswordConfirm', type: 'password', autoComplete: 'new-password' },
      ]}
    />
  );

  return (
    <AuthShell
      path={`/forgot-password${pendingEmail !== null ? '?step=reset' : ''}`}
      articlesMenu={articlesMenu}
      customer={customer}
    >
      <AuthCard
        title={t('forgot.title')}
        description={t('forgot.description')}
        switchHref={`/${locale}/sign-in`}
        switchLabel={t('forgot.switchLink')}
      >
        {firstParam(query.expired) === '1' && <AuthNotice tone="info">{t('notice.expired')}</AuthNotice>}
        {pendingEmail !== null ? (
          resetForm
        ) : (
          <AuthForm
            action={forgotPasswordAction}
            submitKey="forgot.submit"
            introKey="forgot.emailIntro"
            fields={[{ name: 'email', labelKey: 'field.email', type: 'email', autoComplete: 'email', maxLength: 254 }]}
          />
        )}
      </AuthCard>
    </AuthShell>
  );
}
