import { mergeAttributes, Node, type Extensions } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { parseEmbedWidth } from '@/server/adapters/wordpress/sanitize';
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
const FigureImage = Image.extend({
  name: 'figureImage',
  group: 'figureContent',
  inline: false,
  // A picture that links somewhere (`<figure><a href><img></a></figure>`, as WordPress writes it) keeps its link.
  addAttributes() {
    return {
      ...this.parent?.(),
      href: { default: null, parseHTML: (element: HTMLElement) => element.closest('a')?.getAttribute('href') ?? null, rendered: false },
    };
  },
  parseHTML: () => [{ tag: 'figure img[src]', priority: 60 }],
  renderHTML({ node, HTMLAttributes }) {
    const image = ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)] as const;
    return node.attrs.href ? ['a', { href: node.attrs.href }, image] : image;
  },
});

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
 * and the product card. The toolbar offers only some of them; the image node has no button, paste or drop (D-237).
 */
/** The document accepts a product card between its top-level blocks, and nothing else does (R16, D-245). */
const TopLevelDocument = Node.create({ name: 'doc', topNode: true, content: '(block | topCard)+' });

export function buildExtensions(productCardLabel: string): Extensions {
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
    Image.configure({ inline: true, allowBase64: false }),
    FigureImage,
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
