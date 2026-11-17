'use client';

import { useLayoutEffect, type RefObject } from 'react';

/** The space between the anchor and the popup. */
const GAP = 6;
/** The space the popup keeps from the edges of the viewport. */
const MARGIN = 8;

export type AnchoredPopupOptions = {
  open: boolean;
  /** The control the popup belongs to (a dropdown's trigger). */
  anchorRef: RefObject<HTMLElement | null>;
  /** The popup, drawn in a portal with `position: fixed`. */
  popupRef: RefObject<HTMLElement | null>;
  /** The tallest the popup may be; it scrolls inside beyond that. */
  maxHeight: number;
  /**
   * Choose the side as if the popup were already `maxHeight` tall, rather than measuring it: for a popup whose content
   * arrives after it opens (a search's results), so it does not open below with no room and stay there.
   */
  sizeToMax?: boolean;
};

/**
 * Places a fixed-position popup against its anchor (D-258, D-271): 6px below it, or above it when it does not fit below
 * and there is more room above; at least as wide as the anchor; kept 8px inside the viewport on the left and right; as
 * tall as the room on its side allows, up to `maxHeight`. It is placed when it opens and again whenever the window is
 * resized or anything but the popup itself scrolls. A fixed popup never adds to the page's height, so it cannot make the
 * document longer than its layout. Shared by `Select` and the news editor's `ProductCombobox`.
 */
export function useAnchoredPopup({ open, anchorRef, popupRef, maxHeight, sizeToMax = false }: AnchoredPopupOptions): void {
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = anchorRef.current;
      const popup = popupRef.current;
      if (anchor === null || popup === null) return;
      const rect = anchor.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - GAP - MARGIN;
      const above = rect.top - GAP - MARGIN;
      const wanted = sizeToMax ? maxHeight : Math.min(maxHeight, popup.scrollHeight);
      const up = wanted > below && above > below;
      popup.style.minWidth = `${rect.width}px`;
      popup.style.maxHeight = `${Math.max(0, Math.min(maxHeight, up ? above : below))}px`;
      popup.style.top = up ? '' : `${rect.bottom + GAP}px`;
      popup.style.bottom = up ? `${window.innerHeight - rect.top + GAP}px` : '';
      const width = Math.max(popup.offsetWidth, rect.width);
      popup.style.left = `${Math.max(MARGIN, Math.min(rect.left, window.innerWidth - MARGIN - width))}px`;
    };
    place();
    // A scroll inside the popup (its list) does not move the anchor.
    const onScroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node && (popupRef.current?.contains(target) ?? false))) place();
    };
    window.addEventListener('resize', place);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open, anchorRef, popupRef, maxHeight, sizeToMax]);
}
