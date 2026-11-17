'use client';

import { useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import { buttonClass } from './button-class';
import Icon, { type IconName } from './Icon';
import { useModalDialog } from './use-modal-dialog';

export type ConfirmDialogProps = {
  open: boolean;
  /** Called by cancel, Escape and a press on the scrim. The caller closes the dialog. */
  onClose: () => void;
  title: string;
  text: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** `danger` (a destructive action) draws the red confirm button, and the red tile when there is an `icon`. */
  tone?: 'default' | 'danger';
  /** The 48px tile's icon above the title (the mockup's `.modal__ico`), for a destructive action. */
  icon?: IconName;
  /**
   * The id of the form the confirm button submits (`form="…"`). The caller keeps the dialog open until the action's result
   * and then closes it: the confirm button must still be in the page when the browser submits.
   */
  form?: string;
  /** Called by the confirm button when there is no `form`. */
  onConfirm?: () => void;
  /** The action is running: the confirm button is disabled. */
  pending?: boolean;
  /** The control that opened it (for a row menu's item, the menu's button): focus goes back there when it closes. */
  returnFocusRef: RefObject<HTMLElement | null>;
};

/**
 * The one confirm dialog (the admin mockup's `.modal`, D-261), asked before an action that cannot simply be taken back:
 * centred, a title, a sentence, then cancel and the confirm button on the right. An `alertdialog` with `useModalDialog`'s
 * behaviour; focus starts on cancel. Drawn in a portal, and only while `open`.
 */
export default function ConfirmDialog({
  open,
  onClose,
  title,
  text,
  confirmLabel,
  cancelLabel,
  tone = 'default',
  icon,
  form,
  onConfirm,
  pending = false,
  returnFocusRef,
}: ConfirmDialogProps) {
  const titleId = useId();
  const textId = useId();
  const panel = useRef<HTMLDivElement>(null);
  useModalDialog({ open, onClose, containerRef: panel, returnFocusRef });

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-70 grid place-items-center">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 animate-fade-in bg-ink/45" />
      <div
        ref={panel}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
        className="relative max-h-[calc(100vh-40px)] w-[min(480px,calc(100%-32px))] animate-modal-in overflow-auto rounded-[16px] bg-surface p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,.4)]"
      >
        {icon === undefined ? null : (
          <div
            data-confirm-icon=""
            className={`mb-3.5 grid size-12 place-items-center rounded-md ${tone === 'danger' ? 'bg-sale/10 text-sale' : 'bg-brand-soft text-brand-dark'}`}
          >
            <Icon name={icon} />
          </div>
        )}
        <h2 id={titleId} className="font-head text-xl font-bold text-ink">
          {title}
        </h2>
        <p id={textId} className="mt-2 text-ink-2">
          {text}
        </p>
        <div className="mt-[22px] flex flex-wrap justify-end gap-2.5">
          <button type="button" onClick={onClose} className={buttonClass({ variant: 'line', size: 'admin' })}>
            {cancelLabel}
          </button>
          <button
            type={form === undefined ? 'button' : 'submit'}
            form={form}
            onClick={form === undefined ? onConfirm : undefined}
            disabled={pending}
            className={`${buttonClass({ variant: tone === 'danger' ? 'danger' : 'brand', size: 'admin' })} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
