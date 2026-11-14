import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { safeReturnTo } from '@/server/services/auth/return-to';
import { readArticlesMenu } from '../../_components/read-articles-menu';
import { redirectSignedInHome } from '../../_components/require-customer';
import { readPendingEmail } from '../auth-cookies';
import { signInAction } from '../actions';
import { firstParam, startAuthPage, type AuthSearchParams } from '../auth-page';
import AuthCard, { AUTH_LINK_CLASS } from '../_components/AuthCard';
import AuthForm from '../_components/AuthForm';
import AuthNotice from '../_components/AuthNotice';
import AuthShell from '../_components/AuthShell';
import GoogleButton from '../_components/GoogleButton';

// Depends on the session cookie, so never statically cached.
export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: AuthSearchParams;
};

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'shop.auth.signIn' });
  return { title: t('title') };
}

/**
 * `/{locale}/sign-in` (plan 014): email and password, "ลืมรหัสผ่าน?" below the password, Google, and the register link under the title. It shows the
 * notices a redirect carries (`?confirmed=1`, `?reset=1`, `?error=google`, `?error=blocked`); the email is prefilled from the pending
 * cookie after a verify or a reset (R1, D-173). A signed-in customer goes home.
 */
export default async function SignInPage({ params, searchParams }: Props) {
  const locale = await startAuthPage(params);
  await redirectSignedInHome(locale);
  const query = await searchParams;
  const returnTo = safeReturnTo(firstParam(query.returnTo));
  const confirmed = firstParam(query.confirmed) === '1';
  const reset = firstParam(query.reset) === '1';
  const googleFailed = firstParam(query.error) === 'google';
  const blocked = firstParam(query.error) === 'blocked';
  const [t, articlesMenu, pendingEmail] = await Promise.all([
    getTranslations({ locale, namespace: 'shop.auth' }),
    readArticlesMenu(locale),
    confirmed || reset ? readPendingEmail() : Promise.resolve(null),
  ]);
  const withReturn = returnTo === '/' ? '' : `?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <AuthShell path={`/sign-in${withReturn}`} articlesMenu={articlesMenu} breadcrumb={t('signIn.title')} perks="signIn">
      <AuthCard
        title={t('signIn.title')}
        switchPrompt={t.rich('signIn.switchPrompt', {
          link: (chunks) => (
            <Link href={`/${locale}/register${withReturn}`} className={AUTH_LINK_CLASS}>
              {chunks}
            </Link>
          ),
        })}
      >
        {confirmed && <AuthNotice tone="success">{t('verify.confirmed')}</AuthNotice>}
        {reset && <AuthNotice tone="success">{t('signIn.reset')}</AuthNotice>}
        {blocked && <AuthNotice tone="error">{t('error.accountBlocked')}</AuthNotice>}
        {googleFailed && <AuthNotice tone="error">{t('signIn.googleFailed')}</AuthNotice>}
        <AuthForm
          action={signInAction}
          submitKey="signIn.submit"
          hidden={{ returnTo }}
          fields={[
            {
              name: 'email',
              labelKey: 'field.email',
              type: 'email',
              autoComplete: 'email',
              placeholderKey: 'field.emailPlaceholder',
              defaultValue: pendingEmail ?? undefined,
            },
            {
              name: 'password',
              labelKey: 'field.password',
              type: 'password',
              autoComplete: 'current-password',
              belowLink: { href: `/${locale}/forgot-password${withReturn}`, labelKey: 'signIn.forgot' },
            },
          ]}
        />
        <GoogleButton locale={locale} returnTo={returnTo} labelKey="google.label" />
      </AuthCard>
    </AuthShell>
  );
}
