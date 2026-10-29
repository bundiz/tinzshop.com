import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { routing } from '@/i18n/routing';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

/** The not-found `<title>`. It lives in a layout because Next drops a page's metadata when the page calls `notFound()`. */
export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'shop.notFound' });
  return { title: t('meta.title') };
}

export default function CatchAllLayout({ children }: Props) {
  return children;
}
