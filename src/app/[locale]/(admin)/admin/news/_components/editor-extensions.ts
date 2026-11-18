import { mergeAttributes, Node, type Extensions, type NodeViewRenderer } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { isNewsMediaKey, parseEmbedWidth } from '@/server/adapters/wordpress/sanitize';
import ProductCardView from './ProductCardView';
import { isStoredYoutubeEmbed } from './youtube-embed';
import YoutubeView from './YoutubeView';

/**
 * The embed width of a card or a video (D-273): read from a valid `data-width` (40 to 99, else none) and written back
 * after the node's other attributes, as the sanitiser writes it, so a stored body round-trips byte for byte. None (null)
 * is full width and writes nothing.
 */
const embedWidth = {
  default: null,
  parseHTML: (element: HTMLElement) => parseEmbedWidth(element.getAttribute('data-width')),
  renderHTML: (attributes: Record<string, unknown>) => (typeof attributes.width === 'number' ? { 'data-width': String(attributes.width) } : {}),
};

/**
 * An uploaded picture (plan 017, D-277) is stored as `<img data-media-key="news/…" alt="…">`, with no `src`. `mediaKey`
 * comes first, so the editor writes `data-media-key` before `alt`, as the sanitiser does; a keyed picture writes no `src`
 * (one loaded with a display `src` keeps it only in memory), so the article form never posts a URL to the bucket.
 */
const mediaKeyAttribute = {
  default: null,
  parseHTML: (element: HTMLElement) => {
    const key = element.getAttribute('data-media-key');
    return key !== null && isNewsMediaKey(key) ? key : null;
  },
  renderHTML: (attributes: Record<string, unknown>) =>
    typeof attributes.mediaKey === 'string' ? { 'data-media-key': attributes.mediaKey } : {},
};

const srcAttribute = {
  default: null,
  parseHTML: (element: HTMLElement) => element.getAttribute('src'),
  renderHTML: (attributes: Record<string, unknown>) =>
    typeof attributes.mediaKey === 'string' || typeof attributes.src !== 'string' ? {} : { src: attributes.src },
};

/**
 * Draws a picture in the editor: an uploaded one from `{base}/{key}` (never saved; with no base URL it shows no picture),
 * an imported one from its `src`. A figure's picture that links somewhere is drawn inside its link, as `renderHTML` writes it.
 */
function imageView(mediaBaseUrl: string | null): NodeViewRenderer {
  return ({ node, HTMLAttributes }) => {
    const img = document.createElement('img');
    for (const [name, value] of Object.entries(HTMLAttributes)) {
      if (value !== null && value !== undefined) img.setAttribute(name, String(value));
    }
    const key = node.attrs.mediaKey;
    if (typeof key === 'string' && mediaBaseUrl !== null) img.setAttribute('src', `${mediaBaseUrl}/${key}`);
    const href = node.attrs.href;
    if (typeof href !== 'string' || href === '') return { dom: img };
    const link = document.createElement('a');
    link.setAttribute('href', href);
    link.append(img);
    return { dom: link };
  };
}

/** The inline picture, with the media key (plan 017). */
function inlineImage(mediaBaseUrl: string | null) {
  return Image.extend({
    addAttributes() {
      return { mediaKey: mediaKeyAttribute, ...this.parent?.(), src: srcAttribute };
    },
    // A keyed picture has no `src`, so the base rule (`img[src]`) would not read it.
    parseHTML() {
      return [...(this.parent?.() ?? []), { tag: 'img[data-media-key]' }];
    },
    addNodeView: () => imageView(mediaBaseUrl),
  }).configure({ inline: true, allowBase64: false });
}

/**
 * The product card: `<tinz-product data-id="…"></tinz-product>`, an atom block (R2). The editor draws it as the
 * storefront's card (`ProductCardView`, never saved, D-266); the saved HTML is only the element and the id. The
 * storefront draws the live card from it (D-245); the sanitiser keeps the tag with a uuid `data-id`, an optional
 * `data-width` (D-273) and nothing else.
 */
export const ProductCard = Node.create<{ label: string }>({
  name: 'productCard',
  // Its own group, not 'block': only the document accepts it, so it can never sit in a list item, quote or cell (R16).
  group: 'topCard',
  atom: true,
  selectable: true,
  draggable: true,
  addOptions: () => ({ label: '' }),
  addAttributes: () => ({
    id: {
      default: null,
      parseHTML: (element) => element.getAttribute('data-id'),
      renderHTML: (attributes) => (attributes.id ? { 'data-id': attributes.id } : {}),
    },
    // The picker's name, only for the editor's accessible name until the card loads: never written into the saved HTML.
    name: { default: null, rendered: false },
    width: embedWidth,
  }),
  parseHTML: () => [{ tag: 'tinz-product[data-id]' }],
  renderHTML: ({ HTMLAttributes }) => ['tinz-product', mergeAttributes(HTMLAttributes)],
  // The storefront card itself, from the live product (D-266); the wrapper is the stored tag with its id, as before.
  addNodeView: () =>
    ReactNodeViewRenderer(ProductCardView, {
      as: 'tinz-product',
      className: 'block',
      attrs: ({ node }) => ({ 'data-id': String(node.attrs.id ?? ''), contenteditable: 'false' }),
    }),
});

/**
 * `<figure>` with one picture and an optional `<figcaption>`, as an imported body has them (the sanitiser allows both
 * tags). The picture inside is its own block node, so the ordinary inline image keeps working inside a paragraph.
 */
function figureImage(mediaBaseUrl: string | null) {
  return Image.extend({
    name: 'figureImage',
    group: 'figureContent',
    inline: false,
    // A picture that links somewhere (`<figure><a href><img></a></figure>`, as WordPress writes it) keeps its link.
    addAttributes() {
      return {
        mediaKey: mediaKeyAttribute,
        ...this.parent?.(),
        src: srcAttribute,
        href: { default: null, parseHTML: (element: HTMLElement) => element.closest('a')?.getAttribute('href') ?? null, rendered: false },
      };
    },
    parseHTML: () => [
      { tag: 'figure img[src]', priority: 60 },
      { tag: 'figure img[data-media-key]', priority: 60 },
    ],
    renderHTML({ node, HTMLAttributes }) {
      const image = ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)] as const;
      return node.attrs.href ? ['a', { href: node.attrs.href }, image] : image;
    },
    addNodeView: () => imageView(mediaBaseUrl),
  });
}

const Figcaption = Node.create({
  name: 'figcaption',
  content: 'inline*',
  defining: true,
  parseHTML: () => [{ tag: 'figcaption' }],
  renderHTML: () => ['figcaption', 0],
});

const Figure = Node.create({
  name: 'figure',
  group: 'block',
  content: 'figureContent figcaption?',
  // The picture's own link is an attribute of the picture: no marks inside a figure.
  marks: '',
  isolating: true,
  parseHTML: () => [{ tag: 'figure' }],
  renderHTML: () => ['figure', 0],
});

/**
 * A YouTube video, stored as a bare `<iframe src="https://www.youtube.com/embed/…">` (the sanitiser allows no wrapper). The
 * node keeps the `src` exactly as loaded, so `?start=`, `?list=` and `/embed/videoseries?list=…` come back unchanged, and
 * writes only `src`, `allowfullscreen` and, at a width under 100%, `data-width` (D-273). It can sit alone or in a
 * `figure`; only a video at the top level of the body offers the resize handle (`YoutubeView`).
 */
const YoutubeEmbed = Node.create({
  name: 'youtube',
  group: 'block figureContent',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes: () => ({ src: { default: null }, fullscreen: { default: true }, width: embedWidth }),
  parseHTML: () => [
    {
      tag: 'iframe[src]',
      getAttrs: (element) => {
        const src = element.getAttribute('src') ?? '';
        return isStoredYoutubeEmbed(src) ? { src, fullscreen: element.hasAttribute('allowfullscreen') } : false;
      },
    },
  ],
  renderHTML: ({ node }) => [
    'iframe',
    {
      src: node.attrs.src,
      ...(node.attrs.fullscreen ? { allowfullscreen: '' } : {}),
      ...(typeof node.attrs.width === 'number' ? { 'data-width': String(node.attrs.width) } : {}),
    },
  ],
  addNodeView: () => ReactNodeViewRenderer(YoutubeView),
});

/**
 * Every node the article body sanitiser keeps can be read by the editor (D-244): paragraphs, headings 1 to 6, bold and
 * italic, links, lists, quotes, line breaks, pictures (inline, and in a figure with its caption), tables (one body
 * section: a table with a head or foot section is locked by the guard), YouTube videos (alone or in a figure)
 * and the product card. The toolbar offers only some of them; pictures come from the image button's upload (plan 017),
 * never from paste or drop of a file (D-237).
 */
/** The document accepts a product card between its top-level blocks, and nothing else does (R16, D-245). */
const TopLevelDocument = Node.create({ name: 'doc', topNode: true, content: '(block | topCard)+' });

/** `mediaBaseUrl` draws uploaded pictures in the editor (`MEDIA_PUBLIC_BASE_URL`, or null when storage is not set up). */
export function buildExtensions(productCardLabel: string, mediaBaseUrl: string | null = null): Extensions {
  return [
    TopLevelDocument,
    StarterKit.configure({
      document: false,
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      code: false,
      codeBlock: false,
      strike: false,
      underline: false,
      horizontalRule: false,
      link: { openOnClick: false, autolink: false, linkOnPaste: false, protocols: ['http', 'https'], HTMLAttributes: { rel: 'noopener', target: null, class: null } },
    }),
    inlineImage(mediaBaseUrl),
    figureImage(mediaBaseUrl),
    Figcaption,
    Figure,
    Table.extend({ group: 'block figureContent' }).configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    YoutubeEmbed,
    ProductCard.configure({ label: productCardLabel }),
  ];
}
