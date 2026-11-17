'use client';

import { useEffect, useRef, type RefObject } from 'react';

export type UseModalDialogOptions = {
  /** Whether the dialog is showing. Nothing happens while it is false. */
  open: boolean;
  /** Called on Escape. The caller closes the dialog. */
  onClose: () => void;
  /** The dialog's element: focus moves into it, and Tab stays inside it. */
  containerRef: RefObject<HTMLElement | null>;
  /** The control that opened it: focus goes back here when the dialog closes. */
  returnFocusRef: RefObject<HTMLElement | null>;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => !element.hidden);
}

/**
 * The behaviour of a modal dialog (07 Responsive; plan 015, R8): while `open`, focus moves to the first focusable element
 * inside, Tab and Shift+Tab wrap inside, Escape calls `onClose` (unless a control inside already handled it), and the page behind does not scroll. When it
 * closes, focus returns to `returnFocusRef`.
 */
export function useModalDialog({ open, onClose, containerRef, returnFocusRef }: UseModalDialogOptions): void {
  // Always the latest callback, without re-running the effect (and so without re-moving focus) when it changes.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    const returnTo = returnFocusRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (container !== null) (focusableIn(container)[0] ?? container).focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // A control inside that used the Escape itself (an open `Select` or row menu closing) keeps the dialog open.
        if (event.defaultPrevented) return;
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || container === null) return;
      const items = focusableIn(container);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (!container.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      returnTo?.focus();
    };
  }, [open, containerRef, returnFocusRef]);
}
