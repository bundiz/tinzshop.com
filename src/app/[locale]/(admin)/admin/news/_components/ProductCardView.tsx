'use client';

import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { useTranslations } from 'next-intl';
import { createContext, useContext, useState } from 'react';

import Icon from '@/components/ui/Icon';
import type { LandingProductCard } from '@/server/services/catalogue/landing-catalogue-service';
import ArticleProductCard from '../../../../(shop)/news/[slug]/_components/ArticleProductCard';
import EmbedResizeHandle, { BodyLockedContext, embedFrameStyle, embedWidthOf } from './EmbedResizeHandle';

/**
 * The cards the editor has loaded, by product id (D-266): a card, or null where the article page draws nothing (an
 * unknown, inactive or hidden product). An id with no entry is still loading. `RichTextEditor` owns and fills it.
 */
export type ProductCards = Readonly<Record<string, LandingProductCard | null>>;

export const ProductCardsContext = createContext<ProductCards>({});

// The storefront card's frame (`ArticleProductCard`), so the skeleton and the notice take the card's place and size.
const FRAME = 'my-5 flex gap-3 rounded-[14px] border border-line p-2 sm:rounded-lg sm:p-3';
const PICTURE = 'aspect-square w-[96px] flex-none rounded-md sm:w-[140px]';

// The remove button (owner, 2026-11-17): 32px, inside the card's top-right corner, with a 44px hit area below `sm`
// (D-221). Hidden until the pointer is over the card, focus is inside it or the node is selected; a touch screen (no
// hover) always shows it. It fades in 130ms, at once under reduced motion. Hidden, it stays in the tab order.
const REMOVE =
  'absolute top-3 right-3 z-10 grid size-8 cursor-pointer place-items-center rounded-[8px] border border-line bg-surface text-ink-2 shadow-1 transition-[opacity,background-color,color] duration-[130ms] hover:bg-sunk hover:text-ink motion-reduce:transition-none max-sm:after:absolute max-sm:after:-inset-1.5';
const REMOVE_HIDDEN =
  'pointer-events-none opacity-0 group-hover/card:pointer-events-auto group-hover/card:opacity-100 group-focus-within/card:pointer-events-auto group-focus-within/card:opacity-100 [@media(hover:none)]:pointer-events-auto [@media(hover:none)]:opacity-100';

/**
 * The product card node in the editor (D-266): the storefront's own `ArticleProductCard`, from the live product, so staff
 * see exactly what readers will. The copy is inert, so its link never navigates: a click lands on the wrapper and selects
 * the node, which Delete or Backspace removes. A card-shaped skeleton shows while the data loads, and a muted notice where
 * the article page would draw nothing. The card and the notice carry a remove button inside their top-right corner, shown
 * on hover, focus or selection (always on a touch screen), an ordinary button in the tab order (the node itself is not
 * editable text); it deletes the node in one transaction, so undo brings it back. The card is drawn at its width, centred,
 * with the corner resize handle (`EmbedResizeHandle`, D-273) while the body is editable. The saved HTML is untouched:
 * this view is never written.
 */
export default function ProductCardView({ node, selected, extension, editor, deleteNode, updateAttributes }: ReactNodeViewProps) {
  const t = useTranslations('admin.news.editor');
  const cards = useContext(ProductCardsContext);
  const id = typeof node.attrs.id === 'string' ? node.attrs.id : '';
  const entry = id === '' ? null : cards[id];
  const label = (extension.options as { label: string }).label;
  const name = entry?.name ?? (node.attrs.name as string | null);
  // A read-only (locked) body is saved exactly as stored, so it offers no remove button.
  const removable = entry !== undefined && editor.isEditable;
  const locked = useContext(BodyLockedContext);
  const stored = embedWidthOf(node.attrs.width);
  const [draft, setDraft] = useState<number | null>(null);

  return (
    <NodeViewWrapper
      role="group"
      aria-label={name ? `${label}: ${name}` : label}
      aria-busy={entry === undefined || undefined}
      data-drag-handle=""
      style={embedFrameStyle(draft ?? stored)}
      className={`group/card group/embed relative cursor-pointer rounded-[14px] sm:rounded-lg ${selected ? 'outline-2 outline-offset-2 outline-brand' : ''}`}
    >
      {entry === undefined ? (
        <div data-card-skeleton="" aria-hidden="true" className={`${FRAME} bg-surface`}>
          <div className={`${PICTURE} bg-sunk motion-safe:animate-pulse`} />
          <div className="flex min-w-0 flex-1 flex-col gap-2 px-1 py-1">
            <div className="h-4 rounded-sm bg-sunk motion-safe:animate-pulse" />
            <div className="h-4 w-2/3 rounded-sm bg-sunk motion-safe:animate-pulse" />
            <div className="mt-auto h-5 w-1/3 rounded-sm bg-sunk motion-safe:animate-pulse" />
          </div>
        </div>
      ) : entry === null ? (
        <div className={`${FRAME} items-center border-dashed bg-sunk`}>
          <div className={`${PICTURE} bg-surface/60`} aria-hidden="true" />
          <div className="min-w-0 flex-1 px-1">
            <p className="font-semibold text-ink-2">{t('productCardGone.title')}</p>
            <p className="mt-1 text-sm text-muted">{t('productCardGone.hint')}</p>
          </div>
        </div>
      ) : (
        <div inert className="pointer-events-none">
          <ArticleProductCard card={entry} />
        </div>
      )}
      {removable ? (
        <button
          type="button"
          aria-label={name ? t('productCardRemove.named', { name }) : t('productCardRemove.plain')}
          title={t('productCardRemove.plain')}
          onClick={() => {
            if (editor.isEditable) deleteNode();
          }}
          data-shown={selected || undefined}
          className={`${REMOVE} ${selected ? '' : REMOVE_HIDDEN}`}
        >
          <Icon name="x" className="size-4" />
        </button>
      ) : null}
      {editor.isEditable && !locked ? (
        <EmbedResizeHandle
          label={t('resize.card')}
          width={stored}
          selected={selected}
          onDraft={setDraft}
          onCommit={(width) => {
            if (editor.isEditable) updateAttributes({ width: width < 100 ? width : null });
          }}
        />
      ) : null}
    </NodeViewWrapper>
  );
}
