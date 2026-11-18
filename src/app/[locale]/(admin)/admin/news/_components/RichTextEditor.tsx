'use client';

import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

import { buttonClass } from '@/components/ui/button-class';
import Icon, { type IconName } from '@/components/ui/Icon';
import Select from '@/components/ui/Select';
import { useModalDialog } from '@/components/ui/use-modal-dialog';
import type { LandingProductCard } from '@/server/services/catalogue/landing-catalogue-service';
import type { ProductPickerHit } from '@/server/services/catalogue/product-search-service';
import { wouldLoseContent } from './body-roundtrip';
import { buildExtensions } from './editor-extensions';
import { BodyLockedContext } from './EmbedResizeHandle';
import { ProductCardsContext, type ProductCards } from './ProductCardView';
import { youtubeEmbedFromUrl } from './youtube-embed';
import { ProductCombobox, type ProductSearch } from './ProductPicker';

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

// The admin mockup's `.tb`, `.tsep` and `.ed-block` (D-257): 38px icon buttons, ink when pressed. Below `sm` each
// button's tap target is 44px tall (3px above and below); the toolbar's rows are 6px apart there so targets never overlap.
const TOOL =
  'relative grid size-[38px] cursor-pointer place-items-center rounded-sm text-ink-2 transition-colors not-aria-pressed:hover:bg-sunk not-aria-pressed:hover:text-ink aria-pressed:bg-ink aria-pressed:text-white disabled:cursor-not-allowed disabled:opacity-40 max-sm:after:absolute max-sm:after:inset-x-0 max-sm:after:-inset-y-[3px]';
const SEP = 'mx-1.5 h-[22px] w-px bg-line';

type DialogKind = 'link' | 'youtube' | 'product';

/**
 * Loads the storefront cards for product ids (D-266): each id maps to its card, or to null where the article page would
 * draw nothing. An id left out of the answer stays loading. The editor sends at most `PRODUCT_CARDS_BATCH` ids a call.
 */
export type ProductCardsLoader = (ids: string[]) => Promise<Record<string, LandingProductCard | null>>;

/** The most ids in one load: `productCardsCommand` refuses a longer list (`PRODUCT_CARDS_LIMIT`). */
const PRODUCT_CARDS_BATCH = 100;

// The id shape the article page draws a card for (`splitAtProductCards`); any other id is one readers never see.
const CARD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The ids of the document's product cards, each once, in order. Cards are top-level only (R16). */
function cardIdsIn(doc: ProseMirrorNode): string[] {
  const ids = new Set<string>();
  doc.forEach((child) => {
    if (child.type.name === 'productCard' && typeof child.attrs.id === 'string' && child.attrs.id !== '') ids.add(child.attrs.id);
  });
  return [...ids];
}

/**
 * One toolbar button: an icon, with the action as its accessible name and tooltip. `shortcut` is the letter of a Ctrl
 * (Cmd on a Mac) shortcut the editor already binds (StarterKit's bold and italic), shown in the tooltip as the mockup
 * does. `pressed` is given only for a mark or list that can be on, so the video and card buttons are not toggles.
 */
function Tool({
  icon,
  label,
  shortcut,
  pressed,
  disabled,
  onClick,
}: {
  icon: IconName;
  label: string;
  shortcut?: string;
  pressed?: boolean;
  disabled: boolean;
  onClick: (event: { currentTarget: HTMLButtonElement }) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={shortcut === undefined ? label : `${label} (Ctrl+${shortcut})`}
      aria-keyshortcuts={shortcut === undefined ? undefined : `Control+${shortcut} Meta+${shortcut}`}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={TOOL}
    >
      <Icon name={icon} className="size-[18px]" />
    </button>
  );
}

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
          <button type="button" onClick={onClose} className={buttonClass({ variant: 'line', size: 'admin' })}>
            {t('linkDialog.cancel')}
          </button>
          <button type="button" onClick={submit} className={buttonClass({ variant: 'brand', size: 'admin' })}>
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
  /**
   * Loads the cards the body shows, so each is drawn as readers see it (D-266): once on load for every card in the body,
   * then for each new one. Without it every card stays the loading skeleton.
   */
  loadProductCards?: ProductCardsLoader;
  /** Called with the product picked for a new card, so the article can add it to its related products (D-267). */
  onProductCardInserted?: (hit: ProductPickerHit) => void;
  /**
   * Called when a product's last card leaves the body (`removed`) or a product's card comes back (`added`, by undo or
   * paste), so the article can keep its related products in step (D-268). Not called for the stored body on load, nor
   * while the body is locked.
   */
  onProductCardsChange?: (change: { added: string[]; removed: string[] }) => void;
};

/**
 * The article body editor (D-244): Tiptap on ProseMirror, writing plain HTML. Its toolbar is exactly the brief's:
 * paragraph style, bold, italic, link, the two lists, a YouTube video and a product card. There is no image button,
 * no upload, no paste or drop of files: the image node is registered only so an imported body's `<img>` survives a save
 * and so a later task can add the control. Client-only: nothing on a storefront page imports this file.
 */
export default function RichTextEditor({
  label,
  initialHtml,
  onChange,
  onLockedChange,
  searchProducts,
  loadProductCards,
  onProductCardInserted,
  onProductCardsChange,
}: RichTextEditorProps) {
  const t = useTranslations('admin.news.editor');
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const cardLabel = t('productCard');
  const blockId = useId();
  // The stored body holds something the editor cannot keep: it is shown read-only and saved exactly as stored.
  const [locked, setLocked] = useState(false);
  // Read by the update handler, which must see the latest value: a locked body never reports a change.
  const lockedRef = useRef(false);
  // The body's card products as last reported, and the latest callback (the editor's options are fixed at creation).
  const cardIdsRef = useRef<string[] | null>(null);
  const cardsChangeRef = useRef(onProductCardsChange);
  useEffect(() => {
    cardsChangeRef.current = onProductCardsChange;
  });

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
        // The text styles skip the product card's node view (`:not(tinz-product …)`), so its name, price and stock look
        // exactly as on the storefront card (D-266); links and paragraphs in the article text are unchanged.
        class:
          'min-h-[320px] px-4 py-3 outline-none lg:min-h-[560px] [&_p:not(tinz-product_p)]:my-3 [&_h2]:my-3 [&_h2]:text-xl [&_h2]:font-bold [&_h3:not(tinz-product_h3)]:my-3 [&_h3:not(tinz-product_h3)]:text-lg [&_h3:not(tinz-product_h3)]:font-bold [&_a:not(tinz-product_a)]:text-brand [&_a:not(tinz-product_a)]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:border-l-4 [&_blockquote]:border-accent [&_blockquote]:bg-page [&_blockquote]:px-4 [&_blockquote]:py-1 [&_img:not(tinz-product_img)]:max-w-full [&_iframe]:aspect-video [&_iframe]:w-full',
      },
    },
    // Even a selection-only transaction can change the document (the trailing paragraph, a split figure), so a locked body
    // reports nothing, whatever happens inside it.
    onUpdate: ({ editor: current }) => {
      if (lockedRef.current) return;
      onChange(current.getHTML());
      const before = cardIdsRef.current;
      if (before === null) return;
      const now = cardIdsIn(current.state.doc);
      const added = now.filter((id) => !before.includes(id));
      const removed = before.filter((id) => !now.includes(id));
      cardIdsRef.current = now;
      if (added.length > 0 || removed.length > 0) cardsChangeRef.current?.({ added, removed });
    },
  });

  useEffect(() => {
    if (editor === null) return;
    const lossy = wouldLoseContent(initialHtml, editor.getHTML());
    // eslint-disable-next-line react-hooks/set-state-in-effect -- decided once, when the editor first exists
    lockedRef.current = lossy;
    // The stored body's cards are the starting point: loading them reports nothing (D-268).
    cardIdsRef.current = cardIdsIn(editor.state.doc);
    setLocked(lossy);
    onLockedChange?.(lossy);
    editor.setEditable(!lossy, false);
    // The body prop is the stored one; later edits must not re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // The product cards' data (D-266), filled by one load for the body's cards and one for each card added later.
  const [productCards, setProductCards] = useState<ProductCards>({});
  const loaderRef = useRef(loadProductCards);
  useEffect(() => {
    loaderRef.current = loadProductCards;
  });
  useEffect(() => {
    if (editor === null) return;
    // Asked once each: a failed or refused load leaves the card loading rather than asking again on every keystroke.
    const asked = new Set<string>();
    let live = true;
    const loadNew = () => {
      const load = loaderRef.current;
      if (load === undefined) return;
      const fresh = cardIdsIn(editor.state.doc).filter((id) => !asked.has(id));
      if (fresh.length === 0) return;
      for (const id of fresh) asked.add(id);
      // An id that is not a uuid is dropped by the sanitiser, so readers never see that card.
      const unseen = fresh.filter((id) => !CARD_ID.test(id));
      if (unseen.length > 0) setProductCards((known) => ({ ...known, ...Object.fromEntries(unseen.map((id) => [id, null])) }));
      const ids = fresh.filter((id) => CARD_ID.test(id));
      for (let start = 0; start < ids.length; start += PRODUCT_CARDS_BATCH) {
        const batch = ids.slice(start, start + PRODUCT_CARDS_BATCH);
        load(batch).then(
          (found) => {
            const answered = batch.filter((id) => id in found);
            if (live && answered.length > 0) setProductCards((known) => ({ ...known, ...Object.fromEntries(answered.map((id) => [id, found[id] ?? null])) }));
          },
          () => {},
        );
      }
    };
    loadNew();
    editor.on('update', loadNew);
    return () => {
      live = false;
      editor.off('update', loadNew);
    };
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
      <div
        role="toolbar"
        aria-label={t('toolbar.label')}
        className="flex flex-wrap items-center gap-x-0.5 gap-y-1.5 rounded-t-md border-b border-line bg-page/40 px-2.5 py-2 sm:gap-y-0.5"
      >
        <label htmlFor={blockId} className="sr-only">
          {t('toolbar.block')}
        </label>
        <Select
          id={blockId}
          size="toolbar"
          value={block}
          disabled={off}
          onChange={(kind) => editor && setBlock(editor, kind as BlockKind)}
          options={[
            ...(['p', 'h2', 'h3', 'blockquote'] as const).map((kind) => ({ value: kind, label: t(`block.${kind}`) })),
            ...(block === 'other' ? [{ value: 'other', label: t('block.other'), disabled: true }] : []),
          ]}
        />
        <span className={SEP} aria-hidden="true" />
        <Tool icon="bold" label={t('toolbar.bold')} shortcut="B" pressed={flag(state?.bold)} disabled={off} onClick={() => editor?.chain().focus().toggleBold().run()} />
        <Tool icon="italic" label={t('toolbar.italic')} shortcut="I" pressed={flag(state?.italic)} disabled={off} onClick={() => editor?.chain().focus().toggleItalic().run()} />
        <Tool icon="link" label={t('toolbar.link')} pressed={flag(state?.link)} disabled={off} onClick={open('link')} />
        <span className={SEP} aria-hidden="true" />
        <Tool icon="bulletList" label={t('toolbar.bulletList')} pressed={flag(state?.bulletList)} disabled={off} onClick={() => editor?.chain().focus().toggleBulletList().run()} />
        <Tool icon="orderedList" label={t('toolbar.orderedList')} pressed={flag(state?.orderedList)} disabled={off} onClick={() => editor?.chain().focus().toggleOrderedList().run()} />
        <span className={SEP} aria-hidden="true" />
        <Tool icon="video" label={t('toolbar.youtube')} disabled={off} onClick={open('youtube')} />
        <Tool icon="cart" label={t('toolbar.product')} disabled={off} onClick={open('product')} />
      </div>
      {locked ? (
        <p role="alert" className="border-b border-line bg-warn-soft p-3 font-medium text-warn">
          {t('bodyLocked')}
        </p>
      ) : null}
      <ProductCardsContext value={productCards}>
        <BodyLockedContext value={locked}>
          <EditorContent editor={editor} />
        </BodyLockedContext>
      </ProductCardsContext>

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
                className={buttonClass({ variant: 'line', size: 'admin' })}
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
            // After the current top-level block, never inside a list item, quote or cell (R16).
            const { $to } = editor.state.selection;
            const at = $to.depth >= 1 ? $to.after(1) : $to.pos;
            editor.chain().focus().insertContentAt(at, { type: 'productCard', attrs: { id: hit.id, name: hit.name } }).run();
            onProductCardInserted?.(hit);
            close();
          }}
          onClose={close}
          returnFocusRef={opener}
        />
      ) : null}
    </div>
  );
}

/** The product-card dialog: the product field (D-272) takes focus; open it, search, pick one, and the card is inserted. */
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
        <ProductCombobox search={search} onPick={onPick} />
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={onClose} className={buttonClass({ variant: 'line', size: 'admin' })}>
            {t('productDialog.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
