import { mergeAttributes, Node, type Extensions } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import StarterKit from '@tiptap/starter-kit';

import { isStoredYoutubeEmbed } from './youtube-embed';

/**
 * The product card: `<tinz-product data-id="…"></tinz-product>`, an atom block (R2). The editor draws it as a labelled
 * box (the node view, never saved); the saved HTML is only the element and the id. The storefront draws the live card
 * from it (Task 10), and the sanitiser does not keep the tag until then.
 */
export const ProductCard = Node.create<{ label: string }>({
  name: 'productCard',
  group: 'block',
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
    // The name is only for the editor's box: never written into the saved HTML.
    name: { default: null, rendered: false },
  }),
  parseHTML: () => [{ tag: 'tinz-product[data-id]' }],
  renderHTML: ({ HTMLAttributes }) => ['tinz-product', mergeAttributes(HTMLAttributes)],
  addNodeView() {
    const label = this.options.label;
    return ({ node }) => {
      const dom = document.createElement('tinz-product');
      dom.setAttribute('data-id', String(node.attrs.id ?? ''));
      dom.setAttribute('contenteditable', 'false');
      dom.className = 'my-3 block rounded-sm border-2 border-dashed border-brand bg-brand-soft p-3 font-semibold text-brand-dark';
      dom.textContent = node.attrs.name ? `${label}: ${node.attrs.name}` : label;
      return { dom };
    };
  },
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
 * writes only `src` and `allowfullscreen`. It can sit alone or in a `figure`.
 */
const YoutubeEmbed = Node.create({
  name: 'youtube',
  group: 'block figureContent',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes: () => ({ src: { default: null }, fullscreen: { default: true } }),
  parseHTML: () => [
    {
      tag: 'iframe[src]',
      getAttrs: (element) => {
        const src = element.getAttribute('src') ?? '';
        return isStoredYoutubeEmbed(src) ? { src, fullscreen: element.hasAttribute('allowfullscreen') } : false;
      },
    },
  ],
  renderHTML: ({ node }) => ['iframe', { src: node.attrs.src, ...(node.attrs.fullscreen ? { allowfullscreen: '' } : {}) }],
});

/**
 * Every node the article body sanitiser keeps can be read by the editor (D-244): paragraphs, headings 1 to 6, bold and
 * italic, links, lists, quotes, line breaks, pictures (inline, and in a figure with its caption), tables (one body
 * section: a table with a head or foot section is locked by the guard), YouTube videos (alone or in a figure)
 * and the product card. The toolbar offers only some of them; the image node has no button, paste or drop (D-237).
 */
export function buildExtensions(productCardLabel: string): Extensions {
  return [
    StarterKit.configure({
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
