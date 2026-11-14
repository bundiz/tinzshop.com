import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';

/** The locale from the route, or a 404; also sets it for the request. Every auth page starts here. */
export async function startAuthPage(params: Promise<{ locale: string }>): Promise<(typeof routing.locales)[number]> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return locale;
}

/** A search param's single value; the first when it is repeated. */
export function firstParam(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

export type AuthSearchParams = Promise<{ [key: string]: string | string[] | undefined }>;
