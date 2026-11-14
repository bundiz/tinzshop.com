import { mergeAttributes, Node, type Extensions } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import Youtube, { isValidYoutubeUrl } from '@tiptap/extension-youtube';
import StarterKit from '@tiptap/starter-kit';

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
  parseHTML: () => [{ tag: 'figure img[src]', priority: 60 }],
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
  isolating: true,
  parseHTML: () => [{ tag: 'figure' }],
  renderHTML: () => ['figure', 0],
});

/**
 * A YouTube video is stored as a bare `<iframe src="https://www.youtube.com/embed/…">`: the sanitiser allows no wrapper
 * `div`. The stock node reads only `div[data-youtube-video] iframe`, so it is extended to read the bare iframe too.
 */
const YoutubeVideo = Youtube.extend({
  parseHTML() {
    return [
      { tag: 'div[data-youtube-video] iframe' },
      { tag: 'iframe[src]', getAttrs: (element) => (isValidYoutubeUrl(element.getAttribute('src') ?? '') ? null : false) },
    ];
  },
}).configure({ nocookie: false, controls: true, modestBranding: true });

/**
 * Every node the article body sanitiser keeps can be read by the editor (D-244): paragraphs, headings 1 to 6, bold and
 * italic, links, lists, quotes, line breaks, pictures (inline, and in a figure with its caption), tables, YouTube videos
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
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    YoutubeVideo,
    ProductCard.configure({ label: productCardLabel }),
  ];
}
