import { sanitizeArticleHtml } from '@/server/adapters/wordpress/sanitize';

/**
 * The guard's comparison (ruling R14). `normaliseBody` reduces a stored body to what it means and shows, and
 * `wouldLoseContent` compares the stored body with the SAME sanitiser's output of the editor's HTML for it, so what is
 * compared is what would be saved. `sanitize.ts` imports only `sanitize-html`, so it runs in the browser unchanged.
 *
 * Only differences that change neither meaning nor display are ignored: runs of whitespace (and whitespace at block edges
 * and around a line break), the order of bold, italic and link marks on the same text, the editor's single `<p>` inside
 * a list item, a quote or a table cell, the implicit `<tbody>`, `<br>` against `<br />`, an absent `alt` against an empty
 * one. Everything else counts as a loss, including a table's `<thead>` or `<tfoot>`, an iframe's whole `src`, its
 * `allowfullscreen`, a card's or a video's `data-width` (D-273), and a picture's `data-media-key` (plan 017). Browser only
 * (it needs `DOMParser`).
 */

type Marks = { href: string | null; strong: boolean; em: boolean };
type Token = { kind: 'text'; text: string; marks: Marks } | { kind: 'raw'; html: string; marks: Marks; edge: boolean };

const BLOCKS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'figure', 'figcaption', 'iframe', 'tinz-product']);
const VOID = new Set(['br', 'img', 'iframe', 'tinz-product']);
const NO_MARKS: Marks = { href: null, strong: false, em: false };

const escapeText = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, '&nbsp;');
const escapeAttr = (text: string): string => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const sameMarks = (a: Marks, b: Marks): boolean => a.href === b.href && a.strong === b.strong && a.em === b.em;

function hasBlock(element: Element): boolean {
  return Array.from(element.querySelectorAll('*')).some((child) => BLOCKS.has(child.tagName.toLowerCase()));
}

function wrap(html: string, marks: Marks): string {
  let out = html;
  if (marks.em) out = `<em>${out}</em>`;
  if (marks.strong) out = `<strong>${out}</strong>`;
  if (marks.href !== null) out = `<a href="${escapeAttr(marks.href)}">${out}</a>`;
  return out;
}

/** A card's or a video's `data-width` as stored (D-273): a changed, added or lost width is a difference like any other. */
function widthOf(element: Element): string {
  const width = element.getAttribute('data-width');
  return width === null ? '' : ` data-width="${escapeAttr(width)}"`;
}

function attributesOf(element: Element): string {
  const tag = element.tagName.toLowerCase();
  if (tag === 'img') {
    // An uploaded picture's key (plan 017) counts like its src: a lost or changed key is a loss.
    const key = element.getAttribute('data-media-key');
    const keyed = key === null ? '' : ` data-media-key="${escapeAttr(key)}"`;
    return ` src="${escapeAttr(element.getAttribute('src') ?? '')}"${keyed} alt="${escapeAttr(element.getAttribute('alt') ?? '')}"`;
  }
  if (tag === 'iframe') return ` src="${escapeAttr(element.getAttribute('src') ?? '')}"${element.hasAttribute('allowfullscreen') ? ' allowfullscreen' : ''}${widthOf(element)}`;
  if (tag === 'a') return ` href="${escapeAttr(element.getAttribute('href') ?? '')}"`;
  if (tag === 'tinz-product') return ` data-id="${escapeAttr(element.getAttribute('data-id') ?? '')}"${widthOf(element)}`;
  return '';
}

function collect(nodes: NodeListOf<ChildNode> | ChildNode[], marks: Marks, out: Token[]): void {
  for (const node of Array.from(nodes)) {
    if (node.nodeType === 3) {
      out.push({ kind: 'text', text: node.textContent ?? '', marks });
      continue;
    }
    if (node.nodeType !== 1) continue;
    const element = node as Element;
    const tag = element.tagName.toLowerCase();
    if ((tag === 'strong' || tag === 'em') && !hasBlock(element)) collect(element.childNodes, { ...marks, [tag]: true }, out);
    else if (tag === 'a' && !hasBlock(element)) collect(element.childNodes, { ...marks, href: element.getAttribute('href') ?? '' }, out);
    else out.push({ kind: 'raw', html: renderElement(element), marks, edge: tag === 'br' || BLOCKS.has(tag) });
  }
}

/** Inline content as runs: equal neighbouring marks merged, whitespace collapsed and trimmed at the edges and around `<br>`. */
function renderChildren(parent: Element): string {
  const tokens: Token[] = [];
  collect(parent.childNodes, NO_MARKS, tokens);
  const merged: Token[] = [];
  for (const token of tokens) {
    const last = merged[merged.length - 1];
    if (token.kind === 'text' && last?.kind === 'text' && sameMarks(last.marks, token.marks)) last.text += token.text;
    else merged.push({ ...token });
  }
  // A leading space is dropped after a line break or a block, at the start, or after another space.
  let atStart = true;
  for (const token of merged) {
    if (token.kind === 'raw') {
      atStart = token.edge;
      continue;
    }
    token.text = token.text.replace(/[ \t\r\n\f]+/g, ' ');
    if (atStart) token.text = token.text.replace(/^ /, '');
    if (token.text !== '') atStart = token.text.endsWith(' ');
  }
  // A trailing space is dropped before a line break or a block, and at the end.
  let atEnd = true;
  for (let i = merged.length - 1; i >= 0; i -= 1) {
    const token = merged[i]!;
    if (token.kind === 'raw') {
      atEnd = token.edge;
      continue;
    }
    if (atEnd) token.text = token.text.replace(/ $/, '');
    if (token.text !== '') atEnd = false;
  }
  return merged
    .filter((token) => token.kind === 'raw' || token.text !== '')
    .map((token) => wrap(token.kind === 'text' ? escapeText(token.text) : token.html, token.marks))
    .join('');
}

function renderElement(element: Element): string {
  const tag = element.tagName.toLowerCase();
  if (VOID.has(tag)) return `<${tag}${attributesOf(element)}>`;
  return `<${tag}${attributesOf(element)}>${renderChildren(element)}</${tag}>`;
}

export function normaliseBody(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const body = doc.body;
  const unwrap = (element: Element) => element.replaceWith(...Array.from(element.childNodes));
  body.querySelectorAll('colgroup').forEach((element) => element.remove());
  body.querySelectorAll('tbody').forEach(unwrap);
  // The editor puts a list item's, quote's or cell's text in one `<p>`; a lone `<p>` there means the same as bare text.
  for (const container of Array.from(body.querySelectorAll('li, blockquote, td, th')).reverse()) {
    const paragraphs = Array.from(container.children).filter((child) => child.tagName === 'P');
    if (paragraphs.length === 1) unwrap(paragraphs[0]!);
  }
  return renderChildren(body);
}

/** Whether the editor would not give back the stored body: something in it would be lost on the first edit. */
export function wouldLoseContent(stored: string, editorHtml: string): boolean {
  if (stored.trim() === '') return false;
  return normaliseBody(stored) !== normaliseBody(sanitizeArticleHtml(editorHtml).html);
}

/** A body with no text and no picture, video or card is empty: it is stored and sent as ''. */
export function bodyOrEmpty(html: string): string {
  const empty = html.replace(/<[^>]*>/g, '').replace(/&nbsp;|\s/g, '') === '' && !/<(img|iframe|tinz-product|table)\b/i.test(html);
  return empty ? '' : html;
}
