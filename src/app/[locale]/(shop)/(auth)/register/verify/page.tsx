import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PASSWORD_RESET_CODE_PATH } from '@/server/controllers/auth/customer-auth-controller';
import { readArticlesMenu } from '../../../_components/read-articles-menu';
import { readCurrentCustomer } from '../../../_components/read-current-customer';
import { readPendingEmail } from '../../auth-cookies';
import { resendCodeAction, verifyAction } from '../../actions';
import { startAuthPage } from '../../auth-page';
import AuthCard, { AUTH_LINK_CLASS } from '../../_components/AuthCard';
import AuthForm from '../../_components/AuthForm';
import AuthShell from '../../_components/AuthShell';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'shop.auth.verify' });
  return { title: t('title') };
}

/**
 * `/{locale}/register/verify` (plan 014): the 6-digit code, a resend button, and always the link to the password
 * reset step (Q-060, D-179), so the page looks the same whoever owns the email. The email comes from the sealed
 * pending cookie, read only; with none (it expired, or the page was opened directly) the visitor starts again.
 */
export default async function VerifyPage({ params }: Props) {
  const locale = await startAuthPage(params);
  const email = await readPendingEmail();
  if (email === null) redirect(`/${locale}/register?expired=1`);
  const [t, articlesMenu, customer] = await Promise.all([
    getTranslations({ locale, namespace: 'shop.auth' }),
    readArticlesMenu(locale),
    readCurrentCustomer(),
  ]);

  return (
    <AuthShell path="/register/verify" articlesMenu={articlesMenu} customer={customer} breadcrumb={t('verify.title')} perks={null}>
      <AuthCard
        title={t('verify.title')}
        description={t('verify.description', { email })}
        switchPrompt={
          <Link href={`/${locale}/sign-in`} className={AUTH_LINK_CLASS}>
            {t('register.switchLink')}
          </Link>
        }
      >
        <AuthForm
          action={verifyAction}
          submitKey="verify.submit"
          fields={[
            { name: 'code', labelKey: 'field.code', type: 'text', autoComplete: 'one-time-code', inputMode: 'numeric', maxLength: 6 },
          ]}
        />
        <div className="mt-3">
          <AuthForm action={resendCodeAction} submitKey="verify.resend" variant="secondary" fields={[]} />
        </div>
        <p className="mt-3 text-center text-sm">
          <Link
            href={`/${locale}${PASSWORD_RESET_CODE_PATH}`}
            className={AUTH_LINK_CLASS}
          >
            {t('verify.resetInstead')}
          </Link>
        </p>
      </AuthCard>
    </AuthShell>
  );
}
