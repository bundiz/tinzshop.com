'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { isPreviewMessage, PREVIEW_SILENCE_MS, previewChannelName } from '../../../../../(admin)/admin/news/_lib/preview-channel';
import { previewArticleAction } from '../actions';

type PreviewStatus = 'waiting' | 'live' | 'silent' | 'closed' | 'failed';

export type LivePreviewProps = {
  locale: string;
  /** The editor's preview session: the channel's name. */
  session: string;
  /** Override the Server Action in tests. */
  action?: (locale: string, draft: unknown) => Promise<ReactNode>;
};

/**
 * The preview tab (D-253): asks the editor for its draft over the session's channel, has each draft drawn on the server
 * (`previewArticleAction`) and shows the result under a slim bar that is not part of the storefront page. A response is
 * shown only when it is newer than the one on screen, so a slow answer never replaces a later one. The bar says when no
 * editor answers within three seconds and when the editor closes; the last version stays on screen.
 */
export default function LivePreview({ locale, session, action = previewArticleAction }: LivePreviewProps) {
  const t = useTranslations('admin.news.preview');
  const [view, setView] = useState<ReactNode>(null);
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
        (node) => {
          if (disposed || request <= shown.current) return;
          shown.current = request;
          // Null is a draft the server refused (over a cap): keep the last good version.
          if (node === null || node === undefined) {
            setStatus('failed');
            return;
          }
          setView(node);
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
      {view}
    </>
  );
}
