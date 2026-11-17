'use client';

import { useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import Icon from './Icon';
import { useModalDialog } from './use-modal-dialog';

export type DrawerProps = {
  open: boolean;
  /** Called by Escape, the close button and a press on the scrim. The caller closes the drawer. */
  onClose: () => void;
  title: string;
  /** The close button's accessible name ("ปิด"). */
  closeLabel: string;
  /** The control that opened it: focus goes back there when it closes. */
  returnFocusRef: RefObject<HTMLElement | null>;
  /** The scrolling body. */
  children: ReactNode;
  /** The footer's buttons, right-aligned (a submit button reaches a form in the body with `form="…"`). */
  footer?: ReactNode;
};

/**
 * A panel that slides in from the right over a scrim (the admin mockup's `.sheet`, D-261), for editing one record without
 * leaving the list: a header with the title and a close button, a scrolling body and a footer of buttons. A modal dialog
 * (`role="dialog"`, `aria-modal`, named by its title) with `useModalDialog`'s behaviour; drawn in a portal, and only while
 * `open`. It slides in over 280ms, not at all under reduced motion, and leaves at once.
 */
export default function Drawer({ open, onClose, title, closeLabel, returnFocusRef, children, footer }: DrawerProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  useModalDialog({ open, onClose, containerRef: panel, returnFocusRef });

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-70">
      <div data-scrim="" aria-hidden="true" onClick={onClose} className="absolute inset-0 animate-fade-in bg-ink/45" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-y-0 right-0 flex w-[min(520px,100%)] animate-sheet-in flex-col bg-surface shadow-[-20px_0_60px_-20px_rgba(0,0,0,.3)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-[22px] py-[18px]">
          <h2 id={titleId} className="font-head text-xl font-bold text-ink">
            {title}
          </h2>
          {/* The mockup's `.icon-b`: 42px, 44px on a phone. */}
          <button
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            className="grid size-11 flex-none cursor-pointer place-items-center rounded-[9px] text-ink-2 transition-colors hover:bg-sunk hover:text-ink sm:size-[42px]"
          >
            <Icon name="x" />
          </button>
        </div>
        <div className="grid flex-1 content-start gap-4 overflow-auto overscroll-contain px-[22px] py-5">{children}</div>
        {footer === undefined ? null : (
          // The mockup's #FAFBFC footer: half the page grey on white.
          <div className="flex flex-wrap justify-end gap-2.5 border-t border-line bg-page/50 px-[22px] py-3.5">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
