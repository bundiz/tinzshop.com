import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { safeReturnTo } from '@/server/services/auth/return-to';
import { readArticlesMenu } from '../../_components/read-articles-menu';
import { redirectSignedInHome } from '../../_components/require-customer';
import { readPendingEmail } from '../auth-cookies';
import { signInAction } from '../actions';
import { firstParam, startAuthPage, type AuthSearchParams } from '../auth-page';
import AuthCard from '../_components/AuthCard';
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
 * `/{locale}/sign-in` (plan 014): email and password, "ลืมรหัสผ่าน?", Google, and the link to register. It shows the
 * notices a redirect carries (`?confirmed=1`, `?reset=1`, `?error=google`); the email is prefilled from the pending
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
  const [t, articlesMenu, pendingEmail] = await Promise.all([
    getTranslations({ locale, namespace: 'shop.auth' }),
    readArticlesMenu(locale),
    confirmed || reset ? readPendingEmail() : Promise.resolve(null),
  ]);
  const withReturn = returnTo === '/' ? '' : `?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <AuthShell path="/sign-in" articlesMenu={articlesMenu}>
      <AuthCard
        title={t('signIn.title')}
        description={t('signIn.description')}
        switchHref={`/${locale}/register${withReturn}`}
        switchLabel={t('signIn.switchLink')}
      >
        {confirmed && <AuthNotice tone="info">{t('verify.confirmed')}</AuthNotice>}
        {reset && <AuthNotice tone="info">{t('signIn.reset')}</AuthNotice>}
        {googleFailed && <AuthNotice tone="error">{t('signIn.googleFailed')}</AuthNotice>}
        <AuthForm
          action={signInAction}
          submitKey="signIn.submit"
          hidden={{ returnTo }}
          fields={[
            { name: 'email', labelKey: 'field.email', type: 'email', autoComplete: 'email', defaultValue: pendingEmail ?? undefined },
            {
              name: 'password',
              labelKey: 'field.password',
              type: 'password',
              autoComplete: 'current-password',
              labelLink: { href: `/${locale}/forgot-password`, labelKey: 'signIn.forgot' },
            },
          ]}
        />
        <GoogleButton locale={locale} returnTo={returnTo} />
      </AuthCard>
    </AuthShell>
  );
}
