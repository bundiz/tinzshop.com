'use client';

import { mergeAttributes, Node } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import Youtube, { isValidYoutubeUrl } from '@tiptap/extension-youtube';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Editor } from '@tiptap/core';

import { buttonClass } from '@/components/ui/button-class';
import { useModalDialog } from '@/components/ui/use-modal-dialog';
import type { ProductPickerHit } from '@/server/services/catalogue/product-search-service';
import { ProductSearchBox, type ProductSearch } from './ProductPicker';

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

type BlockKind = 'p' | 'h2' | 'h3' | 'blockquote';

function blockOf(editor: Editor | null): BlockKind {
  if (editor === null) return 'p';
  if (editor.isActive('heading', { level: 2 })) return 'h2';
  if (editor.isActive('heading', { level: 3 })) return 'h3';
  if (editor.isActive('blockquote')) return 'blockquote';
  return 'p';
}

function setBlock(editor: Editor, kind: BlockKind): void {
  const chain = editor.chain().focus();
  if (kind === 'blockquote') {
    if (!editor.isActive('blockquote')) chain.setBlockquote();
  } else {
    if (editor.isActive('blockquote')) chain.unsetBlockquote();
    if (kind === 'p') chain.setParagraph();
    else chain.setHeading({ level: kind === 'h2' ? 2 : 3 });
  }
  chain.run();
}

const TOOL =
  'inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-sm px-2.5 text-[15px] font-semibold text-ink-2 hover:bg-sunk aria-pressed:bg-brand-soft aria-pressed:text-brand-dark';
const SEP = 'mx-1 h-6 w-px bg-line';

type DialogKind = 'link' | 'youtube' | 'product';

/** A small modal with one URL field (link and YouTube); focus returns to the toolbar button that opened it. */
function UrlDialog({
  title,
  label,
  okLabel,
  invalidText,
  initial,
  validate,
  onSubmit,
  onClose,
  returnFocusRef,
  extra,
}: {
  title: string;
  label: string;
  okLabel: string;
  invalidText: string;
  initial: string;
  validate: (url: string) => boolean;
  onSubmit: (url: string) => void;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
  extra?: ReactNode;
}) {
  const t = useTranslations('admin.news.editor');
  const container = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState(initial);
  const [invalid, setInvalid] = useState(false);
  const titleId = useId();
  const inputId = useId();
  useModalDialog({ open: true, onClose, containerRef: container, returnFocusRef });

  function submit(): void {
    const value = url.trim();
    if (!validate(value)) {
      setInvalid(true);
      return;
    }
    onSubmit(value);
  }

  return (
    <div className="fixed inset-0 z-60 grid place-items-center bg-ink/50 p-4">
      <div ref={container} role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-[440px] rounded-md bg-surface p-5 shadow-1">
        <h2 id={titleId} className="font-head text-xl font-bold text-ink">
          {title}
        </h2>
        <div className="mt-3.5">
          <label htmlFor={inputId} className="mb-1 block font-semibold text-ink">
            {label}
          </label>
          <input
            id={inputId}
            type="url"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setInvalid(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submit();
              }
            }}
            aria-invalid={invalid}
            aria-describedby={invalid ? `${inputId}-error` : undefined}
            placeholder="https://"
            className="min-h-11 w-full rounded-sm border-[1.5px] border-line-2 bg-surface px-3 text-ink"
          />
          {invalid ? (
            <p id={`${inputId}-error`} role="alert" className="mt-1 text-sm font-medium text-sale">
              {invalidText}
            </p>
          ) : null}
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2.5">
          {extra}
          <button type="button" onClick={onClose} className={buttonClass({ variant: 'line' })}>
            {t('linkDialog.cancel')}
          </button>
          <button type="button" onClick={submit} className={buttonClass({ variant: 'brand' })}>
            {okLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export type RichTextEditorProps = {
  /** The accessible name of the writing area. */
  label: string;
  /** The stored HTML to start from. An `<img>` in it is kept as it is (D-237), though no control adds one. */
  initialHtml: string;
  /** Called with the HTML on every change. */
  onChange: (html: string) => void;
  /** The product picker's search, for the product-card button. */
  searchProducts: ProductSearch;
};

/**
 * The article body editor (D-244): Tiptap on ProseMirror, writing plain HTML. Its toolbar is exactly the brief's:
 * paragraph style, bold, italic, link, the two lists, a YouTube video and a product card. There is no image button,
 * no upload, no paste or drop of files: the image node is registered only so an imported body's `<img>` survives a save
 * and so a later task can add the control. Client-only: nothing on a storefront page imports this file.
 */
export default function RichTextEditor({ label, initialHtml, onChange, searchProducts }: RichTextEditorProps) {
  const t = useTranslations('admin.news.editor');
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const cardLabel = t('productCard');
  const blockId = useId();

  const editor = useEditor({
    // Rendered on the server as the empty shell; the editor mounts in the browser (avoids a hydration mismatch).
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // Only what the toolbar offers; the sanitiser decides what is kept anyway.
        code: false,
        codeBlock: false,
        strike: false,
        underline: false,
        horizontalRule: false,
        link: { openOnClick: false, autolink: false, linkOnPaste: false, protocols: ['http', 'https'] },
      }),
      // No toolbar button, no paste and no drop of files: this only keeps an imported body's pictures.
      Image.configure({ inline: true, allowBase64: false }),
      Youtube.configure({ nocookie: false, controls: true, modestBranding: true }),
      ProductCard.configure({ label: cardLabel }),
    ],
    content: initialHtml,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
        class: 'min-h-[320px] px-4 py-3 outline-none [&_p]:my-3 [&_h2]:my-3 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:my-3 [&_h3]:text-lg [&_h3]:font-bold [&_a]:text-brand [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:border-l-4 [&_blockquote]:border-accent [&_blockquote]:bg-page [&_blockquote]:px-4 [&_blockquote]:py-1 [&_img]:max-w-full [&_iframe]:aspect-video [&_iframe]:w-full',
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getHTML()),
  });

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive('bold') ?? false,
      italic: current?.isActive('italic') ?? false,
      link: current?.isActive('link') ?? false,
      bulletList: current?.isActive('bulletList') ?? false,
      orderedList: current?.isActive('orderedList') ?? false,
      block: blockOf(current),
    }),
  });

  const open = (kind: DialogKind) => (event: { currentTarget: HTMLButtonElement }) => {
    opener.current = event.currentTarget;
    setDialog(kind);
  };
  const close = () => setDialog(null);

  const block = state?.block ?? 'p';
  const flag = (value: boolean | undefined) => value === true;

  return (
    <div className="rounded-md border border-line bg-surface">
      <div role="toolbar" aria-label={t('toolbar.label')} className="flex flex-wrap items-center gap-0.5 border-b border-line p-1.5">
        <label htmlFor={blockId} className="sr-only">
          {t('toolbar.block')}
        </label>
        <select
          id={blockId}
          value={block}
          disabled={editor === null}
          onChange={(event) => editor && setBlock(editor, event.target.value as BlockKind)}
          className="min-h-11 rounded-sm border-[1.5px] border-line-2 bg-surface px-2.5 text-ink"
        >
          {(['p', 'h2', 'h3', 'blockquote'] as const).map((kind) => (
            <option key={kind} value={kind}>
              {t(`block.${kind}`)}
            </option>
          ))}
        </select>
        <span className={SEP} aria-hidden="true" />
        <button type="button" aria-label={t('toolbar.bold')} aria-pressed={flag(state?.bold)} disabled={editor === null} onClick={() => editor?.chain().focus().toggleBold().run()} className={`${TOOL} font-bold`}>
          B
        </button>
        <button type="button" aria-label={t('toolbar.italic')} aria-pressed={flag(state?.italic)} disabled={editor === null} onClick={() => editor?.chain().focus().toggleItalic().run()} className={`${TOOL} italic`}>
          I
        </button>
        <button type="button" aria-label={t('toolbar.link')} aria-pressed={flag(state?.link)} disabled={editor === null} onClick={open('link')} className={TOOL}>
          URL
        </button>
        <span className={SEP} aria-hidden="true" />
        <button type="button" aria-label={t('toolbar.bulletList')} aria-pressed={flag(state?.bulletList)} disabled={editor === null} onClick={() => editor?.chain().focus().toggleBulletList().run()} className={TOOL}>
          •≡
        </button>
        <button type="button" aria-label={t('toolbar.orderedList')} aria-pressed={flag(state?.orderedList)} disabled={editor === null} onClick={() => editor?.chain().focus().toggleOrderedList().run()} className={TOOL}>
          1.
        </button>
        <span className={SEP} aria-hidden="true" />
        <button type="button" aria-label={t('toolbar.youtube')} disabled={editor === null} onClick={open('youtube')} className={TOOL}>
          YouTube
        </button>
        <button type="button" aria-label={t('toolbar.product')} disabled={editor === null} onClick={open('product')} className={TOOL}>
          {cardLabel}
        </button>
      </div>
      <EditorContent editor={editor} />

      {dialog === 'link' && editor ? (
        <UrlDialog
          title={t('linkDialog.title')}
          label={t('linkDialog.url')}
          okLabel={t('linkDialog.ok')}
          invalidText={t('linkDialog.invalid')}
          initial={(editor.getAttributes('link').href as string | undefined) ?? ''}
          validate={(url) => /^https?:\/\/\S+$/i.test(url)}
          onSubmit={(url) => {
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
            close();
          }}
          onClose={close}
          returnFocusRef={opener}
          extra={
            state?.link ? (
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().extendMarkRange('link').unsetLink().run();
                  close();
                }}
                className={buttonClass({ variant: 'line' })}
              >
                {t('linkDialog.remove')}
              </button>
            ) : null
          }
        />
      ) : null}

      {dialog === 'youtube' && editor ? (
        <UrlDialog
          title={t('youtubeDialog.title')}
          label={t('youtubeDialog.url')}
          okLabel={t('youtubeDialog.ok')}
          invalidText={t('youtubeDialog.invalid')}
          initial=""
          validate={(url) => isValidYoutubeUrl(url) !== null}
          onSubmit={(url) => {
            editor.chain().focus().setYoutubeVideo({ src: url }).run();
            close();
          }}
          onClose={close}
          returnFocusRef={opener}
        />
      ) : null}

      {dialog === 'product' && editor ? (
        <ProductDialog
          search={searchProducts}
          onPick={(hit) => {
            editor.chain().focus().insertContent({ type: 'productCard', attrs: { id: hit.id, name: hit.name } }).run();
            close();
          }}
          onClose={close}
          returnFocusRef={opener}
        />
      ) : null}
    </div>
  );
}

/** The product-card dialog: search, pick one, and the card is inserted. */
function ProductDialog({
  search,
  onPick,
  onClose,
  returnFocusRef,
}: {
  search: ProductSearch;
  onPick: (hit: ProductPickerHit) => void;
  onClose: () => void;
  returnFocusRef: RefObject<HTMLElement | null>;
}) {
  const t = useTranslations('admin.news.editor');
  const container = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModalDialog({ open: true, onClose, containerRef: container, returnFocusRef });
  return (
    <div className="fixed inset-0 z-60 grid place-items-center bg-ink/50 p-4">
      <div ref={container} role="dialog" aria-modal="true" aria-labelledby={titleId} className="w-full max-w-[440px] rounded-md bg-surface p-5 shadow-1">
        <h2 id={titleId} className="font-head text-xl font-bold text-ink">
          {t('productDialog.title')}
        </h2>
        <p className="mt-1 mb-3 text-ink-2">{t('productDialog.hint')}</p>
        <ProductSearchBox search={search} onPick={onPick} autoFocus />
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onClose} className={buttonClass({ variant: 'line' })}>
            {t('productDialog.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
