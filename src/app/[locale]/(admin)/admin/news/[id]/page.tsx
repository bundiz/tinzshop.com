import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';

import { getNewsAdmin } from '@/server/composition-root';
import { requirePermission } from '../../_lib/require-permission';
import ArticleEditor, { type EditorArticle } from '../_components/ArticleEditor';
import { listedCategoryOptions } from '../_lib/categories';

type Props = { params: Promise<{ locale: string; id: string }> };

/**
 * `/{locale}/admin/news/{id}`: one article in the editor. Needs `news.manage`. An unknown id is a 404; a trashed article
 * cannot be edited (the service refuses it), so it goes to the trash list, where it can be restored.
 */
export default async function EditNewsPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const editor = await requirePermission(locale, `/admin/news/${id}`, 'news.manage');
  const news = getNewsAdmin();
  const article = await news.get(id);
  if (article === null) notFound();
  if (article.deletedAt !== null) redirect(`/${locale}/admin/news?status=trash`);
  const t = await getTranslations({ locale, namespace: 'admin.news' });
  const [categories, products] = await Promise.all([news.categories(), news.productsByIds(article.productIds)]);

  const initial: EditorArticle = {
    id: article.id,
    slug: article.slug,
    status: article.derivedStatus,
    publishedAt: article.publishedAt?.toISOString() ?? null,
    bylineName: article.bylineName ?? editor.firstName,
    featuredImageUrl: article.featuredImageUrl,
    th: article.th ?? { title: '', excerpt: '', bodyHtml: '' },
    en: article.en,
    categoryIds: article.categoryIds,
    tagNames: article.tagNames,
    products,
  };

  return (
    <>
      <h1 className="mb-4 font-head text-[24px] font-bold text-ink md:text-[28px]">{t('title')}</h1>
      <ArticleEditor locale={locale} article={initial} categories={listedCategoryOptions(categories, locale, article.categoryIds)} defaultByline={editor.firstName} />
    </>
  );
}
