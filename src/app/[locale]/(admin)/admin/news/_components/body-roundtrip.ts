const YOUTUBE_EMBED = /^https?:\/\/(?:www\.)?(?:youtube(?:-nocookie)?\.com)\/embed\/([\w-]+)/i;

/**
 * A body reduced to what it means, so the stored HTML and the editor's own HTML for it can be compared: only the
 * attributes the sanitiser keeps (and only their values that matter), the table's section tags and the editor's
 * `div`/`colgroup`/single-`<p>` wrappers removed, whitespace between tags dropped. Browser only (it needs `DOMParser`).
 */
export function normaliseBody(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const body = doc.body;
  body.querySelectorAll('colgroup').forEach((element) => element.remove());
  const unwrap = (element: Element) => element.replaceWith(...Array.from(element.childNodes));
  body.querySelectorAll('div[data-youtube-video], thead, tbody, tfoot').forEach(unwrap);
  body.querySelectorAll('td > p:only-child, th > p:only-child, li > p:only-child').forEach(unwrap);
  body.querySelectorAll('*').forEach((element) => {
    const tag = element.tagName.toLowerCase();
    const keep: Record<string, string[]> = { a: ['href'], img: ['src', 'alt'], iframe: ['src'] };
    for (const name of element.getAttributeNames()) {
      if (!(keep[tag] ?? []).includes(name)) element.removeAttribute(name);
    }
    if (tag === 'img' && !element.hasAttribute('alt')) element.setAttribute('alt', '');
    if (tag === 'iframe') {
      const match = YOUTUBE_EMBED.exec(element.getAttribute('src') ?? '');
      if (match) element.setAttribute('src', `https://www.youtube.com/embed/${match[1]}`);
    }
  });
  return body.innerHTML.replace(/>\s+</g, '><').trim();
}

/** Whether the editor would not give back the stored body: something in it would be lost on the first edit. */
export function wouldLoseContent(stored: string, editorHtml: string): boolean {
  if (stored.trim() === '') return false;
  return normaliseBody(stored) !== normaliseBody(editorHtml);
}

/** A body with no text and no picture, video or card is empty: it is stored and sent as ''. */
export function bodyOrEmpty(html: string): string {
  const empty = html.replace(/<[^>]*>/g, '').replace(/&nbsp;|\s/g, '') === '' && !/<(img|iframe|tinz-product|table)\b/i.test(html);
  return empty ? '' : html;
}
