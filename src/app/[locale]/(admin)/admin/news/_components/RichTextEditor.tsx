'use client';

import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Editor } from '@tiptap/core';

import { buttonClass } from '@/components/ui/button-class';
import { useModalDialog } from '@/components/ui/use-modal-dialog';
import type { ProductPickerHit } from '@/server/services/catalogue/product-search-service';
import { wouldLoseContent } from './body-roundtrip';
import { buildExtensions } from './editor-extensions';
import { youtubeEmbedFromUrl } from './youtube-embed';
import { ProductSearchBox, type ProductSearch } from './ProductPicker';

type BlockKind = 'p' | 'h2' | 'h3' | 'blockquote' | 'other';

function blockOf(editor: Editor | null): BlockKind {
  if (editor === null) return 'p';
  if (editor.isActive('heading', { level: 2 })) return 'h2';
  if (editor.isActive('heading', { level: 3 })) return 'h3';
  if (editor.isActive('blockquote')) return 'blockquote';
  if (editor.isActive('heading')) return 'other';
  return 'p';
}

function setBlock(editor: Editor, kind: BlockKind): void {
  if (kind === 'other') return;
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
  /** Called when the guard decides, once the editor exists: true means the body is read-only and must be saved as stored. */
  onLockedChange?: (locked: boolean) => void;
  /** The product picker's search, for the product-card button. */
  searchProducts: ProductSearch;
};

/**
 * The article body editor (D-244): Tiptap on ProseMirror, writing plain HTML. Its toolbar is exactly the brief's:
 * paragraph style, bold, italic, link, the two lists, a YouTube video and a product card. There is no image button,
 * no upload, no paste or drop of files: the image node is registered only so an imported body's `<img>` survives a save
 * and so a later task can add the control. Client-only: nothing on a storefront page imports this file.
 */
export default function RichTextEditor({ label, initialHtml, onChange, onLockedChange, searchProducts }: RichTextEditorProps) {
  const t = useTranslations('admin.news.editor');
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const cardLabel = t('productCard');
  const blockId = useId();
  // The stored body holds something the editor cannot keep: it is shown read-only and saved exactly as stored.
  const [locked, setLocked] = useState(false);
  // Read by the update handler, which must see the latest value: a locked body never reports a change.
  const lockedRef = useRef(false);

  const editor = useEditor({
    // Rendered on the server as the empty shell; the editor mounts in the browser (avoids a hydration mismatch).
    immediatelyRender: false,
    extensions: buildExtensions(cardLabel),
    content: initialHtml,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
        class: 'min-h-[320px] px-4 py-3 outline-none [&_p]:my-3 [&_h2]:my-3 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:my-3 [&_h3]:text-lg [&_h3]:font-bold [&_a]:text-brand [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:border-l-4 [&_blockquote]:border-accent [&_blockquote]:bg-page [&_blockquote]:px-4 [&_blockquote]:py-1 [&_img]:max-w-full [&_iframe]:aspect-video [&_iframe]:w-full',
      },
    },
    // Even a selection-only transaction can change the document (the trailing paragraph, a split figure), so a locked body
    // reports nothing, whatever happens inside it.
    onUpdate: ({ editor: current }) => {
      if (!lockedRef.current) onChange(current.getHTML());
    },
  });

  useEffect(() => {
    if (editor === null) return;
    const lossy = wouldLoseContent(initialHtml, editor.getHTML());
    // eslint-disable-next-line react-hooks/set-state-in-effect -- decided once, when the editor first exists
    lockedRef.current = lossy;
    setLocked(lossy);
    onLockedChange?.(lossy);
    editor.setEditable(!lossy, false);
    // The body prop is the stored one; later edits must not re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

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
  const off = editor === null || locked;

  return (
    <div className="rounded-md border border-line bg-surface">
      <div role="toolbar" aria-label={t('toolbar.label')} className="flex flex-wrap items-center gap-0.5 border-b border-line p-1.5">
        <label htmlFor={blockId} className="sr-only">
          {t('toolbar.block')}
        </label>
        <select
          id={blockId}
          value={block}
          disabled={off}
          onChange={(event) => editor && setBlock(editor, event.target.value as BlockKind)}
          className="min-h-11 rounded-sm border-[1.5px] border-line-2 bg-surface px-2.5 text-ink"
        >
          {(['p', 'h2', 'h3', 'blockquote'] as const).map((kind) => (
            <option key={kind} value={kind}>
              {t(`block.${kind}`)}
            </option>
          ))}
          {block === 'other' ? (
            <option value="other" disabled>
              {t('block.other')}
            </option>
          ) : null}
        </select>
        <span className={SEP} aria-hidden="true" />
        <button type="button" aria-label={t('toolbar.bold')} aria-pressed={flag(state?.bold)} disabled={off} onClick={() => editor?.chain().focus().toggleBold().run()} className={`${TOOL} font-bold`}>
          B
        </button>
        <button type="button" aria-label={t('toolbar.italic')} aria-pressed={flag(state?.italic)} disabled={off} onClick={() => editor?.chain().focus().toggleItalic().run()} className={`${TOOL} italic`}>
          I
        </button>
        <button type="button" aria-label={t('toolbar.link')} aria-pressed={flag(state?.link)} disabled={off} onClick={open('link')} className={TOOL}>
          URL
        </button>
        <span className={SEP} aria-hidden="true" />
        <button type="button" aria-label={t('toolbar.bulletList')} aria-pressed={flag(state?.bulletList)} disabled={off} onClick={() => editor?.chain().focus().toggleBulletList().run()} className={TOOL}>
          •≡
        </button>
        <button type="button" aria-label={t('toolbar.orderedList')} aria-pressed={flag(state?.orderedList)} disabled={off} onClick={() => editor?.chain().focus().toggleOrderedList().run()} className={TOOL}>
          1.
        </button>
        <span className={SEP} aria-hidden="true" />
        <button type="button" aria-label={t('toolbar.youtube')} disabled={off} onClick={open('youtube')} className={TOOL}>
          YouTube
        </button>
        <button type="button" aria-label={t('toolbar.product')} disabled={off} onClick={open('product')} className={TOOL}>
          {cardLabel}
        </button>
      </div>
      {locked ? (
        <p role="alert" className="border-b border-line bg-warn-soft p-3 font-medium text-warn">
          {t('bodyLocked')}
        </p>
      ) : null}
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
          validate={(url) => youtubeEmbedFromUrl(url) !== null}
          onSubmit={(url) => {
            editor.chain().focus().insertContent({ type: 'youtube', attrs: { src: youtubeEmbedFromUrl(url), fullscreen: true } }).run();
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
