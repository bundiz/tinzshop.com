'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { isPreviewMessage, PREVIEW_SILENCE_MS, previewChannelName } from '../../../../../(admin)/admin/news/_lib/preview-channel';
import type { NewsArticleDetail } from '@/server/services/news/news-read-service';
import type { ArticlesMenuEntry } from '../../../../../(shop)/_components/articles-menu';
import type { HeaderCustomer } from '../../../../../(shop)/_components/SiteHeader';
import NewsArticleView from '../../../../../(shop)/news/[slug]/_components/NewsArticleView';
import { previewArticleAction } from '../actions';

type PreviewStatus = 'waiting' | 'live' | 'silent' | 'closed' | 'failed';

export type LivePreviewProps = {
  locale: string;
  /** The editor's preview session: the channel's name. */
  session: string;
  /** The storefront header's articles menu and signed-in account, read by the page. */
  articlesMenu: ArticlesMenuEntry[];
  customer: HeaderCustomer | null;
  /** Override the Server Action in tests. */
  action?: (locale: string, draft: unknown) => Promise<NewsArticleDetail | null>;
  /** Override how an article is drawn in tests; the storefront's own article page by default. */
  renderArticle?: (article: NewsArticleDetail) => ReactNode;
};

/**
 * The preview tab (D-253): asks the editor for its draft over the session's channel, has the server prepare each one
 * (`previewArticleAction`: sanitised, with live product cards) and draws it here with the storefront's `NewsArticleView`,
 * under a slim bar that is not part of the storefront page. A response is
 * shown only when it is newer than the one on screen, so a slow answer never replaces a later one. The bar says when no
 * editor answers within three seconds and when the editor closes; the last version stays on screen.
 */
export default function LivePreview({
  locale,
  session,
  articlesMenu,
  customer,
  action = previewArticleAction,
  renderArticle,
}: LivePreviewProps) {
  const t = useTranslations('admin.news.preview');
  const [article, setArticle] = useState<NewsArticleDetail | null>(null);
  const [status, setStatus] = useState<PreviewStatus>('waiting');
  const requested = useRef(0);
  const shown = useRef(0);

  useEffect(() => {
    const channel = new BroadcastChannel(previewChannelName(session));
    let heard = false;
    let disposed = false;
    let editorClosed = false;
    const silence = setTimeout(() => {
      if (!heard) setStatus('silent');
    }, PREVIEW_SILENCE_MS);

    channel.onmessage = (event: MessageEvent) => {
      const message: unknown = event.data;
      if (!isPreviewMessage(message)) return;
      if (message.type === 'closed') {
        editorClosed = true;
        setStatus('closed');
        return;
      }
      if (message.type !== 'draft') return;
      heard = true;
      editorClosed = false;
      requested.current += 1;
      const request = requested.current;
      action(locale, message.draft).then(
        (detail) => {
          if (disposed || request <= shown.current) return;
          shown.current = request;
          // Null is a draft the server refused (over a cap): keep the last good version.
          if (detail === null || detail === undefined) {
            setStatus('failed');
            return;
          }
          setArticle(detail);
          setStatus(editorClosed ? 'closed' : 'live');
        },
        () => {
          if (!disposed && request > shown.current) setStatus('failed');
        },
      );
    };
    channel.postMessage({ type: 'ready' });

    return () => {
      disposed = true;
      clearTimeout(silence);
      channel.close();
    };
  }, [locale, session, action]);

  return (
    <>
      <div role="status" aria-live="polite" className="bg-ink px-4 py-2 text-center text-sm font-medium text-white">
        {t(status)}
      </div>
      {article === null ? null : renderArticle ? renderArticle(article) : <NewsArticleView article={article} articlesMenu={articlesMenu} customer={customer} />}
    </>
  );
}
