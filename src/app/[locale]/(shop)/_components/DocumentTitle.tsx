'use client';

import { useEffect } from 'react';

/**
 * Sets the tab's title after hydration, for a not-found screen reached from a route whose layout title
 * cannot know about the 404: Next drops a page's metadata when the page calls `notFound()`, and only the
 * root not-found file may export metadata. The server-rendered `<title>` stays the layout's; the 404 status
 * and Next's `noindex` are unaffected. Renders nothing.
 */
export default function DocumentTitle({ title }: { title: string }) {
  useEffect(() => {
    document.title = title;
  }, [title]);
  return null;
}
