import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getNewsAdmin } from '@/server/composition-root';
import { requirePermission } from '../../_lib/require-permission';
import ArticleEditor from '../_components/ArticleEditor';
import { listedCategoryOptions } from '../_lib/categories';

type Props = { params: Promise<{ locale: string }> };

/** `/{locale}/admin/news/new`: a blank article; the byline starts as the signed-in editor's first name. Needs `news.manage`. */
export default async function NewNewsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const editor = await requirePermission(locale, '/admin/news/new', 'news.manage');
  const t = await getTranslations({ locale, namespace: 'admin.news' });
  const categories = listedCategoryOptions(await getNewsAdmin().categories(), locale);

  return (
    <>
      <h1 className="mb-4 font-head text-[24px] font-bold text-ink md:text-[28px]">{t('new')}</h1>
      <ArticleEditor locale={locale} article={null} categories={categories} defaultByline={editor.firstName} />
    </>
  );
}
