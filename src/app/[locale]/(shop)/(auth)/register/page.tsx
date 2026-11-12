import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { safeReturnTo } from '@/server/services/auth/return-to';
import { readArticlesMenu } from '../../_components/read-articles-menu';
import { redirectSignedInHome } from '../../_components/require-customer';
import { registerAction } from '../actions';
import { firstParam, startAuthPage, type AuthSearchParams } from '../auth-page';
import AuthCard, { AUTH_LINK_CLASS } from '../_components/AuthCard';
import AuthForm from '../_components/AuthForm';
import AuthNotice from '../_components/AuthNotice';
import AuthShell from '../_components/AuthShell';
import GoogleButton from '../_components/GoogleButton';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: AuthSearchParams;
};

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'shop.auth.register' });
  return { title: t('title') };
}

/**
 * `/{locale}/register` (plan 014): first name, last name, email, the password twice with the password rules (the
 * one policy, D-177), Google, and the sign-in link under the title. `?expired=1` explains a verify step that timed out.
 */
export default async function RegisterPage({ params, searchParams }: Props) {
  const locale = await startAuthPage(params);
  await redirectSignedInHome(locale);
  const query = await searchParams;
  const returnTo = safeReturnTo(firstParam(query.returnTo));
  const [t, articlesMenu] = await Promise.all([getTranslations({ locale, namespace: 'shop.auth' }), readArticlesMenu(locale)]);
  const withReturn = returnTo === '/' ? '' : `?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <AuthShell path={`/register${withReturn}`} articlesMenu={articlesMenu} breadcrumb={t('register.title')} perks="register">
      <AuthCard
        title={t('register.title')}
        switchPrompt={t.rich('register.switchPrompt', {
          link: (chunks) => (
            <Link href={`/${locale}/sign-in${withReturn}`} className={AUTH_LINK_CLASS}>
              {chunks}
            </Link>
          ),
        })}
      >
        {firstParam(query.expired) === '1' && <AuthNotice tone="info">{t('notice.expired')}</AuthNotice>}
        <AuthForm
          action={registerAction}
          submitKey="register.submit"
          tone="buy"
          hidden={{ returnTo }}
          fields={[
            { name: 'firstName', labelKey: 'field.firstName', type: 'text', autoComplete: 'given-name', maxLength: 100, half: true },
            { name: 'lastName', labelKey: 'field.lastName', type: 'text', autoComplete: 'family-name', maxLength: 100, half: true },
            {
              name: 'email',
              labelKey: 'field.email',
              type: 'email',
              autoComplete: 'email',
              maxLength: 254,
              hintKey: 'field.emailHint',
              placeholderKey: 'field.emailPlaceholder',
            },
            { name: 'password', labelKey: 'field.password', type: 'password', autoComplete: 'new-password', showPasswordRules: true },
            { name: 'passwordConfirm', labelKey: 'field.passwordConfirm', type: 'password', autoComplete: 'new-password', confirmsField: 'password' },
          ]}
        />
        <GoogleButton locale={locale} returnTo={returnTo} labelKey="google.register" />
      </AuthCard>
    </AuthShell>
  );
}
