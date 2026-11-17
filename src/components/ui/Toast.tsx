'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import Icon from './Icon';

/** How long a toast stays up, not counting time paused under the pointer or focus. */
export const TOAST_DURATION_MS = 4000;
/** The leave fade; the card is removed after it. */
export const TOAST_LEAVE_MS = 150;
/** The front card plus two peeking behind it; an older one is dropped. */
const MAX_TOASTS = 3;

export type ToastApi = {
  /** Shows a success message: a short sentence, already translated. */
  success: (message: string) => void;
};

type ToastItem = { id: number; message: string; leaving: boolean };

const ToastContext = createContext<ToastApi | null>(null);

/** The toast of the nearest `ToastProvider`. Errors are not toasts: a form shows its own error inline (D-262). */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (api === null) throw new Error('useToast needs a ToastProvider above it');
  return api;
}

/** How a card behind the front one peeks out above it (the owner's reference): a little higher and a little smaller. */
const PEEK = ['', 'translate-y-[-9px] scale-[0.96]', 'translate-y-[-18px] scale-[0.92]'];

function ToastCard({
  toast,
  depth,
  paused,
  closeLabel,
  onDismiss,
}: {
  toast: ToastItem;
  /** 0 is the front card. */
  depth: number;
  paused: boolean;
  closeLabel: string;
  onDismiss: (id: number) => void;
}) {
  const remaining = useRef(TOAST_DURATION_MS);
  const { id, leaving } = toast;
  // The clock runs only while nothing pauses it; a pause keeps the time already used.
  useEffect(() => {
    if (paused || leaving) return;
    const started = Date.now();
    const timer = setTimeout(() => onDismiss(id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - started;
    };
  }, [paused, leaving, id, onDismiss]);

  const isFront = depth === 0;
  return (
    <div
      data-toast={isFront ? 'front' : 'behind'}
      data-leaving={leaving ? 'true' : undefined}
      // A card behind the front one is covered: its close button stays out of the tab order.
      inert={!isFront}
      style={{ zIndex: MAX_TOASTS - depth }}
      className={`group relative col-start-1 row-start-1 origin-bottom self-end transition-[translate,scale,opacity] ease-soft ${PEEK[depth] ?? ''} ${
        leaving ? 'opacity-0 duration-150' : 'duration-200'
      }`}
    >
      <div className="flex animate-toast-in items-center gap-3 rounded-md border border-line bg-surface px-4 py-3.5 text-ink shadow-1">
        <Icon name="checkCircle" className="size-5 flex-none text-ink" />
        <p className={`min-w-0 flex-1 text-[15px] font-semibold ${isFront ? '' : 'invisible'}`}>{toast.message}</p>
        <button
          type="button"
          aria-label={closeLabel}
          onClick={(event) => {
            // Let go of focus first, so the stack does not stay paused by a button that is about to go.
            event.currentTarget.blur();
            onDismiss(id);
          }}
          className="relative -my-1 -mr-1.5 grid size-7 flex-none cursor-pointer place-items-center rounded-sm text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-sunk hover:text-ink focus-visible:opacity-100 max-sm:opacity-100 max-sm:after:absolute max-sm:after:-inset-2"
        >
          <Icon name="x" className="size-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * The back office's success toast (D-262), mounted once in `AdminShell`: a white card at the bottom right with a ticked circle
 * and the message, newest in front and up to two older ones peeking behind it. It rises in over 200ms, leaves itself after
 * about four seconds (paused while the pointer or focus is on it), and fades out over 150ms; a close button shows on hover
 * and focus (always on a phone, which has no hover). It never takes focus. Screen readers hear each message through one
 * polite live region that is always in the page, so the first message is announced too.
 */
export function ToastProvider({ closeLabel, children }: { closeLabel: string; children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const nextId = useRef(0);
  const leaveTimers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const timers = leaveTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  // A card closed under the pointer goes without a leave event: once the stack is empty, nothing pauses the next one.
  useEffect(() => {
    if (toasts.length > 0) return;
    setHovered(false);
    setFocused(false);
  }, [toasts.length]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)));
    const timer = setTimeout(() => {
      leaveTimers.current.delete(timer);
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, TOAST_LEAVE_MS);
    leaveTimers.current.add(timer);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => {
        nextId.current += 1;
        const id = nextId.current;
        setToasts((current) => [...current, { id, message, leaving: false }].slice(-MAX_TOASTS));
      },
    }),
    [],
  );

  // Newest first: the front card is the last one added.
  const shown = [...toasts].reverse();
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div role="status" aria-live="polite" className="sr-only">
        {toasts.map((toast) => (
          <p key={toast.id}>{toast.message}</p>
        ))}
      </div>
      {toasts.length === 0 ? null : (
        <div
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
          onFocus={() => setFocused(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
          }}
          className="fixed right-4 bottom-4 z-80 grid w-[min(360px,calc(100vw-32px))] md:right-7"
        >
          {shown.map((toast, depth) => (
            <ToastCard key={toast.id} toast={toast} depth={depth} paused={hovered || focused} closeLabel={closeLabel} onDismiss={dismiss} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
